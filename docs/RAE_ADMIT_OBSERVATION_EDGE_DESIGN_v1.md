# RAE `rae-admit-observation` Edge Function — Implementation Design v1

Status: **Design only.** No code created. Implements the transport adapter
described in `RAE_EDGE_FUNCTION_WIRING_DESIGN_v1.md` using the already-built
shared modules.

Controlling specs:
- `docs/RAE_EDGE_FUNCTION_WIRING_DESIGN_v1.md`
- `docs/RAE_STORAGE_PERSISTENCE_DESIGN_v1.md`
- `docs/RAE_ORCHESTRATOR_DESIGN_v1.md`

---

## 1. Module reuse (no re-implementation)

| Concern | Module | Symbol |
|---|---|---|
| Engine + signal config load | `_shared/rae/edge_loaders.ts` | `loadEngineBinding` |
| Candidate binding + override | `_shared/rae/concept_binding_adapter.ts` | `bindCandidateConceptForAdmission` |
| Adjudication | `_shared/rae/orchestrator.ts` | `adjudicate` |
| Persistence | `_shared/rae/storage/admit.ts` | `persistInitialAdmission` |
| Gateway | `_shared/rae/storage/gateway_rpc.ts` | `makeRpcAdmitGateway` |

The edge function MUST NOT:
- import `witnessify_impl.ts`
- read or write any P1a reasoning surface
- call `.from(...)` for writes
- issue raw SQL
- reach into ontology tables (loaders are the only DB surface)

---

## 2. File layout

```
supabase/functions/rae-admit-observation/
  index.ts               -- transport, auth, request → modules → response
  request_schema.ts      -- Zod schemas (request + response)
  witness_adapters.ts    -- WitnessRowInput → WitnessPayloadAdapter
  static_scan.test.ts    -- import/surface guardrails
  index.test.ts          -- behavioural tests (mock supabase + gateway)
```

`index.ts` is the only file that constructs a Supabase client.

---

## 3. `index.ts` flow (exact)

```
1.  if req.method === "OPTIONS" → return 204 with corsHeaders
2.  if req.method !== "POST"    → 405 { error: "method_not_allowed" }
3.  parse JSON body. on parse error → 400 { error: "invalid_json" }
4.  RequestSchema.safeParse(body). on fail → 400 { error, fields }
5.  Resolve auth:
       a. Read Authorization: Bearer <jwt>. Missing → 401.
       b. anonClient = createClient(URL, ANON_KEY, { global: { headers: { Authorization }}})
       c. const { data: { user } } = await anonClient.auth.getUser()
          - null → 401 { error: "unauthenticated" }
       d. Admin check (see §4). non-admin → 403.
6.  Build adminClient = createClient(URL, SERVICE_ROLE_KEY,
       { auth: { persistSession: false, autoRefreshToken: false } }).
       This is the ONLY client used for loaders, adjudicate inputs, and
       the RPC gateway.
7.  binding = await loadEngineBinding(adminClient, {
        engine_version_id: body.engine_version_id,
        candidate_concept_id: body.candidate_concept.concept_id,
    })
       - RegistryGapError → 422 { error: "registry_gap", detail }
8.  bound = bindCandidateConceptForAdmission({
        binding_lookup_concept_id: body.candidate_concept.concept_id,
        candidate_concept: body.candidate_concept,
        binding,
    })
       - CandidateConceptShapeError    → 400 { error: "candidate_concept_shape" }
       - CandidateConceptMismatchError → 400 { error: "candidate_concept_mismatch" }
9.  Apply optional `policy_override` (see §5) → final binding + policy hint.
10. decision = adjudicate({
        raw_observation: body.raw_observation,
        candidate_concept: bound.candidate_concept,
        engine_version: bound.binding.engine_version,
        signal_config: bound.binding.signal_config,
        siblings: body.siblings ?? [],
        prior_observations: body.prior_observations ?? [],
        actor: { kind: "engine", id: body.engine_actor_id ?? "rae" },
        policy_hint: appliedPolicyHint,        // see §5
    })
       - merge bound.override_limitations into decision.caw.limitations
         (de-duped, blank-stripped) BEFORE persist.
       - if applied_override present:
           decision.caw.founder_review_flag = true
           decision.caw.policy_at_decision  =
             (already "calibration_all_routes_to_review" via binding)
11. gateway = makeRpcAdmitGateway(adminClient)
12. persisted = await persistInitialAdmission({
        decision,
        witness_payload: maybeWitnessPayload(decision, body),  // §6
        back_annotation_existing_witness_id:
            body.back_annotation?.existing_witness_id ?? null,
        gateway,
    })
       - typed storage errors → §7 mapping
13. Build ResponseSchema payload:
       {
         mode: persisted.mode,                       // "created" | "existing"
         caw_id: persisted.caw.caw_id,
         current_state: persisted.caw.current_state,
         produced_witness_id: persisted.witness_id,
         confidence_value: persisted.caw.confidence_value,
         confidence_basis: persisted.caw.confidence_basis,
         limitations: persisted.caw.limitations,
         policy_at_decision: persisted.caw.policy_at_decision,
         founder_review_flag: persisted.caw.founder_review_flag,
         applied_override: bound.applied_override_metadata,
         engine_version: { id, semver, registry_seed_version, ontology_version }
       }
14. return 200 JSON.
```

