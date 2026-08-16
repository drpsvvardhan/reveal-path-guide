-- 1. Legacy ownerless rows in food_logs / voice_notes
DELETE FROM public.food_logs WHERE user_id IS NULL;
DELETE FROM public.voice_notes WHERE user_id IS NULL;

ALTER TABLE public.food_logs
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN patient_id DROP DEFAULT;

ALTER TABLE public.voice_notes
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN patient_id DROP DEFAULT;

-- 2. Over-broad storage read policy on lab-uploads.
-- service_role bypasses RLS, so this policy grants nothing it needs
-- while exposing every lab file to anon/authenticated sessions.
DROP POLICY IF EXISTS "Service role can read any lab file" ON storage.objects;

-- 3. Owner-scoped update/delete for simulator logs
CREATE POLICY sdo_own_update ON public.simulator_daily_observations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY sdo_own_delete ON public.simulator_daily_observations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);