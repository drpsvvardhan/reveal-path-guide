-- ============================================================================
-- Patient Reveal — patient autonomy with server-held clinical authority
-- ----------------------------------------------------------------------------
-- STATUS: NOT APPLIED. This is the next ordered managed migration after 0004
-- (0005). It is held here deliberately: this project's migration tool applies
-- SQL in the same call that generates the journal entry and snapshot, and this
-- task is explicitly "no production apply before independent review". At
-- deployment time this exact file is passed to the migration tool byte-for-byte
-- so generation and application happen atomically, and the journal/snapshot
-- lineage continues from 0004 without a collision.
--
-- What it changes, and why:
--   Patients keep every read and every genuinely patient-owned action. What
--   they lose is the ability to write derived clinical fields directly: truth
--   status, clinical authority, holds, release/attestation, admission verdicts,
--   review requirements and phase transitions are written by the backend only.
--
--   Permission-only plus additive columns and service-only functions. No
--   table, column or row is dropped; no column type changes; no data is edited.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Remove every non-SELECT policy on the protected tables, plus ALL policies
--    on daily observations (old sdo_own_* included) so no leftover permissive
--    policy can OR its way past the parent-ownership rules added below.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  p record;
  protected text[] := ARRAY[
    'biotwin_reports',
    'biotwin_statements',
    'simulator_what_if_cards',
    'simulator_experiments',
    'simulator_experiment_protocols',
    'simulator_experiment_comparisons',
    'simulator_learnings',
    'simulator_checkpoints'
  ];
BEGIN
  FOR p IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = ANY(protected)
       AND cmd <> 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;

  FOR p IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'simulator_daily_observations'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 1. BioTwin governed records — owner reads stay, owner writes go.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.biotwin_reports FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.biotwin_statements FROM authenticated;
REVOKE ALL ON public.biotwin_reports FROM anon;
REVOKE ALL ON public.biotwin_statements FROM anon;
GRANT SELECT ON public.biotwin_reports TO authenticated;
GRANT SELECT ON public.biotwin_statements TO authenticated;
GRANT ALL ON public.biotwin_reports TO service_role;
GRANT ALL ON public.biotwin_statements TO service_role;

DROP POLICY IF EXISTS "Users read their own biotwin reports" ON public.biotwin_reports;
CREATE POLICY "Users read their own biotwin reports"
  ON public.biotwin_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read their own biotwin statements" ON public.biotwin_statements;
CREATE POLICY "Users read their own biotwin statements"
  ON public.biotwin_statements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Patient self-service submissions.
--    A file a patient uploads is their own evidence. It is preserved verbatim
--    with provenance, readable by them immediately, and it certifies nothing:
--    it cannot assert clinician attestation, confirmed clinical authority,
--    release permission or treatment approval, and it never supersedes a
--    trusted active report. Written by the backend after it has verified the
--    caller owns the record.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.biotwin_patient_submissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  version               integer NOT NULL DEFAULT 1,
  content_sha256        text NOT NULL,
  schema_name           text,
  report_type           text,
  submitted_filename    text,
  submitted_by          uuid,
  actor_kind            text NOT NULL DEFAULT 'patient_self_service',
  review_state          text NOT NULL DEFAULT 'received_unverified',
  authority_asserted_in_file boolean NOT NULL DEFAULT false,
  parsed_summary        jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnostics           jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_submission        jsonb NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT biotwin_patient_submissions_state_valid
    CHECK (review_state IN ('received_unverified', 'superseded', 'withdrawn', 'verified')),
  CONSTRAINT biotwin_patient_submissions_actor_valid
    CHECK (actor_kind IN ('patient_self_service', 'admin_on_behalf'))
);

CREATE UNIQUE INDEX IF NOT EXISTS biotwin_patient_submissions_user_content_uniq
  ON public.biotwin_patient_submissions (user_id, content_sha256);
CREATE INDEX IF NOT EXISTS biotwin_patient_submissions_user_idx
  ON public.biotwin_patient_submissions (user_id, created_at DESC);

