-- CN Web Payments: schema

BEGIN;

CREATE TABLE IF NOT EXISTS payment_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('membership', 'points')),
  target_level TEXT CHECK (target_level IN ('free', 'pro', 'team')),
  duration_days INTEGER,
  points_grant INTEGER NOT NULL DEFAULT 0,
  amount_fen BIGINT NOT NULL CHECK (amount_fen > 0),
  currency TEXT NOT NULL DEFAULT 'CNY',
  is_self_serve BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  display_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES payment_products(id),
  provider TEXT NOT NULL CHECK (provider IN ('alipay', 'wechat', 'unionpay')),
  status TEXT NOT NULL CHECK (status IN ('created', 'pending', 'paid', 'failed', 'expired', 'refunded', 'canceled')),
  amount_fen BIGINT NOT NULL CHECK (amount_fen > 0),
  currency TEXT NOT NULL DEFAULT 'CNY',
  provider_order_id TEXT,
  provider_transaction_id TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_provider_txn_unique
  ON payment_orders(provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created_at ON payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status_expires_at ON payment_orders(status, expires_at);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('alipay', 'wechat', 'unionpay')),
  attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
  status TEXT NOT NULL CHECK (status IN ('created', 'request_sent', 'provider_accepted', 'failed')),
  provider_request_id TEXT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, attempt_no)
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('alipay', 'wechat', 'unionpay')),
  provider_event_id TEXT NOT NULL,
  order_no TEXT,
  payload JSONB NOT NULL,
  signature TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_order_no ON payment_webhook_events(order_no);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
  refund_no TEXT NOT NULL UNIQUE,
  provider_refund_id TEXT,
  amount_fen BIGINT NOT NULL CHECK (amount_fen > 0),
  status TEXT NOT NULL CHECK (status IN ('requested', 'processing', 'succeeded', 'failed')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS membership_source_order_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS membership_updated_at TIMESTAMPTZ;

ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS payment_order_no TEXT;
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS payment_provider TEXT;
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;

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
      'payment_refund_rollback'
    )
  );

DROP TRIGGER IF EXISTS update_payment_products_updated_at ON payment_products;
CREATE TRIGGER update_payment_products_updated_at
  BEFORE UPDATE ON payment_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_orders_updated_at ON payment_orders;
CREATE TRIGGER update_payment_orders_updated_at
  BEFORE UPDATE ON payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_refunds_updated_at ON payment_refunds;
CREATE TRIGGER update_payment_refunds_updated_at
  BEFORE UPDATE ON payment_refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO payment_products (
  code,
  kind,
  target_level,
  duration_days,
  points_grant,
  amount_fen,
  currency,
  is_self_serve,
  is_enabled,
  display_config
) VALUES
(
  'pro-monthly',
  'membership',
  'pro',
  30,
  500,
  1900,
  'CNY',
  true,
  false,
  '{"title":"Pro Monthly","description":"Pro monthly membership","badge":"recommended"}'::jsonb
),
(
  'pro-yearly',
  'membership',
  'pro',
  365,
  6000,
  15900,
  'CNY',
  true,
  false,
  '{"title":"Pro Yearly","description":"Pro yearly membership"}'::jsonb
)
ON CONFLICT (code) DO UPDATE
SET
  kind = EXCLUDED.kind,
  target_level = EXCLUDED.target_level,
  duration_days = EXCLUDED.duration_days,
  points_grant = EXCLUDED.points_grant,
  amount_fen = EXCLUDED.amount_fen,
  currency = EXCLUDED.currency,
  is_self_serve = EXCLUDED.is_self_serve,
  display_config = EXCLUDED.display_config;

COMMIT;
