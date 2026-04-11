CREATE OR REPLACE FUNCTION public.validate_profile_fields()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.age IS NOT NULL AND (NEW.age <= 0 OR NEW.age >= 130) THEN
    RAISE EXCEPTION 'age must be between 1 and 129';
  END IF;
  IF NEW.sex IS NOT NULL AND NEW.sex NOT IN ('female', 'male', 'other', 'prefer_not_to_say') THEN
    RAISE EXCEPTION 'sex must be one of: female, male, other, prefer_not_to_say';
  END IF;
  IF NEW.onboarding_step IS NOT NULL AND NEW.onboarding_step NOT IN ('welcome', 'profile', 'intake', 'upload', 'processing', 'complete', 'done') THEN
    RAISE EXCEPTION 'onboarding_step must be one of: welcome, profile, intake, upload, processing, complete, done';
  END IF;
  RETURN NEW;
END;
$function$;