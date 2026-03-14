-- Align membership source tracking with UUID-backed references.

BEGIN;

CREATE OR REPLACE FUNCTION public.parse_membership_source_order_id(input_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uuid UUID;
BEGIN
  IF input_value IS NULL OR btrim(input_value) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_uuid := input_value::uuid;
    RETURN v_uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_uuid := NULL;
  END;

  IF input_value LIKE 'invite_redemption:%' THEN
    BEGIN
      v_uuid := split_part(input_value, ':', 2)::uuid;
      RETURN v_uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_uuid := NULL;
    END;
  END IF;

  SELECT id INTO v_uuid
  FROM payment_orders
  WHERE order_no = input_value
  LIMIT 1;

  RETURN v_uuid;
END;
$$;

DO $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT atttypid::regtype::text INTO v_type
  FROM pg_attribute
  WHERE attrelid = 'public.user_profiles'::regclass
    AND attname = 'membership_source_order_id'
    AND attnum > 0
    AND NOT attisdropped;

  IF v_type = 'text' THEN
    EXECUTE 'ALTER TABLE user_profiles ALTER COLUMN membership_source_order_id TYPE UUID USING public.parse_membership_source_order_id(membership_source_order_id)';
  ELSIF v_type <> 'uuid' THEN
    RAISE EXCEPTION 'Unexpected user_profiles.membership_source_order_id type: %', v_type;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.parse_membership_source_order_id(TEXT);

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
      membership_source_order_id = v_redemption_id,
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_orders'
      AND column_name = 'provider'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_orders'
      AND column_name = 'metadata'
  ) THEN
    EXECUTE $payment$
CREATE OR REPLACE FUNCTION payment_fulfill_order(
  p_order_no TEXT,
  p_provider TEXT,
  p_provider_transaction_id TEXT,
  p_paid_amount_fen BIGINT,
  p_paid_at TIMESTAMPTZ DEFAULT NOW(),
  p_provider_event_id TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order payment_orders%ROWTYPE;
  v_product payment_products%ROWTYPE;
  v_current_expire TIMESTAMPTZ;
  v_new_expire TIMESTAMPTZ;
  v_points_after INTEGER;
  v_event_inserted BOOLEAN := true;
BEGIN
  IF p_provider NOT IN ('alipay', 'wechat', 'unionpay') THEN
    RAISE EXCEPTION 'Invalid provider';
  END IF;

  IF p_provider_event_id IS NOT NULL THEN
    INSERT INTO payment_webhook_events(
      provider, provider_event_id, order_no, payload, verified, processed
    ) VALUES (
      p_provider, p_provider_event_id, p_order_no, COALESCE(p_payload, '{}'::jsonb), true, false
    )
    ON CONFLICT (provider, provider_event_id) DO NOTHING;

    GET DIAGNOSTICS v_event_inserted = ROW_COUNT;
    IF NOT v_event_inserted THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'reason', 'duplicate_event');
    END IF;
  END IF;

  SELECT * INTO v_order
  FROM payment_orders
  WHERE order_no = p_order_no
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.provider <> p_provider THEN
    RAISE EXCEPTION 'Provider mismatch';
  END IF;

  IF v_order.amount_fen <> p_paid_amount_fen THEN
    RAISE EXCEPTION 'Amount mismatch';
  END IF;

  IF v_order.status = 'paid' THEN
    UPDATE payment_webhook_events
      SET processed = true,
          processed_at = NOW()
      WHERE provider = p_provider
        AND provider_event_id = p_provider_event_id;

    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'reason', 'already_paid');
  END IF;

  SELECT * INTO v_product
  FROM payment_products
  WHERE id = v_order.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  UPDATE payment_orders
    SET status = 'paid',
        paid_at = p_paid_at,
        provider_transaction_id = COALESCE(p_provider_transaction_id, provider_transaction_id),
        metadata = metadata || jsonb_build_object('fulfilled_at', NOW())
    WHERE id = v_order.id;

  IF v_product.kind = 'membership' THEN
    SELECT membership_expires_at INTO v_current_expire
    FROM user_profiles
    WHERE id = v_order.user_id
    FOR UPDATE;

    v_new_expire := GREATEST(COALESCE(v_current_expire, NOW()), NOW()) + (COALESCE(v_product.duration_days, 0) || ' days')::interval;

    UPDATE user_profiles
      SET membership_level = COALESCE(v_product.target_level, membership_level),
          membership_expires_at = v_new_expire,
          membership_source_order_id = v_order.id,
          membership_updated_at = NOW(),
          updated_at = NOW()
      WHERE id = v_order.user_id;

    IF COALESCE(v_product.points_grant, 0) > 0 THEN
      UPDATE user_profiles
        SET points = points + v_product.points_grant,
            updated_at = NOW()
        WHERE id = v_order.user_id
        RETURNING points INTO v_points_after;

      INSERT INTO point_transactions(
        user_id,
        type,
        amount,
        source,
        reference_id,
        model_name,
        balance_after,
        payment_order_no,
        payment_provider,
        payment_transaction_id,
        metadata
      ) VALUES (
        v_order.user_id,
        'earn',
        v_product.points_grant,
        'payment_membership_grant',
        v_order.id,
        NULL,
        v_points_after,
        v_order.order_no,
        v_order.provider,
        COALESCE(p_provider_transaction_id, ''),
        jsonb_build_object('product_code', v_product.code, 'kind', v_product.kind)
      );
    END IF;
  ELSIF v_product.kind = 'points' THEN
    UPDATE user_profiles
      SET points = points + v_product.points_grant,
          membership_source_order_id = v_order.id,
          membership_updated_at = NOW(),
          updated_at = NOW()
      WHERE id = v_order.user_id
      RETURNING points INTO v_points_after;

    INSERT INTO point_transactions(
      user_id,
      type,
      amount,
      source,
      reference_id,
      model_name,
      balance_after,
      payment_order_no,
      payment_provider,
      payment_transaction_id,
      metadata
    ) VALUES (
      v_order.user_id,
      'earn',
      v_product.points_grant,
      'payment_points_grant',
      v_order.id,
      NULL,
      v_points_after,
      v_order.order_no,
      v_order.provider,
      COALESCE(p_provider_transaction_id, ''),
      jsonb_build_object('product_code', v_product.code, 'kind', v_product.kind)
    );
  END IF;

  UPDATE payment_webhook_events
    SET processed = true,
        processed_at = NOW()
    WHERE provider = p_provider
      AND provider_event_id = p_provider_event_id;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'order_no', v_order.order_no, 'status', 'paid');
END;
$$;
$payment$;
  END IF;
END;
$$;

COMMIT;
