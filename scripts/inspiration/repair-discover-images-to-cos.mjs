/**
 * Mirror imported discover images into Tencent Cloud COS through the existing
 * upload-asset edge flow, then rewrite the related discover rows in Supabase.
 *
 * This script is intentionally resumable:
 * - uploaded asset urls are persisted in a manifest file
 * - reruns reuse manifest entries to avoid duplicate uploads where possible
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { normalizeExternalInspirationEntry } from './lib/discover-import.mjs';

process.loadEnvFile?.('.env');

const DEFAULT_INPUT = 'tmp/discover-import/awesome-nano-banana-images.json';
const DEFAULT_SITE_KEY = 'awesome-nano-banana-images';
const DEFAULT_OPERATOR_EMAIL = 'discover-cos-repair@fluxa.local';
const DEFAULT_PROJECT_NAME = 'Discover COS Mirror';

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    siteKey: DEFAULT_SITE_KEY,
    siteName: '',
    sourceUrl: '',
    limit: null,
    onlyImportKey: '',
    operatorEmail: DEFAULT_OPERATOR_EMAIL,
    operatorPassword: '',
    projectName: DEFAULT_PROJECT_NAME,
    manifest: '',
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--input') {
      options.input = argv[index + 1] ?? options.input;
      index += 1;
      continue;
    }

    if (arg === '--site-key') {
      options.siteKey = argv[index + 1] ?? options.siteKey;
      index += 1;
      continue;
    }

    if (arg === '--site-name') {
      options.siteName = argv[index + 1] ?? options.siteName;
      index += 1;
      continue;
    }

    if (arg === '--source-url') {
      options.sourceUrl = argv[index + 1] ?? options.sourceUrl;
      index += 1;
      continue;
    }

    if (arg === '--limit') {
      const rawValue = argv[index + 1];
      options.limit = rawValue ? Number.parseInt(rawValue, 10) : null;
      index += 1;
      continue;
    }

    if (arg === '--only-import-key') {
      options.onlyImportKey = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--operator-email') {
      options.operatorEmail = argv[index + 1] ?? options.operatorEmail;
      index += 1;
      continue;
    }

    if (arg === '--operator-password') {
      options.operatorPassword = argv[index + 1] ?? options.operatorPassword;
      index += 1;
      continue;
    }

    if (arg === '--project-name') {
      options.projectName = argv[index + 1] ?? options.projectName;
      index += 1;
      continue;
    }

    if (arg === '--manifest') {
      options.manifest = argv[index + 1] ?? options.manifest;
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  if (!options.manifest) {
    const inputBaseName = path.basename(options.input, path.extname(options.input));
    options.manifest = `tmp/discover-import/${inputBaseName}-cos-manifest.json`;
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/inspiration/repair-discover-images-to-cos.mjs [options]

Options:
  --input <path>            Normalized discover import JSON
  --site-key <slug>         Imported site key tag to repair
  --site-name <name>        Fallback site name while normalizing input
  --source-url <url>        Fallback source url while normalizing input
  --limit <n>               Process only the first n entries
  --only-import-key <key>   Process a single import key
  --operator-email <email>  Temporary uploader account email
  --operator-password <pw>  Temporary uploader account password
  --project-name <name>     Temporary uploader project name
  --manifest <path>         Persist uploaded asset urls for resumable reruns
  --dry-run                 Only print what would be updated
  --help                    Show this message

Env:
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
`);
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function normalizeLocalAssetPath(inputPath, assetPath) {
  if (!assetPath) return '';
  if (path.isAbsolute(assetPath)) return assetPath;
  return path.resolve(path.dirname(path.resolve(process.cwd(), inputPath)), assetPath);
}

function inferMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      throw new Error(`Unsupported image extension: ${extension || 'unknown'} (${filePath})`);
  }
}

function buildStaticCosUrl(rawUrl, storagePath) {
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      // Fall back to storage path below.
    }
  }

  if (!storagePath) {
    throw new Error('Missing upload url and storagePath while building COS url.');
  }

  return `https://fluxa-1390058464.cos.ap-tokyo.myqcloud.com/${storagePath.replace(/^\/+/, '')}`;
}

async function readInputEntries(inputPath, options) {
  const absolutePath = path.resolve(process.cwd(), inputPath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Input JSON must be an array.');
  }

  const normalized = parsed.map((entry, index) => {
    try {
      return normalizeExternalInspirationEntry(entry, {
        siteKey: options.siteKey,
        siteName: options.siteName,
        sourceUrl: options.sourceUrl,
      });
    } catch (error) {
      throw new Error(`Failed to normalize entry at index ${index}: ${error.message}`);
    }
  });

  let filtered = normalized.filter((entry) => entry.siteKey === options.siteKey);

  if (options.onlyImportKey) {
    filtered = filtered.filter((entry) => entry.importKey === options.onlyImportKey);
  }

  if (Number.isInteger(options.limit) && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

async function createClients() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    admin: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
    anon: createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
  };
}

async function findUserByEmail(admin, email) {
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const matchedUser = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (matchedUser) {
      return matchedUser;
    }

    if (!data.users.length || data.users.length < 1000) {
      return null;
    }

    page += 1;
  }
}

async function ensureOperatorContext(clients, options) {
  const password = options.operatorPassword || `Temp-${Date.now()}-DiscoverCos-Aa1!`;
  let operatorUser = await findUserByEmail(clients.admin, options.operatorEmail);

  if (!operatorUser) {
    const { data, error } = await clients.admin.auth.admin.createUser({
      email: options.operatorEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'discover_cos_repair',
      },
    });

    if (error) {
      throw error;
    }

    operatorUser = data.user;
  } else {
    const { error } = await clients.admin.auth.admin.updateUserById(operatorUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(operatorUser.user_metadata ?? {}),
        role: 'discover_cos_repair',
      },
    });

    if (error) {
      throw error;
    }
  }

  const { data: existingProject, error: projectLookupError } = await clients.admin
    .from('projects')
    .select('id')
    .eq('user_id', operatorUser.id)
    .eq('name', options.projectName)
    .limit(1)
    .maybeSingle();

  if (projectLookupError) {
    throw projectLookupError;
  }

  let projectId = existingProject?.id;

  if (!projectId) {
    const { data, error } = await clients.admin
      .from('projects')
      .insert({
        user_id: operatorUser.id,
        name: options.projectName,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    projectId = data.id;
  }

  const { data: signInData, error: signInError } = await clients.anon.auth.signInWithPassword({
    email: options.operatorEmail,
    password,
  });

  if (signInError) {
    throw signInError;
  }

  const accessToken = signInData.session?.access_token;
  if (!accessToken) {
    throw new Error('Failed to obtain operator access token.');
  }

  return {
    operatorUserId: operatorUser.id,
    projectId,
    accessToken,
  };
}

async function loadManifest(manifestPath) {
  try {
    const raw = await fs.readFile(path.resolve(process.cwd(), manifestPath), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {
        version: 1,
        uploads: {},
      };
    }

    throw error;
  }
}

async function writeManifest(manifestPath, manifest) {
  const absolutePath = path.resolve(process.cwd(), manifestPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function extractImportKey(tags, siteKey) {
  if (!Array.isArray(tags)) return null;
  const prefix = `${siteKey}:`;
  return tags.find((tag) => typeof tag === 'string' && tag.startsWith(prefix)) ?? null;
}

async function fetchPublicationsByImportKey(admin, siteKey) {
  const { data, error } = await admin
    .from('publications')
    .select('id, project_id, document_id, conversation_id, cover_image_url, tags, title')
    .contains('tags', [siteKey]);

  if (error) {
    throw error;
  }

  const map = new Map();

  for (const publication of data ?? []) {
    const importKey = extractImportKey(publication.tags, siteKey);
    if (importKey) {
      map.set(importKey, publication);
    }
  }

  return map;
}

async function fetchSnapshotsByPublicationId(admin, publicationIds) {
  const map = new Map();

  for (const ids of chunk(publicationIds, 100)) {
    const { data, error } = await admin
      .from('publication_snapshots')
      .select('id, publication_id, messages_snapshot, ops_snapshot')
      .in('publication_id', ids);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      map.set(row.publication_id, row);
    }
  }

  return map;
}

async function fetchMessagesByConversationId(admin, conversationIds) {
  const map = new Map();

  for (const ids of chunk(conversationIds, 100)) {
    const { data, error } = await admin
      .from('messages')
      .select('id, conversation_id, role, content, metadata')
      .in('conversation_id', ids)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      const current = map.get(row.conversation_id) ?? [];
      current.push(row);
      map.set(row.conversation_id, current);
    }
  }

  return map;
}

async function fetchOpsByDocumentId(admin, documentIds) {
  const map = new Map();

  for (const ids of chunk(documentIds, 100)) {
    const { data, error } = await admin
      .from('ops')
      .select('id, document_id, op_type, payload')
      .in('document_id', ids)
      .order('seq', { ascending: true });

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      const current = map.get(row.document_id) ?? [];
      current.push(row);
      map.set(row.document_id, current);
    }
  }

  return map;
}

async function readLocalAsset(assetPath) {
  const absolutePath = path.resolve(assetPath);
  const bytes = await fs.readFile(absolutePath);
  return {
    bytes,
    fileName: path.basename(absolutePath),
    mimeType: inferMimeType(absolutePath),
    source: {
      type: 'local',
      value: absolutePath,
    },
  };
}

async function readRemoteAsset(assetUrl) {
  const response = await fetch(assetUrl, {
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`Remote asset fetch failed: ${response.status} ${response.statusText} (${assetUrl})`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const urlPath = new URL(assetUrl).pathname;
  const fileName = path.basename(urlPath) || 'imported-image';
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || inferMimeType(fileName);

  return {
    bytes,
    fileName,
    mimeType: contentType,
    source: {
      type: 'remote',
      value: assetUrl,
    },
  };
}

async function resolveAsset(entry, inputPath, kind) {
  const remoteUrl = kind === 'result' ? entry.resultImageUrl : entry.referenceImageUrl;
  const localPath = kind === 'result' ? entry.resultLocalPath : entry.referenceLocalPath;

  if (localPath) {
    const absolutePath = normalizeLocalAssetPath(inputPath, localPath);
    try {
      return await readLocalAsset(absolutePath);
    } catch (error) {
      if (!remoteUrl) {
        throw error;
      }
      console.warn(`[DiscoverCosRepair] Local ${kind} asset missing for ${entry.importKey}, falling back to remote url.`);
    }
  }

  if (remoteUrl) {
    return readRemoteAsset(remoteUrl);
  }

  return null;
}

async function uploadAssetViaEdge(clients, operatorContext, asset) {
  const form = new FormData();
  form.set('projectId', operatorContext.projectId);
  form.set('file', new File([asset.bytes], asset.fileName, { type: asset.mimeType }));

  const response = await fetch(`${clients.supabaseUrl}/functions/v1/upload-asset`, {
    method: 'POST',
    headers: {
      apikey: clients.supabaseAnonKey,
      Authorization: `Bearer ${operatorContext.accessToken}`,
    },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  const rawText = await response.text();
  let data;

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { rawText };
  }

  if (!response.ok) {
    throw new Error(`upload-asset failed: ${response.status} ${response.statusText} ${JSON.stringify(data).slice(0, 400)}`);
  }

  return {
    assetId: data.assetId ?? null,
    storagePath: data.storagePath,
    mimeType: data.mimeType ?? asset.mimeType,
    signedUrl: data.url ?? '',
    staticUrl: buildStaticCosUrl(data.url, data.storagePath),
  };
}

function cloneMetadata(metadata) {
  return metadata ? structuredClone(metadata) : metadata;
}

function rewriteReferenceMetadata(metadata, referenceUrl) {
  if (!metadata || !referenceUrl) return metadata;
  const next = cloneMetadata(metadata);

  if (typeof next.imageUrl === 'string') {
    next.imageUrl = referenceUrl;
  }

  if (Array.isArray(next.images)) {
    next.images = next.images.map((item) => {
      if (typeof item === 'string') return referenceUrl;
      if (item && typeof item === 'object' && typeof item.url === 'string') {
        return { ...item, url: referenceUrl };
      }
      return item;
    });
  }

  return next;
}

function rewriteResultMetadata(metadata, resultUrl) {
  if (!metadata) return metadata;
  const next = cloneMetadata(metadata);

  if (typeof next.imageUrl === 'string') {
    next.imageUrl = resultUrl;
  }

  if (Array.isArray(next.images)) {
    next.images = next.images.map((item) => {
      if (typeof item === 'string') return resultUrl;
      if (item && typeof item === 'object' && typeof item.url === 'string') {
        return { ...item, url: resultUrl };
      }
      return item;
    });
  }

  const op = next.op;
  if (op && typeof op === 'object') {
    const payload = op.payload;
    if (payload && typeof payload === 'object' && typeof payload.src === 'string') {
      next.op = {
        ...op,
        payload: {
          ...payload,
          src: resultUrl,
        },
      };
    }
  }

  return next;
}

function rewriteSnapshotMessages(messages, urls) {
  let changed = false;

  const nextMessages = messages.map((message) => {
    if (message.role === 'user' && message.metadata?.kind === 'reference-image' && urls.referenceUrl) {
      changed = true;
      return {
        ...message,
        metadata: rewriteReferenceMetadata(message.metadata, urls.referenceUrl),
      };
    }

    if (message.role === 'assistant' && message.metadata) {
      changed = true;
      return {
        ...message,
        metadata: rewriteResultMetadata(message.metadata, urls.resultUrl),
      };
    }

    return message;
  });

  return { changed, value: nextMessages };
}

function rewriteSnapshotOps(ops, resultUrl) {
  let changed = false;

  const nextOps = ops.map((op) => {
    if (op.op_type === 'addImage' && op.payload && typeof op.payload === 'object' && typeof op.payload.src === 'string') {
      changed = true;
      return {
        ...op,
        payload: {
          ...op.payload,
          src: resultUrl,
        },
      };
    }

    return op;
  });

  return { changed, value: nextOps };
}

function rewriteMessageRow(message, urls) {
  if (!message.metadata) return { changed: false, value: message };

  if (message.role === 'user' && message.metadata.kind === 'reference-image' && urls.referenceUrl) {
    return {
      changed: true,
      value: {
        ...message,
        metadata: rewriteReferenceMetadata(message.metadata, urls.referenceUrl),
      },
    };
  }

  if (message.role === 'assistant') {
    return {
      changed: true,
      value: {
        ...message,
        metadata: rewriteResultMetadata(message.metadata, urls.resultUrl),
      },
    };
  }

  return { changed: false, value: message };
}

function rewriteOpRow(op, resultUrl) {
  if (op.op_type !== 'addImage' || !op.payload || typeof op.payload !== 'object' || typeof op.payload.src !== 'string') {
    return { changed: false, value: op };
  }

  return {
    changed: true,
    value: {
      ...op,
      payload: {
        ...op.payload,
        src: resultUrl,
      },
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const clients = await createClients();
  const entries = await readInputEntries(options.input, options);
  const manifest = await loadManifest(options.manifest);
  const operatorContext = options.dryRun ? null : await ensureOperatorContext(clients, options);

  const publicationsByImportKey = await fetchPublicationsByImportKey(clients.admin, options.siteKey);
  const publications = [...publicationsByImportKey.values()];
  const snapshotsByPublicationId = await fetchSnapshotsByPublicationId(clients.admin, publications.map((item) => item.id));
  const messagesByConversationId = await fetchMessagesByConversationId(clients.admin, publications.map((item) => item.conversation_id));
  const opsByDocumentId = await fetchOpsByDocumentId(clients.admin, publications.map((item) => item.document_id));

  const summary = {
    siteKey: options.siteKey,
    input: path.resolve(process.cwd(), options.input),
    manifest: path.resolve(process.cwd(), options.manifest),
    entriesRequested: entries.length,
    publicationMatches: publicationsByImportKey.size,
    repaired: 0,
    skipped: 0,
    missingPublications: [],
    warnings: [],
  };

  console.log(JSON.stringify({
    stage: 'prepare',
    siteKey: summary.siteKey,
    entriesRequested: summary.entriesRequested,
    publicationMatches: summary.publicationMatches,
    dryRun: options.dryRun,
    manifest: summary.manifest,
    operatorProjectId: operatorContext?.projectId ?? null,
  }, null, 2));

  for (const [index, entry] of entries.entries()) {
    const publication = publicationsByImportKey.get(entry.importKey);

    if (!publication) {
      summary.missingPublications.push(entry.importKey);
      console.warn(`[DiscoverCosRepair] Missing publication for ${entry.importKey}`);
      continue;
    }

    const snapshot = snapshotsByPublicationId.get(publication.id);
    if (!snapshot) {
      summary.warnings.push(`Missing snapshot for ${entry.importKey}`);
      console.warn(`[DiscoverCosRepair] Missing snapshot for ${entry.importKey}`);
      continue;
    }

    const manifestEntry = manifest.uploads?.[entry.importKey] ?? {};
    const uploadInfo = {};

    for (const kind of ['result', 'reference']) {
      if (kind === 'reference' && !entry.referenceImageUrl && !entry.referenceLocalPath) {
        continue;
      }

      if (manifestEntry[kind]?.staticUrl) {
        uploadInfo[kind] = manifestEntry[kind];
        continue;
      }

      const asset = await resolveAsset(entry, options.input, kind);

      if (!asset) {
        if (kind === 'result') {
          throw new Error(`Missing result asset source for ${entry.importKey}`);
        }
        continue;
      }

      if (options.dryRun) {
        uploadInfo[kind] = {
          assetId: null,
          storagePath: null,
          signedUrl: '',
          staticUrl: `dry-run://${kind}/${path.basename(asset.source.value)}`,
          source: asset.source,
        };
      } else {
        console.log(`[DiscoverCosRepair] [${index + 1}/${entries.length}] Uploading ${kind} for ${entry.importKey} from ${asset.source.type}:${asset.source.value}`);
        const uploaded = await uploadAssetViaEdge(clients, operatorContext, asset);
        uploadInfo[kind] = {
          ...uploaded,
          source: asset.source,
        };
      }

      manifest.uploads[entry.importKey] = {
        ...(manifest.uploads[entry.importKey] ?? {}),
        [kind]: uploadInfo[kind],
      };

      if (!options.dryRun) {
        await writeManifest(options.manifest, manifest);
      }
    }

    const urls = {
      resultUrl: uploadInfo.result?.staticUrl,
      referenceUrl: uploadInfo.reference?.staticUrl ?? null,
    };

    if (!urls.resultUrl) {
      throw new Error(`Missing uploaded result url for ${entry.importKey}`);
    }

    const snapshotMessagesRewrite = rewriteSnapshotMessages(snapshot.messages_snapshot ?? [], urls);
    const snapshotOpsRewrite = rewriteSnapshotOps(snapshot.ops_snapshot ?? [], urls.resultUrl);

    if (!options.dryRun) {
      const { error: publicationError } = await clients.admin
        .from('publications')
        .update({
          cover_image_url: urls.resultUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', publication.id);

      if (publicationError) {
        throw publicationError;
      }

      if (snapshotMessagesRewrite.changed || snapshotOpsRewrite.changed) {
        const { error: snapshotError } = await clients.admin
          .from('publication_snapshots')
          .update({
            messages_snapshot: snapshotMessagesRewrite.value,
            ops_snapshot: snapshotOpsRewrite.value,
          })
          .eq('publication_id', publication.id);

        if (snapshotError) {
          throw snapshotError;
        }
      }

      for (const message of messagesByConversationId.get(publication.conversation_id) ?? []) {
        const rewritten = rewriteMessageRow(message, urls);

        if (!rewritten.changed) {
          continue;
        }

        const { error: messageError } = await clients.admin
          .from('messages')
          .update({
            metadata: rewritten.value.metadata,
          })
          .eq('id', message.id);

        if (messageError) {
          throw messageError;
        }
      }

      for (const op of opsByDocumentId.get(publication.document_id) ?? []) {
        const rewritten = rewriteOpRow(op, urls.resultUrl);

        if (!rewritten.changed) {
          continue;
        }

        const { error: opError } = await clients.admin
          .from('ops')
          .update({
            payload: rewritten.value.payload,
          })
          .eq('id', op.id);

        if (opError) {
          throw opError;
        }
      }
    }

    manifest.uploads[entry.importKey] = {
      ...(manifest.uploads[entry.importKey] ?? {}),
      publicationId: publication.id,
      updatedAt: new Date().toISOString(),
    };

    if (!options.dryRun) {
      await writeManifest(options.manifest, manifest);
    }

    summary.repaired += 1;
    console.log(`[DiscoverCosRepair] [${index + 1}/${entries.length}] Repaired ${entry.importKey} -> ${urls.resultUrl}`);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('[DiscoverCosRepair] Failed:', error);
  process.exitCode = 1;
});
