-- ============================================================================
-- P1a — WITNESS SIGNAL REGISTRY SEED
-- ============================================================================
-- Generator: scripts/build-witness-registry.ts
-- CIE seed version: 2.2.0
-- Ontology version: celf-ontology-v1.0
-- Registry seed version: p1a_initial
--
-- This SQL is the constitutional artifact for the P1a witness signal
-- registry. Once committed, it freezes the canonical seed. The live
-- ontology bucket is source for generation but is no longer source of
-- truth for this migration.
--
-- Regeneration from the same ontology version + CIE seed version MUST
-- produce a byte-identical file. Use --diff-against to verify.
--
-- Entry counts:
--   CIE responses:      325
--   CIE domain scores:  25
--   CIE gate scores:    9
--   Lab concepts:       173
--   InBody concepts:    19
--   FibroScan concepts: 3
--   Total:              554
--
-- Hold: P1a does not make the system smarter. It makes future
-- intelligence lawful.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Double-seed guard: if any rows already exist for this registry_seed_version,
-- fail loudly rather than silently insert duplicates. A partial registry is
-- worse than no registry; the migration must be a clean idempotent commit.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_count
  FROM public.witness_signal_registry
  WHERE registry_seed_version = 'p1a_initial';
  IF existing_count > 0 THEN
    RAISE EXCEPTION 'registry_seed_version p1a_initial already has % rows in witness_signal_registry. Aborting to avoid duplicate seeding.', existing_count;
  END IF;
END $$;


