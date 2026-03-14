-- Invite code staging validation SQL
-- Replace <user-id> before running snapshot and audit queries.

-- 1. Generate reference hashes for the test codes.
SELECT
  'BETA-MAR-001' AS active_code,
  encode(extensions.digest('BETA-MAR-001', 'sha256'), 'hex') AS active_code_hash,
  'BETA-MAR-002' AS second_active_code,
  encode(extensions.digest('BETA-MAR-002', 'sha256'), 'hex') AS second_active_code_hash,
  'BETA-MAR-EXPIRED' AS expired_code,
  encode(extensions.digest('BETA-MAR-EXPIRED', 'sha256'), 'hex') AS expired_code_hash;

-- 2. Import active, second-active, and expired validation codes.
INSERT INTO invite_codes (
  code_hash,
  status,
  expires_at,
  metadata
) VALUES
(
  encode(extensions.digest('BETA-MAR-001', 'sha256'), 'hex'),
  'active',
  NOW() + INTERVAL '14 days',
  jsonb_build_object('campaign', 'beta-march-2026', 'note', 'staging validation active')
),
(
  encode(extensions.digest('BETA-MAR-002', 'sha256'), 'hex'),
  'active',
  NOW() + INTERVAL '14 days',
  jsonb_build_object('campaign', 'beta-march-2026', 'note', 'staging validation second active')
),
(
  encode(extensions.digest('BETA-MAR-EXPIRED', 'sha256'), 'hex'),
  'active',
  NOW() - INTERVAL '1 day',
  jsonb_build_object('campaign', 'beta-march-2026', 'note', 'staging validation expired')
);

-- 3. Verify the runtime membership snapshot after a successful redemption.
SELECT
  id,
  membership_level,
  membership_expires_at,
  membership_source_order_id,
  membership_updated_at
FROM user_profiles
WHERE id = '<user-id>';

-- 4. Verify invite code lifecycle states.
SELECT
  id,
  status,
  expires_at,
  used_by,
  used_at,
  metadata,
  created_at,
  updated_at
FROM invite_codes
WHERE metadata ->> 'campaign' = 'beta-march-2026'
ORDER BY created_at ASC;

-- 5. Verify the redemption audit log and UUID membership source linkage.
SELECT
  r.id,
  r.invite_code_id,
  r.user_id,
  r.benefit_type,
  r.granted_membership_level,
  r.granted_days,
  r.previous_membership_expires_at,
  r.new_membership_expires_at,
  r.metadata,
  p.membership_source_order_id,
  r.created_at
FROM invite_code_redemptions r
LEFT JOIN user_profiles p ON p.id = r.user_id
WHERE r.user_id = '<user-id>'
ORDER BY r.created_at DESC;

-- 6. Prepare deferred auto-redeem validation.
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('pending_invite_code', 'BETA-MAR-002')
WHERE id = '<user-id>';

SELECT raw_user_meta_data
FROM auth.users
WHERE id = '<user-id>';

-- 7. Roll back the imported validation pool by disabling it.
UPDATE invite_codes
SET status = 'disabled',
    updated_at = NOW()
WHERE status = 'active'
  AND metadata ->> 'campaign' = 'beta-march-2026';

-- 8. Confirm rollback left no active validation codes.
SELECT
  status,
  COUNT(*) AS count
FROM invite_codes
WHERE metadata ->> 'campaign' = 'beta-march-2026'
GROUP BY status
ORDER BY status;
