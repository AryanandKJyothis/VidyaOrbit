
-- ============ ENUMS ============
CREATE TYPE public.workspace_role AS ENUM ('owner','manager','staff','viewer');
CREATE TYPE public.invite_status AS ENUM ('pending','accepted','revoked','expired');

-- ============ workspace_members ============
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'staff',
  permissions jsonb NOT NULL DEFAULT '{"students":"write","batches":"write","attendance":"write","fees":"write","settings":"none","billing":"none"}'::jsonb,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, user_id)
);
CREATE INDEX idx_wm_user ON public.workspace_members(user_id);
CREATE INDEX idx_wm_owner ON public.workspace_members(owner_id);

GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- ============ workspace_invites ============
CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  email text NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'staff',
  permissions jsonb NOT NULL DEFAULT '{"students":"write","batches":"write","attendance":"write","fees":"write","settings":"none","billing":"none"}'::jsonb,
  token text NOT NULL UNIQUE,
  status public.invite_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wi_owner ON public.workspace_invites(owner_id);
CREATE INDEX idx_wi_email ON public.workspace_invites(lower(email));
CREATE INDEX idx_wi_token ON public.workspace_invites(token);

GRANT SELECT ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- ============ Helper functions (SECURITY DEFINER) ============
CREATE OR REPLACE FUNCTION public.is_workspace_member(_owner uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE owner_id = _owner AND user_id = _uid)
$$;

CREATE OR REPLACE FUNCTION public.member_permission(_owner uuid, _uid uuid, _resource text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT permissions->>_resource FROM public.workspace_members WHERE owner_id = _owner AND user_id = _uid),
    'none'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_resource_access(_owner uuid, _uid uuid, _resource text, _write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _owner = _uid THEN true
    WHEN _write THEN public.member_permission(_owner, _uid, _resource) = 'write'
    ELSE public.member_permission(_owner, _uid, _resource) IN ('read','write')
  END
$$;

-- ============ workspace_members RLS ============
CREATE POLICY wm_select ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY wm_no_insert ON public.workspace_members FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY wm_no_update ON public.workspace_members FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY wm_no_delete ON public.workspace_members FOR DELETE TO anon, authenticated USING (false);

-- ============ workspace_invites RLS ============
CREATE POLICY wi_select ON public.workspace_invites FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
  );
CREATE POLICY wi_no_insert ON public.workspace_invites FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY wi_no_update ON public.workspace_invites FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY wi_no_delete ON public.workspace_invites FOR DELETE TO anon, authenticated USING (false);

-- ============ Replace existing RLS on shared resources ============
-- students
DROP POLICY IF EXISTS "own students" ON public.students;
CREATE POLICY students_select ON public.students FOR SELECT TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'students', false));
CREATE POLICY students_insert ON public.students FOR INSERT TO authenticated
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'students', true));
CREATE POLICY students_update ON public.students FOR UPDATE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'students', true))
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'students', true));
CREATE POLICY students_delete ON public.students FOR DELETE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'students', true));

-- batches
DROP POLICY IF EXISTS "own batches" ON public.batches;
CREATE POLICY batches_select ON public.batches FOR SELECT TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'batches', false));
CREATE POLICY batches_insert ON public.batches FOR INSERT TO authenticated
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'batches', true));
CREATE POLICY batches_update ON public.batches FOR UPDATE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'batches', true))
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'batches', true));
CREATE POLICY batches_delete ON public.batches FOR DELETE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'batches', true));

-- attendance_sessions
DROP POLICY IF EXISTS "own att sessions" ON public.attendance_sessions;
CREATE POLICY att_s_select ON public.attendance_sessions FOR SELECT TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'attendance', false));
CREATE POLICY att_s_insert ON public.attendance_sessions FOR INSERT TO authenticated
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'attendance', true));
CREATE POLICY att_s_update ON public.attendance_sessions FOR UPDATE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'attendance', true))
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'attendance', true));
CREATE POLICY att_s_delete ON public.attendance_sessions FOR DELETE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'attendance', true));

-- attendance_records
DROP POLICY IF EXISTS "own att records" ON public.attendance_records;
CREATE POLICY att_r_select ON public.attendance_records FOR SELECT TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'attendance', false));
CREATE POLICY att_r_insert ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'attendance', true));
CREATE POLICY att_r_update ON public.attendance_records FOR UPDATE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'attendance', true))
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'attendance', true));
CREATE POLICY att_r_delete ON public.attendance_records FOR DELETE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'attendance', true));

-- fee_payments
DROP POLICY IF EXISTS "own payments" ON public.fee_payments;
CREATE POLICY fp_select ON public.fee_payments FOR SELECT TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'fees', false));
CREATE POLICY fp_insert ON public.fee_payments FOR INSERT TO authenticated
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'fees', true));
CREATE POLICY fp_update ON public.fee_payments FOR UPDATE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'fees', true))
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'fees', true));
CREATE POLICY fp_delete ON public.fee_payments FOR DELETE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'fees', true));

-- institutes
DROP POLICY IF EXISTS "own institute" ON public.institutes;
CREATE POLICY inst_select ON public.institutes FOR SELECT TO authenticated
  USING (public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY inst_insert ON public.institutes FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY inst_update ON public.institutes FOR UPDATE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'settings', true))
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'settings', true));
CREATE POLICY inst_no_delete ON public.institutes FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ============ updated_at triggers ============
CREATE TRIGGER wm_set_updated_at BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER wi_set_updated_at BEFORE UPDATE ON public.workspace_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Auto-create owner member rows ============
CREATE OR REPLACE FUNCTION public.workspace_seed_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_members (owner_id, user_id, role, permissions, invited_by)
  VALUES (
    NEW.id, NEW.id, 'owner',
    '{"students":"write","batches":"write","attendance":"write","fees":"write","settings":"write","billing":"write"}'::jsonb,
    NEW.id
  ) ON CONFLICT (owner_id, user_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_workspace_owner
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.workspace_seed_owner();

-- Backfill existing users
INSERT INTO public.workspace_members (owner_id, user_id, role, permissions, invited_by)
SELECT id, id, 'owner',
  '{"students":"write","batches":"write","attendance":"write","fees":"write","settings":"write","billing":"write"}'::jsonb,
  id
FROM auth.users
ON CONFLICT (owner_id, user_id) DO NOTHING;
