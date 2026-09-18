-- The patient-facing notice view previously bypassed the caller's own
-- permissions. Give patients narrowly scoped, column-level read access to
-- their own review record instead, and let the view run as the caller.
-- Private clinical notes (assessment_note, rationale, clinician_user_id and
-- the rest) are deliberately NOT granted, so a patient cannot read them even
-- by querying the table directly.
GRANT SELECT (id, session_id, patient_user_id, disposition, encounter_at, patient_instructions, created_at)
  ON public.cie33_safety_reviews TO authenticated;

CREATE POLICY "Patients read the notice for their own review"
  ON public.cie33_safety_reviews
  FOR SELECT
  TO authenticated
  USING (patient_user_id = auth.uid());

ALTER VIEW public.cie33_safety_review_notices SET (security_invoker = on);