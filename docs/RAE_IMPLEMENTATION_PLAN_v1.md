# RAE Implementation Plan v1 — Proposal Only

*Companion to `docs/RAE_DESIGN_v1.md` (constitutional spec) and
`docs/P1A_STATE_SNAPSHOT.md` (substrate state). Governed by Patient Reveal
THESIS v4.2.*

**Status:** Approved by CodexOS for schema implementation. Three
corrections from the CodexOS review have been applied: (1)
back-annotation does not introduce a fifth admission state; (2) RAE
signal config lives in a sibling table `rae_signal_config`, not as an
extension of `witness_signal_registry`; (3) CAW naming is fixed —
conceptual object `concept_assignment_witness` (singular), table
`public.concept_assignment_witnesses` (plural). All eight open
questions are resolved (§13).
**Scope:** Translate the RAE Design v1 spec into a concrete implementation
plan: storage objects, type contracts, migrations, tests, and the VV-001
calibration flow for the 923 unwitnessed observations.
**Out of scope (binding):** writing schema, writing migrations, writing
edge functions, writing types, changing reasoning surfaces, designing
trajectory witnesses, designing intervention/protocol witnesses,
RAE-as-a-service framing.

**Core rule:** RAE admits biological reality into computation. It does
not reason after admission. Every section below must be testable against
that rule.

---

## 0. Summary of files this plan proposes to create or change

No file is created or changed by *this* plan. The list below is the
proposal of what the *implementation thread* — opened only after
CodexOS approval — would create.

### 0.1 Migrations (proposed; not authored)

1. `supabase/migrations/<TS>_rae_concept_assignment_witness.sql`
   — creates `public.concept_assignment_witnesses`, the
   `public.rae_admission_state` enum, indexes, RLS, and the ancestry
   integrity trigger that mirrors `enforce_witness_ancestry_integrity`.
2. `supabase/migrations/<TS>_rae_state_transitions.sql`
   — creates `public.rae_state_transitions` (append-only audit log of
   every state change with actor, timestamp, prior state, new state,
   reason).
3. `supabase/migrations/<TS>_rae_signal_config.sql`
   — creates `public.rae_signal_config`, a **sibling** table to
   `public.witness_signal_registry`. Holds RAE-specific per-concept
   band parameters: synonyms, unit conversions, plausibility bands,
   known assay methods, reference-range catalogs, panel associations,
   longitudinal dynamics ceilings, and per-signal weights.
   `witness_signal_registry` is **not modified**. Rationale: keeps the
   P1a witness registry stable and preserves RAE extractability
   (spec §10.2). Resolves OQ-3.
4. `supabase/migrations/<TS>_rae_engine_versions.sql`
   — creates `public.rae_engine_versions` (engine version metadata:
   id, semver, registry_seed_version, ontology_version, threshold
   parameters, calibration_mode flag, activated_at).
5. *No separate back-annotation migration.* Per OQ-6 resolution,
   back-annotation is represented entirely via existing CAW columns:
   `policy_at_decision = 'back_annotation'`, the `produced_witness_id`
   fk pointing at the pre-existing witness, a `limitations` entry
   naming the grandfather status, and (where divergent) the
   `founder_review_flag` boolean (§1.1). No new state, no new linkage
   column, no schema change to `witness_objects`.

### 0.2 Edge functions (proposed; not authored)

1. `supabase/functions/rae-admit-claim/index.ts`
   — single entry point. Input: one or many raw observation rows
   (claims). Output: structured admission decisions. Writes to
   `concept_assignment_witnesses`; on `auto_admitted` or
   `human_confirmed`, writes a depth-0 `witness_objects` row through
   the existing P1a witnessify path. Never writes to
   `witness_objects` for `needs_review` or `rejected`.
2. `supabase/functions/rae-calibration-review/index.ts`
   — admin-only. Lists pending `needs_review` rows for the founder,
   accepts a disposition (confirm / reject / correct concept), records
   the state transition, and writes the resulting witness when
   confirmed.
3. `supabase/functions/rae-backfill-923/index.ts`
   — idempotent. Iterates all `patient_lab_observations` for VV-001
   (and only VV-001 in v1) where the row has not yet produced a
   `concept_assignment_witness` for the active engine version.
   Mirrors the Pattern Z idempotency discipline of
   `witnessify-observations`.

### 0.3 Shared modules (proposed; not authored)

1. `supabase/functions/_shared/rae/types.ts` — TypeScript contracts
   (§7 below).
2. `supabase/functions/_shared/rae/signals/` — one file per signal
   (`lexical.ts`, `unit.ts`, `value.ts`, `method.ts`, `refRange.ts`,
   `panel.ts`, `longitudinal.ts`), each exporting a pure function with
   the same return shape (§5 below).
3. `supabase/functions/_shared/rae/scoring.ts` — composite scoring,
   abstention-aware denominator, threshold comparison.
