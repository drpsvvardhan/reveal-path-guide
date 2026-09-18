-- CIE 3.3 has no v2.2 domain/gate scores. Existing assessments stay versioned.
alter table public.cie_assessments
  add column instrument_version text not null default '2.2.0';
alter table public.cie_assessments add constraint cie_instrument_version
  check (instrument_version in ('2.2.0', '3.3.0'));

create table public.cie33_sessions (
  id uuid primary key references public.cie_assessments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null check (revision >= 0),
  state jsonb not null,
  published_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cie33_state_owner check (state->>'subjectId' = user_id::text and state->>'id' = id::text),
  constraint cie33_state_revision check ((state->>'revision')::integer = revision),
  constraint cie33_version check (state->>'instrumentVersion' = '3.3.0'),
  constraint cie33_phase check (state->>'phase' in ('active', 'paused', 'review', 'complete', 'safety_hold'))
);
create index cie33_sessions_owner on public.cie33_sessions (user_id, created_at desc);
create unique index cie33_one_open_session on public.cie33_sessions (user_id)
  where state->>'phase' <> 'complete';

-- Each successful command appends a receipt. Answer receipts contain the exact
-- question, accepted answer, committed witness and optional supersedes pointer.
create table public.cie33_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  session_id uuid not null references public.cie33_sessions(id) on delete cascade,
  request_hash text not null check (request_hash like 'sha256:%'),
  result_revision integer not null,
  event jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create index cie33_events_session on public.cie33_events (session_id, result_revision);

alter table public.cie33_sessions enable row level security;
alter table public.cie33_events enable row level security;
revoke all on public.cie33_sessions, public.cie33_events from anon, authenticated;
grant select on public.cie33_sessions, public.cie33_events to authenticated;
grant select, insert, update, delete on public.cie33_sessions to service_role;
grant select, insert, delete on public.cie33_events to service_role;
create policy cie33_sessions_owner_read on public.cie33_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy cie33_events_owner_read on public.cie33_events
  for select to authenticated using ((select auth.uid()) = user_id);

-- The legacy client cannot forge completion or delete a canonical assessment.
create function public.cie33_guard_assessment() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (case when tg_op = 'DELETE' then old.instrument_version = '3.3.0'
           when tg_op = 'INSERT' then new.instrument_version = '3.3.0'
           else old.instrument_version = '3.3.0' or new.instrument_version = '3.3.0' end)
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'CIE 3.3 assessments require the authenticated intake service' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger cie33_guard_assessment before insert or update or delete on public.cie_assessments
  for each row execute function public.cie33_guard_assessment();

