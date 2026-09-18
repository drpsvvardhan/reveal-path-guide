-- ============================================================================
-- Patient Reveal — patient autonomy with server-held clinical authority
-- ----------------------------------------------------------------------------
-- STATUS: NOT APPLIED. Held here deliberately, exactly like the BioTwin
-- governed-report migration. It is to be applied through this project's managed
-- migration workflow after independent review of the accompanying commit.
--
-- What it changes, and why:
--   Patients keep every read and every genuinely patient-owned action. What
--   they lose is the ability to write derived clinical fields directly: truth
--   status, clinical authority, holds, release/attestation, admission verdicts,
--   review requirements and phase transitions are written by the backend only.
--
--   Permission-only plus additive columns and two service-only functions. No
--   table, column or row is dropped; no column type changes; no data is edited.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Remove every non-SELECT policy on the protected tables.
--    Owner SELECT is recreated explicitly below for tables whose read access
--    came from a FOR ALL policy.
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

CREATE POLICY "Users read their own biotwin reports"
  ON public.biotwin_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

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

-- Daily self-logging stays a patient-owned write. It is the patient's own
-- observation of their own body, and it activates nothing.
DROP POLICY IF EXISTS sdo_select_own ON public.simulator_daily_observations;
CREATE POLICY sdo_select_own ON public.simulator_daily_observations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS sdo_insert_own ON public.simulator_daily_observations;
CREATE POLICY sdo_insert_own ON public.simulator_daily_observations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS sdo_update_own ON public.simulator_daily_observations;
CREATE POLICY sdo_update_own ON public.simulator_daily_observations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS sdo_delete_own ON public.simulator_daily_observations;
CREATE POLICY sdo_delete_own ON public.simulator_daily_observations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulator_daily_observations TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Bind an admission decision to exact protocol content.
-- ---------------------------------------------------------------------------
ALTER TABLE public.simulator_experiment_protocols
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS content_sha256 text,
  ADD COLUMN IF NOT EXISTS activation_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admission_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admission_computed_at timestamptz;

-- ---------------------------------------------------------------------------
-- 6. Transactional phase transition (service-only, CAS on phase + protocol).
--    Deliberately NOT security definer: it runs as the caller, and EXECUTE is
--    granted to service_role only, so a patient JWT cannot reach it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.simulator_transition_phase(
  p_user_id uuid,
  p_experiment_id uuid,
  p_from_phase text,
  p_to_phase text,
  p_protocol_id uuid,
  p_protocol_sha text,
  p_admission jsonb,
  p_stopped_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  exp public.simulator_experiments%ROWTYPE;
  proto public.simulator_experiment_protocols%ROWTYPE;
BEGIN
  SELECT * INTO exp FROM public.simulator_experiments
    WHERE id = p_experiment_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXPERIMENT_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
  IF coalesce(exp.phase, 'draft') IS DISTINCT FROM p_from_phase THEN
    RAISE EXCEPTION 'STALE_PHASE' USING ERRCODE = '40001';
  END IF;

  -- Stopping and pausing are the patient's own, always.
  IF p_to_phase IN ('stopped', 'paused') THEN
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

  IF p_protocol_id IS NULL THEN
    RAISE EXCEPTION 'PROTOCOL_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO proto FROM public.simulator_experiment_protocols
    WHERE id = p_protocol_id AND experiment_id = p_experiment_id AND user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROTOCOL_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.simulator_experiment_protocols
     WHERE experiment_id = p_experiment_id AND protocol_version > proto.protocol_version
  ) THEN
    RAISE EXCEPTION 'PROTOCOL_SUPERSEDED' USING ERRCODE = '40001';
  END IF;
  IF proto.content_sha256 IS NULL OR proto.content_sha256 IS DISTINCT FROM p_protocol_sha THEN
    RAISE EXCEPTION 'PROTOCOL_CHANGED' USING ERRCODE = '40001';
  END IF;
  IF coalesce((p_admission->>'activation_allowed')::boolean, false) = false
     OR coalesce(p_admission->>'verdict', '') = 'BLOCK' THEN
    RAISE EXCEPTION 'ADMISSION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.simulator_experiment_protocols
     SET admission_verdict = p_admission->>'verdict',
         admission_reasons = p_admission,
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
         run_in_started_at = CASE WHEN p_to_phase = 'run_in' THEN now() ELSE run_in_started_at END,
         intervention_started_at = CASE WHEN p_to_phase = 'intervention'
                                        THEN now() ELSE intervention_started_at END,
         ended_at = CASE WHEN p_to_phase IN ('completed', 'not_interpretable') THEN now() ELSE ended_at END,
         updated_at = now()
   WHERE id = p_experiment_id;

  RETURN jsonb_build_object('phase', p_to_phase, 'protocol_id', p_protocol_id, 'activated', true);
END;
$$;

REVOKE ALL ON FUNCTION public.simulator_transition_phase(
  uuid, uuid, text, text, uuid, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.simulator_transition_phase(
  uuid, uuid, text, text, uuid, text, jsonb, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simulator_transition_phase(
  uuid, uuid, text, text, uuid, text, jsonb, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Graduation gate (service-only). The replication requirement is computed
--    in SQL so it cannot be bypassed by a client write.
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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.simulator_experiments
     WHERE id = p_experiment_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'EXPERIMENT_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(sum(coalesce(cycle_count, 1)), 0) INTO cycles
    FROM public.simulator_learnings
   WHERE experiment_id = p_experiment_id AND user_id = p_user_id;

  IF cycles < 2 THEN
    RAISE EXCEPTION 'REPLICATION_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.simulator_experiments
     SET status = 'graduated', ended_at = now(), updated_at = now()
   WHERE id = p_experiment_id AND user_id = p_user_id;
  UPDATE public.simulator_learnings
     SET graduated = true, learning_status = 'replicated'
   WHERE experiment_id = p_experiment_id AND user_id = p_user_id;

  RETURN jsonb_build_object('graduated', true, 'cycles', cycles);
END;
$$;

REVOKE ALL ON FUNCTION public.simulator_graduate_experiment(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.simulator_graduate_experiment(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simulator_graduate_experiment(uuid, uuid) TO service_role;
