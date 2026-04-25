# RAE Orchestrator Design v1

Status: design only — no code, no SQL, no schema changes.
Controlling specs: `docs/RAE_DESIGN_v1.md`, `docs/RAE_IMPLEMENTATION_PLAN_v1.md`.
Controlling contracts: `supabase/functions/_shared/rae/types.ts`,
`supabase/functions/_shared/rae/scoring.ts`,
`supabase/functions/_shared/rae/stateMachine.ts`,
`supabase/functions/_shared/rae/signals/*`.

The orchestrator is the only RAE component that knows how to assemble a
`ConceptAssignmentWitnessDraft` (CAW) from raw inputs. Signal evaluators,
state machine, and scoring stay pure; the orchestrator is the seam where
config, claim, ontology, history, and policy meet.

---

## 1. Purpose

The orchestrator converts **one** `RawObservationClaim` plus **one**
candidate ontology concept into **one** `ConceptAssignmentWitnessDraft`.

It does **not** construct a witness payload. Witness construction
remains the responsibility of the existing P1a witnessify discipline.
The orchestrator's only output beyond the CAW draft is a discrete
**`witness_intent`** signal that tells the downstream layer whether a
depth-0 witness should be minted from this admission:

- `witness_intent = "produce_depth0_witness"` — when `current_state =
  auto_admitted` AND `policy_at_decision = "default"`.
- `witness_intent = "none"` — in every other case.

The orchestrator never invents witness IDs, never builds witness shape,
and never writes to `witness_objects`.

Out of scope for the orchestrator itself:
- Selecting which candidate concept to evaluate (caller's job, e.g. a
  candidate-generation step using the ontology).
- Persisting the CAW or the witness (handled by storage layer, separate
  prompt).
