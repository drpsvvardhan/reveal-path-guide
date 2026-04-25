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

**CodexOS-approved revisions (post-review):**
1. `witnessify_impl` is a pure in-memory builder; the storage layer runs
   the entire admission inside a single Postgres transaction with no
   compensating sequence.
2. Back-annotation tuple verification is hard on
   `(user_id, source_table, source_row_id)` only; an
   `ontology_concept_id` mismatch is recorded as a `founder_review_flag`
   reason and a `limitations` entry, not a rejection.
3. The storage layer's allowed write set is closed and enumerated; all
   other tables (config, review queue, proposals, reasoning surfaces)
   are explicitly forbidden.
4. Initial-admission persistence and review-action transitions live in
   the same storage module behind two distinct entry points sharing
   private helpers.

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

A single admission persistence call is **one logical atomic unit**
executed inside **one Postgres transaction** that commits or rolls back
as a whole.

`witnessify_impl` is a pure in-memory builder: it returns a validated
`WitnessObject` value and performs no database I/O of its own. The
storage layer is therefore free to run the witness build step inline
within the same transaction that inserts the CAW and the transition,
then insert the witness row through the approved witnessify insert path
(the same call site `witnessify-observations` already uses) inside that
transaction. No two-phase commit, no staging marker, no compensation.

Per-call ordering inside the single transaction:

1. `BEGIN`.
2. **Idempotency probe.** Look up `concept_assignment_witnesses` by
   `caw_id`. If present, `COMMIT` (no-op) and return mode `existing`.
3. **Witness build (in-memory only)**, when
   `witness_intent = "produce_depth0_witness"`. Call `witnessify_impl`
   to obtain a `WitnessObject` value. If it returns a validation
   failure, raise and roll back; no CAW row is written.
4. **CAW insert** into `concept_assignment_witnesses`
   (`produced_witness_id = NULL` at this point).
5. **Transition insert** into `rae_state_transitions`
   (`from_state = NULL`, `to_state = current_state`), preceded by an
   in-process `evaluateTransition` check from `stateMachine.ts`.
6. **Witness row insert** through the approved witnessify insert path
   when intent was `produce_depth0_witness`. The
   `enforce_witness_ancestry_integrity` trigger fires inside this same
   transaction.
7. **CAW `produced_witness_id` backfill** with the inserted witness id,
   inside the same transaction. The
   `enforce_caw_ancestry_integrity` trigger fires here.
8. `COMMIT`.

If any step from 3 onward fails, the transaction rolls back: no CAW row,
no transition row, no witness row, no orphan `produced_witness_id`. No
partial admission can ever be observed.

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
  - Inside the same transaction, the layer calls `witnessify_impl`
    (a pure in-memory builder) to construct the `WitnessObject`,
    passing through:
    - `user_id`, `source_table`, `source_row_id`,
    - `candidate_concept_id`, `ontology_version`,
    - `engine_version_id`, `registry_seed_version`,
    - `confidence_value`, `confidence_basis`, `limitations`,
    - and any ancestry inputs `witnessify_impl` already requires.
  - The resulting `WitnessObject` is then inserted into
    `witness_objects` via the **approved witnessify insert path** —
    the same call site `witnessify-observations` already uses. The
    storage layer must not construct an `INSERT` against
    `witness_objects` itself; it must call the shared insert helper so
    that all P1a invariants and the ancestry trigger run identically.
  - On success, the storage layer backfills
    `concept_assignment_witnesses.produced_witness_id` with the
    inserted witness id, inside the same transaction.
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
6. **Partial witnessify success then commit failure** — not possible by
   construction. `witnessify_impl` is a pure in-memory builder and the
   `witness_objects` insert runs inside the same Postgres transaction
   as the CAW and transition inserts. Any failure rolls back all
   writes together. No staging marker, no revoke path, no compensating
   sequence is permitted.

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
- **Hard verification (rejects on mismatch):** the referenced witness
  must exist and its `(user_id, source_table, source_row_id)` tuple
  must equal the CAW's. Any of these failing causes the insert to be
  rejected with no row written. This is the minimal identity surface
  guaranteed by the existing P1a witness schema.