All responses use `corsHeaders`. All thrown errors caught at top-level →
`{ error: "internal_error", correlation_id }`, status 500, no stack
leakage.

---

## 4. Zod request schema

`request_schema.ts`:

```ts
const RawObservationClaimSchema = z.object({
  source_table: z.string().min(1),
  source_row_id: z.string().uuid(),
  user_id: z.string().uuid(),
  raw_name: z.string().min(1),
  raw_unit: z.string().nullable(),
  raw_value: z.number().nullable(),
  raw_method: z.string().nullable(),
  raw_reference_low: z.number().nullable(),
  raw_reference_high: z.number().nullable(),
  observed_at: z.string().datetime(),
  panel_grouping_key: z.string().nullable(),
});

const CandidateConceptSchema = z.object({
  concept_id: z.string().min(1),
  display_name: z.string().min(1),
  expected_unit: z.string().nullable(),
  expected_method: z.string().nullable(),
  panel_membership: z.array(z.string()).default([]),
});

const SiblingSchema = z.object({
  source_row_id: z.string().uuid(),
  raw_name: z.string(),
  raw_unit: z.string().nullable(),
  raw_value: z.number().nullable(),
});

const PriorObservationSchema = z.object({
  witness_id: z.string().uuid(),
  observed_at: z.string().datetime(),
  unit_normalized_value: z.number().nullable(),
  canonical_unit: z.string().nullable(),
});

const BackAnnotationSchema = z.object({
  existing_witness_id: z.string().uuid(),
});

const PolicyOverrideSchema = z.enum([
  "calibration_all_routes_to_review",
  "back_annotation",
]);

export const AdmitRequestSchema = z.object({
  engine_version_id: z.string().uuid(),
  engine_actor_id: z.string().min(1).optional(),
  raw_observation: RawObservationClaimSchema,
  candidate_concept: CandidateConceptSchema,
  siblings: z.array(SiblingSchema).max(64).optional(),
  prior_observations: z.array(PriorObservationSchema).max(256).optional(),
  policy_override: PolicyOverrideSchema.optional(),
  back_annotation: BackAnnotationSchema.optional(),
}).strict()
  .refine(
    (b) => b.raw_observation.user_id !== undefined,
    { message: "user_id required on raw_observation" },
  )
  .refine(
    (b) => b.policy_override !== "back_annotation" || !!b.back_annotation,
    { message: "back_annotation required when policy_override='back_annotation'" },
  );
```

Strict mode rejects unknown fields → no silent extra payload.

---

## 5. Auth & admin boundary

- Request **must** carry a user JWT; service-role JWTs are rejected
  (validate `user.aud === "authenticated"` and `user.role !== "service_role"`).
- Admin gate: `has_role(user.id, 'admin')` via `anonClient.rpc('has_role', ...)`.
  Non-admin → 403 `{ error: "forbidden_admin_required" }`.
- Once admin verified, **all subsequent DB work uses the service-role
  client** (loaders + RPC). The user JWT is not propagated downstream;
  the RPC is `SECURITY DEFINER` and asserts shape internally.
- `verify_jwt = false` in `supabase/config.toml` (Lovable default). In-code
  validation above is the actual security boundary.

---

## 6. `policy_override` handling

| Inbound `policy_override` | Effect |
|---|---|
| absent | `policy_hint = "default"`. Concept-override path may still force calibration via `bindCandidateConceptForAdmission` (handled inside the binding). |
| `"calibration_all_routes_to_review"` | Set `binding.engine_version.calibration_mode = true` post-bind (idempotent if already true). `policy_hint = "calibration_all_routes_to_review"`. Append limitation `policy_override:calibration_all_routes_to_review`. |
| `"back_annotation"` | `policy_hint = "back_annotation"`. Requires `back_annotation.existing_witness_id`. Append limitation `policy_override:back_annotation`. The actual back-annotation tuple verification happens server-side in `rae_persist_initial_admission` — the edge function does **not** read `witness_objects`. |

Override never introduces a fifth admission state. The orchestrator + DB
function remain the only deciders of `current_state`.

