# RAE AdmitGateway Wiring — Design v1

Status: design only. No code changes proposed in this document.
Controlling spec: `docs/RAE_STORAGE_PERSISTENCE_DESIGN_v1.md` (locked).
Module to wire: `supabase/functions/_shared/rae/storage/admit.ts`.
Reference insert path: `insertWitnessesBatched` in
`supabase/functions/witnessify-observations/index.ts` (lines ~707–761).

---

## 1. Purpose

Define how the abstract `AdmitGateway` / `RunInTransaction` seam in
`admit.ts` is bound to a real Postgres backend, while preserving:

- single-transaction atomicity across CAW insert, state transition,
  witness insert, and `produced_witness_id` backfill (storage design §2);
- the closed write set: `concept_assignment_witnesses`,
  `rae_state_transitions`, `witness_objects` (via the approved insert
  path only) — storage design §9.8;
- reuse of the existing witness insert helper rather than a parallel
  hand-rolled INSERT against `witness_objects`;
- no fifth admission state and no edge-function shape changes (yet).

This document evaluates two wiring strategies and recommends one.

---

## 2. The transaction-boundary problem

`persistInitialAdmission` requires that the following four operations
either all commit or all roll back:

1. `INSERT INTO concept_assignment_witnesses` (CAW row, draft).
2. `INSERT INTO rae_state_transitions` (admission transition, exactly one).
3. `INSERT INTO witness_objects` via the approved witnessify insert path
   (only when the decision admits and produces a witness).
4. `UPDATE concept_assignment_witnesses SET produced_witness_id = …`
   for the same `caw_id` (backfill).

The current Supabase SDK call style used elsewhere in this repo
(`supabase.from("…").insert(…)`) issues each statement as an independent
PostgREST request. PostgREST opens its own short-lived transaction per
request and commits before returning. There is no client-visible
`BEGIN` / `COMMIT` boundary the storage layer can wrap around four
independent calls.

This is the core constraint: whatever wiring we pick must give the
storage layer one transactional handle that survives across four
statements, or it must move all four statements into a single
server-side unit of work.

There are exactly two viable shapes:

- Option A — TS-side transaction using a real Postgres driver
  (`deno-postgres` or `node-postgres` style) over a single connection
  with `BEGIN` / `COMMIT` controlled from the edge function.
- Option B — Single SECURITY DEFINER SQL function invoked once from
  the edge function via PostgREST RPC, with all four statements
  living server-side.

A third shape — chained PostgREST calls with compensating writes — is
explicitly excluded by storage design §6 (no compensating sequence;
`witnessify_impl` is pure so atomicity is the contract).

---

## 3. Option A — deno-postgres / pg driver, TS-controlled transaction

### 3.1 Shape

The edge function opens a service-role connection through a Postgres
driver (deno-postgres in the edge runtime). For each admission:

```
await client.queryArray("BEGIN");
try {
  const gw = makePgAdmitGateway(client);
  const result = await body(gw);              // persistInitialAdmission body
  await client.queryArray("COMMIT");
  return result;
} catch (e) {
  await client.queryArray("ROLLBACK");
  throw e;
}
```

`makePgAdmitGateway(client)` implements every method on `AdmitGateway`
as parameterised SQL statements over the same connection, so all four
writes share one snapshot.

### 3.2 How it satisfies each constraint

- Single transaction: yes, native `BEGIN` / `COMMIT` over one
  connection.
- Closed write set: enforced by the gateway implementation only
  emitting INSERT/UPDATE against the three permitted tables; the
  static scan in `admit.test.ts` continues to pass because `admit.ts`
  itself still references no SQL.
- Reuse of approved witness insert path: requires extracting the body
  of `insertWitnessesBatched` from `witnessify-observations` into a
  shared helper that accepts a SQL-executor handle (the open
  transaction client) instead of a Supabase client. Today that helper
  is written against `sb.from("witness_objects").upsert(...)`; that
  call is PostgREST and cannot participate in a TS-side transaction.
  So Option A forces a second rewrite: the helper must be portable to
  raw SQL.