- Emitting state transitions (the state machine returns the next state;
  persistence of `rae_state_transitions` rows is the storage layer's job).
- Any UI, queueing, or notification.

The orchestrator is **pure with respect to its inputs**: given identical
inputs, it returns an identical CAW draft (see §8 Idempotency).

---

## 2. Inputs

The orchestrator accepts a single structured input bundle:

1. **`claim: RawObservationClaim`** — see `types.ts §5`. Source-table-
   agnostic shape: `source_table`, `source_row_id`, `user_id`, `raw_name`,
   `raw_unit`, `raw_value`, `raw_method`, `raw_reference_low`,
   `raw_reference_high`, `observed_at`, `panel_grouping_key`.
2. **`candidate_concept`** — the ontology concept being adjudicated:
   - `concept_id`
   - `canonical_name`, `synonyms[]`
   - `canonical_unit`, `unit_conversions` (map of received-unit → factor +
     conversion_id)
   - `plausibility_band` `{low, high}` in canonical units
   - `known_assays[]`, `method_optional`
   - `canonical_reference_range` `{low, high}`
   - `expected_panel_concept_ids[]`, `panel_id`
   - `dynamics_rule_id`, `delta_ceiling`
3. **`signal_config`** — the matching `rae_signal_config` row for this
   `engine_version_id` (and optional per-concept override): the seven
   signal weights, fuzzy / edge / ref-range tolerances, panel partial
   floor, longitudinal `min_history`, and the `composite_threshold`
   (admission) plus `rejection_floor`.
4. **`engine_version: EngineVersionConfig`** — `engine_version_id`,
   `semver`, `registry_seed_version`, `ontology_version`,
   `threshold_admission`, `threshold_rejection_floor`, `calibration_mode`.
5. **`siblings: PanelSibling[]`** — co-observations sharing
   `claim.panel_grouping_key`, each `{observation_id, concept_id}`. Caller
   resolves sibling concept_ids to whatever stable identifier the ontology
   uses; orchestrator does not re-resolve.
6. **`prior_observations: PriorObservation[]`** — prior admitted witnesses
   (or raw observations, when no witness exists yet) for the same
   `(user_id, candidate_concept.concept_id)`, each
   `{witness_id, value, observed_at}` in canonical units.

The orchestrator never reads from `cie_*`, narrative, terrain, or any
reasoning surface. It never reads from `witness_objects` directly — the
caller pre-loads `prior_observations`.

---

## 3. Exact Call Order

Given the input bundle, the orchestrator executes the following steps in
exactly this order. Any failure short-circuits per §9.

1. **Validate inputs.** Shape-check `claim`, `candidate_concept`,
   `signal_config`, `engine_version`. Malformed → `MalformedClaimError`
   (§9). Missing `signal_config` for this `engine_version_id` →
   `RegistryGapError` (§9). Missing `candidate_concept` →
   `NoCandidateConceptError` (§9).
2. **Compute deterministic `caw_id`** per §4. Used for idempotency and
   downstream persistence — **not** for short-circuiting in the
   orchestrator itself (the storage layer enforces "do not overwrite";
   see §8).
3. **Run the seven signals**, in `SIGNAL_IDS` order, with weights pulled
   from `signal_config`:
   1. `evaluateLexical`
   2. `evaluateUnit`
   3. `evaluateValue` (uses `unit_normalized_value` derived from step 2)
   4. `evaluateMethod`
   5. `evaluateRefRange`
   6. `evaluatePanel`
   7. `evaluateLongitudinal`
   Each returns a `SignalResult`. Order is fixed and matches both
   `SIGNAL_IDS` and the schema's array-length-7 constraint.
4. **Validate `signal_results` shape** via the existing
   `validateSignalResultsShape` from `scoring.ts`. Length must be 7 and
   ordering must equal `SIGNAL_IDS`. Failure → `InvalidSignalShapeError`
   (§9). This is the last point at which the orchestrator can detect a
   contract drift between evaluators and schema.
5. **Compute `composite_identity_score`** via `scoring.ts`'s identity
   scorer over the six identity signals (`IDENTITY_SIGNAL_IDS`) using
   the abstention-aware denominator already implemented.
6. **Apply the longitudinal gate.** Read the `longitudinal` `SignalResult`.
   If `band === "fail"`, the coherence gate is tripped: regardless of
   `composite_identity_score`, the candidate state is forced to
   `needs_review` (never `auto_admitted`, never `rejected` by engine).
7. **Apply calibration policy.** If
   `engine_version.calibration_mode === true`, set
   `policy_at_decision = "calibration_all_routes_to_review"` and force
   the candidate state to `needs_review` regardless of score or gate
   outcome. Otherwise `policy_at_decision = "default"`. (The third
   policy value, `"back_annotation"`, is never produced by the initial
   orchestrator; it is reserved for the back-annotation path described
   in CodexOS OQ-6 and is set by that flow, not here.)
8. **Decide engine state.** Using `scoring.ts`'s `decideState` (or the
   equivalent already exported), with inputs `(composite_identity_score,
   coherence_result, threshold_admission, threshold_rejection_floor,
   policy_at_decision)`. The result is one of `auto_admitted`,
   `needs_review`, `rejected`. Engine never produces `human_confirmed`
   (state-machine constraint).
9. **Build CAW draft** per §6.
10. **Decide `witness_intent`** per §7. The orchestrator returns a
    discrete intent (`"produce_depth0_witness"` | `"none"`); it does
    **not** build a witness payload. `produced_witness_id` on the CAW
    draft is always `null` at the orchestrator boundary — the witness
    layer (P1a witnessify) back-fills it after minting.
11. **Return `AdmissionDecision`** `{caw, witness_intent}` (witness
    construction, row insertion, FK linking, and CAW persistence are
    downstream-layer concerns).

The orchestrator does not call the state machine directly on this initial
pass — the state machine governs **transitions** between persisted CAW
states. The first persistence of a CAW with `current_state = X` is a
`null → X` transition that the storage layer will record. The orchestrator
supplies the `(actor_kind, actor_id, reason)` tuple that the storage layer
passes to `applyTransition`.

---

## 4. Deterministic `caw_id` Strategy

`caw_id` is a UUIDv5 computed from the tuple:

```
(user_id, source_table, source_row_id, candidate_concept_id, engine_version_id)
```

- Namespace: a dedicated **RAE CAW namespace UUID**, distinct from the
  P1a witness namespace. Reusing P1a's namespace is forbidden — CAWs and
  biological witnesses are different objects with different lifecycles.
