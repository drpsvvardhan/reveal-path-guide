ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consumer_action_plan_mode text NOT NULL DEFAULT 'core'
    CHECK (consumer_action_plan_mode IN ('core', 'biotwin_plus'));

COMMENT ON COLUMN public.profiles.consumer_action_plan_mode IS
  'Action plan rendering mode. core = interpreter-safe (no doses, no medication changes, no titration). biotwin_plus = clinician-supervised richer protocol objects. Constitutional anchor 1 governs core.';