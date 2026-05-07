CREATE TABLE public.patient_chat_validation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_role text NOT NULL DEFAULT 'assistant',
  status text NOT NULL CHECK (status IN ('passed', 'failed_with_warnings', 'replaced_with_fallback')),
  violations jsonb NOT NULL DEFAULT '[]'::jsonb,
  dose_patterns_matched text[] NOT NULL DEFAULT '{}',
  original_output text,
  replaced_with text,
  cluster_count integer,
  sentences_checked integer,
  last_user_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pcvl_user_created ON public.patient_chat_validation_log (user_id, created_at DESC);
CREATE INDEX idx_pcvl_status ON public.patient_chat_validation_log (status) WHERE status != 'passed';

ALTER TABLE public.patient_chat_validation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own validation log"
  ON public.patient_chat_validation_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all validation log"
  ON public.patient_chat_validation_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));