-- Explicit, not inherited: reads only for clients, everything for the backend.
REVOKE ALL ON public.biotwin_patient_submissions FROM anon;
REVOKE ALL ON public.biotwin_patient_submissions FROM authenticated;
GRANT SELECT ON public.biotwin_patient_submissions TO authenticated;
GRANT ALL ON public.biotwin_patient_submissions TO service_role;

ALTER TABLE public.biotwin_patient_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own biotwin submissions" ON public.biotwin_patient_submissions;
CREATE POLICY "Users read their own biotwin submissions"
  ON public.biotwin_patient_submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read biotwin submissions" ON public.biotwin_patient_submissions;
CREATE POLICY "Admins read biotwin submissions"
  ON public.biotwin_patient_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read biotwin submissions under view-as" ON public.biotwin_patient_submissions;
CREATE POLICY "Admins read biotwin submissions under view-as"
  ON public.biotwin_patient_submissions FOR SELECT TO authenticated
  USING (public.has_valid_view_as_session(auth.uid(), user_id));

-- ---------------------------------------------------------------------------
-- 3. What-if cards — attention is the patient's; verdicts are not.
--    Only seen_at and dismissed_at are writable from the client, by column
--    grant, so a forged verdict/patient_safe/content write fails even though
--    the row belongs to the patient.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.simulator_what_if_cards FROM authenticated;
REVOKE ALL ON public.simulator_what_if_cards FROM anon;
GRANT SELECT ON public.simulator_what_if_cards TO authenticated;
GRANT UPDATE (seen_at, dismissed_at) ON public.simulator_what_if_cards TO authenticated;
GRANT ALL ON public.simulator_what_if_cards TO service_role;

DROP POLICY IF EXISTS wifc_select_own ON public.simulator_what_if_cards;
CREATE POLICY wifc_select_own
  ON public.simulator_what_if_cards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY wifc_update_own_attention
  ON public.simulator_what_if_cards FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Experiments, protocols and derived records — backend writes only.
--    Stopping and pausing remain patient actions; they go through the server
--    function, which always permits them.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.simulator_experiments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.simulator_experiment_protocols FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.simulator_experiment_comparisons FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.simulator_learnings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.simulator_checkpoints FROM authenticated;
REVOKE ALL ON public.simulator_experiments FROM anon;
REVOKE ALL ON public.simulator_experiment_protocols FROM anon;
REVOKE ALL ON public.simulator_experiment_comparisons FROM anon;
REVOKE ALL ON public.simulator_learnings FROM anon;
REVOKE ALL ON public.simulator_checkpoints FROM anon;
REVOKE ALL ON public.simulator_daily_observations FROM anon;

GRANT SELECT ON public.simulator_experiments TO authenticated;
GRANT SELECT ON public.simulator_experiment_protocols TO authenticated;
GRANT SELECT ON public.simulator_experiment_comparisons TO authenticated;
GRANT SELECT ON public.simulator_learnings TO authenticated;
GRANT SELECT ON public.simulator_checkpoints TO authenticated;
GRANT ALL ON public.simulator_experiments TO service_role;
GRANT ALL ON public.simulator_experiment_protocols TO service_role;
GRANT ALL ON public.simulator_experiment_comparisons TO service_role;
GRANT ALL ON public.simulator_learnings TO service_role;
GRANT ALL ON public.simulator_checkpoints TO service_role;

