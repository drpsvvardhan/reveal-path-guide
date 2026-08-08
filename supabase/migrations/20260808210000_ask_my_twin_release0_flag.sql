-- ============================================================================
-- Ask My Twin Release 0 cohort flag
-- ----------------------------------------------------------------------------
-- Experimental design: 20-30 patients → observe → correct → expand.
-- enabled  → the patient's default view is the Ask My Twin home
-- disabled → the existing journey experience (nothing else changes)
--
-- Deliberately not a feature-management system: one boolean, default off,
-- flipped per patient by the team choosing the beta cohort, then flipped
-- for everyone after the Week-3 observation period.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ask_my_twin_release0_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.ask_my_twin_release0_enabled IS
  'Release 0 beta cohort gate for the Ask My Twin home. Presentation only — grants no data access and carries no biological meaning.';
