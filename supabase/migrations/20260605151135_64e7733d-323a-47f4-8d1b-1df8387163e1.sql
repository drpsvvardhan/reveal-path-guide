
-- 1. user_roles: prevent privilege escalation
CREATE POLICY "user_roles_block_insert_auth" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "user_roles_block_update_auth" ON public.user_roles
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "user_roles_block_delete_auth" ON public.user_roles
  FOR DELETE TO authenticated USING (false);

-- 2. patient_chat_validation_log: block writes from authenticated
CREATE POLICY "chat_validation_log_block_insert_auth" ON public.patient_chat_validation_log
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "chat_validation_log_block_update_auth" ON public.patient_chat_validation_log
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "chat_validation_log_block_delete_auth" ON public.patient_chat_validation_log
  FOR DELETE TO authenticated USING (false);

-- 3. ontology_concept_proposals: explicit deny for non-admin writes
CREATE POLICY "ontology_proposals_block_insert_non_admin" ON public.ontology_concept_proposals
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ontology_proposals_block_update_non_admin" ON public.ontology_concept_proposals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ontology_proposals_block_delete_non_admin" ON public.ontology_concept_proposals
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. review_queue_audit_log: explicit deny on writes for non-admin
CREATE POLICY "review_audit_block_insert_non_admin" ON public.review_queue_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "review_audit_block_update_non_admin" ON public.review_queue_audit_log
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "review_audit_block_delete_non_admin" ON public.review_queue_audit_log
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. upload_rejection_audit: block INSERT/UPDATE for authenticated (DELETE already blocked)
CREATE POLICY "rejection_audit_block_insert_auth" ON public.upload_rejection_audit
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "rejection_audit_block_update_auth" ON public.upload_rejection_audit
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

-- 6. Recreate witness coverage view with security_invoker so it uses caller's RLS
DROP VIEW IF EXISTS public.v_witness_coverage;
CREATE VIEW public.v_witness_coverage
WITH (security_invoker = true) AS
SELECT user_id,
       source_window,
       domain_of_access,
       epistemic_role,
       compression_depth,
       signal,
       count(*) AS witness_count,
       min(biological_timestamp) AS earliest_observation,
       max(biological_timestamp) AS latest_observation,
       (avg(confidence_value))::numeric(4,3) AS mean_confidence
FROM public.witness_objects
GROUP BY user_id, source_window, domain_of_access, epistemic_role, compression_depth, signal;

GRANT SELECT ON public.v_witness_coverage TO authenticated;
GRANT SELECT ON public.v_witness_coverage TO service_role;

-- 7. Ontology bucket: restrict broad listing — only allow fetching the known file by exact name.
DROP POLICY IF EXISTS "Ontology is publicly readable" ON storage.objects;
CREATE POLICY "Ontology file readable by exact name"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'ontology' AND name = 'biomarker_ontology.json');
