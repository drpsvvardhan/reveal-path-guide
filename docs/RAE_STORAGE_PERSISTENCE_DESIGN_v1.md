# RAE Storage / Persistence Layer Design v1

Status: design only — no code, no SQL, no schema changes, no migrations.
Controlling specs: `docs/RAE_DESIGN_v1.md`, `docs/RAE_IMPLEMENTATION_PLAN_v1.md`,
`docs/RAE_ORCHESTRATOR_DESIGN_v1.md`.
Controlling contracts: `supabase/functions/_shared/rae/types.ts`,
`supabase/functions/_shared/rae/orchestrator.ts`,
`supabase/functions/_shared/rae/stateMachine.ts`.
Controlling tables (existing schema, no changes):
`concept_assignment_witnesses`, `rae_state_transitions`, plus the existing
P1a witness surfaces owned by `witnessify_impl`.

The storage/persistence layer is the **only** RAE component allowed to
touch the database. Signals, scoring, state machine, and orchestrator
remain pure. This layer turns an `AdmissionDecision` (CAW draft +
`witness_intent`) into durable rows under a strict transactional
contract, and hands off witness production to the existing P1a
`witnessify_impl` path.

---

## 1. Purpose

The persistence layer has exactly four responsibilities:

1. **Persist** the `ConceptAssignmentWitnessDraft` produced by the
   orchestrator into `concept_assignment_witnesses` as a single row keyed
   on the deterministic `caw_id`.
2. **Enforce idempotency** so that re-submitting the same
   `(user_id, source_table, source_row_id, candidate_concept_id,
   engine_version_id)` returns the existing CAW row unchanged, with no
   duplicate transition row and no duplicate witness production.
3. **Append the initial state transition** row to
   `rae_state_transitions` (`from_state = NULL`, `to_state =
   current_state`) using `evaluateTransition` from the state machine to
   validate the move before insert.
4. **Trigger the witnessify path** when, and only when, the orchestrator
   returned `witness_intent = "produce_depth0_witness"`. The witness
   itself is constructed by the existing P1a `witnessify_impl` mechanism.
   The storage layer never builds witness payloads and never writes
   directly to `witness_objects`.

