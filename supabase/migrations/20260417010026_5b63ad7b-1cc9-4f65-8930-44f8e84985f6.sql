delete from public.celf_feature_map where map_version = 'celf-v0.5';

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version)
select source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, 'celf-v0.5'
from public.celf_feature_map
where map_version = 'celf-v0.4';

-- CBC VARIANTS
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','TOTAL RBC','cbc_rbc','Red Blood Cell Count','hematology','CBC','10^6/uL','celf-v0.5'),
('lab','TOTAL LEUCOCYTES COUNT','cbc_wbc','White Blood Cell Count','hematology','CBC','10^3/uL','celf-v0.5'),
('lab','TOTAL LEUCOCYTES COUNT (WBC)','cbc_wbc','White Blood Cell Count','hematology','CBC','10^3/uL','celf-v0.5'),
('lab','Total Leucocyte Count','cbc_wbc','White Blood Cell Count','hematology','CBC','10^3/uL','celf-v0.5'),
('lab','HEMATOCRIT(PCV)','cbc_hematocrit','Hematocrit','hematology','CBC','%','celf-v0.5'),
('lab','PCV','cbc_hematocrit','Hematocrit','hematology','CBC','%','celf-v0.5'),
('lab','MEAN CORPUSCULAR VOLUME (MCV)','cbc_mcv','MCV','hematology','CBC','fL','celf-v0.5'),
('lab','MEAN CORPUSCULAR VOLUME(MCV)','cbc_mcv','MCV','hematology','CBC','fL','celf-v0.5'),
('lab','MEAN CORPUSCULAR HEMOGLOBIN(MCH)','cbc_mch','MCH','hematology','CBC','pg','celf-v0.5'),
('lab','MEAN CORP.HEMO.CONC(MCHC)','cbc_mchc','MCHC','hematology','CBC','g/dL','celf-v0.5'),
('lab','RDW-CV','cbc_rdw_cv','RDW-CV','hematology','CBC','%','celf-v0.5'),
('lab','RDW-SD','cbc_rdw_sd','RDW-SD','hematology','CBC','fL','celf-v0.5'),
('lab','RED CELL DISTRIBUTION WIDTH (RDW-CV)','cbc_rdw_cv','RDW-CV','hematology','CBC','%','celf-v0.5'),
('lab','RED CELL DISTRIBUTION WIDTH - SD(RDW-SD)','cbc_rdw_sd','RDW-SD','hematology','CBC','fL','celf-v0.5'),
('lab','MEAN PLATELET VOLUME(MPV)','cbc_mpv','MPV','hematology','CBC','fL','celf-v0.5'),
('lab','PLATELET DISTRIBUTION WIDTH(PDW)','cbc_pdw','PDW','hematology','CBC','fL','celf-v0.5'),
('lab','PDW','cbc_pdw','PDW','hematology','CBC','fL','celf-v0.5'),
('lab','PLATELETCRIT(PCT)','cbc_pct','Plateletcrit','hematology','CBC','%','celf-v0.5'),
('lab','PLATELET TO LARGE CELL RATIO(PLCR)','cbc_plcr','Platelet Large Cell Ratio','hematology','CBC','%','celf-v0.5'),
('lab','NUCLEATED RED BLOOD CELLS','cbc_nrbc','Nucleated RBC','hematology','CBC','count','celf-v0.5'),
('lab','NUCLEATED RED BLOOD CELLS %','cbc_nrbc_pct','Nucleated RBC %','hematology','CBC','%','celf-v0.5'),
('lab','IMMATURE GRANULOCYTES(IG)','cbc_ig','Immature Granulocytes','hematology','CBC','10^3/uL','celf-v0.5'),
('lab','IMMATURE GRANULOCYTE PERCENTAGE(IG%)','cbc_ig_pct','Immature Granulocyte %','hematology','CBC','%','celf-v0.5'),
('lab','Immature Granulocyte Count','cbc_ig','Immature Granulocytes','hematology','CBC','10^3/uL','celf-v0.5'),
('lab','Absolute Immature Granulocyte Count','cbc_ig','Immature Granulocytes','hematology','CBC','10^3/uL','celf-v0.5'),
('lab','LYMPHOCYTE','cbc_lymphocytes_pct','Lymphocytes','hematology','CBC Diff','%','celf-v0.5'),
('lab','LYMPHOCYTE PERCENTAGE','cbc_lymphocytes_pct','Lymphocytes','hematology','CBC Diff','%','celf-v0.5'),
('lab','NEUTROPHILS - ABSOLUTE COUNT','cbc_neutrophils_abs','Absolute Neutrophils','hematology','CBC Diff','10^3/uL','celf-v0.5'),
('lab','LYMPHOCYTES - ABSOLUTE COUNT','cbc_lymphocytes_abs','Absolute Lymphocytes','hematology','CBC Diff','10^3/uL','celf-v0.5'),
('lab','MONOCYTES - ABSOLUTE COUNT','cbc_monocytes_abs','Absolute Monocytes','hematology','CBC Diff','10^3/uL','celf-v0.5'),
('lab','EOSINOPHILS - ABSOLUTE COUNT','cbc_eosinophils_abs','Absolute Eosinophils','hematology','CBC Diff','10^3/uL','celf-v0.5'),
('lab','BASOPHILS - ABSOLUTE COUNT','cbc_basophils_abs','Absolute Basophils','hematology','CBC Diff','10^3/uL','celf-v0.5'),
('lab','Absolute Neutrophil Count','cbc_neutrophils_abs','Absolute Neutrophils','hematology','CBC Diff','10^3/uL','celf-v0.5'),
('lab','Absolute Lymphocyte Count','cbc_lymphocytes_abs','Absolute Lymphocytes','hematology','CBC Diff','10^3/uL','celf-v0.5'),
('lab','Absolute Monocyte Count','cbc_monocytes_abs','Absolute Monocytes','hematology','CBC Diff','10^3/uL','celf-v0.5'),
('lab','Absolute Eosinophil Count','cbc_eosinophils_abs','Absolute Eosinophils','hematology','CBC Diff','10^3/uL','celf-v0.5'),
('lab','Absolute Basophil Count','cbc_basophils_abs','Absolute Basophils','hematology','CBC Diff','10^3/uL','celf-v0.5');

