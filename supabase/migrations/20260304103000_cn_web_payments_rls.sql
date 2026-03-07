-- CN Web Payments: RLS

BEGIN;

ALTER TABLE payment_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read enabled self-serve products" ON payment_products;
CREATE POLICY "Public can read enabled self-serve products"
  ON payment_products FOR SELECT
  USING (is_enabled = true AND is_self_serve = true);

DROP POLICY IF EXISTS "Users can read own payment orders" ON payment_orders;
CREATE POLICY "Users can read own payment orders"
  ON payment_orders FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own payment orders" ON payment_orders;
CREATE POLICY "Users can create own payment orders"
  ON payment_orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read attempts for own orders" ON payment_attempts;
CREATE POLICY "Users can read attempts for own orders"
  ON payment_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_orders o
      WHERE o.id = payment_attempts.order_id
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can read refunds for own orders" ON payment_refunds;
CREATE POLICY "Users can read refunds for own orders"
  ON payment_refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_orders o
      WHERE o.id = payment_refunds.order_id
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "No direct reads for webhook events" ON payment_webhook_events;
CREATE POLICY "No direct reads for webhook events"
  ON payment_webhook_events FOR SELECT
  USING (false);

COMMIT;
