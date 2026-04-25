-- RAE signal configuration. Sibling of witness_signal_registry per OQ-3.
-- witness_signal_registry is intentionally NOT modified. RAE-specific
-- per-concept per-signal parameters live here.

CREATE TABLE public.rae_signal_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_version_id uuid NOT NULL REFERENCES public.rae_engine_versions(id) ON DELETE CASCADE,
  candidate_concept_id text NOT NULL,
  signal_id text NOT NULL,
  weight numeric NOT NULL DEFAULT 1.0,
  -- Discriminated parameter blob; shape varies per signal_id and is
  -- validated in the orchestrator (TypeScript), not the database, to
  -- preserve OQ-3 (sibling table, no per-signal column sprawl).
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rae_signal_config_signal_id_valid
    CHECK (signal_id IN ('lexical','unit','value','method','ref_range','panel','longitudinal')),
  CONSTRAINT rae_signal_config_weight_nonneg CHECK (weight >= 0),
  CONSTRAINT rae_signal_config_unique
    UNIQUE (engine_version_id, candidate_concept_id, signal_id)
);

CREATE INDEX idx_rae_signal_config_engine_concept
  ON public.rae_signal_config (engine_version_id, candidate_concept_id);

ALTER TABLE public.rae_signal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rae_signal_config_read_all_authenticated"
  ON public.rae_signal_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "rae_signal_config_admin_all"
  ON public.rae_signal_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rae_signal_config_service_role_all"
  ON public.rae_signal_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_rae_signal_config_updated_at
  BEFORE UPDATE ON public.rae_signal_config
  FOR EACH ROW EXECUTE FUNCTION public.rae_touch_updated_at();

COMMENT ON TABLE public.rae_signal_config IS
  'RAE per-concept per-signal parameters (OQ-3 sibling table). witness_signal_registry is unchanged. parameters jsonb shape is validated by the RAE orchestrator per signal_id.';