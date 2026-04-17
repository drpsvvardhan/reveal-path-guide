-- ============================================================================
-- resolve_observation_review_queue_item — atomic review queue resolution
-- ============================================================================

create table if not exists public.review_queue_audit_log (
  id                         uuid primary key default gen_random_uuid(),
  queue_item_id              uuid not null references public.observation_review_queue(id) on delete cascade,
  observation_id             uuid references public.patient_lab_observations(id) on delete set null,
  reviewer_id                uuid not null references auth.users(id),
  reviewer_action            text not null check (reviewer_action in ('accepted', 'corrected', 'rejected')),
  previous_concept_id        text,
  new_concept_id             text,
  reviewer_notes             text,
  created_new_proposal       boolean not null default false,
  created_at                 timestamptz not null default now()
);

create index if not exists idx_review_audit_reviewer on public.review_queue_audit_log (reviewer_id, created_at desc);
create index if not exists idx_review_audit_observation on public.review_queue_audit_log (observation_id);

alter table public.review_queue_audit_log enable row level security;
create policy "review_audit_admin_all" on public.review_queue_audit_log
  for all to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

grant select, insert on public.review_queue_audit_log to authenticated;

create or replace function public.resolve_observation_review_queue_item(
  p_queue_item_id    uuid,
  p_action           text,
  p_concept_id       text default null,
  p_reviewer_notes   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer_id          uuid;
  v_is_admin             boolean;
  v_queue_item           public.observation_review_queue%rowtype;
  v_observation          public.patient_lab_observations%rowtype;
  v_concept_in_ontology  boolean;
  v_canonical_unit       text;
  v_biomarker_class      text;
  v_proposal_created     boolean := false;
  v_previous_concept     text;
  v_result               jsonb;
begin
  v_reviewer_id := auth.uid();
  if v_reviewer_id is null then
    raise exception 'unauthorized: no authenticated user' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = v_reviewer_id and role = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'forbidden: admin role required for review queue resolution' using errcode = 'P0002';
  end if;

  if p_action not in ('accepted', 'corrected', 'rejected') then
    raise exception 'invalid action: must be accepted, corrected, or rejected' using errcode = 'P0003';
  end if;

  if p_action in ('accepted', 'corrected') and (p_concept_id is null or p_concept_id = '') then
    raise exception 'concept_id required for accept/correct actions' using errcode = 'P0004';
  end if;

  select * into v_queue_item
  from public.observation_review_queue
  where id = p_queue_item_id
  for update;

  if not found then
    raise exception 'queue item not found: %', p_queue_item_id using errcode = 'P0005';
  end if;

  if v_queue_item.review_status != 'pending' then
    raise exception 'queue item already resolved with status: %', v_queue_item.review_status using errcode = 'P0006';
  end if;

  select * into v_observation
  from public.patient_lab_observations
  where id = v_queue_item.observation_id;

  v_previous_concept := v_observation.canonical_concept_id;

  if p_action in ('accepted', 'corrected') then
    select
      coalesce(max(celf_feature_label), p_concept_id),
      coalesce(max(unit_canonical), null),
      coalesce(max(celf_panel_group), null)
    into v_queue_item.proposed_concept_label, v_canonical_unit, v_biomarker_class
    from public.celf_feature_map
    where celf_feature_name = p_concept_id
    limit 1;

    v_concept_in_ontology := v_canonical_unit is not null;
  end if;

  update public.observation_review_queue
     set review_status = p_action,
         reviewed_by = v_reviewer_id,
         reviewed_at = now(),
         reviewer_concept_id = case when p_action = 'rejected' then null else p_concept_id end,
         reviewer_notes = p_reviewer_notes,
         proposed_new_concept = case when p_action in ('accepted', 'corrected') and not coalesce(v_concept_in_ontology, true)
                                     then true else false end
   where id = p_queue_item_id;

  if p_action in ('accepted', 'corrected') and v_observation.id is not null then
    update public.patient_lab_observations
       set canonical_concept_id = p_concept_id,
           canonical_unit = v_canonical_unit,
           canonical_value = v_observation.value,
           biomarker_class = v_biomarker_class,
           classification_confidence = 1.0,
           classification_method = 'human_reviewed'
     where id = v_observation.id;
  end if;

  if p_action in ('accepted', 'corrected') and not coalesce(v_concept_in_ontology, true) then
    insert into public.ontology_concept_proposals (
      proposed_concept_id, proposed_label, proposed_unit,
      first_seen_observation_id, example_raw_names, proposed_by
    ) values (
      p_concept_id,
      coalesce(v_queue_item.proposed_concept_label, replace(p_concept_id, '_', ' ')),
      v_queue_item.raw_unit,
      v_observation.id,
      array[v_queue_item.raw_name],
      v_reviewer_id
    )
    on conflict (proposed_concept_id) do update
       set example_raw_names = array(
         select distinct unnest(public.ontology_concept_proposals.example_raw_names || excluded.example_raw_names)
       );
    v_proposal_created := true;
  end if;

  insert into public.review_queue_audit_log (
    queue_item_id, observation_id, reviewer_id, reviewer_action,
    previous_concept_id, new_concept_id, reviewer_notes, created_new_proposal
  ) values (
    p_queue_item_id, v_observation.id, v_reviewer_id, p_action,
    v_previous_concept,
    case when p_action = 'rejected' then null else p_concept_id end,
    p_reviewer_notes,
    v_proposal_created
  );

  v_result := jsonb_build_object(
    'queue_item_id', p_queue_item_id,
    'observation_id', v_observation.id,
    'action', p_action,
    'concept_id', p_concept_id,
    'proposal_created', v_proposal_created,
    'concept_in_ontology', coalesce(v_concept_in_ontology, false),
    'resolved_at', now()
  );

  return v_result;
end;
$$;

grant execute on function public.resolve_observation_review_queue_item(uuid, text, text, text) to authenticated;

comment on function public.resolve_observation_review_queue_item is
  'Atomic resolution of an observation review queue item. Validates admin role at DB layer. Updates queue, observation, ontology proposal, and audit log in a single transaction.';