Out of scope for this layer:
- Choosing the candidate concept (caller's job).
- Computing scores, bands, states, or witness intent (orchestrator's job).
- Producing the witness payload itself (P1a `witnessify_impl`'s job).
- Any UI, queueing, notification, or HTTP transport.

---

## 2. Transaction boundary

A single admission persistence call is **one logical atomic unit** and
must commit or roll back as a whole. The unit covers:

1. **CAW insert** into `concept_assignment_witnesses` (or detection of
   an existing row by `caw_id` — see §3).
2. **State transition insert** into `rae_state_transitions`
   (`from_state = NULL → to_state = current_state`), validated by
   `evaluateTransition`.
3. **Witness production handoff** to `witnessify_impl` when
   `witness_intent = "produce_depth0_witness"`. The handoff runs inside
   the same logical transaction; the witnessify path is responsible for
   honoring its own ancestry/limitations/confidence_basis invariants.
4. **CAW `produced_witness_id` backfill** on the row inserted in step 1,
   set to the witness id returned by step 3, only after step 3 succeeds.

If any step fails, all earlier steps in the same call must roll back.
No partial CAW row, no orphan transition, no orphan witness, and no CAW
with a `produced_witness_id` pointing at a witness that was not actually
produced.

The layer must use a single database transaction for steps 1, 2, and 4.
Step 3 (witnessify) must run inside that transaction; if `witnessify_impl`
cannot participate in the same transaction, the storage layer must use a
compensating pattern (see §6) that yields the same observable atomicity:
a failed witness production leaves no CAW and no transition row.

---

## 3. Idempotency

`caw_id` is deterministic (UUIDv5 over
`(user_id, source_table, source_row_id, candidate_concept_id,
engine_version_id)` per the orchestrator design §8). The storage layer
treats `caw_id` as the idempotency key.

Rules:

- If a row with the same `caw_id` already exists, the layer returns the
  existing row **unchanged**. No fields are overwritten. No new
  transition row is appended. No witness production is triggered.
- If `engine_version_id` changes, the resulting `caw_id` changes, and a
  new CAW row is created — the prior CAW row is left untouched. This is
  how engine bumps reopen adjudication without rewriting history.
- The layer must distinguish three return modes for the caller:
  - `created` — new CAW + new transition (+ optional witness).
  - `existing` — pre-existing CAW returned, no side effects.
  - `error` — see §6.
- A duplicate-key race (two concurrent inserts of the same `caw_id`)
  must resolve to one `created` and one `existing`, never to two
  `created` and never to a transient error surfaced upstream.

The layer must not implement "upsert" semantics. CAW rows are
append-only with respect to identity; the only fields ever updated
post-insert are `produced_witness_id` (in the same transaction) and the
`updated_at` bookkeeping column managed by the existing trigger.

---

## 4. State transition handling

The initial transition row is inserted by the storage layer, not the
orchestrator. Rules:

- The initial transition has `from_state = NULL` and `to_state =
  caw.current_state`.
- Before insert, the layer calls `evaluateTransition` from
  `stateMachine.ts` with `from_state = null`, `to_state =
  caw.current_state`, `actor_kind = caw.current_state_actor_kind`,
  `actor_id = caw.current_state_actor_id`, `reason = <storage-supplied
  initial-admission reason>`, and `policy = caw.policy_at_decision`. If
  the state machine rejects the transition, the layer rolls back and
  returns an error; no CAW row is committed.
- `actor_kind`, `actor_id`, and `reason` are required and non-empty.
  `actor_kind ∈ {"engine", "human"}`. For engine-driven admissions the
  storage layer copies `actor_kind = "engine"` and `actor_id =
  engine_version_id` from the CAW.
- On the idempotent `existing` return path no transition row is inserted.
- Subsequent transitions (e.g. `needs_review → human_confirmed`) are
  **not** in scope for this layer's initial-admission entry point. They
  are handled by a separate review-action entry point that follows the
  same evaluate-then-insert discipline; that entry point is described in
  a later prompt.

The transition row references its CAW via `caw_id` only. The storage
layer never writes to `rae_state_transitions` outside of an evaluated
state machine result.

---

## 5. Witness intent handling

The storage layer reads `witness_intent` from the orchestrator's
`AdmissionDecision` envelope. There are exactly two cases:

- `witness_intent = "none"`:
  - Persist CAW only (plus its initial transition row).
  - `produced_witness_id` remains `NULL`.
  - No call to `witnessify_impl`.
- `witness_intent = "produce_depth0_witness"`:
  - After the CAW row is in place inside the transaction, the layer
    calls the existing P1a `witnessify_impl` mechanism through its
    approved entry point. The storage layer passes through:
    - `user_id`, `source_table`, `source_row_id`,
    - `candidate_concept_id`, `ontology_version`,
    - `engine_version_id`, `registry_seed_version`,
    - `confidence_value`, `confidence_basis`, `limitations`,
    - and any ancestry inputs `witnessify_impl` already requires.
  - The witness is produced through the approved witnessify path. The
    storage layer **never** inserts directly into `witness_objects` and
    **never** constructs a witness payload itself.
  - On success, the storage layer backfills
    `concept_assignment_witnesses.produced_witness_id` with the returned
    witness id, in the same transaction as the CAW insert.
  - On failure, see §6.

The storage layer must reject any input where `witness_intent` is
anything other than the two values above. There is no third witness
mode and no fifth admission state (CodexOS OQ-6 lock).

---

## 6. Failure behavior

All listed failures must leave the database in a state consistent with
§2 (atomic) and §3 (idempotent). The required behaviors:

1. **CAW insert fails** (constraint violation, RLS denial, FK ancestry
   trigger denial, malformed payload) — transaction rolls back. No CAW,
   no transition, no witnessify call. Layer returns a typed error.
2. **Transition insert fails** (state-machine rejection, constraint
   violation, missing actor fields) — transaction rolls back. The CAW
   row inserted earlier in the same transaction is discarded. No
   witnessify call.
3. **Witnessify fails** (any error from `witnessify_impl`, including
   confidence-basis or limitations invariant violations and ancestry
   trigger rejection) — transaction rolls back. The CAW row and its
   transition row are discarded. `produced_witness_id` is never set to
   a non-existent id. The layer surfaces the underlying witnessify
   error class to the caller without rewrapping it as a RAE-internal
   error.
4. **FK ancestry trigger fails** during witness production — treated as
   case 3 above; rollback is total.
5. **Duplicate `caw_id` race** — two concurrent admissions with the
   same deterministic `caw_id`:
   - The losing transaction must catch the unique-violation on
     `concept_assignment_witnesses.caw_id`, roll back its own writes
     (including not running witnessify), re-read the existing CAW row,
     and return it as `existing`.
   - The winning transaction proceeds normally and returns `created`.
   - Net effect: exactly one CAW row, exactly one initial transition
     row, at most one witness produced.
6. **Partial witnessify success then commit failure** — must not be
   possible. If `witnessify_impl` cannot participate in the same DB
   transaction, the storage layer must implement a compensating
   sequence: produce the witness first against a staging marker, then
   commit CAW + transition + `produced_witness_id` together; on commit
   failure, the witness is invalidated through the existing
   `witnessify_impl` revoke/cleanup path. The visible invariant is the
   same: no CAW without its transition, no `produced_witness_id`
   without a live witness, no live RAE-produced depth-0 witness without
   a CAW.

The layer must not introduce any new "fifth state" to represent partial
failure. Failed admissions simply have no row.

---

## 7. RLS / service-role boundary

- The storage layer runs **only** under the Supabase service role.
- There is no end-user write path to `concept_assignment_witnesses` or
  `rae_state_transitions`. End users never call this layer directly.
- Existing RLS remains the public contract:
  - `caw_owner_read` — owners read their own CAWs.
  - `caw_admin_read` / `caw_admin_update` — admins read all and update
    (used by the future review-action entry point, not the
    initial-admission path).
  - `caw_service_role_all` — service role full access (used here).
  - `rae_state_transitions_owner_read`,
    `rae_state_transitions_admin_read`,
    `rae_state_transitions_service_role_*` — same shape.
- The storage layer must not relax, bypass, or duplicate any of these
  policies. It must not expose helpers that allow callers to write
  CAWs under a non-service-role identity.
- Witnessify handoff inherits the witnessify path's existing
  service-role posture; the storage layer does not alter it.

---

## 8. Back-annotation

When `policy_at_decision = "back_annotation"`:

- The CAW references an **existing** witness via `produced_witness_id`,
  supplied by the caller (typically a calibration/back-fill job).
- The storage layer must verify that the referenced
  `produced_witness_id` exists and that its `(user_id, source_table,
  source_row_id, candidate_concept_id)` tuple is consistent with the
  CAW being inserted. If not, the insert is rejected (no row written).
- The storage layer **never** triggers `witnessify_impl` under
  back-annotation. `witness_intent` for back-annotation is always
  `"none"` from the orchestrator's perspective; the witness already
  exists.
- `founder_review_flag` must be `true` on the persisted row, mirroring
  the orchestrator's invariant.
- The initial transition row is still inserted via `evaluateTransition`
  using the supplied `actor_kind`/`actor_id`/`reason`. Back-annotation
  is an audit event, not a state-machine bypass.

Back-annotation never creates new witness rows and never overwrites the
ancestry, confidence, or limitations of the referenced witness.

---

## 9. Tests required before implementation

The following test cases must exist (and pass) in the storage layer's
test suite before any orchestrator-facing call site is wired up. Tests
must use the existing RAE schema only; no schema changes are introduced
by this layer.

1. **Insert CAW, no witness** — `witness_intent = "none"`. Asserts:
   one CAW row, one transition row (`NULL → current_state`),
   `produced_witness_id IS NULL`, no rows added to witness tables.
2. **Insert CAW + witness_intent = produce_depth0_witness** — Asserts:
   one CAW row, one transition row, exactly one witness produced
   through `witnessify_impl`, `produced_witness_id` set to that
   witness, ancestry/limitations/confidence_basis invariants held by
   `witnessify_impl` are still satisfied.
3. **Idempotent duplicate returns existing** — Same orchestrator output
   submitted twice. Asserts: one CAW row total, one transition row
   total, at most one witness produced, second call returns mode
   `existing` with the original row.
4. **Transition row created exactly once** — Combination of cases 1–3.
   Asserts `count(rae_state_transitions WHERE caw_id = X) = 1` for any
   admitted CAW regardless of how many times the admission was
   submitted.
5. **Witnessify failure rolls back CAW** — `witnessify_impl` is forced
   to fail (e.g. simulated ancestry rejection). Asserts: zero CAW rows,
   zero transition rows, zero witness rows, error surfaced to caller.
6. **Produced_witness_id ancestry mismatch rejected** — Back-annotation
   case where the supplied `produced_witness_id` references a witness
   whose `(user_id, source_table, source_row_id, candidate_concept_id)`
   does not match the CAW. Asserts: insert rejected, zero rows written.
7. **Back_annotation references existing witness only** — Asserts:
   storage layer does not call `witnessify_impl`, the referenced
   witness row is unchanged (byte-for-byte equal pre and post),
   `founder_review_flag = true` on the new CAW, transition row present.
8. **No direct raw reasoning table writes** — Static or runtime check
   that the storage layer's code path performs no writes to reasoning
   surfaces (clusters, derived_patterns, patient_narratives,
   observation_packets beyond what `witnessify_impl` itself owns, etc.).
   The storage layer's allowed write set is exactly:
   `concept_assignment_witnesses`, `rae_state_transitions`, and
   whatever `witnessify_impl` writes through its approved path.

Existing suites that must continue to pass unchanged: all RAE core
tests (`types`, `stateMachine`, `scoring`, `signals/*`, `orchestrator`,
`spec_alignment`) and all P1a migration guard suites.

---

## 10. Non-goals

This design intentionally does not cover:

- Any edge function. The storage layer is a pure server-side module
  callable from a future edge function; no edge function is designed,
  named beyond boundary, or implemented here.
- Any calibration UI.
- Any RAE-facing HTTP API.
- Any signal evaluator changes.
- Any orchestrator changes.
- Any schema changes. If implementation reveals a need for a schema
  change, work stops and CodexOS is asked to approve a separate
  migration prompt before proceeding.
- Subsequent state transitions (`needs_review → human_confirmed`,
  `needs_review → rejected`, etc.) — handled by a later review-action
  entry point.
- Trajectory/depth-N witness composition.
- Any product/FHIR/external API framing.

---

Awaiting CodexOS review before storage implementation.