-- ========================================================================
-- BLOCK: CIE responses (direct self-report, compression_depth = 0)
-- Count: 325
-- ========================================================================

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1D1: Do you experience unexplained fatigue, especially after meals?',
  NULL,
  'Individual CIE frequency response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1D10: How often do you experience nausea or loss of appetite?',
  NULL,
  'Individual CIE frequency response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1D2: Have you noticed any yellowing of skin or eyes (jaundice)?',
  NULL,
  'Individual CIE yesno response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1D3: Do you have a history of hepatitis (A, B, or C)?',
  NULL,
  'Individual CIE yesno response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1D4: Have you been diagnosed with fatty liver disease (NAFLD/NASH)?',
  NULL,
  'Individual CIE yesno response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1D5: Do you take medications that can affect liver function (statins, acetaminophen regularly)?',
  NULL,
  'Individual CIE yesno response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1D6: How would you rate your exposure to environmental toxins (chemicals, pesticides, solvents)?',
  NULL,
  'Individual CIE severity response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Subjective severity scales vary across individuals and contexts']::TEXT[],
  'Self-report via a structured severity scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  604800,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1D7: Do you experience itchy skin without visible rash?',
  NULL,
  'Individual CIE frequency response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1D8: Have you had any imaging (ultrasound, CT, MRI) of your liver?',
  NULL,
  'Individual CIE yesno response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1D9: Do you have spider angiomas (small red spider-like blood vessels on skin)?',
  NULL,
  'Individual CIE yesno response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1Q1: How often do you experience digestive discomfort after fatty meals?',
  NULL,
  'Individual CIE frequency response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1Q2: Have you been told you have elevated liver enzymes?',
  NULL,
  'Individual CIE yesno response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A1Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A1Q3: Do you consume more than 2 alcoholic drinks per day on average?',
  NULL,
  'Individual CIE yesno response, domain A1 (Liver/Hepatic Flux), axis A — Metabolic, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2D1: Do you experience excessive thirst (polydipsia)?',
  NULL,
  'Individual CIE frequency response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2D10: Do wounds or infections take longer to heal than before?',
  NULL,
  'Individual CIE yesno response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2D2: Do you urinate more frequently than usual (polyuria)?',
  NULL,
  'Individual CIE frequency response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2D3: Have you noticed darkened skin patches in body folds (acanthosis nigricans)?',
  NULL,
  'Individual CIE yesno response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2D4: Is there a family history of diabetes in first-degree relatives?',
  NULL,
  'Individual CIE yesno response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2D5: How often do you experience brain fog after high-carb meals?',
  NULL,
  'Individual CIE frequency response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2D6: Have you been tested for HbA1c or fasting glucose recently?',
  NULL,
  'Individual CIE yesno response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2D7: Do you experience unexplained weight loss despite eating normally?',
  NULL,
  'Individual CIE yesno response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2D8: Have you had a glucose tolerance test (OGTT)?',
  NULL,
  'Individual CIE yesno response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2D9: Do you experience blurred vision that comes and goes?',
  NULL,
  'Individual CIE frequency response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2Q1: Do you experience energy crashes or shakiness between meals?',
  NULL,
  'Individual CIE frequency response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2Q2: Have you been diagnosed with prediabetes or diabetes?',
  NULL,
  'Individual CIE yesno response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A2Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A2Q3: Do you crave sugary or starchy foods frequently?',
  NULL,
  'Individual CIE frequency response, domain A2 (Pancreas/Insulin Signaling), axis A — Metabolic, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3D1: Do you carry most of your weight around your midsection (apple shape)?',
  NULL,
  'Individual CIE yesno response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3D10: Do you experience hunger that feels uncontrollable?',
  NULL,
  'Individual CIE frequency response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3D2: Have you been diagnosed with metabolic syndrome?',
  NULL,
  'Individual CIE yesno response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3D3: Do you experience joint pain that worsens with weight?',
  NULL,
  'Individual CIE frequency response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3D4: How would you rate your body''s response to caloric restriction?',
  NULL,
  'Individual CIE effectiveness response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3D5: Have you had body composition analysis (DEXA, BIA)?',
  NULL,
  'Individual CIE yesno response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3D6: Do you have a family history of obesity?',
  NULL,
  'Individual CIE yesno response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3D7: Have you experienced yo-yo dieting (repeated weight loss and regain)?',
  NULL,
  'Individual CIE yesno response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3D8: Do you have lipomas (fatty lumps under the skin)?',
  NULL,
  'Individual CIE yesno response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3D9: Have you been diagnosed with lipedema or lymphedema?',
  NULL,
  'Individual CIE yesno response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3Q1: Is your waist circumference greater than 40 inches (men) or 35 inches (women)?',
  NULL,
  'Individual CIE yesno response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3Q2: Do you find it difficult to lose weight despite diet and exercise?',
  NULL,
  'Individual CIE frequency response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.A3Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE A3Q3: Have you experienced significant weight fluctuations (>10 lbs) in the past year?',
  NULL,
  'Individual CIE yesno response, domain A3 (Adipose/Fat Signaling), axis A — Metabolic, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4D1: Do you experience numbness or tingling in extremities?',
  NULL,
  'Individual CIE frequency response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4D10: Have you noticed changes in nail texture or color on feet?',
  NULL,
  'Individual CIE yesno response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4D2: Have you been diagnosed with Raynaud''s phenomenon?',
  NULL,
  'Individual CIE yesno response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4D3: Do cuts or bruises take longer than expected to heal?',
  NULL,
  'Individual CIE yesno response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4D4: How often do you experience leg cramps or restless legs?',
  NULL,
  'Individual CIE frequency response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4D5: Do you have discoloration in your lower legs (brown spots, red patches)?',
  NULL,
  'Individual CIE yesno response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4D6: Have you been diagnosed with peripheral artery disease (PAD)?',
  NULL,
  'Individual CIE yesno response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4D7: Do you experience pain in your legs when walking that resolves with rest?',
  NULL,
  'Individual CIE frequency response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4D8: Have you had ankle-brachial index (ABI) testing?',
  NULL,
  'Individual CIE yesno response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4D9: Do you have erectile dysfunction (if applicable)?',
  NULL,
  'Individual CIE yesno response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4Q1: Do you experience cold hands or feet regularly?',
  NULL,
  'Individual CIE frequency response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4Q2: Have you noticed any changes in wound healing speed?',
  NULL,
  'Individual CIE yesno response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B4Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B4Q3: Do you have visible spider veins or varicose veins?',
  NULL,
  'Individual CIE yesno response, domain B4 (Endothelium/Microcirculation), axis B — Cardiovascular, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5D1: Do you experience chest pain, pressure, or tightness?',
  NULL,
  'Individual CIE frequency response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5D10: Have you ever had sudden cardiac death in your family?',
  NULL,
  'Individual CIE yesno response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5D2: Have you ever fainted (syncope) or nearly fainted?',
  NULL,
  'Individual CIE yesno response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5D3: Is there a family history of heart disease before age 55 (men) or 65 (women)?',
  NULL,
  'Individual CIE yesno response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5D4: How would you rate your exercise tolerance compared to peers?',
  NULL,
  'Individual CIE comparison response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Comparative self-report depends on accurate recall of prior state']::TEXT[],
  'Self-report via a structured comparison scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5D5: Have you had an EKG/ECG in the past 2 years?',
  NULL,
  'Individual CIE yesno response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5D6: Have you had an echocardiogram?',
  NULL,
  'Individual CIE yesno response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5D7: Do you experience swelling in ankles or feet?',
  NULL,
  'Individual CIE frequency response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5D8: Have you been diagnosed with heart murmur?',
  NULL,
  'Individual CIE yesno response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5D9: Do you experience shortness of breath when lying flat?',
  NULL,
  'Individual CIE frequency response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5Q1: Do you experience heart palpitations or irregular heartbeat?',
  NULL,
  'Individual CIE frequency response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5Q2: Have you been diagnosed with any heart condition?',
  NULL,
  'Individual CIE yesno response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B5Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B5Q3: Do you experience shortness of breath during mild exertion?',
  NULL,
  'Individual CIE frequency response, domain B5 (Heart/Autonomic Flow), axis B — Cardiovascular, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6D1: Do you experience morning stiffness lasting more than 30 minutes?',
  NULL,
  'Individual CIE frequency response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6D10: Do you have unexplained fevers or night sweats?',
  NULL,
  'Individual CIE frequency response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6D2: Have you been diagnosed with elevated homocysteine?',
  NULL,
  'Individual CIE yesno response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6D3: Do you have chronic infections or recurring illness?',
  NULL,
  'Individual CIE yesno response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6D4: How would you rate your overall inflammatory burden?',
  NULL,
  'Individual CIE severity response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Subjective severity scales vary across individuals and contexts']::TEXT[],
  'Self-report via a structured severity scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  604800,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6D5: Have you been tested for Lp-PLA2 or oxidized LDL?',
  NULL,
  'Individual CIE yesno response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6D6: Do you have periodontal (gum) disease?',
  NULL,
  'Individual CIE yesno response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6D7: Have you been diagnosed with psoriasis or eczema?',
  NULL,
  'Individual CIE yesno response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6D8: Do you experience frequent joint or muscle pain?',
  NULL,
  'Individual CIE frequency response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6D9: Have you been tested for ANA (antinuclear antibodies)?',
  NULL,
  'Individual CIE yesno response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6Q1: Have you been told you have elevated CRP or inflammatory markers?',
  NULL,
  'Individual CIE yesno response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6Q2: Do you experience persistent low-grade symptoms (fatigue, aches)?',
  NULL,
  'Individual CIE frequency response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.B6Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE B6Q3: Do you have a history of autoimmune conditions?',
  NULL,
  'Individual CIE yesno response, domain B6 (Vascular Inflammation), axis B — Cardiovascular, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7D1: Do you experience a ''second wind'' of energy late at night (after 10pm)?',
  NULL,
  'Individual CIE frequency response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7D10: Do you experience hypoglycemia (low blood sugar) symptoms under stress?',
  NULL,
  'Individual CIE frequency response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7D2: Have you been diagnosed with adrenal fatigue or HPA axis dysfunction?',
  NULL,
  'Individual CIE yesno response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7D3: Do you crave salt or salty foods?',
  NULL,
  'Individual CIE frequency response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7D4: How would you rate your stress recovery ability?',
  NULL,
  'Individual CIE effectiveness response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7D5: Have you had cortisol testing (saliva, blood, or urine)?',
  NULL,
  'Individual CIE yesno response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7D6: Do you feel lightheaded when standing up quickly?',
  NULL,
  'Individual CIE frequency response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7D7: Have you experienced significant weight gain during stressful periods?',
  NULL,
  'Individual CIE yesno response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7D8: Do you have difficulty handling everyday stressors that used to be manageable?',
  NULL,
  'Individual CIE frequency response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7D9: Have you been diagnosed with chronic fatigue syndrome?',
  NULL,
  'Individual CIE yesno response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7Q1: Do you feel ''wired but tired'' - exhausted yet unable to relax?',
  NULL,
  'Individual CIE frequency response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7Q2: Do you rely on caffeine to get through the day?',
  NULL,
  'Individual CIE frequency response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C7Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C7Q3: Have you experienced prolonged periods of high stress?',
  NULL,
  'Individual CIE yesno response, domain C7 (Adrenal/Stress Response), axis C — Neuroendocrine, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8D1: Do you experience muscle weakness or post-exertional malaise?',
  NULL,
  'Individual CIE frequency response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8D10: Do you take any supplements for energy (CoQ10, B vitamins, carnitine)?',
  NULL,
  'Individual CIE yesno response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8D2: Have you been tested for CoQ10 levels?',
  NULL,
  'Individual CIE yesno response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8D3: Do you have a history of long-term statin use?',
  NULL,
  'Individual CIE yesno response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8D4: How would you rate your cellular energy levels throughout the day?',
  NULL,
  'Individual CIE effectiveness response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8D5: Have you had organic acids testing?',
  NULL,
  'Individual CIE yesno response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8D6: Do you experience exercise intolerance (unable to sustain exercise)?',
  NULL,
  'Individual CIE frequency response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8D7: Have you been tested for carnitine levels?',
  NULL,
  'Individual CIE yesno response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8D8: Do you have brain fog that worsens with physical activity?',
  NULL,
  'Individual CIE frequency response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8D9: Have you been diagnosed with any mitochondrial disorder?',
  NULL,
  'Individual CIE yesno response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8Q1: Do you experience persistent fatigue not relieved by rest?',
  NULL,
  'Individual CIE frequency response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8Q2: Do you have difficulty with exercise recovery?',
  NULL,
  'Individual CIE frequency response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C8Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C8Q3: Have you been diagnosed with chronic fatigue syndrome or fibromyalgia?',
  NULL,
  'Individual CIE yesno response, domain C8 (Mitochondrial Energy), axis C — Neuroendocrine, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9D1: Do you experience dizziness or lightheadedness when standing up quickly?',
  NULL,
  'Individual CIE frequency response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9D10: Do you experience frequent urination or bladder issues?',
  NULL,
  'Individual CIE frequency response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9D2: Do you have digestive issues that worsen with stress?',
  NULL,
  'Individual CIE frequency response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9D3: Have you measured your heart rate variability (HRV)?',
  NULL,
  'Individual CIE yesno response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9D4: How would you rate your parasympathetic (rest/digest) function?',
  NULL,
  'Individual CIE effectiveness response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9D5: Do you experience abnormal sweating (too much or too little)?',
  NULL,
  'Individual CIE frequency response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9D6: Have you had a tilt table test?',
  NULL,
  'Individual CIE yesno response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9D7: Do you experience rapid heart rate upon standing (>30 bpm increase)?',
  NULL,
  'Individual CIE frequency response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9D8: Do you have difficulty with deep breathing or breath-holding?',
  NULL,
  'Individual CIE yesno response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9D9: Have you been diagnosed with irritable bowel syndrome (IBS)?',
  NULL,
  'Individual CIE yesno response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9Q1: Do you experience anxiety or panic symptoms?',
  NULL,
  'Individual CIE frequency response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9Q2: Do you have trouble with temperature regulation (always hot/cold)?',
  NULL,
  'Individual CIE frequency response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.C9Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE C9Q3: Have you been diagnosed with dysautonomia, POTS, or similar condition?',
  NULL,
  'Individual CIE yesno response, domain C9 (Autonomic Balance), axis C — Neuroendocrine, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10D1: Do you experience irregular bowel movements (constipation/diarrhea)?',
  NULL,
  'Individual CIE frequency response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10D10: Do you have a history of H. pylori infection?',
  NULL,
  'Individual CIE yesno response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10D2: Have you been diagnosed with SIBO (small intestinal bacterial overgrowth)?',
  NULL,
  'Individual CIE yesno response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10D3: Do you have a history of C. diff or other gut infections?',
  NULL,
  'Individual CIE yesno response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10D4: How would you rate your gut microbiome diversity?',
  NULL,
  'Individual CIE effectiveness response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10D5: Have you had stool testing (GI-MAP, comprehensive stool analysis)?',
  NULL,
  'Individual CIE yesno response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10D6: Do you experience acid reflux or heartburn regularly?',
  NULL,
  'Individual CIE frequency response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10D7: Have you been diagnosed with IBS, IBD, or Crohn''s disease?',
  NULL,
  'Individual CIE yesno response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10D8: Do you experience undigested food in your stool?',
  NULL,
  'Individual CIE frequency response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10D9: Have you tried probiotics or fermented foods? Did they help?',
  NULL,
  'Individual CIE effectiveness response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10Q1: Do you experience bloating, gas, or digestive discomfort regularly?',
  NULL,
  'Individual CIE frequency response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10Q2: Have you taken multiple courses of antibiotics in your life?',
  NULL,
  'Individual CIE yesno response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D10Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D10Q3: Do you have food sensitivities or intolerances?',
  NULL,
  'Individual CIE yesno response, domain D10 (Gut Ecology), axis D — Gut-Immune, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11D1: Do you react to multiple foods or environmental triggers?',
  NULL,
  'Individual CIE frequency response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11D10: Do you have multiple chemical sensitivities (MCS)?',
  NULL,
  'Individual CIE yesno response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11D2: Have you been tested for leaky gut (intestinal permeability)?',
  NULL,
  'Individual CIE yesno response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11D3: Do you have a history of chronic infections (EBV, Lyme, etc.)?',
  NULL,
  'Individual CIE yesno response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11D4: How would you rate your immune system''s balance?',
  NULL,
  'Individual CIE effectiveness response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11D5: Have you had food sensitivity testing (IgG, IgE)?',
  NULL,
  'Individual CIE yesno response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11D6: Do you experience hives, rashes, or skin reactions frequently?',
  NULL,
  'Individual CIE frequency response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11D7: Have you been diagnosed with mast cell activation syndrome (MCAS)?',
  NULL,
  'Individual CIE yesno response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11D8: Do infections take longer to resolve than they should?',
  NULL,
  'Individual CIE yesno response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11D9: Have you had immunoglobulin levels tested (IgA, IgG, IgM)?',
  NULL,
  'Individual CIE yesno response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11Q1: Do you have allergies, asthma, or eczema?',
  NULL,
  'Individual CIE yesno response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11Q2: Do you get sick frequently (more than 3 times per year)?',
  NULL,
  'Individual CIE yesno response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D11Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D11Q3: Have you been diagnosed with an autoimmune condition?',
  NULL,
  'Individual CIE yesno response, domain D11 (Immune Tolerance), axis D — Gut-Immune, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12D1: Do you have difficulty digesting fats or oils?',
  NULL,
  'Individual CIE frequency response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12D10: Have you been tested for pancreatic elastase?',
  NULL,
  'Individual CIE yesno response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12D2: Have you been diagnosed with bile acid malabsorption?',
  NULL,
  'Individual CIE yesno response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12D3: Do you experience light-colored (clay) or floating stools?',
  NULL,
  'Individual CIE frequency response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12D4: How would you rate your enterohepatic circulation function?',
  NULL,
  'Individual CIE effectiveness response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12D5: Have you had bile acid testing?',
  NULL,
  'Individual CIE yesno response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12D6: Do you experience right upper quadrant discomfort after meals?',
  NULL,
  'Individual CIE frequency response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12D7: Have you had gallstones or sludge detected on imaging?',
  NULL,
  'Individual CIE yesno response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12D8: Do you take ox bile or digestive enzyme supplements?',
  NULL,
  'Individual CIE yesno response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12D9: Do you experience diarrhea after fatty meals specifically?',
  NULL,
  'Individual CIE frequency response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12Q1: Do you experience symptoms after eating high-fat meals?',
  NULL,
  'Individual CIE frequency response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12Q2: Have you had your gallbladder removed?',
  NULL,
  'Individual CIE yesno response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.D12Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE D12Q3: Do you experience acid reflux or GERD?',
  NULL,
  'Individual CIE frequency response, domain D12 (Liver-Gut Loop), axis D — Gut-Immune, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13D1: Do you use screens within 1 hour of bedtime?',
  NULL,
  'Individual CIE frequency response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13D10: Do you get morning sunlight exposure within 30 minutes of waking?',
  NULL,
  'Individual CIE frequency response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13D2: Have you been diagnosed with sleep apnea?',
  NULL,
  'Individual CIE yesno response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13D3: Do you experience vivid dreams, nightmares, or sleep paralysis?',
  NULL,
  'Individual CIE frequency response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13D4: How would you rate your sleep quality on a typical night?',
  NULL,
  'Individual CIE effectiveness response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13D5: Have you had a sleep study (polysomnography)?',
  NULL,
  'Individual CIE yesno response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13D6: Do you use sleep aids (medications, supplements)?',
  NULL,
  'Individual CIE frequency response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13D7: Do you have restless leg syndrome or periodic limb movements?',
  NULL,
  'Individual CIE yesno response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13D8: What time do you typically feel most alert (morning, afternoon, evening)?',
  NULL,
  'Individual CIE chronotype response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Chronotype self-classification captures preference, not enforced sleep schedule']::TEXT[],
  'Self-report via a structured chronotype scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13D9: Do you wake up at the same time every day (weekdays and weekends)?',
  NULL,
  'Individual CIE yesno response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13Q1: Do you have trouble falling or staying asleep?',
  NULL,
  'Individual CIE frequency response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13Q2: Do you feel unrefreshed after a full night''s sleep?',
  NULL,
  'Individual CIE frequency response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E13Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E13Q3: Do you work night shifts or have irregular sleep schedules?',
  NULL,
  'Individual CIE yesno response, domain E13 (Sleep/Circadian), axis E — Neuropsychological, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14D1: Do you experience mood swings or emotional volatility?',
  NULL,
  'Individual CIE frequency response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14D10: Do you practice any form of meditation or mindfulness?',
  NULL,
  'Individual CIE frequency response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14D2: Are you currently taking psychiatric medications?',
  NULL,
  'Individual CIE yesno response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14D3: Have you experienced trauma or significant adverse events?',
  NULL,
  'Individual CIE yesno response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14D4: How would you rate your emotional resilience?',
  NULL,
  'Individual CIE effectiveness response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14D5: Have you tried therapy or counseling?',
  NULL,
  'Individual CIE yesno response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14D6: Do you experience irritability or anger outbursts?',
  NULL,
  'Individual CIE frequency response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14D7: Have you been screened for bipolar disorder?',
  NULL,
  'Individual CIE yesno response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14D8: Do you have a family history of mental health conditions?',
  NULL,
  'Individual CIE yesno response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14D9: Do you experience seasonal changes in mood (SAD)?',
  NULL,
  'Individual CIE yesno response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14Q1: Do you experience persistent low mood or depression?',
  NULL,
  'Individual CIE frequency response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14Q2: Have you been diagnosed with anxiety or depression?',
  NULL,
  'Individual CIE yesno response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E14Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E14Q3: Do you find it hard to feel joy or pleasure in activities?',
  NULL,
  'Individual CIE frequency response, domain E14 (Mood/Emotional Tone), axis E — Neuropsychological, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15D1: Do you have difficulty with word-finding or verbal fluency?',
  NULL,
  'Individual CIE frequency response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15D10: Do you take any supplements for brain health (omega-3, lion''s mane)?',
  NULL,
  'Individual CIE yesno response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15D2: Have you been evaluated for ADHD?',
  NULL,
  'Individual CIE yesno response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15D3: Do you experience ''tip of the tongue'' moments frequently?',
  NULL,
  'Individual CIE frequency response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15D4: How would you rate your mental clarity on a typical day?',
  NULL,
  'Individual CIE effectiveness response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15D5: Have you had cognitive testing or neuropsychological evaluation?',
  NULL,
  'Individual CIE yesno response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15D6: Do you multitask frequently during work?',
  NULL,
  'Individual CIE frequency response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15D7: Have you been diagnosed with any neurodegenerative condition?',
  NULL,
  'Individual CIE yesno response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15D8: Do you experience difficulty learning new information?',
  NULL,
  'Individual CIE frequency response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15D9: Do you have a family history of dementia or Alzheimer''s?',
  NULL,
  'Individual CIE yesno response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15Q1: Do you experience brain fog or difficulty concentrating?',
  NULL,
  'Individual CIE frequency response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15Q2: Have you noticed memory issues (forgetting names, tasks)?',
  NULL,
  'Individual CIE frequency response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.E15Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE E15Q3: Do you feel mentally exhausted by the end of the day?',
  NULL,
  'Individual CIE frequency response, domain E15 (Cognitive Load), axis E — Neuropsychological, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16D1: Do you experience muscle weakness or atrophy?',
  NULL,
  'Individual CIE frequency response, domain F16 (Musculoskeletal), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16D10: Do you take anti-inflammatory medications regularly?',
  NULL,
  'Individual CIE yesno response, domain F16 (Musculoskeletal), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16D2: Have you had joint replacements or orthopedic surgery?',
  NULL,
  'Individual CIE yesno response, domain F16 (Musculoskeletal), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16D3: Do you use mobility aids (cane, walker, wheelchair)?',
  NULL,
  'Individual CIE yesno response, domain F16 (Musculoskeletal), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16D4: How would you rate your overall musculoskeletal function?',
  NULL,
  'Individual CIE effectiveness response, domain F16 (Musculoskeletal), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16D5: Have you had imaging (X-ray, MRI) of joints?',
  NULL,
  'Individual CIE yesno response, domain F16 (Musculoskeletal), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16D6: Do you experience morning stiffness that improves with movement?',
  NULL,
  'Individual CIE frequency response, domain F16 (Musculoskeletal), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16D7: Have you been diagnosed with osteoarthritis or rheumatoid arthritis?',
  NULL,
  'Individual CIE yesno response, domain F16 (Musculoskeletal), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16D8: Do you do strength training or resistance exercise?',
  NULL,
  'Individual CIE frequency response, domain F16 (Musculoskeletal), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16D9: Have you had physical therapy in the past year?',
  NULL,
  'Individual CIE yesno response, domain F16 (Musculoskeletal), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16Q1: Do you experience chronic muscle or joint pain?',
  NULL,
  'Individual CIE frequency response, domain F16 (Musculoskeletal), axis F — Structural, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16Q2: Have you been diagnosed with arthritis or fibromyalgia?',
  NULL,
  'Individual CIE yesno response, domain F16 (Musculoskeletal), axis F — Structural, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F16Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F16Q3: Do you have limited mobility or range of motion?',
  NULL,
  'Individual CIE yesno response, domain F16 (Musculoskeletal), axis F — Structural, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17D1: Do you have a history of keloid or hypertrophic scarring?',
  NULL,
  'Individual CIE yesno response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17D10: Do you have sensitive skin that reacts to products easily?',
  NULL,
  'Individual CIE yesno response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17D2: Have you been diagnosed with Ehlers-Danlos syndrome or hypermobility?',
  NULL,
  'Individual CIE yesno response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17D3: Do you experience frequent skin infections?',
  NULL,
  'Individual CIE frequency response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17D4: How would you rate your skin''s healing and regeneration?',
  NULL,
  'Individual CIE effectiveness response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17D5: Do you have stretch marks (striae)?',
  NULL,
  'Individual CIE yesno response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17D6: Have you been diagnosed with any connective tissue disorder?',
  NULL,
  'Individual CIE yesno response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17D7: Do you experience joint hypermobility (double-jointed)?',
  NULL,
  'Individual CIE yesno response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17D8: Have you had skin biopsies or dermatology evaluations?',
  NULL,
  'Individual CIE yesno response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17D9: Do you take collagen supplements?',
  NULL,
  'Individual CIE yesno response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17Q1: Do you have chronic skin conditions (acne, eczema, psoriasis)?',
  NULL,
  'Individual CIE yesno response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17Q2: Have you noticed premature aging or loss of skin elasticity?',
  NULL,
  'Individual CIE yesno response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F17Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F17Q3: Do you bruise easily or have thin skin?',
  NULL,
  'Individual CIE yesno response, domain F17 (Skin/Connective Tissue), axis F — Structural, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18D1: Have you had a DEXA scan? What were the results?',
  NULL,
  'Individual CIE yesno response, domain F18 (Bone/Density), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18D10: Do you consume adequate protein for bone health?',
  NULL,
  'Individual CIE yesno response, domain F18 (Bone/Density), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18D2: Do you take calcium or vitamin D supplements?',
  NULL,
  'Individual CIE yesno response, domain F18 (Bone/Density), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18D3: Do you do weight-bearing exercise regularly?',
  NULL,
  'Individual CIE frequency response, domain F18 (Bone/Density), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18D4: How would you rate your bone health?',
  NULL,
  'Individual CIE effectiveness response, domain F18 (Bone/Density), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18D5: Have you taken bisphosphonates or other bone medications?',
  NULL,
  'Individual CIE yesno response, domain F18 (Bone/Density), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18D6: Do you have a family history of osteoporosis or fractures?',
  NULL,
  'Individual CIE yesno response, domain F18 (Bone/Density), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18D7: Have you lost height over the years?',
  NULL,
  'Individual CIE yesno response, domain F18 (Bone/Density), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18D8: Do you have kyphosis (forward curvature of spine)?',
  NULL,
  'Individual CIE yesno response, domain F18 (Bone/Density), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18D9: Have you ever taken long-term corticosteroids?',
  NULL,
  'Individual CIE yesno response, domain F18 (Bone/Density), axis F — Structural, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18Q1: Have you been diagnosed with osteoporosis or osteopenia?',
  NULL,
  'Individual CIE yesno response, domain F18 (Bone/Density), axis F — Structural, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18Q2: Have you had a fracture from minor impact?',
  NULL,
  'Individual CIE yesno response, domain F18 (Bone/Density), axis F — Structural, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.F18Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE F18Q3: Do you have risk factors for bone loss (low vitamin D, sedentary)?',
  NULL,
  'Individual CIE yesno response, domain F18 (Bone/Density), axis F — Structural, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19D1: Are you currently on thyroid medication?',
  NULL,
  'Individual CIE yesno response, domain G19 (Thyroid), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19D10: Do you take iodine or selenium supplements?',
  NULL,
  'Individual CIE yesno response, domain G19 (Thyroid), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19D2: Have you had your thyroid antibodies tested (TPO, TG)?',
  NULL,
  'Individual CIE yesno response, domain G19 (Thyroid), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19D3: Do you have a family history of thyroid disease?',
  NULL,
  'Individual CIE yesno response, domain G19 (Thyroid), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19D4: How would you rate your thyroid function overall?',
  NULL,
  'Individual CIE effectiveness response, domain G19 (Thyroid), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19D5: Have you had a thyroid ultrasound?',
  NULL,
  'Individual CIE yesno response, domain G19 (Thyroid), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19D6: Do you have thyroid nodules?',
  NULL,
  'Individual CIE yesno response, domain G19 (Thyroid), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19D7: Have you been tested for reverse T3?',
  NULL,
  'Individual CIE yesno response, domain G19 (Thyroid), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19D8: Do you experience difficulty swallowing or neck tightness?',
  NULL,
  'Individual CIE frequency response, domain G19 (Thyroid), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19D9: Have you been diagnosed with Hashimoto''s or Graves'' disease?',
  NULL,
  'Individual CIE yesno response, domain G19 (Thyroid), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19Q1: Have you been diagnosed with thyroid dysfunction?',
  NULL,
  'Individual CIE yesno response, domain G19 (Thyroid), axis G — Hormonal, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19Q2: Do you experience unexplained weight changes or temperature sensitivity?',
  NULL,
  'Individual CIE frequency response, domain G19 (Thyroid), axis G — Hormonal, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G19Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G19Q3: Do you have symptoms of slow metabolism (fatigue, dry skin, hair loss)?',
  NULL,
  'Individual CIE frequency response, domain G19 (Thyroid), axis G — Hormonal, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20D1: Have you had your hormone levels tested recently (estrogen, testosterone, progesterone)?',
  NULL,
  'Individual CIE yesno response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20D10: Do you take any hormone-modulating supplements (DIM, maca, ashwagandha)?',
  NULL,
  'Individual CIE yesno response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20D2: Are you on hormone replacement therapy (HRT)?',
  NULL,
  'Individual CIE yesno response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20D3: Do you experience fertility issues?',
  NULL,
  'Individual CIE yesno response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20D4: How would you rate your hormonal balance?',
  NULL,
  'Individual CIE effectiveness response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20D5: Have you been tested for DHEA-S and cortisol?',
  NULL,
  'Individual CIE yesno response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20D6: Do you experience irregular menstrual cycles (if applicable)?',
  NULL,
  'Individual CIE yesno response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20D7: Have you been diagnosed with endometriosis or fibroids (if applicable)?',
  NULL,
  'Individual CIE yesno response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20D8: Do you experience symptoms of low testosterone (if applicable)?',
  NULL,
  'Individual CIE yesno response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20D9: Have you had breast or prostate cancer screening?',
  NULL,
  'Individual CIE yesno response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20Q1: Do you experience hormonal symptoms (PMS, hot flashes, low libido)?',
  NULL,
  'Individual CIE frequency response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20Q2: Have you been diagnosed with hormone imbalance or PCOS?',
  NULL,
  'Individual CIE yesno response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G20Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G20Q3: Are you in perimenopause, menopause, or andropause?',
  NULL,
  'Individual CIE yesno response, domain G20 (Reproductive Hormones), axis G — Hormonal, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21D1: Have you had a glucose tolerance test (OGTT) or HbA1c measured?',
  NULL,
  'Individual CIE yesno response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21D10: Do you take metformin or other glucose-lowering medications?',
  NULL,
  'Individual CIE yesno response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21D2: Do you experience reactive hypoglycemia after meals?',
  NULL,
  'Individual CIE frequency response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21D3: Have you been diagnosed with insulin resistance?',
  NULL,
  'Individual CIE yesno response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21D4: How would you rate your metabolic hormone balance?',
  NULL,
  'Individual CIE effectiveness response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21D5: Have you worn a continuous glucose monitor (CGM)?',
  NULL,
  'Individual CIE yesno response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21D6: Do you experience afternoon energy crashes?',
  NULL,
  'Individual CIE frequency response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21D7: Have you been tested for fasting insulin?',
  NULL,
  'Individual CIE yesno response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21D8: Do you practice time-restricted eating or intermittent fasting?',
  NULL,
  'Individual CIE yesno response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21D9: Have you been diagnosed with Cushing''s syndrome or tested for cortisol?',
  NULL,
  'Individual CIE yesno response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21Q1: Do you experience blood sugar swings throughout the day?',
  NULL,
  'Individual CIE frequency response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21Q2: Do you gain weight easily, especially around the middle?',
  NULL,
  'Individual CIE yesno response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.G21Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE G21Q3: Do you feel ''hangry'' or irritable when meals are delayed?',
  NULL,
  'Individual CIE frequency response, domain G21 (Insulin-Cortisol Axis), axis G — Hormonal, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22D1: Do you have a consistent morning light exposure routine?',
  NULL,
  'Individual CIE frequency response, domain H22 (Light & Movement), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22D10: Do you experience post-exercise soreness that lasts more than 2 days?',
  NULL,
  'Individual CIE frequency response, domain H22 (Light & Movement), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22D2: Do you use blue light blocking glasses at night?',
  NULL,
  'Individual CIE yesno response, domain H22 (Light & Movement), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22D3: Do you do strength training at least twice per week?',
  NULL,
  'Individual CIE yesno response, domain H22 (Light & Movement), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22D4: How would you rate your overall activity level?',
  NULL,
  'Individual CIE effectiveness response, domain H22 (Light & Movement), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22D5: Do you track your steps or activity with a device?',
  NULL,
  'Individual CIE yesno response, domain H22 (Light & Movement), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22D6: What type of exercise do you do most often?',
  NULL,
  'Individual CIE activity response, domain H22 (Light & Movement), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Activity self-classification does not capture duration, intensity, or consistency']::TEXT[],
  'Self-report via a structured activity scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22D7: Do you take breaks from sitting every hour?',
  NULL,
  'Individual CIE frequency response, domain H22 (Light & Movement), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22D8: Do you exercise outdoors or primarily indoors?',
  NULL,
  'Individual CIE yesno response, domain H22 (Light & Movement), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22D9: Have you had VO2 max or fitness testing?',
  NULL,
  'Individual CIE yesno response, domain H22 (Light & Movement), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22Q1: Do you get at least 30 minutes of outdoor light daily?',
  NULL,
  'Individual CIE frequency response, domain H22 (Light & Movement), axis H — Lifestyle, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22Q2: Do you exercise at least 150 minutes per week?',
  NULL,
  'Individual CIE yesno response, domain H22 (Light & Movement), axis H — Lifestyle, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H22Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H22Q3: Do you spend most of your day sedentary?',
  NULL,
  'Individual CIE yesno response, domain H22 (Light & Movement), axis H — Lifestyle, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23D1: Do you practice time-restricted eating or intermittent fasting?',
  NULL,
  'Individual CIE yesno response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23D10: Do you eat organic or prioritize food quality?',
  NULL,
  'Individual CIE frequency response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23D2: Do you track your macronutrient intake?',
  NULL,
  'Individual CIE yesno response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23D3: Do you have identified food sensitivities you actively avoid?',
  NULL,
  'Individual CIE yesno response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23D4: How would you rate your nutritional awareness?',
  NULL,
  'Individual CIE effectiveness response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23D5: Do you prepare most of your meals at home?',
  NULL,
  'Individual CIE frequency response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23D6: Do you consume adequate protein (0.8-1g per pound body weight)?',
  NULL,
  'Individual CIE yesno response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23D7: Do you limit sugar intake to less than 25g per day?',
  NULL,
  'Individual CIE yesno response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23D8: Have you tried elimination diets to identify triggers?',
  NULL,
  'Individual CIE yesno response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23D9: Do you consume fermented foods regularly?',
  NULL,
  'Individual CIE frequency response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23Q1: Do you eat processed or fast food more than 3 times per week?',
  NULL,
  'Individual CIE frequency response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23Q2: Do you have a consistent eating schedule?',
  NULL,
  'Individual CIE yesno response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.H23Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE H23Q3: Do you consume at least 5 servings of vegetables daily?',
  NULL,
  'Individual CIE yesno response, domain H23 (Nutrition Identity), axis H — Lifestyle, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24D1: Do you consume adequate electrolytes (sodium, potassium, magnesium)?',
  NULL,
  'Individual CIE yesno response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24D10: Have you experienced kidney stones?',
  NULL,
  'Individual CIE yesno response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24D2: Do you experience dizziness when standing?',
  NULL,
  'Individual CIE frequency response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24D3: Have you been diagnosed with electrolyte imbalances?',
  NULL,
  'Individual CIE yesno response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24D4: How would you rate your hydration status?',
  NULL,
  'Individual CIE effectiveness response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24D5: Do you use electrolyte supplements or drinks?',
  NULL,
  'Individual CIE yesno response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24D6: Do you experience frequent thirst?',
  NULL,
  'Individual CIE frequency response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24D7: Have you had kidney function tests (BUN, creatinine)?',
  NULL,
  'Individual CIE yesno response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24D8: Do you limit caffeine and alcohol intake?',
  NULL,
  'Individual CIE yesno response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24D9: Do you exercise in hot environments or sweat heavily?',
  NULL,
  'Individual CIE frequency response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24Q1: Do you drink at least 8 glasses of water daily?',
  NULL,
  'Individual CIE yesno response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24Q2: Do you experience frequent headaches or muscle cramps?',
  NULL,
  'Individual CIE frequency response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.I24Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE I24Q3: Is your urine typically dark yellow?',
  NULL,
  'Individual CIE frequency response, domain I24 (Hydration/Electrolyte), axis I — Functional, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25D1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25D1: Do you have at least one person you can confide in deeply?',
  NULL,
  'Individual CIE yesno response, domain J25 (Social Connection), axis J — Social, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25D10',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25D10: Do you engage in activities that bring you joy with others?',
  NULL,
  'Individual CIE frequency response, domain J25 (Social Connection), axis J — Social, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25D2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25D2: Do you feel supported in times of stress?',
  NULL,
  'Individual CIE frequency response, domain J25 (Social Connection), axis J — Social, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25D3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25D3: Do you volunteer or contribute to your community?',
  NULL,
  'Individual CIE yesno response, domain J25 (Social Connection), axis J — Social, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25D4',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25D4: How would you rate your social support network?',
  NULL,
  'Individual CIE effectiveness response, domain J25 (Social Connection), axis J — Social, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Perceived effectiveness does not equal measured outcome']::TEXT[],
  'Self-report via a structured effectiveness scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25D5',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25D5: Do you have regular face-to-face social interactions?',
  NULL,
  'Individual CIE frequency response, domain J25 (Social Connection), axis J — Social, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25D6',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25D6: Do you feel a sense of belonging to a group or community?',
  NULL,
  'Individual CIE yesno response, domain J25 (Social Connection), axis J — Social, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25D7',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25D7: Have you experienced major relationship changes in the past year?',
  NULL,
  'Individual CIE yesno response, domain J25 (Social Connection), axis J — Social, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25D8',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25D8: Do you share meals with others regularly?',
  NULL,
  'Individual CIE frequency response, domain J25 (Social Connection), axis J — Social, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25D9',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25D9: Do you have a sense of purpose or meaning in life?',
  NULL,
  'Individual CIE yesno response, domain J25 (Social Connection), axis J — Social, layer 2.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25Q1',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25Q1: Do you have meaningful social connections you can rely on?',
  NULL,
  'Individual CIE yesno response, domain J25 (Social Connection), axis J — Social, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Binary self-report does not capture severity or duration']::TEXT[],
  'Self-report via a structured yesno scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  31536000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25Q2',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25Q2: Do you feel lonely or isolated frequently?',
  NULL,
  'Individual CIE frequency response, domain J25 (Social Connection), axis J — Social, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.response.J25Q3',
  'embodied_perception',
  'self_report',
  'medium',
  0,
  'CIE J25Q3: Do you engage in community or group activities?',
  NULL,
  'Individual CIE frequency response, domain J25 (Social Connection), axis J — Social, layer 1.',
  ARRAY['Cannot detect subclinical biochemical state', 'Reflects the patient''s interpretive frame at the moment of answering', 'Single-intake response; trajectory requires repeated assessment', 'Frequency self-judgment is influenced by recency bias and baseline drift']::TEXT[],
  'Self-report via a structured frequency scale. Confidence is for the perception claim made, not for the underlying biochemistry or downstream clinical interpretation.',
  0.850,
  2592000,
  NULL,
  NULL,
  'p1a_initial'
);


