# Invite Code Operations Guide

## Scope

This guide covers invite code import, staging-like validation, audit inspection, and rollback steps for `add-invite-code-membership-reward`.

## Preconditions

- Apply the invite code migrations before validation.
- Use a test user that already has a `user_profiles` row.
- Use server-side credentials for any direct SQL writes.

## Recommended Execution Order

Run the staging validation in this order:

1. apply the invite code migrations
2. import one active code and one expired code
3. verify unauthenticated API rejection
4. verify first successful redemption
5. verify duplicate redemption with the same code
6. verify second-code redemption with the same user
7. verify expired-code redemption
8. verify unknown-code redemption
9. verify deferred auto-redeem cleanup rules
10. verify rollback by disabling the imported active pool

Record the user id, invite code values, response bodies, and SQL query results for each step.

## Sample Invite Code Import

Generate the hash from the uppercase code value that the RPC will normalize:

```sql
SELECT
  'BETA-MAR-001' AS plain_code,
  encode(extensions.digest('BETA-MAR-001', 'sha256'), 'hex') AS code_hash;
```

Insert a staging invite code:

```sql
INSERT INTO invite_codes (
  code_hash,
  status,
  expires_at,
  metadata
) VALUES (
  encode(extensions.digest('BETA-MAR-001', 'sha256'), 'hex'),
  'active',
  NOW() + INTERVAL '14 days',
  jsonb_build_object('campaign', 'beta-march-2026', 'note', 'staging validation')
);
```

Insert an expired code for negative-path validation:

```sql
INSERT INTO invite_codes (
  code_hash,
  status,
  expires_at,
  metadata
) VALUES (
  encode(extensions.digest('BETA-MAR-EXPIRED', 'sha256'), 'hex'),
  'active',
  NOW() - INTERVAL '1 day',
  jsonb_build_object('campaign', 'beta-march-2026', 'note', 'expired validation')
);
```

## Environment Template

Use these shell variables before running the checklist:

```bash
export STAGING_BASE_URL="https://<staging-domain>"
export ACCESS_TOKEN="<user-access-token>"
export TEST_USER_ID="<user-id>"
```

You can use the reusable helper assets directly:

- shell checks: `scripts/invite-code/validate-api.sh`
- SQL checks: `scripts/invite-code/staging-validation.sql`

## API Command Sequence

### 0. Unauthenticated request

```bash
curl -sS \
  -X POST "$STAGING_BASE_URL/api/invite/redeem" \
  -H 'Content-Type: application/json' \
  -d '{"invite_code":"BETA-MAR-001"}'
```

Expected result:

- HTTP `401`
- error code `NOT_AUTHENTICATED`

## Staging Validation Checklist

### 1. Manual API redemption

Call `POST /api/invite/redeem` with an authenticated bearer token:

```bash
curl -sS \
  -X POST "$STAGING_BASE_URL/api/invite/redeem" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"invite_code":"BETA-MAR-001"}'
```

Expected result:

- HTTP `200`
- `success: true`
- `membership_expires_at` is present

Save the returned `membership_expires_at` value for later comparison.

### 2. Runtime membership snapshot

Verify the user snapshot was updated through `user_profiles`:

```sql
SELECT
  id,
  membership_level,
  membership_expires_at,
  membership_source_order_id,
  membership_updated_at
FROM user_profiles
WHERE id = '<user-id>';
```

Expected result:

- `membership_level = 'pro'`
- `membership_expires_at > now()`
- `membership_source_order_id` equals the `invite_code_redemptions.id` UUID for the successful grant

If you prefer a fully substituted command, replace `<user-id>` with `$TEST_USER_ID`.

### 3. Invite code lifecycle

Verify the code was consumed exactly once:

```sql
SELECT
  id,
  status,
  used_by,
  used_at,
  metadata
FROM invite_codes
WHERE code_hash = encode(extensions.digest('BETA-MAR-001', 'sha256'), 'hex');
```

Expected result:

- `status = 'used'`
- `used_by = <user-id>`
- `used_at IS NOT NULL`
- `metadata ->> 'redemption_id'` is present and matches `user_profiles.membership_source_order_id`

### 4. Audit record inspection

Verify the redemption audit row:

```sql
SELECT
  id,
  invite_code_id,
  user_id,
  benefit_type,
  granted_membership_level,
  granted_days,
  previous_membership_expires_at,
  new_membership_expires_at,
  created_at
FROM invite_code_redemptions
WHERE user_id = '<user-id>'
ORDER BY created_at DESC;
```

Expected result:

- exactly one row for `benefit_type = 'pro_30_days'`
- `granted_membership_level = 'pro'`
- `granted_days = 30`

### 5. Negative-path validation

Run the following checks with separate codes or users:

- redeem the same code twice -> expect `CODE_USED`
- redeem a second valid code with the same user -> expect `ALREADY_REDEEMED`
- redeem an expired code -> expect `CODE_EXPIRED`
- redeem an unknown code -> expect `INVALID_CODE`

For each failure, verify `user_profiles.membership_expires_at` is unchanged.

Example commands:

```bash
curl -sS \
  -X POST "$STAGING_BASE_URL/api/invite/redeem" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"invite_code":"BETA-MAR-001"}'
```

