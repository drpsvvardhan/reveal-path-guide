-- ============================================================================
-- Answer Receipt v1 (Ask My Twin, Release 0)
-- ----------------------------------------------------------------------------
-- Extends the existing patient_chat_validation_log rather than creating a
-- parallel audit subsystem. Every admitted answer becomes reconstructible:
-- what Twin existed, what evidence was available, what evidence was actually
-- used, which model proposed the answer, which validators admitted it.
--
-- Doctrine (docs/ASK_MY_TWIN_CONSTITUTION.md):
--   - Available evidence is NOT used evidence. Availability is bound by
--     context_packet_sha256 + counts on the receipt row. Per-reference rows
--     (answer_evidence_refs) are written for evidence the admitted answer
--     actually cited, usage = 'USED'. The 'AVAILABLE' usage value exists in
--     the enum for later ref types (live_window, external_source) whose
--     availability is not hash-bound.
--   - Two freshness clocks, never one ambiguous cutoff.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Receipt scalar fields on the validation log
-- ---------------------------------------------------------------------------
ALTER TABLE public.patient_chat_validation_log
  -- identity
  ADD COLUMN IF NOT EXISTS answer_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS question_timestamp timestamptz,
  -- twin state
  ADD COLUMN IF NOT EXISTS biotwin_report_id uuid,
  ADD COLUMN IF NOT EXISTS twin_id text,
  ADD COLUMN IF NOT EXISTS twin_version text,
  ADD COLUMN IF NOT EXISTS report_generated_at date,
  ADD COLUMN IF NOT EXISTS biotwin_packet_sha256 text,
  ADD COLUMN IF NOT EXISTS context_packet_sha256 text,
  -- freshness (two clocks — display may compress them, storage may not)
  ADD COLUMN IF NOT EXISTS twin_state_as_of date,
  ADD COLUMN IF NOT EXISTS latest_witness_as_of date,
  -- runtime versions
  ADD COLUMN IF NOT EXISTS model_provider text,
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS runtime_version text,
  ADD COLUMN IF NOT EXISTS prompt_template_version text,
  ADD COLUMN IF NOT EXISTS authority_policy_version text,
  ADD COLUMN IF NOT EXISTS dose_policy_version text,
  ADD COLUMN IF NOT EXISTS biotwin_validator_version text,
  -- compute
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS tokens_estimated boolean,
  ADD COLUMN IF NOT EXISTS context_bytes integer,
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  -- availability counts (the full available set is bound by
  -- context_packet_sha256; these counts make it queryable without replay)
  ADD COLUMN IF NOT EXISTS witness_count_available integer,
  ADD COLUMN IF NOT EXISTS cluster_count_available integer,
  ADD COLUMN IF NOT EXISTS biotwin_statement_count_available integer,
  -- grounding quality (filled by the evidence-marker commit; nullable until then)
  ADD COLUMN IF NOT EXISTS marker_coverage numeric,
  -- routing flags
  ADD COLUMN IF NOT EXISTS emergency_routed boolean,
  ADD COLUMN IF NOT EXISTS fallback_used boolean,
  ADD COLUMN IF NOT EXISTS doctor_question_generated boolean;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcvl_answer_id
  ON public.patient_chat_validation_log (answer_id);

CREATE INDEX IF NOT EXISTS idx_pcvl_conversation
  ON public.patient_chat_validation_log (conversation_id)
  WHERE conversation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Evidence actually used by an admitted answer (child relation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.answer_evidence_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ref_type text NOT NULL CHECK (ref_type IN (
    'witness', 'cluster', 'biotwin_statement', 'claim',
    'contradiction', 'efe', 'live_window', 'external_source'
  )),
  ref_id text NOT NULL,
  usage text NOT NULL DEFAULT 'USED' CHECK (usage IN ('AVAILABLE', 'USED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (answer_id, ref_type, ref_id, usage)
);

CREATE INDEX IF NOT EXISTS idx_aer_answer ON public.answer_evidence_refs (answer_id);
CREATE INDEX IF NOT EXISTS idx_aer_user ON public.answer_evidence_refs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aer_ref ON public.answer_evidence_refs (ref_type, ref_id);

ALTER TABLE public.answer_evidence_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own answer evidence refs"
  ON public.answer_evidence_refs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all answer evidence refs"
  ON public.answer_evidence_refs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Writes happen only from the edge function via service role; no
-- INSERT/UPDATE/DELETE policies for authenticated, no anon grant.
REVOKE ALL ON public.answer_evidence_refs FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Doctor-question traceability
--    patient question -> admitted answer -> evidence -> Twin version
-- ---------------------------------------------------------------------------
ALTER TABLE public.patient_question_queue
  ADD COLUMN IF NOT EXISTS source_answer_id uuid;

CREATE INDEX IF NOT EXISTS idx_pqq_source_answer
  ON public.patient_question_queue (source_answer_id)
  WHERE source_answer_id IS NOT NULL;
