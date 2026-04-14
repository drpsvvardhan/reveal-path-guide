-- Add voice validation columns to all three prose output tables
ALTER TABLE public.terrain_renders
ADD COLUMN IF NOT EXISTS voice_validation_status text
  CHECK (voice_validation_status IS NULL OR voice_validation_status IN ('passed', 'failed_with_warnings'));

ALTER TABLE public.terrain_renders
ADD COLUMN IF NOT EXISTS voice_validation_warnings jsonb;

ALTER TABLE public.action_plans
ADD COLUMN IF NOT EXISTS voice_validation_status text
  CHECK (voice_validation_status IS NULL OR voice_validation_status IN ('passed', 'failed_with_warnings'));

ALTER TABLE public.action_plans
ADD COLUMN IF NOT EXISTS voice_validation_warnings jsonb;

ALTER TABLE public.patient_narratives
ADD COLUMN IF NOT EXISTS voice_validation_status text
  CHECK (voice_validation_status IS NULL OR voice_validation_status IN ('passed', 'failed_with_warnings'));

ALTER TABLE public.patient_narratives
ADD COLUMN IF NOT EXISTS voice_validation_warnings jsonb;