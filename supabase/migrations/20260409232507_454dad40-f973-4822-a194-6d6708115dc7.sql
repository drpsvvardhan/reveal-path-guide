
-- Step 1: Add share_token to profiles FIRST
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid() UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_share_token ON public.profiles (share_token);

-- Step 2: Create the question queue table
CREATE TABLE public.patient_question_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  rationale TEXT,
  source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'archived')),
  priority INTEGER NOT NULL DEFAULT 0,
  source_user_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_pqq_user_status ON public.patient_question_queue (user_id, status);
CREATE INDEX idx_pqq_user_priority ON public.patient_question_queue (user_id, priority);
CREATE INDEX idx_pqq_created ON public.patient_question_queue (created_at DESC);

ALTER TABLE public.patient_question_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own questions"
  ON public.patient_question_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own questions"
  ON public.patient_question_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own questions"
  ON public.patient_question_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own questions"
  ON public.patient_question_queue FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert questions"
  ON public.patient_question_queue FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Public can read queued questions via share token"
  ON public.patient_question_queue FOR SELECT
  TO anon, authenticated
  USING (
    status = 'queued'
    AND user_id IN (
      SELECT p.user_id FROM public.profiles p WHERE p.share_token IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION public.update_question_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER question_queue_updated_at
  BEFORE UPDATE ON public.patient_question_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_question_queue_timestamp();