- **Soft verification (does not reject):** if the referenced witness
  carries a non-null `ontology_concept_id` and it does not equal the
  CAW's `candidate_concept_id`, the storage layer:
  - sets `founder_review_flag = true` on the CAW (already required for
    back-annotation, restated for clarity);
  - appends an entry to `limitations` of the form
    `"back_annotation_concept_drift: witness ontology_concept_id <X> != caw candidate_concept_id <Y>"`;
  - proceeds with the insert.
  Rationale: legacy P1a depth-0 witnesses predate uniform RAE concept
  identity. Hard rejection here would make back-annotation unusable
  against the very rows it exists to recontextualize.
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
8. **Closed write set enforced** — Static source scan over the storage
   module asserting no `INSERT`, `UPDATE`, `DELETE`, or `UPSERT` (and
   no `from('<table>').insert/update/delete/upsert` Supabase-client
   calls, and no raw SQL writes) targeting any table outside the
   closed allowed set:

   **Allowed (and only these):**
   - `concept_assignment_witnesses` — insert + `produced_witness_id`
     update only.
   - `rae_state_transitions` — insert only.
   - `witness_objects` — insert only, and only via the approved
     witnessify insert path (not a hand-written insert).

   **Explicitly forbidden** (the test enumerates these so future drift
   is caught):
   - RAE config/audit: `rae_engine_versions`, `rae_signal_config`,
     `rae_engine_concept_overrides`.
   - Review/proposal surfaces: `observation_review_queue`,
     `ontology_concept_proposals`, `review_queue_audit_log`.
   - Reasoning surfaces: `clusters`, `cluster_evidence`,
     `derived_patterns`, `patient_narratives`, `action_plans`,
     `terrain_renders`, `observation_packets`,
     `patient_lab_observations`, `patient_lab_uploads`.
   - Identity / auth surfaces: `profiles`, `user_roles`, anything in
     `auth.*`, `storage.*`, `realtime.*`, `vault.*`.

   Any write to a table not in the allowed set fails this test.

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
  `needs_review → rejected`, etc.) — handled by a separate
  review-action entry point in the **same** storage module (see §11);
  this design prompt covers only the initial-admission entry point's
  contract.
- Trajectory/depth-N witness composition.
- Any product/FHIR/external API framing.

---

## 11. Module shape: shared module, two entry points

The storage layer is one module (working name
`supabase/functions/_shared/rae/storage/admit.ts`) exposing two
functions, both running under the service role:

- `persistInitialAdmission(decision: AdmissionDecision): Promise<{
    mode: "created" | "existing";
    caw: ConceptAssignmentWitness;
  }>` — the contract designed in §§1–10 above.
- `applyReviewAction(request: { caw_id: string;
    transition: StateTransitionRequest;
    witness_intent: WitnessIntent;
  }): Promise<{ caw: ConceptAssignmentWitness }>` — declared here for
  shape only; full contract is the subject of a later prompt.

Both entry points share private helpers:
- transaction setup / teardown,
- `evaluateTransition` invocation and transition-row insert,
- the approved witnessify insert path,
- `produced_witness_id` backfill,
- the closed-write-set guard from §9.8 (one static scan covers both).

Shape constraints (binding on this design, not yet implementation):
- `applyReviewAction` requires the CAW row to already exist; it must
  reject if the row is missing rather than create one.
- `persistInitialAdmission` requires the CAW row to **not** exist for
  the deterministic `caw_id`; if it does, it returns `existing` per §3
  rather than mutating the row.
- `actor_kind = "human"` is allowed only in `applyReviewAction`;
  `persistInitialAdmission` always carries `actor_kind = "engine"`.
- Neither entry point ever introduces a fifth admission state.

---

Awaiting CodexOS review before storage implementation.