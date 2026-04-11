
-- Extend profiles with patient info and onboarding state
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS sex TEXT,
  ADD COLUMN IF NOT EXISTS signature_color TEXT,
  ADD COLUMN IF NOT EXISTS study_summary TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'welcome',
  ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS first_time_banner_dismissed_at TIMESTAMP WITH TIME ZONE;

-- Validation trigger for age
CREATE OR REPLACE FUNCTION public.validate_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.age IS NOT NULL AND (NEW.age <= 0 OR NEW.age >= 130) THEN
    RAISE EXCEPTION 'age must be between 1 and 129';
  END IF;
  IF NEW.sex IS NOT NULL AND NEW.sex NOT IN ('female', 'male', 'other', 'prefer_not_to_say') THEN
    RAISE EXCEPTION 'sex must be one of: female, male, other, prefer_not_to_say';
  END IF;
  IF NEW.onboarding_step IS NOT NULL AND NEW.onboarding_step NOT IN ('welcome', 'profile', 'upload', 'processing', 'complete', 'done') THEN
    RAISE EXCEPTION 'onboarding_step must be one of: welcome, profile, upload, processing, complete, done';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS validate_profile_fields_trigger ON public.profiles;
CREATE TRIGGER validate_profile_fields_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_fields();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_step ON public.profiles (onboarding_step);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed ON public.profiles (onboarding_completed_at);

-- Update existing new-user function to also set onboarding fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, onboarding_step, onboarding_started_at)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), 'welcome', now())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill existing users to 'done' so they skip onboarding
UPDATE public.profiles SET onboarding_step = 'done' WHERE onboarding_step IS NULL OR onboarding_step = 'welcome';
