-- Applied 2026-10-08 to qyqomxuxtpbhnicbtmbq.
-- Bug: validate_workspace_references() evaluated NEW.batch_id in
-- "IF TG_TABLE_NAME = 'students' AND NEW.batch_id IS NOT NULL" for every table,
-- so inserts into fee_payments / attendance_records (no batch_id column) failed with
-- 'record "new" has no field "batch_id"'. Fix: nest the batch_id check inside the students branch.
-- (Full function body: see Supabase migration fix_validate_workspace_references_batch_id.)

CREATE OR REPLACE FUNCTION public.validate_workspace_references()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  referenced_owner uuid;
BEGIN
  IF TG_TABLE_NAME = 'students' THEN
    IF NEW.batch_id IS NOT NULL THEN
      SELECT owner_id INTO referenced_owner FROM public.batches WHERE id = NEW.batch_id;
      IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
        RAISE EXCEPTION 'Student and batch must belong to the same workspace' USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'fee_payments' THEN
    SELECT owner_id INTO referenced_owner FROM public.students WHERE id = NEW.student_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Payment and student must belong to the same workspace' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'attendance_sessions' THEN
    SELECT owner_id INTO referenced_owner FROM public.batches WHERE id = NEW.batch_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Attendance session and batch must belong to the same workspace' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'attendance_records' THEN
    SELECT owner_id INTO referenced_owner FROM public.attendance_sessions WHERE id = NEW.session_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Attendance record and session must belong to the same workspace' USING ERRCODE = '23514';
    END IF;
    SELECT owner_id INTO referenced_owner FROM public.students WHERE id = NEW.student_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Attendance record and student must belong to the same workspace' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
