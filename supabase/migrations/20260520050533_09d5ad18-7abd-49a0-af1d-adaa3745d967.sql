
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
  SELECT COUNT(*) INTO v_count FROM public.students WHERE owner_id = NEW.owner_id;
  IF v_count >= v_limit THEN
    v_plan_label := initcap(v_plan::text);
    RAISE EXCEPTION 'USER: You''ve reached your % plan limit of % students. Upgrade your plan to add more.', v_plan_label, v_limit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_student_limit_trg ON public.students;
CREATE TRIGGER enforce_student_limit_trg
BEFORE INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_limit();
