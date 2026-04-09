
-- Food logs table
CREATE TABLE public.food_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT NOT NULL DEFAULT 'pt-001',
  entry TEXT NOT NULL,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read food logs" ON public.food_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert food logs" ON public.food_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete food logs" ON public.food_logs FOR DELETE USING (true);

-- Voice notes table
CREATE TABLE public.voice_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT NOT NULL DEFAULT 'pt-001',
  transcript TEXT NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read voice notes" ON public.voice_notes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert voice notes" ON public.voice_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete voice notes" ON public.voice_notes FOR DELETE USING (true);
