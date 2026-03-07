## ADDED Requirements

### Requirement: System SHALL create self-serve web payment orders for enabled products
The system SHALL allow authenticated users to create payment orders from Fluxa web checkout for enabled, self-serve products, while rejecting disabled or sales-assisted plans.

#### Scenario: Create a pending order for a self-serve plan
- **WHEN** an authenticated user selects an enabled self-serve product and a supported payment channel from the web checkout
- **THEN** the system creates a pending order with a unique merchant order number, product snapshot, amount in fen, user id, payment channel, scene metadata, and expiration timestamp

#### Scenario: Reject an unavailable product
- **WHEN** a user attempts to create an order for a disabled product or a plan marked as contact-sales-only
- **THEN** the system refuses the request with an actionable error and does not create a payment order

### Requirement: System SHALL return scene-aware payment channels for website checkout
The system SHALL decide which channels are presented based on browser scene, merchant capability, and runtime feature flags.

#### Scenario: Desktop website checkout
- **WHEN** a user opens checkout in a normal desktop browser
- **THEN** the system offers configured desktop-capable channels such as Alipay page payment and WeChat Native QR, and hides unavailable channels

#### Scenario: WeChat in-app browser checkout
- **WHEN** a user opens checkout inside the WeChat browser and JSAPI credentials are configured
- **THEN** the system returns WeChat JSAPI as the preferred WeChat channel instead of desktop QR parameters

#### Scenario: UnionPay channel disabled
- **WHEN** UnionPay credentials or feature flags are not enabled in runtime settings
- **THEN** the checkout response excludes UnionPay from selectable channels

### Requirement: System SHALL trust asynchronous settlement and process it idempotently
The system SHALL use verified asynchronous notifications and active query responses as the trusted settlement source, and SHALL prevent duplicate fulfillment.

#### Scenario: Successful first notification
- **WHEN** the payment provider sends a valid success notification for an unpaid order
- **THEN** the system records the raw notification, marks the order as paid exactly once, and creates or updates the corresponding payment attempt

#### Scenario: Duplicate notification retry
- **WHEN** the provider re-sends the same success notification for an order that is already settled
- **THEN** the system acknowledges the retry without duplicating fulfillment, points grants, or membership changes

#### Scenario: Redirect page arrives before settlement
- **WHEN** the frontend returns from a payment redirect or polling request before server-side settlement is confirmed
- **THEN** the system continues reporting the order as pending until asynchronous settlement or active query confirms the final state

### Requirement: System SHALL fulfill membership and points through a single runtime membership snapshot
The system SHALL apply payment fulfillment through one canonical runtime membership snapshot compatible with current Fluxa points UI and backend permission checks.

#### Scenario: Membership purchase settles successfully
- **WHEN** a membership product is settled successfully
- **THEN** the system updates the user's current membership level, expiry, fulfillment source order, and any granted points in one idempotent fulfillment flow

#### Scenario: Existing app surfaces read membership state
- **WHEN** frontend balance displays or backend AI permission checks request the user's membership state
- **THEN** they read a consistent runtime snapshot and return the same membership level and entitlements

#### Scenario: Future points top-up product settles
- **WHEN** a settled product grants points without changing membership level
- **THEN** the system increases the user's points balance and transaction history without altering the current membership level

### Requirement: System SHALL support order recovery, refunds, and auditability
The system SHALL provide unified status query, refund tracking, and audit records for payment operations.

#### Scenario: Pending order requires recovery
- **WHEN** a payment order remains pending beyond the expected client polling window
- **THEN** the system can actively query the provider and transition the order to paid, expired, or failed based on the provider result

#### Scenario: Operator initiates refund
- **WHEN** an operator requests a refund for a paid order
- **THEN** the system creates a refund record, submits the provider refund request, and applies any membership or points rollback only after refund success is confirmed

#### Scenario: Support needs payment traceability
- **WHEN** an order, payment attempt, webhook event, or refund changes state
- **THEN** the system stores provider reference ids, timestamps, and local correlation ids for audit and troubleshooting
