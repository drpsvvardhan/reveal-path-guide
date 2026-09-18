create or replace function public.cie33_submit_safety_review(
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
  authority public.clinician_patient_authorizations%rowtype;
  v_review_id uuid;
  v_state jsonb;
  v_result_revision integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_patient::text, 331));
  if p_clinician = p_patient then
    raise exception 'SELF_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;

  select * into prior from public.cie33_safety_reviews
    where clinician_user_id = p_clinician and request_id = p_request_id;
  if found and (prior.request_hash is distinct from p_request_hash
      or prior.patient_user_id is distinct from p_patient
      or prior.session_id is distinct from p_session_id) then
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505';
  end if;

  select * into existing from public.cie33_sessions
    where id = p_session_id and user_id = p_patient for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = '42501';
  end if;

  if prior.id is null and p_disposition = 'permit_resumption' then
    select * into authority from public.clinician_patient_authorizations
      where id::text = p_state->'safetyReview'->>'authorizationId'
        and clinician_user_id = p_clinician and patient_user_id = p_patient
      for share;
  else
    select * into authority from public.clinician_patient_authorizations
      where clinician_user_id = p_clinician and patient_user_id = p_patient
        and revoked_at is null and expires_at > clock_timestamp()
      order by granted_at desc, id desc limit 1 for share;
  end if;
  if authority.id is null or authority.revoked_at is not null
     or authority.expires_at <= clock_timestamp() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if prior.id is not null then
    return jsonb_build_object('review_id', prior.id, 'replayed', true,
      'disposition', prior.disposition, 'state', existing.state);
  end if;
  if p_disposition is null or p_disposition not in ('keep_hold', 'permit_resumption') then
    raise exception 'INVALID_DISPOSITION' using errcode = '22023';
  end if;
  if existing.revision is distinct from p_expected_revision
     or existing.state->>'stateHash' is distinct from p_expected_hash then
    raise exception 'STALE_STATE' using errcode = '40001';
  end if;
  if existing.state->>'safety' is distinct from 'handoff_required' then
    raise exception 'NOT_HELD' using errcode = '22023';
  end if;
  if p_source_witness_id is distinct from (
    select e.value->'witness'->>'id'
      from jsonb_array_elements(existing.state->'entries') with ordinality e(value, position)
      where e.value->>'key' = 'safety' order by e.position desc limit 1
  ) then
    raise exception 'SAFETY_WITNESS_MISMATCH' using errcode = '22023';
  end if;

  v_state := existing.state;
  v_result_revision := existing.revision;
  v_review_id := gen_random_uuid();
  if p_disposition = 'permit_resumption' then
    if p_state is null
       or (p_state->>'revision')::integer is distinct from existing.revision + 1
       or p_state->>'id' is distinct from p_session_id::text
       or p_state->>'subjectId' is distinct from p_patient::text
       or p_state->>'instrumentVersion' is distinct from '3.3.0'
       or p_state->>'profileVersion' is distinct from existing.state->>'profileVersion'
       or p_state->>'safety' is distinct from 'recheck_required'
       or p_state->>'phase' is distinct from 'active'
       or coalesce(p_state->>'stateHash' like 'sha256:%', false) = false
       or p_state->'entries' is distinct from existing.state->'entries'
       or p_state->'safetyReview'->>'sourceWitnessId' is distinct from p_source_witness_id
       or p_state->'safetyReview'->>'clinicianUserId' is distinct from p_clinician::text
       or p_state->'safetyReview'->>'authorizationId' is distinct from authority.id::text
       or (p_state->'safetyReview'->>'sourceRevision')::integer is distinct from existing.revision
       or p_state->'safetyReview'->>'sourceStateHash' is distinct from existing.state->>'stateHash'
       or p_state->'current'->>'key' is distinct from 'safety'
       or p_state->'current'->>'revisesWitnessId' is distinct from p_source_witness_id
       or p_state->'current'->'plan'->>'humanObservable' is distinct from 'safety'
       or coalesce(p_state->'safetyReview'->>'reviewId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false) = false then
      raise exception 'INVALID_PERMIT' using errcode = '22023';
    end if;
    v_review_id := (p_state->'safetyReview'->>'reviewId')::uuid;
    update public.cie33_sessions
      set revision = (p_state->>'revision')::integer, state = p_state, updated_at = clock_timestamp()
      where id = p_session_id and user_id = p_patient;
    v_state := p_state;
    v_result_revision := (p_state->>'revision')::integer;
  end if;

  insert into public.cie33_safety_reviews (
    id, request_id, request_hash, session_id, patient_user_id, clinician_user_id, authorization_id,
    source_revision, source_state_hash, source_witness_id, disposition, encounter_at,
    assessment_note, rationale, patient_instructions, result_revision, result_state_hash)
  values (
    v_review_id, p_request_id, p_request_hash, p_session_id, p_patient, p_clinician, authority.id,
    existing.revision, existing.state->>'stateHash', p_source_witness_id, p_disposition, p_encounter_at,
    p_assessment_note, p_rationale, p_patient_instructions, v_result_revision, v_state->>'stateHash');

  insert into public.cie33_events (user_id, request_id, session_id, request_hash, result_revision, event)
  values (p_patient, p_request_id, p_session_id, p_request_hash, v_result_revision,
    jsonb_build_object(
      'action', 'clinician_safety_review', 'reviewId', v_review_id,
      'clinicianUserId', p_clinician, 'authorizationId', authority.id,
      'disposition', p_disposition, 'encounterAt', p_encounter_at,
      'priorStateHash', existing.state->>'stateHash', 'stateHash', v_state->>'stateHash',
      'sourceWitnessId', p_source_witness_id, 'sourceRevision', existing.revision));
  return jsonb_build_object('review_id', v_review_id, 'replayed', false,
    'disposition', p_disposition, 'state', v_state);
end;
$$;

revoke all on function public.cie33_submit_safety_review(uuid, uuid, uuid, text, uuid, integer, text, text, timestamptz, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cie33_submit_safety_review(uuid, uuid, uuid, text, uuid, integer, text, text, timestamptz, text, text, text, text, jsonb) to service_role;