DROP POLICY IF EXISTS exp_select_own ON public.simulator_experiments;
CREATE POLICY exp_select_own ON public.simulator_experiments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS sep_select_own ON public.simulator_experiment_protocols;
CREATE POLICY sep_select_own ON public.simulator_experiment_protocols FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS sec_select_own ON public.simulator_experiment_comparisons;
CREATE POLICY sec_select_own ON public.simulator_experiment_comparisons FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS lrn_select_own ON public.simulator_learnings;
CREATE POLICY lrn_select_own ON public.simulator_learnings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS chk_select_own ON public.simulator_checkpoints;
CREATE POLICY chk_select_own ON public.simulator_checkpoints FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Daily self-logging stays a patient-owned write: it is the patient's own
-- observation of their own body and it activates nothing. What it may NOT do is
-- attach to somebody else's plan, so every write also checks that the parent
-- experiment belongs to the same person. Corrections (UPDATE) and removals
-- (DELETE) of one's own entries are preserved.
CREATE POLICY sdo_select_own ON public.simulator_daily_observations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY sdo_insert_own_parent ON public.simulator_daily_observations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.simulator_experiments e
       WHERE e.id = simulator_daily_observations.experiment_id
         AND e.user_id = auth.uid()
    )
  );

CREATE POLICY sdo_update_own_parent ON public.simulator_daily_observations FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.simulator_experiments e
       WHERE e.id = simulator_daily_observations.experiment_id
         AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.simulator_experiments e
       WHERE e.id = simulator_daily_observations.experiment_id
         AND e.user_id = auth.uid()
    )
  );

CREATE POLICY sdo_delete_own ON public.simulator_daily_observations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.simulator_daily_observations FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulator_daily_observations TO authenticated;
GRANT ALL ON public.simulator_daily_observations TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Bind an admission decision to exact executable content AND to the context
--    fingerprint it was computed from.
-- ---------------------------------------------------------------------------
ALTER TABLE public.simulator_experiment_protocols
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS patient_note text,
  ADD COLUMN IF NOT EXISTS content_sha256 text,
  ADD COLUMN IF NOT EXISTS executable_sha256 text,
  ADD COLUMN IF NOT EXISTS activation_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admission_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admission_context_fingerprint text,
  ADD COLUMN IF NOT EXISTS admission_computed_at timestamptz;

-- Cycle identity is assigned by the server lifecycle, never by editing a log.
-- Legacy observations/comparisons retain a NULL cycle and remain readable.
ALTER TABLE public.simulator_experiments
  ADD COLUMN IF NOT EXISTS cycle_index integer NOT NULL DEFAULT 1;
ALTER TABLE public.simulator_daily_observations
  ADD COLUMN IF NOT EXISTS cycle_index integer;
ALTER TABLE public.simulator_experiment_comparisons
  ADD COLUMN IF NOT EXISTS cycle_index integer,
  ADD COLUMN IF NOT EXISTS observation_fingerprint text;
ALTER TABLE public.simulator_learnings
  ADD COLUMN IF NOT EXISTS cycle_index integer,
  ADD COLUMN IF NOT EXISTS comparison_id uuid,
  ADD COLUMN IF NOT EXISTS observation_fingerprint text;
CREATE UNIQUE INDEX IF NOT EXISTS simulator_comparisons_cycle_uniq
  ON public.simulator_experiment_comparisons (experiment_id, cycle_index);
CREATE UNIQUE INDEX IF NOT EXISTS simulator_learnings_cycle_uniq
  ON public.simulator_learnings (experiment_id, cycle_index);

CREATE OR REPLACE FUNCTION public.simulator_observation_cycle()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT e.cycle_index INTO NEW.cycle_index FROM public.simulator_experiments e
      WHERE e.id=NEW.experiment_id AND e.user_id=NEW.user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'EXPERIMENT_NOT_FOUND' USING ERRCODE='42501'; END IF;
    NEW.logged_at := now();
    NEW.created_at := now();
  ELSIF NEW.experiment_id IS DISTINCT FROM OLD.experiment_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.cycle_index IS DISTINCT FROM OLD.cycle_index
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.logged_at IS DISTINCT FROM OLD.logged_at THEN
    RAISE EXCEPTION 'OBSERVATION_PROVENANCE_IMMUTABLE' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sdo_bind_cycle BEFORE INSERT OR UPDATE
  ON public.simulator_daily_observations FOR EACH ROW
  EXECUTE FUNCTION public.simulator_observation_cycle();

