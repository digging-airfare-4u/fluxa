import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('cn-web-payments rpc security contract', () => {
  it('revokes public and client-role execute privileges for security definer RPCs', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260304104000_cn_web_payments_rpcs.sql'),
      'utf8',
    );

    expect(sql).toContain('REVOKE ALL ON FUNCTION payment_fulfill_order(');
    expect(sql).toContain('FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('REVOKE ALL ON FUNCTION payment_mark_order_expired(');
    expect(sql).toContain('FROM PUBLIC, anon, authenticated');
  });
});
