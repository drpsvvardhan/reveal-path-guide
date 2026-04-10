
CREATE TABLE public.derived_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_id TEXT NOT NULL,
  rule_version INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL CHECK (category IN ('trend', 'threshold', 'contradiction', 'correlation', 'watchlist')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'moderate', 'informational')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_question_id UUID REFERENCES public.patient_question_queue(id) ON DELETE SET NULL,
  first_detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  dismissed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_active_pattern_per_rule UNIQUE (user_id, rule_id, status)
);

CREATE INDEX idx_dp_user_status ON public.derived_patterns (user_id, status);
CREATE INDEX idx_dp_user_severity ON public.derived_patterns (user_id, severity);
CREATE INDEX idx_dp_category ON public.derived_patterns (category);
CREATE INDEX idx_dp_last_confirmed ON public.derived_patterns (last_confirmed_at DESC);

ALTER TABLE public.derived_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own patterns"
  ON public.derived_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns"
  ON public.derived_patterns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patterns"
  ON public.derived_patterns FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert patterns"
  ON public.derived_patterns FOR INSERT
  WITH CHECK (true);

ALTER TABLE public.patient_question_queue
  DROP CONSTRAINT IF EXISTS patient_question_queue_source_check;

ALTER TABLE public.patient_question_queue
  ADD CONSTRAINT patient_question_queue_source_check
  CHECK (source IN ('auto', 'manual', 'derived'));