4. `supabase/functions/_shared/rae/stateMachine.ts` — encoded
   transitions and forbidden transitions from spec §6.2 / §6.3.
5. `supabase/functions/_shared/rae/admit.ts` — orchestrator: load
   candidate concept(s) from ontology, run signals, score, decide
   state, emit `ConceptAssignmentWitnessDraft`.

### 0.4 Tests (proposed; not authored)

See §8 below. All tests live alongside the modules they cover.

### 0.5 Docs (proposed; not authored beyond this file)

1. `docs/RAE_IMPLEMENTATION_PLAN_v1.md` — *this file*.
2. `docs/RAE_CALIBRATION_RUNBOOK_v1.md` — to be authored alongside the
   calibration edge function. Covers the operational loop in §9.

---

## 1. Storage object: `concept_assignment_witness`

### 1.1 Proposed table — `public.concept_assignment_witnesses`

**Naming convention (binding).** The conceptual object is
`concept_assignment_witness` (singular). The Postgres table is
`public.concept_assignment_witnesses` (plural). All docs, migrations,
TypeScript types (`ConceptAssignmentWitness`,
`ConceptAssignmentWitnessDraft`), edge functions, and tests use
exactly these two forms. The short identifier `caw_id` is permitted
only as a column or local variable name — never as a table, type, or
module name. No abbreviations (`caw_table`, `assignment_witness`,
`concept_witness`) are introduced.

Single table. Append-mostly. State changes are recorded by updating the
row's `current_state` column **and** appending a row to
`rae_state_transitions` (§3). The CAW row is the current view; the
transitions table is the audit chain.

**Proposed columns (prose; SQL deferred):**

| Field | Purpose |
|---|---|
| `id` (uuid, pk) | Surrogate id. |
| `caw_id` (uuid, deterministic UUIDv5) | Stable id derived from `(user_id, source_table, source_row_id, candidate_concept_id, engine_version_id)`. Same input → same id, mirroring the P1a namespace discipline (Fix 2 in P1a snapshot). Namespace UUID is a new constant, never reused from P1a's namespace. |
| `user_id` (uuid) | Patient. Cross-user ancestry forbidden (mirrors `enforce_witness_ancestry_integrity`). |
| `source_table` (text) | The ingestion table the claim came from (e.g., `patient_lab_observations`). |
| `source_row_id` (uuid) | The raw observation row id. |
| `candidate_concept_id` (text) | The ontology concept proposed for adjudication. |
| `ontology_version` (text) | The ontology version under which adjudication ran. |
| `registry_seed_version` (text) | Mirrors P1a `witness_objects.registry_seed_version`. |
| `engine_version_id` (uuid, fk → `rae_engine_versions`) | Which RAE engine version produced this CAW. |
| `current_state` (`rae_admission_state` enum) | One of `auto_admitted`, `needs_review`, `rejected`, `human_confirmed`. |
| `current_state_entered_at` (timestamptz) | When `current_state` was entered. |
| `current_state_actor_kind` (text) | `engine` or `human`. |
| `current_state_actor_id` (text/uuid) | Engine version id when `engine`; auth user id when `human`. |
| `signal_results` (jsonb) | Array of seven `SignalResult` objects (§5). Frozen at admission time; not mutated. |
| `composite_identity_score` (numeric) | Weighted sum across signals 1–6 with abstention-aware denominator. |
| `coherence_result` (text) | `pass` / `fail` / `partial` / `abstain`, from signal 7. |
| `confidence_value` (numeric, [0,1]) | Engine confidence. |
| `confidence_basis` (text, ≥ 20 chars) | Mirrors the P1a `confidence_basis_meaningful` invariant. |
| `limitations` (text[], ≥ 1 entry, no blanks) | Mirrors P1a `witness_objects_limitations_nonempty`. |
| `produced_witness_id` (uuid, nullable, fk → `witness_objects.witness_id`) | Set when state ∈ {`auto_admitted`, `human_confirmed`} and a biological witness was produced. NULL otherwise. |
| `policy_at_decision` (text) | One of `default`, `calibration_all_routes_to_review`, `back_annotation`. Records the operational policy in force when the decision was made (spec §6.4 + OQ-6). |
| `founder_review_flag` (boolean, default `false`) | Raised when the CAW requires explicit founder attention without changing its admission state. Used in particular for back-annotated CAWs whose engine disposition diverges from the grandfathered witness (OQ-6). Not a substitute for the four admission states. |
| `created_at`, `updated_at` (timestamptz) | Standard. |

**Check constraints (proposed):**

- `caw_limitations_nonempty` — ≥ 1 entry, no blank strings.
- `caw_confidence_basis_meaningful` — length ≥ 20.
- `caw_confidence_value_range` — `confidence_value ∈ [0,1]`.
- `caw_state_witness_consistency` — `produced_witness_id IS NOT NULL`
  iff `current_state IN ('auto_admitted','human_confirmed')`.