-- LIVER
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','ALANINE TRANSAMINASE (SGPT)','liver_alt','ALT','liver','CMP','U/L','celf-v0.5'),
('lab','Alanine Transaminase (SGPT)','liver_alt','ALT','liver','CMP','U/L','celf-v0.5'),
('lab','SGPT','liver_alt','ALT','liver','CMP','U/L','celf-v0.5'),
('lab','ASPARTATE AMINOTRANSFERASE (SGOT)','liver_ast','AST','liver','CMP','U/L','celf-v0.5'),
('lab','ASPARTATE AMINOTRANSFERASE (SGOT )','liver_ast','AST','liver','CMP','U/L','celf-v0.5'),
('lab','Aspartate Aminotransferase (SGOT)','liver_ast','AST','liver','CMP','U/L','celf-v0.5'),
('lab','SGOT','liver_ast','AST','liver','CMP','U/L','celf-v0.5'),
('lab','SGOT / SGPT RATIO','liver_ast_alt_ratio','AST/ALT Ratio','liver','CMP','ratio','celf-v0.5'),
('lab','SGOT/SGPT','liver_ast_alt_ratio','AST/ALT Ratio','liver','CMP','ratio','celf-v0.5'),
('lab','SGOT/SGPT RATIO','liver_ast_alt_ratio','AST/ALT Ratio','liver','CMP','ratio','celf-v0.5'),
('lab','GAMMA GLUTAMYL TRANSFERASE (GGT)','liver_ggt','GGT','liver','Liver Extended','U/L','celf-v0.5'),
('lab','Gamma Glutamyltransferase (GGT)','liver_ggt','GGT','liver','Liver Extended','U/L','celf-v0.5'),
('lab','BILIRUBIN - TOTAL','liver_bilirubin_total','Total Bilirubin','liver','CMP','mg/dL','celf-v0.5'),
('lab','Bilirubin-Total','liver_bilirubin_total','Total Bilirubin','liver','CMP','mg/dL','celf-v0.5'),
('lab','BILIRUBIN -DIRECT','liver_bilirubin_direct','Direct Bilirubin','liver','Liver Extended','mg/dL','celf-v0.5'),
('lab','Bilirubin-Direct','liver_bilirubin_direct','Direct Bilirubin','liver','Liver Extended','mg/dL','celf-v0.5'),
('lab','BILIRUBIN (INDIRECT)','liver_bilirubin_indirect','Indirect Bilirubin','liver','Liver Extended','mg/dL','celf-v0.5'),
('lab','Bilirubin-Indirect','liver_bilirubin_indirect','Indirect Bilirubin','liver','Liver Extended','mg/dL','celf-v0.5'),
('lab','PROTEIN - TOTAL','liver_total_protein','Total Protein','liver','CMP','g/dL','celf-v0.5'),
('lab','ALBUMIN - SERUM','liver_albumin','Albumin','liver','CMP','g/dL','celf-v0.5'),
('lab','SERUM GLOBULIN','liver_globulin','Globulin','liver','CMP','g/dL','celf-v0.5'),
('lab','SERUM ALB/GLOBULIN RATIO','liver_ag_ratio','Albumin/Globulin Ratio','liver','CMP','ratio','celf-v0.5'),
('lab','ALPHA-1-ANTITRYPSIN (AAT)','liver_aat','Alpha-1-Antitrypsin','liver','Liver Extended','mg/dL','celf-v0.5');

