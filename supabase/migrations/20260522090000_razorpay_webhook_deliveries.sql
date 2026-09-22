-- Optional: ensure gen_random_uuid is available (pgcrypto extension)
-- If your Supabase DB uses pgcrypto already this will be a no-op; otherwise Supabase typically has gen_random_uuid available.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create table to track Razorpay webhook deliveries and provide idempotency
CREATE TABLE IF NOT EXISTS public.razorpay_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_hash TEXT NOT NULL UNIQUE,
  event_type TEXT,
  subscription_id TEXT,
  owner_id UUID,
  signature TEXT,
  raw_body JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled BOOLEAN NOT NULL DEFAULT false,
  handled_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_subscription_id ON public.razorpay_webhook_deliveries (subscription_id);
