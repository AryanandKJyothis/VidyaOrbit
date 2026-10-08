-- Atomic billing activation function
-- Ensures exactly-once activation via conditional UPDATE and transactional RPC

-- First, add tier and cycle columns to billing_orders
ALTER TABLE public.billing_orders
  ADD COLUMN tier text CHECK (tier IN ('starter', 'growth', 'large')),
  ADD COLUMN cycle text CHECK (cycle IN ('monthly', 'annual'));

-- Backfill not needed (table not on prod yet)
ALTER TABLE public.billing_orders 
  ALTER COLUMN tier SET NOT NULL,
  ALTER COLUMN cycle SET NOT NULL;

-- Add constraint: activated_at implies paid status
ALTER TABLE public.billing_orders
  ADD CONSTRAINT chk_activated_implies_paid 
  CHECK (activated_at IS NULL OR status = 'paid');

-- Harden grants: revoke default privileges
REVOKE ALL ON public.billing_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.billing_orders TO authenticated;

-- Create the atomic activation function
CREATE OR REPLACE FUNCTION public.activate_billing_order(
  _order_id uuid,
  _payment_id text,
  _amount bigint,
  _currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.billing_orders;
  s record;
  v_expiry timestamptz;
  v_plan public.plan_code;
  v_sub_price numeric;
  v_res jsonb;
BEGIN
  -- Only service_role can activate
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden: only service_role can activate orders' USING ERRCODE = '42501';
  END IF;

  -- Lock the order FOR UPDATE and conditionally activate
  UPDATE public.billing_orders
    SET status = 'paid',
        paid_at = COALESCE(paid_at, now()),
        activated_at = now(),
        razorpay_payment_id = _payment_id
   WHERE id = _order_id
     AND activated_at IS NULL
     AND amount_paise = _amount
     AND upper(currency) = upper(_currency)
  RETURNING * INTO o;

  -- Check why UPDATE didn't match
  IF NOT FOUND THEN
    -- Determine reason
    DECLARE
      existing_order public.billing_orders;
    BEGIN
      SELECT * INTO existing_order 
        FROM public.billing_orders 
       WHERE id = _order_id;
      
      IF NOT FOUND THEN
        RETURN jsonb_build_object('activated', false, 'reason', 'order_not_found');
      END IF;
      
      IF existing_order.activated_at IS NOT NULL THEN
        RETURN jsonb_build_object('activated', false, 'reason', 'already_activated');
      END IF;
      
      -- Amount or currency mismatch
      RETURN jsonb_build_object('activated', false, 'reason', 'amount_or_currency_mismatch');
    END;
  END IF;

  -- Load current subscription (may be NULL row: apply_subscription_change upserts)
  SELECT plan, start_date, expiry_date, plan_price, notes INTO s
    FROM public.subscriptions 
   WHERE owner_id = o.owner_id 
     FOR UPDATE;

  -- Compute new expiry: max(now, current_expiry) + 1 or 12 months
  -- Postgres month arithmetic clamps (31 Jan + 1 month = 28/29 Feb)
  v_expiry := GREATEST(now(), COALESCE(s.expiry_date, now()))
              + CASE o.cycle 
                  WHEN 'annual' THEN interval '12 months' 
                  ELSE interval '1 month' 
                END;

  -- Map tier to plan_code (large -> pro)
  v_plan := CASE o.tier
              WHEN 'starter' THEN 'starter'
              WHEN 'growth' THEN 'growth'
              ELSE 'pro'
            END::public.plan_code;

  -- Extract subscription_charge from line_items (never pass 0 = comped)
  SELECT (li->>'amount')::numeric / 100 INTO v_sub_price
    FROM jsonb_array_elements(o.line_items) li
   WHERE li->>'item' = 'subscription_charge'
   LIMIT 1;

  -- Activate subscription via existing RPC
  v_res := public.apply_subscription_change(
    _owner      => o.owner_id,
    _changed_by => o.owner_id,
    _plan       => v_plan,
    _status     => 'active',
    _start      => COALESCE(s.start_date, now()),  -- preserve start_date
    _expiry     => v_expiry,
    _price      => v_sub_price,
    _notes      => s.notes,                         -- preserve admin notes
    _note       => format('Razorpay %s %s order %s payment %s', 
                         o.tier, o.cycle, o.razorpay_order_id, _payment_id),
    _confirm    => true
  );

  RETURN jsonb_build_object(
    'activated', true, 
    'owner_id', o.owner_id, 
    'tier', o.tier,
    'cycle', o.cycle,
    'result', v_res
  );
END
$$;

-- Harden: revoke default execute grants
REVOKE ALL ON FUNCTION public.activate_billing_order(uuid, text, bigint, text) 
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_billing_order(uuid, text, bigint, text) 
  TO service_role;

COMMENT ON FUNCTION public.activate_billing_order IS
  'Atomically activate a billing order and extend subscription. Service-role only. Idempotent.';
