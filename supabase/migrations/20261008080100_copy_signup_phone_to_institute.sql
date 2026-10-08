-- Migration 5: Copy signup phone to institute contact_phone
-- APPLY ORDER: Apply migrations 5, 4, 3a (safe with current prod), then deploy frontend, then manual 3b.
-- Based on LIVE handle_new_user, changing only the institutes insert to include contact_phone.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip auto-creating an institute if the user is signing up to join a team
  IF COALESCE((NEW.raw_user_meta_data->>'joining_team')::boolean, false) = false THEN
    INSERT INTO public.institutes (owner_id, name, contact_email, contact_phone)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'institute_name', 'My Institute'), 
      NEW.email,
      NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '')
    )
    ON CONFLICT (owner_id) DO NOTHING;
  END IF;

  INSERT INTO public.subscriptions (owner_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (owner_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