- Idempotency: `findCawByCawId` becomes `SELECT … FOR UPDATE` (or a
  plain SELECT followed by `INSERT … ON CONFLICT (caw_id) DO NOTHING
  RETURNING …`). Either pattern is straightforward inside the txn.
- No fifth state: nothing about wiring touches state-machine logic.

### 3.3 Costs and risks

- New runtime dependency: a Postgres driver in the edge runtime,
  configured with the service-role connection string. Today no edge
  function in this repo uses one; every function uses the Supabase JS
  client. Adopting a driver introduces an entire connection-management
  surface (pool size, timeouts, TLS config, idle teardown) that does
  not exist anywhere else in the codebase.
- The witness insert helper currently relies on
  `.upsert(..., { onConflict, ignoreDuplicates })`. Reproducing that
  with raw SQL is not difficult (`INSERT … ON CONFLICT (…) DO NOTHING
  RETURNING witness_id`) but it duplicates logic that already lives
  in `witnessify-observations` and creates a divergence risk: future
  changes to the witness insert shape would have to be applied in two
  places.
- The closed-write-set guarantee weakens slightly. `admit.ts` is still
  pure, but the gateway implementation now contains arbitrary SQL,
  and nothing structurally prevents it from writing to a forbidden
  table. The existing static scan only inspects `admit.ts`. We would
  have to extend the scan to the gateway file.
- Triggers (`enforce_caw_ancestry_integrity`,
  `enforce_caw_limitations_no_blanks`,
  `enforce_witness_ancestry_integrity`) still fire correctly inside
  the txn — no behavioural change there.

---

## 4. Option B — SECURITY DEFINER SQL function (RPC)

### 4.1 Shape

A single `public.rae_persist_initial_admission(p_payload jsonb)`
function, declared `SECURITY DEFINER`, runs on the database server in
one implicit transaction (Postgres function bodies are atomic with
respect to the calling statement). The function:

1. Probes for an existing CAW by deterministic `caw_id`. If present,
   returns it (idempotent no-op).
2. Inserts the CAW row.
3. Inserts the `rae_state_transitions` row using the from/to/actor/
   policy/reason fields the orchestrator already computed (no
   re-implementation of `evaluateTransition`).
4. Calls a shared SQL helper `public.rae_insert_witness_object(...)`
   that wraps the same `INSERT … ON CONFLICT (user_id, source_table,
   source_row_id, registry_seed_version) DO NOTHING RETURNING
   witness_id` used by `insertWitnessesBatched`.
5. Updates `concept_assignment_witnesses.produced_witness_id`.
6. Returns the persisted CAW row plus the chosen `witness_id`.

The edge function calls it once via
`supabase.rpc("rae_persist_initial_admission", { p_payload: … })`.
The `AdmitGateway` interface in `admit.ts` is bound by a degenerate
gateway whose `runInTransaction` body simply invokes the single RPC.

### 4.2 How it satisfies each constraint

- Single transaction: yes, by virtue of being one statement on the
  server. No `BEGIN` / `COMMIT` plumbing is required in the edge
  function.
- Closed write set: enforceable far more strictly than Option A. The
  DEFINER role can be granted INSERT/UPDATE only on the three
  permitted tables; revoking write privileges elsewhere makes the
  closure a database-level guarantee, not a code-review one.
- Reuse of approved witness insert path: a shared SQL helper
  `rae_insert_witness_object` becomes the single source of truth for
  the witness insert. `witnessify-observations` would migrate (in a
  later, separate change) to call the same helper, collapsing
  duplication rather than creating it.
- Idempotency: trivial. The function is one statement, so the
  `caw_id` probe + `ON CONFLICT DO NOTHING` is naturally race-safe.
