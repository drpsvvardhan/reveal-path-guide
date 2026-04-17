delete from public.celf_feature_map where map_version = 'celf-v0.6';

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version)
select source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, 'celf-v0.6'
from public.celf_feature_map
where map_version = 'celf-v0.5';

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','skeletal_muscle_mass','body_smm','Skeletal Muscle Mass','body_composition','InBody 970','lb','celf-v0.6'),
('lab','body_fat_mass','body_fat_mass','Body Fat Mass','body_composition','InBody 970','lb','celf-v0.6'),
('lab','fat_free_mass','body_fat_free_mass','Fat Free Mass','body_composition','InBody 970','lb','celf-v0.6'),
('lab','dry_lean_mass','body_dry_lean_mass','Dry Lean Mass','body_composition','InBody 970','lb','celf-v0.6'),
('lab','body_fat_percent','body_fat_pct','Percent Body Fat','body_composition','InBody 970','%','celf-v0.6'),
('lab','visceral_fat_area','body_visceral_fat_area','Visceral Fat Area','body_composition','InBody 970','cm2','celf-v0.6'),
('lab','basal_metabolic_rate','body_bmr','Basal Metabolic Rate','metabolic','InBody 970','kcal/day','celf-v0.6'),
('lab','ecw_tbw_ratio','body_ecw_tbw','ECW/TBW Ratio','hydration','InBody 970','ratio','celf-v0.6'),
('lab','phase_angle_whole_body','phase_angle_whole_body','Phase Angle (Whole Body)','cellular_integrity','InBody 970','degrees','celf-v0.6'),
('lab','segmental_ecw_tbw_right_leg','body_ecw_tbw_right_leg','Right Leg ECW/TBW','hydration','InBody 970','ratio','celf-v0.6'),
('lab','segmental_ecw_tbw_left_leg','body_ecw_tbw_left_leg','Left Leg ECW/TBW','hydration','InBody 970','ratio','celf-v0.6'),
('lab','segmental_ecw_tbw_right_arm','body_ecw_tbw_right_arm','Right Arm ECW/TBW','hydration','InBody 970','ratio','celf-v0.6'),
('lab','segmental_ecw_tbw_left_arm','body_ecw_tbw_left_arm','Left Arm ECW/TBW','hydration','InBody 970','ratio','celf-v0.6'),
('lab','segmental_ecw_tbw_trunk','body_ecw_tbw_trunk','Trunk ECW/TBW','hydration','InBody 970','ratio','celf-v0.6'),
('lab','segmental_lean_right_arm','body_lean_right_arm','Right Arm Lean Mass','body_composition','InBody 970','lb','celf-v0.6'),
('lab','segmental_lean_left_arm','body_lean_left_arm','Left Arm Lean Mass','body_composition','InBody 970','lb','celf-v0.6'),
('lab','segmental_lean_right_leg','body_lean_right_leg','Right Leg Lean Mass','body_composition','InBody 970','lb','celf-v0.6'),
('lab','segmental_lean_left_leg','body_lean_left_leg','Left Leg Lean Mass','body_composition','InBody 970','lb','celf-v0.6'),
('lab','segmental_lean_trunk','body_lean_trunk','Trunk Lean Mass','body_composition','InBody 970','lb','celf-v0.6'),
('lab','weight','body_weight','Body Weight','body_composition','InBody 970','lb','celf-v0.6'),
('lab','bmi','body_bmi','Body Mass Index','body_composition','InBody 970','kg/m2','celf-v0.6'),
('lab','total_body_water','body_tbw','Total Body Water','hydration','InBody 970','lb','celf-v0.6'),
('lab','intracellular_water','body_icw','Intracellular Water','hydration','InBody 970','lb','celf-v0.6'),
('lab','extracellular_water','body_ecw','Extracellular Water','hydration','InBody 970','lb','celf-v0.6'),
('lab','phase_angle_right_arm','phase_angle_right_arm','Phase Angle (Right Arm)','cellular_integrity','InBody 970','degrees','celf-v0.6'),
('lab','phase_angle_left_arm','phase_angle_left_arm','Phase Angle (Left Arm)','cellular_integrity','InBody 970','degrees','celf-v0.6'),
('lab','phase_angle_right_leg','phase_angle_right_leg','Phase Angle (Right Leg)','cellular_integrity','InBody 970','degrees','celf-v0.6'),
('lab','phase_angle_left_leg','phase_angle_left_leg','Phase Angle (Left Leg)','cellular_integrity','InBody 970','degrees','celf-v0.6'),
('lab','phase_angle_trunk','phase_angle_trunk','Phase Angle (Trunk)','cellular_integrity','InBody 970','degrees','celf-v0.6')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','TOTAL RBC','cbc_rbc','Red Blood Cell Count','hematology','CBC','10^6/uL','celf-v0.6'),
('lab','TOTAL LEUCOCYTES COUNT','cbc_wbc','White Blood Cell Count','hematology','CBC','10^3/uL','celf-v0.6'),
('lab','TOTAL LEUCOCYTES COUNT (WBC)','cbc_wbc','White Blood Cell Count','hematology','CBC','10^3/uL','celf-v0.6'),
('lab','Total Leucocyte Count','cbc_wbc','White Blood Cell Count','hematology','CBC','10^3/uL','celf-v0.6'),
('lab','HEMATOCRIT(PCV)','cbc_hematocrit','Hematocrit','hematology','CBC','%','celf-v0.6'),
('lab','PCV','cbc_hematocrit','Hematocrit','hematology','CBC','%','celf-v0.6'),
('lab','MEAN CORPUSCULAR VOLUME (MCV)','cbc_mcv','MCV','hematology','CBC','fL','celf-v0.6'),
('lab','MEAN CORPUSCULAR VOLUME(MCV)','cbc_mcv','MCV','hematology','CBC','fL','celf-v0.6'),
('lab','MEAN CORPUSCULAR HEMOGLOBIN(MCH)','cbc_mch','MCH','hematology','CBC','pg','celf-v0.6'),
('lab','MEAN CORP.HEMO.CONC(MCHC)','cbc_mchc','MCHC','hematology','CBC','g/dL','celf-v0.6'),
('lab','RDW-CV','cbc_rdw_cv','RDW-CV','hematology','CBC','%','celf-v0.6'),
('lab','RDW-SD','cbc_rdw_sd','RDW-SD','hematology','CBC','fL','celf-v0.6'),
('lab','RED CELL DISTRIBUTION WIDTH (RDW-CV)','cbc_rdw_cv','RDW-CV','hematology','CBC','%','celf-v0.6'),
('lab','RED CELL DISTRIBUTION WIDTH - SD(RDW-SD)','cbc_rdw_sd','RDW-SD','hematology','CBC','fL','celf-v0.6'),
('lab','MEAN PLATELET VOLUME(MPV)','cbc_mpv','MPV','hematology','CBC','fL','celf-v0.6'),
('lab','PLATELET DISTRIBUTION WIDTH(PDW)','cbc_pdw','PDW','hematology','CBC','fL','celf-v0.6'),
('lab','PDW','cbc_pdw','PDW','hematology','CBC','fL','celf-v0.6'),
('lab','PLATELETCRIT(PCT)','cbc_pct','Plateletcrit','hematology','CBC','%','celf-v0.6'),
('lab','PLATELET TO LARGE CELL RATIO(PLCR)','cbc_plcr','Platelet Large Cell Ratio','hematology','CBC','%','celf-v0.6'),
('lab','NUCLEATED RED BLOOD CELLS','cbc_nrbc','Nucleated RBC','hematology','CBC','count','celf-v0.6'),
('lab','NUCLEATED RED BLOOD CELLS %','cbc_nrbc_pct','Nucleated RBC %','hematology','CBC','%','celf-v0.6'),
('lab','IMMATURE GRANULOCYTES(IG)','cbc_ig','Immature Granulocytes','hematology','CBC','10^3/uL','celf-v0.6'),
('lab','IMMATURE GRANULOCYTE PERCENTAGE(IG%)','cbc_ig_pct','Immature Granulocyte %','hematology','CBC','%','celf-v0.6'),
('lab','Immature Granulocyte Count','cbc_ig','Immature Granulocytes','hematology','CBC','10^3/uL','celf-v0.6'),
('lab','Absolute Immature Granulocyte Count','cbc_ig','Immature Granulocytes','hematology','CBC','10^3/uL','celf-v0.6'),
('lab','LYMPHOCYTE','cbc_lymphocytes_pct','Lymphocytes','hematology','CBC Diff','%','celf-v0.6'),
('lab','LYMPHOCYTE PERCENTAGE','cbc_lymphocytes_pct','Lymphocytes','hematology','CBC Diff','%','celf-v0.6'),
('lab','NEUTROPHILS - ABSOLUTE COUNT','cbc_neutrophils_abs','Absolute Neutrophils','hematology','CBC Diff','10^3/uL','celf-v0.6'),
('lab','LYMPHOCYTES - ABSOLUTE COUNT','cbc_lymphocytes_abs','Absolute Lymphocytes','hematology','CBC Diff','10^3/uL','celf-v0.6'),
('lab','MONOCYTES - ABSOLUTE COUNT','cbc_monocytes_abs','Absolute Monocytes','hematology','CBC Diff','10^3/uL','celf-v0.6'),
('lab','EOSINOPHILS - ABSOLUTE COUNT','cbc_eosinophils_abs','Absolute Eosinophils','hematology','CBC Diff','10^3/uL','celf-v0.6'),
('lab','BASOPHILS - ABSOLUTE COUNT','cbc_basophils_abs','Absolute Basophils','hematology','CBC Diff','10^3/uL','celf-v0.6'),
('lab','Absolute Neutrophil Count','cbc_neutrophils_abs','Absolute Neutrophils','hematology','CBC Diff','10^3/uL','celf-v0.6'),
('lab','Absolute Lymphocyte Count','cbc_lymphocytes_abs','Absolute Lymphocytes','hematology','CBC Diff','10^3/uL','celf-v0.6'),
('lab','Absolute Monocyte Count','cbc_monocytes_abs','Absolute Monocytes','hematology','CBC Diff','10^3/uL','celf-v0.6'),
('lab','Absolute Eosinophil Count','cbc_eosinophils_abs','Absolute Eosinophils','hematology','CBC Diff','10^3/uL','celf-v0.6'),
('lab','Absolute Basophil Count','cbc_basophils_abs','Absolute Basophils','hematology','CBC Diff','10^3/uL','celf-v0.6')
on conflict (source_system, reveal_canonical, map_version) do nothing;

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, map_version) values
('lab','TESTOSTERONE, FREE','hormone_testosterone_free','Free Testosterone','hormones','Hormone Panel','pg/mL','celf-v0.6'),
('lab','Testosterone, Free','hormone_testosterone_free','Free Testosterone','hormones','Hormone Panel','pg/mL','celf-v0.6'),
('lab','SELENIUM ','minerals_selenium','Selenium','minerals','Mineral Panel','mcg/L','celf-v0.6'),
('lab',' SELENIUM','minerals_selenium','Selenium','minerals','Mineral Panel','mcg/L','celf-v0.6'),
('lab','URINE BLOOD','urine_blood','Urine Blood','renal','Urinalysis','category','celf-v0.6'),
('lab','URINE KETONE','urine_ketone','Urine Ketone','renal','Urinalysis','mg/dL','celf-v0.6'),
('lab','URINARY BILIRUBIN','urine_bilirubin','Urine Bilirubin','renal','Urinalysis','mg/dL','celf-v0.6'),
('lab','URINARY LEUCOCYTES (PUS CELLS)','urine_leucocytes','Urine Leucocytes','renal','Urinalysis','/hpf','celf-v0.6')
on conflict (source_system, reveal_canonical, map_version) do nothing;