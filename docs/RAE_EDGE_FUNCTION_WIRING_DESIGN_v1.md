# RAE Edge Function Wiring Design v1

**Status:** Design only — no code, no schema, no migration, no edge function
created in this prompt. Awaits CodexOS approval before implementation.

**Controlling specs:**
- `docs/RAE_IMPLEMENTATION_PLAN_v1.md`
- `docs/RAE_ORCHESTRATOR_DESIGN_v1.md`
- `docs/RAE_STORAGE_PERSISTENCE_DESIGN_v1.md`
- `docs/RAE_ADMIT_GATEWAY_WIRING_DESIGN_v1.md`

**Code already in place that this design composes (no new modifications):**
- `supabase/functions/_shared/rae/orchestrator.ts` — `adjudicate(input): AdmissionDecisionV1`
- `supabase/functions/_shared/rae/storage/admit.ts` — `persistInitialAdmission(input, runInTransaction)`
- `supabase/functions/_shared/rae/storage/gateway_rpc.ts` — `makeRpcAdmitGateway(client, { witnessPayloadAdapter })`
- DB function `public.rae_persist_initial_admission(p_payload jsonb)`
- DB function `public.rae_insert_witness_object(p_witness jsonb)`

---

## 1. Edge Function Name and Purpose

**Name:** `rae-admit-observation`

**Purpose:** Adjudicate exactly one `RawObservationClaim` against exactly one
`CandidateConcept` using the deterministic RAE engine, and atomically
persist the resulting `ConceptAssignmentWitness` (CAW), its initial
`rae_state_transitions` row, and (when intent says so) one depth-0
`witness_objects` row, in a single Postgres transaction owned by the
SECURITY DEFINER RPC.

**Strict scope:**
- One observation, one candidate, one decision per invocation.
- No P1a reasoning (no clusters, no narrative, no terrain, no plans).
- No FHIR / public API framing. No external IDs. No fifth admission state.
- No UI surface.

**Non-purposes (handled elsewhere):**
- Reading `patient_lab_observations` and pre-computing `RawObservationClaim`
  lives in the **caller** (orchestration layer or a future ingestion edge
  function), not here. This function accepts the claim already shaped.
- Generating depth-1+ derived witnesses (witnessify_impl). This function's
  only witness path is depth-0, and the body of that witness is built by an
  in-process `WitnessifyAdapter` that mirrors witnessify_impl shape but
  is invoked through the seam declared in `admit.ts`.
- Concept lookup / candidate selection. Caller supplies the `CandidateConcept`.
- Review actions (state transitions other than the initial admission).

---

## 2. Request / Response JSON Contract

### 2.1 Endpoint

```
POST /functions/v1/rae-admit-observation
Content-Type: application/json
Authorization: Bearer <user JWT>
```

`verify_jwt` stays at the project default (`false`); JWT is validated
in-code via `supabase.auth.getClaims(token)`.

### 2.2 Request body

