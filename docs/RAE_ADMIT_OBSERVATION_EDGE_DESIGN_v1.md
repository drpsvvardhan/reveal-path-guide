# RAE `rae-admit-observation` Edge Function — Implementation Design v1

> **Status:** Design only. **No edge function is created in this step.**
> No code, no SQL, no migrations are introduced by this document.
> Implementation will follow in a separate, explicitly-approved prompt.

---

## 1. Purpose and Scope

### 1.1 Purpose
`rae-admit-observation` is the transport layer that lets an authenticated
admin caller submit a single `RawObservationClaim` for adjudication by the
Reasoning Admission Engine (RAE) and persist the resulting initial
admission decision through the gateway RPC. It is the **only** sanctioned
entry point for first-time RAE admission from outside the database.

### 1.2 Scope (in)
- Accepting one observation claim + one candidate concept per request.
- Loading the active `EngineBinding` (engine version + signal config +
  optional concept override) for the requested `engine_version_id` /
  `candidate_concept.concept_id`.
- Running `adjudicate()` to produce an `AdmissionDecisionV1`.
- Persisting that decision through `persistInitialAdmission()` via
  `makeRpcAdmitGateway()` → `public.rae_persist_initial_admission`.
- Returning a stable, public-safe JSON response containing the resulting
  `caw_id`, `current_state`, `produced_witness_id`, and override metadata.

### 1.3 Scope (out)
- State transitions after initial admission (review, confirm, reject).
- Bulk admission, backfill, or migration tooling.
- Any P1a reasoning surface, witness narrative generation, or UI binding.
- Direct DB writes, raw SQL, or any path that bypasses the RPC gateway.

---

## 2. Module Reuse

The edge function is a **thin composition** of existing, tested modules.
No engine, storage, or orchestrator semantics change.

| Responsibility | Module | Symbol(s) used |
|---|---|---|
| Engine + signal-config load | `_shared/rae/edge_loaders.ts` | `loadEngineBinding`, `EngineBinding` |
| Candidate-concept binding & override application | `_shared/rae/concept_binding_adapter.ts` | `bindCandidateConceptForAdmission`, `BindCandidateConceptResult` |
| Adjudication | `_shared/rae/orchestrator.ts` | `adjudicate`, `AdmissionDecisionV1`, `RegistryGapError`, `MalformedClaimError`, `NoCandidateConceptError`, `InvalidSignalShapeError`, `UnitNormalizationError` |
| Persistence (typed errors, back-annotation, idempotency) | `_shared/rae/storage/admit.ts` | `persistInitialAdmission`, `WitnessRowInput`, `BackAnnotationVerificationError`, `StorageInputError`, `WitnessifyFailureError`, `TransactionRollbackError` |
| Single RPC write boundary | `_shared/rae/storage/gateway_rpc.ts` | `makeRpcAdmitGateway`, `WitnessPayloadAdapter`, `mapRpcError` |
| Types | `_shared/rae/types.ts` | `RawObservationClaim`, `AdmissionState`, `ConceptAssignmentWitnessDraft` |

No other RAE-internal module is imported. **`witnessify_impl` is not
imported** (see §8 and §12).

---

## 3. File Structure

```
supabase/functions/rae-admit-observation/
├── index.ts                  # HTTP entry, composition only
├── request_schema.ts         # Zod schema + parsed-type exports
├── witness_adapters.ts       # WitnessPayloadAdapter + WitnessRowInput builder
├── error_mapping.ts          # typed-error → HTTP status mapper
├── index.test.ts             # request/response integration tests (mocked deps)
├── request_schema.test.ts    # schema acceptance/rejection cases
├── witness_adapters.test.ts  # depth-0 payload shape + null-on-non-admit
└── static_scan.test.ts       # forbidden-imports / forbidden-DB-access guard
```

No file outside this directory is created or modified.

---

## 4. Exact Request → Processing → Response Flow

`index.ts` performs **exactly** these ordered steps. Any failure short-
circuits to the error mapper in §9.

