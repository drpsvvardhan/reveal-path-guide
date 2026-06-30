ALTER TABLE public.simulator_what_if_cards
  ADD COLUMN IF NOT EXISTS admission_verdict text,
  ADD COLUMN IF NOT EXISTS admission_reasons jsonb,
  ADD COLUMN IF NOT EXISTS evidence_label text,
  ADD COLUMN IF NOT EXISTS patient_safe boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS safety_flags jsonb,
  ADD COLUMN IF NOT EXISTS unbound_biomarkers jsonb;