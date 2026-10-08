-- Fix enforce_student_limit to exclude archived students from the count
-- Only count active and inactive students, not archived ones

CREATE OR REPLACE FUNCTION public.enforce_student_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plan_code;
  v_limit integer;
  v_count integer;
  v_plan_label text;
BEGIN
  v_plan := public.current_plan(NEW.owner_id);
  v_limit := public.plan_student_limit(v_plan);
  
  -- Count only non-archived students
  SELECT COUNT(*) INTO v_count 
  FROM public.students 
  WHERE owner_id = NEW.owner_id 
    AND status != 'archived';
  
  IF v_count >= v_limit THEN
    v_plan_label := initcap(v_plan::text);
    RAISE EXCEPTION 'USER: You''ve reached your % plan limit of % students. Upgrade your plan to add more.', v_plan_label, v_limit;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_student_limit() IS
  'BEFORE INSERT ONLY on public.students. Enforces plan limit but excludes archived students from the count. Never touches existing rows: downgrading a plan never deletes students, batches, fees, or attendance. Owners simply cannot add NEW students until they trim or upgrade. Do NOT extend to UPDATE/DELETE.';
