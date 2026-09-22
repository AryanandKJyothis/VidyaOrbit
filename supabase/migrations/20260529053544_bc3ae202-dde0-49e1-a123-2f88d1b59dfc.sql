
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip auto-creating an institute if the user is signing up to join a team
  IF COALESCE((NEW.raw_user_meta_data->>'joining_team')::boolean, false) = false THEN
    INSERT INTO public.institutes (owner_id, name, contact_email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'institute_name', 'My Institute'), NEW.email)
    ON CONFLICT (owner_id) DO NOTHING;
  END IF;

  INSERT INTO public.subscriptions (owner_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (owner_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
