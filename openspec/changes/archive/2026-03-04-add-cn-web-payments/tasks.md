## 1. Data & Product Modeling

- [x] 1.1 Create payment domain tables for products, orders, payment attempts, webhook events, and refunds with RLS, unique constraints, and financial indexes
- [x] 1.2 Extend `user_profiles` with payment fulfillment snapshot fields such as `membership_expires_at`, `membership_source_order_id`, and `membership_updated_at`
- [x] 1.3 Expand payment-related transaction metadata and source enums in `point_transactions` so membership grants and refund rollbacks are auditable
- [x] 1.4 Seed `payment_products` and runtime channel flags from system settings, keeping Team/self-serve boundaries configurable

## 2. Payment Service & Channel Adapters

- [x] 2.1 Add a unified `src/lib/payments/*` domain layer for order creation, settlement, status query, refund, and scene detection
- [x] 2.2 Implement the Alipay website adapter for order creation, return handling, and async notification verification
- [x] 2.3 Implement the WeChat website adapter for Native QR checkout and JSAPI payload generation when in-app credentials are available
- [x] 2.4 Add a feature-flagged UnionPay adapter interface and configuration path without enabling it by default

## 3. APIs, Fulfillment & Membership Consistency

- [x] 3.1 Add authenticated checkout and order-status routes plus public provider notification routes under `src/app/api/payments/*`
- [x] 3.2 Implement idempotent payment fulfillment that updates `payment_orders`, `user_profiles`, and `point_transactions` in a single transactional path
- [x] 3.3 Replace legacy backend membership reads from `memberships` with the canonical runtime snapshot used by the frontend
- [x] 3.4 Add recovery jobs or scripts for pending-order query, order expiration, refund confirmation, and reconciliation export

## 4. Frontend Checkout Integration

- [x] 4.1 Refactor pricing data flow to read sellable products from the backend instead of hardcoded plan prices
- [x] 4.2 Replace pricing CTA href-only behavior with a checkout dialog/page that shows scene-aware payment channels and order status polling
- [x] 4.3 Refresh points and membership state after successful payment so pricing, profile, and insufficient-points flows reflect the new entitlements
- [x] 4.4 Keep non-self-serve plans on the existing contact-sales path and reserve hooks for future point top-up entry points

## 5. Verification, Observability & Rollout

- [x] 5.1 Add structured logs, provider correlation ids, and webhook audit records for order, payment, refund, and reconciliation events
- [x] 5.2 Add tests for order idempotency, notification verification, scene-based channel selection, and membership/points fulfillment
- [x] 5.3 Validate end-to-end sandbox flows for Alipay and WeChat before enabling production flags, and document the UnionPay enablement checklist
- [x] 5.4 Run project quality gates and document operator runbooks for rollback, refund handling, and manual reconciliation