- `caw_actor_kind_valid` — `current_state_actor_kind IN ('engine','human')`.
- `caw_human_states_require_human_actor` — when
  `current_state = 'human_confirmed'`, `current_state_actor_kind = 'human'`.
- `caw_signal_results_seven` — `jsonb_array_length(signal_results) = 7`.
- `caw_policy_at_decision_valid` — `policy_at_decision IN ('default','calibration_all_routes_to_review','back_annotation')`.
- `caw_back_annotation_requires_witness` — when `policy_at_decision = 'back_annotation'`, `produced_witness_id IS NOT NULL` (back-annotation always points at a pre-existing witness; OQ-6).
- `caw_back_annotation_state_valid` — when `policy_at_decision = 'back_annotation'`, `current_state IN ('auto_admitted','human_confirmed','rejected')` (no admission state outside the locked four; divergent dispositions are carried by `founder_review_flag`, not by a new state).

**Trigger (proposed):**

- `enforce_caw_ancestry_integrity` — refuses any `produced_witness_id`
  whose `witness_objects.user_id` differs from the CAW `user_id`.

**RLS (proposed):**

- `select` for the owning user (`auth.uid() = user_id`).
- `select` / `update` for users with `has_role(auth.uid(), 'admin')`
  (founder is an admin in P1b).
- All writes from edge functions pass the service role; no end-user
  insert path.

### 1.2 Linkage rules (mirrors spec §4.2)

| Link | Mechanism |
|---|---|
| → raw observation | `(source_table, source_row_id)` pair. Agnostic to ingestion table. |
| → biological witness | `produced_witness_id` (nullable). Always NULL for `needs_review`, `rejected`. Always set for `auto_admitted`, `human_confirmed`. |
| → user/patient | `user_id`. Cross-user ancestry forbidden by trigger. |
| → ontology concept | `(candidate_concept_id, ontology_version)`. Validated at write time against the active ontology snapshot. |
| → engine version | `engine_version_id` fk into `rae_engine_versions`. Old CAWs remain auditable under their original engine. |

### 1.3 Independent existence

Held and rejected claims still produce a CAW. This is what makes the
923's failure modes auditable instead of silent — the same property
that motivates the spec (§3.4, §4.2). The check constraint
`caw_state_witness_consistency` enforces that this independence is
not violated by writing a witness for a non-admitted state.

---

## 2. Composition with the P1a `witness_objects` table

No schema change to `witness_objects`. Composition is one-way:

- A CAW in state `auto_admitted` or `human_confirmed` writes a
  depth-0 `witness_objects` row through the existing
  `witnessify_impl.ts` discipline. The witness's `source_table` and
  `source_row_id` continue to point at the raw observation; a new
  optional column on `witness_objects` is **not** proposed (avoids
  schema churn). The link is recovered by querying CAWs with
  `produced_witness_id = wo.witness_id`.
- The CAW's `limitations` array is **merged** into the witness's
  `limitations` array at witness construction. Spec §4.3 requires the
  biological witness to inherit concept-assignment limitations as
  ancestry. Merge is union, deduplicated, preserving CAW-origin first.
- The witness's `confidence_basis` is composed from the CAW's
  `confidence_basis` plus the engine version. The P1a
  `confidence_basis_meaningful` invariant remains satisfied.

The 92 grandfathered witnesses are untouched at this layer; their
treatment is in §9.

---

## 3. Admission states and transitions

### 3.1 Enum — `public.rae_admission_state`

Values: `auto_admitted`, `needs_review`, `rejected`, `human_confirmed`.

### 3.2 Append-only transitions table — `public.rae_state_transitions`

| Field | Purpose |
|---|---|
| `id` (uuid, pk) | |
| `caw_id` (uuid, fk → `concept_assignment_witnesses.caw_id`) | |
| `from_state` (`rae_admission_state`, nullable) | NULL for the initial transition. |
| `to_state` (`rae_admission_state`) | |
| `actor_kind` (text) | `engine` or `human`. |
| `actor_id` (text) | Engine version id or auth user id. |
| `reason` (text, ≥ 10 chars) | Free text justification (e.g., "founder confirmed during VV-001 calibration"). |
| `policy` (text) | `calibration_all_routes_to_review` / `default` / future. |
| `created_at` (timestamptz) | |

**Allowed transitions (encoded in `stateMachine.ts`):** mirror spec §6.2
verbatim. The encoded set is the only set the orchestrator permits;
transitions outside the set are runtime errors.

**Forbidden transitions (encoded as runtime errors in
`stateMachine.ts`, mirroring spec §6.3):**

