-- ============================================================================
-- Fix: rae_persist_initial_admission must satisfy caw_state_witness_consistency
-- on the initial INSERT.
--
-- Previous version inserted the CAW row with produced_witness_id = NULL while
-- current_state = 'auto_admitted', which immediately violates the CHECK
-- constraint caw_state_witness_consistency. CHECK constraints in Postgres are
-- not deferrable, so the only correct fix is to reorder writes:
--
--   1. If intent = 'produce_depth0_witness': insert witness FIRST, then CAW
--      with produced_witness_id already populated.
--   2. Otherwise: insert CAW with produced_witness_id = NULL (states
--      needs_review / rejected, which the constraint allows).
--
-- No schema, RLS, or constraint changes. No behavior change for calibration
-- or rejected paths. Idempotency probe and back-annotation hard verification
-- are preserved verbatim.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rae_persist_initial_admission(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caw            jsonb;
  v_intent         text;
  v_reason         text;
  v_policy         text;
  v_from_state     text;
  v_to_state       text;
  v_actor_kind     text;
  v_actor_id       text;
  v_caw_id         uuid;
  v_existing       public.concept_assignment_witnesses%ROWTYPE;
  v_inserted       public.concept_assignment_witnesses%ROWTYPE;
  v_witness_id     uuid;
  v_witness_payload jsonb;
  v_ba_witness_id  uuid;
  v_ba_user_id     uuid;
  v_ba_src_table   text;
  v_ba_src_row     uuid;
  v_payload_user   uuid;
  v_payload_src_t  text;
  v_payload_src_r  uuid;
  v_payload_concept text;
  v_limitations    text[];
  v_founder_flag   boolean;
BEGIN
  IF p_payload IS NULL THEN
    RAISE EXCEPTION 'rae_persist_initial_admission: p_payload is null'
      USING ERRCODE = '22023';
  END IF;

  v_caw     := p_payload->'caw';
  v_intent  := NULLIF(p_payload->>'witness_intent','');
  v_reason  := p_payload->>'reason';
  v_policy  := COALESCE(p_payload->>'policy', 'default');
  v_from_state := NULLIF(p_payload->>'from_state','');
  v_to_state   := p_payload->>'to_state';
  v_actor_kind := p_payload->>'actor_kind';
  v_actor_id   := p_payload->>'actor_id';
  v_witness_payload := p_payload->'witness_payload';
  v_ba_witness_id   := NULLIF(p_payload->>'back_annotation_existing_witness_id','')::uuid;

  IF v_caw IS NULL THEN
    RAISE EXCEPTION 'rae_persist_initial_admission: caw missing from payload'
      USING ERRCODE = '22023';
  END IF;

  v_caw_id := NULLIF(v_caw->>'caw_id','')::uuid;
  IF v_caw_id IS NULL THEN
    RAISE EXCEPTION 'rae_persist_initial_admission: caw.caw_id missing'
      USING ERRCODE = '22023';
  END IF;

  IF v_to_state IS NULL OR v_actor_kind IS NULL OR v_actor_id IS NULL OR v_reason IS NULL THEN
    RAISE EXCEPTION 'rae_persist_initial_admission: missing transition fields (to_state/actor_kind/actor_id/reason)'
      USING ERRCODE = '22023';
  END IF;

  -- Idempotency probe.
  SELECT * INTO v_existing
    FROM public.concept_assignment_witnesses
   WHERE caw_id = v_caw_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'mode', 'existing',
      'caw',  to_jsonb(v_existing),
      'witness_id', v_existing.produced_witness_id
    );
  END IF;

  -- Back-annotation hard verification (before any writes).
  v_payload_user    := (v_caw->>'user_id')::uuid;
  v_payload_src_t   := v_caw->>'source_table';
  v_payload_src_r   := NULLIF(v_caw->>'source_row_id','')::uuid;
  v_payload_concept := v_caw->>'candidate_concept_id';
  v_limitations := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(v_caw->'limitations')),
    ARRAY[]::text[]
  );
  v_founder_flag := COALESCE((v_caw->>'founder_review_flag')::boolean, false);

  IF v_policy = 'back_annotation' THEN
    IF v_ba_witness_id IS NULL THEN
      RAISE EXCEPTION 'rae_persist_initial_admission: back_annotation requires back_annotation_existing_witness_id'
        USING ERRCODE = '22023';
    END IF;

    SELECT wo.user_id, wo.source_table, wo.source_row_id
      INTO v_ba_user_id, v_ba_src_table, v_ba_src_row
      FROM public.witness_objects wo
     WHERE wo.witness_id = v_ba_witness_id
     LIMIT 1;

    IF v_ba_user_id IS NULL THEN
      RAISE EXCEPTION
        'rae_persist_initial_admission: back_annotation witness % not found',
        v_ba_witness_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_ba_user_id <> v_payload_user
       OR v_ba_src_table IS DISTINCT FROM v_payload_src_t
       OR v_ba_src_row   IS DISTINCT FROM v_payload_src_r
    THEN
      RAISE EXCEPTION
        'rae_persist_initial_admission: back_annotation tuple mismatch (user/source_table/source_row_id)'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Produce depth-0 witness FIRST when intended, so the CAW row can be
  -- inserted with produced_witness_id already populated and satisfy
  -- caw_state_witness_consistency on the initial INSERT.
  v_witness_id := NULL;
  IF v_intent = 'produce_depth0_witness' THEN
    IF v_witness_payload IS NULL THEN
      RAISE EXCEPTION 'rae_persist_initial_admission: produce_depth0_witness requires witness_payload'
        USING ERRCODE = '22023';
    END IF;

    v_witness_id := public.rae_insert_witness_object(v_witness_payload);
  END IF;

  -- Insert CAW row with produced_witness_id already set (or NULL for
  -- needs_review / rejected paths).
  INSERT INTO public.concept_assignment_witnesses (
    caw_id,
    user_id,
    source_table,
    source_row_id,
    candidate_concept_id,
    ontology_version,
    registry_seed_version,
    engine_version_id,
    signal_results,
    composite_identity_score,
    coherence_result,
    confidence_value,
    confidence_basis,
    current_state,
    current_state_entered_at,
    current_state_actor_kind,
    current_state_actor_id,
    policy_at_decision,
    founder_review_flag,
    limitations,
    produced_witness_id
  )
  VALUES (
    v_caw_id,
    v_payload_user,
    v_payload_src_t,
    v_payload_src_r,
    v_payload_concept,
    v_caw->>'ontology_version',
    v_caw->>'registry_seed_version',
    NULLIF(v_caw->>'engine_version_id','')::uuid,
    COALESCE(v_caw->'signal_results', '{}'::jsonb),
    NULLIF(v_caw->>'composite_identity_score','')::numeric,
    v_caw->>'coherence_result',
    NULLIF(v_caw->>'confidence_value','')::numeric,
    v_caw->>'confidence_basis',
    (v_caw->>'current_state')::public.rae_admission_state,
    COALESCE(NULLIF(v_caw->>'current_state_entered_at','')::timestamptz, now()),
    v_actor_kind,
    v_actor_id,
    v_policy,
    v_founder_flag,
    v_limitations,
    v_witness_id
  )
  RETURNING * INTO v_inserted;

  -- Insert exactly one initial transition row.
  INSERT INTO public.rae_state_transitions (
    caw_id,
    from_state,
    to_state,
    actor_kind,
    actor_id,
    reason,
    policy
  )
  VALUES (
    v_caw_id,
    v_from_state::public.rae_admission_state,
    v_to_state::public.rae_admission_state,
    v_actor_kind,
    v_actor_id,
    v_reason,
    v_policy
  );

  RETURN jsonb_build_object(
    'mode',       'created',
    'caw',        to_jsonb(v_inserted),
    'witness_id', v_witness_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rae_persist_initial_admission(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rae_persist_initial_admission(jsonb) TO service_role;

COMMENT ON FUNCTION public.rae_persist_initial_admission(jsonb) IS
  'RAE single-transaction admission persistence. Idempotent on caw_id. When witness_intent = produce_depth0_witness, the depth-0 witness is inserted FIRST and the CAW row is then inserted with produced_witness_id already populated to satisfy caw_state_witness_consistency on the initial INSERT. Inserts exactly one initial state transition. Back-annotation hard-verifies (user_id, source_table, source_row_id) against witness_objects directly (no CAW join).';