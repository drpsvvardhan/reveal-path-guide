-- ============================================================================
-- P1a — WITNESS LAYER SCHEMA
-- ============================================================================

-- ENUMS
CREATE TYPE public.witness_source_window AS ENUM (
  'cie','lab','inbody','fibroscan','sensor','wearable','omics','imaging',
  'medication','emr','history','narrative'
);

CREATE TYPE public.witness_domain_of_access AS ENUM (
  'embodied_perception','symptom_continuity','biochemical_state_snapshot',
  'biochemical_state_dynamic','body_composition','hepatic_mechanical_state',
  'temporal_physiology','protein_abundance','gene_expression','genomic_variant',
  'metabolic_flux','microbial_ecology','lipid_composition','structural_anatomy',
  'clinical_compression','intervention_layer','environmental_exposure',
  'psychosocial_context'
);

CREATE TYPE public.witness_epistemic_role AS ENUM (
  'direct_measure','self_report','dynamic_sensor','derived_score',
  'compressed_label','intervention_context','historical_event'
);

CREATE TYPE public.witness_reliability_class AS ENUM (
  'high','medium','low','unknown'
);


-- ============================================================================
-- TABLE: witness_signal_registry
-- ============================================================================
CREATE TABLE public.witness_signal_registry (
  source_window public.witness_source_window NOT NULL,
  signal TEXT NOT NULL,
  domain_of_access public.witness_domain_of_access NOT NULL,
  epistemic_role public.witness_epistemic_role NOT NULL,
  reliability_class public.witness_reliability_class NOT NULL,
  label TEXT NOT NULL,
  unit TEXT,
  description TEXT,
  default_limitations TEXT[] NOT NULL,
  default_confidence_basis TEXT NOT NULL,
  default_confidence_value NUMERIC(4, 3) NOT NULL,
  default_validity_window_seconds BIGINT,
  compression_depth SMALLINT NOT NULL,
  ontology_version TEXT,
  ontology_concept_id TEXT,
  registry_seed_version TEXT NOT NULL DEFAULT 'p1a_initial',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (source_window, signal),
  CONSTRAINT witness_signal_registry_limitations_nonempty
    CHECK (array_length(default_limitations, 1) >= 1),
  CONSTRAINT witness_signal_registry_confidence_basis_meaningful
    CHECK (char_length(default_confidence_basis) >= 20),
  CONSTRAINT witness_signal_registry_confidence_value_range
    CHECK (default_confidence_value >= 0 AND default_confidence_value <= 1),
  CONSTRAINT witness_signal_registry_compression_depth_range
    CHECK (compression_depth BETWEEN 0 AND 2),
  CONSTRAINT witness_signal_registry_depth_role_consistency
    CHECK (
      (compression_depth = 0 AND epistemic_role IN (
        'direct_measure', 'self_report', 'dynamic_sensor',
        'intervention_context', 'historical_event'
      ))
      OR
      (compression_depth = 1 AND epistemic_role = 'derived_score')
      OR
      (compression_depth = 2 AND epistemic_role = 'compressed_label')
    ),
  CONSTRAINT witness_signal_registry_no_clinical_compression_in_p1a
    CHECK (domain_of_access != 'clinical_compression')
);

CREATE INDEX idx_wsr_source_window ON public.witness_signal_registry (source_window);
CREATE INDEX idx_wsr_domain ON public.witness_signal_registry (domain_of_access);
CREATE INDEX idx_wsr_epistemic ON public.witness_signal_registry (epistemic_role);

ALTER TABLE public.witness_signal_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read witness registry"
  ON public.witness_signal_registry FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages witness registry"
  ON public.witness_signal_registry FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);


-- ============================================================================
-- TABLE: observation_packets
-- ============================================================================
CREATE TABLE public.observation_packets (
  packet_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_window public.witness_source_window NOT NULL,
  signal TEXT NOT NULL,
  value JSONB NOT NULL,
  unit TEXT,
  biological_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  system_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source_id TEXT,
  source_operator TEXT,
  source_method TEXT,
  source_table TEXT,
  source_row_id UUID,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_user ON public.observation_packets (user_id);
CREATE INDEX idx_op_source ON public.observation_packets (source_window, signal);
CREATE INDEX idx_op_biological_time ON public.observation_packets (user_id, biological_timestamp DESC);
CREATE INDEX idx_op_source_row ON public.observation_packets (source_table, source_row_id)
  WHERE source_table IS NOT NULL;

ALTER TABLE public.observation_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own observation packets"
  ON public.observation_packets FOR SELECT TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on observation packets"
  ON public.observation_packets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read all observation packets"
  ON public.observation_packets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));


