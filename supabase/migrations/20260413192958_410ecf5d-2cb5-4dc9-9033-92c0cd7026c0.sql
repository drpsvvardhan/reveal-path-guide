
-- PART 1: ENUMS
CREATE TYPE public.cluster_confidence_tier AS ENUM ('emerging', 'tentative', 'developing', 'supported', 'robust');
CREATE TYPE public.cluster_evidence_direction AS ENUM ('convergent', 'divergent', 'neutral');
CREATE TYPE public.cluster_evidence_layer AS ENUM ('cie', 'lab', 'inbody', 'emr', 'medication', 'sensor', 'food_log', 'imaging', 'omics', 'narrative');

-- PART 2: clusters TABLE
CREATE TABLE public.clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cluster_kind text NOT NULL,
  claim text NOT NULL,
  constituent_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  coherence_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  tensions_held jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_score numeric NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  confidence_tier public.cluster_confidence_tier NOT NULL DEFAULT 'emerging',
  confidence_dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_intervention_ids text[] NOT NULL DEFAULT '{}'::text[],
  linked_surfaces jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived')),
  generation_run_id uuid,
  notes text
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_clusters_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clusters_updated_at
  BEFORE UPDATE ON public.clusters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_clusters_updated_at();

-- PART 3: cluster_evidence JOIN TABLE
CREATE TABLE public.cluster_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  evidence_kind text NOT NULL,
  evidence_id text NOT NULL,
  layer_type public.cluster_evidence_layer NOT NULL,
  direction public.cluster_evidence_direction NOT NULL DEFAULT 'convergent',
  weight numeric NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
  time_point timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PART 4: INDEXES
CREATE INDEX clusters_patient_status_updated_idx ON public.clusters (patient_id, status, updated_at DESC);
CREATE INDEX clusters_patient_tier_idx ON public.clusters (patient_id, confidence_tier);
CREATE INDEX clusters_patient_kind_idx ON public.clusters (patient_id, cluster_kind);
CREATE INDEX cluster_evidence_cluster_idx ON public.cluster_evidence (cluster_id);
CREATE INDEX cluster_evidence_cluster_layer_idx ON public.cluster_evidence (cluster_id, layer_type);
CREATE INDEX cluster_evidence_reverse_idx ON public.cluster_evidence (evidence_kind, evidence_id);

-- PART 5: ROW LEVEL SECURITY
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_evidence ENABLE ROW LEVEL SECURITY;

-- clusters policies
CREATE POLICY "Patients can read their own clusters"
  ON public.clusters FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Service role can insert clusters"
  ON public.clusters FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update clusters"
  ON public.clusters FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can delete clusters"
  ON public.clusters FOR DELETE TO service_role
  USING (true);

-- cluster_evidence policies
CREATE POLICY "Patients can read evidence for their own clusters"
  ON public.cluster_evidence FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clusters
    WHERE clusters.id = cluster_evidence.cluster_id
      AND clusters.patient_id = auth.uid()
  ));

CREATE POLICY "Service role can insert cluster evidence"
  ON public.cluster_evidence FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update cluster evidence"
  ON public.cluster_evidence FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can delete cluster evidence"
  ON public.cluster_evidence FOR DELETE TO service_role
  USING (true);
