-- Defense in depth: clients may SELECT their own subscription (RLS) but
-- must not INSERT/UPDATE/DELETE/TRUNCATE. Writes go through SECURITY DEFINER
-- functions (handle_new_user, apply_subscription_change, activate_billing_order)
-- or the service_role admin client. Idempotent.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.subscriptions FROM anon, authenticated;

-- TRUNCATE ignores RLS; clients must have no table privileges at all.
REVOKE ALL ON public.razorpay_webhook_deliveries FROM anon, authenticated;
