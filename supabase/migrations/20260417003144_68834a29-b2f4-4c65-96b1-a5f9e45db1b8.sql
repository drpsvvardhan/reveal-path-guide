insert into public.celf_feature_map
  (source_system, reveal_canonical, celf_feature_name, celf_feature_label,
   celf_domain, celf_panel_group, unit_canonical, map_version)
values
  ('lab', 'TESTOSTERONE, FREE', 'hormone_testosterone_free', 'Free Testosterone',
   'hormones', 'Hormone Panel', 'pg/mL', 'celf-v0.4'),
  ('lab', 'PROLACTIN, SERUM', 'hormone_prolactin', 'Prolactin',
   'hormones', 'Hormone Panel', 'ng/mL', 'celf-v0.4'),
  ('lab', 'ZINC, SERUM', 'minerals_zinc', 'Zinc',
   'minerals', 'Mineral Panel', 'mcg/dL', 'celf-v0.4')
on conflict do nothing;