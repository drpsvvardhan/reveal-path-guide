-- ============================================================================
-- CELF Export Adapter
-- Purpose: translate Reveal Path internal state into CELF ingestion bundles
-- Date: 2026-04-16
-- Contract: Russell Shapiro bundle shape (subject + source_documents +
--           observations + feature_state)
-- ============================================================================

create table if not exists public.celf_feature_map (
  id                   uuid primary key default gen_random_uuid(),
  source_system        text not null check (source_system in ('lab','inbody','cie','cie_gate','cie_domain','emr','sensor','food_log','imaging')),
  reveal_canonical     text not null,
  celf_feature_name    text not null,
  celf_feature_label   text,
  celf_domain          text,
  celf_panel_group     text,
  unit_canonical       text,
  map_version          text not null default 'celf-v0.2',
  notes                text,
  created_at           timestamptz not null default now(),
  unique (source_system, reveal_canonical, map_version)
);

create index if not exists idx_celf_feature_map_lookup
  on public.celf_feature_map (source_system, reveal_canonical, map_version);

alter table public.celf_feature_map enable row level security;
create policy "celf_feature_map_read" on public.celf_feature_map
  for select to authenticated using (true);

create table if not exists public.celf_exports (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  bundle_version            text not null default 'celf-v0.2',
  map_version               text not null default 'celf-v0.2',
  status                    text not null default 'ready'
                              check (status in ('pending','ready','downloaded','shared_with_clinician','pushed_to_biotwin_generator','failed')),
  phi_level                 text not null default 'full_phi'
                              check (phi_level in ('full_phi','tokenized','de_identified')),
  subject_count             integer not null default 0,
  source_document_count     integer not null default 0,
  observation_count         integer not null default 0,
  feature_state_count       integer not null default 0,
  has_labs                  boolean not null default false,
  has_inbody                boolean not null default false,
  has_cie                   boolean not null default false,
  has_food_log              boolean not null default false,
  bundle                    jsonb not null,
  content_sha256            text not null,
  downloaded_at             timestamptz,
  shared_with_clinician_at  timestamptz,
  pushed_at                 timestamptz,
  pushed_to_url             text,
  failure_reason            text,
  generated_at              timestamptz not null default now()
);

create index if not exists idx_celf_exports_user        on public.celf_exports (user_id, generated_at desc);
create index if not exists idx_celf_exports_content     on public.celf_exports (content_sha256);
create index if not exists idx_celf_exports_status      on public.celf_exports (status);

alter table public.celf_exports enable row level security;

create policy "celf_exports_owner_select" on public.celf_exports
  for select to authenticated
  using (user_id = auth.uid());

create policy "celf_exports_owner_insert" on public.celf_exports
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "celf_exports_owner_update_status" on public.celf_exports
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "celf_exports_no_delete" on public.celf_exports
  for delete to authenticated
  using (false);

grant select on public.celf_feature_map to authenticated;
grant select, insert, update on public.celf_exports to authenticated;

-- ============================================================================
-- Seed celf_feature_map (celf-v0.2)
-- ============================================================================
delete from public.celf_feature_map where map_version = 'celf-v0.2';