-- RENAL / URINE
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','CREATININE - SERUM','renal_creatinine','Creatinine','renal','CMP','mg/dL','celf-v0.5'),
('lab','BLOOD UREA NITROGEN (BUN)','renal_bun','Blood Urea Nitrogen','renal','CMP','mg/dL','celf-v0.5'),
('lab','UREA (CALCULATED)','renal_urea','Urea','renal','CMP','mg/dL','celf-v0.5'),
('lab','UREA / SR.CREATININE RATIO','renal_urea_creatinine_ratio','Urea/Creatinine Ratio','renal','CMP','ratio','celf-v0.5'),
('lab','BUN / SR.CREATININE RATIO','renal_bun_creatinine_ratio','BUN/Creatinine Ratio','renal','CMP','ratio','celf-v0.5'),
('lab','BUN/Creatinine Ratio','renal_bun_creatinine_ratio','BUN/Creatinine Ratio','renal','CMP','ratio','celf-v0.5'),
('lab','EST. GLOMERULAR FILTRATION RATE (eGFR)','renal_egfr','Estimated GFR','renal','CMP','mL/min/1.73m2','celf-v0.5'),
('lab','URINARY MICROALBUMIN','renal_microalbumin','Microalbumin','renal','Urinalysis','mg/L','celf-v0.5'),
('lab','CREATININE - URINE','renal_creatinine_urine','Urine Creatinine','renal','Urinalysis','mg/dL','celf-v0.5'),
('lab','Urinary Creatinine','renal_creatinine_urine','Urine Creatinine','renal','Urinalysis','mg/dL','celf-v0.5'),
('lab','URI. ALBUMIN/CREATININE RATIO (UA/C)','renal_uacr','Urine ACR','renal','Urinalysis','mg/g','celf-v0.5'),
('lab','URINARY GLUCOSE','urine_glucose','Urine Glucose','renal','Urinalysis','mg/dL','celf-v0.5'),
('lab','URINARY PROTEIN','urine_protein','Urine Protein','renal','Urinalysis','mg/dL','celf-v0.5'),
('lab','UROBILINOGEN','urine_urobilinogen','Urobilinogen','renal','Urinalysis','EU/dL','celf-v0.5'),
('lab','Urine Sodium','urine_sodium','Urine Sodium','renal','Urinalysis','mmol/L','celf-v0.5'),
('lab','Urine Potassium','urine_potassium','Urine Potassium','renal','Urinalysis','mmol/L','celf-v0.5'),
('lab','Urine Chloride','urine_chloride','Urine Chloride','renal','Urinalysis','mmol/L','celf-v0.5');

