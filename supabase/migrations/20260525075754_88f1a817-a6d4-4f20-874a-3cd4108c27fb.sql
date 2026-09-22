-- Harden razorpay_webhook_deliveries: enable RLS and block all client access.
-- Production already has these in place; this migration ensures parity for
-- staging/CI/DR environments built from migration history.

ALTER TABLE public.razorpay_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no client select rz deliveries" ON public.razorpay_webhook_deliveries;
DROP POLICY IF EXISTS "no client insert rz deliveries" ON public.razorpay_webhook_deliveries;
DROP POLICY IF EXISTS "no client update rz deliveries" ON public.razorpay_webhook_deliveries;
DROP POLICY IF EXISTS "no client delete rz deliveries" ON public.razorpay_webhook_deliveries;

CREATE POLICY "no client select rz deliveries"
  ON public.razorpay_webhook_deliveries
  FOR SELECT TO anon, authenticated
  USING (false);

CREATE POLICY "no client insert rz deliveries"
  ON public.razorpay_webhook_deliveries
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "no client update rz deliveries"
  ON public.razorpay_webhook_deliveries
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "no client delete rz deliveries"
  ON public.razorpay_webhook_deliveries
  FOR DELETE TO anon, authenticated
  USING (false);