-- ============================================================================
-- TABLE: witness_objects
-- ============================================================================
CREATE TABLE public.witness_objects (
  witness_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  derived_from_packet_id UUID REFERENCES public.observation_packets(packet_id)
    ON DELETE CASCADE,
  source_table TEXT,
  source_row_id UUID,
  ancestry_witness_ids UUID[],
  source_window public.witness_source_window NOT NULL,
  signal TEXT NOT NULL,
  domain_of_access public.witness_domain_of_access NOT NULL,
  epistemic_role public.witness_epistemic_role NOT NULL,
  reliability_class public.witness_reliability_class NOT NULL,
  compression_depth SMALLINT NOT NULL,
  observed_value JSONB NOT NULL,
  observed_unit TEXT,
  testimony TEXT NOT NULL,
  limitations TEXT[] NOT NULL,
  confidence_value NUMERIC(4, 3) NOT NULL,
  confidence_basis TEXT NOT NULL,
  biological_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  validity_window_seconds BIGINT,
  conflict_candidates UUID[],
  transformation_version TEXT NOT NULL,
  registry_seed_version TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT witness_objects_has_source
    CHECK (
      derived_from_packet_id IS NOT NULL
      OR (source_table IS NOT NULL AND source_row_id IS NOT NULL)
    ),
  CONSTRAINT witness_objects_limitations_nonempty
    CHECK (array_length(limitations, 1) >= 1),
  CONSTRAINT witness_objects_confidence_basis_meaningful
    CHECK (char_length(confidence_basis) >= 20),
  CONSTRAINT witness_objects_confidence_value_range
    CHECK (confidence_value >= 0 AND confidence_value <= 1),
  CONSTRAINT witness_objects_testimony_not_trivial
    CHECK (char_length(testimony) >= 20),
  CONSTRAINT witness_objects_compression_depth_range
    CHECK (compression_depth BETWEEN 0 AND 2),
  CONSTRAINT witness_objects_depth_role_consistency
    CHECK (
      (compression_depth = 0 AND epistemic_role IN (
        'direct_measure', 'self_report', 'dynamic_sensor',
        'intervention_context', 'historical_event'
      ))
      OR
      (compression_depth = 1 AND epistemic_role = 'derived_score')
      OR
      (compression_depth = 2 AND epistemic_role = 'compressed_label')
    ),
  CONSTRAINT witness_objects_ancestry_depth_consistency
    CHECK (
      (compression_depth = 0
        AND (ancestry_witness_ids IS NULL OR array_length(ancestry_witness_ids, 1) = 0))
      OR
      (compression_depth > 0
        AND ancestry_witness_ids IS NOT NULL
        AND array_length(ancestry_witness_ids, 1) >= 1)
    ),
  CONSTRAINT witness_objects_no_clinical_compression_in_p1a
    CHECK (domain_of_access != 'clinical_compression'),
  FOREIGN KEY (source_window, signal)
    REFERENCES public.witness_signal_registry (source_window, signal)
    ON DELETE RESTRICT
);

CREATE INDEX idx_wo_user ON public.witness_objects (user_id);
CREATE INDEX idx_wo_user_signal ON public.witness_objects (user_id, source_window, signal);
CREATE INDEX idx_wo_user_biological_time ON public.witness_objects (user_id, biological_timestamp DESC);
CREATE INDEX idx_wo_source_row ON public.witness_objects (source_table, source_row_id)
  WHERE source_table IS NOT NULL;
CREATE INDEX idx_wo_user_domain ON public.witness_objects (user_id, domain_of_access);
CREATE INDEX idx_wo_user_epistemic ON public.witness_objects (user_id, epistemic_role);
CREATE INDEX idx_wo_user_depth ON public.witness_objects (user_id, compression_depth);
CREATE INDEX idx_wo_ancestry ON public.witness_objects USING GIN (ancestry_witness_ids);

ALTER TABLE public.witness_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own witness objects"
  ON public.witness_objects FOR SELECT TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on witness objects"
  ON public.witness_objects FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read all witness objects"
  ON public.witness_objects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));