-- ---------------------------------------------------------------------------
-- 6. Transactional phase transition (service-only).
--    CAS over phase + protocol version + executable content hash + the context
--    fingerprint the decision was computed from, all under a row lock, and the
--    allowed transitions are validated here too rather than trusted from the
--    caller. Deliberately NOT security definer: it runs as the caller and
--    EXECUTE is granted to service_role only, so a patient JWT cannot reach it.
-- ---------------------------------------------------------------------------
-- Snapshot of the exact stored inputs used by the trusted context loader.
-- Read before and after the external computation, and again under table locks
-- at activation. Table locks are held only for this short database transaction;
-- no network call or model execution takes place under a lock.
CREATE OR REPLACE FUNCTION public.simulator_admission_fingerprint(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path TO '' AS $$
  SELECT pg_catalog.md5(pg_catalog.jsonb_build_array(
    (SELECT coalesce(jsonb_agg(to_jsonb(w) ORDER BY w.witness_id), '[]'::jsonb)
       FROM public.witness_objects w WHERE w.user_id=p_user_id),
    (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id), '[]'::jsonb)
       FROM public.cie33_sessions s WHERE s.user_id=p_user_id),
    (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id), '[]'::jsonb)
       FROM public.cie_assessments a WHERE a.user_id=p_user_id)
  )::text)
