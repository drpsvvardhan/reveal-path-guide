-- patient_lab_observations — new columns for LLM canonicalization
alter table public.patient_lab_observations
  add column if not exists canonical_concept_id       text,
  add column if not exists canonical_unit             text,
  add column if not exists canonical_value            numeric,
  add column if not exists classification_confidence  numeric,
  add column if not exists biomarker_class            text,
  add column if not exists classification_method      text default 'llm_at_ingest'
    check (classification_method in ('llm_at_ingest', 'hand_curated_map', 'human_reviewed', 'pending'));

create index if not exists idx_obs_canonical_concept
  on public.patient_lab_observations (user_id, canonical_concept_id);

create index if not exists idx_obs_low_confidence
  on public.patient_lab_observations (classification_confidence)
  where classification_confidence is not null and classification_confidence < 0.80;

-- observation_review_queue
create table if not exists public.observation_review_queue (
  id                         uuid primary key default gen_random_uuid(),
  observation_id             uuid not null references public.patient_lab_observations(id) on delete cascade,
  user_id                    uuid not null references auth.users(id) on delete cascade,
  upload_id                  uuid references public.patient_lab_uploads(id) on delete set null,
  queued_at                  timestamptz not null default now(),

  raw_name                   text not null,
  raw_value                  numeric,
  raw_unit                   text,
  proposed_concept_id        text,
  proposed_concept_label     text,
  proposed_unit              text,
  classification_confidence  numeric,
  reject_reason              text,
  page_number                integer,

  review_status              text not null default 'pending'
    check (review_status in ('pending', 'accepted', 'corrected', 'rejected')),
  reviewed_by                uuid references auth.users(id),
  reviewed_at                timestamptz,
  reviewer_concept_id        text,
  reviewer_notes             text,

  proposed_new_concept       boolean not null default false
);

create index if not exists idx_review_queue_pending
  on public.observation_review_queue (review_status, queued_at)
  where review_status = 'pending';

create index if not exists idx_review_queue_user
  on public.observation_review_queue (user_id, queued_at desc);

alter table public.observation_review_queue enable row level security;

create policy "review_queue_admin_all" on public.observation_review_queue
  for all to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  ))
  with check (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  ));

create policy "review_queue_owner_read" on public.observation_review_queue
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.observation_review_queue to authenticated;
grant insert, update on public.observation_review_queue to authenticated;

-- ontology_concept_proposals
create table if not exists public.ontology_concept_proposals (
  id                       uuid primary key default gen_random_uuid(),
  proposed_concept_id      text not null,
  proposed_label           text not null,
  proposed_unit            text,
  proposed_domain          text,
  first_seen_observation_id uuid references public.patient_lab_observations(id),
  example_raw_names        text[],
  proposed_at              timestamptz not null default now(),
  proposed_by              uuid references auth.users(id),
  status                   text not null default 'pending'
    check (status in ('pending', 'accepted_into_ontology', 'merged_with_existing', 'rejected')),
  merged_into_concept_id   text,
  unique (proposed_concept_id)
);

alter table public.ontology_concept_proposals enable row level security;
create policy "ontology_proposals_admin_all" on public.ontology_concept_proposals
  for all to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

grant select, insert, update on public.ontology_concept_proposals to authenticated;