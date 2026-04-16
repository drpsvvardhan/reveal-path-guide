-- Extend source_system check to allow fibroscan
alter table public.celf_feature_map drop constraint if exists celf_feature_map_source_system_check;
alter table public.celf_feature_map add constraint celf_feature_map_source_system_check
  check (source_system = ANY (ARRAY['lab','inbody','cie','cie_gate','cie_domain','emr','sensor','food_log','imaging','fibroscan']));

-- Reseed v0.3
delete from public.celf_feature_map where map_version = 'celf-v0.3';

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version)
select source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, 'celf-v0.3'
from public.celf_feature_map
where map_version = 'celf-v0.2'
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','HS CRP','inflammation_hscrp','High-Sensitivity CRP','inflammation','Inflammation','mg/L','celf-v0.3'),
('lab','HSCRP','inflammation_hscrp','High-Sensitivity CRP','inflammation','Inflammation','mg/L','celf-v0.3'),
('lab','UREA NITROGEN (BUN)','renal_bun','Blood Urea Nitrogen','renal','CMP','mg/dL','celf-v0.3'),
('lab','LDL-CHOLESTEROL','lipid_ldl_c','LDL Cholesterol','lipids','Lipid Panel','mg/dL','celf-v0.3'),
('lab','HDL-CHOLESTEROL','lipid_hdl_c','HDL Cholesterol','lipids','Lipid Panel','mg/dL','celf-v0.3'),
('lab','CHOLESTEROL','lipid_total_cholesterol','Total Cholesterol','lipids','Lipid Panel','mg/dL','celf-v0.3'),
('lab','CHOL/HDLC RATIO','lipid_chol_hdl_ratio','Total/HDL Cholesterol Ratio','lipids','Advanced Lipid','ratio','celf-v0.3'),
('lab','CHOL/HDL RATIO','lipid_chol_hdl_ratio','Total/HDL Cholesterol Ratio','lipids','Advanced Lipid','ratio','celf-v0.3'),
('lab','TRIG/HDL RATIO','lipid_trig_hdl_ratio','Triglyceride/HDL Ratio','lipids','Advanced Lipid','ratio','celf-v0.3'),
('lab','HEMOGLOBIN A1C','hba1c','Hemoglobin A1c','glycemic','Glycemic Panel','%','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','APOLIPOPROTEIN A1','lipid_apoa1','Apolipoprotein A1','lipids','Advanced Lipid','mg/dL','celf-v0.3'),
('lab','Apolipoprotein A1','lipid_apoa1','Apolipoprotein A1','lipids','Advanced Lipid','mg/dL','celf-v0.3'),
('lab','APO A1','lipid_apoa1','Apolipoprotein A1','lipids','Advanced Lipid','mg/dL','celf-v0.3'),
('lab','AALP APO A1','lipid_aalp_apoa1','AALP ApoA1','lipids','Advanced Lipoprotein','nmol/L','celf-v0.3'),
('lab','AALP APO C1','lipid_aalp_apoc1','AALP ApoC1','lipids','Advanced Lipoprotein','nmol/L','celf-v0.3'),
('lab','AALP APO C2','lipid_aalp_apoc2','AALP ApoC2','lipids','Advanced Lipoprotein','nmol/L','celf-v0.3'),
('lab','AALP APO C3','lipid_aalp_apoc3','AALP ApoC3','lipids','Advanced Lipoprotein','nmol/L','celf-v0.3'),
('lab','AALP APO C4','lipid_aalp_apoc4','AALP ApoC4','lipids','Advanced Lipoprotein','nmol/L','celf-v0.3'),
('lab','HDLFX PCEC','lipid_hdlfx_pcec','HDL Fractionation PCEC','lipids','Advanced Lipoprotein','nmol/L','celf-v0.3'),
('lab','LIPOPROTEIN (a)','lipid_lp_a','Lipoprotein (a)','lipids','Advanced Lipid','nmol/L','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','LDL PARTICLE NUMBER','lipid_ldl_p','LDL Particle Number','lipids','Ion Mobility','nmol/L','celf-v0.3'),
('lab','LDL-P','lipid_ldl_p','LDL Particle Number','lipids','Ion Mobility','nmol/L','celf-v0.3'),
('lab','LDL PEAK SIZE','lipid_ldl_peak_size','LDL Peak Size','lipids','Ion Mobility','angstrom','celf-v0.3'),
('lab','LDL SMALL','lipid_ldl_small','LDL Small','lipids','Ion Mobility','nmol/L','celf-v0.3'),
('lab','LDL MEDIUM','lipid_ldl_medium','LDL Medium','lipids','Ion Mobility','nmol/L','celf-v0.3'),
('lab','LDL PATTERN','lipid_ldl_pattern','LDL Pattern (A/B)','lipids','Ion Mobility','pattern','celf-v0.3'),
('lab','HDL LARGE','lipid_hdl_large','HDL Large','lipids','Ion Mobility','nmol/L','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','OxLDL','inflammation_oxldl','Oxidized LDL','inflammation','Cardiovascular Inflammation','U/L','celf-v0.3'),
('lab','OXIDIZED LDL','inflammation_oxldl','Oxidized LDL','inflammation','Cardiovascular Inflammation','U/L','celf-v0.3'),
('lab','LP PLA2 ACTIVITY','inflammation_lppla2','Lp-PLA2 Activity','inflammation','Cardiovascular Inflammation','nmol/min/mL','celf-v0.3'),
('lab','MYELOPEROXIDASE','inflammation_mpo','Myeloperoxidase','inflammation','Cardiovascular Inflammation','pmol/L','celf-v0.3'),
('lab','TMAO (TRIMETHYLAMINE N OXIDE)','metabolic_tmao','TMAO','metabolic','Gut-Cardiovascular','uM','celf-v0.3'),
('lab','TMAO','metabolic_tmao','TMAO','metabolic','Gut-Cardiovascular','uM','celf-v0.3'),
('lab','TRIMETHYLAMINE N-OXIDE','metabolic_tmao','TMAO','metabolic','Gut-Cardiovascular','uM','celf-v0.3'),
('lab','FIBRINOGEN ANTIGEN, NEPHELOMETRY','coag_fibrinogen_antigen','Fibrinogen Antigen','coagulation','Coagulation','mg/dL','celf-v0.3'),
('lab','FIBRINOGEN ACTIVITY','coag_fibrinogen_activity','Fibrinogen Activity','coagulation','Coagulation','mg/dL','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','CORTISOL, TOTAL, LC/MS','hormone_cortisol','Cortisol (LC/MS)','hormones','Hormone Panel','ug/dL','celf-v0.3'),
('lab','CORTISOL','hormone_cortisol','Cortisol','hormones','Hormone Panel','ug/dL','celf-v0.3'),
('lab','DHEA SULFATE','hormone_dhea_s','DHEA-S','hormones','Hormone Panel','ug/dL','celf-v0.3'),
('lab','DHEA-S','hormone_dhea_s','DHEA-S','hormones','Hormone Panel','ug/dL','celf-v0.3'),
('lab','FSH','hormone_fsh','FSH','hormones','Hormone Panel','mIU/mL','celf-v0.3'),
('lab','LH','hormone_lh','LH','hormones','Hormone Panel','mIU/mL','celf-v0.3'),
('lab','PROLACTIN','hormone_prolactin','Prolactin','hormones','Hormone Panel','ng/mL','celf-v0.3'),
('lab','TESTOSTERONE, FREE','hormone_testosterone_free','Free Testosterone','hormones','Hormone Panel','pg/mL','celf-v0.3'),
('lab','TESTOSTERONE, TOTAL, MS','hormone_testosterone_total','Total Testosterone (MS)','hormones','Hormone Panel','ng/dL','celf-v0.3'),
('lab','TESTOSTERONE, TOTAL','hormone_testosterone_total','Total Testosterone','hormones','Hormone Panel','ng/dL','celf-v0.3'),
('lab','ADIPONECTIN','hormone_adiponectin','Adiponectin','hormones','Metabolic Hormones','ug/mL','celf-v0.3'),
('lab','LEPTIN','hormone_leptin','Leptin','hormones','Metabolic Hormones','ng/mL','celf-v0.3'),
('lab','INSULIN, INTACT, LC/MS/MS','hormone_insulin_intact','Intact Insulin (LC/MS)','hormones','Hormone Panel','pmol/L','celf-v0.3'),
('lab','C-PEPTIDE, LC/MS/MS','hormone_c_peptide','C-Peptide (LC/MS)','hormones','Hormone Panel','ng/mL','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','EPA','fatty_acids_epa','EPA','fatty_acids','Omega-3 Panel','ug/mL','celf-v0.3'),
('lab','DHA','fatty_acids_dha','DHA','fatty_acids','Omega-3 Panel','ug/mL','celf-v0.3'),
('lab','DPA','fatty_acids_dpa','DPA','fatty_acids','Omega-3 Panel','ug/mL','celf-v0.3'),
('lab','EPA+DPA+DHA','fatty_acids_epa_dpa_dha','EPA+DPA+DHA Index','fatty_acids','Omega-3 Panel','%','celf-v0.3'),
('lab','OMEGA-3 TOTAL','fatty_acids_omega3_total','Omega-3 Total','fatty_acids','Omega-3 Panel','%','celf-v0.3'),
('lab','OMEGA-6 TOTAL','fatty_acids_omega6_total','Omega-6 Total','fatty_acids','Omega-3 Panel','%','celf-v0.3'),
('lab','OMEGA-6/OMEGA-3 RATIO','fatty_acids_omega6_omega3_ratio','Omega-6/3 Ratio','fatty_acids','Omega-3 Panel','ratio','celf-v0.3'),
('lab','ARACHIDONIC ACID','fatty_acids_arachidonic','Arachidonic Acid','fatty_acids','Omega-3 Panel','ug/mL','celf-v0.3'),
('lab','ARACHIDONIC ACID/EPA RATIO','fatty_acids_aa_epa_ratio','Arachidonic/EPA Ratio','fatty_acids','Omega-3 Panel','ratio','celf-v0.3'),
('lab','LINOLEIC ACID','fatty_acids_linoleic','Linoleic Acid','fatty_acids','Omega-3 Panel','ug/mL','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','ABSOLUTE NEUTROPHILS','cbc_neutrophils_abs','Absolute Neutrophils','hematology','CBC Diff','10^3/uL','celf-v0.3'),
('lab','ABSOLUTE LYMPHOCYTES','cbc_lymphocytes_abs','Absolute Lymphocytes','hematology','CBC Diff','10^3/uL','celf-v0.3'),
('lab','ABSOLUTE MONOCYTES','cbc_monocytes_abs','Absolute Monocytes','hematology','CBC Diff','10^3/uL','celf-v0.3'),
('lab','ABSOLUTE EOSINOPHILS','cbc_eosinophils_abs','Absolute Eosinophils','hematology','CBC Diff','10^3/uL','celf-v0.3'),
('lab','ABSOLUTE BASOPHILS','cbc_basophils_abs','Absolute Basophils','hematology','CBC Diff','10^3/uL','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','IRON, TOTAL','iron_serum','Serum Iron','iron','Iron Panel','ug/dL','celf-v0.3'),
('lab','IRON BINDING CAPACITY','iron_tibc','TIBC','iron','Iron Panel','ug/dL','celf-v0.3'),
('lab','% SATURATION','iron_transferrin_sat','Transferrin Saturation','iron','Iron Panel','%','celf-v0.3'),
('lab','TRANSFERRIN SATURATION','iron_transferrin_sat','Transferrin Saturation','iron','Iron Panel','%','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','ALBUMIN, URINE','renal_albumin_urine','Urine Albumin','renal','Urinalysis','mg/L','celf-v0.3'),
('lab','SPECIFIC GRAVITY','renal_specific_gravity','Specific Gravity','renal','Urinalysis','ratio','celf-v0.3'),
('lab','PH','renal_urine_ph','Urine pH','renal','Urinalysis','pH','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','AMYLASE','pancreas_amylase','Amylase','pancreas','Pancreas Panel','U/L','celf-v0.3'),
('lab','LIPASE','pancreas_lipase','Lipase','pancreas','Pancreas Panel','U/L','celf-v0.3'),
('lab','URIC ACID','metabolic_uric_acid','Uric Acid','metabolic','CMP Extended','mg/dL','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','VITAMIN D,25-OH,TOTAL, IA','vitamin_d_25oh','25-OH Vitamin D','vitamins','Vitamin Panel','ng/mL','celf-v0.3'),
('lab','VITAMIN D,25-OH,TOTAL,IA','vitamin_d_25oh','25-OH Vitamin D','vitamins','Vitamin Panel','ng/mL','celf-v0.3'),
('lab','VITAMIN D, 25-OH, TOTAL','vitamin_d_25oh','25-OH Vitamin D','vitamins','Vitamin Panel','ng/mL','celf-v0.3'),
('lab','METHYLMALONIC ACID','metabolic_mma','Methylmalonic Acid','metabolic','B12 Extended','nmol/L','celf-v0.3'),
('lab','ZINC','minerals_zinc','Zinc','minerals','Mineral Panel','mcg/dL','celf-v0.3'),
('lab','MAGNESIUM, RBC','minerals_magnesium_rbc','RBC Magnesium','minerals','Mineral Panel','mg/dL','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','LEAD (VENOUS)','toxic_lead','Blood Lead','toxics','Heavy Metals','mcg/dL','celf-v0.3'),
('lab','MERCURY, BLOOD','toxic_mercury','Blood Mercury','toxics','Heavy Metals','mcg/L','celf-v0.3'),
('lab','ARSENIC, BLOOD','toxic_arsenic','Blood Arsenic','toxics','Heavy Metals','mcg/L','celf-v0.3'),
('lab','CADMIUM, BLOOD','toxic_cadmium','Blood Cadmium','toxics','Heavy Metals','mcg/L','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','PSA, TOTAL','prostate_psa_total','PSA Total','prostate','Prostate Panel','ng/mL','celf-v0.3'),
('lab','PSA, FREE','prostate_psa_free','PSA Free','prostate','Prostate Panel','ng/mL','celf-v0.3'),
('lab','PSA, % FREE','prostate_psa_pct_free','PSA % Free','prostate','Prostate Panel','%','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','RHEUMATOID FACTOR','autoimmune_rf','Rheumatoid Factor','autoimmune','Autoimmune Panel','IU/mL','celf-v0.3'),
('lab','THYROGLOBULIN ANTIBODIES','thyroid_tg_ab','Thyroglobulin Antibodies','thyroid','Thyroid Antibody','IU/mL','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('fibroscan','CAP','fibroscan_cap','Controlled Attenuation Parameter (steatosis)','liver','FibroScan','dB/m','celf-v0.3'),
('fibroscan','Controlled Attenuation Parameter','fibroscan_cap','Controlled Attenuation Parameter','liver','FibroScan','dB/m','celf-v0.3'),
('fibroscan','CAP IQR','fibroscan_cap_iqr','CAP Interquartile Range','liver','FibroScan','dB/m','celf-v0.3'),
('fibroscan','LSM','fibroscan_lsm','Liver Stiffness Measurement','liver','FibroScan','kPa','celf-v0.3'),
('fibroscan','Liver Stiffness','fibroscan_lsm','Liver Stiffness Measurement','liver','FibroScan','kPa','celf-v0.3'),
('fibroscan','E (kPa)','fibroscan_lsm','Liver Stiffness Measurement','liver','FibroScan','kPa','celf-v0.3'),
('fibroscan','LSM IQR','fibroscan_lsm_iqr','LSM Interquartile Range','liver','FibroScan','kPa','celf-v0.3'),
('fibroscan','IQR/Median','fibroscan_iqr_median_ratio','IQR/Median Ratio','liver','FibroScan','ratio','celf-v0.3'),
('fibroscan','Success Rate','fibroscan_success_rate','Measurement Success Rate','liver','FibroScan','%','celf-v0.3'),
('fibroscan','Valid Measurements','fibroscan_valid_measurements','Valid Measurements','liver','FibroScan','count','celf-v0.3'),
('fibroscan','Steatosis Grade','fibroscan_steatosis_grade','Steatosis Grade (S0-S3)','liver','FibroScan','grade','celf-v0.3'),
('fibroscan','Fibrosis Stage','fibroscan_fibrosis_stage','Fibrosis Stage (F0-F4)','liver','FibroScan','stage','celf-v0.3')
on conflict (source_system, reveal_canonical, map_version) do nothing;