-- LAB ANALYTES
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical) values
('lab','Glucose','glucose_fasting','Fasting Glucose','glycemic','Basic Metabolic','mg/dL'),
('lab','HbA1c','hba1c','Hemoglobin A1c','glycemic','Glycemic Panel','%'),
('lab','Insulin','insulin_fasting','Fasting Insulin','glycemic','Glycemic Panel','uIU/mL'),
('lab','C-Peptide','c_peptide','C-Peptide','glycemic','Glycemic Panel','ng/mL'),
('lab','Total Cholesterol','lipid_total_cholesterol','Total Cholesterol','lipids','Lipid Panel','mg/dL'),
('lab','LDL-C','lipid_ldl_c','LDL Cholesterol','lipids','Lipid Panel','mg/dL'),
('lab','HDL-C','lipid_hdl_c','HDL Cholesterol','lipids','Lipid Panel','mg/dL'),
('lab','Triglycerides','lipid_triglycerides','Triglycerides','lipids','Lipid Panel','mg/dL'),
('lab','Non-HDL Cholesterol','lipid_non_hdl_c','Non-HDL Cholesterol','lipids','Lipid Panel','mg/dL'),
('lab','VLDL','lipid_vldl','VLDL','lipids','Lipid Panel','mg/dL'),
('lab','ApoB','lipid_apob','Apolipoprotein B','lipids','Advanced Lipid','mg/dL'),
('lab','Lp(a)','lipid_lp_a','Lipoprotein (a)','lipids','Advanced Lipid','nmol/L'),
('lab','BUN','renal_bun','Blood Urea Nitrogen','renal','CMP','mg/dL'),
('lab','Creatinine','renal_creatinine','Creatinine','renal','CMP','mg/dL'),
('lab','eGFR','renal_egfr','Estimated GFR','renal','CMP','mL/min/1.73m2'),
('lab','Cystatin C','renal_cystatin_c','Cystatin C','renal','Kidney Advanced','mg/L'),
('lab','Sodium','electrolytes_sodium','Sodium','electrolytes','CMP','mmol/L'),
('lab','Potassium','electrolytes_potassium','Potassium','electrolytes','CMP','mmol/L'),
('lab','Chloride','electrolytes_chloride','Chloride','electrolytes','CMP','mmol/L'),
('lab','CO2','electrolytes_co2','Bicarbonate','electrolytes','CMP','mmol/L'),
('lab','Calcium','minerals_calcium','Calcium','minerals','CMP','mg/dL'),
('lab','Magnesium','minerals_magnesium','Magnesium','minerals','Extended CMP','mg/dL'),
('lab','Total Protein','liver_total_protein','Total Protein','liver','CMP','g/dL'),
('lab','Albumin','liver_albumin','Albumin','liver','CMP','g/dL'),
('lab','Globulin','liver_globulin','Globulin','liver','CMP','g/dL'),
('lab','A/G Ratio','liver_ag_ratio','Albumin/Globulin Ratio','liver','CMP','ratio'),
('lab','AST','liver_ast','AST','liver','CMP','U/L'),
('lab','ALT','liver_alt','ALT','liver','CMP','U/L'),
('lab','Alkaline Phosphatase','liver_alp','Alkaline Phosphatase','liver','CMP','U/L'),
('lab','GGT','liver_ggt','GGT','liver','Liver Extended','U/L'),
('lab','Total Bilirubin','liver_bilirubin_total','Total Bilirubin','liver','CMP','mg/dL'),
('lab','Direct Bilirubin','liver_bilirubin_direct','Direct Bilirubin','liver','Liver Extended','mg/dL'),
('lab','Microalbumin','renal_microalbumin','Microalbumin','renal','Kidney Advanced','mg/L'),
('lab','Albumin/Creatinine Ratio','renal_uacr','Urine ACR','renal','Kidney Advanced','mg/g'),
('lab','WBC','cbc_wbc','White Blood Cell Count','hematology','CBC','10^3/uL'),
('lab','RBC','cbc_rbc','Red Blood Cell Count','hematology','CBC','10^6/uL'),
('lab','Hemoglobin','cbc_hemoglobin','Hemoglobin','hematology','CBC','g/dL'),
('lab','Hematocrit','cbc_hematocrit','Hematocrit','hematology','CBC','%'),
('lab','MCV','cbc_mcv','MCV','hematology','CBC','fL'),
('lab','MCH','cbc_mch','MCH','hematology','CBC','pg'),
('lab','MCHC','cbc_mchc','MCHC','hematology','CBC','g/dL'),
('lab','RDW','cbc_rdw','RDW','hematology','CBC','%'),
('lab','Platelets','cbc_platelets','Platelets','hematology','CBC','10^3/uL'),
('lab','MPV','cbc_mpv','MPV','hematology','CBC','fL'),
('lab','Neutrophils','cbc_neutrophils_pct','Neutrophils','hematology','CBC Diff','%'),
('lab','Lymphocytes','cbc_lymphocytes_pct','Lymphocytes','hematology','CBC Diff','%'),
('lab','Monocytes','cbc_monocytes_pct','Monocytes','hematology','CBC Diff','%'),
('lab','Eosinophils','cbc_eosinophils_pct','Eosinophils','hematology','CBC Diff','%'),
('lab','Basophils','cbc_basophils_pct','Basophils','hematology','CBC Diff','%'),
('lab','TSH','thyroid_tsh','TSH','thyroid','Thyroid Panel','uIU/mL'),
('lab','Free T4','thyroid_free_t4','Free T4','thyroid','Thyroid Panel','ng/dL'),
('lab','Free T3','thyroid_free_t3','Free T3','thyroid','Thyroid Panel','pg/mL'),
('lab','Reverse T3','thyroid_reverse_t3','Reverse T3','thyroid','Thyroid Extended','ng/dL'),
('lab','TPO Antibodies','thyroid_tpo_ab','TPO Antibodies','thyroid','Thyroid Antibody','IU/mL'),
('lab','Thyroglobulin','thyroid_thyroglobulin','Thyroglobulin','thyroid','Thyroid Extended','ng/mL'),
('lab','hsCRP','inflammation_hscrp','High-Sensitivity CRP','inflammation','Inflammation','mg/L'),
('lab','CRP','inflammation_crp','CRP','inflammation','Inflammation','mg/L'),
('lab','ESR','inflammation_esr','ESR','inflammation','Inflammation','mm/hr'),
('lab','Ferritin','iron_ferritin','Ferritin','iron','Iron Panel','ng/mL'),
('lab','IL-6','inflammation_il6','Interleukin-6','inflammation','Inflammation Extended','pg/mL'),
('lab','TNF-alpha','inflammation_tnf_alpha','TNF-alpha','inflammation','Inflammation Extended','pg/mL'),
('lab','MPO','inflammation_mpo','Myeloperoxidase','inflammation','Cardiovascular Inflammation','pmol/L'),
('lab','LpPLA2','inflammation_lppla2','Lp-PLA2','inflammation','Cardiovascular Inflammation','nmol/min/mL'),
('lab','Iron','iron_serum','Serum Iron','iron','Iron Panel','ug/dL'),
('lab','TIBC','iron_tibc','TIBC','iron','Iron Panel','ug/dL'),
('lab','Transferrin','iron_transferrin','Transferrin','iron','Iron Panel','mg/dL'),
('lab','Transferrin Saturation','iron_transferrin_sat','Transferrin Saturation','iron','Iron Panel','%'),
('lab','Vitamin D','vitamin_d_25oh','25-OH Vitamin D','vitamins','Vitamin Panel','ng/mL'),
('lab','Vitamin B12','vitamin_b12','Vitamin B12','vitamins','Vitamin Panel','pg/mL'),
('lab','Folate','folate_serum','Folate','vitamins','Vitamin Panel','ng/mL'),
('lab','Homocysteine','metabolic_homocysteine','Homocysteine','metabolic','Cardiovascular Metabolic','umol/L'),
('lab','MMA','metabolic_mma','Methylmalonic Acid','metabolic','B12 Extended','nmol/L'),
('lab','Testosterone','hormone_testosterone_total','Total Testosterone','hormones','Hormone Panel','ng/dL'),
('lab','Free Testosterone','hormone_testosterone_free','Free Testosterone','hormones','Hormone Panel','pg/mL'),
('lab','Estradiol','hormone_estradiol','Estradiol','hormones','Hormone Panel','pg/mL'),
('lab','Progesterone','hormone_progesterone','Progesterone','hormones','Hormone Panel','ng/mL'),
('lab','DHEA-S','hormone_dhea_s','DHEA-S','hormones','Hormone Panel','ug/dL'),
('lab','Cortisol','hormone_cortisol','Cortisol','hormones','Hormone Panel','ug/dL'),
('lab','SHBG','hormone_shbg','SHBG','hormones','Hormone Panel','nmol/L'),
('lab','NT-proBNP','cardiac_nt_probnp','NT-proBNP','cardiac','Cardiac Biomarkers','pg/mL'),
('lab','BNP','cardiac_bnp','BNP','cardiac','Cardiac Biomarkers','pg/mL'),
('lab','Troponin I','cardiac_troponin_i','Troponin I','cardiac','Cardiac Biomarkers','ng/mL'),
('lab','High-Sensitivity Troponin','cardiac_hs_troponin','High-Sensitivity Troponin','cardiac','Cardiac Biomarkers','ng/L'),
('lab','D-Dimer','coag_d_dimer','D-Dimer','coagulation','Coagulation','ng/mL FEU'),
('lab','Fibrinogen','coag_fibrinogen','Fibrinogen','coagulation','Coagulation','mg/dL'),
('lab','Uric Acid','metabolic_uric_acid','Uric Acid','metabolic','CMP Extended','mg/dL');