-- GLYCEMIC
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','FASTING BLOOD SUGAR','glucose_fasting','Fasting Glucose','glycemic','Glycemic Panel','mg/dL','celf-v0.5'),
('lab','FASTING BLOOD SUGAR(GLUCOSE)','glucose_fasting','Fasting Glucose','glycemic','Glycemic Panel','mg/dL','celf-v0.5'),
('lab','Glucose - Fasting Blood','glucose_fasting','Fasting Glucose','glycemic','Glycemic Panel','mg/dL','celf-v0.5'),
('lab','INSULIN - FASTING','insulin_fasting','Fasting Insulin','glycemic','Glycemic Panel','uIU/mL','celf-v0.5'),
('lab','Glycosylated Hemoglobin (HbA1c)','hba1c','Hemoglobin A1c','glycemic','Glycemic Panel','%','celf-v0.5'),
('lab','HbA1c - (HPLC)','hba1c','Hemoglobin A1c','glycemic','Glycemic Panel','%','celf-v0.5'),
('lab','HbA1c - (HPLC - NGSP Certified)','hba1c','Hemoglobin A1c','glycemic','Glycemic Panel','%','celf-v0.5'),
('lab','AVERAGE BLOOD GLUCOSE (ABG)','glucose_abg','Estimated Average Glucose','glycemic','Glycemic Panel','mg/dL','celf-v0.5'),
('lab','Average Blood Glucose','glucose_abg','Estimated Average Glucose','glycemic','Glycemic Panel','mg/dL','celf-v0.5'),
('lab','FRUCTOSAMINE','glucose_fructosamine','Fructosamine','glycemic','Glycemic Panel','umol/L','celf-v0.5'),
('lab','INSULIN RESISTANCE SCORE','glucose_ir_score','Insulin Resistance Score','glycemic','Glycemic Panel','score','celf-v0.5'),
('lab','BLOOD KETONE (D3HB)','glucose_ketone','Blood Ketone','glycemic','Glycemic Panel','mmol/L','celf-v0.5');