- No fifth state: untouched.
- `admit.ts` purity: preserved. The TS gateway wrapper around the
  RPC is small enough that the static forbidden-write scan can extend
  to it without false positives.

### 4.3 Costs and risks

- Logic duplication risk: state-machine semantics
  (`evaluateTransition`) live in TypeScript. The SQL function must
  not re-implement them. Mitigation: the orchestrator computes
  `from_state`, `to_state`, `actor_kind`, `policy`, and `reason`
  before calling the RPC; the SQL function only persists what the TS
  layer decided. The function still relies on the existing CHECK
  constraints on `rae_state_transitions` for defence in depth.
- Schema change required: a new SQL function plus a small wrapper
  for the witness helper. Storage design §10 says "no schema changes
  unless CodexOS explicitly approves." Adding functions and granting
  privileges is a schema change. This needs explicit CodexOS approval
  before implementation. (The CAW / transitions / witness tables
  themselves are unchanged.)
- Auth boundary: `SECURITY DEFINER` runs as the function owner. We
  must `SET search_path = public` (already the project convention,
  see every existing DEFINER function) and revoke EXECUTE from
  `anon` / `authenticated`, granting only to `service_role`. The edge
  function already runs as service role, so this is consistent.
- Observability: errors surface as Postgres exceptions. The TS
  gateway must translate well-known `errcode` / `SQLSTATE` values
  back into the storage layer's typed errors (`StorageInputError`,
  `BackAnnotationVerificationError`, idempotency hits). This mapping
  is a small, bounded surface.

---

## 5. Comparison summary

Concern, then Option A behaviour, then Option B behaviour:

- Single-transaction guarantee: A = client-managed, B = server-implicit. Both satisfy.
- New runtime dependency in edge runtime: A = yes (pg driver), B = none.
- Connection / pool management to design: A = yes, B = no.
- Closed write set enforcement: A = code review only, B = DB-level GRANT/REVOKE.
- Reuse of witness insert helper: A = requires fork to raw SQL, B = one shared SQL helper.
- Drift risk vs `insertWitnessesBatched`: A = high, B = low.
- Static forbidden-write scan still works: A = needs extension, B = needs small extension.
- Schema change required: A = none, B = yes (functions and grants).
- Mapping of typed errors: A = native TS throws, B = SQLSTATE to typed errors.
- Consistency with existing edge-fn style: A = diverges, B = matches existing RPC pattern (e.g. `resolve_observation_review_queue_item`).
- Future review-action wiring: A = same driver pattern, B = sibling RPC, same shape.

---

## 6. Recommendation

Adopt Option B — a single `SECURITY DEFINER` SQL function invoked via
RPC — gated on explicit CodexOS approval of the schema additions.

Reasons, in priority order:

1. It is the only option where the closed write set is enforced at
   the database, not by code review. Storage design §9.8 gains real
   teeth.
2. The single-transaction requirement becomes structural rather than
   procedural: there is no way for a future caller to accidentally
   split the four writes.
3. The witness insert path is shared exactly once
   (`rae_insert_witness_object`), instead of forked between the edge
   function and a new Postgres-driver gateway. This eliminates the
   highest-likelihood regression vector.
4. It introduces no new runtime dependency in the edge environment
   and matches the prevailing RPC pattern already used by
   `resolve_observation_review_queue_item` and friends.
5. The state machine remains in TypeScript. The SQL function persists
   only what the orchestrator already decided; existing CHECK
   constraints on `rae_state_transitions` are sufficient defence in
   depth.

Option A remains a viable fallback if CodexOS rejects the schema
additions, but it carries permanent duplication risk against the
witness insert path and weaker write-set guarantees.

---

## 7. Wiring detail (Option B, design only)

### 7.1 New SQL surface (requires CodexOS approval)