-- ========================================================================
-- BLOCK: CIE domain scores (derived_score, compression_depth = 1)
-- Count: 25
-- ========================================================================

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.A1',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — A1: Liver/Hepatic Flux',
  'score_0_100',
  'Aggregate domain score for A1 (Liver/Hepatic Flux), axis A (Metabolic). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.A2',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — A2: Pancreas/Insulin Signaling',
  'score_0_100',
  'Aggregate domain score for A2 (Pancreas/Insulin Signaling), axis A (Metabolic). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.A3',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — A3: Adipose/Fat Signaling',
  'score_0_100',
  'Aggregate domain score for A3 (Adipose/Fat Signaling), axis A (Metabolic). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.B4',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — B4: Endothelium/Microcirculation',
  'score_0_100',
  'Aggregate domain score for B4 (Endothelium/Microcirculation), axis B (Cardiovascular). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.B5',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — B5: Heart/Autonomic Flow',
  'score_0_100',
  'Aggregate domain score for B5 (Heart/Autonomic Flow), axis B (Cardiovascular). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.B6',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — B6: Vascular Inflammation',
  'score_0_100',
  'Aggregate domain score for B6 (Vascular Inflammation), axis B (Cardiovascular). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.C7',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — C7: Adrenal/Stress Response',
  'score_0_100',
  'Aggregate domain score for C7 (Adrenal/Stress Response), axis C (Neuroendocrine). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.C8',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — C8: Mitochondrial Energy',
  'score_0_100',
  'Aggregate domain score for C8 (Mitochondrial Energy), axis C (Neuroendocrine). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.C9',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — C9: Autonomic Balance',
  'score_0_100',
  'Aggregate domain score for C9 (Autonomic Balance), axis C (Neuroendocrine). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.D10',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — D10: Gut Ecology',
  'score_0_100',
  'Aggregate domain score for D10 (Gut Ecology), axis D (Gut-Immune). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.D11',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — D11: Immune Tolerance',
  'score_0_100',
  'Aggregate domain score for D11 (Immune Tolerance), axis D (Gut-Immune). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.D12',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — D12: Liver-Gut Loop',
  'score_0_100',
  'Aggregate domain score for D12 (Liver-Gut Loop), axis D (Gut-Immune). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.E13',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — E13: Sleep/Circadian',
  'score_0_100',
  'Aggregate domain score for E13 (Sleep/Circadian), axis E (Neuropsychological). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.E14',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — E14: Mood/Emotional Tone',
  'score_0_100',
  'Aggregate domain score for E14 (Mood/Emotional Tone), axis E (Neuropsychological). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.E15',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — E15: Cognitive Load',
  'score_0_100',
  'Aggregate domain score for E15 (Cognitive Load), axis E (Neuropsychological). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.F16',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — F16: Musculoskeletal',
  'score_0_100',
  'Aggregate domain score for F16 (Musculoskeletal), axis F (Structural). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.F17',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — F17: Skin/Connective Tissue',
  'score_0_100',
  'Aggregate domain score for F17 (Skin/Connective Tissue), axis F (Structural). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.F18',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — F18: Bone/Density',
  'score_0_100',
  'Aggregate domain score for F18 (Bone/Density), axis F (Structural). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.G19',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — G19: Thyroid',
  'score_0_100',
  'Aggregate domain score for G19 (Thyroid), axis G (Hormonal). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.G20',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — G20: Reproductive Hormones',
  'score_0_100',
  'Aggregate domain score for G20 (Reproductive Hormones), axis G (Hormonal). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.G21',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — G21: Insulin-Cortisol Axis',
  'score_0_100',
  'Aggregate domain score for G21 (Insulin-Cortisol Axis), axis G (Hormonal). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.H22',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — H22: Light & Movement',
  'score_0_100',
  'Aggregate domain score for H22 (Light & Movement), axis H (Lifestyle). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.H23',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — H23: Nutrition Identity',
  'score_0_100',
  'Aggregate domain score for H23 (Nutrition Identity), axis H (Lifestyle). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.I24',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — I24: Hydration/Electrolyte',
  'score_0_100',
  'Aggregate domain score for I24 (Hydration/Electrolyte), axis I (Functional). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.domain_score.J25',
  'embodied_perception',
  'derived_score',
  'medium',
  1,
  'CIE Domain Score — J25: Social Connection',
  'score_0_100',
  'Aggregate domain score for J25 (Social Connection), axis J (Social). Weighted blend of L1 and L2 responses per CIE v2.2 scoring rules.',
  ARRAY['Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses', 'Inherits all limitations of its constituent response witnesses', 'Cannot adjudicate biochemistry or downstream clinical interpretation']::TEXT[],
  'Aggregate of CIE responses within this domain, weighted per CIE v2.2. Confidence reflects aggregation coherence, not biochemical correlation.',
  0.800,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);