```jsonc
{
  // === claim block (1:1 with RawObservationClaim) ===
  "claim": {
    "source_table": "patient_lab_observations",
    "source_row_id": "uuid",
    "user_id": "uuid",                  // MUST equal authenticated sub
    "raw_name": "string",
    "raw_unit": "string | null",
    "raw_value": "number | null",
    "raw_method": "string | null",
    "raw_reference_low": "number | null",
    "raw_reference_high": "number | null",
    "observed_at": "ISO-8601",
    "panel_grouping_key": "string | null"
  },

  // === candidate block (1:1 with CandidateConcept) ===
  "candidate_concept": {
    "concept_id": "string",
    "canonical_name": "string",
    "synonyms": ["string"],             // optional
    "ambiguous_alternatives": ["string"], // optional
    "canonical_unit": "string",
    "unit_conversions": {                // optional, keyed by received unit
      "<unit>": { "to": "string", "factor": 0, "offset": 0 }
    },
    "plausibility_band": { "low": 0, "high": 0 } | null,
    "known_assays": ["string"],          // optional
    "method_optional": false,            // optional
    "canonical_reference_range": { "low": 0, "high": 0 } | null,
    "expected_panel_concept_ids": ["string"], // optional
    "panel_id": "string | null",         // optional
    "dynamics_rule_id": "string | null",
    "delta_ceiling": 0
  },

  // === engine binding block ===
  "engine_version_id": "uuid",          // resolves engine_version + signal_config

  // === sibling + history blocks (caller-precomputed) ===
  // Caller is responsible for fetching these scoped to claim.user_id +
  // claim.panel_grouping_key + observed_at window. The edge function
  // does NOT read patient_lab_observations.
  "siblings": [
    {
      "concept_id": "string",
      "value_normalized": "number | null",
      "unit": "string | null",
      "observed_at": "ISO-8601"
    }
  ],
  "prior_observations": [
    {
      "concept_id": "string",
      "value_normalized": "number | null",
      "observed_at": "ISO-8601"
    }
  ],

  // === optional admin overrides ===
  "policy_override": "default | calibration_all_routes_to_review | back_annotation",
  "back_annotation_existing_witness_id": "uuid"   // required iff policy=back_annotation
}
```

### 2.3 Response body — 200 OK

```jsonc
{
  "mode": "created" | "existing",        // server-side idempotency outcome
  "caw": {
    "id": "uuid",
    "caw_id": "uuid",
    "user_id": "uuid",
    "source_table": "string",
    "source_row_id": "uuid",
    "candidate_concept_id": "string",
    "current_state": "auto_admitted | needs_review | rejected | human_confirmed",
    "current_state_actor_kind": "engine",
    "current_state_actor_id": "<engine_version_id>",
    "policy_at_decision": "default | calibration_all_routes_to_review | back_annotation",
    "founder_review_flag": false,
    "produced_witness_id": "uuid | null",
    "limitations": ["string"],
    "confidence_value": 0.0,
    "confidence_basis": "string",
    "composite_identity_score": 0.0,
    "coherence_result": "pass | fail | partial | abstain",
    "ontology_version": "string",
    "registry_seed_version": "string",
    "engine_version_id": "uuid",
    "current_state_entered_at": "ISO-8601",
    "created_at": "ISO-8601",
    "updated_at": "ISO-8601"
    // signal_results returned separately to keep payload small
  },
  "witness_id": "uuid | null",
  "witness_intent": "produce_depth0_witness | none"
}
```

**No exposure** of internal RPC SQLSTATE codes, DB row internals beyond
the CAW row, or signal-config rows.

### 2.4 Response body — error

```jsonc
{
  "error": {
    "code":  "<typed-error-name>",        // see §7
    "message": "<human-readable, no PII, no SQLSTATE leakage>",
    "details": { ... }                    // optional, structured per code
  }
}
```

HTTP status mapping in §7.

---

## 3. Request → Orchestrator Input Construction

The edge function builds the `OrchestratorInput` object passed to
`adjudicate()`. Construction is purely deterministic and field-by-field.

| Orchestrator field | Source in request | Notes |
|---|---|---|
| `claim: RawObservationClaim` | `body.claim` verbatim after Zod parse | `claim.user_id` must equal `getClaims().sub`; otherwise 403 `auth_user_mismatch`. |
| `candidate_concept: CandidateConcept` | `body.candidate_concept` verbatim after Zod parse | No DB lookup. Caller is the source of truth for what concept is being adjudicated against. |
| `signal_config: SignalConfig` | DB read from `rae_signal_config` keyed by `engine_version_id` (+ optional `concept_id` override) | **Read-only**. Performed via `gateway_rpc` is **not** allowed (gateway only does the persist RPC). A separate read helper module `_shared/rae/edge_loaders.ts` (new file at implementation time) issues a single `.from("rae_signal_config").select(…)`. This read does not violate the closed write set (which forbids writes only). |
| `engine_version: EngineVersionConfig` | DB read from `rae_engine_versions` by `engine_version_id` | Same `_shared/rae/edge_loaders.ts` helper. Single SELECT, parameterized. |
| `siblings: PanelSibling[]` | `body.siblings` verbatim (already scoped by caller) | The edge function does **not** read `patient_lab_observations`. This keeps the function's read surface small and the closed-write-set guard meaningful. |
| `prior_observations: PriorObservation[]` | `body.prior_observations` verbatim | Same rationale. |