`founder_review_flag` is forced `true` whenever:
- a concept_override was applied, OR
- `policy_override` was used, OR
- DB reports `back_annotation_concept_drift:` limitation (future, when
  `witness_objects.ontology_concept_id` exists).

---

## 7. Witness adapters

`witness_adapters.ts` exposes:

```ts
export interface WitnessRowInput {
  user_id: string;
  source_table: string;
  source_row_id: string;
  observed_at: string;                  // biological_timestamp
  observed_value: unknown;              // jsonb
  observed_unit: string | null;
  signal: string;                       // candidate_concept_id by default
  testimony: string;                    // confidence_basis text
  limitations: string[];
  confidence_value: number;
  confidence_basis: string;
  registry_seed_version: string;
  transformation_version: string;
  validity_window_seconds: number | null;
}

export function buildWitnessPayloadFromDecision(
  decision: AdmissionDecision,
  ctx: { request_user_id: string; raw: RawObservationClaim; engine: EngineVersionConfig },
): WitnessPayloadAdapter | null
```

Rules:
1. Returns `null` unless `decision.caw.current_state ∈ {auto_admitted, human_confirmed}`.
2. Hard-asserts `decision.caw.user_id === ctx.request_user_id` (defense in
   depth against spoofed payloads).
3. Maps:
   - `witness_id` = freshly minted UUID (deterministic per `caw_id` for
     idempotency: `uuidv5(caw_id, RAE_NS)` — keeps RPC `ON CONFLICT` clean).
   - `source_window` = `"point"` (default per spec).
   - `domain_of_access` = `"clinical_lab"` for the lab path; pulled from
     the engine binding metadata (`engine.domain_of_access` if present,
     fallback `"clinical_lab"`).
   - `epistemic_role` = `"observation"`.
   - `reliability_class` = derived from `decision.caw.confidence_value`
     bands (≥0.85 `"high"`, ≥0.6 `"medium"`, else `"low"`).
   - `compression_depth` = `0`.
   - `observed_value` = `{ value, unit_normalized_value, plausibility_band }`
     pulled from the value SignalEvidence.
   - `observed_unit` = canonical unit from UnitEvidence (or raw fallback).
   - `testimony` = `decision.caw.confidence_basis`.
   - `limitations` = `decision.caw.limitations` (already merged with
     override tokens).
   - `confidence_value` / `confidence_basis` = from CAW.
   - `biological_timestamp` = `ctx.raw.observed_at`.
   - `validity_window_seconds` = registry-declared; `null` if absent.
   - `transformation_version` = `engine.semver`.
   - `registry_seed_version` = `engine.registry_seed_version`.
   - `ancestry_witness_ids` = `[]` (depth-0).
   - `derived_from_packet_id` = `null`.
   - `conflict_candidates` = `null`.
4. Adapter does **no I/O** and imports nothing from storage or witnessify.

`maybeWitnessPayload(decision, body)` in `index.ts` is a one-line wrapper
that calls the adapter and returns `null` for review/rejected states.

---

## 8. Error mapping (caller-facing)

| Source | Detection | HTTP | body.error |
|---|---|---|---|
| JSON parse | try/catch | 400 | `invalid_json` |
| Zod | `safeParse` | 400 | `invalid_request` (+ `fields`) |
| Missing JWT | header absent | 401 | `unauthenticated` |
| Invalid JWT / no user | `getUser()` null | 401 | `unauthenticated` |
| Service-role JWT | role check | 403 | `service_role_forbidden` |
| Non-admin | `has_role` false | 403 | `forbidden_admin_required` |
| `RegistryGapError` | thrown by loader | 422 | `registry_gap` (+ detail) |
| `CandidateConceptShapeError` | adapter | 400 | `candidate_concept_shape` |
| `CandidateConceptMismatchError` | adapter | 400 | `candidate_concept_mismatch` |
| `AdmitPayloadInvalidError` | gateway map of `22023` | 400 | `payload_invalid` |
| `AdmitBackAnnotationMismatchError` | gateway map of `P0001` `back_annotation tuple mismatch` | 409 | `back_annotation_mismatch` |
| `AdmitBackAnnotationMissingError` | gateway map of `P0001` `not found` | 404 | `back_annotation_witness_not_found` |
| `AdmitWitnessUnresolvableError` | gateway map of `P0001` witness insert | 500 | `witness_insert_failed` |
| `AdmitTransportError` | network / unknown SQLSTATE | 502 | `gateway_transport` |
| Anything else | top-level catch | 500 | `internal_error` (+ `correlation_id`) |

Storage errors are the typed errors already exported by
`gateway_rpc.ts`; the edge function only re-maps them — it does not
inspect SQLSTATE itself.

---

