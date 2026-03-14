## 1. Database schema and redemption RPC

- [x] 1.1 Add a Supabase migration to create `invite_codes` with lifecycle fields (`active/used/disabled/expired`), hash-based code storage, usage metadata, and supporting indexes.
- [x] 1.2 Add a Supabase migration to create `invite_code_redemptions` with audit fields and a uniqueness constraint to enforce one invite reward redemption per user.
- [x] 1.3 Add RLS policies for invite-related tables so direct client access is restricted and only intended reads/writes are allowed.
- [x] 1.4 Implement `redeem_invite_code(input_code text)` RPC to validate code status/expiry, enforce anti-abuse constraints, grant Pro 30 days with `greatest(current_expiry, now()) + interval '30 days'`, and persist redemption audit in one transaction.
- [x] 1.5 Standardize RPC return semantics to normalized business codes (`INVALID_CODE`, `CODE_USED`, `CODE_EXPIRED`, `ALREADY_REDEEMED`, `NOT_AUTHENTICATED`, `INTERNAL_ERROR`).

## 2. Server API and data access integration

- [x] 2.1 Add a server-side invite redemption API route that authenticates the caller and delegates to the redemption RPC.
- [x] 2.2 Implement response mapping in the API route so clients receive stable success/error payloads and updated membership expiry on success.
- [x] 2.3 Add/update Supabase query helpers for invite redemption and any profile/metadata updates needed by auto-redeem flow.

## 3. Registration and deferred redemption flow

- [x] 3.1 Update `src/app/auth/page.tsx` registration form to include optional invite code input and submit it as pending invite metadata.
- [x] 3.2 Update `src/components/auth/AuthDialog.tsx` registration flow to include the same optional invite code capture and metadata write.
- [x] 3.3 Ensure registration never consumes invite codes directly; only store pending value when present.
- [x] 3.4 Update `src/app/app/layout.tsx` to trigger one automatic redemption attempt after authenticated app entry when pending invite metadata exists.
- [x] 3.5 Clear pending invite metadata after successful auto redemption, and keep app access non-blocking on redemption failure.

## 4. Manual redemption UX in profile

- [x] 4.1 Add an invite redemption section to `src/app/app/profile/page.tsx` with input, submit action, and loading state.
- [x] 4.2 Wire profile redemption submission to the new server API route and display normalized error messages by business code.
- [x] 4.3 Show success feedback including updated membership expiry timestamp.

## 5. Verification and rollout readiness

- [x] 5.1 Add/extend tests for core redemption scenarios: valid first use, used code, expired code, unknown code, and already-redeemed user.
- [x] 5.2 Add/extend tests for registration pending flow and first `/app` auto-redeem behavior (including non-blocking failure path).
- [x] 5.3 Add/extend tests for profile manual redemption success and failure messaging.
- [x] 5.4 Validate migration and rollback procedures in a staging-like environment, including sample invite code import and audit record inspection.
  Operator procedure and execution evidence documented in `docs/invite-code-ops-guide.md` (`Validation Record: 2026-03-12`).
