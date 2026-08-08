-- ============================================================================
-- Answer Receipt integrity hardening (follow-up to 20260808120000)
-- ----------------------------------------------------------------------------
-- 1. Receipt relations become actual database relations: an evidence ref
--    physically cannot be orphaned or attached to the wrong person, and a
--    queued doctor question cannot point at a receipt that never existed.
-- 2. context_ref_manifest: the compact available-evidence manifest.
--    context_ref_manifest = exactly what was available;
--    context_packet_sha256 = exactly what the model saw;
--    answer_evidence_refs = exactly what the answer used.
-- 3. grounding_witness_count: witness_count_available now reports ALL
--    admitted witnesses for the patient; this column counts the subset
--    printed into the grounding block (lab / InBody / FibroScan).
--
-- Safe on existing data: answer_evidence_refs is deployed empty (both
-- migrations apply in the same release), and every pre-existing
-- patient_question_queue row has source_answer_id NULL.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1a. Promote the answer_id unique index to a referenceable constraint,
--     and add the composite (answer_id, user_id) unique constraint.
-- ---------------------------------------------------------------------------
ALTER TABLE public.patient_chat_validation_log
  ADD CONSTRAINT patient_chat_validation_log_answer_id_key
  UNIQUE USING INDEX idx_pcvl_answer_id;

ALTER TABLE public.patient_chat_validation_log
  ADD CONSTRAINT patient_chat_validation_log_answer_user_key
  UNIQUE (answer_id, user_id);

-- ---------------------------------------------------------------------------
-- 1b. answer_evidence_refs (answer_id, user_id) → receipt row.
--     Composite FK: a ref row can only exist for a real receipt AND the
--     matching patient. ON DELETE CASCADE — refs are meaningless without
--     their receipt.
-- ---------------------------------------------------------------------------
ALTER TABLE public.answer_evidence_refs
  ADD CONSTRAINT answer_evidence_refs_answer_fk
  FOREIGN KEY (answer_id, user_id)
  REFERENCES public.patient_chat_validation_log (answer_id, user_id)
  ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 1c. patient_question_queue.source_answer_id → receipt row.
--     ON DELETE SET NULL — the curated question outlives the receipt; only
--     the lineage pointer clears.
-- ---------------------------------------------------------------------------
ALTER TABLE public.patient_question_queue
  ADD CONSTRAINT patient_question_queue_source_answer_fk
  FOREIGN KEY (source_answer_id)
  REFERENCES public.patient_chat_validation_log (answer_id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2. Compact available-context reference manifest (a few KB, not hundreds
--    of AVAILABLE child rows): {"witness": [...], "cluster": [...],
--    "statement": [...]}. With this, the receipt is epistemic replay even
--    if the underlying witness store changes later.
-- ---------------------------------------------------------------------------
ALTER TABLE public.patient_chat_validation_log
  ADD COLUMN IF NOT EXISTS context_ref_manifest jsonb;

-- ---------------------------------------------------------------------------
-- 3. Witness count semantics fix. witness_count_available = ALL admitted
--    witnesses loaded for the patient (matches the freshness clock, which
--    now spans every witness class); grounding_witness_count = the subset
--    whose IDs are printed into the grounding block and citable.
-- ---------------------------------------------------------------------------
ALTER TABLE public.patient_chat_validation_log
  ADD COLUMN IF NOT EXISTS grounding_witness_count integer;
