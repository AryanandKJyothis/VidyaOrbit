-- VO-033: versioned copy of supabase/manual/20261008074501 (fee-gate 3b).
-- Live prod already has this trigger. Do NOT apply from this PR.
-- APPLY ORDER on a fresh empty project: 3a view first, then this file.
-- Re-apply on prod is intended to be a no-op (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).

-- Revoke direct table SELECT, grant column-level SELECT on non-fee columns
REVOKE SELECT ON public.students FROM anon, authenticated;
GRANT SELECT (
  id, owner_id, full_name, phone, guardian_name, guardian_phone,
  address, joining_date, status, batch_id, notes, created_at, updated_at
) ON public.students TO authenticated;

-- Trigger to prevent unauthorized fee writes
CREATE OR REPLACE FUNCTION public.validate_student_fee_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow service_role and superuser writes (admin operations, background jobs, seeding)
  IF auth.role() = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- On INSERT, only check if fee fields differ from defaults (fee_total=0, fee_due_date=NULL)
  IF TG_OP = 'INSERT' THEN
    IF (NEW.fee_total IS DISTINCT FROM 0 OR NEW.fee_due_date IS NOT NULL)
       AND NOT public.has_resource_access(NEW.owner_id, auth.uid(), 'fees', true) THEN
      RAISE EXCEPTION 'fees:write permission required to set fee fields' USING ERRCODE = '42501';
    END IF;
  -- On UPDATE, check if fee fields are being changed
  ELSIF (NEW.fee_total IS DISTINCT FROM OLD.fee_total OR NEW.fee_due_date IS DISTINCT FROM OLD.fee_due_date)
        AND NOT public.has_resource_access(NEW.owner_id, auth.uid(), 'fees', true) THEN
    RAISE EXCEPTION 'fees:write permission required to modify fee fields' USING ERRCODE = '42501';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_validate_student_fee_write ON public.students;
CREATE TRIGGER trg_validate_student_fee_write
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_student_fee_write();

REVOKE ALL ON FUNCTION public.validate_student_fee_write() FROM PUBLIC, anon, authenticated;