## 9. Static scans (`static_scan.test.ts`)

Source of `index.ts`, `request_schema.ts`, `witness_adapters.ts` must:
- import from only:
  - `npm:@supabase/supabase-js`
  - `npm:zod`
  - `_shared/rae/edge_loaders.ts`
  - `_shared/rae/concept_binding_adapter.ts`
  - `_shared/rae/orchestrator.ts`
  - `_shared/rae/storage/admit.ts`
  - `_shared/rae/storage/gateway_rpc.ts`
  - `_shared/rae/types.ts`
- forbid:
  - `witnessify_impl`
  - `_shared/rae/storage/` paths other than `admit.ts` / `gateway_rpc.ts`
  - any of the P1a tables (`reasoning_traces`, `terrain_renders`,
    `patient_narratives`, `action_plans`, `cie_assessments`,
    `clusters`, `cluster_relations`, `cluster_evidence`, `witness_objects`,
    `concept_assignment_witnesses`, `rae_state_transitions`,
    `patient_lab_observations`)
  - write verbs on Supabase client: `.insert`, `.update`, `.delete`,
    `.upsert`
  - raw SQL: `select `, `insert into`, `update `, `delete from`,
    `execute_sql`, `rpc("execute`
  - `.rpc("rae_` calls **except** through `gateway_rpc.ts`
    (i.e., `index.ts` itself must not call any `rae_*` RPC directly)
- require: exactly one `.rpc("has_role"...)` call in `index.ts` and
  no other `.rpc(` outside the gateway.

Add the new files to `spec_alignment.test.ts` allowlist.

---

## 10. Tests written **before** implementation

`index.test.ts` (Deno test, mocks supabase client + gateway):

1. `OPTIONS` → 204 + corsHeaders.
2. `GET` → 405.
3. invalid JSON → 400 `invalid_json`.
4. Zod fail (missing `engine_version_id`) → 400 `invalid_request`.
5. no Authorization header → 401.
6. JWT resolves to no user → 401.
7. authenticated non-admin → 403 `forbidden_admin_required`.
8. admin + `RegistryGapError` from loader → 422 `registry_gap`.
9. admin + concept mismatch (cc.concept_id ≠ binding lookup) → 400
   `candidate_concept_mismatch`.
10. happy `auto_admitted` path → 200, response includes
    `produced_witness_id`, gateway called once with `witness_payload`
    non-null.
11. `needs_review` decision → 200, `produced_witness_id: null`,
    gateway called with `witness_payload: null`.
12. `policy_override="back_annotation"` without `back_annotation` block
    → 400 `invalid_request`.
13. `policy_override="back_annotation"` with mismatched tuple → gateway
    throws `AdmitBackAnnotationMismatchError` → 409.
14. `policy_override="calibration_all_routes_to_review"` → response
    `policy_at_decision === "calibration_all_routes_to_review"`,
    `founder_review_flag === true`, limitations contain
    `policy_override:calibration_all_routes_to_review`.
15. concept_override active → response `applied_override` non-null and
    `current_state === "needs_review"`.
16. idempotency: second call returns `mode: "existing"` and same
    `caw_id` / `produced_witness_id`.

`witness_adapters.test.ts`:

a. returns `null` for `needs_review` / `rejected`.
b. returns full adapter for `auto_admitted` with all required fields.
c. cross-user `caw.user_id ≠ request_user_id` → throws.
d. derives `reliability_class` bands from confidence value.
e. uses `engine.semver` as `transformation_version` and
   `engine.registry_seed_version` for the seed field.
f. deterministic `witness_id` for the same `caw_id`.

`static_scan.test.ts`: as in §9.

`spec_alignment.test.ts`: extend allowlist for the four new files.

All tests authored and committed BEFORE `index.ts` is implemented; a
final pre-implementation run shows them failing only on “module not
found” / “not yet implemented” for `index.ts` and adapters, not on
guard violations.

---

## 11. Non-goals

- No FHIR shape, no public API framing.
- No new admission state.
- No edits to orchestrator semantics, `admit.ts`, `gateway_rpc.ts`,
  `concept_binding*`, or `edge_loaders.ts`.
- No schema changes, no migrations.
- No UI changes.
- No reads against `witness_objects` from the edge function — that
  remains DB-side in `rae_persist_initial_admission`.
- No direct `.rpc("rae_*")` from `index.ts`.

---

## 12. Out-of-scope follow-ups (recorded for future prompts)

- Soft drift (`back_annotation_concept_drift:`) re-enabled once
  `witness_objects.ontology_concept_id` exists.
- A non-admin "submit-for-review" variant (would be a separate edge
  function, not this one).
- Batch endpoint (`rae-admit-observations-batch`) reusing the same
  modules.