1. **CORS / method gate.** Accept `POST` and `OPTIONS` only. Anything
   else → `405`.
2. **Body parse.** Read JSON body. Malformed JSON → `400`.
3. **Schema validation.** `RequestSchema.safeParse(body)` (§5).
   Failure → `400` with the Zod issue list (no internals leaked).
4. **Auth: user JWT.** Construct a user-scoped client from the
   `Authorization: Bearer …` header. Missing/invalid → `401`.
5. **Authorization: admin gate.** Server-side check via
   `public.has_role(auth.uid(), 'admin')` using the user-scoped client.
   Not admin → `403`. **No client-supplied role claims are trusted.**
6. **Service-role client.** Construct a separate
   `SUPABASE_SERVICE_ROLE_KEY` client. All subsequent DB I/O uses this
   client only (see §6).
7. **Load engine binding.**
   **C1.** Call as `loadEngineBinding(serviceClient, { engine_version_id,
   candidate_concept_id: req.candidate_concept.concept_id })`. Note the
   two positional arguments: `(client, input)`. `LoadEngineBindingInput`
   does **not** carry the client. Missing rows → `RegistryGapError` → `422`.
8. **Bind candidate concept.**
   `bindCandidateConceptForAdmission({ candidate_concept,
   binding_lookup_concept_id: req.candidate_concept.concept_id,
   binding })`. **C2.** May throw either
   `CandidateConceptShapeError` (malformed/missing fields → `400
   candidate_concept_shape`) or `CandidateConceptMismatchError`
   (`concept_id` ≠ `binding_lookup_concept_id` → `400
   candidate_concept_mismatch`). Both are surfaced per §9.
9. **Adjudicate.** `adjudicate({ claim, candidate_concept,
   signal_config: bound.binding.signal_config,
   engine_version: bound.binding.engine_version,
   siblings, prior_observations })`. Engine errors → §9.
10. **Build witness adapters (two distinct adapters — see §8).**
    `witness_adapters.ts` exports:
    - `makeRaeDepth0WitnessifyAdapter(engineVersionId): WitnessifyAdapter` —
      `(decision: AdmissionDecisionV1) => WitnessRowInput`. Consulted by
      `persistInitialAdmission` **only** when
      `decision.witness_intent === "produce_depth0_witness"`. The
      orchestrator owns the skip decision; this adapter is never asked
      to return `null`.
    - `makeRaeDepth0WitnessPayloadAdapter(): WitnessPayloadAdapter` —
      `(row: WitnessRowInput) => WitnessPayloadShape`. Lifts the slim
      row into the full payload the RPC requires (§8).
11. **Persist via gateway.**
    ```ts
    // C4: makeRpcAdmitGateway requires the WitnessPayloadAdapter.
    const runInTxn = makeRpcAdmitGateway(serviceClient, {
      witnessPayloadAdapter,
    });

    // C3 + C6: persistInitialAdmission takes (input, runInTransaction);
    //          input has { decision, reason, witnessify_adapter?,
    //          back_annotation_witness_id? }. There is no `gateway`,
    //          no `actor`, and no `witnessAdapter` field.
    const result = await persistInitialAdmission(
      {
        decision,
        reason: `rae:initial_admission:${engine_version_id}`,
        witnessify_adapter:
          decision.witness_intent === "produce_depth0_witness"
            ? witnessifyAdapter
            : undefined,
        back_annotation_witness_id:
          decision.caw.policy_at_decision === "back_annotation"
            ? req.back_annotation_witness_id
            : undefined,
      },
      runInTxn,
    );
    ```
    Actor identity is **not** a call argument; it is carried on
    `decision.caw.current_state_actor_kind` / `current_state_actor_id`
    which the orchestrator already sets to `('engine', engine_version_id)`.
    `persistInitialAdmission` enforces back-annotation (§11) and
    idempotency (§10) internally.
12. **Merge override limitations.** The response surfaces
    `bound.override_limitations` and `bound.applied_override_metadata`
    so callers can see calibration routing without DB introspection.
