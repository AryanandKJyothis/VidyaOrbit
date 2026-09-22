
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Manual subscription fields
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_date timestamptz,
  ADD COLUMN IF NOT EXISTS plan_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Internal institute admin notes
ALTER TABLE public.institutes
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- Audit log
CREATE TABLE public.subscription_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_plan public.plan_code,
  new_plan public.plan_code,
  old_status text,
  new_status text,
  old_expiry timestamptz,
  new_expiry timestamptz,
  old_price numeric(10,2),
  new_price numeric(10,2),
  note text
);
ALTER TABLE public.subscription_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no client select audit" ON public.subscription_audit
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "no client insert audit" ON public.subscription_audit
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "no client update audit" ON public.subscription_audit
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no client delete audit" ON public.subscription_audit
  FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX subscription_audit_owner_changed_idx
  ON public.subscription_audit (owner_id, changed_at DESC);

-- current_plan respects manual expiry/suspension
CREATE OR REPLACE FUNCTION public.current_plan(_uid uuid)
RETURNS public.plan_code LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT CASE
       WHEN status IN ('expired','suspended','canceled') THEN 'free'::public.plan_code
       WHEN expiry_date IS NOT NULL AND expiry_date < now() THEN 'free'::public.plan_code
       ELSE plan
     END
     FROM public.subscriptions WHERE owner_id = _uid LIMIT 1),
    'free'::public.plan_code
  );
$$;
