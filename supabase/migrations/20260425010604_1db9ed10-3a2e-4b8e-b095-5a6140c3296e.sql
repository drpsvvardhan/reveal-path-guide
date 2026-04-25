-- RAE Concept Assignment Witness (CAW): per-claim adjudication record.
-- See docs/RAE_IMPLEMENTATION_PLAN_v1.md §1.

CREATE TYPE public.rae_admission_state AS ENUM (
  'auto_admitted',
  'needs_review',
  'rejected',
  'human_confirmed'
);

CREATE TABLE public.concept_assignment_witnesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caw_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,

  source_table text NOT NULL,
  source_row_id uuid NOT NULL,

  candidate_concept_id text NOT NULL,
  ontology_version text NOT NULL,
  registry_seed_version text NOT NULL,
  engine_version_id uuid NOT NULL REFERENCES public.rae_engine_versions(id) ON DELETE RESTRICT,

  current_state public.rae_admission_state NOT NULL,
  current_state_entered_at timestamptz NOT NULL DEFAULT now(),
  current_state_actor_kind text NOT NULL,
  current_state_actor_id text NOT NULL,

  signal_results jsonb NOT NULL,
  composite_identity_score numeric NOT NULL,
  coherence_result text NOT NULL,
  confidence_value numeric NOT NULL,
  confidence_basis text NOT NULL,
  limitations text[] NOT NULL,

  produced_witness_id uuid
    REFERENCES public.witness_objects(witness_id) ON DELETE RESTRICT,

  policy_at_decision text NOT NULL DEFAULT 'default',
  founder_review_flag boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT caw_limitations_nonempty
    CHECK (array_length(limitations, 1) >= 1),
  CONSTRAINT caw_confidence_basis_meaningful
    CHECK (char_length(btrim(confidence_basis)) >= 20),
  CONSTRAINT caw_confidence_value_range
    CHECK (confidence_value >= 0 AND confidence_value <= 1),
  CONSTRAINT caw_state_witness_consistency
    CHECK (
      (current_state IN ('auto_admitted','human_confirmed') AND produced_witness_id IS NOT NULL)
      OR
      (current_state IN ('needs_review','rejected') AND produced_witness_id IS NULL)
    ),
  CONSTRAINT caw_actor_kind_valid
    CHECK (current_state_actor_kind IN ('engine','human')),
  CONSTRAINT caw_human_states_require_human_actor
    CHECK (
      current_state <> 'human_confirmed'
      OR current_state_actor_kind = 'human'
    ),
  CONSTRAINT caw_signal_results_seven
    CHECK (
      jsonb_typeof(signal_results) = 'array'
      AND jsonb_array_length(signal_results) = 7
    ),
  CONSTRAINT caw_coherence_result_valid
    CHECK (coherence_result IN ('pass','fail','partial','abstain')),
  CONSTRAINT caw_policy_at_decision_valid
    CHECK (policy_at_decision IN ('default','calibration_all_routes_to_review','back_annotation')),
  CONSTRAINT caw_back_annotation_requires_witness
    CHECK (
      policy_at_decision <> 'back_annotation'
      OR produced_witness_id IS NOT NULL
    ),
  CONSTRAINT caw_back_annotation_state_valid
    CHECK (
      policy_at_decision <> 'back_annotation'
      OR current_state IN ('auto_admitted','human_confirmed','rejected')
    )
);

CREATE INDEX idx_caw_user_id           ON public.concept_assignment_witnesses (user_id);
CREATE INDEX idx_caw_source            ON public.concept_assignment_witnesses (source_table, source_row_id);
CREATE INDEX idx_caw_candidate         ON public.concept_assignment_witnesses (candidate_concept_id);
CREATE INDEX idx_caw_engine_version    ON public.concept_assignment_witnesses (engine_version_id);
CREATE INDEX idx_caw_current_state     ON public.concept_assignment_witnesses (current_state);
CREATE INDEX idx_caw_produced_witness  ON public.concept_assignment_witnesses (produced_witness_id);
CREATE INDEX idx_caw_founder_review
  ON public.concept_assignment_witnesses (founder_review_flag)
  WHERE founder_review_flag = true;

-- Trigger: enforce no blank limitation entries (subqueries forbidden in CHECK).
CREATE OR REPLACE FUNCTION public.enforce_caw_limitations_no_blanks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_blank_count integer;
BEGIN
  SELECT count(*) INTO v_blank_count
  FROM unnest(NEW.limitations) AS l
  WHERE l IS NULL OR btrim(l) = '';

  IF v_blank_count > 0 THEN
    RAISE EXCEPTION 'caw_limitations_blank_entry: limitations array contains % blank or null entry/entries', v_blank_count;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_caw_limitations_no_blanks
  BEFORE INSERT OR UPDATE OF limitations
  ON public.concept_assignment_witnesses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_caw_limitations_no_blanks();

-- Ancestry integrity: produced_witness_id must belong to same user.
-- Mirrors enforce_witness_ancestry_integrity (P1a).
CREATE OR REPLACE FUNCTION public.enforce_caw_ancestry_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_witness_user uuid;
BEGIN
  IF NEW.produced_witness_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_witness_user
  FROM public.witness_objects
  WHERE witness_id = NEW.produced_witness_id;

  IF v_witness_user IS NULL THEN
    RAISE EXCEPTION 'caw_ancestry_missing: produced_witness_id % does not exist',
      NEW.produced_witness_id;
  END IF;

  IF v_witness_user <> NEW.user_id THEN
    RAISE EXCEPTION 'caw_ancestry_cross_user: caw user % cannot reference witness % owned by user %',
      NEW.user_id, NEW.produced_witness_id, v_witness_user;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_caw_ancestry_integrity
  BEFORE INSERT OR UPDATE OF produced_witness_id, user_id
  ON public.concept_assignment_witnesses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_caw_ancestry_integrity();

CREATE TRIGGER trg_caw_updated_at
  BEFORE UPDATE ON public.concept_assignment_witnesses
  FOR EACH ROW EXECUTE FUNCTION public.rae_touch_updated_at();

ALTER TABLE public.concept_assignment_witnesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caw_owner_read"
  ON public.concept_assignment_witnesses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "caw_admin_read"
  ON public.concept_assignment_witnesses FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "caw_admin_update"
  ON public.concept_assignment_witnesses FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "caw_service_role_all"
  ON public.concept_assignment_witnesses FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.concept_assignment_witnesses IS
  'RAE concept_assignment_witness table (plural). Append-mostly. caw_id is deterministic UUIDv5 over (user_id, source_table, source_row_id, candidate_concept_id, engine_version_id). produced_witness_id is a hard FK to witness_objects.witness_id with ON DELETE RESTRICT (OQ-2).';
COMMENT ON COLUMN public.concept_assignment_witnesses.policy_at_decision IS
  'OQ-6: back-annotation is policy_at_decision=back_annotation, never a fifth admission state.';
COMMENT ON COLUMN public.concept_assignment_witnesses.founder_review_flag IS
  'OQ-6: divergent back-annotations raise this flag without changing admission state.';