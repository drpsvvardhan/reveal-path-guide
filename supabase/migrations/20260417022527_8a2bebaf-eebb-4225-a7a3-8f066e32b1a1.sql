insert into storage.buckets (id, name, public)
values ('ontology', 'ontology', true)
on conflict (id) do update set public = true;

create policy "Ontology is publicly readable"
on storage.objects for select
using (bucket_id = 'ontology');

create policy "Service role can manage ontology"
on storage.objects for all
using (bucket_id = 'ontology' and auth.role() = 'service_role')
with check (bucket_id = 'ontology' and auth.role() = 'service_role');