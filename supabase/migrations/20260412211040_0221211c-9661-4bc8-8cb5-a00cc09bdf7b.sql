
CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  assessment_id UUID REFERENCES public.cie_assessments(id),
  version INTEGER NOT NULL DEFAULT 1,
  today_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  sequence_explanation TEXT,
  retest_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own action plans"
  ON public.action_plans FOR SELECT TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own action plans"
  ON public.action_plans FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own action plans"
  ON public.action_plans FOR UPDATE TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert action plans"
  ON public.action_plans FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update action plans"
  ON public.action_plans FOR UPDATE TO service_role
  USING (true);

CREATE POLICY "Admins can read all action plans"
  ON public.action_plans FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.next_action_plan_version(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_v INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_v
  FROM public.action_plans
  WHERE user_id = p_user_id;
  RETURN next_v;
END;
$$;

CREATE OR REPLACE FUNCTION public.supersede_previous_active_action_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.action_plans
    SET status = 'superseded'
    WHERE user_id = NEW.user_id
      AND status = 'active'
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER supersede_action_plan_trigger
  BEFORE INSERT ON public.action_plans
  FOR EACH ROW
  EXECUTE FUNCTION supersede_previous_active_action_plan();
