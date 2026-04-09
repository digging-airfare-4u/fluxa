/**
 * Import normalized external inspiration entries into the existing publications flow.
 *
 * The input file should be a JSON array. Each item can use the generic schema:
 * - site_key / site_name / entry_type / external_id
 *
 * Or a NanoBananas-like schema:
 * - source / id / title_zh / prompt_zh / result_image_url
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import {
  buildDiscoverImportPlan,
  inferDiscoverCategorySlug,
  normalizeExternalInspirationEntry,
} from './lib/discover-import.mjs';

process.loadEnvFile?.('.env');

const DEFAULT_INPUT = 'docs/source/nanobananas_banana_image_prompt/prompts.json';

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    limit: null,
    dryRun: false,
    userId: process.env.DISCOVER_IMPORT_USER_ID ?? '',
    siteKey: '',
    siteName: '',
    sourceUrl: '',
    preferLocalImages: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--input') {
      options.input = argv[index + 1] ?? options.input;
      index += 1;
      continue;
    }

    if (arg === '--limit') {
      const rawValue = argv[index + 1];
      options.limit = rawValue ? Number.parseInt(rawValue, 10) : null;
      index += 1;
      continue;
    }

    if (arg === '--user-id') {
      options.userId = argv[index + 1] ?? options.userId;
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

    if (arg === '--prefer-local-images') {
      options.preferLocalImages = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/inspiration/import-discover-source.mjs [options]

Options:
  --dry-run              Preview import stats without writing to Supabase
  --limit <n>            Import only the first n items
  --input <path>         Source JSON file path
  --user-id <uuid>       Author user id for imported publications
  --site-key <slug>      Fallback site key when the JSON omits it
  --site-name <name>     Fallback display name when the JSON omits it
  --source-url <url>     Fallback source page url when the JSON omits it
  --prefer-local-images  Upload local files even if remote image URLs also exist
  --help                 Show this message

Env:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  DISCOVER_IMPORT_USER_ID
`);
}

async function readEntries(inputPath) {
  const absolutePath = path.resolve(process.cwd(), inputPath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Input JSON must be an array.');
  }

  return parsed;
}

async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function resolveUserId(supabase, explicitUserId) {
  if (explicitUserId) {
    return explicitUserId;
  }

  const { data, error } = await supabase
    .from('publications')
    .select('user_id')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.user_id) {
    throw new Error('Cannot resolve import user id. Pass --user-id or DISCOVER_IMPORT_USER_ID.');
  }

  return data.user_id;
}

async function fetchCategoryMap(supabase) {
  const { data, error } = await supabase
    .from('publication_categories')
    .select('id, slug')
    .eq('is_active', true);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((item) => [item.slug, item.id]));
}

async function fetchExistingImportKeys(supabase, siteKeys) {
  const uniqueSiteKeys = [...new Set(siteKeys.filter(Boolean))];
  const query = supabase
    .from('publications')
    .select('tags');

  const filteredQuery = uniqueSiteKeys.length === 1
    ? query.contains('tags', [uniqueSiteKeys[0]])
    : query;
  const { data, error } = await filteredQuery;

  if (error) {
    throw error;
  }

  const importKeys = new Set();

  for (const row of data ?? []) {
    for (const tag of row.tags ?? []) {
      if (typeof tag !== 'string') {
        continue;
      }

      if (uniqueSiteKeys.length > 0 && !uniqueSiteKeys.some((siteKey) => tag.startsWith(`${siteKey}:`))) {
        continue;
      }

      importKeys.add(tag);
    }
  }

  return importKeys;
}

function buildPublishedAt(baseDate, offsetIndex) {
  return new Date(baseDate.getTime() - offsetIndex * 1000).toISOString();
}

function normalizeStorageSegment(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function inferContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      throw new Error(`Unsupported local image type: ${extension || 'unknown'}. Use png, jpg, jpeg, or webp.`);
  }
}

function resolveLocalAssetPath(inputPath, assetPath) {
  if (!assetPath) {
    return '';
  }

  if (path.isAbsolute(assetPath)) {
    return assetPath;
  }

  return path.resolve(path.dirname(path.resolve(process.cwd(), inputPath)), assetPath);
}

function buildImportedAssetPath(entry, kind, assetPath) {
  const extension = path.extname(assetPath).toLowerCase() || '.webp';
  const safeSiteKey = normalizeStorageSegment(entry.siteKey || 'imports');
  const safeImportKey = normalizeStorageSegment(entry.importKey || `${entry.siteKey}-${entry.externalId}`);
  return `covers/imports/${safeSiteKey}/${safeImportKey}-${kind}${extension}`;
}

async function uploadLocalImage(supabase, absolutePath, objectPath) {
  const contentType = inferContentType(absolutePath);
  const bytes = await fs.readFile(absolutePath);
  const file = new File([bytes], path.basename(absolutePath), { type: contentType });
  const storage = supabase.storage.from('public-assets');
  const { error } = await storage.upload(objectPath, file, { upsert: true, contentType });

  if (error) {
    throw error;
  }

  const { data } = storage.getPublicUrl(objectPath);
  return data.publicUrl;
}

async function ensureLocalAssetExists(absolutePath) {
  await fs.access(absolutePath);
}

async function materializeEntryAssets(supabase, entry, inputPath, options) {
  let resultImageUrl = entry.resultImageUrl;
  let referenceImageUrl = entry.referenceImageUrl;

  const shouldUseLocalResult = entry.resultLocalPath && (options.preferLocalImages || !resultImageUrl);
  const shouldUseLocalReference = entry.referenceLocalPath && (options.preferLocalImages || !referenceImageUrl);

  if (shouldUseLocalResult) {
    const absolutePath = resolveLocalAssetPath(inputPath, entry.resultLocalPath);
    const objectPath = buildImportedAssetPath(entry, 'result', absolutePath);
    await ensureLocalAssetExists(absolutePath);
    resultImageUrl = options.dryRun
      ? supabase.storage.from('public-assets').getPublicUrl(objectPath).data.publicUrl
      : await uploadLocalImage(supabase, absolutePath, objectPath);
  }

  if (shouldUseLocalReference) {
    const absolutePath = resolveLocalAssetPath(inputPath, entry.referenceLocalPath);
    const objectPath = buildImportedAssetPath(entry, 'reference', absolutePath);
    await ensureLocalAssetExists(absolutePath);
    referenceImageUrl = options.dryRun
      ? supabase.storage.from('public-assets').getPublicUrl(objectPath).data.publicUrl
      : await uploadLocalImage(supabase, absolutePath, objectPath);
  }

  if (!resultImageUrl) {
    throw new Error(`Missing result image for ${entry.importKey}. Provide result_image_url or result_local_path.`);
  }

  return {
    ...entry,
    resultImageUrl,
    referenceImageUrl,
  };
}

async function insertPlan(supabase, plan) {
  let publicationInserted = false;
  let projectInserted = false;

  try {
    const projectResult = await supabase.from('projects').insert(plan.project);
    if (projectResult.error) throw projectResult.error;
    projectInserted = true;

    const documentResult = await supabase.from('documents').insert(plan.document);
    if (documentResult.error) throw documentResult.error;

    const conversationResult = await supabase.from('conversations').insert(plan.conversation);
    if (conversationResult.error) throw conversationResult.error;

    const messagesResult = await supabase.from('messages').insert(plan.messages);
    if (messagesResult.error) throw messagesResult.error;

    const opsResult = await supabase.from('ops').insert(plan.ops);
    if (opsResult.error) throw opsResult.error;

    const publicationResult = await supabase.from('publications').insert(plan.publication);
    if (publicationResult.error) throw publicationResult.error;
    publicationInserted = true;

    const snapshotResult = await supabase.from('publication_snapshots').insert(plan.snapshot);
    if (snapshotResult.error) throw snapshotResult.error;
  } catch (error) {
    if (publicationInserted) {
      await supabase.from('publications').delete().eq('id', plan.publication.id);
    }

    if (projectInserted) {
      await supabase.from('projects').delete().eq('id', plan.project.id);
    }

    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const rawEntries = await readEntries(options.input);
  const selectedEntries = Number.isInteger(options.limit) && options.limit > 0
    ? rawEntries.slice(0, options.limit)
    : rawEntries;
  const normalizedEntries = selectedEntries.map((entry, index) => {
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

  const supabase = await createAdminClient();
  const userId = await resolveUserId(supabase, options.userId);
  const categoryMap = await fetchCategoryMap(supabase);
  const fallbackCategoryId = categoryMap.get('other');

  if (!fallbackCategoryId) {
    throw new Error('Missing publication category: other');
  }

  const existingImportKeys = await fetchExistingImportKeys(
    supabase,
    normalizedEntries.map((entry) => entry.siteKey),
  );

  const baseDate = new Date();
  const plans = [];
  const skippedExisting = [];

  for (const [index, entry] of normalizedEntries.entries()) {
    if (existingImportKeys.has(entry.importKey)) {
      skippedExisting.push(entry.importKey);
      continue;
    }

    const resolvedEntry = await materializeEntryAssets(supabase, entry, options.input, options);
    const categorySlug = inferDiscoverCategorySlug(resolvedEntry);

    plans.push(buildDiscoverImportPlan(resolvedEntry, {
      userId,
      categoryId: categoryMap.get(categorySlug) ?? fallbackCategoryId,
      publishedAt: resolvedEntry.publishedAt ?? buildPublishedAt(baseDate, index),
    }));
  }

  const summary = {
    input: path.resolve(process.cwd(), options.input),
    requested: selectedEntries.length,
    prepared: plans.length,
    skippedExisting: skippedExisting.length,
    userId,
    sites: [...new Set(normalizedEntries.map((entry) => entry.siteKey))],
    categories: plans.reduce((accumulator, plan) => {
      accumulator[plan.categorySlug] = (accumulator[plan.categorySlug] ?? 0) + 1;
      return accumulator;
    }, {}),
    sample: plans.slice(0, 3).map((plan) => ({
      importKey: plan.importKey,
      title: plan.publication.title,
      categorySlug: plan.categorySlug,
      coverImageUrl: plan.publication.cover_image_url,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (options.dryRun) {
    return;
  }

  for (const plan of plans) {
    await insertPlan(supabase, plan);
    console.log(`[DiscoverImport] Imported ${plan.importKey} -> ${plan.publication.id}`);
  }
}

main().catch((error) => {
  console.error('[DiscoverImport] Import failed:', error);
  process.exitCode = 1;
});
