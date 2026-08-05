-- ============================================================================
-- BioTwin Clinical Evidence Report — governed source + evidence-object store
-- ----------------------------------------------------------------------------
-- STATUS: NOT APPLIED. Held here deliberately. supabase/migrations/ is managed
-- by the migration tool, and this change set was implemented under an explicit
-- "do not migrate the live database" instruction. To apply it later, run this
-- SQL verbatim through the database migration tool.
--
-- Additive only. No enum values are added and no existing object is altered,
-- so rollback is: drop the two tables, drop the helper function, and delete the
-- witness_signal_registry rows whose registry_seed_version is 'biotwin_v1'.
-- See the ROLLBACK block at the bottom.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. biotwin_reports — the patient-bound governed source
-- ---------------------------------------------------------------------------

CREATE TABLE public.biotwin_reports (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL,
  upload_id                uuid REFERENCES public.patient_lab_uploads(id) ON DELETE SET NULL,
  twin_id                  text,
  schema_name              text NOT NULL,
  schema_version           text,
  report_type              text NOT NULL,
  semantic_repair_version  text,
  generated_date           text,
  content_sha256           text NOT NULL,
  version                  integer NOT NULL DEFAULT 1,
  status                   text NOT NULL DEFAULT 'active',
  release_control          jsonb NOT NULL DEFAULT '{}'::jsonb,
  executive_synthesis      jsonb NOT NULL DEFAULT '{}'::jsonb,
  attestation              jsonb NOT NULL DEFAULT '{}'::jsonb,
  holds                    text[] NOT NULL DEFAULT ARRAY[]::text[],
  clinician_review_required boolean NOT NULL DEFAULT true,
  patient_release_permitted boolean NOT NULL DEFAULT false,
  adapter_version          text NOT NULL,
  import_diagnostics       jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_report               jsonb NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT biotwin_reports_status_valid
    CHECK (status IN ('active', 'superseded', 'rejected')),
  CONSTRAINT biotwin_reports_schema_locked
    CHECK (schema_name = 'Vizzhy BioTwin Clinical Evidence Report'
           AND report_type = 'FINAL_CORRECTED_CLINICAL_EVIDENCE_REPORT')
);

-- Idempotent re-import: the same bytes for the same user is one report.
CREATE UNIQUE INDEX biotwin_reports_user_content_uniq
  ON public.biotwin_reports (user_id, content_sha256);

-- Exactly one active report per user.
CREATE UNIQUE INDEX biotwin_reports_one_active_per_user
  ON public.biotwin_reports (user_id)
  WHERE status = 'active';