-- INBODY MEASUREMENTS
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical) values
('inbody','Weight','body_weight','Body Weight','body_composition','InBody 970','kg'),
('inbody','Skeletal Muscle Mass','body_smm','Skeletal Muscle Mass','body_composition','InBody 970','kg'),
('inbody','Body Fat Mass','body_fat_mass','Body Fat Mass','body_composition','InBody 970','kg'),
('inbody','Percent Body Fat','body_fat_pct','Percent Body Fat','body_composition','InBody 970','%'),
('inbody','BMI','body_bmi','Body Mass Index','body_composition','InBody 970','kg/m2'),
('inbody','Visceral Fat Level','body_visceral_fat','Visceral Fat Level','body_composition','InBody 970','level'),
('inbody','Visceral Fat Area','body_visceral_fat_area','Visceral Fat Area','body_composition','InBody 970','cm2'),
('inbody','Waist-Hip Ratio','body_whr','Waist-Hip Ratio','body_composition','InBody 970','ratio'),
('inbody','ECW/TBW Ratio','body_ecw_tbw','ECW/TBW Ratio','hydration','InBody 970','ratio'),
('inbody','Total Body Water','body_tbw','Total Body Water','hydration','InBody 970','L'),
('inbody','Intracellular Water','body_icw','Intracellular Water','hydration','InBody 970','L'),
('inbody','Extracellular Water','body_ecw','Extracellular Water','hydration','InBody 970','L'),
('inbody','Phase Angle - Whole Body','phase_angle_whole_body','Phase Angle (Whole Body)','cellular_integrity','InBody 970','degrees'),
('inbody','Phase Angle - Right Arm','phase_angle_right_arm','Phase Angle (Right Arm)','cellular_integrity','InBody 970','degrees'),
('inbody','Phase Angle - Left Arm','phase_angle_left_arm','Phase Angle (Left Arm)','cellular_integrity','InBody 970','degrees'),
('inbody','Phase Angle - Trunk','phase_angle_trunk','Phase Angle (Trunk)','cellular_integrity','InBody 970','degrees'),
('inbody','Phase Angle - Right Leg','phase_angle_right_leg','Phase Angle (Right Leg)','cellular_integrity','InBody 970','degrees'),
('inbody','Phase Angle - Left Leg','phase_angle_left_leg','Phase Angle (Left Leg)','cellular_integrity','InBody 970','degrees'),
('inbody','Basal Metabolic Rate','body_bmr','Basal Metabolic Rate','metabolic','InBody 970','kcal/day'),
('inbody','InBody Score','body_inbody_score','InBody Score','composite','InBody 970','score');