- `auto_admitted → rejected` directly.
- `human_confirmed → auto_admitted`.
- `human_confirmed → rejected` by `actor_kind = 'engine'`.
- Any transition without `actor_kind`, `actor_id`, `reason`.

#### Sanctioned tightening of spec §6.2

Spec §6.2 permits an engine-driven `rejected → auto_admitted` transition
when a registry change is judged sufficient to overturn the prior
rejection. The v1 implementation does not encode this edge: `stateMachine.ts`
omits it from the allowed set, so any attempt is a runtime error. The
rationale is alignment with drift D in spec §12.4 — engine-driven
graduation without founder review is the exact failure mode the
drift-mitigation discipline forbids. As a consequence, every path out
of `rejected` in v1 requires a human actor (`actor_kind = 'human'`),
typically via the calibration review surface. This tightening is
founder-sanctioned and will be revisited if registry-driven re-admission
ever becomes a real workflow that justifies the audit complexity.

### 3.3 Calibration mode policy

`rae_engine_versions.calibration_mode` (boolean) gates the orchestrator's
routing. When `true`, every claim that would have been `auto_admitted`
is routed instead to `needs_review` with `policy =
'calibration_all_routes_to_review'`. Lifting the policy for a concept
is a per-concept config change (proposed: per-concept override field
on `rae_engine_versions`) — see open question OQ-5.

---

## 4. Seven triangulation signal result shape

### 4.1 Common return type

Every signal returns the same shape so `signal_results` is a
homogeneous array of seven objects.

```ts
type SignalBand = "pass" | "fail" | "partial" | "abstain";

interface SignalResult {
  signal_id:
    | "lexical"
    | "unit"
    | "value"
    | "method"
    | "ref_range"
    | "panel"
    | "longitudinal";
  band: SignalBand;
  score: number;          // [0,1]; 0 when abstain or fail; partial in (0,1)
  weight: number;         // registry-declared; copied in for audit
  contributes_to_denominator: boolean; // false when band === 'abstain'
  evidence: SignalEvidence; // discriminated union, one variant per signal
  notes: string[];        // human-readable notes; sources of any limitation
}
```

`SignalEvidence` is a discriminated union with one variant per signal,
each carrying the structured evidence the spec §5.2–§5.8 enumerates.
Examples (prose, not exhaustive):

| Signal | Evidence variant fields |
|---|---|
| lexical | `matched_name`, `match_type` (`exact`/`synonym`/`fuzzy`), `distance?`, `ambiguous_alternatives?` |
| unit | `received_unit`, `canonical_unit?`, `conversion_id?`, `abstention_reason?` |
| value | `received_value`, `unit_normalized_value?`, `plausibility_band`, `position` (`inside`/`edge`/`outside`) |
| method | `received_method?`, `matched_assay?`, `abstention_reason?` |
| ref_range | `received_low?`, `received_high?`, `canonical_range?`, `conflict?` |
| panel | `co_observation_ids`, `matched_panel?`, `partial_panel_notes?`, `abstention_reason?` |
| longitudinal | `prior_witness_ids`, `dynamics_rule_id`, `delta_observed?`, `delta_ceiling?`, `result` |

### 4.2 Composite scoring

- Identity score = Σ (score_i × weight_i for i ∈ {1..6} where
  contributes_to_denominator) / Σ (weight_i where
  contributes_to_denominator). Mirrors spec §5.9.
- Coherence (signal 7) is **not** in the identity score. A `fail` on
  signal 7 forces `needs_review` regardless of identity score.
- Threshold parameters live on `rae_engine_versions` and are recorded
  on every CAW via `engine_version_id` so historical CAWs remain
  re-evaluable.
- For each abstaining or partial signal, an entry is appended to the
  CAW `limitations` array (mandatory; spec §5.9 + §4.3).

---

## 5. Required migration files (recap, in dependency order)

1. `<TS>_rae_engine_versions.sql` — must precede CAW because CAW fks
   into it.
2. `<TS>_rae_signal_config.sql` — sibling table to
   `witness_signal_registry`; must precede CAW writes because the
   orchestrator loads band parameters from it. `witness_signal_registry`
   is not modified.
3. `<TS>_rae_concept_assignment_witness.sql` — table, enum,
   constraints, RLS, ancestry trigger.
4. `<TS>_rae_state_transitions.sql` — append-only audit log.
5. *No back-annotation migration.* Back-annotation reuses existing
   CAW columns (§9, OQ-6).

No other migrations are proposed in v1. No alteration of
`witness_objects`, `witness_signal_registry`,
`patient_lab_observations`, or any reasoning-surface table. No new
RLS policies on existing tables.

---

## 6. Required TypeScript types

All proposed in `supabase/functions/_shared/rae/types.ts`. Sketch
below; final shapes are subject to the implementation thread.

