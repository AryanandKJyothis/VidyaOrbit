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

-- key_mode: Preview shares the prod DB, so test-card payments must never
-- count as real. Idempotent if 091800 already created the column.
ALTER TABLE public.billing_orders
  ADD COLUMN IF NOT EXISTS key_mode text;

UPDATE public.billing_orders
   SET key_mode = 'test'
 WHERE key_mode IS NULL;

ALTER TABLE public.billing_orders
  ALTER COLUMN key_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.billing_orders'::regclass
      AND conname = 'billing_orders_key_mode_check'
  ) THEN
    ALTER TABLE public.billing_orders
      ADD CONSTRAINT billing_orders_key_mode_check
      CHECK (key_mode IN ('test', 'live'));
  END IF;
END
$$;

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
GRANT SELECT, INSERT, UPDATE ON public.billing_orders TO service_role;

-- ── subscriptions.setup_fee_paid ───────────────────────────────────
-- One-time onboarding: any captured paid billing order (monthly or
-- annual, any plan, with or without a setup line, including a hold)
-- or an admin toggle (invoices / special deals). Trials, comps, and
-- admin-set non-free plans do not waive setup. No table-wide UPDATE:
-- ADD COLUMN DEFAULT false is enough; a re-run must not wipe flags.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS setup_fee_paid boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.subscriptions.setup_fee_paid IS
  'True once the centre has made any real payment: any captured online billing order (including a needs_review hold), or admin toggle for offline invoices / special deals. Not implied by a trial, comp, or an admin-set non-free plan. One-time onboarding fee — never charged again.';

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
         AND bo.key_mode = 'live'
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
  v_setup_in_order boolean;
  v_setup_already boolean;
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
          'needs_review', COALESCE(existing_order.needs_review, false),
          'review_reason', existing_order.review_reason
        );
      END IF;

      RETURN jsonb_build_object('activated', false, 'reason', 'amount_or_currency_mismatch');
    END;
  END IF;

  SELECT plan, start_date, expiry_date, plan_price, notes, setup_fee_paid INTO s
    FROM public.subscriptions
   WHERE owner_id = o.owner_id
     FOR UPDATE;

  v_setup_in_order := EXISTS (
    SELECT 1
      FROM jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) li
     WHERE li->>'item' = 'setup_fee'
       AND COALESCE((li->>'amount')::numeric, 0) > 0
  );

  -- Already paid *before this order*: the flag, or any OTHER captured *live*
  -- order (this row already has activated_at from the UPDATE above).
  -- Test-mode captures never count as already paid.
  v_setup_already :=
    COALESCE(s.setup_fee_paid, false)
    OR EXISTS (
      SELECT 1 FROM public.billing_orders bo
       WHERE bo.owner_id = o.owner_id
         AND bo.id IS DISTINCT FROM o.id
         AND bo.activated_at IS NOT NULL
         AND bo.key_mode = 'live'
    );

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
    -- Tier hold wins (plan is not applied). If setup was also double-charged,
    -- both reasons stay in review_reason so the admin refunds the ₹5,000 too.
    IF v_setup_in_order AND v_setup_already THEN
      v_review_reason := v_review_reason
        || ' setup_already_paid. Also refund the ₹5,000 setup — another captured payment already covered onboarding.';
    END IF;

    UPDATE public.billing_orders
       SET needs_review = true,
           review_reason = v_review_reason
     WHERE id = o.id;

    -- Subscriptions row is locked above (handle_new_user always creates it).
    -- Test-mode captures must not set the flag.
    IF o.key_mode = 'live' THEN
      UPDATE public.subscriptions
         SET setup_fee_paid = true
       WHERE owner_id = o.owner_id;
    END IF;

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

  -- After apply (the upsert has created the row if needed). Test-mode
  -- captures must not set the flag. INSERT … ON CONFLICT does not set
  -- setup_fee_paid, so a first-time live payer would otherwise keep DEFAULT false.
  IF o.key_mode = 'live' THEN
    UPDATE public.subscriptions
       SET setup_fee_paid = true
     WHERE owner_id = o.owner_id;
  END IF;

  IF v_setup_in_order AND v_setup_already THEN
    UPDATE public.billing_orders
       SET needs_review = true,
           review_reason = 'setup_already_paid. Refund the ₹5,000 setup — another captured payment already covered onboarding. The plan was still applied.'
     WHERE id = o.id;

    RETURN jsonb_build_object(
      'activated', true,
      'needs_review', true,
      'reason', 'setup_already_paid',
      'owner_id', o.owner_id,
      'tier', o.tier,
      'cycle', o.cycle,
      'result', v_res
    );
  END IF;

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
  'Atomically mark a billing order paid and apply the subscription, or hold a mid-term different-tier capture as needs_review. Sets setup_fee_paid AFTER apply_subscription_change (and on a hold) only for key_mode=live, and only after the subscriptions row exists (handle_new_user / upsert). Test-mode captures still activate so Preview can be tested, but never count as already paid. If this order charged setup but setup was already paid (flag or any OTHER captured live order), still apply the plan and flag needs_review reason setup_already_paid for a ₹5,000 refund. A tier hold is not applied; review_reason then includes both the tier text and setup_already_paid. Service-role only. Idempotent. Same-tier extends from GREATEST(now(), expiry). SQL month math is the source of truth (not JS).';
