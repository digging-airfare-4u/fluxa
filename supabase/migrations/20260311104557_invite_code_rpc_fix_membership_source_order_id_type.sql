-- Record the production hotfix that temporarily stopped writing membership_source_order_id
-- while the column type remained UUID-backed.

BEGIN;

CREATE OR REPLACE FUNCTION redeem_invite_code(input_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_normalized_code TEXT;
  v_code_hash TEXT;
  v_invite invite_codes%ROWTYPE;
  v_current_expire TIMESTAMPTZ;
  v_new_expire TIMESTAMPTZ;
  v_redemption_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  END IF;

  v_normalized_code := upper(trim(COALESCE(input_code, '')));
  IF v_normalized_code = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM invite_code_redemptions r
    WHERE r.user_id = v_user_id
      AND r.benefit_type = 'pro_30_days'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REDEEMED');
  END IF;

  v_code_hash := encode(extensions.digest(v_normalized_code, 'sha256'), 'hex');

  SELECT * INTO v_invite
  FROM invite_codes
  WHERE code_hash = v_code_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE');
  END IF;

  IF v_invite.status = 'used' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CODE_USED');
  END IF;

  IF v_invite.status = 'disabled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE');
  END IF;

  IF v_invite.status = 'expired' OR (v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= NOW()) THEN
    UPDATE invite_codes
    SET status = 'expired',
        updated_at = NOW()
    WHERE id = v_invite.id
      AND status <> 'used';

    RETURN jsonb_build_object('ok', false, 'code', 'CODE_EXPIRED');
  END IF;

  SELECT membership_expires_at INTO v_current_expire
  FROM user_profiles
  WHERE id = v_user_id
  FOR UPDATE;

  v_new_expire := GREATEST(COALESCE(v_current_expire, NOW()), NOW()) + INTERVAL '30 days';

  INSERT INTO invite_code_redemptions (
    invite_code_id,
    user_id,
    benefit_type,
    granted_membership_level,
    granted_days,
    previous_membership_expires_at,
    new_membership_expires_at
  ) VALUES (
    v_invite.id,
    v_user_id,
    'pro_30_days',
    'pro',
    30,
    v_current_expire,
    v_new_expire
  )
  RETURNING id INTO v_redemption_id;

  UPDATE user_profiles
  SET membership_level = 'pro',
      membership_expires_at = v_new_expire,
      membership_updated_at = NOW(),
      updated_at = NOW()
  WHERE id = v_user_id;

  UPDATE invite_codes
  SET status = 'used',
      used_by = v_user_id,
      used_at = NOW(),
      metadata = metadata || jsonb_build_object('redemption_id', v_redemption_id),
      updated_at = NOW()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'code', null,
    'membership_expires_at', v_new_expire
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REDEEMED');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INTERNAL_ERROR');
END;
$$;

REVOKE ALL ON FUNCTION redeem_invite_code(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_invite_code(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION redeem_invite_code(TEXT) TO authenticated;

COMMIT;