**Authoritative claim:** The function never substitutes server-side data for
client-supplied claim/candidate/siblings/history. If the caller is wrong,
the engine's signals are correspondingly wrong — that is the caller's
responsibility, and it is auditable through `signal_results` on the CAW.

**Engine binding read surface (additive, not in this prompt):** the new
`edge_loaders.ts` module will live alongside `gateway_rpc.ts` and is
constrained to:
- `.from("rae_engine_versions").select(…).eq("engine_version_id", …)`
- `.from("rae_signal_config").select(…).eq("engine_version_id", …)`
- `.from("rae_engine_concept_overrides").select(…)` (when concept-scoped overrides exist)

No writes. No joins to clinical tables. No P1a tables. The static-scan
guard already used for `admit.ts`/`gateway_rpc.ts` will be extended in the
same prompt that creates `edge_loaders.ts` to apply a corresponding
**read allowlist** check on that file. (Not done in this prompt — design
only.)

---

## 4. Exact Call Chain

```
HTTP request
  └── Zod parse + auth (getClaims(token))
        └── edge_loaders.loadEngineBinding(engine_version_id)
              ↓ returns { engine_version, signal_config }
  └── adjudicate({
        claim, candidate_concept, signal_config, engine_version,
        siblings, prior_observations,
      })
        ↓ returns AdmissionDecisionV1 = { caw: draft, witness_intent }
  └── apply policy_override (if admin and present) onto draft.policy_at_decision
        + recompute founder_review_flag if policy → back_annotation
  └── persistInitialAdmission(
        { decision, reason, witnessify_adapter?, back_annotation_witness_id? },
        makeRpcAdmitGateway(serviceRoleClient, { witnessPayloadAdapter })
      )
        ↓ buffers gateway calls, dispatches ONE RPC:
        ↓   public.rae_persist_initial_admission(p_payload)
        ↓ rewrites caw handle in place from RPC's authoritative row
        ↓ returns { mode, caw }
  └── shape JSON response
```

**Key invariants enforced by this chain:**

- `adjudicate` is pure; throws `MalformedClaimError`, `RegistryGapError`,
  `InvalidSignalShapeError`, `UnitNormalizationError`,
  `NoCandidateConceptError`. No DB I/O.
- `persistInitialAdmission` is pure with respect to its `runInTransaction`
  argument. The single Postgres txn is owned by the RPC.
- `gateway_rpc.ts` makes exactly one Supabase call: the RPC. No reads,
  no other writes.
- `witnessify_impl` is **not imported** by the edge function. The depth-0
  witness body is built by a small `WitnessifyAdapter` defined inside the
  edge function module that mirrors the slim `WitnessRowInput` shape; if
  field-for-field parity with witnessify_impl is needed later, that
  will be argued in a separate, explicit prompt with a justified import.

---

## 5. WitnessifyAdapter and WitnessPayloadAdapter Mapping

Two adapters compose:

### 5.1 `witnessify_adapter`: `AdmissionDecisionV1 → WitnessRowInput`

Lives inside `index.ts` of the edge function. Pure. Invoked by
`persistInitialAdmission` inside the txn body.

