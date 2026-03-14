-- Drop the payment_orders-only foreign key so invite redemption UUIDs can be stored
-- in user_profiles.membership_source_order_id without violating cross-domain constraints.

BEGIN;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_membership_source_order_id_fkey;

COMMIT;
