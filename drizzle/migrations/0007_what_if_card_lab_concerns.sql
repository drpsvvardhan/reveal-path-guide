-- Additive: record the lab-derived concerns that shaped a what-if card's
-- admission. Concerns can only raise or sustain a restriction; nothing stored
-- here can clear a clinician hold, a CIE safety handoff, or a medication or
-- treatment restriction.
ALTER TABLE public.simulator_what_if_cards
  ADD COLUMN IF NOT EXISTS lab_concerns JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.simulator_what_if_cards.lab_concerns IS
  'Deterministic lab reassessment concerns (raise_concern | maintain_hold) with evidence and resolution path. Never a clearance record.';