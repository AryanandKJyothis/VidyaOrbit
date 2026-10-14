-- Multi-staff roles for a centre (Owner / Director, Manager, Staff).
-- Locks staff permission JSON to view-students + attendance/fees write,
-- and makes student DELETE owner-or-manager only.
--
-- DO NOT apply this migration from the agent or from a laptop unless a
-- human has reviewed it. It is shipped in the repo so it can be applied
-- in staging/prod through the usual migration path.

-- Privileged role: the centre owner (owner_id = uid) or a member whose
-- workspace_role is owner or manager. Used for destructive student ops
-- so Staff cannot delete students even if their permissions JSON is stale.
CREATE OR REPLACE FUNCTION public.has_privileged_workspace_role(_owner uuid, _uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND _uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF _owner = _uid THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE owner_id = _owner
      AND user_id = _uid
      AND role IN ('owner'::public.workspace_role, 'manager'::public.workspace_role)
  );
END;
$$;

COMMENT ON FUNCTION public.has_privileged_workspace_role(uuid, uuid) IS
  'True when _uid is the centre owner or a workspace owner/manager. Staff cannot delete students. Callers may only query for auth.uid() unless service_role.';

REVOKE ALL ON FUNCTION public.has_privileged_workspace_role(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_privileged_workspace_role(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS students_delete ON public.students;
CREATE POLICY students_delete ON public.students
  FOR DELETE TO authenticated
  USING (public.has_privileged_workspace_role(owner_id, auth.uid()));

-- Align existing staff/manager rows with the product presets.
-- Staff: view students, write attendance and fees, no settings/billing.
UPDATE public.workspace_members
SET permissions = '{"students":"read","batches":"read","attendance":"write","fees":"write","settings":"none","billing":"none"}'::jsonb
WHERE role = 'staff';

UPDATE public.workspace_invites
SET permissions = '{"students":"read","batches":"read","attendance":"write","fees":"write","settings":"none","billing":"none"}'::jsonb
WHERE role = 'staff'
  AND status = 'pending';

UPDATE public.workspace_members
SET permissions = '{"students":"write","batches":"write","attendance":"write","fees":"write","settings":"write","billing":"none"}'::jsonb
WHERE role = 'manager';

UPDATE public.workspace_invites
SET permissions = '{"students":"write","batches":"write","attendance":"write","fees":"write","settings":"write","billing":"none"}'::jsonb
WHERE role = 'manager'
  AND status = 'pending';

ALTER TABLE public.workspace_members
  ALTER COLUMN permissions SET DEFAULT '{"students":"read","batches":"read","attendance":"write","fees":"write","settings":"none","billing":"none"}'::jsonb;

ALTER TABLE public.workspace_invites
  ALTER COLUMN permissions SET DEFAULT '{"students":"read","batches":"read","attendance":"write","fees":"write","settings":"none","billing":"none"}'::jsonb;