CREATE INDEX biotwin_reports_user_idx ON public.biotwin_reports (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biotwin_reports TO authenticated;
GRANT ALL ON public.biotwin_reports TO service_role;
-- Deliberately NO grant to anon: BioTwin data must never reach public routes.

ALTER TABLE public.biotwin_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own biotwin reports"
  ON public.biotwin_reports FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read biotwin reports"
  ON public.biotwin_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read biotwin reports under view-as"
  ON public.biotwin_reports FOR SELECT TO authenticated
  USING (public.has_valid_view_as_session(auth.uid(), user_id));

-- ---------------------------------------------------------------------------
-- 2. biotwin_statements — the governed evidence-object store
-- ---------------------------------------------------------------------------

CREATE TABLE public.biotwin_statements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             uuid NOT NULL REFERENCES public.biotwin_reports(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL,
  source_id             text NOT NULL,
  section               text NOT NULL,
  statement_kind        text NOT NULL,
  truth_status          text NOT NULL,
  title                 text NOT NULL,
  body                  text,
  bounds                text[] NOT NULL DEFAULT ARRAY[]::text[],
  measurements          jsonb NOT NULL DEFAULT '[]'::jsonb,
  timepoint             text,
  clinical_authority    text NOT NULL,
  requires_measurement  jsonb,
  holds                 text[] NOT NULL DEFAULT ARRAY[]::text[],
  provenance            jsonb NOT NULL DEFAULT '{}'::jsonb,
  witness_id            uuid REFERENCES public.witness_objects(witness_id) ON DELETE SET NULL,
  ordinal               integer NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT biotwin_statements_truth_status_valid
    CHECK (truth_status IN ('confirmed', 'candidate', 'unknown', 'retired', 'prohibited')),
  CONSTRAINT biotwin_statements_authority_valid
    CHECK (clinical_authority IN ('patient_facing', 'clinician_only', 'research_only', 'prohibited'))
);

CREATE UNIQUE INDEX biotwin_statements_report_source_uniq
  ON public.biotwin_statements (report_id, source_id);

CREATE INDEX biotwin_statements_user_idx ON public.biotwin_statements (user_id, report_id);
CREATE INDEX biotwin_statements_truth_idx ON public.biotwin_statements (report_id, truth_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biotwin_statements TO authenticated;
GRANT ALL ON public.biotwin_statements TO service_role;
-- Deliberately NO grant to anon.

ALTER TABLE public.biotwin_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own biotwin statements"
  ON public.biotwin_statements FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read biotwin statements"
  ON public.biotwin_statements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read biotwin statements under view-as"
  ON public.biotwin_statements FOR SELECT TO authenticated
  USING (public.has_valid_view_as_session(auth.uid(), user_id));

-- ---------------------------------------------------------------------------
-- 3. Supersede trigger + updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.supersede_previous_active_biotwin_report()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.biotwin_reports
       SET status = 'superseded', updated_at = now()
     WHERE user_id = NEW.user_id
       AND status = 'active'
       AND id <> NEW.id;

    SELECT COALESCE(MAX(version), 0) + 1
      INTO NEW.version
      FROM public.biotwin_reports
     WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER supersede_biotwin_report_trigger
  BEFORE INSERT ON public.biotwin_reports
  FOR EACH ROW EXECUTE FUNCTION public.supersede_previous_active_biotwin_report();

CREATE TRIGGER biotwin_reports_updated_at
  BEFORE UPDATE ON public.biotwin_reports
  FOR EACH ROW EXECUTE FUNCTION public.rae_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Pre-registered biotwin_v1 witness signals
--
-- An uploaded report can NEVER register a signal. Only these rows exist and
-- they are authored here, in migration, reviewed by a human. They mirror
-- BIOTWIN_WITNESS_ALLOWLIST in
-- supabase/functions/_shared/biotwin/allowlist.ts exactly.
-- ---------------------------------------------------------------------------

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  label, unit, description, default_limitations, default_confidence_basis,
  default_confidence_value, default_validity_window_seconds, compression_depth,
  registry_seed_version
)
VALUES
  ('emr', 'biotwin_ldl_c', 'lipid_composition', 'direct_measure', 'high',
   'BioTwin: LDL cholesterol', 'mg/dL',
   'Confirmed LDL-C measurement imported from a governed BioTwin clinical evidence report.',
   ARRAY['Single laboratory timepoint as bounded by the imported report','Method bridging across laboratories is not guaranteed'],
   'Confirmed measurement in a governed BioTwin clinical evidence report, bounded by the report''s declared limits.',
   0.800, 7776000, 0, 'biotwin_v1'),
  ('emr', 'biotwin_non_hdl_c', 'lipid_composition', 'direct_measure', 'high',
   'BioTwin: non-HDL cholesterol', 'mg/dL',
   'Confirmed non-HDL-C measurement imported from a governed BioTwin clinical evidence report.',
   ARRAY['Single laboratory timepoint as bounded by the imported report','Derived from a lipid panel rather than measured directly'],
   'Confirmed measurement in a governed BioTwin clinical evidence report, bounded by the report''s declared limits.',
   0.800, 7776000, 0, 'biotwin_v1'),
  ('emr', 'biotwin_apob', 'lipid_composition', 'direct_measure', 'high',
   'BioTwin: apolipoprotein B', 'mg/dL',
   'Confirmed ApoB measurement imported from a governed BioTwin clinical evidence report.',
   ARRAY['Single laboratory timepoint as bounded by the imported report','Assay method not always declared in the source report'],
   'Confirmed measurement in a governed BioTwin clinical evidence report, bounded by the report''s declared limits.',
   0.800, 7776000, 0, 'biotwin_v1'),
  ('emr', 'biotwin_ldl_p', 'lipid_composition', 'direct_measure', 'medium',
   'BioTwin: LDL particle number', 'nmol/L',
   'Confirmed LDL-P measurement imported from a governed BioTwin clinical evidence report.',
   ARRAY['Particle assays vary by platform and are not method-bridged','Single laboratory timepoint as bounded by the imported report'],
   'Confirmed measurement in a governed BioTwin clinical evidence report, bounded by the report''s declared limits.',
   0.750, 7776000, 0, 'biotwin_v1'),
  ('emr', 'biotwin_small_ldl_p', 'lipid_composition', 'direct_measure', 'medium',
   'BioTwin: small LDL particle number', 'nmol/L',
   'Confirmed small LDL-P measurement imported from a governed BioTwin clinical evidence report.',
   ARRAY['Particle subfraction assays vary by platform','Single laboratory timepoint as bounded by the imported report'],
   'Confirmed measurement in a governed BioTwin clinical evidence report, bounded by the report''s declared limits.',
   0.700, 7776000, 0, 'biotwin_v1'),
  ('emr', 'biotwin_lp_a', 'lipid_composition', 'direct_measure', 'high',
   'BioTwin: lipoprotein(a)', 'nmol/L',
   'Confirmed Lp(a) measurement imported from a governed BioTwin clinical evidence report.',
   ARRAY['KIV-2 copy number is not measured by mass or molar Lp(a) assays','Single laboratory timepoint as bounded by the imported report'],
   'Confirmed measurement in a governed BioTwin clinical evidence report, bounded by the report''s declared limits.',
   0.800, 31536000, 0, 'biotwin_v1'),
  ('emr', 'biotwin_hs_crp', 'biochemical_state_snapshot', 'direct_measure', 'medium',
   'BioTwin: high-sensitivity CRP', 'mg/L',
   'Confirmed hs-CRP measurement imported from a governed BioTwin clinical evidence report.',
   ARRAY['Non-specific; transient inflammation cannot be excluded from one value','Single laboratory timepoint as bounded by the imported report'],
   'Confirmed measurement in a governed BioTwin clinical evidence report, bounded by the report''s declared limits.',
   0.650, 2592000, 0, 'biotwin_v1'),
  ('emr', 'biotwin_hba1c', 'biochemical_state_snapshot', 'direct_measure', 'high',
   'BioTwin: HbA1c', '%',
   'Confirmed HbA1c measurement imported from a governed BioTwin clinical evidence report.',
   ARRAY['Reflects roughly three months of exposure, not a current glucose state','Haemoglobin variants and anaemia can distort the result'],
   'Confirmed measurement in a governed BioTwin clinical evidence report, bounded by the report''s declared limits.',
   0.850, 7776000, 0, 'biotwin_v1'),
  ('emr', 'biotwin_tsh', 'biochemical_state_snapshot', 'direct_measure', 'high',
   'BioTwin: thyroid stimulating hormone', 'uIU/mL',
   'Confirmed TSH measurement imported from a governed BioTwin clinical evidence report.',
   ARRAY['Diurnal variation and acute illness affect the value','Treatment status may be unreconciled in the source report'],
   'Confirmed measurement in a governed BioTwin clinical evidence report, bounded by the report''s declared limits.',
   0.800, 7776000, 0, 'biotwin_v1'),
  ('emr', 'biotwin_fasting_glucose', 'biochemical_state_snapshot', 'direct_measure', 'high',
   'BioTwin: fasting plasma glucose', 'mg/dL',
   'Confirmed fasting glucose measurement imported from a governed BioTwin clinical evidence report.',
   ARRAY['Fasting state is asserted by the source report and not independently verified','Single laboratory timepoint as bounded by the imported report'],
   'Confirmed measurement in a governed BioTwin clinical evidence report, bounded by the report''s declared limits.',
   0.850, 2592000, 0, 'biotwin_v1')
ON CONFLICT (source_window, signal) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ROLLBACK (run as a separate migration if this needs to be undone)
--
--   DROP TRIGGER IF EXISTS supersede_biotwin_report_trigger ON public.biotwin_reports;
--   DROP TRIGGER IF EXISTS biotwin_reports_updated_at ON public.biotwin_reports;
--   DROP TABLE IF EXISTS public.biotwin_statements;
--   DROP TABLE IF EXISTS public.biotwin_reports;
--   DROP FUNCTION IF EXISTS public.supersede_previous_active_biotwin_report();
--   DELETE FROM public.witness_objects WHERE registry_seed_version = 'biotwin_v1';
--   DELETE FROM public.witness_signal_registry WHERE registry_seed_version = 'biotwin_v1';
--
-- No enum, column or policy belonging to the existing app is touched, so the
-- rollback restores the prior state exactly.
-- ---------------------------------------------------------------------------