| `WitnessRowInput` field | Derivation |
|---|---|
| `witness_id` | `uuidv5(WITNESS_NAMESPACE, {user_id}|{source_table}|{source_row_id}|{registry_seed_version})` — deterministic, idempotent. (Namespace is the existing P1a witness namespace; this edge function reuses it but does not import witnessify_impl, only the namespace constant.) |
| `user_id` | `decision.caw.user_id` |
| `source_table` | `decision.caw.source_table` |
| `source_row_id` | `decision.caw.source_row_id` |
| `ontology_concept_id` | `decision.caw.candidate_concept_id` |
| `passthrough` | `{ source: "rae-admit-observation", engine_version_id, registry_seed_version, ontology_version, raw_value, raw_unit, raw_method, observed_at, signal_results, composite_identity_score, coherence_result, confidence_value, confidence_basis, limitations }` |

### 5.2 `WitnessPayloadAdapter`: `WitnessRowInput → WitnessPayloadShape` (RPC jsonb)

Lives inside `index.ts`, passed to `makeRpcAdmitGateway`. Pure. Invoked
once at flush time.

| `WitnessPayloadShape` field | Derivation |
|---|---|
| `witness_id` | `row.witness_id` |
| `user_id` | `row.user_id` |
| `source_table` | `row.source_table` |
| `source_row_id` | `row.source_row_id` |
| `ancestry_witness_ids` | `[]` — depth-0 witness has no ancestry. |
| `source_window` | `"point"` — single observation. |
| `signal` | `row.passthrough.raw_name` (string label of the raw signal). |
| `domain_of_access` | `"observed"` — direct laboratory observation. |
| `epistemic_role` | `"primary"`. |
| `reliability_class` | `decision.caw.coherence_result === "pass" ? "high" : decision.caw.coherence_result === "partial" ? "medium" : "provisional"`. (Computed in `witnessify_adapter` and passed through `passthrough`.) |
| `compression_depth` | `0`. |
| `observed_value` | `row.passthrough.raw_value` (passed as JSON; SQL casts to jsonb). |
| `observed_unit` | `row.passthrough.raw_unit`. |
| `testimony` | `"<canonical_name>=<raw_value> <raw_unit> @ <observed_at> (engine <engine_version_id>)"` — human-readable record string. |
| `limitations` | `row.passthrough.limitations` (≥ 1 entry, no blanks — RAE invariant; trigger `enforce_caw_limitations_no_blanks` covers CAW; same discipline applied here for witnesses). |
| `confidence_value` | `row.passthrough.confidence_value`. |
| `confidence_basis` | `row.passthrough.confidence_basis` (≥ 20 chars). |
| `biological_timestamp` | `row.passthrough.observed_at`. |
| `validity_window_seconds` | `null` (point observation; no validity window asserted). |
| `conflict_candidates` | `null`. |
| `transformation_version` | `"rae-admit/v1"`. |
| `registry_seed_version` | `row.passthrough.registry_seed_version`. |
| `derived_from_packet_id` | `null` — depth-0 path is not packet-derived. |

The RPC validates these via column types and trigger
`enforce_witness_ancestry_integrity`. Any violation surfaces as
`P0001` and is mapped by `gateway_rpc.mapRpcError` to
`WitnessifyFailureError`.

---

## 6. Auth / Service-Role Boundary

**Two clients are constructed inside the edge function:**

1. **`callerClient`** — built with `SUPABASE_ANON_KEY` and the request's
   `Authorization` header, used solely for `getClaims(token)`.
   - Never used for DB I/O.
2. **`serviceRoleClient`** — built with `SUPABASE_SERVICE_ROLE_KEY`.
   - Used by `edge_loaders` for the engine-binding SELECTs.
   - Used by `gateway_rpc` for the single `.rpc("rae_persist_initial_admission", …)` call.
   - Required because the RPC's `EXECUTE` is granted **only** to
     `service_role` (per the migration). The anon role and authenticated
     role are intentionally not granted execute.

**Authorization checks performed before any DB access:**

- Bearer token present, `getClaims()` succeeds.
- `claim.user_id === claims.sub` **OR** the caller is an admin
  (`has_role(sub, 'admin')` via the existing security-definer function).
