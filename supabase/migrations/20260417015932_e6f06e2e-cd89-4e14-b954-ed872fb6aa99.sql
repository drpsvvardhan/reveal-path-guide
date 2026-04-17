-- ============================================================================
-- celf_feature_map v0.7 — unit normalization layer
-- ============================================================================

alter table public.celf_feature_map
  add column if not exists source_unit text,
  add column if not exists unit_factor numeric not null default 1.0,
  add column if not exists unit_offset numeric not null default 0.0;

comment on column public.celf_feature_map.source_unit is
  'The unit as it appears in the source report. When non-null, this row is unit-specific and will only match when the observation has this unit. NULL = matches any unit.';

comment on column public.celf_feature_map.unit_factor is
  'Multiplicative factor to convert source unit to canonical unit. Applied as value_canonical = value_raw * unit_factor + unit_offset.';

alter table public.celf_feature_map
  drop constraint if exists celf_feature_map_source_system_reveal_canonical_map_version_key;

create unique index if not exists celf_feature_map_uniq
  on public.celf_feature_map (source_system, reveal_canonical, map_version, coalesce(source_unit, ''));

delete from public.celf_feature_map where map_version = 'celf-v0.7';

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, source_unit, unit_factor, unit_offset, map_version)
select source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, source_unit, unit_factor, unit_offset, 'celf-v0.7'
from public.celf_feature_map
where map_version = 'celf-v0.6';

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, source_unit, unit_factor, unit_offset, map_version) values
('lab','Absolute Lymphocyte Count','cbc_lymphocytes_abs','Absolute Lymphocytes','hematology','CBC Diff','cells/uL','10^3/uL',1000,0,'celf-v0.7'),
('lab','Absolute Lymphocyte Count','cbc_lymphocytes_abs','Absolute Lymphocytes','hematology','CBC Diff','cells/uL','10^3/µl',1000,0,'celf-v0.7'),
('lab','Absolute Lymphocyte Count','cbc_lymphocytes_abs','Absolute Lymphocytes','hematology','CBC Diff','cells/uL','10³/µL',1000,0,'celf-v0.7'),
('lab','LYMPHOCYTES - ABSOLUTE COUNT','cbc_lymphocytes_abs','Absolute Lymphocytes','hematology','CBC Diff','cells/uL','X 10³ / µL',1000,0,'celf-v0.7'),
('lab','LYMPHOCYTES - ABSOLUTE COUNT','cbc_lymphocytes_abs','Absolute Lymphocytes','hematology','CBC Diff','cells/uL','10^3/uL',1000,0,'celf-v0.7'),
('lab','ABSOLUTE LYMPHOCYTES','cbc_lymphocytes_abs','Absolute Lymphocytes','hematology','CBC Diff','cells/uL','cells/uL',1,0,'celf-v0.7'),
('lab','Absolute Neutrophil Count','cbc_neutrophils_abs','Absolute Neutrophils','hematology','CBC Diff','cells/uL','10^3/uL',1000,0,'celf-v0.7'),
('lab','Absolute Neutrophil Count','cbc_neutrophils_abs','Absolute Neutrophils','hematology','CBC Diff','cells/uL','X 10³ / µL',1000,0,'celf-v0.7'),
('lab','NEUTROPHILS - ABSOLUTE COUNT','cbc_neutrophils_abs','Absolute Neutrophils','hematology','CBC Diff','cells/uL','X 10³ / µL',1000,0,'celf-v0.7'),
('lab','ABSOLUTE NEUTROPHILS','cbc_neutrophils_abs','Absolute Neutrophils','hematology','CBC Diff','cells/uL','cells/uL',1,0,'celf-v0.7'),
('lab','Absolute Monocyte Count','cbc_monocytes_abs','Absolute Monocytes','hematology','CBC Diff','cells/uL','10^3/uL',1000,0,'celf-v0.7'),
('lab','Absolute Monocyte Count','cbc_monocytes_abs','Absolute Monocytes','hematology','CBC Diff','cells/uL','X 10³ / µL',1000,0,'celf-v0.7'),
('lab','MONOCYTES - ABSOLUTE COUNT','cbc_monocytes_abs','Absolute Monocytes','hematology','CBC Diff','cells/uL','X 10³ / µL',1000,0,'celf-v0.7'),
('lab','ABSOLUTE MONOCYTES','cbc_monocytes_abs','Absolute Monocytes','hematology','CBC Diff','cells/uL','cells/uL',1,0,'celf-v0.7'),
('lab','Absolute Eosinophil Count','cbc_eosinophils_abs','Absolute Eosinophils','hematology','CBC Diff','cells/uL','10^3/uL',1000,0,'celf-v0.7'),
('lab','Absolute Eosinophil Count','cbc_eosinophils_abs','Absolute Eosinophils','hematology','CBC Diff','cells/uL','X 10³ / µL',1000,0,'celf-v0.7'),
('lab','EOSINOPHILS - ABSOLUTE COUNT','cbc_eosinophils_abs','Absolute Eosinophils','hematology','CBC Diff','cells/uL','X 10³ / µL',1000,0,'celf-v0.7'),
('lab','ABSOLUTE EOSINOPHILS','cbc_eosinophils_abs','Absolute Eosinophils','hematology','CBC Diff','cells/uL','cells/uL',1,0,'celf-v0.7'),
('lab','Absolute Basophil Count','cbc_basophils_abs','Absolute Basophils','hematology','CBC Diff','cells/uL','10^3/uL',1000,0,'celf-v0.7'),
('lab','Absolute Basophil Count','cbc_basophils_abs','Absolute Basophils','hematology','CBC Diff','cells/uL','X 10³ / µL',1000,0,'celf-v0.7'),
('lab','BASOPHILS - ABSOLUTE COUNT','cbc_basophils_abs','Absolute Basophils','hematology','CBC Diff','cells/uL','X 10³ / µL',1000,0,'celf-v0.7'),
('lab','ABSOLUTE BASOPHILS','cbc_basophils_abs','Absolute Basophils','hematology','CBC Diff','cells/uL','cells/uL',1,0,'celf-v0.7');

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, source_unit, unit_factor, unit_offset, map_version) values
('lab','T3, Total','thyroid_t3_total','Total T3','thyroid','Thyroid Panel','ng/dL','ng/mL',100,0,'celf-v0.7'),
('lab','T3, Total','thyroid_t3_total','Total T3','thyroid','Thyroid Panel','ng/dL','ng/dL',1,0,'celf-v0.7'),
('lab','TOTAL TRIIODOTHYRONINE (T3)','thyroid_t3_total','Total T3','thyroid','Thyroid Panel','ng/dL','ng/dL',1,0,'celf-v0.7');

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, source_unit, unit_factor, unit_offset, map_version) values
('lab','MERCURY','toxic_mercury','Mercury','toxics','Heavy Metals','mcg/L','µg/L',1,0,'celf-v0.7'),
('lab','MERCURY','toxic_mercury','Mercury','toxics','Heavy Metals','mcg/L','mcg/L',1,0,'celf-v0.7'),
('lab','MERCURY, BLOOD','toxic_mercury','Mercury','toxics','Heavy Metals','mcg/L','mcg/L',1,0,'celf-v0.7'),
('lab','MERCURY, BLOOD','toxic_mercury','Mercury','toxics','Heavy Metals','mcg/L','µg/L',1,0,'celf-v0.7');

insert into public.celf_feature_map (source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, source_unit, unit_factor, unit_offset, map_version) values
('lab','Selenium','minerals_selenium','Selenium','minerals','Mineral Panel','mcg/L',null,1,0,'celf-v0.7'),
('lab','Testosterone Free','hormone_testosterone_free','Free Testosterone','hormones','Hormone Panel','pg/mL',null,1,0,'celf-v0.7');