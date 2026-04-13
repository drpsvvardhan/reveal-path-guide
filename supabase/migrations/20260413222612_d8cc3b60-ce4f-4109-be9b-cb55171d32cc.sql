-- Add admin read policies for clusters and cluster_evidence
-- to match the pattern on patient_lab_uploads / patient_lab_observations

CREATE POLICY "Admins can read all clusters"
  ON public.clusters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read all cluster evidence"
  ON public.cluster_evidence FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));