```ts
// Claim — what RAE adjudicates.
interface RawObservationClaim {
  source_table: "patient_lab_observations" | string;
  source_row_id: string;
  user_id: string;
  raw_name: string;
  raw_unit: string | null;
  raw_value: number | null;
  raw_method: string | null;
  raw_reference_low: number | null;
  raw_reference_high: number | null;
  observed_at: string; // ISO timestamp
  panel_grouping_key: string | null; // panel/order/submission identifier
}

type AdmissionState =
  | "auto_admitted"
  | "needs_review"
  | "rejected"
  | "human_confirmed";

interface ConceptAssignmentWitnessDraft {
  caw_id: string;                // deterministic UUIDv5
  user_id: string;
  source_table: string;
  source_row_id: string;
  candidate_concept_id: string;
  ontology_version: string;
  registry_seed_version: string;
  engine_version_id: string;
  current_state: AdmissionState;
  current_state_actor_kind: "engine" | "human";
  current_state_actor_id: string;
  signal_results: SignalResult[]; // length 7, ordered by signal_id
  composite_identity_score: number;
  coherence_result: SignalBand;
  confidence_value: number;
  confidence_basis: string;
  limitations: string[];
  produced_witness_id: string | null;
  policy_at_decision: string;
}

interface AdmissionDecision {
  caw: ConceptAssignmentWitnessDraft;
  witness?: WitnessObject; // present iff state ∈ {auto_admitted, human_confirmed}
}

// State machine helpers.
function isAllowedTransition(
  from: AdmissionState | null,
  to: AdmissionState,
  actor: "engine" | "human",
): boolean;
```

No types are exported into `src/`. RAE has no UI surface in v1 beyond
the calibration review tool, which uses its own admin types.

---

## 7. Required tests / guards

### 7.1 Unit tests — per signal

`supabase/functions/_shared/rae/signals/<signal>.test.ts` for each of
the seven. Each test file covers, at minimum:

- `pass` band fixtures.
- `fail` band fixtures.
- `partial` band fixtures (where defined).
- `abstain` band fixtures (where defined).
- One HbA1c worked-example fixture per signal, drawn verbatim from
  spec §5.2–§5.8.
- Evidence-shape assertion: every fixture asserts the
  `SignalResult.evidence` discriminator and required fields.

### 7.2 Composite scoring tests

`supabase/functions/_shared/rae/scoring.test.ts`:

- Abstention removes weight from denominator (does not zero score).
- Signal 7 fail forces `needs_review` even when identity score = 1.0.
- Signal 7 abstain or pass leaves identity score's effect intact.
- Threshold edge cases (just above / at / just below admission
  threshold and rejection floor).

### 7.3 State machine tests

`supabase/functions/_shared/rae/stateMachine.test.ts`:

- All allowed transitions from spec §6.2 succeed.
- All forbidden transitions from spec §6.3 raise.
- A transition without actor or reason raises.
- Idempotence: re-asserting the current state is a no-op (no new
  transition row, no state mutation).

### 7.4 Integration test — HbA1c end-to-end

`supabase/functions/rae-admit-claim/hba1c_e2e.test.ts`:

- Replays the ten VV-001 HbA1c rows through the orchestrator under
  calibration mode. Expected: ten CAWs in `needs_review`, zero
  witnesses written.
- Replays the same ten under default mode. Expected: ten
  `auto_admitted`, ten depth-0 witnesses, each carrying the merged
  limitations.
- Adversarial fixture: an eleventh row with value 12.5%, three months
  after a 5.2%. Expected: signal 7 `fail`, state `needs_review`,
  zero witness.

### 7.5 Guards (mirroring P1a `p1a_migration_guard.test.ts` pattern)

`supabase/functions/rae-admit-claim/rae_guard.test.ts`:

- Orchestrator never imports a reasoning-surface module
  (`generate-clusters`, `generate-narrative`, `generate-action-plan`,
  `generate-terrain-render`, `generate-ask-anything-context`,
  `patient-chat`). Drift B mitigation.
- Orchestrator never writes to `cie_*`, `derived_patterns`,
  `terrain_renders`, `patient_narratives`, or `action_plans`.
- Orchestrator only writes to `concept_assignment_witnesses`,
  `rae_state_transitions`, and `witness_objects` (latter via the
  existing P1a witnessify path).
- A `human_confirmed` state cannot be written when
  `actor_kind = 'engine'`.
- A CAW row with `current_state ∈ {needs_review, rejected}` cannot
  carry a non-NULL `produced_witness_id`.

### 7.6 Cross-document guard

`supabase/functions/_shared/rae/spec_alignment.test.ts`:

- Asserts the encoded list of seven signal ids exactly matches the
  seven named in spec §5.1.
- Asserts the encoded enum values match spec §6.1.
- Asserts the encoded forbidden-transition set is a superset of the
  set named in spec §6.3.

---

## 8. VV-001 calibration flow for the 923 observations