-- Service-role-only, invoker RPC. Authentication and strict answer validation
-- occur in cie-v33; this transaction owns CAS, durable idempotency and lineage.
create function public.cie33_commit(
  p_user_id uuid, p_request_id uuid, p_request_hash text,
  p_expected_revision integer, p_expected_hash text, p_state jsonb, p_action text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  existing public.cie33_sessions%rowtype;
  receipt public.cie33_events%rowtype;
  sid uuid := (p_state->>'id')::uuid;
  next_revision integer := (p_state->>'revision')::integer;
  old_count integer;
  new_count integer := jsonb_array_length(p_state->'entries');
  delta jsonb;
begin
  -- Serializes starts and edits for one patient, including idempotent retries.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 330));
  select * into receipt from public.cie33_events where user_id = p_user_id and request_id = p_request_id;
  if found then
    if receipt.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return (select state from public.cie33_sessions where id = receipt.session_id and user_id = p_user_id);
  end if;
  if p_state->>'subjectId' is distinct from p_user_id::text or p_state->>'instrumentVersion' is distinct from '3.3.0'
     or p_state->>'profileVersion' is distinct from 'vizzhy-foundation@1.0.0'
     or not (p_state->>'stateHash' like 'sha256:%') then
    raise exception 'INVALID_STATE';
  end if;
  if p_expected_revision = -1 then
    if next_revision <> 0 or new_count <> 0 or p_action <> 'start' or p_state->>'phase' <> 'active' then
      raise exception 'INVALID_START';
    end if;
    select * into existing from public.cie33_sessions where user_id = p_user_id and state->>'phase' <> 'complete';
    if found then
      insert into public.cie33_events(user_id, request_id, session_id, request_hash, result_revision, event)
        values (p_user_id, p_request_id, existing.id, p_request_hash, existing.revision,
          jsonb_build_object('action', 'start_reused', 'stateHash', existing.state->>'stateHash'));
      return existing.state;
    end if;
    insert into public.cie_assessments(id, user_id, version, instrument_version, status)
      select sid, p_user_id, coalesce(max(version), 0) + 1, '3.3.0', 'in_progress'
      from public.cie_assessments where user_id = p_user_id;
    insert into public.cie33_sessions(id, user_id, revision, state) values (sid, p_user_id, 0, p_state);
  else
    select * into existing from public.cie33_sessions where id = sid and user_id = p_user_id for update;
    if not found then raise exception 'SESSION_NOT_FOUND' using errcode = '42501'; end if;
    if existing.revision <> p_expected_revision or existing.state->>'stateHash' is distinct from p_expected_hash
       or next_revision <> existing.revision + 1 then
      raise exception 'STALE_STATE' using errcode = '40001';
    end if;
    if existing.state->>'safety' = 'handoff_required' then raise exception 'SAFETY_HOLD'; end if;
    old_count := jsonb_array_length(existing.state->'entries');
    if new_count < old_count or new_count > old_count + 1 or
       exists (select 1 from jsonb_array_elements(existing.state->'entries') with ordinality e(value, i)
               where p_state->'entries'->((e.i - 1)::integer) is distinct from e.value) then
      raise exception 'APPEND_ONLY_VIOLATION';
    end if;
    if new_count = old_count + 1 then
      if p_action <> 'answer' then raise exception 'ANSWER_ACTION_REQUIRED'; end if;
      delta := p_state->'entries'->old_count;
      if delta->'witness'->>'subjectId' is distinct from p_user_id::text
         or delta->'answer'->>'subjectId' is distinct from p_user_id::text
         or delta->'answer'->>'sessionId' is distinct from sid::text
         or delta->'question'->>'sessionId' is distinct from sid::text
         or delta->'question' is distinct from existing.state->'current'->'instance'
         or delta->'witness'->'commit' is null then raise exception 'INVALID_LINEAGE'; end if;
    elsif p_action = 'answer' then raise exception 'MISSING_ANSWER';
    end if;
    update public.cie33_sessions set revision = next_revision, state = p_state,
      published_state = case when p_state->>'phase' = 'complete' then p_state else published_state end,
      updated_at = now() where id = sid and user_id = p_user_id;
  end if;
  update public.cie_assessments set
    status = case when p_state->>'phase' = 'complete' or existing.published_state is not null then 'complete' else 'in_progress' end,
    full_completed_at = case when p_state->>'phase' = 'complete' then now() else full_completed_at end,
    total_questions_answered = (select count(distinct e->>'key') from jsonb_array_elements(p_state->'entries') e),
    updated_at = now()
    where id = sid and user_id = p_user_id;
  insert into public.cie33_events(user_id, request_id, session_id, request_hash, result_revision, event)
    values (p_user_id, p_request_id, sid, p_request_hash, next_revision,
      jsonb_build_object('action', p_action, 'priorStateHash', p_expected_hash, 'stateHash', p_state->>'stateHash',
        'entry', delta, 'question', p_state->'current', 'route', p_state->'route',
        'contract', case when p_action = 'start' then p_state->'contract' else null end));
  return p_state;
end;
$$;
revoke all on function public.cie33_commit(uuid, uuid, text, integer, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.cie33_commit(uuid, uuid, text, integer, text, jsonb, text) to service_role;
revoke all on function public.cie33_guard_assessment() from public, anon, authenticated;

comment on table public.cie33_sessions is 'CIE 3.3 working state and last confirmed publication; independent of legacy numeric scoring.';
comment on table public.cie33_events is 'Append-only application command receipts; raw question-answer-witness lineage retained for corrections.';