- `policy_override` is only honored when the caller is admin. Non-admin
  attempts to set it return 403 `policy_override_forbidden`.
- `back_annotation_existing_witness_id` requires admin and
  `policy_override === "back_annotation"`.

**No view-as bypass.** Admin view-as sessions do not change the CAW's
`user_id`; CAW persistence always writes `claim.user_id`, which must
match the authenticated subject (or admin override path).

---

## 7. Error Mapping Returned to Caller

Mapping table from internal exception → HTTP response:

| Source / TS error | HTTP | `error.code` | Notes |
|---|---|---|---|
| Zod parse failure | 400 | `invalid_request` | `details.field_errors` from Zod. |
| Missing/invalid Bearer | 401 | `unauthenticated` | |
| `claim.user_id ≠ sub` and not admin | 403 | `auth_user_mismatch` | |
| Non-admin set `policy_override` | 403 | `policy_override_forbidden` | |
| `MalformedClaimError` | 400 | `malformed_claim` | |
| `NoCandidateConceptError` | 400 | `no_candidate_concept` | |
| `RegistryGapError` | 422 | `registry_gap` | Unknown unit / missing conversion / engine binding row missing. |
| `InvalidSignalShapeError` | 500 | `engine_internal_signal_shape` | Internal — engine produced a bad signal shape; logged. |
| `UnitNormalizationError` | 422 | `unit_normalization_failed` | |
| `StateTransitionError` (from admit.ts) | 422 | `invalid_state_transition` | |
| `StorageInputError` | 400 | `invalid_storage_input` | Includes RPC `22023` rejections. |
| `BackAnnotationVerificationError` | 422 | `back_annotation_verification_failed` | RPC `P0001` back_annotation tuple mismatch / missing. |
| `WitnessifyFailureError` | 422 | `witness_rejected` | RPC `P0001` from `rae_insert_witness_object` or ancestry triggers. |
| `Error("duplicate key …")` from RPC `23505` | 409 | `caw_id_conflict` | Should not occur after idempotency probe; surfaces if a parallel txn won. The RPC's own probe usually returns `mode="existing"` instead. |
| `TransactionRollbackError` | 500 | `rae_persist_failed` | `details.underlying_error_name`. SQLSTATE never returned to client. |
| Anything uncaught | 500 | `internal_error` | Logged with stack; client message is generic. |

Every error response carries the standard `corsHeaders` and
`Content-Type: application/json`.

---

## 8. Idempotency Behavior

Idempotency is owned by the SQL function (probe by `caw_id`), but the
edge function preserves it end-to-end:

1. **Deterministic `caw_id`** is computed by `adjudicate()` via
   `uuidv5(RAE_CAW_NAMESPACE, "{user_id}|{source_table}|{source_row_id}|{candidate_concept_id}|{engine_version_id}")`.
   Same five inputs ⇒ same `caw_id`.
2. The RPC probes `concept_assignment_witnesses` by `caw_id` first.
   If found, it returns `mode="existing"` with the existing row and
   does **no** writes.
3. `gateway_rpc.ts` rewrites the in-memory CAW handle from the RPC's
   authoritative row and patches `result.mode` to `"existing"`.
4. The edge function returns 200 with the same shape as a created row;
   the only difference is `mode`. `witness_id` reflects whatever the
   existing row already carried (may be null if the prior call was
   `intent=none`, even if the new request says `produce_depth0_witness`).
5. **No retry storm risk.** A repeated request with identical inputs is
   strictly idempotent. A repeated request with a *different*
   `engine_version_id` produces a different `caw_id` ⇒ a separate CAW.

**Concurrency:** if two parallel calls race on the same `caw_id`, one
loses with `23505`. The losing call returns 409 `caw_id_conflict`. The
winning row is durable; the losing call's transition row is rolled back
by the RPC (single txn).

---

## 9. Back-Annotation Behavior