- Field order is fixed and must match the schema's deterministic-ID
  generator (already established in the
  `rae_concept_assignment_witnesses` migration).
- A bump in `engine_version_id` produces a new `caw_id` for the same
  claim/concept pair. This is intentional: each engine version
  re-adjudicates and the audit trail keeps both decisions.
- `produced_witness_id`, when set, is generated independently by the
  witness-production layer and stored as an FK to `witness_objects`.
  The orchestrator does not invent witness IDs.

---

## 5. Signal Input Mapping

For each signal, the orchestrator constructs the evaluator input from
`claim`, `candidate_concept`, and `signal_config`. Below, `cfg.<signal>`
denotes the per-signal section of `signal_config`.

### lexical
- `raw_name` ← `claim.raw_name`
- `canonical_name` ← `candidate_concept.canonical_name`
- `synonyms` ← `candidate_concept.synonyms`
- `ambiguous_alternatives` ← caller-supplied list of other concepts that also matched in candidate generation (may be empty)
- `weight` ← `cfg.lexical.weight`
- `fuzzy_ceiling` ← `cfg.lexical.fuzzy_ceiling`

### unit
- `raw_unit` ← `claim.raw_unit`
- `canonical_unit` ← `candidate_concept.canonical_unit`
- `conversions` ← `candidate_concept.unit_conversions`
- `weight` ← `cfg.unit.weight`

### value
- `raw_value` ← `claim.raw_value`
- `unit_normalized_value` ← derived: if unit eval matched canonical, `claim.raw_value`; if conversion applied, `claim.raw_value * conversion.factor`; else `null`
- `plausibility_band` ← `candidate_concept.plausibility_band`
- `edge_tolerance` ← `cfg.value.edge_tolerance`
- `weight` ← `cfg.value.weight`

### method
- `raw_method` ← `claim.raw_method`
- `known_assays` ← `candidate_concept.known_assays`
- `method_optional` ← `candidate_concept.method_optional`
- `weight` ← `cfg.method.weight`

### ref_range
- `received_low` ← `claim.raw_reference_low`
- `received_high` ← `claim.raw_reference_high`
- `canonical_range` ← `candidate_concept.canonical_reference_range`
- `tolerance` ← `cfg.ref_range.tolerance`
- `weight` ← `cfg.ref_range.weight`

### panel
- `panel_grouping_key` ← `claim.panel_grouping_key`
- `siblings` ← input `siblings[]`
- `expected_panel_concept_ids` ← `candidate_concept.expected_panel_concept_ids`
- `panel_id` ← `candidate_concept.panel_id`
- `weight` ← `cfg.panel.weight`

### longitudinal
- `current_value` ← unit-normalized value from value-step input
- `current_observed_at` ← `claim.observed_at`
- `prior_observations` ← input `prior_observations[]`
- `delta_ceiling` ← `candidate_concept.delta_ceiling`
- `dynamics_rule_id` ← `candidate_concept.dynamics_rule_id`
- `min_history` ← `cfg.longitudinal.min_history`
- `weight` ← `cfg.longitudinal.weight`

The unit-normalized value is computed **once** by the orchestrator from
the unit evaluator's evidence and reused by both `value` and
`longitudinal`. Evaluators remain pure; the orchestrator is the only seam
that performs this small derivation.

---

## 6. CAW Construction

- `caw_id` — §4 deterministic UUIDv5.
- `user_id` — `claim.user_id`.
- `source_table` — `claim.source_table`.
- `source_row_id` — `claim.source_row_id`.
- `candidate_concept_id` — `candidate_concept.concept_id`.
- `ontology_version` — `engine_version.ontology_version`.
- `registry_seed_version` — `engine_version.registry_seed_version`.
- `engine_version_id` — `engine_version.engine_version_id`.
- `current_state` — §3 step 8 (post-gate, post-policy).
- `current_state_actor_kind` — `"engine"` (initial pass).
- `current_state_actor_id` — `engine_version.engine_version_id`.
- `signal_results` — length-7 array in `SIGNAL_IDS` order.
- `composite_identity_score` — §3 step 5.
- `coherence_result` — `signal_results[longitudinal].band`.
- `confidence_value` — `composite_identity_score` clamped to `[0,1]`.
- `confidence_basis` — deterministic ≥20-char string composed by the
  orchestrator from: `engine_version.semver`, identity score, coherence
  band, top-2 contributing signals (by weight × score). Mirrors P1a
  `confidence_basis_meaningful` guard.
