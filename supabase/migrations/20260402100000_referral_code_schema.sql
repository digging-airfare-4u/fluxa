-- Referral code system: schema + RLS + point_transactions source update

BEGIN;

-- ============================================================================
-- Table: referral_codes
-- Each user gets one permanent referral code
-- ============================================================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

-- ============================================================================
-- Table: referral_redemptions
-- Tracks who registered via whose referral code
-- ============================================================================
CREATE TABLE IF NOT EXISTS referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE RESTRICT,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_points INTEGER NOT NULL,
  referee_points INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_redemptions_referrer
  ON referral_redemptions(referrer_id, created_at DESC);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_redemptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own referral code
CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT
  USING (user_id = auth.uid());

-- No direct reads on redemptions (accessed via RPC)
CREATE POLICY "No direct reads for referral_redemptions"
  ON referral_redemptions FOR SELECT
  USING (false);

-- ============================================================================
-- Expand point_transactions source CHECK to include 'referral'
-- ============================================================================
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_source_check;
ALTER TABLE point_transactions
  ADD CONSTRAINT point_transactions_source_check
  CHECK (
    source IN (
      'registration',
      'generate_ops',
      'generate_image',
      'export',
      'admin',
      'daily_login',
      'purchase',
      'payment_membership_grant',
      'payment_points_grant',
      'payment_refund_rollback',
      'referral'
    )
  );

COMMIT;