-- ========================================================================
-- BLOCK: CIE gate scores (compressed_label, compression_depth = 2)
-- Count: 9
-- ========================================================================

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.gate_score.BCS',
  'embodied_perception',
  'compressed_label',
  'medium',
  2,
  'CIE Gate — BCS: Barrier & Colonization Status',
  'score_0_100',
  'Gate-level CIE score for BCS (Barrier & Colonization Status), aggregating domain scores: A3, B6, D10, D11, D12, F17. Produces a traffic-light classification (green/yellow/orange/red) per CIE v2.2 thresholds.',
  ARRAY['Aggregate of domain-score witnesses; independent contribution must not be counted alongside constituent domain scores or their underlying responses', 'Gate-level traffic-light classification compresses graded information into three bins', 'Represents a specific clinical lens (defined by constituent domains); does not replace system-wide reading']::TEXT[],
  'Composition of domain-score witnesses into a gate-level lens. Confidence is for the compressed signal within its stated clinical lens, not for independent biological fact.',
  0.750,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.gate_score.BRI',
  'embodied_perception',
  'compressed_label',
  'medium',
  2,
  'CIE Gate — BRI: Brain-Resilience Index',
  'score_0_100',
  'Gate-level CIE score for BRI (Brain-Resilience Index), aggregating domain scores: C7, C9, E13, E14, G19, G20, G21, H22, J25. Produces a traffic-light classification (green/yellow/orange/red) per CIE v2.2 thresholds.',
  ARRAY['Aggregate of domain-score witnesses; independent contribution must not be counted alongside constituent domain scores or their underlying responses', 'Gate-level traffic-light classification compresses graded information into three bins', 'Represents a specific clinical lens (defined by constituent domains); does not replace system-wide reading']::TEXT[],
  'Composition of domain-score witnesses into a gate-level lens. Confidence is for the compressed signal within its stated clinical lens, not for independent biological fact.',
  0.750,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.gate_score.CLI',
  'embodied_perception',
  'compressed_label',
  'medium',
  2,
  'CIE Gate — CLI: Cellular Longevity Index',
  'score_0_100',
  'Gate-level CIE score for CLI (Cellular Longevity Index), aggregating domain scores: B5, C8, E15, F16, I24. Produces a traffic-light classification (green/yellow/orange/red) per CIE v2.2 thresholds.',
  ARRAY['Aggregate of domain-score witnesses; independent contribution must not be counted alongside constituent domain scores or their underlying responses', 'Gate-level traffic-light classification compresses graded information into three bins', 'Represents a specific clinical lens (defined by constituent domains); does not replace system-wide reading']::TEXT[],
  'Composition of domain-score witnesses into a gate-level lens. Confidence is for the compressed signal within its stated clinical lens, not for independent biological fact.',
  0.750,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.gate_score.FPIS',
  'embodied_perception',
  'compressed_label',
  'medium',
  2,
  'CIE Gate — FPIS: Fuel Processing & Insulin Sensitivity',
  'score_0_100',
  'Gate-level CIE score for FPIS (Fuel Processing & Insulin Sensitivity), aggregating domain scores: A1, A2, G21, H23. Produces a traffic-light classification (green/yellow/orange/red) per CIE v2.2 thresholds.',
  ARRAY['Aggregate of domain-score witnesses; independent contribution must not be counted alongside constituent domain scores or their underlying responses', 'Gate-level traffic-light classification compresses graded information into three bins', 'Represents a specific clinical lens (defined by constituent domains); does not replace system-wide reading']::TEXT[],
  'Composition of domain-score witnesses into a gate-level lens. Confidence is for the compressed signal within its stated clinical lens, not for independent biological fact.',
  0.750,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.gate_score.GRIP',
  'embodied_perception',
  'compressed_label',
  'medium',
  2,
  'CIE Gate — GRIP: Global Risk Integration Profile',
  'score_0_100',
  'Gate-level CIE score for GRIP (Global Risk Integration Profile), aggregating domain scores: A2, B4, B5, C9, F18. Produces a traffic-light classification (green/yellow/orange/red) per CIE v2.2 thresholds.',
  ARRAY['Aggregate of domain-score witnesses; independent contribution must not be counted alongside constituent domain scores or their underlying responses', 'Gate-level traffic-light classification compresses graded information into three bins', 'Represents a specific clinical lens (defined by constituent domains); does not replace system-wide reading']::TEXT[],
  'Composition of domain-score witnesses into a gate-level lens. Confidence is for the compressed signal within its stated clinical lens, not for independent biological fact.',
  0.750,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.gate_score.HPI',
  'embodied_perception',
  'compressed_label',
  'medium',
  2,
  'CIE Gate — HPI: Health Potential Index',
  'score_0_100',
  'Gate-level CIE score for HPI (Health Potential Index), aggregating domain scores: C7, C8, E13, E15, F18, G19, G20, H22. Produces a traffic-light classification (green/yellow/orange/red) per CIE v2.2 thresholds.',
  ARRAY['Aggregate of domain-score witnesses; independent contribution must not be counted alongside constituent domain scores or their underlying responses', 'Gate-level traffic-light classification compresses graded information into three bins', 'Represents a specific clinical lens (defined by constituent domains); does not replace system-wide reading']::TEXT[],
  'Composition of domain-score witnesses into a gate-level lens. Confidence is for the compressed signal within its stated clinical lens, not for independent biological fact.',
  0.750,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.gate_score.OFFI',
  'embodied_perception',
  'compressed_label',
  'medium',
  2,
  'CIE Gate — OFFI: Organ/Fat Flux Index',
  'score_0_100',
  'Gate-level CIE score for OFFI (Organ/Fat Flux Index), aggregating domain scores: A1, A3, D12, H23. Produces a traffic-light classification (green/yellow/orange/red) per CIE v2.2 thresholds.',
  ARRAY['Aggregate of domain-score witnesses; independent contribution must not be counted alongside constituent domain scores or their underlying responses', 'Gate-level traffic-light classification compresses graded information into three bins', 'Represents a specific clinical lens (defined by constituent domains); does not replace system-wide reading']::TEXT[],
  'Composition of domain-score witnesses into a gate-level lens. Confidence is for the compressed signal within its stated clinical lens, not for independent biological fact.',
  0.750,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.gate_score.SCAR',
  'embodied_perception',
  'compressed_label',
  'medium',
  2,
  'CIE Gate — SCAR: SCAR Memory Gate',
  'score_0_100',
  'Gate-level CIE score for SCAR (SCAR Memory Gate), aggregating domain scores: D11, E14, J25. Produces a traffic-light classification (green/yellow/orange/red) per CIE v2.2 thresholds.',
  ARRAY['Aggregate of domain-score witnesses; independent contribution must not be counted alongside constituent domain scores or their underlying responses', 'Gate-level traffic-light classification compresses graded information into three bins', 'Represents a specific clinical lens (defined by constituent domains); does not replace system-wide reading']::TEXT[],
  'Composition of domain-score witnesses into a gate-level lens. Confidence is for the compressed signal within its stated clinical lens, not for independent biological fact.',
  0.750,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'cie',
  'cie.gate_score.TIS',
  'embodied_perception',
  'compressed_label',
  'medium',
  2,
  'CIE Gate — TIS: Tissue Integrity Score',
  'score_0_100',
  'Gate-level CIE score for TIS (Tissue Integrity Score), aggregating domain scores: B4, B6, D10, F16, F17, I24. Produces a traffic-light classification (green/yellow/orange/red) per CIE v2.2 thresholds.',
  ARRAY['Aggregate of domain-score witnesses; independent contribution must not be counted alongside constituent domain scores or their underlying responses', 'Gate-level traffic-light classification compresses graded information into three bins', 'Represents a specific clinical lens (defined by constituent domains); does not replace system-wide reading']::TEXT[],
  'Composition of domain-score witnesses into a gate-level lens. Confidence is for the compressed signal within its stated clinical lens, not for independent biological fact.',
  0.750,
  7776000,
  NULL,
  NULL,
  'p1a_initial'
);