-- ============================================================================
-- TRIGGER: ancestry integrity
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_witness_ancestry_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  foreign_count INTEGER;
BEGIN
  IF NEW.ancestry_witness_ids IS NULL OR array_length(NEW.ancestry_witness_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.witness_id = ANY(NEW.ancestry_witness_ids) THEN
    RAISE EXCEPTION 'witness_ancestry_self_reference: witness_id % cannot be its own ancestor', NEW.witness_id;
  END IF;

  SELECT COUNT(*) INTO foreign_count
  FROM public.witness_objects wo
  WHERE wo.witness_id = ANY(NEW.ancestry_witness_ids)
    AND wo.user_id != NEW.user_id;

  IF foreign_count > 0 THEN
    RAISE EXCEPTION 'witness_ancestry_cross_user: witness % ancestry contains % witnesses from other users',
      NEW.witness_id, foreign_count;
  END IF;

  SELECT COUNT(*) INTO foreign_count
  FROM unnest(NEW.ancestry_witness_ids) AS declared_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.witness_objects wo WHERE wo.witness_id = declared_id
  );

  IF foreign_count > 0 THEN
    RAISE EXCEPTION 'witness_ancestry_missing: witness % declares % ancestor(s) that do not exist',
      NEW.witness_id, foreign_count;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER witness_ancestry_integrity_trigger
  BEFORE INSERT OR UPDATE ON public.witness_objects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_witness_ancestry_integrity();


-- ============================================================================
-- TRIGGER: touch updated_at on witness_signal_registry
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_witness_registry_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER witness_registry_updated_at
  BEFORE UPDATE ON public.witness_signal_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_witness_registry_updated_at();


-- ============================================================================
-- VIEW: v_witness_coverage
-- ============================================================================
CREATE OR REPLACE VIEW public.v_witness_coverage AS
SELECT
  wo.user_id,
  wo.source_window,
  wo.domain_of_access,
  wo.epistemic_role,
  wo.compression_depth,
  wo.signal,
  COUNT(*) AS witness_count,
  MIN(wo.biological_timestamp) AS earliest_observation,
  MAX(wo.biological_timestamp) AS latest_observation,
  AVG(wo.confidence_value)::NUMERIC(4, 3) AS mean_confidence
FROM public.witness_objects wo
GROUP BY wo.user_id, wo.source_window, wo.domain_of_access,
         wo.epistemic_role, wo.compression_depth, wo.signal;

GRANT SELECT ON public.v_witness_coverage TO public;
GRANT SELECT ON public.v_witness_coverage TO authenticated;


-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.witness_signal_registry IS
  'P1a Witness Layer — constitutional contract for every signal that may enter the witness surface. Seeded from biomarker ontology + CIE seed data. Once seed INSERTs are committed in a migration, the registry SQL is the constitutional artifact for that version.';

COMMENT ON TABLE public.observation_packets IS
  'P1a Witness Layer — canonical pre-witness form. Sparsely used in P1a; retained for portability to FastAPI/Azure runtime. The witness boundary does not require that every raw row be materialized here; witnessify() may operate directly over raw tables and populate witness_objects with source_table/source_row_id traceability.';

COMMENT ON TABLE public.witness_objects IS
  'P1a Witness Layer — the sacred object. Scoped testimony. The only legal input to any inference-bearing module. Enforced by check constraints, triggers, and the boundaryValidator. Witnesses may be sources (direct_measure, self_report, historical_event) or compressions (derived_score, compressed_label) — compressions MUST declare ancestry to prevent double-counting across the compression stack.';

COMMENT ON COLUMN public.witness_objects.ancestry_witness_ids IS
  'Per-decision-A (19 Apr 2026): no double counting across the compression stack. Gate-score witnesses declare domain-score witness ancestry; domain-score witnesses declare response witness ancestry; direct-measure witnesses have no ancestry. Downstream confidence computation uses this to avoid treating a compression as independent support for its components. Ancestry existence is cross-enforced with compression_depth via check constraint: depth 0 forbids ancestry, depths 1 and 2 require it.';

COMMENT ON COLUMN public.witness_objects.compression_depth IS
  'Per-correction-3 (20 Apr 2026, CodexOS): explicit compression metadata so downstream reasoning does not have to infer depth from role + ancestry shape every time. 0 = source witness (responses, direct labs), 1 = first-level aggregate (CIE domain_scores), 2 = second-level aggregate (CIE gate_scores). Enforced-consistent with epistemic_role and with ancestry presence via check constraints.';

COMMENT ON COLUMN public.witness_objects.limitations IS
  'Explicit list of what this witness cannot see or adjudicate. Non-empty by check constraint. witnessify() starts from registry default_limitations and may extend with value-specific detail.';

COMMENT ON COLUMN public.witness_objects.confidence_value IS
  'Confidence in the testimony itself (not interpretive confidence). P1a stores one confidence field; future decomposition into testimony confidence vs implication confidence is a P1b or later concern.';