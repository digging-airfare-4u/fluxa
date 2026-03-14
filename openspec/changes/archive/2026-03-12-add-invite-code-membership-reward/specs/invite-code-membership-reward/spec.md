## ADDED Requirements

### Requirement: System SHALL redeem a valid invite code into fixed Pro membership benefits
The system SHALL allow an authenticated user to redeem a valid invite code and grant Pro membership for 30 days, with membership expiry extended from the later of current expiry or current time.

#### Scenario: Redeem a valid unused code
- **WHEN** an authenticated user submits an active, unexpired, unused invite code
- **THEN** the system marks the code as used, records a redemption audit entry, grants Pro membership, and sets `membership_expires_at` to `greatest(current_expiry, now) + 30 days`

#### Scenario: Existing Pro user redeems a valid code
- **WHEN** a user with existing Pro membership and a future expiry redeems a valid code
- **THEN** the system preserves remaining membership time and extends expiry by 30 days from the existing expiry timestamp

### Requirement: System SHALL enforce anti-abuse constraints for invite redemption
The system SHALL enforce one-time code usage globally and one-time beta reward redemption per user.

#### Scenario: Code already used
- **WHEN** any user submits an invite code that has already been consumed
- **THEN** the system rejects redemption with `CODE_USED` and does not change membership state

#### Scenario: User already redeemed beta reward
- **WHEN** a user who already received the invite-based Pro reward submits another valid invite code
- **THEN** the system rejects redemption with `ALREADY_REDEEMED` and does not consume the second code

### Requirement: System SHALL support registration-time optional invite capture with deferred redemption
The system SHALL support an optional invite code field at registration and MUST defer redemption until the user enters `/app` in an authenticated session.

#### Scenario: Register with optional invite code
- **WHEN** a user submits registration with a non-empty invite code
- **THEN** the system stores the value as pending invite metadata and does not consume any invite code at registration time

#### Scenario: Auto redemption after first authenticated app entry
- **WHEN** an authenticated user enters `/app` and has pending invite metadata
- **THEN** the system attempts one redemption call automatically and clears pending metadata on successful redemption

### Requirement: System SHALL provide manual redemption fallback from profile
The system SHALL expose a manual invite redemption entry in profile so users can retry or redeem codes not provided during registration.

#### Scenario: Manual redemption succeeds
- **WHEN** an authenticated user submits a valid code from profile
- **THEN** the system grants benefits and returns success with updated expiry information

#### Scenario: Manual redemption fails with business reason
- **WHEN** an authenticated user submits an invalid, expired, used, or ineligible code
- **THEN** the system returns a normalized business error code and leaves existing membership unchanged

### Requirement: System SHALL expose normalized redemption result semantics
The system SHALL return normalized redemption outcomes so clients can render stable UX and telemetry.

#### Scenario: Invalid code format or unknown code
- **WHEN** a submitted code does not match any stored invite token
- **THEN** the system returns `INVALID_CODE`

#### Scenario: Expired code
- **WHEN** a submitted code is found but has passed its expiry timestamp
- **THEN** the system returns `CODE_EXPIRED`

#### Scenario: Unauthenticated request
- **WHEN** an unauthenticated client calls redeem endpoint
- **THEN** the system returns `NOT_AUTHENTICATED`