-- CIE DOMAINS
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical) values
('cie_domain','A1','cie_domain_a1_liver_flux','CIE Domain A1: Liver Flux','cie_liver','CIE v2.2 Domains','score_0_100'),
('cie_domain','A2','cie_domain_a2_liver_storage','CIE Domain A2: Liver Storage','cie_liver','CIE v2.2 Domains','score_0_100'),
('cie_domain','A3','cie_domain_a3_liver_clearance','CIE Domain A3: Liver Clearance','cie_liver','CIE v2.2 Domains','score_0_100'),
('cie_domain','B1','cie_domain_b1_muscle_insulin','CIE Domain B1: Muscle Insulin Sensitivity','cie_muscle','CIE v2.2 Domains','score_0_100'),
('cie_domain','B2','cie_domain_b2_muscle_contractile','CIE Domain B2: Muscle Contractile Capacity','cie_muscle','CIE v2.2 Domains','score_0_100'),
('cie_domain','B3','cie_domain_b3_muscle_recovery','CIE Domain B3: Muscle Recovery','cie_muscle','CIE v2.2 Domains','score_0_100'),
('cie_domain','C1','cie_domain_c1_adipose_storage','CIE Domain C1: Adipose Storage','cie_adipose','CIE v2.2 Domains','score_0_100'),
('cie_domain','C2','cie_domain_c2_adipose_lipolysis','CIE Domain C2: Adipose Lipolysis','cie_adipose','CIE v2.2 Domains','score_0_100'),
('cie_domain','D1','cie_domain_d1_cardiac_output','CIE Domain D1: Cardiac Output','cie_cardiac','CIE v2.2 Domains','score_0_100'),
('cie_domain','D2','cie_domain_d2_cardiac_rhythm','CIE Domain D2: Cardiac Rhythm','cie_cardiac','CIE v2.2 Domains','score_0_100'),
('cie_domain','D3','cie_domain_d3_vascular_tone','CIE Domain D3: Vascular Tone','cie_cardiac','CIE v2.2 Domains','score_0_100'),
('cie_domain','E1','cie_domain_e1_autonomic_balance','CIE Domain E1: Autonomic Balance','cie_autonomic','CIE v2.2 Domains','score_0_100'),
('cie_domain','E2','cie_domain_e2_sleep_architecture','CIE Domain E2: Sleep Architecture','cie_autonomic','CIE v2.2 Domains','score_0_100'),
('cie_domain','F1','cie_domain_f1_gut_barrier','CIE Domain F1: Gut Barrier','cie_gut','CIE v2.2 Domains','score_0_100'),
('cie_domain','F2','cie_domain_f2_gut_motility','CIE Domain F2: Gut Motility','cie_gut','CIE v2.2 Domains','score_0_100'),
('cie_domain','F3','cie_domain_f3_microbiome_health','CIE Domain F3: Microbiome Health','cie_gut','CIE v2.2 Domains','score_0_100'),
('cie_domain','G1','cie_domain_g1_immune_baseline','CIE Domain G1: Immune Baseline','cie_immune','CIE v2.2 Domains','score_0_100'),
('cie_domain','G2','cie_domain_g2_inflammatory_load','CIE Domain G2: Inflammatory Load','cie_immune','CIE v2.2 Domains','score_0_100'),
('cie_domain','H1','cie_domain_h1_hormonal_axis','CIE Domain H1: Hormonal Axis','cie_hormonal','CIE v2.2 Domains','score_0_100'),
('cie_domain','H2','cie_domain_h2_thyroid_function','CIE Domain H2: Thyroid Function','cie_hormonal','CIE v2.2 Domains','score_0_100'),
('cie_domain','I1','cie_domain_i1_cognitive_capacity','CIE Domain I1: Cognitive Capacity','cie_cognitive','CIE v2.2 Domains','score_0_100'),
('cie_domain','I2','cie_domain_i2_mood_regulation','CIE Domain I2: Mood Regulation','cie_cognitive','CIE v2.2 Domains','score_0_100'),
('cie_domain','J1','cie_domain_j1_stress_load','CIE Domain J1: Stress Load','cie_behavioral','CIE v2.2 Domains','score_0_100'),
('cie_domain','J2','cie_domain_j2_behavioral_coherence','CIE Domain J2: Behavioral Coherence','cie_behavioral','CIE v2.2 Domains','score_0_100'),
('cie_domain','K1','cie_domain_k1_environmental_load','CIE Domain K1: Environmental Load','cie_environmental','CIE v2.2 Domains','score_0_100');