-- LIPIDS
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','LDL CHOLESTEROL - DIRECT','lipid_ldl_direct','LDL Cholesterol (Direct)','lipids','Lipid Panel','mg/dL','celf-v0.5'),
('lab','HDL CHOLESTEROL - DIRECT','lipid_hdl_direct','HDL Cholesterol (Direct)','lipids','Lipid Panel','mg/dL','celf-v0.5'),
('lab','VLDL CHOLESTEROL','lipid_vldl','VLDL','lipids','Lipid Panel','mg/dL','celf-v0.5'),
('lab','VLDL Cholesterol','lipid_vldl','VLDL','lipids','Lipid Panel','mg/dL','celf-v0.5'),
('lab','Cholesterol','lipid_total_cholesterol','Total Cholesterol','lipids','Lipid Panel','mg/dL','celf-v0.5'),
('lab','Cholesterol: HDL Cholesterol','lipid_chol_hdl_ratio','Total/HDL Cholesterol Ratio','lipids','Lipid Panel','ratio','celf-v0.5'),
('lab','TC/HDL CHOLESTEROL RATIO','lipid_chol_hdl_ratio','Total/HDL Cholesterol Ratio','lipids','Lipid Panel','ratio','celf-v0.5'),
('lab','TC/ HDL CHOLESTEROL RATIO','lipid_chol_hdl_ratio','Total/HDL Cholesterol Ratio','lipids','Lipid Panel','ratio','celf-v0.5'),
('lab','HDL / LDL RATIO','lipid_hdl_ldl_ratio','HDL/LDL Ratio','lipids','Lipid Panel','ratio','celf-v0.5'),
('lab','HDL/LDL Ratio','lipid_hdl_ldl_ratio','HDL/LDL Ratio','lipids','Lipid Panel','ratio','celf-v0.5'),
('lab','LDL / HDL RATIO','lipid_ldl_hdl_ratio','LDL/HDL Ratio','lipids','Lipid Panel','ratio','celf-v0.5'),
('lab','LDL/HDL Ratio','lipid_ldl_hdl_ratio','LDL/HDL Ratio','lipids','Lipid Panel','ratio','celf-v0.5'),
('lab','TRIG / HDL RATIO','lipid_trig_hdl_ratio','Triglyceride/HDL Ratio','lipids','Lipid Panel','ratio','celf-v0.5'),
('lab','APOLIPOPROTEIN - A1 (APO-A1)','lipid_apoa1','Apolipoprotein A1','lipids','Advanced Lipid','mg/dL','celf-v0.5'),
('lab','APOLIPOPROTEIN - B (APO-B)','lipid_apob','Apolipoprotein B','lipids','Advanced Lipid','mg/dL','celf-v0.5'),
('lab','APOLIPOPROTEIN B/A1 RATIO','lipid_apob_apoa1_ratio','ApoB/A1 Ratio','lipids','Advanced Lipid','ratio','celf-v0.5'),
('lab','APO B / APO A1 RATIO (APO B/A1)','lipid_apob_apoa1_ratio','ApoB/A1 Ratio','lipids','Advanced Lipid','ratio','celf-v0.5'),
('lab','APOLIPOPROTEIN - A1 (ΑΡΟ-A1)','lipid_apoa1','Apolipoprotein A1','lipids','Advanced Lipid','mg/dL','celf-v0.5'),
('lab','APOLIPOPROTEIN - B (ΑΡΟ-Β)','lipid_apob','Apolipoprotein B','lipids','Advanced Lipid','mg/dL','celf-v0.5'),
('lab','АРО В / АРO A1 RATIΟ (ΑΡΟ Β/Α1)','lipid_apob_apoa1_ratio','ApoB/A1 Ratio','lipids','Advanced Lipid','ratio','celf-v0.5'),
('lab','LIPOPROTEIN (A) [LP(A)]','lipid_lp_a','Lipoprotein (a)','lipids','Advanced Lipid','nmol/L','celf-v0.5'),
('lab','Lipoprotein (a) [Lp(a)]','lipid_lp_a','Lipoprotein (a)','lipids','Advanced Lipid','nmol/L','celf-v0.5'),
('lab','LP-PLA2','inflammation_lppla2','Lp-PLA2 Activity','inflammation','Cardiovascular Inflammation','nmol/min/mL','celf-v0.5'),
('lab','HDLFX PCAD SCORE','lipid_hdlfx_pcad','HDLFX PCAD Score','lipids','Advanced Lipoprotein','score','celf-v0.5'),
('lab','HIGH SENSITIVITY C-REACTIVE PROTEIN (HS-CRP)','inflammation_hscrp','High-Sensitivity CRP','inflammation','Inflammation','mg/L','celf-v0.5');

