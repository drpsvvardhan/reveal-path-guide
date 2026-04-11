
-- Function to auto-increment terrain render version per user
CREATE OR REPLACE FUNCTION public.next_terrain_render_version(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_v INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_v
  FROM public.terrain_renders
  WHERE user_id = p_user_id;
  RETURN next_v;
END;
$$;

-- Create terrain_renders table
CREATE TABLE public.terrain_renders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  assessment_id uuid REFERENCES public.cie_assessments(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'generating',
  patient_portrait jsonb,
  clinician_summary jsonb,
  generation_input_hash text,
  error_message text,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_terrain_render_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('generating', 'active', 'superseded', 'failed') THEN
    RAISE EXCEPTION 'terrain_renders.status must be one of: generating, active, superseded, failed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_terrain_render_status_trigger
BEFORE INSERT OR UPDATE ON public.terrain_renders
FOR EACH ROW EXECUTE FUNCTION public.validate_terrain_render_status();

-- Supersede previous active renders on new active insert
CREATE OR REPLACE FUNCTION public.supersede_previous_active_terrain_render()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.terrain_renders
    SET status = 'superseded'
    WHERE user_id = NEW.user_id
      AND status = 'active'
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER supersede_terrain_render_trigger
BEFORE INSERT OR UPDATE ON public.terrain_renders
FOR EACH ROW EXECUTE FUNCTION public.supersede_previous_active_terrain_render();

-- Updated_at trigger
CREATE TRIGGER update_terrain_render_timestamp
BEFORE UPDATE ON public.terrain_renders
FOR EACH ROW EXECUTE FUNCTION public.update_lab_upload_timestamp();

-- Enable RLS
ALTER TABLE public.terrain_renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own terrain renders"
ON public.terrain_renders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own terrain renders"
ON public.terrain_renders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own terrain renders"
ON public.terrain_renders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own terrain renders"
ON public.terrain_renders FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert terrain renders"
ON public.terrain_renders FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update terrain renders"
ON public.terrain_renders FOR UPDATE
TO service_role
USING (true);

-- Add terrain_share_token to profiles
ALTER TABLE public.profiles
ADD COLUMN terrain_share_token uuid UNIQUE DEFAULT NULL;
