-- ============================================================================
-- RAE RPC layer: rae_insert_witness_object + rae_persist_initial_admission
-- Controlling design: docs/RAE_ADMIT_GATEWAY_WIRING_DESIGN_v1.md
-- Storage spec:       docs/RAE_STORAGE_PERSISTENCE_DESIGN_v1.md
--
-- Closed write set (enforced by these functions only writing here):
--   - public.concept_assignment_witnesses
--   - public.rae_state_transitions
--   - public.witness_objects   (via rae_insert_witness_object only)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) rae_insert_witness_object
-- ----------------------------------------------------------------------------
-- Mirrors the per-row shape of insertWitnessesBatched in
-- supabase/functions/witnessify-observations/index.ts.
-- Conflict key matches the existing unique index used by that path:
--   (user_id, source_table, source_row_id, registry_seed_version)
-- On conflict the existing row's witness_id is returned.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rae_insert_witness_object(p_witness jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_witness_id uuid;
BEGIN
  IF p_witness IS NULL THEN
    RAISE EXCEPTION 'rae_insert_witness_object: p_witness is null'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.witness_objects (
    witness_id,
    user_id,
    derived_from_packet_id,
    source_table,
    source_row_id,
    ancestry_witness_ids,
    source_window,
    signal,
    domain_of_access,
    epistemic_role,
    reliability_class,
    compression_depth,
    observed_value,
    observed_unit,
    testimony,
    limitations,
    confidence_value,
    confidence_basis,
    biological_timestamp,
    validity_window_seconds,
    conflict_candidates,
    transformation_version,
    registry_seed_version
  )
  VALUES (
    NULLIF(p_witness->>'witness_id','')::uuid,
    (p_witness->>'user_id')::uuid,
    NULLIF(p_witness->>'derived_from_packet_id','')::uuid,
    p_witness->>'source_table',
    p_witness->>'source_row_id',
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_witness->'ancestry_witness_ids')),
      ARRAY[]::text[]
    ),
    p_witness->>'source_window',
    p_witness->>'signal',
    p_witness->>'domain_of_access',
    p_witness->>'epistemic_role',
    p_witness->>'reliability_class',
    (p_witness->>'compression_depth')::int,
    p_witness->'observed_value',
    p_witness->>'observed_unit',
    p_witness->>'testimony',
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_witness->'limitations')),
      ARRAY[]::text[]
    ),
    NULLIF(p_witness->>'confidence_value','')::numeric,
    p_witness->>'confidence_basis',
    NULLIF(p_witness->>'biological_timestamp','')::timestamptz,
    NULLIF(p_witness->>'validity_window_seconds','')::int,
    COALESCE(p_witness->'conflict_candidates', '[]'::jsonb),
    p_witness->>'transformation_version',
    p_witness->>'registry_seed_version'
  )
  ON CONFLICT (user_id, source_table, source_row_id, registry_seed_version)
  DO NOTHING
  RETURNING witness_id
  INTO v_witness_id;

  IF v_witness_id IS NULL THEN
    SELECT wo.witness_id
      INTO v_witness_id
      FROM public.witness_objects wo
     WHERE wo.user_id = (p_witness->>'user_id')::uuid
       AND wo.source_table = p_witness->>'source_table'
       AND wo.source_row_id = p_witness->>'source_row_id'
       AND wo.registry_seed_version = p_witness->>'registry_seed_version';
  END IF;

  IF v_witness_id IS NULL THEN
    RAISE EXCEPTION
      'rae_insert_witness_object: witness not resolvable after insert (user=%, src=%/%, seed=%)',
      p_witness->>'user_id',
      p_witness->>'source_table',
      p_witness->>'source_row_id',
      p_witness->>'registry_seed_version'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_witness_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rae_insert_witness_object(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rae_insert_witness_object(jsonb) TO service_role;

COMMENT ON FUNCTION public.rae_insert_witness_object(jsonb) IS
  'RAE-only witness insert. Mirrors insertWitnessesBatched shape; ON CONFLICT DO NOTHING on (user_id, source_table, source_row_id, registry_seed_version); returns existing or newly inserted witness_id.';


-- ----------------------------------------------------------------------------
-- 2) rae_persist_initial_admission
-- ----------------------------------------------------------------------------
-- Single-transaction implementation of the storage layer's
-- persistInitialAdmission contract. The orchestrator/storage TS layer
-- has already computed every value (state machine logic stays in TS);
-- this function only persists what was decided.
--
-- p_payload shape (JSON):
--   {
--     "caw": { ...full ConceptAssignmentWitnessDraft, including caw_id... },
--     "witness_intent": "produce_depth0_witness" | "no_witness" | null,
--     "witness_payload": { ...rae_insert_witness_object payload... } | null,
--     "back_annotation_existing_witness_id": "<uuid>" | null,
--     "from_state": null | "<state>",
--     "to_state": "<state>",
--     "actor_kind": "engine" | "human",
--     "actor_id": "<text>",
--     "reason": "<text>",
--     "policy": "default" | "calibration" | "back_annotation"
--   }
-- ----------------------------------------------------------------------------

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
  v_ba_src_row     text;
  v_ba_concept_id  text;
  v_payload_user   uuid;
  v_payload_src_t  text;
  v_payload_src_r  text;
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

  -- Step 2: idempotency probe
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

  -- Step 6 (early): back-annotation hard verification before any writes.
  v_payload_user    := (v_caw->>'user_id')::uuid;
  v_payload_src_t   := v_caw->>'source_table';
  v_payload_src_r   := v_caw->>'source_row_id';
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

    SELECT wo.user_id, wo.source_table, wo.source_row_id::text,
           cw.candidate_concept_id
      INTO v_ba_user_id, v_ba_src_table, v_ba_src_row, v_ba_concept_id
      FROM public.witness_objects wo
      LEFT JOIN public.concept_assignment_witnesses cw
        ON cw.produced_witness_id = wo.witness_id
     WHERE wo.witness_id = v_ba_witness_id
     LIMIT 1;

    IF v_ba_user_id IS NULL THEN
      RAISE EXCEPTION
        'rae_persist_initial_admission: back_annotation witness % not found',
        v_ba_witness_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_ba_user_id <> v_payload_user
       OR v_ba_src_table <> v_payload_src_t
       OR v_ba_src_row <> v_payload_src_r
    THEN
      RAISE EXCEPTION
        'rae_persist_initial_admission: back_annotation tuple mismatch (user/source_table/source_row_id)'
        USING ERRCODE = 'P0001';
    END IF;

    -- Soft drift: ontology concept differs -> limitations + founder_review_flag
    IF v_ba_concept_id IS NOT NULL
       AND v_payload_concept IS NOT NULL
       AND v_ba_concept_id <> v_payload_concept
    THEN
      v_limitations := v_limitations || ARRAY[
        format(
          'back_annotation_concept_drift: existing witness concept=%s, new candidate=%s',
          v_ba_concept_id, v_payload_concept
        )
      ];
      v_founder_flag := true;
    END IF;
  END IF;

  -- Step 3: insert CAW row (produced_witness_id NULL; backfilled below)
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
    v_payload_src_r::uuid,
    v_payload_concept,
    v_caw->>'ontology_version',
    v_caw->>'registry_seed_version',
    NULLIF(v_caw->>'engine_version_id','')::uuid,
    COALESCE(v_caw->'signal_results', '{}'::jsonb),
    NULLIF(v_caw->>'composite_identity_score','')::numeric,
    v_caw->>'coherence_result',
    NULLIF(v_caw->>'confidence_value','')::numeric,
    v_caw->>'confidence_basis',
    (v_caw->>'current_state')::admission_state,
    COALESCE(NULLIF(v_caw->>'current_state_entered_at','')::timestamptz, now()),
    v_actor_kind,
    v_actor_id,
    v_policy,
    v_founder_flag,
    v_limitations,
    NULL
  )
  RETURNING * INTO v_inserted;

  -- Step 4: insert exactly one initial transition row.
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
    v_from_state::admission_state,
    v_to_state::admission_state,
    v_actor_kind,
    v_actor_id,
    v_reason,
    v_policy
  );

  -- Step 5: produce depth-0 witness if intended, then backfill link.
  v_witness_id := NULL;
  IF v_intent = 'produce_depth0_witness' THEN
    IF v_witness_payload IS NULL THEN
      RAISE EXCEPTION 'rae_persist_initial_admission: produce_depth0_witness requires witness_payload'
        USING ERRCODE = '22023';
    END IF;

    v_witness_id := public.rae_insert_witness_object(v_witness_payload);

    UPDATE public.concept_assignment_witnesses
       SET produced_witness_id = v_witness_id
     WHERE caw_id = v_caw_id
     RETURNING * INTO v_inserted;
  END IF;

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
  'RAE single-transaction admission persistence. Idempotent on caw_id. Inserts CAW + exactly one initial state transition; optionally inserts depth-0 witness via rae_insert_witness_object and backfills produced_witness_id. Back-annotation hard-verifies (user_id, source_table, source_row_id); concept drift becomes founder_review_flag + limitations entry.';
