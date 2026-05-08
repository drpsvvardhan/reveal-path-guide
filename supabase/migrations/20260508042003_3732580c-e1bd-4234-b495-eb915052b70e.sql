CREATE INDEX IF NOT EXISTS idx_pcvl_status_created
  ON public.patient_chat_validation_log (status, created_at DESC)
  WHERE status != 'passed';

CREATE INDEX IF NOT EXISTS idx_pcvl_routing_mode
  ON public.patient_chat_validation_log (routing_mode, created_at DESC)
  WHERE routing_mode = 'emergency_routing';