Back-annotation is the only path where the CAW references a pre-existing
witness instead of producing a new one.

**Preconditions enforced by the edge function:**

- Caller is admin.
- `policy_override === "back_annotation"`.
- `back_annotation_existing_witness_id` is a UUID present in the request.
- After `adjudicate`, the edge function rewrites the draft:
  - `policy_at_decision = "back_annotation"`
  - `founder_review_flag = true`
  - `witness_intent = "none"` (back-annotation never creates a witness)
- These rewrites happen in the edge function before
  `persistInitialAdmission`, so admit.ts's `validateInput` invariants
  hold (back-annotation path requires intent=none and flag=true).

**Server-side enforcement (already in the RPC):**

- Hard-verifies `(user_id, source_table, source_row_id)` against the
  referenced `witness_objects` row. Mismatch ⇒ `P0001` ⇒ 422
  `back_annotation_verification_failed`.
- Soft drift on `ontology_concept_id` is currently **not** evaluated
  because that column does not yet exist on `witness_objects`. When
  added (separate CodexOS-approved schema change), the RPC will append a
  `back_annotation_concept_drift:` limitation and set
  `founder_review_flag = true`. The edge function does not attempt to
  emulate this client-side.

**Result shape:** identical to the standard path, but
`caw.produced_witness_id` will equal the supplied
`back_annotation_existing_witness_id` and `caw.founder_review_flag` will
be `true`.

---

## 10. Test Plan Before Implementation

All tests live in `supabase/functions/rae-admit-observation/index.test.ts`
(when implemented) and use the in-memory `RpcCapableClient` fake plus
small fakes for the engine-loader and `getClaims`. Tests run under
`deno test --allow-read --allow-env`.

### 10.1 Contract / shape tests

1. Valid request, fresh `caw_id` ⇒ 200, `mode="created"`, CAW row matches
   the orchestrator decision, `witness_id` is non-null when
   `witness_intent="produce_depth0_witness"`.
2. Same request replayed ⇒ 200, `mode="existing"`, CAW unchanged.
3. Response JSON contains exactly the documented top-level keys (no
   stray engine-internal fields, no signal_config leakage).

### 10.2 Auth tests

4. Missing/invalid Bearer ⇒ 401 `unauthenticated`. No DB calls made.
5. `claim.user_id` ≠ `sub`, non-admin ⇒ 403 `auth_user_mismatch`.
6. `policy_override` set by non-admin ⇒ 403 `policy_override_forbidden`.
7. Admin caller with `policy_override="back_annotation"` and
   `back_annotation_existing_witness_id` ⇒ proceeds.

### 10.3 Validation tests

8. Zod failure on missing `claim.observed_at` ⇒ 400 `invalid_request` with
   `details.field_errors.claim`.
9. Empty `siblings` and empty `prior_observations` accepted (engine
   abstains on those signals).
10. `back_annotation` without `back_annotation_existing_witness_id` ⇒
    400 `invalid_request`.

### 10.4 Engine-loader tests