This is the operational realization of spec §9 and §11 step 5–7.

### 8.1 Pre-flight

1. Confirm the active engine version has `calibration_mode = true`.
2. Confirm the registry extension covers the concepts present in the
   923 (HbA1c, lipids, CMP, hepatic, diabetes-screening). Where it
   does not, surface the gap before running — do not let the engine
   route a missing-concept claim to `rejected` for lack of registry
   coverage. Registry gaps are handled by extending the registry, not
   by rejecting claims.

### 8.2 First pass

3. Invoke `rae-backfill-923` for VV-001. The function is idempotent
   (Pattern Z, mirroring P1a §8.2): if a CAW already exists for
   `(user_id, source_row_id, candidate_concept_id, engine_version_id)`,
   skip. Otherwise admit.
4. Every claim produces a CAW; under calibration mode, every CAW
   enters `needs_review`. Zero `witness_objects` rows are produced
   in this pass.

### 8.3 Founder review

5. Founder (Vishnu) reviews each CAW via the
   `rae-calibration-review` admin tool. For each:
   - Confirm → transition to `human_confirmed`, write the depth-0
     witness via the P1a witnessify path, link via
     `produced_witness_id`.
   - Reject → transition to `rejected`, no witness written.
   - Correct concept → emit a *new* CAW for the corrected
     `candidate_concept_id` (new `caw_id` because the deterministic
     id namespace includes `candidate_concept_id`); the original CAW
     stays in `rejected` with reason "concept corrected to <new>".

### 8.4 Adjustment cycle

6. Disagreements between engine band/state and founder action are
   collected. Adjustments touch only:
   - Signal weights on `rae_engine_versions`.
   - Plausibility / dynamics bands on the registry extension.
   - Synonyms / panel associations.
   - Threshold and rejection-floor parameters on
     `rae_engine_versions`.
   No adjustment may touch the seven signals' definitions, the state
   machine, or the CAW shape (drift A and E mitigation).
7. Bump engine version. Re-run `rae-backfill-923`. Because the
   deterministic CAW id includes `engine_version_id`, the second pass
   produces a *new* CAW per claim under the new engine, leaving the
   first-pass CAWs intact for audit.

### 8.5 Convergence and lift

8. Repeat steps 5–7 until founder-reviewed dispositions converge
   (precision and recall against founder action clear thresholds set
   during calibration; not specified here, per spec §9.2).
9. For each concept whose backlog reaches zero and converges, lift
   the all-routes-to-review override for that concept on
   `rae_engine_versions` (per OQ-5 below: per-concept override).
   Subsequent claims for that concept can `auto_admit`.
10. Calibration completion for VV-001 unlocks extension to HV-001,
    KF-001, RS-001, SM-001, VP-001 (out of scope for v1
    implementation).

### 8.6 Drift D guard

- The `rae-calibration-review` function refuses to bulk-confirm. Each
  decision is one row, one timestamp, one `reason`. Spec §12.4.
- A scheduled cron audit (proposed) reports any concept whose
  override was lifted while its backlog was non-zero. Such an event
  is a drift incident.

### 8.7 Calibration targets (open at v1 ship)

- Signal 6 (panel) currently emits `partial` when the ratio of
  expected sibling concepts present in co-observations is `>= 0.5`.
  The threshold is deliberate but not yet calibrated.
- The spec §5.7 "registry-unrecognized co-marker" case is not
  separately distinguished from the simple "missing some siblings"
  case in v1; both collapse into the same `partial` band today.
- VV-001 calibration on the 923 will determine whether the two cases
  warrant distinct dispositions (e.g., abstain vs partial); revisit
  the threshold and the case split during 923 calibration.
- Signal 7 (longitudinal) emits `partial` when the observed delta
  falls above `0.8 * delta_ceiling` and at or below the ceiling
  itself (spec §5.8: "coherence preserved within tolerance, but the
  change is at the edge of biological dynamics"). The 0.8 fraction
  is the v1 hardcoded default and is calibration-tunable.
  VV-001 calibration on the 923 will inform whether the threshold
  should shift; revisit during 923 calibration.

---

## 9. Treatment of the 92 already-witnessed observations

Per spec §11.2, the 92 are grandfathered.

1. **No deletion. No re-validation. No re-witnessing.** The 92
   `witness_objects` rows remain valid.
2. **Back-annotation, when feasible.** During VV-001 calibration, the
   `rae-backfill-923` function (or a sibling `rae-back-annotate-92`
   function) runs RAE over each of the 92 source observations and
   produces a CAW with:
   - `policy_at_decision = 'back_annotation'`,
   - `produced_witness_id` pointing at the *existing* witness
     (constraint `caw_back_annotation_requires_witness`),
   - `current_state` selected from the locked four states
     (constraint `caw_back_annotation_state_valid`):
     - `auto_admitted` if RAE would have admitted under default
       policy and the engine disposition matches the grandfathered
       witness's concept,
     - `human_confirmed` if RAE would have routed to review and the
       founder confirms the existing witness,
     - `rejected` if the founder, on review, agrees the original
       witness should not stand under the new gate (does **not**
       remove the existing witness; see step 4),
   - `founder_review_flag = true` whenever the engine's disposition
     diverges from the existing witness's concept (the OQ-6
     resolution: divergence is a flag, not a fifth state),
   - a `limitations` entry: `"back-annotated to pre-RAE witness;
     admission did not gate the original write"`.
