-- ============================================================================
-- Query-intent telemetry on the Answer Receipt
-- ----------------------------------------------------------------------------
-- Telemetry is a read-model over receipts, not another write pipeline. The
-- receipt already carries the question, conversation, Twin version, model,
-- latency, evidence used, fallback, escalation, and marker coverage. These
-- two derived columns are the only additions that materially help:
--
--   query_intent      deterministic first-match classification (no LLM in
--                     the answer path)
--   query_intent_rule the rule that matched, for auditability and later
--                     offline re-classification
-- ============================================================================

ALTER TABLE public.patient_chat_validation_log
  ADD COLUMN IF NOT EXISTS query_intent text,
  ADD COLUMN IF NOT EXISTS query_intent_rule text;

CREATE INDEX IF NOT EXISTS idx_pcvl_query_intent
  ON public.patient_chat_validation_log (query_intent, created_at DESC)
  WHERE query_intent IS NOT NULL;
