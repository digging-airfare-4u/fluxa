-- CN Web Payments: RPCs and idempotent fulfillment

BEGIN;

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
          membership_source_order_id = v_order.order_no,
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
          membership_source_order_id = v_order.order_no,
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

CREATE OR REPLACE FUNCTION payment_mark_order_expired(
  p_order_no TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE payment_orders
    SET status = 'expired',
        updated_at = NOW()
  WHERE order_no = p_order_no
    AND status IN ('created', 'pending')
    AND (expires_at IS NULL OR expires_at <= NOW());

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION payment_fulfill_order(TEXT, TEXT, TEXT, BIGINT, TIMESTAMPTZ, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION payment_mark_order_expired(TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION payment_fulfill_order(TEXT, TEXT, TEXT, BIGINT, TIMESTAMPTZ, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION payment_mark_order_expired(TEXT)
  TO service_role;

COMMIT;