3. **No state transition is performed on the existing 92 witnesses
   themselves.** They remain unchanged. Back-annotation is
   documentation, not re-admission, mirroring spec §11.2. Even when
   the back-annotation CAW is `rejected`, the underlying
   `witness_objects` row is not deleted or marked; the CAW records
   the disagreement and surfaces it for founder action.
4. **No fifth admission state is introduced.** The four states from
   spec §6.1 (`auto_admitted`, `needs_review`, `rejected`,
   `human_confirmed`) are exhaustive and locked. Divergent
   back-annotations are carried entirely by `founder_review_flag`
   plus `policy_at_decision` plus `limitations`.

---

## 10. Explicit non-goals (binding for v1)

The following are *not* proposed by this plan and any implementation
work toward them is out of scope for v1:

1. Trajectory witness design or implementation (P1b).
2. Intervention witness design or implementation (P1b/P1c).
3. Protocol witness design or implementation (P1b/P1c).
4. Continuous-stream / sensor / CGM admission (future RAE-stream).
5. CIE response admission under RAE (future RAE-CIE; the existing
   `witnessify_impl.ts` CIE path is grandfathered, spec §7.8).
6. RAE external API, FHIR layer, third-party consumer surface
   (spec §10.4, drift C).
7. Any change to reasoning surfaces (`generate-clusters`,
   `generate-narrative`, `generate-action-plan`,
   `generate-terrain-render`, `generate-ask-anything-context`,
   `patient-chat`). They continue to consume the witness layer
   exactly as P1a leaves it.
8. Any change to `_shared/contextLoader.ts` contract.
9. Any change to `witnessify_impl.ts`, the registry seed pipeline,
   or the namespace UUID for P1a-derived witnesses.
10. Any UI work beyond a minimal admin review surface (the
    calibration review tool may live as an unlisted admin route or
    a CLI; final form is an implementation choice).
11. Auto-admission for any concept until that concept has converged
    under founder review (spec §9.5, drift D).
12. Engine ablation, "reasoning-light" RAE, or any mode where RAE
    operates without the seven-signal triangulation (drift B).

---

## 11. Risks

- **R-1: Drift toward RAE-as-reasoner.** The orchestrator will be
  tempted to encode "if downstream cluster X exists, admit." Guard:
  §7.5 import-graph guard test.
- **R-2: Registry coverage drift.** If the registry does not cover a
  concept present in the 923, naive routing produces `rejected` for
  registry reasons rather than for biology. Mitigation: §8.1
  pre-flight gate; missing concepts surface a registry-extension task,
  not a rejection.
- **R-3: Deterministic id collisions across engine versions.** Two
  engine versions producing CAWs for the same claim must produce two
  CAW rows. Mitigation: include `engine_version_id` in the
  deterministic UUIDv5 input.
- **R-4: Back-annotation polluting the 92.** If back-annotation
  produces CAWs that look like normal admissions, downstream queries
  may double-count. Mitigation: explicit `policy_at_decision =
  'back_annotation'`, the `founder_review_flag` boolean, and a
  CAW-level limitation entry; queries that count admissions filter
  on `policy_at_decision = 'default'`.
- **R-5: Calibration-mode lift error.** Lifting the override before
  the per-concept backlog is zero would silently graduate the engine.
  Mitigation: a scheduled audit alert (per OQ-5 resolution: audit
  alert, not DB constraint). The audit job runs on every
  `rae_engine_versions` policy change and on a daily cadence.
- **R-6: P1a invariant 4 (readiness) interaction.** A CAW whose
  limitations are severe must still be readable by readiness
  reasoners; if downstream code mistakenly treats severity as
  rejection, recommendations could be silently withheld for valid
  admissions. Spec §4.5 names this; the mitigation is not in RAE but
  in the readiness reasoner. Flag for downstream review only.

### 11.1 Known deferred gaps

- **Back-annotation soft-drift detection (spec §11.2, plan §9).**
  Concept-divergence detection on the 92 grandfathered witnesses
  during back-annotation requires `witness_objects` to carry an
  `ontology_concept_id` column.
- That column does not exist in the P1a schema today.
- Therefore the soft-drift check implemented in
  `_shared/rae/storage/admit.ts` is unreachable in the RPC path:
  the join required to surface a drift signal cannot be expressed.