-- THYROID / HORMONES
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','THYROID STIMULATING HORMONE (TSH)','thyroid_tsh','TSH','thyroid','Thyroid Panel','uIU/mL','celf-v0.5'),
('lab','TSH - ULTRASENSITIVE','thyroid_tsh','TSH (Ultrasensitive)','thyroid','Thyroid Panel','uIU/mL','celf-v0.5'),
('lab','Thyroid Stimulating Hormone - ULTRA','thyroid_tsh','TSH (Ultrasensitive)','thyroid','Thyroid Panel','uIU/mL','celf-v0.5'),
('lab','TOTAL THYROXINE (T4)','thyroid_t4_total','Total T4','thyroid','Thyroid Panel','ug/dL','celf-v0.5'),
('lab','TOTAL TRIIODOTHYRONINE (T3)','thyroid_t3_total','Total T3','thyroid','Thyroid Panel','ng/dL','celf-v0.5'),
('lab','DHEA - SULPHATE (DHEAS)','hormone_dhea_s','DHEA-S','hormones','Hormone Panel','ug/dL','celf-v0.5'),
('lab','17-HYDROXYPROGESTERONE','hormone_17_oh_prog','17-OH Progesterone','hormones','Hormone Panel','ng/mL','celf-v0.5'),
('lab','DEOXYCORTISOL','hormone_deoxycortisol','11-Deoxycortisol','hormones','Hormone Panel','ng/mL','celf-v0.5'),
('lab','ANDROSTENEDIONE','hormone_androstenedione','Androstenedione','hormones','Hormone Panel','ng/dL','celf-v0.5'),
('lab','DEHYDROEPIANDROSTERONE','hormone_dhea','DHEA','hormones','Hormone Panel','ng/mL','celf-v0.5'),
('lab','CORTICOSTERONE','hormone_corticosterone','Corticosterone','hormones','Hormone Panel','ng/mL','celf-v0.5'),
('lab','Total Testosterone','hormone_testosterone_total','Total Testosterone','hormones','Hormone Panel','ng/dL','celf-v0.5');

-- VITAMINS
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','VITAMIN A','vitamin_a_retinol','Vitamin A (Retinol)','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','VITAMIN B1/THIAMIN','vitamin_b1_thiamin','Vitamin B1 (Thiamin)','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','VITAMIN B2/RIBOFLAVIN','vitamin_b2_riboflavin','Vitamin B2 (Riboflavin)','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','VITAMIN B3/NICOTINIC ACID','vitamin_b3_niacin','Vitamin B3 (Niacin)','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','VITAMIN B5/PANTOTHENIC','vitamin_b5_pantothenic','Vitamin B5 (Pantothenic)','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','VITAMIN B6/P5P','vitamin_b6_p5p','Vitamin B6 (P5P)','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','VITAMIN B7/BIOTIN','vitamin_b7_biotin','Vitamin B7 (Biotin)','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','VITAMIN B9/FOLIC ACID','vitamin_b9_folic','Vitamin B9 (Folic Acid)','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','VITAMIN B-12','vitamin_b12','Vitamin B12','vitamins','Vitamin Panel','pg/mL','celf-v0.5'),
('lab','VITAMIN D2','vitamin_d2','Vitamin D2','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','VITAMIN D3','vitamin_d3','Vitamin D3','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','VITAMIN D TOTAL','vitamin_d_25oh','25-OH Vitamin D','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','Vitamin D (25-OH)','vitamin_d_25oh','25-OH Vitamin D','vitamins','Vitamin Panel','ng/mL','celf-v0.5'),
('lab','VITAMIN E','vitamin_e_tocopherol','Vitamin E (Tocopherol)','vitamins','Vitamin Panel','mg/L','celf-v0.5'),
('lab','VITAMIN K','vitamin_k','Vitamin K','vitamins','Vitamin Panel','ng/mL','celf-v0.5');