-- ========================================================================
-- BLOCK: Lab ontology concepts (direct_measure, biochemical_state_snapshot)
-- Count: 173
-- ========================================================================

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.autoimmune_ana',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'ANA',
  'titer',
  'Canonical lab concept autoimmune_ana — ANA. Clinical domain: autoimmune. Biomarker class: Autoimmune Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to autoimmune within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for ANA. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'autoimmune_ana',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.autoimmune_ccp',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Anti-CCP',
  'U/mL',
  'Canonical lab concept autoimmune_ccp — Anti-CCP. Clinical domain: autoimmune. Biomarker class: Autoimmune Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to autoimmune within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Anti-CCP. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'autoimmune_ccp',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_bmi',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Body Mass Index',
  'kg/m2',
  'Canonical lab concept body_bmi — Body Mass Index. Clinical domain: body_composition. Biomarker class: Body Composition.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Body Mass Index. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_bmi',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_bmr',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Basal Metabolic Rate',
  'kcal/day',
  'Canonical lab concept body_bmr — Basal Metabolic Rate. Clinical domain: metabolic. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to metabolic within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Basal Metabolic Rate. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_bmr',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_dry_lean_mass',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Dry Lean Mass',
  'lb',
  'Canonical lab concept body_dry_lean_mass — Dry Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Dry Lean Mass. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_dry_lean_mass',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_ecw',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Extracellular Water',
  'lb',
  'Canonical lab concept body_ecw — Extracellular Water. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Extracellular Water. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_ecw',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_ecw_tbw',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'ECW/TBW Ratio',
  'ratio',
  'Canonical lab concept body_ecw_tbw — ECW/TBW Ratio. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for ECW/TBW Ratio. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_ecw_tbw',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_ecw_tbw_left_arm',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Left Arm ECW/TBW',
  'ratio',
  'Canonical lab concept body_ecw_tbw_left_arm — Left Arm ECW/TBW. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Left Arm ECW/TBW. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_ecw_tbw_left_arm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_ecw_tbw_left_leg',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Left Leg ECW/TBW',
  'ratio',
  'Canonical lab concept body_ecw_tbw_left_leg — Left Leg ECW/TBW. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Left Leg ECW/TBW. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_ecw_tbw_left_leg',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_ecw_tbw_right_arm',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Right Arm ECW/TBW',
  'ratio',
  'Canonical lab concept body_ecw_tbw_right_arm — Right Arm ECW/TBW. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Right Arm ECW/TBW. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_ecw_tbw_right_arm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_ecw_tbw_right_leg',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Right Leg ECW/TBW',
  'ratio',
  'Canonical lab concept body_ecw_tbw_right_leg — Right Leg ECW/TBW. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Right Leg ECW/TBW. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_ecw_tbw_right_leg',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_ecw_tbw_trunk',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Trunk ECW/TBW',
  'ratio',
  'Canonical lab concept body_ecw_tbw_trunk — Trunk ECW/TBW. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Trunk ECW/TBW. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_ecw_tbw_trunk',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_fat_free_mass',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Fat Free Mass',
  'lb',
  'Canonical lab concept body_fat_free_mass — Fat Free Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Fat Free Mass. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_fat_free_mass',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_fat_mass',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Body Fat Mass',
  'lb',
  'Canonical lab concept body_fat_mass — Body Fat Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Body Fat Mass. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_fat_mass',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_fat_pct',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Percent Body Fat',
  '%',
  'Canonical lab concept body_fat_pct — Percent Body Fat. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Percent Body Fat. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_fat_pct',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_icw',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Intracellular Water',
  'lb',
  'Canonical lab concept body_icw — Intracellular Water. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Intracellular Water. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_icw',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_lean_left_arm',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Left Arm Lean Mass',
  'lb',
  'Canonical lab concept body_lean_left_arm — Left Arm Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Left Arm Lean Mass. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_lean_left_arm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_lean_left_leg',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Left Leg Lean Mass',
  'lb',
  'Canonical lab concept body_lean_left_leg — Left Leg Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Left Leg Lean Mass. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_lean_left_leg',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_lean_right_arm',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Right Arm Lean Mass',
  'lb',
  'Canonical lab concept body_lean_right_arm — Right Arm Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Right Arm Lean Mass. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_lean_right_arm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_lean_right_leg',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Right Leg Lean Mass',
  'lb',
  'Canonical lab concept body_lean_right_leg — Right Leg Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Right Leg Lean Mass. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_lean_right_leg',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_lean_trunk',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Trunk Lean Mass',
  'lb',
  'Canonical lab concept body_lean_trunk — Trunk Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Trunk Lean Mass. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_lean_trunk',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_smm',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Skeletal Muscle Mass',
  'lb',
  'Canonical lab concept body_smm — Skeletal Muscle Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Skeletal Muscle Mass. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_smm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_tbw',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Total Body Water',
  'lb',
  'Canonical lab concept body_tbw — Total Body Water. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Total Body Water. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_tbw',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_visceral_fat_area',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Visceral Fat Area',
  'cm2',
  'Canonical lab concept body_visceral_fat_area — Visceral Fat Area. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Visceral Fat Area. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_visceral_fat_area',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.body_weight',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Body Weight',
  'lb',
  'Canonical lab concept body_weight — Body Weight. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Body Weight. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'body_weight',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cardiac_troponin_i',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Troponin I',
  'ng/mL',
  'Canonical lab concept cardiac_troponin_i — Troponin I. Clinical domain: cardiac. Biomarker class: Cardiac Biomarkers.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to cardiac within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Troponin I. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cardiac_troponin_i',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_basophils_abs',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Absolute Basophils',
  '10^3/uL',
  'Canonical lab concept cbc_basophils_abs — Absolute Basophils. Clinical domain: hematology. Biomarker class: CBC Diff.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Absolute Basophils. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_basophils_abs',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_eosinophils_abs',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Absolute Eosinophils',
  '10^3/uL',
  'Canonical lab concept cbc_eosinophils_abs — Absolute Eosinophils. Clinical domain: hematology. Biomarker class: CBC Diff.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Absolute Eosinophils. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_eosinophils_abs',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_hematocrit',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Hematocrit',
  '%',
  'Canonical lab concept cbc_hematocrit — Hematocrit. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Hematocrit. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_hematocrit',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_hemoglobin',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Hemoglobin',
  'g/dL',
  'Canonical lab concept cbc_hemoglobin — Hemoglobin. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Hemoglobin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_hemoglobin',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_ig',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Immature Granulocytes',
  '10^3/uL',
  'Canonical lab concept cbc_ig — Immature Granulocytes. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Immature Granulocytes. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_ig',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_ig_pct',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Immature Granulocyte %',
  '%',
  'Canonical lab concept cbc_ig_pct — Immature Granulocyte %. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Immature Granulocyte %. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_ig_pct',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_lymphocytes_abs',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Absolute Lymphocytes',
  '10^3/uL',
  'Canonical lab concept cbc_lymphocytes_abs — Absolute Lymphocytes. Clinical domain: hematology. Biomarker class: CBC Diff.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Absolute Lymphocytes. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_lymphocytes_abs',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_lymphocytes_pct',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Lymphocytes',
  '%',
  'Canonical lab concept cbc_lymphocytes_pct — Lymphocytes. Clinical domain: hematology. Biomarker class: CBC Diff.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Lymphocytes. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_lymphocytes_pct',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_mch',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'MCH',
  'pg',
  'Canonical lab concept cbc_mch — MCH. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for MCH. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_mch',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_mchc',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'MCHC',
  'g/dL',
  'Canonical lab concept cbc_mchc — MCHC. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for MCHC. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_mchc',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_mcv',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'MCV',
  'fL',
  'Canonical lab concept cbc_mcv — MCV. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for MCV. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_mcv',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_monocytes_abs',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Absolute Monocytes',
  '10^3/uL',
  'Canonical lab concept cbc_monocytes_abs — Absolute Monocytes. Clinical domain: hematology. Biomarker class: CBC Diff.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Absolute Monocytes. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_monocytes_abs',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_mpv',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'MPV',
  'fL',
  'Canonical lab concept cbc_mpv — MPV. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for MPV. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_mpv',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_neutrophils_abs',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Absolute Neutrophils',
  '10^3/uL',
  'Canonical lab concept cbc_neutrophils_abs — Absolute Neutrophils. Clinical domain: hematology. Biomarker class: CBC Diff.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Absolute Neutrophils. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_neutrophils_abs',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_nrbc',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Nucleated RBC',
  'count',
  'Canonical lab concept cbc_nrbc — Nucleated RBC. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Nucleated RBC. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_nrbc',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_nrbc_pct',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Nucleated RBC %',
  '%',
  'Canonical lab concept cbc_nrbc_pct — Nucleated RBC %. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Nucleated RBC %. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_nrbc_pct',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_pct',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Plateletcrit',
  '%',
  'Canonical lab concept cbc_pct — Plateletcrit. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Plateletcrit. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_pct',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_pdw',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'PDW',
  'fL',
  'Canonical lab concept cbc_pdw — PDW. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for PDW. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_pdw',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_platelets',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Platelets',
  '10^3/uL',
  'Canonical lab concept cbc_platelets — Platelets. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Platelets. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_platelets',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_plcr',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Platelet Large Cell Ratio',
  '%',
  'Canonical lab concept cbc_plcr — Platelet Large Cell Ratio. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Platelet Large Cell Ratio. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_plcr',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_rbc',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Red Blood Cell Count',
  '10^6/uL',
  'Canonical lab concept cbc_rbc — Red Blood Cell Count. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Red Blood Cell Count. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_rbc',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_rdw_cv',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'RDW-CV',
  '%',
  'Canonical lab concept cbc_rdw_cv — RDW-CV. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for RDW-CV. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_rdw_cv',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_rdw_sd',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'RDW-SD',
  'fL',
  'Canonical lab concept cbc_rdw_sd — RDW-SD. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for RDW-SD. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_rdw_sd',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.cbc_wbc',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'White Blood Cell Count',
  '10^3/uL',
  'Canonical lab concept cbc_wbc — White Blood Cell Count. Clinical domain: hematology. Biomarker class: CBC.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hematology within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for White Blood Cell Count. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'cbc_wbc',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.fibroscan_cap',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Controlled Attenuation Parameter (steatosis)',
  'dB/m',
  'Canonical lab concept fibroscan_cap — Controlled Attenuation Parameter (steatosis). Clinical domain: liver. Biomarker class: FibroScan.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Controlled Attenuation Parameter (steatosis). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'fibroscan_cap',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.fibroscan_lsm',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Liver Stiffness Measurement',
  'kPa',
  'Canonical lab concept fibroscan_lsm — Liver Stiffness Measurement. Clinical domain: liver. Biomarker class: FibroScan.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Liver Stiffness Measurement. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'fibroscan_lsm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.fibroscan_sws',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Shear Wave Speed',
  'm/s',
  'Canonical lab concept fibroscan_sws — Shear Wave Speed. Clinical domain: liver. Biomarker class: FibroScan.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Shear Wave Speed. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'fibroscan_sws',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.glucose_abg',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Estimated Average Glucose',
  'mg/dL',
  'Canonical lab concept glucose_abg — Estimated Average Glucose. Clinical domain: glycemic. Biomarker class: Glycemic Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to glycemic within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Estimated Average Glucose. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'glucose_abg',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.glucose_fasting',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Fasting Glucose',
  'mg/dL',
  'Canonical lab concept glucose_fasting — Fasting Glucose. Clinical domain: glycemic. Biomarker class: Basic Metabolic.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to glycemic within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Fasting Glucose. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'glucose_fasting',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.glucose_fructosamine',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Fructosamine',
  'umol/L',
  'Canonical lab concept glucose_fructosamine — Fructosamine. Clinical domain: glycemic. Biomarker class: Glycemic Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to glycemic within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Fructosamine. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'glucose_fructosamine',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.glucose_ir_score',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Insulin Resistance Score',
  'score',
  'Canonical lab concept glucose_ir_score — Insulin Resistance Score. Clinical domain: glycemic. Biomarker class: Glycemic Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to glycemic within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Insulin Resistance Score. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'glucose_ir_score',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.glucose_ketone',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Blood Ketone',
  'mmol/L',
  'Canonical lab concept glucose_ketone — Blood Ketone. Clinical domain: glycemic. Biomarker class: Glycemic Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to glycemic within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Blood Ketone. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'glucose_ketone',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.hba1c',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Hemoglobin A1c',
  '%',
  'Canonical lab concept hba1c — Hemoglobin A1c. Clinical domain: glycemic. Biomarker class: Glycemic Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to glycemic within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Hemoglobin A1c. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'hba1c',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.hormone_17_oh_prog',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  '17-OH Progesterone',
  'ng/mL',
  'Canonical lab concept hormone_17_oh_prog — 17-OH Progesterone. Clinical domain: hormones. Biomarker class: Hormone Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hormones within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for 17-OH Progesterone. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'hormone_17_oh_prog',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.hormone_androstenedione',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Androstenedione',
  'ng/dL',
  'Canonical lab concept hormone_androstenedione — Androstenedione. Clinical domain: hormones. Biomarker class: Hormone Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hormones within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Androstenedione. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'hormone_androstenedione',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.hormone_corticosterone',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Corticosterone',
  'ng/mL',
  'Canonical lab concept hormone_corticosterone — Corticosterone. Clinical domain: hormones. Biomarker class: Hormone Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hormones within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Corticosterone. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'hormone_corticosterone',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.hormone_deoxycortisol',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  '11-Deoxycortisol',
  'ng/mL',
  'Canonical lab concept hormone_deoxycortisol — 11-Deoxycortisol. Clinical domain: hormones. Biomarker class: Hormone Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hormones within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for 11-Deoxycortisol. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'hormone_deoxycortisol',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.hormone_dhea',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'DHEA',
  'ng/mL',
  'Canonical lab concept hormone_dhea — DHEA. Clinical domain: hormones. Biomarker class: Hormone Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hormones within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for DHEA. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'hormone_dhea',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.hormone_dhea_s',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'DHEA-S',
  'ug/dL',
  'Canonical lab concept hormone_dhea_s — DHEA-S. Clinical domain: hormones. Biomarker class: Hormone Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hormones within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for DHEA-S. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'hormone_dhea_s',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.hormone_prolactin',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Prolactin',
  'ng/mL',
  'Canonical lab concept hormone_prolactin — Prolactin. Clinical domain: hormones. Biomarker class: Hormone Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hormones within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Prolactin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'hormone_prolactin',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.hormone_testosterone_free',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Free Testosterone',
  'pg/mL',
  'Canonical lab concept hormone_testosterone_free — Free Testosterone. Clinical domain: hormones. Biomarker class: Hormone Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hormones within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Free Testosterone. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'hormone_testosterone_free',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.hormone_testosterone_total',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Total Testosterone',
  'ng/dL',
  'Canonical lab concept hormone_testosterone_total — Total Testosterone. Clinical domain: hormones. Biomarker class: Hormone Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to hormones within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Total Testosterone. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'hormone_testosterone_total',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.inflammation_crp',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'CRP',
  'mg/L',
  'Canonical lab concept inflammation_crp — CRP. Clinical domain: inflammation. Biomarker class: Inflammation.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to inflammation within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for CRP. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'inflammation_crp',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.inflammation_hscrp',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'High-Sensitivity CRP',
  'mg/L',
  'Canonical lab concept inflammation_hscrp — High-Sensitivity CRP. Clinical domain: inflammation. Biomarker class: Inflammation.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to inflammation within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for High-Sensitivity CRP. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'inflammation_hscrp',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.inflammation_lppla2',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Lp-PLA2 Activity',
  'nmol/min/mL',
  'Canonical lab concept inflammation_lppla2 — Lp-PLA2 Activity. Clinical domain: inflammation. Biomarker class: Cardiovascular Inflammation.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to inflammation within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Lp-PLA2 Activity. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'inflammation_lppla2',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.insulin_fasting',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Fasting Insulin',
  'uIU/mL',
  'Canonical lab concept insulin_fasting — Fasting Insulin. Clinical domain: glycemic. Biomarker class: Glycemic Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to glycemic within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Fasting Insulin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'insulin_fasting',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.iron_serum',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Serum Iron',
  'ug/dL',
  'Canonical lab concept iron_serum — Serum Iron. Clinical domain: iron. Biomarker class: Iron Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to iron within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Serum Iron. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'iron_serum',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.iron_tibc',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'TIBC',
  'ug/dL',
  'Canonical lab concept iron_tibc — TIBC. Clinical domain: iron. Biomarker class: Iron Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to iron within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for TIBC. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'iron_tibc',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.iron_transferrin_sat',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Transferrin Saturation',
  '%',
  'Canonical lab concept iron_transferrin_sat — Transferrin Saturation. Clinical domain: iron. Biomarker class: Iron Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to iron within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Transferrin Saturation. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'iron_transferrin_sat',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.iron_uibc',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'UIBC',
  'ug/dL',
  'Canonical lab concept iron_uibc — UIBC. Clinical domain: iron. Biomarker class: Iron Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to iron within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for UIBC. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'iron_uibc',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_apoa1',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Apolipoprotein A1',
  'mg/dL',
  'Canonical lab concept lipid_apoa1 — Apolipoprotein A1. Clinical domain: lipids. Biomarker class: Advanced Lipid.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Apolipoprotein A1. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_apoa1',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_apob',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Apolipoprotein B',
  'mg/dL',
  'Canonical lab concept lipid_apob — Apolipoprotein B. Clinical domain: lipids. Biomarker class: Advanced Lipid.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Apolipoprotein B. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_apob',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_apob_apoa1_ratio',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'ApoB/A1 Ratio',
  'ratio',
  'Canonical lab concept lipid_apob_apoa1_ratio — ApoB/A1 Ratio. Clinical domain: lipids. Biomarker class: Advanced Lipid.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for ApoB/A1 Ratio. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_apob_apoa1_ratio',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_chol_hdl_ratio',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Total/HDL Cholesterol Ratio',
  'ratio',
  'Canonical lab concept lipid_chol_hdl_ratio — Total/HDL Cholesterol Ratio. Clinical domain: lipids. Biomarker class: Lipid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Total/HDL Cholesterol Ratio. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_chol_hdl_ratio',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_hdl_c',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'HDL Cholesterol',
  'mg/dL',
  'Canonical lab concept lipid_hdl_c — HDL Cholesterol. Clinical domain: lipids. Biomarker class: Lipid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for HDL Cholesterol. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_hdl_c',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_hdl_direct',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'HDL Cholesterol (Direct)',
  'mg/dL',
  'Canonical lab concept lipid_hdl_direct — HDL Cholesterol (Direct). Clinical domain: lipids. Biomarker class: Lipid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for HDL Cholesterol (Direct). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_hdl_direct',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_hdl_ldl_ratio',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'HDL/LDL Ratio',
  'ratio',
  'Canonical lab concept lipid_hdl_ldl_ratio — HDL/LDL Ratio. Clinical domain: lipids. Biomarker class: Lipid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for HDL/LDL Ratio. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_hdl_ldl_ratio',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_hdlfx_pcad',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'HDLFX PCAD Score',
  'score',
  'Canonical lab concept lipid_hdlfx_pcad — HDLFX PCAD Score. Clinical domain: lipids. Biomarker class: Advanced Lipoprotein.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for HDLFX PCAD Score. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_hdlfx_pcad',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_ldl_c',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'LDL Cholesterol',
  'mg/dL',
  'Canonical lab concept lipid_ldl_c — LDL Cholesterol. Clinical domain: lipids. Biomarker class: Lipid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for LDL Cholesterol. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_ldl_c',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_ldl_direct',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'LDL Cholesterol (Direct)',
  'mg/dL',
  'Canonical lab concept lipid_ldl_direct — LDL Cholesterol (Direct). Clinical domain: lipids. Biomarker class: Lipid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for LDL Cholesterol (Direct). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_ldl_direct',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_ldl_hdl_ratio',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'LDL/HDL Ratio',
  'ratio',
  'Canonical lab concept lipid_ldl_hdl_ratio — LDL/HDL Ratio. Clinical domain: lipids. Biomarker class: Lipid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for LDL/HDL Ratio. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_ldl_hdl_ratio',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_lp_a',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Lipoprotein (a)',
  'nmol/L',
  'Canonical lab concept lipid_lp_a — Lipoprotein (a). Clinical domain: lipids. Biomarker class: Advanced Lipid.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Lipoprotein (a). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_lp_a',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_total_cholesterol',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Total Cholesterol',
  'mg/dL',
  'Canonical lab concept lipid_total_cholesterol — Total Cholesterol. Clinical domain: lipids. Biomarker class: Lipid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Total Cholesterol. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_total_cholesterol',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_trig_hdl_ratio',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Triglyceride/HDL Ratio',
  'ratio',
  'Canonical lab concept lipid_trig_hdl_ratio — Triglyceride/HDL Ratio. Clinical domain: lipids. Biomarker class: Lipid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Triglyceride/HDL Ratio. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_trig_hdl_ratio',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.lipid_vldl',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'VLDL',
  'mg/dL',
  'Canonical lab concept lipid_vldl — VLDL. Clinical domain: lipids. Biomarker class: Lipid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to lipids within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for VLDL. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'lipid_vldl',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_aat',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Alpha-1-Antitrypsin',
  'mg/dL',
  'Canonical lab concept liver_aat — Alpha-1-Antitrypsin. Clinical domain: liver. Biomarker class: Liver Extended.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Alpha-1-Antitrypsin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_aat',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_ag_ratio',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Albumin/Globulin Ratio',
  'ratio',
  'Canonical lab concept liver_ag_ratio — Albumin/Globulin Ratio. Clinical domain: liver. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Albumin/Globulin Ratio. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_ag_ratio',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_albumin',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Albumin',
  'g/dL',
  'Canonical lab concept liver_albumin — Albumin. Clinical domain: liver. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Albumin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_albumin',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_alt',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'ALT',
  'U/L',
  'Canonical lab concept liver_alt — ALT. Clinical domain: liver. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for ALT. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_alt',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_ast',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'AST',
  'U/L',
  'Canonical lab concept liver_ast — AST. Clinical domain: liver. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for AST. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_ast',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_ast_alt_ratio',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'AST/ALT Ratio',
  'ratio',
  'Canonical lab concept liver_ast_alt_ratio — AST/ALT Ratio. Clinical domain: liver. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for AST/ALT Ratio. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_ast_alt_ratio',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_bilirubin_direct',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Direct Bilirubin',
  'mg/dL',
  'Canonical lab concept liver_bilirubin_direct — Direct Bilirubin. Clinical domain: liver. Biomarker class: Liver Extended.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Direct Bilirubin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_bilirubin_direct',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_bilirubin_indirect',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Indirect Bilirubin',
  'mg/dL',
  'Canonical lab concept liver_bilirubin_indirect — Indirect Bilirubin. Clinical domain: liver. Biomarker class: Liver Extended.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Indirect Bilirubin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_bilirubin_indirect',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_bilirubin_total',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Total Bilirubin',
  'mg/dL',
  'Canonical lab concept liver_bilirubin_total — Total Bilirubin. Clinical domain: liver. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Total Bilirubin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_bilirubin_total',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_ggt',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'GGT',
  'U/L',
  'Canonical lab concept liver_ggt — GGT. Clinical domain: liver. Biomarker class: Liver Extended.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for GGT. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_ggt',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_globulin',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Globulin',
  'g/dL',
  'Canonical lab concept liver_globulin — Globulin. Clinical domain: liver. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Globulin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_globulin',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.liver_total_protein',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Total Protein',
  'g/dL',
  'Canonical lab concept liver_total_protein — Total Protein. Clinical domain: liver. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Total Protein. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'liver_total_protein',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.metabolic_homocysteine',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Homocysteine',
  'umol/L',
  'Canonical lab concept metabolic_homocysteine — Homocysteine. Clinical domain: metabolic. Biomarker class: Cardiovascular Metabolic.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to metabolic within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Homocysteine. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'metabolic_homocysteine',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.metabolic_uric_acid',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Uric Acid',
  'mg/dL',
  'Canonical lab concept metabolic_uric_acid — Uric Acid. Clinical domain: metabolic. Biomarker class: CMP Extended.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to metabolic within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Uric Acid. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'metabolic_uric_acid',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.minerals_chromium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Chromium',
  'mcg/L',
  'Canonical lab concept minerals_chromium — Chromium. Clinical domain: minerals. Biomarker class: Mineral Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to minerals within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Chromium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'minerals_chromium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.minerals_cobalt',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Cobalt',
  'mcg/L',
  'Canonical lab concept minerals_cobalt — Cobalt. Clinical domain: minerals. Biomarker class: Mineral Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to minerals within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Cobalt. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'minerals_cobalt',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.minerals_copper',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Serum Copper',
  'mcg/dL',
  'Canonical lab concept minerals_copper — Serum Copper. Clinical domain: minerals. Biomarker class: Mineral Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to minerals within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Serum Copper. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'minerals_copper',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.minerals_manganese',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Manganese',
  'mcg/L',
  'Canonical lab concept minerals_manganese — Manganese. Clinical domain: minerals. Biomarker class: Mineral Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to minerals within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Manganese. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'minerals_manganese',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.minerals_molybdenum',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Molybdenum',
  'mcg/L',
  'Canonical lab concept minerals_molybdenum — Molybdenum. Clinical domain: minerals. Biomarker class: Mineral Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to minerals within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Molybdenum. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'minerals_molybdenum',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.minerals_phosphorus',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Phosphorus',
  'mg/dL',
  'Canonical lab concept minerals_phosphorus — Phosphorus. Clinical domain: minerals. Biomarker class: CMP Extended.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to minerals within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Phosphorus. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'minerals_phosphorus',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.minerals_selenium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Selenium',
  'mcg/L',
  'Canonical lab concept minerals_selenium — Selenium. Clinical domain: minerals. Biomarker class: Mineral Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to minerals within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Selenium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'minerals_selenium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.minerals_strontium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Strontium',
  'mcg/L',
  'Canonical lab concept minerals_strontium — Strontium. Clinical domain: minerals. Biomarker class: Mineral Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to minerals within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Strontium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'minerals_strontium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.minerals_zinc',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Zinc',
  'mcg/dL',
  'Canonical lab concept minerals_zinc — Zinc. Clinical domain: minerals. Biomarker class: Mineral Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to minerals within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Zinc. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'minerals_zinc',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.pancreas_amylase',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Amylase',
  'U/L',
  'Canonical lab concept pancreas_amylase — Amylase. Clinical domain: pancreas. Biomarker class: Pancreas Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to pancreas within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Amylase. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'pancreas_amylase',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.phase_angle_left_arm',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Phase Angle (Left Arm)',
  'degrees',
  'Canonical lab concept phase_angle_left_arm — Phase Angle (Left Arm). Clinical domain: cellular_integrity. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to cellular_integrity within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Phase Angle (Left Arm). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'phase_angle_left_arm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.phase_angle_left_leg',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Phase Angle (Left Leg)',
  'degrees',
  'Canonical lab concept phase_angle_left_leg — Phase Angle (Left Leg). Clinical domain: cellular_integrity. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to cellular_integrity within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Phase Angle (Left Leg). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'phase_angle_left_leg',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.phase_angle_right_arm',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Phase Angle (Right Arm)',
  'degrees',
  'Canonical lab concept phase_angle_right_arm — Phase Angle (Right Arm). Clinical domain: cellular_integrity. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to cellular_integrity within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Phase Angle (Right Arm). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'phase_angle_right_arm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.phase_angle_right_leg',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Phase Angle (Right Leg)',
  'degrees',
  'Canonical lab concept phase_angle_right_leg — Phase Angle (Right Leg). Clinical domain: cellular_integrity. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to cellular_integrity within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Phase Angle (Right Leg). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'phase_angle_right_leg',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.phase_angle_trunk',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Phase Angle (Trunk)',
  'degrees',
  'Canonical lab concept phase_angle_trunk — Phase Angle (Trunk). Clinical domain: cellular_integrity. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to cellular_integrity within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Phase Angle (Trunk). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'phase_angle_trunk',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.phase_angle_whole_body',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Phase Angle (Whole Body)',
  'degrees',
  'Canonical lab concept phase_angle_whole_body — Phase Angle (Whole Body). Clinical domain: cellular_integrity. Biomarker class: InBody 970.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to cellular_integrity within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Phase Angle (Whole Body). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'phase_angle_whole_body',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.renal_bun',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Blood Urea Nitrogen',
  'mg/dL',
  'Canonical lab concept renal_bun — Blood Urea Nitrogen. Clinical domain: renal. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Blood Urea Nitrogen. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'renal_bun',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.renal_bun_creatinine_ratio',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'BUN/Creatinine Ratio',
  'ratio',
  'Canonical lab concept renal_bun_creatinine_ratio — BUN/Creatinine Ratio. Clinical domain: renal. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for BUN/Creatinine Ratio. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'renal_bun_creatinine_ratio',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.renal_creatinine',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Creatinine',
  'mg/dL',
  'Canonical lab concept renal_creatinine — Creatinine. Clinical domain: renal. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Creatinine. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'renal_creatinine',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.renal_creatinine_urine',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urine Creatinine',
  'mg/dL',
  'Canonical lab concept renal_creatinine_urine — Urine Creatinine. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urine Creatinine. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'renal_creatinine_urine',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.renal_egfr',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Estimated GFR',
  'mL/min/1.73m2',
  'Canonical lab concept renal_egfr — Estimated GFR. Clinical domain: renal. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Estimated GFR. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'renal_egfr',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.renal_microalbumin',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Microalbumin',
  'mg/L',
  'Canonical lab concept renal_microalbumin — Microalbumin. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Microalbumin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'renal_microalbumin',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.renal_uacr',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urine ACR',
  'mg/g',
  'Canonical lab concept renal_uacr — Urine ACR. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urine ACR. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'renal_uacr',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.renal_urea',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urea',
  'mg/dL',
  'Canonical lab concept renal_urea — Urea. Clinical domain: renal. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urea. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'renal_urea',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.renal_urea_creatinine_ratio',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urea/Creatinine Ratio',
  'ratio',
  'Canonical lab concept renal_urea_creatinine_ratio — Urea/Creatinine Ratio. Clinical domain: renal. Biomarker class: CMP.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urea/Creatinine Ratio. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'renal_urea_creatinine_ratio',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.thyroid_t3_total',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Total T3',
  'ng/dL',
  'Canonical lab concept thyroid_t3_total — Total T3. Clinical domain: thyroid. Biomarker class: Thyroid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to thyroid within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Total T3. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'thyroid_t3_total',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.thyroid_t4_total',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Total T4',
  'ug/dL',
  'Canonical lab concept thyroid_t4_total — Total T4. Clinical domain: thyroid. Biomarker class: Thyroid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to thyroid within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Total T4. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'thyroid_t4_total',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.thyroid_tsh',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'TSH',
  'uIU/mL',
  'Canonical lab concept thyroid_tsh — TSH. Clinical domain: thyroid. Biomarker class: Thyroid Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to thyroid within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for TSH. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'thyroid_tsh',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_aluminium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Aluminium',
  'mcg/L',
  'Canonical lab concept toxic_aluminium — Aluminium. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Aluminium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_aluminium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_antimony',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Antimony',
  'mcg/L',
  'Canonical lab concept toxic_antimony — Antimony. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Antimony. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_antimony',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_arsenic',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Arsenic',
  'mcg/L',
  'Canonical lab concept toxic_arsenic — Arsenic. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Arsenic. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_arsenic',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_barium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Barium',
  'mcg/L',
  'Canonical lab concept toxic_barium — Barium. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Barium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_barium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_beryllium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Beryllium',
  'mcg/L',
  'Canonical lab concept toxic_beryllium — Beryllium. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Beryllium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_beryllium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_bismuth',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Bismuth',
  'mcg/L',
  'Canonical lab concept toxic_bismuth — Bismuth. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Bismuth. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_bismuth',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_cadmium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Cadmium',
  'mcg/L',
  'Canonical lab concept toxic_cadmium — Cadmium. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Cadmium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_cadmium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_caesium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Caesium',
  'mcg/L',
  'Canonical lab concept toxic_caesium — Caesium. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Caesium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_caesium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_lead',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Lead',
  'mcg/dL',
  'Canonical lab concept toxic_lead — Lead. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Lead. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_lead',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_mercury',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Mercury',
  'mcg/L',
  'Canonical lab concept toxic_mercury — Mercury. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Mercury. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_mercury',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_nickel',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Nickel',
  'mcg/L',
  'Canonical lab concept toxic_nickel — Nickel. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Nickel. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_nickel',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_silver',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Silver',
  'mcg/L',
  'Canonical lab concept toxic_silver — Silver. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Silver. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_silver',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_thallium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Thallium',
  'mcg/L',
  'Canonical lab concept toxic_thallium — Thallium. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Thallium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_thallium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_tin',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Tin',
  'mcg/L',
  'Canonical lab concept toxic_tin — Tin. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Tin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_tin',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_uranium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Uranium',
  'mcg/L',
  'Canonical lab concept toxic_uranium — Uranium. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Uranium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_uranium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.toxic_vanadium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vanadium',
  'mcg/L',
  'Canonical lab concept toxic_vanadium — Vanadium. Clinical domain: toxics. Biomarker class: Heavy Metals.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to toxics within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vanadium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'toxic_vanadium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.urine_bilirubin',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urine Bilirubin',
  'mg/dL',
  'Canonical lab concept urine_bilirubin — Urine Bilirubin. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urine Bilirubin. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'urine_bilirubin',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.urine_blood',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urine Blood',
  'category',
  'Canonical lab concept urine_blood — Urine Blood. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urine Blood. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'urine_blood',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.urine_chloride',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urine Chloride',
  'mmol/L',
  'Canonical lab concept urine_chloride — Urine Chloride. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urine Chloride. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'urine_chloride',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.urine_glucose',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urine Glucose',
  'mg/dL',
  'Canonical lab concept urine_glucose — Urine Glucose. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urine Glucose. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'urine_glucose',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.urine_ketone',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urine Ketone',
  'mg/dL',
  'Canonical lab concept urine_ketone — Urine Ketone. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urine Ketone. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'urine_ketone',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.urine_leucocytes',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urine Leucocytes',
  '/hpf',
  'Canonical lab concept urine_leucocytes — Urine Leucocytes. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urine Leucocytes. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'urine_leucocytes',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.urine_potassium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urine Potassium',
  'mmol/L',
  'Canonical lab concept urine_potassium — Urine Potassium. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urine Potassium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'urine_potassium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.urine_protein',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urine Protein',
  'mg/dL',
  'Canonical lab concept urine_protein — Urine Protein. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urine Protein. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'urine_protein',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.urine_sodium',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urine Sodium',
  'mmol/L',
  'Canonical lab concept urine_sodium — Urine Sodium. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urine Sodium. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'urine_sodium',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.urine_urobilinogen',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Urobilinogen',
  'EU/dL',
  'Canonical lab concept urine_urobilinogen — Urobilinogen. Clinical domain: renal. Biomarker class: Urinalysis.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to renal within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Urobilinogen. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'urine_urobilinogen',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_a_retinol',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin A (Retinol)',
  'ng/mL',
  'Canonical lab concept vitamin_a_retinol — Vitamin A (Retinol). Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin A (Retinol). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_a_retinol',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_b12',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin B12',
  'pg/mL',
  'Canonical lab concept vitamin_b12 — Vitamin B12. Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin B12. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_b12',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_b1_thiamin',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin B1 (Thiamin)',
  'ng/mL',
  'Canonical lab concept vitamin_b1_thiamin — Vitamin B1 (Thiamin). Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin B1 (Thiamin). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_b1_thiamin',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_b2_riboflavin',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin B2 (Riboflavin)',
  'ng/mL',
  'Canonical lab concept vitamin_b2_riboflavin — Vitamin B2 (Riboflavin). Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin B2 (Riboflavin). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_b2_riboflavin',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_b3_niacin',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin B3 (Niacin)',
  'ng/mL',
  'Canonical lab concept vitamin_b3_niacin — Vitamin B3 (Niacin). Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin B3 (Niacin). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_b3_niacin',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_b5_pantothenic',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin B5 (Pantothenic)',
  'ng/mL',
  'Canonical lab concept vitamin_b5_pantothenic — Vitamin B5 (Pantothenic). Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin B5 (Pantothenic). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_b5_pantothenic',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_b6_p5p',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin B6 (P5P)',
  'ng/mL',
  'Canonical lab concept vitamin_b6_p5p — Vitamin B6 (P5P). Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin B6 (P5P). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_b6_p5p',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_b7_biotin',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin B7 (Biotin)',
  'ng/mL',
  'Canonical lab concept vitamin_b7_biotin — Vitamin B7 (Biotin). Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin B7 (Biotin). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_b7_biotin',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_b9_folic',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin B9 (Folic Acid)',
  'ng/mL',
  'Canonical lab concept vitamin_b9_folic — Vitamin B9 (Folic Acid). Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin B9 (Folic Acid). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_b9_folic',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_d2',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin D2',
  'ng/mL',
  'Canonical lab concept vitamin_d2 — Vitamin D2. Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin D2. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_d2',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_d3',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin D3',
  'ng/mL',
  'Canonical lab concept vitamin_d3 — Vitamin D3. Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin D3. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_d3',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_d_25oh',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  '25-OH Vitamin D',
  'ng/mL',
  'Canonical lab concept vitamin_d_25oh — 25-OH Vitamin D. Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for 25-OH Vitamin D. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_d_25oh',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_e_tocopherol',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin E (Tocopherol)',
  'mg/L',
  'Canonical lab concept vitamin_e_tocopherol — Vitamin E (Tocopherol). Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin E (Tocopherol). Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_e_tocopherol',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'lab',
  'lab.vitamin_k',
  'biochemical_state_snapshot',
  'direct_measure',
  'high',
  0,
  'Vitamin K',
  'ng/mL',
  'Canonical lab concept vitamin_k — Vitamin K. Clinical domain: vitamins. Biomarker class: Vitamin Panel.',
  ARRAY['Single timepoint measurement; cannot speak to trajectory without repeated draws', 'Snapshot biochemistry; cannot confirm causal driver without corroboration', 'Does not speak to the patient''s subjective experience or symptom burden', 'Clinical interpretation requires additional witnesses from other domains', 'Speaks to vitamins within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'Standard lab assay with established precision for Vitamin K. Confidence is in the measurement itself; clinical interpretation requires additional witnesses and temporal context.',
  0.950,
  2592000,
  'celf-ontology-v1.0',
  'vitamin_k',
  'p1a_initial'
);


