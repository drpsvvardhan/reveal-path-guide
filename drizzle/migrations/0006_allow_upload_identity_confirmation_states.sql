-- The upload processors (process-lab-pdf, process-fibroscan) pause an upload for
-- patient identity confirmation, but the CHECK constraints never allowed those
-- states, so the write failed silently and the upload stayed at 'processing'
-- forever with zero observations. Widen both constraints to the states the
-- handlers actually use. Additive only: every existing value stays valid.

ALTER TABLE public.patient_lab_uploads
  DROP CONSTRAINT IF EXISTS patient_lab_uploads_status_check;

ALTER TABLE public.patient_lab_uploads
  ADD CONSTRAINT patient_lab_uploads_status_check
  CHECK (status = ANY (ARRAY[
    'uploaded','processing','extracted','complete','failed',
    'rejected_identity','rejected_duplicate',
    'awaiting_identity_confirmation'
  ]));

ALTER TABLE public.patient_lab_uploads
  DROP CONSTRAINT IF EXISTS patient_lab_uploads_name_match_status_check;

ALTER TABLE public.patient_lab_uploads
  ADD CONSTRAINT patient_lab_uploads_name_match_status_check
  CHECK (name_match_status = ANY (ARRAY[
    'match','mismatch','unknown','override_admin','pending',
    'needs_confirmation_mismatch','needs_confirmation_unknown',
    'confirmed_by_user'
  ]));