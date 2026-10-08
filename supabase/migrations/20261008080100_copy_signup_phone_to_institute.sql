-- Copy signup phone to institute contact_phone
-- Bug: When a user signs up with a phone number, it's stored in auth.users metadata
-- but not copied to the institutes.contact_phone field.
-- Fix: Update handle_new_user to extract phone from user metadata and set it on the institute.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone TEXT;
BEGIN
  -- Extract phone from user metadata if present
  v_phone := NEW.raw_user_meta_data->>'phone';

  INSERT INTO public.institutes (
    owner_id,
    name,
    contact_email,
    contact_phone
  )
  VALUES (
    NEW.id,
    'My Institute',
    NEW.email,
    v_phone  -- Will be NULL if no phone in metadata
  );

  INSERT INTO public.subscriptions (
    owner_id,
    plan,
    status,
    start_date,
    expiry_date,
    limit_students,
    notes
  )
  VALUES (
    NEW.id,
    'free',
    'active',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '365 days',
    25,
    'Free tier — 25 students, core features only.'
  );

  RETURN NEW;
END;
$function$;

-- Revoke remains the same
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
