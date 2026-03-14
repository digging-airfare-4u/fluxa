#!/usr/bin/env bash

set -euo pipefail

required_vars=(
  STAGING_BASE_URL
  ACCESS_TOKEN
  ACTIVE_CODE
  EXPIRED_CODE
  UNKNOWN_CODE
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: $var_name" >&2
    exit 1
  fi
done

post_invite() {
  local label="$1"
  local invite_code="$2"
  local auth_mode="${3:-auth}"
  local tmp_file
  local http_status

  tmp_file="$(mktemp)"

  if [[ "$auth_mode" == "auth" ]]; then
    http_status="$(
      curl -sS \
        -o "$tmp_file" \
        -w "%{http_code}" \
        -X POST "$STAGING_BASE_URL/api/invite/redeem" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -d "{\"invite_code\":\"$invite_code\"}"
    )"
  else
    http_status="$(
      curl -sS \
        -o "$tmp_file" \
        -w "%{http_code}" \
        -X POST "$STAGING_BASE_URL/api/invite/redeem" \
        -H 'Content-Type: application/json' \
        -d "{\"invite_code\":\"$invite_code\"}"
    )"
  fi

  echo "== $label =="
  echo "HTTP $http_status"
  cat "$tmp_file"
  echo
  rm -f "$tmp_file"
}

echo "Running invite code API validation against: $STAGING_BASE_URL"
echo

post_invite "unauthenticated request" "$ACTIVE_CODE" "anon"
post_invite "first successful redemption" "$ACTIVE_CODE"
post_invite "duplicate same code" "$ACTIVE_CODE"
post_invite "expired code" "$EXPIRED_CODE"
post_invite "unknown code" "$UNKNOWN_CODE"

if [[ -n "${SECOND_ACTIVE_CODE:-}" ]]; then
  post_invite "already redeemed with same user" "$SECOND_ACTIVE_CODE"
else
  echo "Skipping ALREADY_REDEEMED check. Set SECOND_ACTIVE_CODE to enable it."
  echo
fi

cat <<'EOF'
Next steps:
1. Run scripts/invite-code/staging-validation.sql in your staging database.
2. Verify user_profiles.membership_source_order_id matches the invite_code_redemptions.id UUID.
3. Verify invite_codes and invite_code_redemptions reflect the API responses above.
4. Run the rollback section after validation and record the final query output.
EOF