-- HEAVY METALS
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','ALUMINIUM','toxic_aluminium','Aluminium','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','ANTIMONY','toxic_antimony','Antimony','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','ARSENIC','toxic_arsenic','Arsenic','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','BARIUM','toxic_barium','Barium','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','BERYLLIUM','toxic_beryllium','Beryllium','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','BISMUTH','toxic_bismuth','Bismuth','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','CADMIUM','toxic_cadmium','Cadmium','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','CAESIUM','toxic_caesium','Caesium','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','CHROMIUM','minerals_chromium','Chromium','minerals','Mineral Panel','mcg/L','celf-v0.5'),
('lab','COBALT','minerals_cobalt','Cobalt','minerals','Mineral Panel','mcg/L','celf-v0.5'),
('lab','LEAD','toxic_lead','Lead','toxics','Heavy Metals','mcg/dL','celf-v0.5'),
('lab','MANGANESE','minerals_manganese','Manganese','minerals','Mineral Panel','mcg/L','celf-v0.5'),
('lab','MERCURY','toxic_mercury','Mercury','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','MOLYBDENUM','minerals_molybdenum','Molybdenum','minerals','Mineral Panel','mcg/L','celf-v0.5'),
('lab','NICKEL','toxic_nickel','Nickel','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','SELENIUM','minerals_selenium','Selenium','minerals','Mineral Panel','mcg/L','celf-v0.5'),
('lab','SILVER','toxic_silver','Silver','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','STRONTIUM','minerals_strontium','Strontium','minerals','Mineral Panel','mcg/L','celf-v0.5'),
('lab','THALLIUM','toxic_thallium','Thallium','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','TIN','toxic_tin','Tin','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','URANIUM','toxic_uranium','Uranium','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','VANADIUM','toxic_vanadium','Vanadium','toxics','Heavy Metals','mcg/L','celf-v0.5'),
('lab','SERUM COPPER','minerals_copper','Serum Copper','minerals','Mineral Panel','mcg/dL','celf-v0.5'),
('lab','SERUM ZINC','minerals_zinc','Zinc','minerals','Mineral Panel','mcg/dL','celf-v0.5');

-- IRON PANEL
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','Iron Serum','iron_serum','Serum Iron','iron','Iron Panel','ug/dL','celf-v0.5'),
('lab','TOTAL IRON BINDING CAPACITY (TIBC)','iron_tibc','TIBC','iron','Iron Panel','ug/dL','celf-v0.5'),
('lab','Total Iron Binding Capacity (TIBC)','iron_tibc','TIBC','iron','Iron Panel','ug/dL','celf-v0.5'),
('lab','UNSAT.IRON-BINDING CAPACITY(UIBC)','iron_uibc','UIBC','iron','Iron Panel','ug/dL','celf-v0.5'),
('lab','% TRANSFERRIN SATURATION','iron_transferrin_sat','Transferrin Saturation','iron','Iron Panel','%','celf-v0.5');

-- MISC
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','ANTI CCP (ACCP)','autoimmune_ccp','Anti-CCP','autoimmune','Autoimmune Panel','U/mL','celf-v0.5'),
('lab','ANTI NUCLEAR ANTIBODIES (ANA)','autoimmune_ana','ANA','autoimmune','Autoimmune Panel','titer','celf-v0.5'),
('lab','TROPONIN I HEART ATTACK RISK','cardiac_troponin_i','Troponin I','cardiac','Cardiac Biomarkers','ng/mL','celf-v0.5'),
('lab','Amylase','pancreas_amylase','Amylase','pancreas','Pancreas Panel','U/L','celf-v0.5'),
('lab','Phosphorus, Serum','minerals_phosphorus','Phosphorus','minerals','CMP Extended','mg/dL','celf-v0.5'),
('lab','BMI','body_bmi','Body Mass Index','body_composition','Body Composition','kg/m2','celf-v0.5');

