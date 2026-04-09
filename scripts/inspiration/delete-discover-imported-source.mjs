/**
 * Delete imported discover entries by source tag.
 *
 * Expected usage:
 *   node scripts/inspiration/delete-discover-imported-source.mjs --tag nanobananas --dry-run
 *   node scripts/inspiration/delete-discover-imported-source.mjs --tag nanobananas
 *
 * Strategy:
 * - find publications tagged with the given source tag
 * - delete related projects when available so documents / conversations / messages / ops cascade
 * - delete any orphan publications without project_id directly
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile?.('.env');

function parseArgs(argv) {
  const options = {
    tag: '',
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--tag') {
      options.tag = argv[index + 1] ?? '';
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

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/inspiration/delete-discover-imported-source.mjs --tag <source-tag> [--dry-run]

Options:
  --tag <source-tag>  Publication tag to delete, e.g. nanobananas
  --dry-run           Only print the matched summary
  --help              Show this message

Env:
  NEXT_PUBLIC_SUPABASE_URL
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

async function fetchTaggedPublications(supabase, tag) {
  const { data, error } = await supabase
    .from('publications')
    .select('id, project_id, document_id, conversation_id, title, tags')
    .contains('tags', [tag]);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function deleteProjectsByIds(supabase, projectIds) {
  for (const ids of chunk(projectIds, 100)) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .in('id', ids);

    if (error) {
      throw error;
    }
  }
}

async function deletePublicationsByIds(supabase, publicationIds) {
  for (const ids of chunk(publicationIds, 100)) {
    const { error } = await supabase
      .from('publications')
      .delete()
      .in('id', ids);

    if (error) {
      throw error;
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || !options.tag) {
    printHelp();
    if (!options.tag) {
      process.exitCode = 1;
    }
    return;
  }

  const supabase = await createAdminClient();
  const publications = await fetchTaggedPublications(supabase, options.tag);
  const projectIds = [...new Set(publications.map((row) => row.project_id).filter(Boolean))];
  const orphanPublicationIds = publications
    .filter((row) => !row.project_id)
    .map((row) => row.id);

  const summary = {
    tag: options.tag,
    dryRun: options.dryRun,
    matchedPublications: publications.length,
    distinctProjects: projectIds.length,
    orphanPublications: orphanPublicationIds.length,
    sampleTitles: publications.slice(0, 10).map((row) => row.title),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (options.dryRun) {
    return;
  }

  if (projectIds.length > 0) {
    await deleteProjectsByIds(supabase, projectIds);
  }

  if (orphanPublicationIds.length > 0) {
    await deletePublicationsByIds(supabase, orphanPublicationIds);
  }

  const remaining = await fetchTaggedPublications(supabase, options.tag);
  console.log(JSON.stringify({
    tag: options.tag,
    deletedProjects: projectIds.length,
    deletedOrphanPublications: orphanPublicationIds.length,
    remainingPublications: remaining.length,
  }, null, 2));
}

main().catch((error) => {
  console.error('[DeleteDiscoverImportedSource] Failed:', error);
  process.exitCode = 1;
});
