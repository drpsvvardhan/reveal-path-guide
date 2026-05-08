-- 6b.1: Clinical Authority Boundary + Dose Policy — richer audit columns

ALTER TABLE public.patient_chat_validation_log
  ADD COLUMN IF NOT EXISTS role_violation jsonb,
  ADD COLUMN IF NOT EXISTS dose_policy_context jsonb,
  ADD COLUMN IF NOT EXISTS routing_mode text,
  ADD COLUMN IF NOT EXISTS replacement_template_used text,
  ADD COLUMN IF NOT EXISTS regeneration_attempted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regeneration_succeeded boolean;

ALTER TABLE public.patient_chat_validation_log
  DROP CONSTRAINT IF EXISTS patient_chat_validation_log_status_check;

ALTER TABLE public.patient_chat_validation_log
  ADD CONSTRAINT patient_chat_validation_log_status_check
  CHECK (status IN (
    'passed',
    'failed_with_warnings',
    'replaced_with_fallback',
    'replaced_with_emergency_routing',
    'regenerated_successfully',
    'regenerated_then_replaced'
  ));