13. **Respond.** `200` with the response body in §5.2.

The function never reads or writes any table directly; **all writes go
through `rae_persist_initial_admission`**.

---

## 5. Request JSON Schema

### 5.1 Request (Zod, strict)

All objects use `.strict()` — unknown keys are rejected.

**C7.** The request's `candidate_concept` MUST be the full
`CandidateConcept` shape from `_shared/rae/orchestrator.ts` so the
orchestrator can adjudicate without an ontology side-load. The edge
function does **not** hydrate concepts from the ontology in this
version (see Open Question #7). Callers are responsible for passing
the full ontology projection. Field-for-field drift between this
schema and `orchestrator.ts CandidateConcept` is a release blocker.

```ts
RawObservationClaim = z.object({
  source_table:        z.string().min(1),
  source_row_id:       z.string().uuid(),
  user_id:             z.string().uuid(),
  raw_name:            z.string().min(1),
  raw_unit:            z.string().nullable(),
  raw_value:           z.number().finite().nullable(),
  raw_method:          z.string().nullable(),
  raw_reference_low:   z.number().finite().nullable(),
  raw_reference_high:  z.number().finite().nullable(),
  observed_at:         z.string().datetime(),
  panel_grouping_key:  z.string().nullable(),
}).strict();

// Mirrors orchestrator.ts CandidateConcept exactly.
UnitConversion = z.object({
  to_canonical_factor: z.number().finite(),
  offset:              z.number().finite().optional(),
}).strict();

RangePair = z.object({
  low:  z.number().finite().nullable(),
  high: z.number().finite().nullable(),
}).strict();

CandidateConcept = z.object({
  concept_id:                 z.string().uuid(),
  canonical_name:             z.string().min(1),
  synonyms:                   z.array(z.string()).optional(),
  ambiguous_alternatives:     z.array(z.string()).optional(),
  canonical_unit:             z.string().min(1),
  unit_conversions:           z.record(z.string(), UnitConversion).optional(),
  plausibility_band:          RangePair.nullable(),
  known_assays:               z.array(z.string()).optional(),
  method_optional:            z.boolean().optional(),
  canonical_reference_range:  RangePair.nullable(),
  expected_panel_concept_ids: z.array(z.string()).optional(),
  panel_id:                   z.string().nullable().optional(),
  dynamics_rule_id:           z.string().nullable(),
  delta_ceiling:              z.number().finite().nullable(),
}).strict();

RequestSchema = z.object({
  engine_version_id:   z.string().uuid(),
  claim:               RawObservationClaim,
  candidate_concept:   CandidateConcept,
  siblings:            z.array(RawObservationClaim).max(64).default([]),
  prior_observations:  z.array(RawObservationClaim).max(256).default([]),
  policy_override:     z.enum([
                         'default',
                         'calibration_all_routes_to_review',
                         'back_annotation',
                       ]).optional(),
  // Required iff policy_at_decision will be 'back_annotation'.
  // The edge function never invents a witness id; storage layer
  // enforces the actual presence rule.
  back_annotation_witness_id: z.string().uuid().optional(),
  request_id:          z.string().uuid().optional(), // caller idempotency hint
}).strict();
```

### 5.2 Response (success, `200`)

```ts
{
  caw_id:                 string,            // uuid (from decision.caw)
  current_state:          AdmissionState,    // exactly one of the 4 locked states
  produced_witness_id:    string | null,     // null for needs_review/rejected
  policy_at_decision:     CalibrationPolicy,
  applied_override:       AppliedOverrideMetadata | null,
  override_limitations:   string[],          // tokens to surface in caller UI/logs
  engine_version_id:      string,
  ontology_version:       string,
  registry_seed_version:  string,
}
```

### 5.3 Response (error)

```ts
{ error: { code: string, message: string, details?: unknown } }
```
`code` is a stable string (e.g. `registry_gap`, `back_annotation_mismatch`),
suitable for caller branching. See §9.

---

## 6. Authentication and Authorization Model

- **Caller auth.** The function requires an `Authorization: Bearer <JWT>`
  header issued by the platform's auth system. Anonymous calls → `401`.
- **Admin gate.** A user-scoped client invokes
  `public.has_role(auth.uid(), 'admin')` (existing `SECURITY DEFINER`
  helper). Non-admin → `403`. The function does not accept any client-
  supplied role hint.
- **Service-role boundary.** Once authorization passes, **all** subsequent
  DB reads (`loadEngineBinding`) and the single RPC write
  (`rae_persist_initial_admission`) use a service-role client constructed
  from `SUPABASE_SERVICE_ROLE_KEY`. This is required because the RPC and
  some registry reads cross RLS boundaries that admin users do not hold
  directly.
- **Two-client rule.** The user-scoped client is used **only** for the
  admin check. It is never reused for engine I/O. The service-role client
  is constructed lazily after the admin check passes; it is never created
  for unauthenticated requests.
- **No service-role key leakage.** The key is read from the function's
  environment, never echoed in responses or logs.

`verify_jwt` for this function: **default (`true`)**. No `config.toml`
override is required.

---

## 7. Policy Override Handling

The orchestrator already owns policy semantics via
`EngineVersionConfig.calibration_mode` and the policy field on the CAW
draft. The edge function only **selects** which policy path is in force
for this request.

| `policy_override` value | Effect |
|---|---|
| omitted / `default` | Use `engine_version` exactly as loaded. No mutation. |
| `calibration_all_routes_to_review` | Force `engine_version.calibration_mode = true` before adjudication. The orchestrator routes every outcome to `needs_review` and stamps `policy_at_decision = 'calibration_all_routes_to_review'`. |
| `back_annotation` | Pass through unchanged to the orchestrator; the back-annotation policy is enforced at the storage layer (§11). The edge function only records the requested policy in the response. |

If a `concept_override` was applied by `bindCandidateConceptForAdmission`,
the resulting binding **already has** `calibration_mode = true`. A caller
`policy_override` of `default` does **not** un-set it — overrides compose
by widening the review path, never by narrowing it. **No fifth admission
state is introduced.**

**C8 — `effect` is synthesized, not loaded.** `loadEngineBinding` returns
a raw `concept_override` row of shape `{ engine_version_id,
candidate_concept_id, reason }` and nothing more. The
`AppliedOverrideMetadata.effect` field surfaced in §5.2 is **computed by
`applyConceptOverrideToBinding` inside `concept_binding_adapter.ts`** —
it is never read from any DB column. The edge function therefore takes
`effect` from `bound.applied_override_metadata`, never from
`bound.binding.concept_override`.

---

## 8. Witness Adapter Design

**C5 — two distinct adapters, two distinct types.** The storage and
gateway layers expose two separate adapter contracts; conflating them is
a type error. `witness_adapters.ts` exports **both** factories:

```ts
// (a) Consumed by persistInitialAdmission via input.witnessify_adapter.
//     Builds the slim row from the orchestrator decision.
export function makeRaeDepth0WitnessifyAdapter(
  engineVersionId: string,
): WitnessifyAdapter; // (decision: AdmissionDecisionV1) => WitnessRowInput

// (b) Consumed by makeRpcAdmitGateway via options.witnessPayloadAdapter.
//     Lifts the slim row into the full WitnessPayloadShape the RPC needs.
export function makeRaeDepth0WitnessPayloadAdapter(
): WitnessPayloadAdapter; // (row: WitnessRowInput) => WitnessPayloadShape
```

### 8.1 `WitnessifyAdapter` (decision → row)

1. Invoked by `persistInitialAdmission` **only** when
   `decision.witness_intent === "produce_depth0_witness"`. The
   orchestrator owns the skip decision; this adapter never returns
   `null` and never inspects `current_state` to decide whether to run.
2. Builds a `WitnessRowInput` whose:
   - `witness_id` is deterministic via
     `uuidv5(RAE_CAW_NAMESPACE, draft.caw_id + ":depth0")`. This makes
     replays idempotent end-to-end (matches §10).
   - `user_id`, `source_table`, `source_row_id` are copied from
     `decision.caw`.
   - `ontology_concept_id` is set to `decision.caw.candidate_concept_id`.
   - `passthrough` carries the fields the RPC's witness path needs
     downstream (e.g. `confidence_value`, `confidence_basis`,
     `limitations`, `engine_version_id`). The storage layer does not
     inspect this object; the payload adapter (§8.2) reads it.

### 8.2 `WitnessPayloadAdapter` (row → full payload)

Lifts a `WitnessRowInput` into the `WitnessPayloadShape` defined in
`gateway_rpc.ts`. This is where the **full** field set required by the
RPC is materialised, including (non-exhaustive): `source_window`,
`signal`, `domain_of_access`, `epistemic_role`, `reliability_class`,
`compression_depth`, `observed_value`, `observed_unit`, `testimony`,
`limitations`, `confidence_value`, `confidence_basis`,
`transformation_version`, `registry_seed_version`. The adapter:

- Reads everything it needs from `row` (and `row.passthrough`); it does
  no I/O.
- Sets `compression_depth = 0` (depth-0 admission).
- Sets `transformation_version` and `registry_seed_version` from the
  values stamped on the row's passthrough by §8.1 (themselves sourced
  from the loaded `EngineBinding`).