-- ========================================================================
-- BLOCK: InBody concepts (direct_measure, body_composition)
-- Count: 19
-- ========================================================================

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_bmr',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Basal Metabolic Rate',
  'kcal/day',
  'Canonical inbody concept body_bmr — Basal Metabolic Rate. Clinical domain: metabolic. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to metabolic within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Basal Metabolic Rate. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_bmr',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_dry_lean_mass',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Dry Lean Mass',
  'lb',
  'Canonical inbody concept body_dry_lean_mass — Dry Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Dry Lean Mass. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_dry_lean_mass',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_ecw_tbw',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'ECW/TBW Ratio',
  'ratio',
  'Canonical inbody concept body_ecw_tbw — ECW/TBW Ratio. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for ECW/TBW Ratio. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_ecw_tbw',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_ecw_tbw_left_arm',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Left Arm ECW/TBW',
  'ratio',
  'Canonical inbody concept body_ecw_tbw_left_arm — Left Arm ECW/TBW. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Left Arm ECW/TBW. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_ecw_tbw_left_arm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_ecw_tbw_left_leg',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Left Leg ECW/TBW',
  'ratio',
  'Canonical inbody concept body_ecw_tbw_left_leg — Left Leg ECW/TBW. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Left Leg ECW/TBW. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_ecw_tbw_left_leg',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_ecw_tbw_right_arm',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Right Arm ECW/TBW',
  'ratio',
  'Canonical inbody concept body_ecw_tbw_right_arm — Right Arm ECW/TBW. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Right Arm ECW/TBW. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_ecw_tbw_right_arm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_ecw_tbw_right_leg',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Right Leg ECW/TBW',
  'ratio',
  'Canonical inbody concept body_ecw_tbw_right_leg — Right Leg ECW/TBW. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Right Leg ECW/TBW. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_ecw_tbw_right_leg',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_ecw_tbw_trunk',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Trunk ECW/TBW',
  'ratio',
  'Canonical inbody concept body_ecw_tbw_trunk — Trunk ECW/TBW. Clinical domain: hydration. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to hydration within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Trunk ECW/TBW. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_ecw_tbw_trunk',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_fat_free_mass',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Fat Free Mass',
  'lb',
  'Canonical inbody concept body_fat_free_mass — Fat Free Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Fat Free Mass. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_fat_free_mass',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_fat_mass',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Body Fat Mass',
  'lb',
  'Canonical inbody concept body_fat_mass — Body Fat Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Body Fat Mass. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_fat_mass',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_fat_pct',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Percent Body Fat',
  '%',
  'Canonical inbody concept body_fat_pct — Percent Body Fat. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Percent Body Fat. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_fat_pct',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_lean_left_arm',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Left Arm Lean Mass',
  'lb',
  'Canonical inbody concept body_lean_left_arm — Left Arm Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Left Arm Lean Mass. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_lean_left_arm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_lean_left_leg',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Left Leg Lean Mass',
  'lb',
  'Canonical inbody concept body_lean_left_leg — Left Leg Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Left Leg Lean Mass. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_lean_left_leg',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_lean_right_arm',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Right Arm Lean Mass',
  'lb',
  'Canonical inbody concept body_lean_right_arm — Right Arm Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Right Arm Lean Mass. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_lean_right_arm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_lean_right_leg',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Right Leg Lean Mass',
  'lb',
  'Canonical inbody concept body_lean_right_leg — Right Leg Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Right Leg Lean Mass. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_lean_right_leg',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_lean_trunk',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Trunk Lean Mass',
  'lb',
  'Canonical inbody concept body_lean_trunk — Trunk Lean Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Trunk Lean Mass. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_lean_trunk',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_smm',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Skeletal Muscle Mass',
  'lb',
  'Canonical inbody concept body_smm — Skeletal Muscle Mass. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Skeletal Muscle Mass. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_smm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.body_visceral_fat_area',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Visceral Fat Area',
  'cm2',
  'Canonical inbody concept body_visceral_fat_area — Visceral Fat Area. Clinical domain: body_composition. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to body_composition within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Visceral Fat Area. Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'body_visceral_fat_area',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'inbody',
  'inbody.phase_angle_whole_body',
  'body_composition',
  'direct_measure',
  'high',
  0,
  'Phase Angle (Whole Body)',
  'degrees',
  'Canonical inbody concept phase_angle_whole_body — Phase Angle (Whole Body). Clinical domain: cellular_integrity. Biomarker class: InBody 970.',
  ARRAY['Bioimpedance-derived estimate; accuracy depends on hydration and fasting state', 'Does not distinguish metabolic drivers of body composition', 'Cannot adjudicate intramuscular or visceral composition without imaging confirmation', 'Speaks to cellular_integrity within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'InBody bioimpedance measurement for Phase Angle (Whole Body). Confidence is in the measurement given standard fasting and hydration protocol; interpretation requires comparison with reference ranges and trend.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'phase_angle_whole_body',
  'p1a_initial'
);


