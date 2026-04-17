alter table public.patient_lab_uploads
  add column if not exists document_type text;

alter table public.patient_lab_observations
  add column if not exists specimen_type text;

update public.patient_lab_uploads
   set document_type = 'inbody'
 where document_type is null
   and original_filename ilike '%inbody%';

update public.patient_lab_uploads
   set document_type = 'fibroscan'
 where document_type is null
   and (original_filename ilike '%fibroscan%'
        or original_filename ilike '%fibro_scan%'
        or original_filename ilike '%fibro-scan%');

update public.patient_lab_uploads
   set document_type = 'lab'
 where document_type is null;

update public.patient_lab_observations o
   set specimen_type = case u.document_type
                         when 'inbody'    then 'body_composition'
                         when 'fibroscan' then 'fibroscan'
                         else 'serum'
                       end
  from public.patient_lab_uploads u
 where o.upload_id = u.id
   and o.specimen_type is null;

create or replace function public.fn_inherit_specimen_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc_type text;
begin
  if new.specimen_type is null then
    select document_type into v_doc_type
      from public.patient_lab_uploads
     where id = new.upload_id;

    new.specimen_type := case v_doc_type
                           when 'inbody'    then 'body_composition'
                           when 'fibroscan' then 'fibroscan'
                           else 'serum'
                         end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inherit_specimen_type on public.patient_lab_observations;

create trigger trg_inherit_specimen_type
before insert on public.patient_lab_observations
for each row
execute function public.fn_inherit_specimen_type();