- Cannot return `null`; the type forbids it. "Skip witness" is
  expressed by the orchestrator via `witness_intent === "none"` and is
  enforced in §8.1, not here.

### 8.3 Purity and forbidden imports

Both adapters are **pure**: no I/O, no `witnessify_impl` import, no DOM
text generation. Depth-0 admission witnesses for RAE are structurally
simpler than the full witnessify pipeline and must remain decoupled
from it; reusing `witnessify_impl.ts` would drag in surface
dependencies this function must not touch.

---

## 9. Error Mapping Table

All errors are normalized in `error_mapping.ts`.

| Internal error | HTTP | `error.code` | Notes |
|---|---|---|---|
| Zod parse failure | `400` | `invalid_request` | Issues echoed; no stack |
| Missing/invalid JWT | `401` | `unauthenticated` | |
| `has_role` returns false | `403` | `forbidden` | |
| `MalformedClaimError` | `400` | `malformed_claim` | |
| `NoCandidateConceptError` | `400` | `no_candidate_concept` | |
| Concept-id mismatch (adapter) | `400` | `candidate_concept_mismatch` | |
| `InvalidSignalShapeError` | `422` | `invalid_signal_shape` | |
| `UnitNormalizationError` | `422` | `unit_normalization_failed` | |
| `RegistryGapError` (loader or orchestrator) | `422` | `registry_gap` | |
| `StorageInputError` | `400` | `storage_input` | |
| `BackAnnotationVerificationError` | `409` | `back_annotation_mismatch` | See §11 |
| `WitnessifyFailureError` | `502` | `witness_persist_failed` | |
| `TransactionRollbackError` | `500` | `transaction_rolled_back` | |
| RPC error mapped via `mapRpcError` | per mapper | per mapper | Already typed |
| Anything else | `500` | `internal_error` | Message scrubbed |