- `limitations` — non-empty string array (mirrors P1a
  `witness_objects_limitations_nonempty`). Always includes the active
  policy. Adds entries for: every signal with `band === "abstain"` (one
  per signal_id), `coherence_result === "fail"`, calibration mode active,
  and the back-annotation flag if applicable. No blank entries.
- `policy_at_decision` — §3 step 7.
- `founder_review_flag` — `true` iff
  `current_state === "needs_review"` OR
  `policy_at_decision === "back_annotation"`. Otherwise `false`.
  All `needs_review` CAWs require founder review, not just the subset
  triggered by longitudinal gate failure.
- `produced_witness_id` — always `null` at the orchestrator boundary;
  back-filled by the witness layer when `witness_intent =
  "produce_depth0_witness"`. See §7.

`current_state_entered_at`, `created_at`, `updated_at` are storage-layer
concerns and are not part of the orchestrator's draft.

---

## 7. Witness Production Boundary

Witness-production decision rules:

- `current_state = auto_admitted` AND `policy = default` → **witness produced** (orchestrator emits a witness payload for the storage layer to insert into `witness_objects`).
- `current_state = auto_admitted` AND `policy = calibration_all_routes_to_review` → **not reachable** — calibration forces `needs_review` (§3 step 7).
- `current_state = auto_admitted` AND `policy = back_annotation` → **no witness on this pass** — back-annotation references an existing witness separately and never mints a new one in this orchestrator.
- `current_state = needs_review` (any policy) → **no witness**.
- `current_state = rejected` (any policy) → **no witness**.
- `current_state = human_confirmed` → **not reachable** by initial orchestrator (engine cannot produce `human_confirmed`); witness production for human confirmation is the calibration review flow's responsibility.

When witness is produced:
- The witness payload is constructed by the orchestrator from the same
  unit-normalized value, evidence, and limitations used in the CAW.
- The witness is FK'd to the CAW via
  `concept_assignment_witnesses.produced_witness_id` (hard FK already in
  schema, OQ-2).
- The witness's `signal_provenance` references the seven `SignalResult`
  evidence blocks verbatim.

`produced_witness_id` on the CAW is `null` until the storage layer
inserts the witness and back-fills the FK in the same transaction. The
orchestrator returns a draft witness object **alongside** the CAW so the
storage layer can perform that two-row insert atomically.

---

## 8. Idempotency

- For a fixed `(user_id, source_table, source_row_id,
  candidate_concept_id, engine_version_id)`, the orchestrator always
  computes the same `caw_id` (§4) and, given identical inputs, the same
  CAW draft.
- The storage layer enforces non-overwrite: if a CAW with that `caw_id`
  already exists, the new draft is discarded and the existing row is
  returned. The orchestrator itself is stateless and does not check
  existence — that check belongs to storage so the orchestrator stays
  pure and testable.
- A bump in `engine_version_id` produces a different `caw_id` and
  therefore a new row. The two CAWs coexist; nothing is mutated. This is
  how the audit trail captures engine evolution.
- A change to `signal_config` **without** an engine-version bump is a
  contract violation (signal config is immutable per engine version).
  The orchestrator does not detect this — schema-level immutability or a
  CI check enforces it. Listed here as an assumption.

---

## 9. Error Modes

All errors are typed and surfaced to the caller; none are swallowed.

- **`MalformedClaimError`** — `claim` fails shape validation (missing
  `user_id`, `raw_name`, `observed_at`, etc.). **No CAW produced.**
  Caller decides whether to drop the row or queue for human inspection.
- **`NoCandidateConceptError`** — candidate generation produced nothing.
  **No CAW produced.** This is upstream of RAE; the orchestrator refuses
  to invent a concept.
