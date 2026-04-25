-- RAE: engine versions and per-concept lift overrides.
-- Holds engine version metadata. CAW rows fk into this; old CAWs remain
-- auditable under their original engine. calibration_mode gates routing
-- per OQ-4. Per-concept lift override lives in rae_engine_concept_overrides.

CREATE OR REPLACE FUNCTION public.rae_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.rae_engine_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semver text NOT NULL,
  registry_seed_version text NOT NULL,
  ontology_version text NOT NULL,
  threshold_admission numeric NOT NULL,
  threshold_rejection_floor numeric NOT NULL,
  calibration_mode boolean NOT NULL DEFAULT true,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rae_engine_versions_semver_unique UNIQUE (semver),
  CONSTRAINT rae_engine_versions_threshold_admission_range
    CHECK (threshold_admission >= 0 AND threshold_admission <= 1),
  CONSTRAINT rae_engine_versions_threshold_floor_range
    CHECK (threshold_rejection_floor >= 0 AND threshold_rejection_floor <= 1),
  CONSTRAINT rae_engine_versions_threshold_order
    CHECK (threshold_rejection_floor <= threshold_admission)
);

CREATE TABLE public.rae_engine_concept_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_version_id uuid NOT NULL REFERENCES public.rae_engine_versions(id) ON DELETE CASCADE,
  candidate_concept_id text NOT NULL,
  lifted boolean NOT NULL DEFAULT false,
  lifted_at timestamptz,
  lifted_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rae_engine_concept_overrides_unique
    UNIQUE (engine_version_id, candidate_concept_id),
  CONSTRAINT rae_engine_concept_overrides_lifted_consistent
    CHECK ((lifted = false AND lifted_at IS NULL AND lifted_by IS NULL)
           OR (lifted = true AND lifted_at IS NOT NULL AND lifted_by IS NOT NULL))
);

CREATE INDEX idx_rae_engine_concept_overrides_engine
  ON public.rae_engine_concept_overrides (engine_version_id);

ALTER TABLE public.rae_engine_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rae_engine_concept_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rae_engine_versions_read_all_authenticated"
  ON public.rae_engine_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rae_engine_versions_admin_all"
  ON public.rae_engine_versions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "rae_engine_versions_service_role_all"
  ON public.rae_engine_versions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "rae_engine_concept_overrides_read_all_authenticated"
  ON public.rae_engine_concept_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "rae_engine_concept_overrides_admin_all"
  ON public.rae_engine_concept_overrides FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "rae_engine_concept_overrides_service_role_all"
  ON public.rae_engine_concept_overrides FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_rae_engine_versions_updated_at
  BEFORE UPDATE ON public.rae_engine_versions
  FOR EACH ROW EXECUTE FUNCTION public.rae_touch_updated_at();
CREATE TRIGGER trg_rae_engine_concept_overrides_updated_at
  BEFORE UPDATE ON public.rae_engine_concept_overrides
  FOR EACH ROW EXECUTE FUNCTION public.rae_touch_updated_at();

COMMENT ON TABLE public.rae_engine_versions IS
  'RAE engine version metadata. CAWs fk here so historical CAWs remain re-evaluable. calibration_mode=true routes every would-be auto_admit to needs_review per OQ-4.';
COMMENT ON TABLE public.rae_engine_concept_overrides IS
  'Per-concept lift override (OQ-4). When lifted=true for (engine_version_id, candidate_concept_id), the orchestrator may auto_admit for that concept.';