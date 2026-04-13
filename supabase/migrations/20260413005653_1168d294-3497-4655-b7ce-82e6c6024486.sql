
-- Add latency and instinct-preservation columns to cie_responses
ALTER TABLE public.cie_responses
  ADD COLUMN IF NOT EXISTS response_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS t1_answer TEXT,
  ADD COLUMN IF NOT EXISTS t1_latency_ms INTEGER;

-- Reconsideration events: first-class diagnostic data
CREATE TABLE IF NOT EXISTS public.reconsideration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cie_assessments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question_id text NOT NULL,
  domain_id text NOT NULL,
  t1_answer text NOT NULL,
  t2_answer text,
  t1_latency_ms integer NOT NULL,
  t2_latency_ms integer,
  delta_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Use a validation trigger instead of CHECK constraint for delta_type
CREATE OR REPLACE FUNCTION public.validate_reconsideration_delta_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delta_type IS NOT NULL AND NEW.delta_type NOT IN ('softened','hardened','flipped','same') THEN
    RAISE EXCEPTION 'delta_type must be one of: softened, hardened, flipped, same';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_reconsideration_delta_type_trigger
  BEFORE INSERT OR UPDATE ON public.reconsideration_events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_reconsideration_delta_type();

CREATE INDEX IF NOT EXISTS idx_reconsideration_events_assessment
  ON public.reconsideration_events(assessment_id);

-- Enable RLS
ALTER TABLE public.reconsideration_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own reconsideration events"
  ON public.reconsideration_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reconsideration events"
  ON public.reconsideration_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reconsideration events"
  ON public.reconsideration_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reconsideration events"
  ON public.reconsideration_events FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all reconsideration events"
  ON public.reconsideration_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
