-- Only treat a paid tier as "current plan" once the subscription row is genuinely active/trialing.
-- Prevents provisional Razorpay states (and pending checkout) from unlocking higher limits via current_plan().
CREATE OR REPLACE FUNCTION public.current_plan(_uid UUID)
RETURNS public.plan_code
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.subscriptions
      WHERE owner_id = _uid
        AND status IN ('active','trialing')
      LIMIT 1),
    'free'::public.plan_code
  );
$$;