-- ========================================================================
-- BLOCK: FibroScan concepts (direct_measure, hepatic_mechanical_state)
-- Count: 3
-- ========================================================================

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'fibroscan',
  'fibroscan.fibroscan_cap',
  'hepatic_mechanical_state',
  'direct_measure',
  'high',
  0,
  'Controlled Attenuation Parameter (steatosis)',
  'dB/m',
  'Canonical fibroscan concept fibroscan_cap — Controlled Attenuation Parameter (steatosis). Clinical domain: liver. Biomarker class: FibroScan.',
  ARRAY['Elastography at one timepoint; cannot establish fibrosis trajectory without repeat', 'Measures mechanical stiffness; does not identify etiology', 'Probe-dependent; inter-operator and inter-device variability exists', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'FibroScan elastography measurement for Controlled Attenuation Parameter (steatosis). Confidence is in the mechanical reading given standard probe placement; etiology requires additional witnesses from lab and history.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'fibroscan_cap',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'fibroscan',
  'fibroscan.fibroscan_lsm',
  'hepatic_mechanical_state',
  'direct_measure',
  'high',
  0,
  'Liver Stiffness Measurement',
  'kPa',
  'Canonical fibroscan concept fibroscan_lsm — Liver Stiffness Measurement. Clinical domain: liver. Biomarker class: FibroScan.',
  ARRAY['Elastography at one timepoint; cannot establish fibrosis trajectory without repeat', 'Measures mechanical stiffness; does not identify etiology', 'Probe-dependent; inter-operator and inter-device variability exists', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'FibroScan elastography measurement for Liver Stiffness Measurement. Confidence is in the mechanical reading given standard probe placement; etiology requires additional witnesses from lab and history.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'fibroscan_lsm',
  'p1a_initial'
);

INSERT INTO public.witness_signal_registry (
  source_window, signal, domain_of_access, epistemic_role, reliability_class,
  compression_depth, label, unit, description,
  default_limitations, default_confidence_basis, default_confidence_value,
  default_validity_window_seconds, ontology_version, ontology_concept_id,
  registry_seed_version
) VALUES (
  'fibroscan',
  'fibroscan.fibroscan_sws',
  'hepatic_mechanical_state',
  'direct_measure',
  'high',
  0,
  'Shear Wave Speed',
  'm/s',
  'Canonical fibroscan concept fibroscan_sws — Shear Wave Speed. Clinical domain: liver. Biomarker class: FibroScan.',
  ARRAY['Elastography at one timepoint; cannot establish fibrosis trajectory without repeat', 'Measures mechanical stiffness; does not identify etiology', 'Probe-dependent; inter-operator and inter-device variability exists', 'Speaks to liver within its source domain; cannot adjudicate unrelated systems']::TEXT[],
  'FibroScan elastography measurement for Shear Wave Speed. Confidence is in the mechanical reading given standard probe placement; etiology requires additional witnesses from lab and history.',
  0.950,
  7776000,
  'celf-ontology-v1.0',
  'fibroscan_sws',
  'p1a_initial'
);


COMMIT;

-- ============================================================================
-- END OF REGISTRY SEED
-- ============================================================================
