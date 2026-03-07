-- CN Web Payments flags (safe defaults: all OFF)

BEGIN;

INSERT INTO system_settings (key, value, description)
VALUES (
  'payment_enabled',
  '{"enabled": false}'::jsonb,
  'Global payment switch. Keep false by default until sandbox and production are validated.'
)
ON CONFLICT (key) DO UPDATE
SET
  value = CASE
    WHEN (system_settings.value ? 'enabled') THEN system_settings.value
    ELSE '{"enabled": false}'::jsonb
  END,
  description = EXCLUDED.description;

INSERT INTO system_settings (key, value, description)
VALUES (
  'payment_channels',
  '{
    "alipay_page": {"enabled": false, "label": "支付宝", "label_en": "Alipay", "scenes": ["desktop", "mobile_browser"]},
    "wechat_native": {"enabled": false, "label": "微信支付", "label_en": "WeChat Pay", "scenes": ["desktop"]},
    "wechat_jsapi": {"enabled": false, "label": "微信支付(公众号)", "label_en": "WeChat JSAPI", "scenes": ["wechat_browser"]},
    "unionpay": {"enabled": false, "label": "银联支付", "label_en": "UnionPay", "scenes": ["desktop", "mobile_browser"]}
  }'::jsonb,
  'Per-channel payment rollout flags and scene visibility.'
)
ON CONFLICT (key) DO UPDATE
SET
  value = jsonb_strip_nulls(
    jsonb_build_object(
      'alipay_page', jsonb_build_object(
        'enabled', COALESCE((system_settings.value->'alipay_page'->>'enabled')::boolean, (system_settings.value->'alipay'->>'enabled')::boolean, false),
        'label', COALESCE(system_settings.value->'alipay_page'->>'label', '支付宝'),
        'label_en', COALESCE(system_settings.value->'alipay_page'->>'label_en', 'Alipay'),
        'scenes', COALESCE(system_settings.value->'alipay_page'->'scenes', '["desktop", "mobile_browser"]'::jsonb)
      ),
      'wechat_native', jsonb_build_object(
        'enabled', COALESCE((system_settings.value->'wechat_native'->>'enabled')::boolean, (system_settings.value->'wechat'->>'enabled')::boolean, false),
        'label', COALESCE(system_settings.value->'wechat_native'->>'label', '微信支付'),
        'label_en', COALESCE(system_settings.value->'wechat_native'->>'label_en', 'WeChat Pay'),
        'scenes', COALESCE(system_settings.value->'wechat_native'->'scenes', '["desktop"]'::jsonb)
      ),
      'wechat_jsapi', jsonb_build_object(
        'enabled', COALESCE((system_settings.value->'wechat_jsapi'->>'enabled')::boolean, (system_settings.value->'wechat'->>'enabled')::boolean, false),
        'label', COALESCE(system_settings.value->'wechat_jsapi'->>'label', '微信支付(公众号)'),
        'label_en', COALESCE(system_settings.value->'wechat_jsapi'->>'label_en', 'WeChat JSAPI'),
        'scenes', COALESCE(system_settings.value->'wechat_jsapi'->'scenes', '["wechat_browser"]'::jsonb)
      ),
      'unionpay', jsonb_build_object(
        'enabled', COALESCE((system_settings.value->'unionpay'->>'enabled')::boolean, false),
        'label', COALESCE(system_settings.value->'unionpay'->>'label', '银联支付'),
        'label_en', COALESCE(system_settings.value->'unionpay'->>'label_en', 'UnionPay'),
        'scenes', COALESCE(system_settings.value->'unionpay'->'scenes', '["desktop", "mobile_browser"]'::jsonb)
      )
    )
  ),
  description = EXCLUDED.description;

INSERT INTO system_settings (key, value, description)
VALUES (
  'payment_env',
  '{"env":"sandbox"}'::jsonb,
  'Payment runtime environment (sandbox|production).'
)
ON CONFLICT (key) DO UPDATE
SET
  value = CASE
    WHEN (system_settings.value->>'env') IN ('sandbox', 'production') THEN system_settings.value
    ELSE '{"env":"sandbox"}'::jsonb
  END,
  description = EXCLUDED.description;

COMMIT;
