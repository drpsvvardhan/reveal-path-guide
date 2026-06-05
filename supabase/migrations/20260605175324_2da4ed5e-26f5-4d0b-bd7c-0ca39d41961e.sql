-- Remove user-level UPDATE on patient_lab_uploads.
-- All mutations to identity/verification fields must go through edge functions
-- using the service role, which already has full update access.
DROP POLICY IF EXISTS "Users can update own uploads" ON public.patient_lab_uploads;

-- Remove user-level SELECT on patient_chat_validation_log.
-- This log captures internal moderation data (original_output, replaced_with,
-- role_violation) and should not be exposed to the owning user. Admins retain
-- read access; the service role continues to write.
DROP POLICY IF EXISTS "Users read own validation log" ON public.patient_chat_validation_log;