-- CIE GATES
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical) values
('cie_gate','G_LIVER_METABOLIC','cie_gate_liver_metabolic','CIE Gate: Liver Metabolic','cie_gate','CIE v2.2 Gates','score_0_100'),
('cie_gate','G_MUSCLE_RESERVE','cie_gate_muscle_reserve','CIE Gate: Muscle Reserve','cie_gate','CIE v2.2 Gates','score_0_100'),
('cie_gate','G_ADIPOSE_PHENOTYPE','cie_gate_adipose_phenotype','CIE Gate: Adipose Phenotype','cie_gate','CIE v2.2 Gates','score_0_100'),
('cie_gate','G_CARDIAC_TERRAIN','cie_gate_cardiac_terrain','CIE Gate: Cardiac Terrain','cie_gate','CIE v2.2 Gates','score_0_100'),
('cie_gate','G_AUTONOMIC_POISE','cie_gate_autonomic_poise','CIE Gate: Autonomic Poise','cie_gate','CIE v2.2 Gates','score_0_100'),
('cie_gate','G_GUT_INTEGRITY','cie_gate_gut_integrity','CIE Gate: Gut Integrity','cie_gate','CIE v2.2 Gates','score_0_100'),
('cie_gate','G_IMMUNE_COHERENCE','cie_gate_immune_coherence','CIE Gate: Immune Coherence','cie_gate','CIE v2.2 Gates','score_0_100'),
('cie_gate','G_HORMONAL_AXIS','cie_gate_hormonal_axis','CIE Gate: Hormonal Axis','cie_gate','CIE v2.2 Gates','score_0_100'),
('cie_gate','G_COGNITIVE_MOOD','cie_gate_cognitive_mood','CIE Gate: Cognitive Mood','cie_gate','CIE v2.2 Gates','score_0_100');