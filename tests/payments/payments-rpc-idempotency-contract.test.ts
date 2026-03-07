import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('cn-web-payments fulfillment rpc idempotency contract', () => {
  it('contains dedupe and idempotent guards in payment_fulfill_order', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260304104000_cn_web_payments_rpcs.sql'),
      'utf8',
    );

    expect(sql).toContain('CREATE OR REPLACE FUNCTION payment_fulfill_order(');
    expect(sql).toContain('ON CONFLICT (provider, provider_event_id) DO NOTHING');
    expect(sql).toContain("'reason', 'duplicate_event'");
    expect(sql).toContain("IF v_order.status = 'paid' THEN");
    expect(sql).toContain("'reason', 'already_paid'");
    expect(sql).toContain("status = 'paid'");
  });
});
