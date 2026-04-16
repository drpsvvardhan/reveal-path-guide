-- Identity-confirmation flow for uploads
-- Adds an "awaiting_identity_confirmation" status and tracks user confirmation/denial.

-- Allow new status values via existing free-text status column (no enum).
-- Document accepted values for reference:
--   uploaded, processing, complete, failed,
--   rejected_identity, rejected_duplicate,
--   awaiting_identity_confirmation   <-- NEW

-- Add columns to record explicit user confirmation when they accept a borderline match.
ALTER TABLE public.patient_lab_uploads
  ADD COLUMN IF NOT EXISTS identity_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_confirmed_name text,
  ADD COLUMN IF NOT EXISTS identity_confirmation_kind text;

COMMENT ON COLUMN public.patient_lab_uploads.identity_confirmed_at IS
  'Timestamp when the patient explicitly confirmed this report belongs to them despite a name uncertainty or mismatch.';
COMMENT ON COLUMN public.patient_lab_uploads.identity_confirmed_name IS
  'The name the patient typed (mismatch override) or the extracted name they accepted (unknown override).';
COMMENT ON COLUMN public.patient_lab_uploads.identity_confirmation_kind IS
  'unknown_accepted | mismatch_overridden | null';

-- Index to speed UI polling for any upload still awaiting user input.
CREATE INDEX IF NOT EXISTS idx_lab_uploads_awaiting_identity
  ON public.patient_lab_uploads (user_id, status)
  WHERE status = 'awaiting_identity_confirmation';