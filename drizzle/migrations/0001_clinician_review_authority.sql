-- Clinician review authority and CIE 3.3 safety review workflow.
-- Additive only. No existing table, policy, function or migration is altered.
-- Admin role alone never confers clinical clearance: a disposition requires an
-- explicit, revocable, expiring, patient-scoped grant rechecked in-transaction.

create table public.clinician_patient_authorizations (
  id uuid primary key default gen_random_uuid(),
  clinician_user_id uuid not null references auth.users(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  credential_reference text not null,
  credential_attestation text not null,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revocation_reason text,
  constraint cpa_no_self_authorization check (clinician_user_id <> patient_user_id),
  constraint cpa_not_self_granted check (granted_by <> clinician_user_id),
  constraint cpa_credential_present check (
    length(btrim(credential_reference)) >= 3
    and length(btrim(credential_attestation)) >= 20
  ),
  constraint cpa_revocation_complete check ((revoked_at is null) = (revoked_by is null))
);
create index cpa_patient on public.clinician_patient_authorizations (patient_user_id, clinician_user_id);
create index cpa_clinician_active on public.clinician_patient_authorizations (clinician_user_id, expires_at desc)
  where revoked_at is null;

create function public.clinician_authorization_validate() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.expires_at <= new.granted_at then
    raise exception 'AUTHORIZATION_WINDOW_INVALID' using errcode = '22023';
  end if;
  if new.expires_at > new.granted_at + interval '365 days' then
    raise exception 'AUTHORIZATION_WINDOW_TOO_LONG' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.clinician_user_id <> old.clinician_user_id
       or new.patient_user_id <> old.patient_user_id or new.granted_by <> old.granted_by
       or new.granted_at <> old.granted_at
       or new.credential_reference <> old.credential_reference
       or new.credential_attestation <> old.credential_attestation then
      raise exception 'AUTHORIZATION_IMMUTABLE' using errcode = '42501';
    end if;
    if old.revoked_at is not null then
      raise exception 'AUTHORIZATION_ALREADY_REVOKED' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger clinician_authorization_validate
  before insert or update on public.clinician_patient_authorizations
  for each row execute function public.clinician_authorization_validate();

create table public.clinician_authorization_audit (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references public.clinician_patient_authorizations(id) on delete cascade,
  action text not null check (action in ('granted', 'revoked')),
  actor_user_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb
);
create index clinician_authorization_audit_ref on public.clinician_authorization_audit (authorization_id, occurred_at);

create function public.clinician_audit_append_only() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'APPEND_ONLY' using errcode = '42501';
end;
$$;
create trigger clinician_authorization_audit_append_only
  before update or delete on public.clinician_authorization_audit
  for each row execute function public.clinician_audit_append_only();

-- Immutable, attributed clinical review records for held CIE 3.3 sessions.
create table public.cie33_safety_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  request_hash text not null check (request_hash like 'sha256:%'),
  session_id uuid not null references public.cie33_sessions(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  clinician_user_id uuid not null references auth.users(id),
  authorization_id uuid not null references public.clinician_patient_authorizations(id),
  source_revision integer not null,
  source_state_hash text not null,
  source_witness_id text not null,
  disposition text not null check (disposition in ('keep_hold', 'permit_resumption')),
  encounter_at timestamptz not null,
  assessment_note text not null,
  rationale text not null,
  patient_instructions text not null,
  result_revision integer,
  result_state_hash text,
  created_at timestamptz not null default now(),
  constraint csr_no_self_review check (clinician_user_id <> patient_user_id),
  constraint csr_documented check (
    length(btrim(assessment_note)) >= 20
    and length(btrim(rationale)) >= 20
    and length(btrim(patient_instructions)) >= 10
  ),
  constraint csr_request_unique unique (clinician_user_id, request_id)
);
create index cie33_safety_reviews_session on public.cie33_safety_reviews (session_id, created_at desc);
create index cie33_safety_reviews_patient on public.cie33_safety_reviews (patient_user_id, created_at desc);

create trigger cie33_safety_reviews_append_only
  before update or delete on public.cie33_safety_reviews
  for each row execute function public.clinician_audit_append_only();

alter table public.clinician_patient_authorizations enable row level security;
alter table public.clinician_authorization_audit enable row level security;
alter table public.cie33_safety_reviews enable row level security;

revoke all on public.clinician_patient_authorizations from anon, authenticated;
revoke all on public.clinician_authorization_audit from anon, authenticated;
revoke all on public.cie33_safety_reviews from anon, authenticated;
grant select on public.clinician_patient_authorizations to authenticated;
grant select on public.clinician_authorization_audit to authenticated;
grant select, insert, update on public.clinician_patient_authorizations to service_role;
grant select, insert on public.clinician_authorization_audit to service_role;
grant select, insert on public.cie33_safety_reviews to service_role;

-- A clinician may see their own grants; admins may see the authority register.
create policy cpa_clinician_read on public.clinician_patient_authorizations
  for select to authenticated
  using ((select auth.uid()) = clinician_user_id or public.has_role((select auth.uid()), 'admin'));
create policy cpa_audit_admin_read on public.clinician_authorization_audit
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'));
-- No policy on cie33_safety_reviews for authenticated: private clinical notes
-- are never readable through a patient or admin read endpoint.

-- Patients see only the patient-facing part of a review about themselves.
create view public.cie33_safety_review_notices
with (security_invoker = off) as
  select r.id, r.session_id, r.patient_user_id, r.disposition,
         r.encounter_at, r.patient_instructions, r.created_at
  from public.cie33_safety_reviews r
  where r.patient_user_id = (select auth.uid());
grant select on public.cie33_safety_review_notices to authenticated;

create function public.clinician_grant_authorization(
  p_actor uuid, p_clinician uuid, p_patient uuid,
  p_credential_reference text, p_credential_attestation text, p_expires_at timestamptz
) returns public.clinician_patient_authorizations
language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.clinician_patient_authorizations;
begin
  if not public.has_role(p_actor, 'admin') then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_actor = p_clinician then
    raise exception 'SELF_GRANT_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.clinician_patient_authorizations
    (clinician_user_id, patient_user_id, credential_reference, credential_attestation, granted_by, expires_at)
  values (p_clinician, p_patient, p_credential_reference, p_credential_attestation, p_actor, p_expires_at)
  returning * into v_row;
  insert into public.clinician_authorization_audit (authorization_id, action, actor_user_id, detail)
  values (v_row.id, 'granted', p_actor,
    jsonb_build_object('credential_reference', p_credential_reference, 'expires_at', p_expires_at));
  return v_row;
end;
$$;

create function public.clinician_revoke_authorization(
  p_actor uuid, p_authorization_id uuid, p_reason text
) returns public.clinician_patient_authorizations
language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.clinician_patient_authorizations;
begin
  if not public.has_role(p_actor, 'admin') then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  update public.clinician_patient_authorizations
     set revoked_at = now(), revoked_by = p_actor, revocation_reason = p_reason
   where id = p_authorization_id
  returning * into v_row;
  if not found then
    raise exception 'AUTHORIZATION_NOT_FOUND' using errcode = '42501';
  end if;
  insert into public.clinician_authorization_audit (authorization_id, action, actor_user_id, detail)
  values (v_row.id, 'revoked', p_actor, jsonb_build_object('reason', p_reason));
  return v_row;
end;
$$;

-- Transactional clinical disposition. Rechecks the patient-specific grant in
-- the same transaction, compare-and-swaps the held revision, appends an
-- immutable review record and an append-only event receipt.
create function public.cie33_submit_safety_review(
  p_clinician uuid, p_patient uuid, p_request_id uuid, p_request_hash text,
  p_session_id uuid, p_expected_revision integer, p_expected_hash text,
  p_disposition text, p_encounter_at timestamptz, p_assessment_note text,
  p_rationale text, p_patient_instructions text, p_source_witness_id text,
  p_state jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  existing public.cie33_sessions%rowtype;
  prior public.cie33_safety_reviews%rowtype;
  v_auth uuid;
  v_review_id uuid;
  v_state jsonb;
  v_result_revision integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_patient::text, 331));

  select * into prior from public.cie33_safety_reviews
    where clinician_user_id = p_clinician and request_id = p_request_id;
  if found then
    if prior.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object('review_id', prior.id, 'replayed', true, 'disposition', prior.disposition,
      'state', (select state from public.cie33_sessions where id = prior.session_id and user_id = prior.patient_user_id));
  end if;

  if p_clinician = p_patient then
    raise exception 'SELF_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;
  if p_disposition not in ('keep_hold', 'permit_resumption') then
    raise exception 'INVALID_DISPOSITION' using errcode = '22023';
  end if;

  select id into v_auth from public.clinician_patient_authorizations
   where clinician_user_id = p_clinician and patient_user_id = p_patient
     and revoked_at is null and expires_at > now()
   order by granted_at desc limit 1;
  if v_auth is null then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select * into existing from public.cie33_sessions
   where id = p_session_id and user_id = p_patient for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = '42501';
  end if;
  if existing.revision <> p_expected_revision
     or existing.state->>'stateHash' is distinct from p_expected_hash then
    raise exception 'STALE_STATE' using errcode = '40001';
  end if;
  if existing.state->>'safety' is distinct from 'handoff_required' then
    raise exception 'NOT_HELD' using errcode = '22023';
  end if;

  v_state := existing.state;
  v_result_revision := existing.revision;

  if p_disposition = 'permit_resumption' then
    if p_state is null
       or (p_state->>'revision')::integer <> existing.revision + 1
       or p_state->>'id' is distinct from p_session_id::text
       or p_state->>'subjectId' is distinct from p_patient::text
       or p_state->>'instrumentVersion' is distinct from '3.3.0'
       or p_state->>'safety' is distinct from 'recheck_required'
       or p_state->>'phase' is distinct from 'active'
       or not (p_state->>'stateHash' like 'sha256:%')
       or p_state->'entries' is distinct from existing.state->'entries'
       or p_state->'safetyReview'->>'sourceWitnessId' is distinct from p_source_witness_id
       or p_state->'safetyReview'->>'clinicianUserId' is distinct from p_clinician::text
       or (p_state->'current'->'plan'->>'humanObservable') is distinct from 'safety' then
      raise exception 'INVALID_PERMIT' using errcode = '22023';
    end if;
    update public.cie33_sessions
       set revision = (p_state->>'revision')::integer, state = p_state, updated_at = now()
     where id = p_session_id and user_id = p_patient;
    v_state := p_state;
    v_result_revision := (p_state->>'revision')::integer;
  end if;

  insert into public.cie33_safety_reviews (
    request_id, request_hash, session_id, patient_user_id, clinician_user_id, authorization_id,
    source_revision, source_state_hash, source_witness_id, disposition, encounter_at,
    assessment_note, rationale, patient_instructions, result_revision, result_state_hash)
  values (
    p_request_id, p_request_hash, p_session_id, p_patient, p_clinician, v_auth,
    existing.revision, existing.state->>'stateHash', p_source_witness_id, p_disposition, p_encounter_at,
    p_assessment_note, p_rationale, p_patient_instructions, v_result_revision, v_state->>'stateHash')
  returning id into v_review_id;

  insert into public.cie33_events (user_id, request_id, session_id, request_hash, result_revision, event)
  values (p_patient, p_request_id, p_session_id, p_request_hash, v_result_revision,
    jsonb_build_object(
      'action', 'clinician_safety_review',
      'reviewId', v_review_id,
      'clinicianUserId', p_clinician,
      'authorizationId', v_auth,
      'disposition', p_disposition,
      'encounterAt', p_encounter_at,
      'priorStateHash', existing.state->>'stateHash',
      'stateHash', v_state->>'stateHash',
      'sourceWitnessId', p_source_witness_id,
      'sourceRevision', existing.revision));

  return jsonb_build_object('review_id', v_review_id, 'replayed', false,
    'disposition', p_disposition, 'state', v_state);
end;
$$;

revoke all on function public.clinician_authorization_validate() from public, anon, authenticated;
revoke all on function public.clinician_audit_append_only() from public, anon, authenticated;
revoke all on function public.clinician_grant_authorization(uuid, uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.clinician_revoke_authorization(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.cie33_submit_safety_review(uuid, uuid, uuid, text, uuid, integer, text, text, timestamptz, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.clinician_grant_authorization(uuid, uuid, uuid, text, text, timestamptz) to service_role;
grant execute on function public.clinician_revoke_authorization(uuid, uuid, text) to service_role;
grant execute on function public.cie33_submit_safety_review(uuid, uuid, uuid, text, uuid, integer, text, text, timestamptz, text, text, text, text, jsonb) to service_role;

comment on table public.clinician_patient_authorizations is 'Explicit, revocable, expiring, patient-scoped clinician review authority. Administrative access never implies clinical clearance.';
comment on table public.cie33_safety_reviews is 'Immutable attributed clinician review records for held CIE 3.3 intakes. Permission to resume intake only; not a determination of absence of risk and not treatment approval.';