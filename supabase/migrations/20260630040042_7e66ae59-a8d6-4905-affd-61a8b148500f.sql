
-- 1. simulator_what_if_cards
CREATE TABLE public.simulator_what_if_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lever text NOT NULL,
  rationale text NOT NULL,
  predicted_deltas jsonb NOT NULL DEFAULT '[]'::jsonb,
  horizon_days int NOT NULL DEFAULT 30,
  confidence numeric,
  focus text,
  source_cluster_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  source_terrain_render_id uuid,
  engine_version text,
  seen_at timestamptz,
  dismissed_at timestamptz,
  committed_experiment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulator_what_if_cards TO authenticated;
GRANT ALL ON public.simulator_what_if_cards TO service_role;
ALTER TABLE public.simulator_what_if_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wifc_select_own" ON public.simulator_what_if_cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wifc_insert_own" ON public.simulator_what_if_cards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wifc_update_own" ON public.simulator_what_if_cards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wifc_delete_own" ON public.simulator_what_if_cards FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. simulator_experiments
CREATE TABLE public.simulator_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_card_id uuid REFERENCES public.simulator_what_if_cards(id) ON DELETE SET NULL,
  lever text NOT NULL,
  rationale text NOT NULL,
  predicted_deltas jsonb NOT NULL DEFAULT '[]'::jsonb,
  horizon_days int NOT NULL DEFAULT 30,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  source_cluster_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  source_terrain_render_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulator_experiments_status_chk CHECK (status IN ('active','paused','graduated','abandoned'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulator_experiments TO authenticated;
GRANT ALL ON public.simulator_experiments TO service_role;
ALTER TABLE public.simulator_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exp_select_own" ON public.simulator_experiments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "exp_insert_own" ON public.simulator_experiments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exp_update_own" ON public.simulator_experiments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exp_delete_own" ON public.simulator_experiments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. simulator_checkpoints
CREATE TABLE public.simulator_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  experiment_id uuid NOT NULL REFERENCES public.simulator_experiments(id) ON DELETE CASCADE,
  checkpoint_at timestamptz NOT NULL,
  biomarkers text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'pending',
  measured_deltas jsonb,
  verdict text,
  verdict_summary text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulator_checkpoints_status_chk CHECK (status IN ('pending','completed','missed','skipped')),
  CONSTRAINT simulator_checkpoints_verdict_chk CHECK (verdict IS NULL OR verdict IN ('confirmed','partial','refuted','inconclusive'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulator_checkpoints TO authenticated;
GRANT ALL ON public.simulator_checkpoints TO service_role;
ALTER TABLE public.simulator_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chk_select_own" ON public.simulator_checkpoints FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "chk_insert_own" ON public.simulator_checkpoints FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chk_update_own" ON public.simulator_checkpoints FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chk_delete_own" ON public.simulator_checkpoints FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. simulator_learnings
CREATE TABLE public.simulator_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  experiment_id uuid REFERENCES public.simulator_experiments(id) ON DELETE SET NULL,
  checkpoint_id uuid REFERENCES public.simulator_checkpoints(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'observation',
  headline text NOT NULL,
  body text,
  confidence numeric,
  evidence_witness_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  graduated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulator_learnings TO authenticated;
GRANT ALL ON public.simulator_learnings TO service_role;
ALTER TABLE public.simulator_learnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lrn_select_own" ON public.simulator_learnings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lrn_insert_own" ON public.simulator_learnings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lrn_update_own" ON public.simulator_learnings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lrn_delete_own" ON public.simulator_learnings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.simulator_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_wifc_touch BEFORE UPDATE ON public.simulator_what_if_cards FOR EACH ROW EXECUTE FUNCTION public.simulator_touch_updated_at();
CREATE TRIGGER trg_exp_touch BEFORE UPDATE ON public.simulator_experiments FOR EACH ROW EXECUTE FUNCTION public.simulator_touch_updated_at();
CREATE TRIGGER trg_chk_touch BEFORE UPDATE ON public.simulator_checkpoints FOR EACH ROW EXECUTE FUNCTION public.simulator_touch_updated_at();
CREATE TRIGGER trg_lrn_touch BEFORE UPDATE ON public.simulator_learnings FOR EACH ROW EXECUTE FUNCTION public.simulator_touch_updated_at();

-- Auto-create checkpoint when an experiment is inserted
CREATE OR REPLACE FUNCTION public.simulator_auto_checkpoint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_biomarkers text[] := ARRAY[]::text[];
  v_delta jsonb;
BEGIN
  IF NEW.predicted_deltas IS NOT NULL THEN
    FOR v_delta IN SELECT * FROM jsonb_array_elements(NEW.predicted_deltas)
    LOOP
      IF v_delta ? 'biomarker' THEN
        v_biomarkers := array_append(v_biomarkers, v_delta->>'biomarker');
      END IF;
    END LOOP;
  END IF;
  INSERT INTO public.simulator_checkpoints (user_id, experiment_id, checkpoint_at, biomarkers, status)
  VALUES (NEW.user_id, NEW.id, NEW.started_at + (NEW.horizon_days || ' days')::interval, v_biomarkers, 'pending');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_exp_auto_checkpoint AFTER INSERT ON public.simulator_experiments FOR EACH ROW EXECUTE FUNCTION public.simulator_auto_checkpoint();

CREATE INDEX idx_wifc_user_created ON public.simulator_what_if_cards(user_id, created_at DESC);
CREATE INDEX idx_exp_user_status ON public.simulator_experiments(user_id, status);
CREATE INDEX idx_chk_user_status ON public.simulator_checkpoints(user_id, status, checkpoint_at);
CREATE INDEX idx_lrn_user_created ON public.simulator_learnings(user_id, created_at DESC);
