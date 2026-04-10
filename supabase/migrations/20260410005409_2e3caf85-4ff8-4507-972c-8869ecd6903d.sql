
CREATE TABLE public.patient_narratives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  version INTEGER NOT NULL,
  narrative JSONB NOT NULL,
  model_used TEXT NOT NULL,
  generation_ms INTEGER,
  input_pattern_count INTEGER,
  input_biomarker_count INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  validation_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_version_per_user UNIQUE (user_id, version)
);

-- Indexes
CREATE INDEX idx_pn_user_status ON public.patient_narratives (user_id, status);
CREATE INDEX idx_pn_user_created ON public.patient_narratives (user_id, created_at DESC);

-- Row Level Security
ALTER TABLE public.patient_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own narratives"
  ON public.patient_narratives FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own narratives"
  ON public.patient_narratives FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert narratives"
  ON public.patient_narratives FOR INSERT
  WITH CHECK (true);

-- Trigger to supersede previous active narrative
CREATE OR REPLACE FUNCTION public.supersede_previous_active_narrative()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.patient_narratives
    SET status = 'superseded'
    WHERE user_id = NEW.user_id
      AND status = 'active'
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supersede_on_active_insert
  AFTER INSERT ON public.patient_narratives
  FOR EACH ROW
  EXECUTE FUNCTION public.supersede_previous_active_narrative();

-- Atomic version number function
CREATE OR REPLACE FUNCTION public.next_narrative_version(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_v INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_v
  FROM public.patient_narratives
  WHERE user_id = p_user_id;
  RETURN next_v;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
