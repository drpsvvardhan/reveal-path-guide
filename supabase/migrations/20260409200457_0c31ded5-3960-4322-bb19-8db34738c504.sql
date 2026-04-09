
CREATE TABLE public.action_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, action_key, completed_date)
);

ALTER TABLE public.action_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own completions" ON public.action_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own completions" ON public.action_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own completions" ON public.action_completions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_action_completions_user_date ON public.action_completions (user_id, completed_date);
