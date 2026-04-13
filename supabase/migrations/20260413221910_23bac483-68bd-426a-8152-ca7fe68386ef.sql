-- Fix RLS policies on clusters and cluster_evidence to join through profiles.
-- The original policies compared patient_id (which is profiles.id) against
-- auth.uid() (which is profiles.user_id). These are different uuid namespaces
-- so the policies returned zero rows for every authenticated read.

-- Drop the broken SELECT policies
DROP POLICY IF EXISTS "Patients can read their own clusters" ON public.clusters;
DROP POLICY IF EXISTS "Patients can read evidence for their own clusters" ON public.cluster_evidence;

-- Recreate with profile join
CREATE POLICY "Patients can read their own clusters"
  ON public.clusters FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = clusters.patient_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can read evidence for their own clusters"
  ON public.cluster_evidence FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clusters
      INNER JOIN public.profiles ON profiles.id = clusters.patient_id
      WHERE clusters.id = cluster_evidence.cluster_id
        AND profiles.user_id = auth.uid()
    )
  );