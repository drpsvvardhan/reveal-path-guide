-- ============================================================================
-- Intent Passport — person priorities, never biological claims
-- ----------------------------------------------------------------------------
-- Five free-text answers ("What do you want your Twin to help you
-- understand?"). ~90 seconds, not another medical questionnaire — the CIE
-- is the scientific questionnaire.
--
-- HARD INVARIANT (docs/ASK_MY_TWIN_CONSTITUTION.md rule 9): this table may
-- affect explanation, ordering, suggested questions, and UX emphasis. It
-- may NEVER affect truth status, evidence strength, severity, admission,
-- contradiction resolution, or biological causality. Patient attention is
-- not biological evidence; biological severity is not automatically
-- personal priority. Both maps stay visible; neither erases the other.
-- ============================================================================

CREATE TABLE public.patient_intent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,

  -- The five questions, stored as the person's own words.
  think_about_most text,      -- What are the health questions you think about most?
  want_to_understand text,    -- What would you most like to understand about your body?
  unexplained_result text,    -- Is there a test or result nobody has explained clearly enough?
  ninety_day_change text,     -- What would you most like to change over the next 3 months?
  doctors_missing text,       -- Is there anything you worry your doctors may be missing?

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.patient_intent_profiles IS
  'Person priorities in their own words. Zero truth authority: shapes presentation and suggested questions only, never evidence, severity, or admission.';

ALTER TABLE public.patient_intent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own intent profile"
  ON public.patient_intent_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own intent profile"
  ON public.patient_intent_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own intent profile"
  ON public.patient_intent_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all intent profiles"
  ON public.patient_intent_profiles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

REVOKE ALL ON public.patient_intent_profiles FROM anon;
