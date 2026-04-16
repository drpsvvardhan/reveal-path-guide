alter table public.patient_lab_uploads
  add column if not exists extracted_patient_name  text,
  add column if not exists extracted_patient_dob   text,
  add column if not exists extracted_patient_mrn   text,
  add column if not exists content_sha256          text,
  add column if not exists rejection_reason        text,
  add column if not exists rejected_at             timestamptz,
  add column if not exists name_match_score        numeric,
  add column if not exists name_match_status       text
    check (name_match_status in ('match','mismatch','unknown','override_admin','pending'));

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'patient_lab_uploads' and column_name = 'status' and data_type = 'text'
  ) then
    alter table public.patient_lab_uploads drop constraint if exists patient_lab_uploads_status_check;
    alter table public.patient_lab_uploads add constraint patient_lab_uploads_status_check
      check (status in ('uploaded','processing','extracted','complete','failed','rejected_identity','rejected_duplicate'));
  end if;
end$$;

create unique index if not exists uniq_user_content_sha
  on public.patient_lab_uploads (user_id, content_sha256)
  where content_sha256 is not null and status not in ('rejected_identity','rejected_duplicate','failed');

create index if not exists idx_lab_uploads_name_match
  on public.patient_lab_uploads (user_id, name_match_status);

create table if not exists public.upload_rejection_audit (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  upload_id                  uuid references public.patient_lab_uploads(id) on delete set null,
  file_name                  text,
  rejection_category         text not null
                              check (rejection_category in ('identity_mismatch','duplicate_content','corrupt_file','unsupported_type','extraction_failed')),
  rejection_detail           text,
  account_holder_name        text,
  extracted_patient_name     text,
  name_match_score           numeric,
  content_sha256             text,
  rejected_at                timestamptz not null default now()
);

create index if not exists idx_rejection_audit_user on public.upload_rejection_audit (user_id, rejected_at desc);

alter table public.upload_rejection_audit enable row level security;

drop policy if exists "rejection_audit_owner_read" on public.upload_rejection_audit;
create policy "rejection_audit_owner_read" on public.upload_rejection_audit
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "rejection_audit_no_delete" on public.upload_rejection_audit;
create policy "rejection_audit_no_delete" on public.upload_rejection_audit
  for delete to authenticated using (false);

alter table public.profiles
  add column if not exists preferred_name text,
  add column if not exists name_aliases   text[];

create or replace function public.fn_normalize_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    regexp_replace(
      regexp_replace(lower(coalesce(p_name,'')), '[^a-z0-9 ]', '', 'g'),
      '\s+', ' ', 'g'
    ),
    ''
  );
$$;

create or replace function public.fn_name_match_score(p_account_name text, p_extracted_name text)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_a text := public.fn_normalize_name(p_account_name);
  v_b text := public.fn_normalize_name(p_extracted_name);
  v_toks_a text[];
  v_toks_b text[];
  v_intersect int;
  v_union int;
  v_last_a text;
  v_last_b text;
  v_first_a text;
  v_first_b text;
begin
  if v_a is null or v_b is null then return null; end if;
  if v_a = v_b then return 1.0; end if;

  v_toks_a := string_to_array(v_a, ' ');
  v_toks_b := string_to_array(v_b, ' ');

  if array_length(v_toks_a,1) is null or array_length(v_toks_b,1) is null then return 0.0; end if;

  select count(*)::int into v_intersect
    from (select unnest(v_toks_a) intersect select unnest(v_toks_b)) t;
  select count(*)::int into v_union
    from (select unnest(v_toks_a) union select unnest(v_toks_b)) t;

  v_last_a  := v_toks_a[array_length(v_toks_a,1)];
  v_last_b  := v_toks_b[array_length(v_toks_b,1)];
  v_first_a := v_toks_a[1];
  v_first_b := v_toks_b[1];

  if v_last_a = v_last_b and left(v_first_a,1) = left(v_first_b,1) then
    return greatest(0.85, v_intersect::numeric / nullif(v_union,0));
  end if;

  if v_union = 0 then return 0.0; end if;
  return round(v_intersect::numeric / v_union, 3);
end $$;

comment on function public.fn_name_match_score(text, text) is
  'Returns 0..1 identity match score. Call sites should treat <0.6 as mismatch, >=0.85 as match, else unknown.';

grant select, insert on public.upload_rejection_audit to authenticated;
grant execute on function public.fn_normalize_name(text) to authenticated;
grant execute on function public.fn_name_match_score(text, text) to authenticated;