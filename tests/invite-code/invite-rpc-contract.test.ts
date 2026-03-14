import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('invite code migration and rpc contract', () => {
  it('defines invite tables and constraints', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260311090000_invite_code_schema.sql'),
      'utf8',
    );

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS invite_codes');
    expect(sql).toContain("status TEXT NOT NULL CHECK (status IN ('active', 'used', 'disabled', 'expired'))");
    expect(sql).toContain('code_hash TEXT NOT NULL UNIQUE');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS invite_code_redemptions');
    expect(sql).toContain("benefit_type TEXT NOT NULL DEFAULT 'pro_30_days'");
    expect(sql).toContain('UNIQUE(user_id, benefit_type)');
    expect(sql).toContain('ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE invite_code_redemptions ENABLE ROW LEVEL SECURITY');
  });

  it('defines redeem rpc with normalized business codes and membership extension', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260311091000_invite_code_rpc.sql'),
      'utf8',
    );

    expect(sql).toContain('CREATE OR REPLACE FUNCTION redeem_invite_code(input_code TEXT)');
    expect(sql).toContain("'INVALID_CODE'");
    expect(sql).toContain("'CODE_USED'");
    expect(sql).toContain("'CODE_EXPIRED'");
    expect(sql).toContain("'ALREADY_REDEEMED'");
    expect(sql).toContain("'NOT_AUTHENTICATED'");
    expect(sql).toContain("'INTERNAL_ERROR'");
    expect(sql).toContain('GREATEST(COALESCE(v_current_expire, NOW()), NOW()) + INTERVAL \'30 days\'');
    expect(sql).toContain('REVOKE ALL ON FUNCTION redeem_invite_code(TEXT) FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION redeem_invite_code(TEXT) TO service_role');
  });

  it('records the previously applied invite rpc hotfix migration in the repo', () => {
    const migrationPath = resolve(
      process.cwd(),
      'supabase/migrations/20260311104557_invite_code_rpc_fix_membership_source_order_id_type.sql',
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    expect(sql).toContain('CREATE OR REPLACE FUNCTION redeem_invite_code(input_code TEXT)');
    expect(sql).not.toContain('membership_source_order_id =');
  });

  it('adds a follow-up migration that tracks invite membership source ids as UUIDs', () => {
    const migrationPath = resolve(
      process.cwd(),
      'supabase/migrations/20260312070000_membership_source_uuid_tracking.sql',
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    expect(sql).toContain('ALTER TABLE user_profiles');
    expect(sql).toContain('membership_source_order_id');
    expect(sql).toContain('TYPE UUID');
    expect(sql).toContain('membership_source_order_id = v_redemption_id');
  });

  it('records the follow-up migration that drops the payment_orders foreign key for invite membership source tracking', () => {
    const migrationPath = resolve(
      process.cwd(),
      'supabase/migrations/20260312135243_drop_membership_source_payment_orders_fk_for_invites.sql',
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS user_profiles_membership_source_order_id_fkey');
    expect(sql).not.toContain('ADD CONSTRAINT user_profiles_membership_source_order_id_fkey');
  });
});
