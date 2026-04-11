
-- Function to auto-increment CIE assessment version per user
CREATE OR REPLACE FUNCTION public.next_cie_version(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_v INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_v
  FROM public.cie_assessments
  WHERE user_id = p_user_id;
  RETURN next_v;
END;
$$;

-- 1. cie_assessments
CREATE TABLE public.cie_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress',
  layer1_completed_at timestamptz,
  layer2_completed_at timestamptz,
  full_completed_at timestamptz,
  total_questions_answered integer NOT NULL DEFAULT 0,
  triggered_domains text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cie_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own assessments" ON public.cie_assessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assessments" ON public.cie_assessments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assessments" ON public.cie_assessments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assessments" ON public.cie_assessments FOR DELETE USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_cie_assessment_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_cie_assessments_updated_at
BEFORE UPDATE ON public.cie_assessments
FOR EACH ROW EXECUTE FUNCTION public.update_cie_assessment_timestamp();

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_cie_assessment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('in_progress', 'layer1_complete', 'complete', 'abandoned') THEN
    RAISE EXCEPTION 'cie_assessments.status must be one of: in_progress, layer1_complete, complete, abandoned';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_cie_assessment_status_trigger
BEFORE INSERT OR UPDATE ON public.cie_assessments
FOR EACH ROW EXECUTE FUNCTION public.validate_cie_assessment_status();

-- 2. cie_responses
CREATE TABLE public.cie_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES public.cie_assessments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question_id text NOT NULL,
  domain_id text NOT NULL,
  layer integer NOT NULL,
  question_type text NOT NULL,
  raw_response text NOT NULL,
  score numeric NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, question_id)
);

ALTER TABLE public.cie_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own responses" ON public.cie_responses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own responses" ON public.cie_responses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own responses" ON public.cie_responses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own responses" ON public.cie_responses FOR DELETE USING (auth.uid() = user_id);

-- 3. cie_domain_scores
CREATE TABLE public.cie_domain_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES public.cie_assessments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  domain_id text NOT NULL,
  axis text NOT NULL,
  layer1_score numeric NOT NULL DEFAULT 50,
  layer2_score numeric,
  final_score numeric NOT NULL DEFAULT 50,
  triggered_layer2 boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, domain_id)
);

ALTER TABLE public.cie_domain_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own domain scores" ON public.cie_domain_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own domain scores" ON public.cie_domain_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own domain scores" ON public.cie_domain_scores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own domain scores" ON public.cie_domain_scores FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can upsert domain scores" ON public.cie_domain_scores FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update domain scores" ON public.cie_domain_scores FOR UPDATE TO service_role USING (true);

-- 4. cie_gate_scores
CREATE TABLE public.cie_gate_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES public.cie_assessments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  gate_id text NOT NULL,
  gate_name text NOT NULL,
  score numeric NOT NULL DEFAULT 50,
  traffic_light text NOT NULL DEFAULT 'YELLOW',
  contributing_domains text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, gate_id)
);

ALTER TABLE public.cie_gate_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own gate scores" ON public.cie_gate_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gate scores" ON public.cie_gate_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gate scores" ON public.cie_gate_scores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gate scores" ON public.cie_gate_scores FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can upsert gate scores" ON public.cie_gate_scores FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update gate scores" ON public.cie_gate_scores FOR UPDATE TO service_role USING (true);

-- Indexes
CREATE INDEX idx_cie_responses_assessment ON public.cie_responses(assessment_id);
CREATE INDEX idx_cie_domain_scores_assessment ON public.cie_domain_scores(assessment_id);
CREATE INDEX idx_cie_gate_scores_assessment ON public.cie_gate_scores(assessment_id);
CREATE INDEX idx_cie_assessments_user ON public.cie_assessments(user_id);
