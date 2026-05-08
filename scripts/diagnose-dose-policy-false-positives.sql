-- Pull recent NO_DOSE_FALLBACK replacements as JSON for the diagnostic CLI.
-- Run with:
--   psql -At -f scripts/diagnose-dose-policy-false-positives.sql > /tmp/rows.json
SELECT jsonb_agg(row_to_json(t))
FROM (
  SELECT
    id,
    created_at,
    status,
    routing_mode,
    replacement_template_used,
    last_user_message,
    original_output,
    replaced_with,
    dose_patterns_matched
  FROM public.patient_chat_validation_log
  WHERE status = 'replaced_with_fallback'
    AND replacement_template_used = 'NO_DOSE_FALLBACK'
    AND created_at > now() - interval '30 days'
  ORDER BY created_at DESC
  LIMIT 500
) t;