-- INBODY ALIASES (lab namespace)
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','Skeletal Muscle Mass','body_smm','Skeletal Muscle Mass','body_composition','InBody 970','lb','celf-v0.5'),
('lab','Body Fat Mass','body_fat_mass','Body Fat Mass','body_composition','InBody 970','lb','celf-v0.5'),
('lab','Fat Free Mass','body_fat_free_mass','Fat Free Mass','body_composition','InBody 970','lb','celf-v0.5'),
('lab','Dry Lean Mass','body_dry_lean_mass','Dry Lean Mass','body_composition','InBody 970','lb','celf-v0.5'),
('lab','Percent Body Fat','body_fat_pct','Percent Body Fat','body_composition','InBody 970','%','celf-v0.5'),
('lab','Visceral Fat Area','body_visceral_fat_area','Visceral Fat Area','body_composition','InBody 970','cm2','celf-v0.5'),
('lab','Basal Metabolic Rate','body_bmr','Basal Metabolic Rate','metabolic','InBody 970','kcal/day','celf-v0.5'),
('lab','ECW/TBW','body_ecw_tbw','ECW/TBW Ratio','hydration','InBody 970','ratio','celf-v0.5'),
('lab','Phase Angle - Whole Body','phase_angle_whole_body','Phase Angle (Whole Body)','cellular_integrity','InBody 970','degrees','celf-v0.5'),
('lab','Phase Angle - Right Arm','phase_angle_right_arm','Phase Angle (Right Arm)','cellular_integrity','InBody 970','degrees','celf-v0.5'),
('lab','Phase Angle - Left Arm','phase_angle_left_arm','Phase Angle (Left Arm)','cellular_integrity','InBody 970','degrees','celf-v0.5'),
('lab','Phase Angle - Trunk','phase_angle_trunk','Phase Angle (Trunk)','cellular_integrity','InBody 970','degrees','celf-v0.5'),
('lab','Phase Angle - Right Leg','phase_angle_right_leg','Phase Angle (Right Leg)','cellular_integrity','InBody 970','degrees','celf-v0.5'),
('lab','Phase Angle - Left Leg','phase_angle_left_leg','Phase Angle (Left Leg)','cellular_integrity','InBody 970','degrees','celf-v0.5'),
('lab','Total Body Water','body_tbw','Total Body Water','hydration','InBody 970','lb','celf-v0.5'),
('lab','Intracellular Water','body_icw','Intracellular Water','hydration','InBody 970','lb','celf-v0.5'),
('lab','Extracellular Water','body_ecw','Extracellular Water','hydration','InBody 970','lb','celf-v0.5'),
('lab','Right Arm ECW/TBW','body_ecw_tbw_right_arm','Right Arm ECW/TBW','hydration','InBody 970','ratio','celf-v0.5'),
('lab','Left Arm ECW/TBW','body_ecw_tbw_left_arm','Left Arm ECW/TBW','hydration','InBody 970','ratio','celf-v0.5'),
('lab','Right Leg ECW/TBW','body_ecw_tbw_right_leg','Right Leg ECW/TBW','hydration','InBody 970','ratio','celf-v0.5'),
('lab','Left Leg ECW/TBW','body_ecw_tbw_left_leg','Left Leg ECW/TBW','hydration','InBody 970','ratio','celf-v0.5'),
('lab','Trunk ECW/TBW','body_ecw_tbw_trunk','Trunk ECW/TBW','hydration','InBody 970','ratio','celf-v0.5'),
('lab','Right Arm Lean Mass','body_lean_right_arm','Right Arm Lean Mass','body_composition','InBody 970','lb','celf-v0.5'),
('lab','Left Arm Lean Mass','body_lean_left_arm','Left Arm Lean Mass','body_composition','InBody 970','lb','celf-v0.5'),
('lab','Right Leg Lean Mass','body_lean_right_leg','Right Leg Lean Mass','body_composition','InBody 970','lb','celf-v0.5'),
('lab','Left Leg Lean Mass','body_lean_left_leg','Left Leg Lean Mass','body_composition','InBody 970','lb','celf-v0.5'),
('lab','Trunk Lean Mass','body_lean_trunk','Trunk Lean Mass','body_composition','InBody 970','lb','celf-v0.5'),
('lab','Weight','body_weight','Body Weight','body_composition','InBody 970','lb','celf-v0.5');

-- FIBROSCAN ALIASES
insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','CAP (dB/m)','fibroscan_cap','Controlled Attenuation Parameter (steatosis)','liver','FibroScan','dB/m','celf-v0.5'),
('lab','E (kPa)','fibroscan_lsm','Liver Stiffness Measurement','liver','FibroScan','kPa','celf-v0.5'),
('lab','SWS','fibroscan_sws','Shear Wave Speed','liver','FibroScan','m/s','celf-v0.5');