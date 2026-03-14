import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
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

  it('adds a follow-up migration that stores membership source ids as UUIDs for payments and rollbacks', () => {
    const migrationPath = resolve(
      process.cwd(),
      'supabase/migrations/20260312070000_membership_source_uuid_tracking.sql',
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    expect(sql).toContain('membership_source_order_id = v_order.id');

    const fulfillment = readFileSync(resolve(process.cwd(), 'src/lib/payments/fulfillment.ts'), 'utf8');
    expect(fulfillment).toContain(".eq('membership_source_order_id', order.id)");
  });
});
