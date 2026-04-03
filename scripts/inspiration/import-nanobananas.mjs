/**
 * Import NanoBananas prompt templates into the existing publications flow.
 *
 * Fast path:
 * 1. Fake project/document/conversation/messages rows
 * 2. Insert publication + snapshot
 * 3. Reuse current discover/detail UI without frontend changes
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import {
  buildNanobananaImportPlan,
  inferNanobananaCategorySlug,
} from './lib/nanobananas-import.mjs';

process.loadEnvFile?.('.env');

const DEFAULT_INPUT = 'docs/source/nanobananas_banana_image_prompt/prompts.json';

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    limit: null,
    dryRun: false,
    userId: process.env.NANOBANANAS_IMPORT_USER_ID ?? '',
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

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/inspiration/import-nanobananas.mjs [options]

Options:
  --dry-run            Preview import stats without writing to Supabase
  --limit <n>          Import only the first n prompt records
  --input <path>       Source JSON file path
  --user-id <uuid>     Author user id for imported publications
  --help               Show this message

Env:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  NANOBANANAS_IMPORT_USER_ID
`);
}

async function readPromptEntries(inputPath) {
  const absolutePath = path.resolve(process.cwd(), inputPath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(raw);
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
    throw new Error('Cannot resolve import user id. Pass --user-id or NANOBANANAS_IMPORT_USER_ID.');
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

async function fetchExistingImportKeys(supabase) {
  const { data, error } = await supabase
    .from('publications')
    .select('id, tags')
    .contains('tags', ['nanobananas']);

  if (error) {
    throw error;
  }

  const importKeys = new Set();

  for (const row of data ?? []) {
    for (const tag of row.tags ?? []) {
      if (typeof tag === 'string' && tag.startsWith('nanobananas:')) {
        importKeys.add(tag);
      }
    }
  }

  return importKeys;
}

function buildPublishedAt(baseDate, offsetIndex) {
  return new Date(baseDate.getTime() - offsetIndex * 1000).toISOString();
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

  const entries = await readPromptEntries(options.input);
  const selectedEntries = Number.isInteger(options.limit) && options.limit > 0
    ? entries.slice(0, options.limit)
    : entries;

  const supabase = await createAdminClient();
  const userId = await resolveUserId(supabase, options.userId);
  const categoryMap = await fetchCategoryMap(supabase);
  const existingImportKeys = await fetchExistingImportKeys(supabase);
  const fallbackCategoryId = categoryMap.get('other');

  if (!fallbackCategoryId) {
    throw new Error('Missing publication category: other');
  }

  const baseDate = new Date();
  const plans = [];
  const skippedExisting = [];

  for (const [index, entry] of selectedEntries.entries()) {
    const categorySlug = inferNanobananaCategorySlug(entry);
    const importKey = `nanobananas:${entry.source}:${entry.id}`;

    if (existingImportKeys.has(importKey)) {
      skippedExisting.push(importKey);
      continue;
    }

    plans.push(buildNanobananaImportPlan(entry, {
      userId,
      categoryId: categoryMap.get(categorySlug) ?? fallbackCategoryId,
      publishedAt: buildPublishedAt(baseDate, index),
    }));
  }

  const summary = {
    input: path.resolve(process.cwd(), options.input),
    requested: selectedEntries.length,
    prepared: plans.length,
    skippedExisting: skippedExisting.length,
    userId,
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
    console.log(`[NanoBananas] Imported ${plan.importKey} -> ${plan.publication.id}`);
  }
}

main().catch((error) => {
  console.error('[NanoBananas] Import failed:', error);
  process.exitCode = 1;
});
