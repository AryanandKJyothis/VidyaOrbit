-- Keep foreign-key relationships inside the same workspace. RLS checks the
-- caller's access to each row, but a foreign key alone does not check that
-- both rows share the same owner_id.

CREATE OR REPLACE FUNCTION public.validate_workspace_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referenced_owner uuid;
BEGIN
  IF TG_TABLE_NAME = 'students' AND NEW.batch_id IS NOT NULL THEN
    SELECT owner_id INTO referenced_owner
    FROM public.batches
    WHERE id = NEW.batch_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Student and batch must belong to the same workspace'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'fee_payments' THEN
    SELECT owner_id INTO referenced_owner
    FROM public.students
    WHERE id = NEW.student_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Payment and student must belong to the same workspace'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'attendance_sessions' THEN
    SELECT owner_id INTO referenced_owner
    FROM public.batches
    WHERE id = NEW.batch_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Attendance session and batch must belong to the same workspace'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'attendance_records' THEN
    SELECT owner_id INTO referenced_owner
    FROM public.attendance_sessions
    WHERE id = NEW.session_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Attendance record and session must belong to the same workspace'
        USING ERRCODE = '23514';
    END IF;
    SELECT owner_id INTO referenced_owner
    FROM public.students
    WHERE id = NEW.student_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Attendance record and student must belong to the same workspace'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_workspace_references() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS students_validate_workspace_refs ON public.students;
CREATE TRIGGER students_validate_workspace_refs
  BEFORE INSERT OR UPDATE OF owner_id, batch_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_references();

DROP TRIGGER IF EXISTS payments_validate_workspace_refs ON public.fee_payments;
CREATE TRIGGER payments_validate_workspace_refs
  BEFORE INSERT OR UPDATE OF owner_id, student_id ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_references();

DROP TRIGGER IF EXISTS attendance_sessions_validate_workspace_refs ON public.attendance_sessions;
CREATE TRIGGER attendance_sessions_validate_workspace_refs
  BEFORE INSERT OR UPDATE OF owner_id, batch_id ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_references();

DROP TRIGGER IF EXISTS attendance_records_validate_workspace_refs ON public.attendance_records;
CREATE TRIGGER attendance_records_validate_workspace_refs
  BEFORE INSERT OR UPDATE OF owner_id, session_id, student_id ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_references();