- `public.rae_insert_witness_object(p_witness jsonb) RETURNS uuid`
  - extracted from `insertWitnessesBatched`'s per-row shape;
  - same `ON CONFLICT (user_id, source_table, source_row_id,
    registry_seed_version) DO NOTHING RETURNING witness_id`;
  - `SECURITY DEFINER`, `SET search_path = public`,
    `REVOKE … FROM PUBLIC`, `GRANT EXECUTE TO service_role`.
- `public.rae_persist_initial_admission(p_payload jsonb) RETURNS jsonb`
  - probes by `p_payload->>'caw_id'`;
  - inserts CAW (draft fields exactly as
    `ConceptAssignmentWitnessDraft`);
  - inserts the single `rae_state_transitions` row;
  - calls `rae_insert_witness_object` when the decision produced a
    witness intent;
  - updates `produced_witness_id` if a witness id came back;
  - re-runs the back-annotation soft check by selecting the existing
    witness's `(user_id, source_table, source_row_id)` and applying
    the limitations / `founder_review_flag` rules;
  - returns the final CAW row plus chosen `witness_id` as JSON.

### 7.2 New TS surface (no schema; later implementation)

- A real `AdmitGateway` factory `makeRpcAdmitGateway(sb)` that wraps
  every method to a single RPC call and a degenerate
  `runInTransaction` (the RPC is itself the transaction).
- A small SQLSTATE-to-typed-error mapper.

### 7.3 Files that would change (when implementation begins)

- New `supabase/migrations/<ts>_rae_persist_initial_admission.sql`
  — adds `rae_insert_witness_object` and
  `rae_persist_initial_admission`, sets DEFINER plus grants.
- New `supabase/functions/_shared/rae/storage/gateway_rpc.ts`
  — implements `makeRpcAdmitGateway` and SQLSTATE mapping. No SQL
  literals beyond the two RPC names.
- Edited `supabase/functions/_shared/rae/storage/admit.ts`
  — none required for wiring; the public contract already accepts an
  injected gateway. Comment block extended to point at this design.
- Edited `supabase/functions/_shared/rae/storage/admit.test.ts`
  — extend the static forbidden-write scan to also scan
  `gateway_rpc.ts` (asserting it references only
  `rpc("rae_persist_initial_admission")` and
  `rpc("rae_insert_witness_object")`).
- Not edited yet: `supabase/functions/witnessify-observations/index.ts`
  — the existing `insertWitnessesBatched` stays in place. A later,
  separate change can migrate it to the shared SQL helper; that
  migration is out of scope here.
- Not created yet: any RAE edge function. Wiring this gateway into an
  edge function (orchestrator → admit → gateway) is a separate prompt.

### 7.4 Files that would change under Option A (for completeness)

- New `supabase/functions/_shared/rae/storage/gateway_pg.ts` with
  deno-postgres client management.
- New `supabase/functions/_shared/witness_insert.ts` extracted from
  `insertWitnessesBatched`, parameterised over a SQL executor.
- Edited `supabase/functions/witnessify-observations/index.ts` to
  consume the extracted helper through the Supabase client (kept
  PostgREST) — non-trivial because the helper now needs two binding
  modes.
- Edited `supabase/functions/_shared/rae/storage/admit.test.ts` to
  extend the static scan to `gateway_pg.ts` and the new helper.
- New migration: none required.

---

## 8. Open questions for CodexOS

1. Approve the two new SQL functions and the implied GRANT/REVOKE
   surface? (Storage design §10 forbids unapproved schema changes.)
2. Confirm that the soft back-annotation check (concept-id drift →
   `founder_review_flag` + `limitations` entry) is acceptable to live
   inside the SQL function, or whether it must remain TS-side with
   the SQL function trusting the precomputed flag.
3. Confirm the SQLSTATE mapping table is owned by `gateway_rpc.ts`
   rather than by `admit.ts` (preserves `admit.ts` purity).
4. Confirm that the future migration of `witnessify-observations` to
   `rae_insert_witness_object` is in scope for a separate prompt and
   must not be bundled with the RAE wiring change.

---

Awaiting CodexOS review before AdmitGateway implementation.
