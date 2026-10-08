-- Table to track Razorpay in-app checkout orders and payments
-- This replaces the hosted subscription flow with order-based payments

CREATE TABLE IF NOT EXISTS public.billing_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  razorpay_order_id text UNIQUE NOT NULL,
  razorpay_payment_id text UNIQUE,
  intent text NOT NULL,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  line_items jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  activated_at timestamptz,

  CONSTRAINT fk_billing_orders_owner
    FOREIGN KEY (owner_id)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT
);

-- Indexes for common queries (UNIQUE on razorpay_order_id already indexes that column)
CREATE INDEX IF NOT EXISTS idx_billing_orders_owner_id
  ON public.billing_orders (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_orders_razorpay_payment_id
  ON public.billing_orders (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_orders_status
  ON public.billing_orders (status, created_at DESC);

-- Enable RLS
ALTER TABLE public.billing_orders ENABLE ROW LEVEL SECURITY;

-- Owners can read their own orders only
DROP POLICY IF EXISTS "read own billing orders" ON public.billing_orders;
CREATE POLICY "read own billing orders" ON public.billing_orders
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- No client writes - all writes via server with service_role
DROP POLICY IF EXISTS "no client insert billing orders" ON public.billing_orders;
CREATE POLICY "no client insert billing orders" ON public.billing_orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "no client update billing orders" ON public.billing_orders;
CREATE POLICY "no client update billing orders" ON public.billing_orders
  FOR UPDATE TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "no client delete billing orders" ON public.billing_orders;
CREATE POLICY "no client delete billing orders" ON public.billing_orders
  FOR DELETE TO anon, authenticated
  USING (false);

COMMENT ON TABLE public.billing_orders IS
  'Tracks Razorpay Standard Checkout orders and payments. Server-only writes via service_role. Client can SELECT own rows. Payment rows survive user deletion (ON DELETE RESTRICT).';

COMMENT ON COLUMN public.billing_orders.intent IS
  'Legacy free-text label of the form "<tier>_<cycle>" (e.g. growth_monthly). Canonical fields are the tier and cycle columns.';

COMMENT ON COLUMN public.billing_orders.line_items IS
  'JSON array of charge items, e.g. [{"item": "setup_fee", "amount": 500000}, {"item": "subscription_charge", "amount": 99900}]';
