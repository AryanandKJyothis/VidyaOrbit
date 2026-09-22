-- Plans enum
CREATE TYPE public.plan_code AS ENUM ('free', 'starter', 'growth', 'pro');

-- Subscriptions table (one row per owner)
CREATE TABLE public.subscriptions (
  owner_id UUID PRIMARY KEY,
  plan public.plan_code NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  razorpay_subscription_id TEXT UNIQUE,
  razorpay_customer_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription; only service role writes (via webhook)
CREATE POLICY "read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: current plan (defaults to 'free' if no row)
CREATE OR REPLACE FUNCTION public.current_plan(_uid UUID)
RETURNS public.plan_code
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.subscriptions
      WHERE owner_id = _uid
        AND status IN ('active','authenticated','trialing')
      LIMIT 1),
    'free'::public.plan_code
  );
$$;

-- Helper: student limit per plan
CREATE OR REPLACE FUNCTION public.plan_student_limit(_plan public.plan_code)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 25
    WHEN 'starter' THEN 100
    WHEN 'growth' THEN 500
    WHEN 'pro' THEN 1000
  END;
$$;

-- Hard wall: reject student inserts beyond plan limit
CREATE OR REPLACE FUNCTION public.enforce_student_limit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan public.plan_code;
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  v_plan := public.current_plan(NEW.owner_id);
  v_limit := public.plan_student_limit(v_plan);
  SELECT COUNT(*) INTO v_count FROM public.students WHERE owner_id = NEW.owner_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Plan limit reached: your % plan allows up to % students. Upgrade to add more.', v_plan, v_limit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_student_limit_trg
  BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_limit();

-- Auto-create free subscription row on signup (extend existing handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.institutes (owner_id, name, contact_email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'institute_name', 'My Institute'), NEW.email)
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.subscriptions (owner_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (owner_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill free subscription for any existing users
INSERT INTO public.subscriptions (owner_id, plan, status)
SELECT id, 'free', 'active' FROM auth.users
ON CONFLICT (owner_id) DO NOTHING;