- The gap is intentional and known, not an oversight; it is recorded
  in migration `20260425024109` as an inline comment and here as the
  authoritative ledger entry.
- **Trigger condition for closing:** a future migration adds
  `witness_objects.ontology_concept_id` (and backfills it). At that
  point the soft-drift check in `admit.ts` re-enables automatically
  with no further code change required.
- Status: **deferred, not lost.** Tracked here and in
  `docs/P1A_STATE_SNAPSHOT.md` known-backlog.

---

## 12. Composition with the four P1a invariants

| P1a invariant | RAE composition |
|---|---|
| 1 — one manifest, one truth | CAWs are tagged with `registry_seed_version` and `engine_version_id`; readers see the same artifact. |
| 2 — structured screens never call the LLM | The calibration review surface renders CAW fields directly; no LLM narration of CAWs. |
| 3 — evidence one click away | `produced_witness_id` ↔ CAW `caw_id` ↔ `(source_table, source_row_id)`. The chain is complete. |
| 4 — readiness before recommendation | CAW `limitations` is the input the readiness reasoner consumes (no RAE change required). |

---

## 13. CodexOS resolutions and applied corrections

### 13.1 Three corrections applied from CodexOS review

1. **No fifth admission state.** The four states in spec §6.1 —
   `auto_admitted`, `needs_review`, `rejected`, `human_confirmed` —
   are exhaustive and locked. The earlier proposal of
   `back_annotated_divergent` is withdrawn. Divergent back-annotation
   is represented by `policy_at_decision = 'back_annotation'` plus
   `founder_review_flag = true` plus a `limitations` entry. Enforced
   by check constraints `caw_policy_at_decision_valid` and
   `caw_back_annotation_state_valid` (§1.1).
2. **Sibling `rae_signal_config` is mandatory.** RAE-specific signal
   bands, weights, synonyms, and panel associations live in a new
   sibling table `public.rae_signal_config`.
   `public.witness_signal_registry` is **not modified** by RAE.
   Rationale: keeps the P1a witness registry stable and preserves
   RAE extractability (spec §10.2).
3. **CAW naming is fixed.** Conceptual object:
   `concept_assignment_witness` (singular). Postgres table:
   `public.concept_assignment_witnesses` (plural). TypeScript types:
   `ConceptAssignmentWitness` and `ConceptAssignmentWitnessDraft`.
   The short identifier `caw_id` appears only as a column or local
   variable name. No mixed naming in any docs, migrations, or code.

### 13.2 Resolved open questions

- **OQ-1 — Approved.** Single `concept_assignment_witnesses` table
  with `current_state`, plus the append-only `rae_state_transitions`
  log. The CAW row is the current view; the transitions log is the
  audit chain.
- **OQ-2 — Approved.** `produced_witness_id` is a hard fk into
  `witness_objects.witness_id` with `ON DELETE RESTRICT`. Witnesses
  cannot be hard-deleted while a CAW references them.
- **OQ-3 — Approved.** Sibling `rae_signal_config` table.
  `witness_signal_registry` remains unchanged.
- **OQ-4 — Approved.** Policy lives at engine-version scope
  (`rae_engine_versions.calibration_mode`) with a per-concept lift
  override (proposed: a `rae_engine_concept_overrides` child table
  recording, per `(engine_version_id, candidate_concept_id)`,
  whether `calibration_all_routes_to_review` has been lifted). No
  per-CAW policy override.
- **OQ-5 — Resolved as audit alert, not DB constraint.** A scheduled
  audit job (cron-driven) reports any concept whose override was
  lifted while its founder-review backlog was non-zero. The check
  constraint earlier proposed in R-5 is withdrawn.
- **OQ-6 — Resolved as no fifth state.** Carried by
  `policy_at_decision = 'back_annotation'`, `founder_review_flag`,
  and a `limitations` entry. See §13.1 #1.
- **OQ-7 — Approved.** The `rae-calibration-review` function hard-
  refuses bulk-confirm. Each disposition is one row, one timestamp,
  one `reason`. Drift D mitigation.
- **OQ-8 — Approved.** The orchestrator's import-graph and read-set
  guards explicitly assert it never reads `cie_responses`,
  `cie_domain_scores`, `cie_gate_scores`, or `derived_patterns`.
  Mirrors the existing P1a `p1a_migration_guard.test.ts` pattern.

### 13.3 Approval status

With the three corrections in §13.1 applied and the eight open
questions resolved in §13.2, this plan is **approved by CodexOS for
schema implementation**. The next thread takes this document as
input and produces the four migrations enumerated in §0.1, the
TypeScript contracts in §6, the seven signal modules, the
orchestrator, the calibration review surface, and the test set in
§7. No section of this plan is to be revised by the implementation
thread; revisions return here for CodexOS review.