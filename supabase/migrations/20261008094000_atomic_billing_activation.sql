-- Atomic billing activation function
-- Ensures exactly-once activation via conditional UPDATE and transactional RPC.
-- Fully idempotent: safe to re-run.

-- ── billing_orders: tier / cycle / review columns ──────────────────
ALTER TABLE public.billing_orders
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS cycle text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.billing_orders'::regclass
      AND conname = 'billing_orders_tier_check'
  ) THEN
    ALTER TABLE public.billing_orders
      ADD CONSTRAINT billing_orders_tier_check
      CHECK (tier IN ('starter', 'growth', 'large'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.billing_orders'::regclass
      AND conname = 'billing_orders_cycle_check'
  ) THEN
    ALTER TABLE public.billing_orders
      ADD CONSTRAINT billing_orders_cycle_check
      CHECK (cycle IN ('monthly', 'annual'));
  END IF;
END
$$;

-- Table is not on prod yet; after first successful insert these are required.
ALTER TABLE public.billing_orders
  ALTER COLUMN tier SET NOT NULL,
  ALTER COLUMN cycle SET NOT NULL;

ALTER TABLE public.billing_orders DROP CONSTRAINT IF EXISTS chk_activated_implies_paid;
ALTER TABLE public.billing_orders
  ADD CONSTRAINT chk_activated_implies_paid
  CHECK (activated_at IS NULL OR status = 'paid');

CREATE INDEX IF NOT EXISTS billing_orders_needs_review_idx
  ON public.billing_orders (owner_id)
  WHERE needs_review;

-- Harden grants (re-grant is safe)
REVOKE ALL ON public.billing_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.billing_orders TO authenticated;

-- ── subscriptions.setup_fee_paid ───────────────────────────────────
-- True only after a real setup payment: an online order that charged
-- setup, or an admin toggle (invoices / special deals). Trials, comps,
-- and admin-set non-free plans do not waive setup.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS setup_fee_paid boolean NOT NULL DEFAULT false;

UPDATE public.subscriptions
   SET setup_fee_paid = false;

COMMENT ON COLUMN public.subscriptions.setup_fee_paid IS
  'True once setup has actually been paid: captured online order that included a setup_fee line, or admin toggle for offline invoices / special deals. Not implied by a non-free plan or an expiry date.';

-- Health RPC: exclude archived students and expose setup_fee_paid.
-- Mirrors 091700 archived count; this later migration is the live definition.
CREATE OR REPLACE FUNCTION public.subscription_health(_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_effective_plan public.plan_code;
  v_limit integer;
  v_count integer;
  v_days_left integer;
  v_expired boolean;
  v_setup_paid boolean;
BEGIN
  -- Live semantics (null-safe): service_role is allowed. Otherwise auth.uid()
  -- IS NULL is forbidden. Allowed when _uid is the caller or a workspace they
  -- belong to, so invited staff inherit the institute plan.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL
       OR (
         auth.uid() IS DISTINCT FROM _uid
         AND NOT public.is_workspace_member(_uid, auth.uid())
       )
    THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT plan, status, start_date, expiry_date, plan_price, notes,
         current_period_end, setup_fee_paid
    INTO v_sub
    FROM public.subscriptions
    WHERE owner_id = _uid
    LIMIT 1;

  v_effective_plan := public.current_plan(_uid);
  v_limit := public.plan_student_limit(v_effective_plan);

  SELECT COUNT(*) INTO v_count
    FROM public.students
   WHERE owner_id = _uid
     AND status IS DISTINCT FROM 'archived';

  v_expired := v_sub.expiry_date IS NOT NULL AND v_sub.expiry_date < now();
  v_days_left := CASE
    WHEN v_sub.expiry_date IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM (v_sub.expiry_date - now()))::int
  END;

  v_setup_paid :=
    COALESCE(v_sub.setup_fee_paid, false)
    OR EXISTS (
      SELECT 1 FROM public.billing_orders bo
       WHERE bo.owner_id = _uid
         AND bo.activated_at IS NOT NULL
         AND EXISTS (
           SELECT 1
             FROM jsonb_array_elements(COALESCE(bo.line_items, '[]'::jsonb)) li
            WHERE li->>'item' = 'setup_fee'
              AND COALESCE((li->>'amount')::numeric, 0) > 0
         )
    );

  RETURN jsonb_build_object(
    'plan', v_effective_plan,
    'raw_plan', COALESCE(v_sub.plan, 'free'::public.plan_code),
    'status', COALESCE(v_sub.status, 'active'),
    'start_date', v_sub.start_date,
    'expiry_date', v_sub.expiry_date,
    'current_period_end', v_sub.current_period_end,
    'plan_price', v_sub.plan_price,
    'notes', v_sub.notes,
    'limit', v_limit,
    'student_count', v_count,
    'over_limit', v_count > v_limit,
    'over_by', GREATEST(0, v_count - v_limit),
    'days_until_expiry', v_days_left,
    'expired', v_expired,
    'setup_fee_paid', v_setup_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.subscription_health(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subscription_health(uuid) TO authenticated, service_role;

-- ── activate_billing_order ─────────────────────────────────────────
-- Mid-term tier policy (Asia/Kolkata calendar days; SQL is source of truth):
--   * Same-tier renewal: extend from GREATEST(now(), current expiry).
--   * Different tier while more than 7 Kolkata days remain on a paid plan:
--     do NOT switch or extend. Mark the order paid + activated_at +
--     needs_review so money is never silently lost; admin sees it on the
--     institute dialog. Return reason 'tier_change_needs_review'.
--   * Different tier with ≤7 days left, expired, free, or unpaid/comped:
--     apply as usual (extend from GREATEST(now(), expiry)).
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
  v_days_left integer;
  v_order_plan public.plan_code;
  v_current_plan public.plan_code;
  v_paid_current boolean;
  v_review_reason text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden: only service_role can activate orders' USING ERRCODE = '42501';
  END IF;

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

  IF NOT FOUND THEN
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
        RETURN jsonb_build_object(
          'activated', false,
          'reason', 'already_activated',
          'needs_review', COALESCE(existing_order.needs_review, false)
        );
      END IF;

      RETURN jsonb_build_object('activated', false, 'reason', 'amount_or_currency_mismatch');
    END;
  END IF;

  SELECT plan, start_date, expiry_date, plan_price, notes INTO s
    FROM public.subscriptions
   WHERE owner_id = o.owner_id
     FOR UPDATE;

  -- Captured setup is paid even if this order is later held for review.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) li
     WHERE li->>'item' = 'setup_fee'
       AND COALESCE((li->>'amount')::numeric, 0) > 0
  ) THEN
    UPDATE public.subscriptions
       SET setup_fee_paid = true
     WHERE owner_id = o.owner_id;
  END IF;

  v_order_plan := CASE o.tier
                    WHEN 'starter' THEN 'starter'
                    WHEN 'growth' THEN 'growth'
                    ELSE 'pro'
                  END::public.plan_code;
  v_current_plan := COALESCE(s.plan, 'free'::public.plan_code);

  -- Paid current tier = non-free, price > 0, expiry in the future.
  v_paid_current :=
    v_current_plan IS DISTINCT FROM 'free'::public.plan_code
    AND s.plan_price IS NOT NULL
    AND s.plan_price > 0
    AND s.expiry_date IS NOT NULL
    AND s.expiry_date > now();

  v_days_left := CASE
    WHEN s.expiry_date IS NULL THEN NULL
    ELSE (
      (s.expiry_date AT TIME ZONE 'Asia/Kolkata')::date
      - (now() AT TIME ZONE 'Asia/Kolkata')::date
    )
  END;

  IF v_paid_current
     AND v_order_plan IS DISTINCT FROM v_current_plan
     AND v_days_left IS NOT NULL
     AND v_days_left > 7 THEN
    v_review_reason := format(
      'Paid %s %s order captured while current paid plan is %s with %s Asia/Kolkata days left. Not applied: mid-term tier changes are manual. Refund or apply from the admin subscriptions dialog.',
      o.tier, o.cycle, v_current_plan, v_days_left
    );

    UPDATE public.billing_orders
       SET needs_review = true,
           review_reason = v_review_reason
     WHERE id = o.id;

    RETURN jsonb_build_object(
      'activated', false,
      'reason', 'tier_change_needs_review',
      'needs_review', true,
      'owner_id', o.owner_id,
      'tier', o.tier,
      'cycle', o.cycle
    );
  END IF;

  -- Same-tier (or allowed switch): extend from current expiry, never shrink.
  -- Postgres month arithmetic clamps (31 Jan + 1 month = 28/29 Feb).
  v_expiry := GREATEST(now(), COALESCE(s.expiry_date, now()))
              + CASE o.cycle
                  WHEN 'annual' THEN interval '12 months'
                  ELSE interval '1 month'
                END;

  v_plan := v_order_plan;

  SELECT (li->>'amount')::numeric / 100 INTO v_sub_price
    FROM jsonb_array_elements(o.line_items) li
   WHERE li->>'item' = 'subscription_charge'
   LIMIT 1;

  v_res := public.apply_subscription_change(
    _owner      => o.owner_id,
    _changed_by => o.owner_id,
    _plan       => v_plan,
    _status     => 'active',
    _start      => COALESCE(s.start_date, now()),
    _expiry     => v_expiry,
    _price      => v_sub_price,
    _notes      => s.notes,
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

REVOKE ALL ON FUNCTION public.activate_billing_order(uuid, text, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_billing_order(uuid, text, bigint, text)
  TO service_role;

COMMENT ON FUNCTION public.activate_billing_order IS
  'Atomically mark a billing order paid and apply the subscription, or hold a mid-term different-tier capture as needs_review. Sets setup_fee_paid when the captured order line_items include a setup_fee amount > 0 (including a hold: the customer paid it either way). Service-role only. Idempotent. Same-tier extends from GREATEST(now(), expiry). Different paid tier with >7 Asia/Kolkata calendar days remaining is not applied: the order stays paid/visible for admin review. SQL month math is the source of truth (not JS).';
