
-- ============================================================================
-- Precision Perturbation Engine v2 — additive vertical slice migration
-- Additive only. Existing simulator_* tables and their policies are preserved.
-- ============================================================================

-- 1. simulator_experiment_protocols ------------------------------------------
CREATE TABLE public.simulator_experiment_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES public.simulator_experiments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  protocol_version INTEGER NOT NULL DEFAULT 1,
  hypothesis_question TEXT NOT NULL,
  perturbation_category TEXT NOT NULL,
  intervention JSONB NOT NULL DEFAULT '{}'::jsonb,
  primary_outcome JSONB NOT NULL,
  secondary_outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
  hold_stable TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  allowed_cointerventions TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  run_in_days INTEGER NOT NULL DEFAULT 5,
  intervention_days INTEGER NOT NULL DEFAULT 14,
  washout_days INTEGER,
  crossover JSONB,
  min_observations_per_phase INTEGER NOT NULL DEFAULT 5,
  min_adherence_pct NUMERIC NOT NULL DEFAULT 0.70,
  stop_criteria TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  contraindications TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  clinician_review_required BOOLEAN NOT NULL DEFAULT false,
  expected_direction TEXT,
  admission_verdict TEXT,
  admission_reasons JSONB,
  evidence_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sep_category_valid CHECK (perturbation_category IN ('food','sleep','movement','stress','timing','recovery')),
  CONSTRAINT sep_unique_active UNIQUE (experiment_id, protocol_version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulator_experiment_protocols TO authenticated;
GRANT ALL ON public.simulator_experiment_protocols TO service_role;

ALTER TABLE public.simulator_experiment_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sep_own_select" ON public.simulator_experiment_protocols
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sep_own_insert" ON public.simulator_experiment_protocols
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sep_own_update" ON public.simulator_experiment_protocols
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sep_own_delete" ON public.simulator_experiment_protocols
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX sep_experiment_idx ON public.simulator_experiment_protocols(experiment_id);
CREATE INDEX sep_user_idx ON public.simulator_experiment_protocols(user_id);

CREATE TRIGGER sep_touch_updated_at
  BEFORE UPDATE ON public.simulator_experiment_protocols
  FOR EACH ROW EXECUTE FUNCTION public.simulator_touch_updated_at();


-- 2. simulator_daily_observations --------------------------------------------
CREATE TABLE public.simulator_daily_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES public.simulator_experiments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  phase TEXT NOT NULL,
  observed_on DATE NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  intervention_performed BOOLEAN,
  actual_dose JSONB,
  actual_time TIME,
  actual_duration_min INTEGER,
  primary_value NUMERIC,
  secondary_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  sleep_hours NUMERIC,
  sleep_quality INTEGER,
  energy INTEGER,
  recovery INTEGER,
  symptom INTEGER,
  confounders JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sdo_phase_valid CHECK (phase IN ('run_in','intervention','washout','crossover_a','crossover_b')),
  CONSTRAINT sdo_one_per_day UNIQUE (experiment_id, observed_on)
);

GRANT SELECT, INSERT ON public.simulator_daily_observations TO authenticated;
GRANT ALL ON public.simulator_daily_observations TO service_role;

ALTER TABLE public.simulator_daily_observations ENABLE ROW LEVEL SECURITY;

-- Immutable append-only: no UPDATE / DELETE policy for authenticated.
CREATE POLICY "sdo_own_select" ON public.simulator_daily_observations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sdo_own_insert" ON public.simulator_daily_observations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX sdo_experiment_idx ON public.simulator_daily_observations(experiment_id, observed_on);
CREATE INDEX sdo_user_idx ON public.simulator_daily_observations(user_id);


-- 3. simulator_experiment_comparisons ----------------------------------------
CREATE TABLE public.simulator_experiment_comparisons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES public.simulator_experiments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  phase_a TEXT NOT NULL,
  phase_b TEXT NOT NULL,
  n_a INTEGER NOT NULL,
  n_b INTEGER NOT NULL,
  median_a NUMERIC,
  median_b NUMERIC,
  abs_change NUMERIC,
  pct_change NUMERIC,
  direction_consistency_pct NUMERIC,
  overlap_ratio NUMERIC,
  adherence_pct NUMERIC,
  missingness_pct NUMERIC,
  confounder_burden NUMERIC,
  result TEXT NOT NULL,
  reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  human_summary TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sec_result_valid CHECK (result IN (
    'SIGNAL_DETECTED','POSSIBLE_SIGNAL','NO_DETECTABLE_SIGNAL','NOT_INTERPRETABLE','STOPPED_FOR_SAFETY'
  ))
);

GRANT SELECT, INSERT ON public.simulator_experiment_comparisons TO authenticated;
GRANT ALL ON public.simulator_experiment_comparisons TO service_role;

ALTER TABLE public.simulator_experiment_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sec_own_select" ON public.simulator_experiment_comparisons
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sec_own_insert" ON public.simulator_experiment_comparisons
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX sec_experiment_idx ON public.simulator_experiment_comparisons(experiment_id);
CREATE INDEX sec_user_idx ON public.simulator_experiment_comparisons(user_id);


-- 4. Additive columns on simulator_experiments -------------------------------
ALTER TABLE public.simulator_experiments
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS phase_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS run_in_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intervention_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stopped_reason TEXT;


-- 5. Additive columns on simulator_learnings ---------------------------------
ALTER TABLE public.simulator_learnings
  ADD COLUMN IF NOT EXISTS learning_status TEXT NOT NULL DEFAULT 'provisional',
  ADD COLUMN IF NOT EXISTS cycle_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS replicated_by_experiment_id UUID;


-- 6. Additive columns on simulator_what_if_cards -----------------------------
ALTER TABLE public.simulator_what_if_cards
  ADD COLUMN IF NOT EXISTS protocol_template JSONB,
  ADD COLUMN IF NOT EXISTS primary_outcome JSONB,
  ADD COLUMN IF NOT EXISTS perturbation_category TEXT;