```bash
curl -sS \
  -X POST "$STAGING_BASE_URL/api/invite/redeem" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"invite_code":"BETA-MAR-EXPIRED"}'
```

```bash
curl -sS \
  -X POST "$STAGING_BASE_URL/api/invite/redeem" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"invite_code":"BETA-MAR-UNKNOWN"}'
```

To verify `ALREADY_REDEEMED`, import a second valid code and redeem it with the same user:

```sql
INSERT INTO invite_codes (
  code_hash,
  status,
  expires_at,
  metadata
) VALUES (
  encode(extensions.digest('BETA-MAR-002', 'sha256'), 'hex'),
  'active',
  NOW() + INTERVAL '14 days',
  jsonb_build_object('campaign', 'beta-march-2026', 'note', 'already redeemed validation')
);
```

```bash
curl -sS \
  -X POST "$STAGING_BASE_URL/api/invite/redeem" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"invite_code":"BETA-MAR-002"}'
```

### 6. Deferred auto-redeem validation

Set `pending_invite_code` in the user's auth metadata, then enter `/app`.

Metadata setup example:

```sql
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('pending_invite_code', 'BETA-MAR-002')
WHERE id = '<user-id>';
```

Expected result:

- valid code: auto redeem succeeds and clears `pending_invite_code`
- `INVALID_CODE` / `CODE_USED` / `CODE_EXPIRED` / `ALREADY_REDEEMED`: metadata is cleared to stop repeated retries
- `INTERNAL_ERROR` / `NOT_AUTHENTICATED`: metadata is preserved for retry after the transient issue is fixed

Cleanup check:

```sql
SELECT raw_user_meta_data
FROM auth.users
WHERE id = '<user-id>';
```

## Rollback

### Application rollback

- revert or disable the `/api/invite/redeem` route
- revert or disable the `/app` auto-redeem call
- revert or disable the profile redemption entry

### Data rollback

Do not delete redemption history. Disable the active invite pool instead:

```sql
UPDATE invite_codes
SET status = 'disabled',
    updated_at = NOW()
WHERE status = 'active'
  AND metadata ->> 'campaign' = 'beta-march-2026';
```

Verify rollback:

```sql
SELECT status, COUNT(*)
FROM invite_codes
WHERE metadata ->> 'campaign' = 'beta-march-2026'
GROUP BY status
ORDER BY status;
```

Expected result:

- no active rows remain for the imported campaign

## Sign-off Template

Before marking OpenSpec task `5.4` complete, capture:

- migration version applied
- imported code list
- authenticated success response
- each negative-path response
- `user_profiles` snapshot query result
- `invite_codes` lifecycle query result
- `invite_code_redemptions` audit query result
- rollback verification query result

## Validation Record: 2026-03-12

Staging-like validation was executed against the connected Supabase project plus the local app route (`http://localhost:3100/api/invite/redeem`).

- applied migration versions:
  - `20260312091026 invite_membership_source_uuid_tracking_live`
  - `20260312135243 drop_membership_source_payment_orders_fk_for_invites`
- explicit FK verification:
  - `user_profiles_membership_source_order_id_fkey` query returned no rows after remediation
- imported code batch:
  - campaign: `beta-march-2026-http-fix-20260312142548`
  - active: `HTTP-FIX-20260312142548-A1`
  - second active: `HTTP-FIX-20260312142548-A2`
  - expired: `HTTP-FIX-20260312142548-EXP`
  - unknown probe: `HTTP-FIX-20260312142548-UNKNOWN`
- authenticated success response:
  - `200 { success: true, code: null, membership_expires_at: "2026-04-11T14:27:39.347966+00:00" }`
- negative-path responses:
  - unauthenticated -> `401 NOT_AUTHENTICATED`
  - same user, second valid code -> `200 ALREADY_REDEEMED`
  - second user, consumed code -> `200 CODE_USED`
  - expired code -> `200 CODE_EXPIRED`
  - unknown code -> `200 INVALID_CODE`
- `user_profiles` snapshot result:
  - success user `invitehttp+a96d7fcd6c@qq.com` moved to `pro`
  - `membership_source_order_id = 74864bc5-83ae-42cf-bc9a-fe993f743663`
  - second user `invitehttp+c85b68cb14@qq.com` remained `free`
- `invite_codes` lifecycle result:
  - `A1` -> `used` with `metadata.redemption_id = 74864bc5-83ae-42cf-bc9a-fe993f743663`
  - `A2` -> `disabled` during rollback
  - `EXP` -> `expired`
- `invite_code_redemptions` audit result:
  - redemption row `74864bc5-83ae-42cf-bc9a-fe993f743663`
  - `membership_source_order_id` matched the same UUID in `user_profiles`
- rollback verification result:
  - final status counts = `disabled: 1`, `expired: 1`, `used: 1`
- fresh automated verification for deferred cleanup policy:
  - `pnpm vitest run tests/invite-code/invite-auto-redeem.test.ts tests/invite-code/invite-redeem-route.behavior.test.ts`
  - result: `4 passed`

## Operator Notes

- This workspace now contains the validation procedure, sample import SQL, audit queries, and the 2026-03-12 validation record.
