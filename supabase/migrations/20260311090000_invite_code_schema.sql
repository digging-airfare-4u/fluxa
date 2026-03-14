-- Invite code membership reward: schema + RLS

BEGIN;

CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'used', 'disabled', 'expired')) DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_status_expires_at
  ON invite_codes(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_invite_codes_used_by
  ON invite_codes(used_by)
  WHERE used_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS invite_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID NOT NULL REFERENCES invite_codes(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  benefit_type TEXT NOT NULL DEFAULT 'pro_30_days',
  granted_membership_level TEXT NOT NULL DEFAULT 'pro',
  granted_days INTEGER NOT NULL DEFAULT 30,
  previous_membership_expires_at TIMESTAMPTZ,
  new_membership_expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, benefit_type)
);

CREATE INDEX IF NOT EXISTS idx_invite_code_redemptions_user_created_at
  ON invite_code_redemptions(user_id, created_at DESC);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_code_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct reads for invite_codes" ON invite_codes;
CREATE POLICY "No direct reads for invite_codes"
  ON invite_codes FOR SELECT
  USING (false);

DROP POLICY IF EXISTS "No direct reads for invite_code_redemptions" ON invite_code_redemptions;
CREATE POLICY "No direct reads for invite_code_redemptions"
  ON invite_code_redemptions FOR SELECT
  USING (false);

DROP TRIGGER IF EXISTS update_invite_codes_updated_at ON invite_codes;
CREATE TRIGGER update_invite_codes_updated_at
  BEFORE UPDATE ON invite_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
