import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inspiration-discovery publish RPC contract', () => {
  it('contains publish/update snapshot rpc definitions', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260303113000_inspiration_discovery_rpcs.sql'),
      'utf8'
    );

    expect(sql).toContain('CREATE OR REPLACE FUNCTION publish_conversation(');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION update_publication_snapshot(');
    expect(sql).toContain('INSERT INTO publication_snapshots');
    expect(sql).toContain('ON CONFLICT (publication_id)');
    expect(sql).toContain('RETURN v_publication_id;');
  });
});
