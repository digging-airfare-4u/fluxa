## MODIFIED Requirements

### Requirement: System SHALL fulfill membership and points through a single runtime membership snapshot
The system SHALL apply membership and points fulfillment through one canonical runtime membership snapshot for both payment and non-payment grant sources, compatible with current Fluxa points UI and backend permission checks.

#### Scenario: Membership purchase settles successfully
- **WHEN** a membership product is settled successfully
- **THEN** the system updates the user's current membership level, expiry, fulfillment source order, and any granted points in one idempotent fulfillment flow

#### Scenario: Invite code redemption grants membership
- **WHEN** an authenticated user successfully redeems a valid invite code reward
- **THEN** the system updates membership level and expiry through the same runtime membership snapshot path, records a non-payment fulfillment source, and keeps membership reads consistent across frontend and backend

#### Scenario: Existing app surfaces read membership state
- **WHEN** frontend balance displays or backend AI permission checks request the user's membership state
- **THEN** they read a consistent runtime snapshot and return the same membership level and entitlements regardless of whether membership came from payment or invite redemption

#### Scenario: Future points top-up product settles
- **WHEN** a settled product grants points without changing membership level
- **THEN** the system increases the user's points balance and transaction history without altering the current membership level