No SQLSTATE codes or DB messages are leaked to the caller.

---

## 10. Idempotency Behavior

- The orchestrator's `computeCawId(claim, candidate_concept,
  engine_version_id)` is deterministic via `uuidv5` over a stable
  namespace. The same `(claim, candidate_concept, engine_version_id)`
  tuple yields the same `caw_id` across calls.
- `rae_persist_initial_admission` is the single write boundary and is
  designed to be idempotent on `caw_id`: a re-submission returns the
  existing row rather than writing a duplicate. The edge function
  surfaces that result transparently — callers cannot tell whether the
  row was newly created or returned.
- The depth-0 witness id is itself derived from `caw_id` (§8), so witness
  insertion is also idempotent within the same RPC.
- The optional `request_id` field in the request is **advisory**. It is
  recorded in logs only and does not influence persistence; idempotency
  is owned by `caw_id`.
- Replays after a partial failure follow `persistInitialAdmission`'s
  contract: the gateway either commits CAW + witness atomically or rolls
  both back; the edge function never observes a half-written state.

---

## 11. Back-Annotation Behavior

- "Back-annotation" means stamping the underlying source-table row with
  the resulting `caw_id` so downstream consumers can find the witness
  trail. This is performed **inside the RPC**, never by the edge
  function.
- The edge function performs **no direct read or write** of the source
  table named in `claim.source_table`. It does not pre-fetch, validate,
  or back-annotate it from TypeScript.
- `persistInitialAdmission` invokes the gateway, which calls the RPC.
  If the RPC's hard verification step detects that the source row's
  `caw_id` field is already populated with a different value (i.e. a
  back-annotation conflict), it raises an error that the gateway maps to
  `BackAnnotationVerificationError`, which §9 surfaces as
  `409 back_annotation_mismatch`.
- Under `policy_override = 'back_annotation'`, the orchestrator's
  policy field reflects the requested mode and the storage layer applies
  its existing back-annotation rules; the edge function adds no new
  behavior.

---

## 12. Static Scan Constraints

`static_scan.test.ts` reads each file in
`supabase/functions/rae-admit-observation/` as text and asserts:

**Forbidden imports** (must not appear in any source file in the dir):
- `witnessify_impl`
- Any path under `_shared/rae/signals/` (signals are orchestrator-internal)
- Any P1a reasoning surface (the existing migration-guard regex set)
- Direct imports of `_shared/witness.ts` for narrative generation

**Forbidden DB access** (in `index.ts`, `witness_adapters.ts`,
`request_schema.ts`, `error_mapping.ts`):
- `.from(` (no direct table access)
- `.insert(`, `.update(`, `.delete(`, `.upsert(`
- Any `rpc(` call other than the gateway's
  `rae_persist_initial_admission` (which lives in `gateway_rpc.ts`, not
  in this directory)
- Raw SQL string heuristics (`select ... from`, `insert into`,
  `update ... set`, `delete from`)

**Allowed RAE shared imports** (allow-list, not deny-list):
- `_shared/rae/edge_loaders.ts`
- `_shared/rae/concept_binding_adapter.ts`
- `_shared/rae/orchestrator.ts`
- `_shared/rae/storage/admit.ts`
- `_shared/rae/storage/gateway_rpc.ts`
- `_shared/rae/types.ts`

Any other RAE import fails the scan.

The `spec_alignment.test.ts` allow-list is extended (in the
implementation prompt, not now) to cover the new files.

---

## 13. Test Plan (written before implementation)

Tests are authored and committed **before** `index.ts` exists. All DB
and HTTP dependencies are mocked; no real network or RPC calls are made.

### 13.1 `request_schema.test.ts`
- Accepts a minimal valid request.
- Accepts a request with `siblings` and `prior_observations`.
- Rejects unknown top-level keys (`.strict()`).
- Rejects non-UUID `engine_version_id`, `source_row_id`, `user_id`,
  `concept_id`.
- Rejects non-finite `raw_value`, `raw_reference_low/high`.
- Rejects invalid `observed_at` (non-ISO).
- Rejects empty `raw_name` and empty `display_name`.
- Rejects `siblings.length > 64` and `prior_observations.length > 256`.
- Rejects unknown `policy_override` enum values.

### 13.2 `witness_adapters.test.ts`
- Returns `null` for `current_state = 'needs_review'`.
- Returns `null` for `current_state = 'rejected'`.
- Returns a `WitnessRowInput` for `auto_admitted` with deterministic
  `witness_id` derived from `caw_id`.
- Returns a `WitnessRowInput` for `human_confirmed`.
- Copies `confidence_value`, `confidence_basis`, `limitations` verbatim.
- Two calls with the same draft produce identical adapter outputs
  (idempotency at the adapter level).
- No `witnessify_impl` import (asserted in static scan, mirrored here as
  a unit assertion on the file's import list).

### 13.3 `index.test.ts` (with mocked loader / orchestrator / gateway)
- `OPTIONS` returns CORS headers and `204`.
- `GET` / `PUT` / `DELETE` return `405`.
- Missing JWT → `401 unauthenticated`.
- Non-admin user → `403 forbidden` (mocked `has_role` → false).
- Malformed JSON body → `400 invalid_request`.
- Schema failure → `400 invalid_request` with issue list.
- `loadEngineBinding` throws `RegistryGapError` → `422 registry_gap`.
- Concept-id mismatch → `400 candidate_concept_mismatch`.
- `concept_override` present → response shows `calibration_mode` path
  and `current_state = 'needs_review'`; `applied_override` populated.
- `policy_override = 'calibration_all_routes_to_review'` → forces
  `needs_review` regardless of scores.
- `policy_override = 'back_annotation'` → orchestrator sees the policy;
  gateway raises `BackAnnotationVerificationError` → `409`.
- Happy path `auto_admitted` → `200` with non-null
  `produced_witness_id`.
- `needs_review` happy path → `200` with `produced_witness_id = null`.
- Re-submission with identical input → identical `caw_id` and identical
  `produced_witness_id` (idempotency).
- `WitnessifyFailureError` → `502 witness_persist_failed`.
- `TransactionRollbackError` → `500 transaction_rolled_back`.
- Unexpected `Error` → `500 internal_error` with scrubbed message.

### 13.4 `static_scan.test.ts`
- Asserts every constraint enumerated in §12.

### 13.5 Cross-cutting
- Run `spec_alignment.test.ts` (after allow-list update) — all RAE
  shared modules still pass.
- Run all P1a migration guards — must remain green; this function must
  not appear in any P1a guard's scanned set.

---

## 14. Non-Goals

- **No new admission state.** The four-state vocabulary
  (`auto_admitted`, `needs_review`, `rejected`, `human_confirmed`) is
  preserved unchanged.
- **No state transitions** beyond initial admission. Confirm/reject
  flows are a separate, future endpoint.
- **No bulk endpoints.** One claim per request.
- **No P1a reasoning surface access.** Not read, not written, not
  imported.
- **No `witnessify_impl` reuse** for depth-0 admission witnesses.
- **No direct DB writes** from TypeScript. The single write path is the
  gateway RPC.
- **No raw SQL** anywhere in the function's source tree.
- **No FHIR / OpenAPI / external API framing.** The contract is internal
  JSON only.
- **No UI** changes. This is a backend transport layer.
- **No schema or migration changes** in this design or in the eventual
  implementation prompt.

---

## 15. Open Questions (for CodexOS approval)

1. **Admin role granularity.** Is `'admin'` the correct role gate, or
   should a narrower `'rae_operator'` role be introduced before the
   first production caller? (Default assumption: `'admin'`.)
2. **`request_id` handling.** Should `request_id` be persisted alongside
   the CAW for operator log correlation, or remain log-only as currently
   designed? (Default: log-only; persistence would require a schema
   change, which is out of scope.)
3. **`policy_override = 'back_annotation'` exposure.** Should this
   policy be admin-only at the request level, or is the existing
   admin-only function gate sufficient? (Default: function gate is
   sufficient.)
4. **Sibling / prior caps.** The proposed caps (64 siblings, 256 prior
   observations) are conservative defaults to keep request size bounded.
   CodexOS to confirm or adjust.
5. **Response shape stability.** The §5.2 response is intended to be
   stable for downstream tooling. Should we version it (e.g. include a
   `schema_version: '1'` field) before first use?
6. **Error code namespace.** Confirm the §9 `error.code` strings — these
   become a public contract once any external caller branches on them.

---

*End of design. No edge function code, schema, or migration is produced
by this document.*
