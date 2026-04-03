-- Referral code system: RPCs

BEGIN;

-- ============================================================================
-- Function: get_or_create_referral_code
-- Returns the caller's referral code, creating one if it doesn't exist.
-- Code format: 8-char uppercase alphanumeric (e.g. "A3F8B2C1")
-- ============================================================================
CREATE OR REPLACE FUNCTION get_or_create_referral_code()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_code TEXT;
  v_record referral_codes%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  END IF;

  -- Try to find existing code
  SELECT * INTO v_record
  FROM referral_codes
  WHERE user_id = v_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'referral_code', v_record.code);
  END IF;

  -- Generate a unique 8-char code
  LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    BEGIN
      INSERT INTO referral_codes (user_id, code)
      VALUES (v_user_id, v_code);
      EXIT; -- success
    EXCEPTION WHEN unique_violation THEN
      -- Could be code collision or concurrent insert for the same user.
      SELECT * INTO v_record
      FROM referral_codes
      WHERE user_id = v_user_id;

      IF FOUND THEN
        RETURN jsonb_build_object('ok', true, 'referral_code', v_record.code);
      END IF;

      -- code collision, retry
      CONTINUE;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'referral_code', v_code);
END;
$$;

REVOKE ALL ON FUNCTION get_or_create_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_or_create_referral_code() TO authenticated;

-- ============================================================================
-- Function: redeem_referral_code
-- Called by the referee (new user). Grants points to both parties.
-- Reward: referrer +50, referee +30
-- ============================================================================
CREATE OR REPLACE FUNCTION redeem_referral_code(input_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_normalized TEXT;
  v_ref referral_codes%ROWTYPE;
  v_referrer_reward INTEGER := 50;
  v_referee_reward  INTEGER := 30;
  v_referrer_balance INTEGER;
  v_referee_balance  INTEGER;
  v_user_created_at TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  END IF;

  -- Only recently registered users can claim referee signup bonus.
  SELECT created_at INTO v_user_created_at
  FROM auth.users
  WHERE id = v_user_id;

  IF v_user_created_at IS NULL OR v_user_created_at < (NOW() - INTERVAL '7 days') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_ELIGIBLE');
  END IF;

  v_normalized := upper(trim(COALESCE(input_code, '')));
  IF v_normalized = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE');
  END IF;

  -- Cannot refer yourself
  IF EXISTS (
    SELECT 1 FROM referral_codes
    WHERE code = v_normalized AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SELF_REFERRAL');
  END IF;

  -- Check if this user already redeemed a referral code
  IF EXISTS (
    SELECT 1 FROM referral_redemptions
    WHERE referee_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REDEEMED');
  END IF;

  -- Find the referral code
  SELECT * INTO v_ref
  FROM referral_codes
  WHERE code = v_normalized;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE');
  END IF;

  -- Grant points to referee (new user)
  UPDATE user_profiles
  SET points = points + v_referee_reward,
      updated_at = NOW()
  WHERE id = v_user_id
  RETURNING points INTO v_referee_balance;

  INSERT INTO point_transactions (user_id, type, amount, source, balance_after, metadata)
  VALUES (
    v_user_id, 'earn', v_referee_reward, 'referral', v_referee_balance,
    jsonb_build_object('reason', 'Referral signup bonus', 'referrer_id', v_ref.user_id)
  );

  -- Grant points to referrer
  UPDATE user_profiles
  SET points = points + v_referrer_reward,
      updated_at = NOW()
  WHERE id = v_ref.user_id
  RETURNING points INTO v_referrer_balance;

  INSERT INTO point_transactions (user_id, type, amount, source, balance_after, metadata)
  VALUES (
    v_ref.user_id, 'earn', v_referrer_reward, 'referral', v_referrer_balance,
    jsonb_build_object('reason', 'Referral reward', 'referee_id', v_user_id)
  );

  -- Record the redemption
  INSERT INTO referral_redemptions (
    referral_code_id, referrer_id, referee_id,
    referrer_points, referee_points
  ) VALUES (
    v_ref.id, v_ref.user_id, v_user_id,
    v_referrer_reward, v_referee_reward
  );

  RETURN jsonb_build_object(
    'ok', true,
    'referrer_points', v_referrer_reward,
    'referee_points', v_referee_reward
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REDEEMED');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INTERNAL_ERROR');
END;
$$;

REVOKE ALL ON FUNCTION redeem_referral_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION redeem_referral_code(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION redeem_referral_code(TEXT) TO authenticated;

COMMIT;