$$;
REVOKE ALL ON FUNCTION public.simulator_admission_fingerprint(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simulator_admission_fingerprint(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.simulator_transition_phase(
  uuid, uuid, text, text, uuid, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.simulator_transition_phase(
  p_user_id uuid,
  p_experiment_id uuid,
  p_from_phase text,
  p_to_phase text,
  p_protocol_id uuid,
  p_protocol_version integer,
  p_executable_sha text,
  p_context_fingerprint text,
  p_admission jsonb,
  p_stopped_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  exp public.simulator_experiments%ROWTYPE;
  proto public.simulator_experiment_protocols%ROWTYPE;
  source_card public.simulator_what_if_cards%ROWTYPE;
  terminal text[] := ARRAY['stopped', 'graduated', 'not_interpretable'];
  allowed_next text;
BEGIN
  SELECT * INTO exp FROM public.simulator_experiments
    WHERE id = p_experiment_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXPERIMENT_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  -- Stopping and pausing are the patient's own, always, and are handled before
  -- any staleness check. Stopping an already-stopped plan is a no-op, and a
  -- finished plan is never reopened.
  IF p_to_phase IN ('stopped', 'paused') THEN
    IF coalesce(exp.phase, 'draft') = p_to_phase THEN
      RETURN jsonb_build_object('phase', exp.phase, 'activated', false, 'idempotent', true);
    END IF;
    IF p_to_phase = 'stopped' AND coalesce(exp.phase, 'draft') = ANY(terminal) THEN
      RETURN jsonb_build_object('phase', exp.phase, 'activated', false, 'idempotent', true);
    END IF;
    IF p_to_phase = 'paused' AND coalesce(exp.phase, 'draft') = ANY(terminal) THEN
      RAISE EXCEPTION 'TERMINAL_PHASE' USING ERRCODE = '22023';
    END IF;

    UPDATE public.simulator_experiments
       SET phase = p_to_phase,
           phase_started_at = now(),
           status = CASE WHEN p_to_phase = 'stopped' THEN 'abandoned' ELSE 'paused' END,
           stopped_reason = CASE WHEN p_to_phase = 'stopped'
                                 THEN coalesce(p_stopped_reason, 'patient_stopped')
                                 ELSE stopped_reason END,
           ended_at = CASE WHEN p_to_phase = 'stopped' THEN now() ELSE ended_at END,
           updated_at = now()
     WHERE id = p_experiment_id;
    RETURN jsonb_build_object('phase', p_to_phase, 'protocol_id', NULL, 'activated', false);
  END IF;

  -- A finished plan cannot be started again, whatever the caller asks for.
  IF coalesce(exp.phase, 'draft') = ANY(terminal) THEN
    RAISE EXCEPTION 'TERMINAL_PHASE' USING ERRCODE = '22023';
  END IF;

  IF coalesce(exp.phase, 'draft') IS DISTINCT FROM p_from_phase THEN
    RAISE EXCEPTION 'STALE_PHASE' USING ERRCODE = '40001';
  END IF;

  -- The lifecycle is validated here, not trusted from the caller.
  allowed_next := CASE coalesce(exp.phase, 'draft')
                    WHEN 'draft' THEN 'run_in'
                    WHEN 'run_in' THEN 'intervention'
                    WHEN 'intervention' THEN 'ready_to_compare'
                    WHEN 'washout' THEN 'ready_to_compare'
                    WHEN 'completed' THEN 'run_in'
                    ELSE NULL
                  END;
  IF p_to_phase IS DISTINCT FROM allowed_next AND p_to_phase <> 'not_interpretable' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = '22023';
  END IF;

  IF p_protocol_id IS NULL THEN
    RAISE EXCEPTION 'PROTOCOL_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO proto FROM public.simulator_experiment_protocols
    WHERE id = p_protocol_id AND experiment_id = p_experiment_id AND user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROTOCOL_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
  IF p_protocol_version IS NULL OR proto.protocol_version IS DISTINCT FROM p_protocol_version THEN
    RAISE EXCEPTION 'PROTOCOL_SUPERSEDED' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.simulator_experiment_protocols
     WHERE experiment_id = p_experiment_id AND protocol_version > proto.protocol_version
  ) THEN
    RAISE EXCEPTION 'PROTOCOL_SUPERSEDED' USING ERRCODE = '40001';
  END IF;
  IF proto.executable_sha256 IS NULL OR proto.executable_sha256 IS DISTINCT FROM p_executable_sha THEN
    RAISE EXCEPTION 'PROTOCOL_CHANGED' USING ERRCODE = '40001';
  END IF;

  -- Compare the actual locked rows, not only a previously stored hash field.
  IF to_jsonb(proto) IS DISTINCT FROM p_admission->'protocol_snapshot'
     OR to_jsonb(exp) IS DISTINCT FROM p_admission->'experiment_snapshot' THEN
    RAISE EXCEPTION 'PROTOCOL_CHANGED' USING ERRCODE = '40001';
  END IF;

  IF exp.source_card_id IS NOT NULL THEN
    SELECT * INTO source_card FROM public.simulator_what_if_cards
      WHERE id=exp.source_card_id AND user_id=p_user_id FOR SHARE;
    IF NOT FOUND OR source_card.updated_at IS DISTINCT FROM
          (p_admission->>'source_card_updated_at')::timestamptz
       OR source_card.patient_safe IS NOT TRUE
       OR source_card.admission_verdict='BLOCK'
       OR coalesce(jsonb_array_length(source_card.safety_flags),0)>0 THEN
      RAISE EXCEPTION 'SOURCE_CHANGED' USING ERRCODE = '40001';
    END IF;
  END IF;

  -- The decision must have been computed from the context recorded against this
  -- protocol. If the person's own information moved on — a new safety hold, a
  -- new result — the fingerprints differ and nothing is activated.
  IF NOT coalesce((p_admission->>'observation_only')::boolean,false) THEN
    LOCK TABLE public.cie33_sessions, public.cie_assessments,
      public.witness_objects IN SHARE MODE;
    IF p_context_fingerprint IS NULL
       OR public.simulator_admission_fingerprint(p_user_id) IS DISTINCT FROM p_context_fingerprint
       OR EXISTS (SELECT 1 FROM public.cie33_sessions s WHERE s.user_id=p_user_id
                    AND s.state->>'safety' IN ('handoff_required','recheck_required')) THEN
      RAISE EXCEPTION 'CONTEXT_CHANGED' USING ERRCODE = '40001';
    END IF;
  END IF;

  IF coalesce((p_admission->>'activation_allowed')::boolean, false) = false
     OR coalesce(p_admission->>'verdict', '') = 'BLOCK' THEN
    RAISE EXCEPTION 'ADMISSION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.simulator_experiment_protocols
     SET admission_verdict = p_admission->>'verdict',
         admission_reasons = p_admission - 'protocol_snapshot' - 'experiment_snapshot' - 'source_card_updated_at',
         admission_context_fingerprint = p_context_fingerprint,
         clinician_review_required =
           coalesce((p_admission->>'clinician_review_required')::boolean, proto.clinician_review_required),
         activation_allowed = true,
         admission_computed_at = now(),
         updated_at = now()
   WHERE id = p_protocol_id;

  UPDATE public.simulator_experiments
     SET phase = p_to_phase,
         phase_started_at = now(),
         status = 'active',
         cycle_index = CASE WHEN exp.phase='completed' AND p_to_phase='run_in'
                            THEN exp.cycle_index+1 ELSE exp.cycle_index END,
         run_in_started_at = CASE WHEN p_to_phase = 'run_in' THEN now() ELSE run_in_started_at END,
         intervention_started_at = CASE WHEN p_to_phase = 'intervention'
                                        THEN now() ELSE intervention_started_at END,
         ended_at = CASE WHEN p_to_phase='run_in' THEN NULL
                         WHEN p_to_phase='not_interpretable' THEN now() ELSE ended_at END,
         updated_at = now()
   WHERE id = p_experiment_id;

  RETURN jsonb_build_object('phase', p_to_phase, 'protocol_id', p_protocol_id, 'activated', true);
END;
$$;

REVOKE ALL ON FUNCTION public.simulator_transition_phase(
  uuid, uuid, text, text, uuid, integer, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.simulator_transition_phase(
  uuid, uuid, text, text, uuid, integer, text, text, jsonb, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simulator_transition_phase(
  uuid, uuid, text, text, uuid, integer, text, text, jsonb, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Graduation gate (service-only). "Replication" means two INDEPENDENT
--    cycles: two server-assigned cycles with separate observations.
--    Repeating the same comparison over the same entries is one cycle, counted
--    once. This adds no claim about clinical efficacy.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.simulator_graduate_experiment(
  p_user_id uuid,
  p_experiment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  cycles integer;
  exp public.simulator_experiments%ROWTYPE;
BEGIN
  SELECT * INTO exp FROM public.simulator_experiments
    WHERE id=p_experiment_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXPERIMENT_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  IF exp.phase='graduated' THEN RETURN jsonb_build_object('graduated',true,'idempotent',true); END IF;
  IF exp.phase <> 'completed' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE='22023';
  END IF;

  SELECT count(DISTINCT c.cycle_index) INTO cycles
    FROM public.simulator_experiment_comparisons c
   WHERE c.experiment_id = p_experiment_id
     AND c.user_id = p_user_id
     AND c.cycle_index IS NOT NULL
     AND c.result IN ('SIGNAL_DETECTED', 'POSSIBLE_SIGNAL', 'NO_DETECTABLE_SIGNAL');

  IF coalesce(cycles, 0) < 2 THEN
    RAISE EXCEPTION 'REPLICATION_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.simulator_experiments
     SET status = 'graduated', phase='graduated', ended_at = now(), updated_at = now()
   WHERE id = p_experiment_id AND user_id = p_user_id;
  UPDATE public.simulator_learnings
     SET graduated = true, learning_status = 'replicated'
   WHERE experiment_id = p_experiment_id AND user_id = p_user_id;

  RETURN jsonb_build_object('graduated', true, 'independent_cycles', cycles);
END;
$$;

REVOKE ALL ON FUNCTION public.simulator_graduate_experiment(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.simulator_graduate_experiment(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simulator_graduate_experiment(uuid, uuid) TO service_role;

-- Atomically persist a comparison and end that cycle. A repeated call or a log
-- correction cannot create another cycle. Historical comparisons are snapshots
-- of self-reported observations, not clinical confirmation of efficacy.
CREATE OR REPLACE FUNCTION public.simulator_complete_comparison(
  p_user_id uuid, p_experiment_id uuid, p_cycle_index integer,
  p_experiment_snapshot jsonb, p_comparison jsonb
) RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE
  exp public.simulator_experiments%ROWTYPE;
  cmp public.simulator_experiment_comparisons%ROWTYPE;
  next_phase text;
BEGIN
  SELECT * INTO exp FROM public.simulator_experiments
    WHERE id=p_experiment_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXPERIMENT_NOT_FOUND' USING ERRCODE='42501'; END IF;
  SELECT * INTO cmp FROM public.simulator_experiment_comparisons
    WHERE experiment_id=p_experiment_id AND user_id=p_user_id AND cycle_index=p_cycle_index;
  IF FOUND THEN RETURN jsonb_build_object('comparison',to_jsonb(cmp),'next_phase',exp.phase,'replayed',true); END IF;
  IF exp.cycle_index IS DISTINCT FROM p_cycle_index
     OR to_jsonb(exp) IS DISTINCT FROM p_experiment_snapshot
     OR exp.phase NOT IN ('intervention','ready_to_compare') THEN
    RAISE EXCEPTION 'STALE_PHASE' USING ERRCODE='40001';
  END IF;
  INSERT INTO public.simulator_experiment_comparisons (
    experiment_id,user_id,cycle_index,phase_a,phase_b,n_a,n_b,median_a,median_b,
    abs_change,pct_change,direction_consistency_pct,overlap_ratio,adherence_pct,
    missingness_pct,confounder_burden,result,reasons,human_summary,observation_fingerprint
  ) VALUES (
    p_experiment_id,p_user_id,p_cycle_index,'run_in','intervention',
    (p_comparison->>'n_a')::integer,(p_comparison->>'n_b')::integer,
    (p_comparison->>'median_a')::numeric,(p_comparison->>'median_b')::numeric,
    (p_comparison->>'abs_change')::numeric,(p_comparison->>'pct_change')::numeric,
    (p_comparison->>'direction_consistency_pct')::numeric,(p_comparison->>'overlap_ratio')::numeric,
    (p_comparison->>'adherence_pct')::numeric,(p_comparison->>'missingness_pct')::numeric,
    (p_comparison->>'confounder_burden')::numeric,p_comparison->>'result',
    p_comparison->'reasons',p_comparison->>'human_summary',p_comparison->>'observation_fingerprint'
  ) RETURNING * INTO cmp;
  next_phase := CASE cmp.result WHEN 'STOPPED_FOR_SAFETY' THEN 'stopped'
    WHEN 'NOT_INTERPRETABLE' THEN 'not_interpretable' ELSE 'completed' END;
  UPDATE public.simulator_experiments SET phase=next_phase,ended_at=now(),updated_at=now()
    WHERE id=p_experiment_id;
  IF next_phase='completed' THEN
    INSERT INTO public.simulator_learnings (
      user_id,experiment_id,cycle_index,comparison_id,observation_fingerprint,kind,
      headline,body,confidence,evidence_witness_ids,graduated,learning_status,cycle_count
    ) VALUES (
      p_user_id,p_experiment_id,p_cycle_index,cmp.id,cmp.observation_fingerprint,'n1_cycle_result',
      exp.lever || ' — personal observation',cmp.human_summary,
      CASE cmp.result WHEN 'SIGNAL_DETECTED' THEN 0.65 WHEN 'POSSIBLE_SIGNAL' THEN 0.4 ELSE 0.3 END,
      ARRAY[]::uuid[],false,'provisional',1
    );
  END IF;
  RETURN jsonb_build_object('comparison',to_jsonb(cmp),'next_phase',next_phase,'replayed',false);
END;
$$;
REVOKE ALL ON FUNCTION public.simulator_complete_comparison(uuid,uuid,integer,jsonb,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simulator_complete_comparison(uuid,uuid,integer,jsonb,jsonb)
  TO service_role;