- **`RegistryGapError`** — `signal_config` row missing for the active
  `engine_version_id` (or the per-concept override expected but not
  present). **No CAW produced.** Distinct from `rejected` — a registry
  gap is an engine-side fault, not evidence against the claim. CodexOS
  OQ-4 requires this distinction.
- **`InvalidSignalShapeError`** — `validateSignalResultsShape` fails
  after evaluator pass (e.g., evaluator returned wrong `signal_id` or
  wrong band literal). **No CAW produced.** Indicates a code/contract
  drift; alert audit.
- **`UnitNormalizationError`** — unit evaluator returned `partial` with a
  `conversion_id` but the conversion factor is missing/non-finite. **No
  CAW produced.** Treated as registry gap.

Errors are never represented as a fifth admission state. They are
orthogonal to the four locked states.

---

## 10. Tests Required Before Code

Before the orchestrator is implemented, the following test specifications
must be written and reviewed (test files only — implementation comes
after):

1. **HbA1c happy path.** Canonical unit `%`, value 5.6, exact lexical
   match, HPLC method in known assays, ref range matches, diabetes panel
   complete, prior 5.5 within delta ceiling → `current_state =
   auto_admitted`, `policy_at_decision = "default"`, witness produced,
   `founder_review_flag = false`.
2. **HbA1c calibration mode routes to needs_review.** Same inputs as
   test 1 but `engine_version.calibration_mode = true` →
   `current_state = needs_review`, `policy_at_decision =
   "calibration_all_routes_to_review"`, **no witness produced**, all
   identity signals still recorded with their original bands.
3. **Longitudinal fail forces needs_review.** HbA1c jumps 5.6 → 12.0
   exceeding `delta_ceiling = 1.5` → coherence gate trips,
   `coherence_result = "fail"`, `current_state = needs_review` regardless
   of identity score, `founder_review_flag = true`, no witness.
4. **Missing config produces RegistryGapError, not rejected.**
   `signal_config` lookup returns null → orchestrator throws
   `RegistryGapError`; **no CAW row is constructed**, no `rejected`
   state is emitted. (Confirms CodexOS OQ-4 distinction.)
5. **Repeated call idempotent.** Two invocations with identical inputs
   yield byte-identical CAW drafts and identical `caw_id`. Bumping
   `engine_version_id` yields a different `caw_id` with the same
   content otherwise.
6. **No imports from reasoning surfaces.** Source-level guard (parallel
   to `spec_alignment.test.ts`) asserting the orchestrator file imports
   only from `../types.ts`, `../scoring.ts`, `../stateMachine.ts`, and
   `../signals/*`. No `cie_*`, no narrative, no terrain, no
   `witness_objects` direct read.

Additional coverage expected (not blocking review): unit-conversion
partial path, panel partial path, ambiguous lexical alternatives recorded
in evidence, abstention-only-signals path producing `needs_review`
(consistent with `scoring.ts`'s `review_no_evidence`).

---

## 11. Non-Goals

The orchestrator design intentionally does **not** cover:

- DB implementation details (DDL, RLS, triggers, indexes, transaction
  boundaries).
- Edge function packaging (HTTP handler, auth, JSON envelope, retries).
  The orchestrator is a pure function; an edge function will wrap it
  later under a separate prompt.
- Calibration review UI (the human queue that walks reviewers through
  `needs_review` CAWs).
- A public RAE API surface.
- Trajectory witness design (longitudinal witness composition is a
  separate Phase-2 design).
- Any change to P1a surfaces (`witness_objects`,
  `witness_signal_registry`, narrative, terrain, action plan, ask-
  anything, patient-chat). The boundary is one-way: P1a feeds RAE via
  ontology and consumes RAE's produced witnesses; RAE never reads from
  reasoning surfaces.

---

## Hard Constraints (re-stated for review)

- No SQL in this document.
- No code in this document.
- No schema changes.
- No edge function design beyond naming the boundary ("a future edge
  function will wrap the orchestrator").
- No external product/API framing.
- No FHIR.
- No imports from reasoning surfaces.
- No fifth admission state. The four locked states (`auto_admitted`,
  `needs_review`, `rejected`, `human_confirmed`) are the only values
  the orchestrator reasons about.

---

Awaiting CodexOS review before orchestrator implementation.
