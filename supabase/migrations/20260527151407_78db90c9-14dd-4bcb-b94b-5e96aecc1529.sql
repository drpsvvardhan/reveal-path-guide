
-- 1. Drop overly broad public read policies
DROP POLICY IF EXISTS "Public can read profile by terrain_share_token" ON public.profiles;
DROP POLICY IF EXISTS "Public can read terrain renders via share token" ON public.terrain_renders;
DROP POLICY IF EXISTS "Public can read queued questions via share token" ON public.patient_question_queue;

-- 2. Restrict "Service role" policies that were mistakenly granted to public
DROP POLICY IF EXISTS "Service role can insert patterns" ON public.derived_patterns;
CREATE POLICY "Service role can insert patterns"
  ON public.derived_patterns
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert observations" ON public.patient_lab_observations;
CREATE POLICY "Service role can insert observations"
  ON public.patient_lab_observations
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert uploads" ON public.patient_lab_uploads;
CREATE POLICY "Service role can insert uploads"
  ON public.patient_lab_uploads
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update uploads" ON public.patient_lab_uploads;
CREATE POLICY "Service role can update uploads"
  ON public.patient_lab_uploads
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert narratives" ON public.patient_narratives;
CREATE POLICY "Service role can insert narratives"
  ON public.patient_narratives
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3. Token-scoped lookup RPCs for share-link pages.
-- These return ONLY the row whose token matches the caller-supplied value.

CREATE OR REPLACE FUNCTION public.get_shared_clinical_summary(p_token uuid)
RETURNS TABLE (
  display_name text,
  first_name text,
  preferred_name text,
  age int,
  sex text,
  clinician_summary jsonb,
  generated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.display_name,
    p.first_name,
    p.preferred_name,
    p.age,
    p.sex,
    tr.clinician_summary,
    tr.generated_at
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT clinician_summary, generated_at
    FROM public.terrain_renders
    WHERE user_id = p.user_id
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  ) tr ON true
  WHERE p.terrain_share_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_shared_clinical_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_clinical_summary(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_question_queue(p_token uuid)
RETURNS TABLE (
  display_name text,
  question_id uuid,
  question text,
  rationale text,
  source text,
  priority int,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.display_name,
    q.id AS question_id,
    q.question,
    q.rationale,
    q.source,
    q.priority,
    q.created_at
  FROM public.profiles p
  LEFT JOIN public.patient_question_queue q
    ON q.user_id = p.user_id
   AND q.status = 'queued'
  WHERE p.share_token = p_token
  ORDER BY q.priority ASC NULLS LAST, q.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_shared_question_queue(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_question_queue(uuid) TO anon, authenticated;