11. Unknown `engine_version_id` ⇒ 422 `registry_gap`.
12. `signal_config` missing for engine version ⇒ 422 `registry_gap`.
13. `edge_loaders` performs only allowed SELECTs (static scan; will be
    added in the loader's own prompt, mirroring §9.8b for `gateway_rpc`).

### 10.5 RPC error mapping tests (against fake `RpcCapableClient`)

14. RPC returns `code=23505` ⇒ 409 `caw_id_conflict`.
15. RPC returns `code=22023, message="…back_annotation requires…"` ⇒
    400 `invalid_storage_input`.
16. RPC returns `code=P0001, message="…back_annotation tuple mismatch…"` ⇒
    422 `back_annotation_verification_failed`.
17. RPC returns `code=P0001, message="rae_insert_witness_object: …"` ⇒
    422 `witness_rejected`.
18. RPC returns `code=P0001, message="caw_ancestry_cross_user: …"` ⇒
    422 `witness_rejected`.
19. RPC returns `code=42501` ⇒ 500 `rae_persist_failed` (insufficient
    privilege ⇒ caller misconfigured serviceRoleClient).
20. RPC returns no data, no error ⇒ 500 `rae_persist_failed`.

### 10.6 Static / closed-write-set guards (extend existing scan)

21. `index.ts` of `rae-admit-observation` contains **no**
    `.from("…").insert/update/delete/upsert` and **no** raw SQL.
22. `index.ts` does not import any reasoning surface (`generate-clusters`,
    `generate-narrative`, `generate-action-plan`, `generate-terrain-render`,
    `patient-chat`).
23. `index.ts` does not import `witnessify_impl` directly.
24. `index.ts` calls `.rpc(…)` only via `makeRpcAdmitGateway` (i.e. no
    inline `.rpc(…)` call elsewhere in the file).
25. The only Supabase write surface invoked transitively is
    `rae_persist_initial_admission` (verified by reusing §9.8b scan
    against `gateway_rpc.ts`).

### 10.7 Integration smoke (only after CodexOS approval to deploy)

26. Deploy `rae-admit-observation` to Lovable Cloud (Test backend),
    `curl` it once with a real engine binding fixture, assert the CAW
    row exists in `concept_assignment_witnesses` and exactly one
    `rae_state_transitions` row references its `caw_id`.
27. Replay the same `curl` ⇒ no new transition row, no new witness row,
    `mode="existing"`.

---

## 11. Non-Goals

This edge function explicitly **does not**:

- Read or write any P1a reasoning table (`clusters`, `cluster_evidence`,
  `derived_patterns`, `patient_narratives`, `action_plans`,
  `terrain_renders`, `observation_packets`, `observation_review_queue`,
  `ontology_concept_proposals`, `review_queue_audit_log`).
- Read or write `patient_lab_observations`, `patient_lab_uploads`,
  `profiles`, `user_roles`. (Engine-binding tables —
  `rae_engine_versions`, `rae_signal_config`,
  `rae_engine_concept_overrides` — are read-only via `edge_loaders`.)
- Implement review-action transitions (auto_admitted ⇄ needs_review,
  rejected ⇆ human_confirmed, etc.). Those belong to a separate function
  fronting `applyReviewAction` (Storage design §6, future prompt).
- Produce any narrative, cluster, plan, terrain artifact, or any other
  reasoning output.
- Surface a fifth admission state.
- Surface FHIR / public API framing or external IDs.
- Ship a UI. Caller is the orchestration layer (or a backend job),
  never the browser directly during P1a.
- Modify schema, add migrations, or alter the RPC.

---

## 12. Open Questions for CodexOS

1. **`edge_loaders.ts` scope.** This design assumes a small read-only
   helper module (engine_version + signal_config + concept overrides)
   created in a follow-up prompt. Confirm that's the right factoring vs.
   inlining the SELECTs in the edge function (with a static-scan
   read-allowlist).
2. **Witness namespace reuse.** Section 5.1 reuses the existing P1a
   witness UUID namespace constant for deterministic `witness_id`. Is
   importing that single constant (no logic) acceptable, or should RAE
   declare its own witness namespace UUID (parallel to
   `RAE_CAW_NAMESPACE`)?
3. **`witness_intent` defaulting.** Should the edge function honor
   `decision.witness_intent` from the orchestrator unconditionally, or
   should an explicit request flag (`request.body.suppress_witness =
   true`) be supported for back-fill admin flows? (Current design says
   no — back-annotation is the only suppression path.)
4. **Sibling/history precomputation source of truth.** This design puts
   the burden of fetching `siblings` / `prior_observations` on the
   caller. Confirm that the caller (orchestration job) already has
   user-scoped access and that this is preferable to a server-side
   read-with-allowlist inside the edge function.

**Awaiting CodexOS approval before implementation.**
