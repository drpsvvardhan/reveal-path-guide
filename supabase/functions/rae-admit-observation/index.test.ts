// ============================================================================
// index.test.ts — design §13.3 (pure projection-helper coverage).
// ----------------------------------------------------------------------------
// The wired entry point's HTTP/auth/I/O behavior is exercised by deployed
// integration tests; this file pins the deterministic, in-process pieces of
// `index.ts` that we can assert without spinning up Deno.serve, the auth
// system, or the database:
//
//   - projectCandidateConcept: transport->orchestrator UnitConversion shape.
//   - projectSiblings: drop rows missing concept_id; never fabricate.
//   - projectPriorObservations: drop rows missing finite raw_value.
//
// These three helpers are the wiring boundary's only behavior with branching
// logic, so their contracts here also act as guard-rails against silent
// drift between the request schema and the orchestrator types.
// ============================================================================

import { assert, assertEquals } from "jsr:@std/assert@1.0.0";
import {
  projectCandidateConcept,
  projectPriorObservations,
  projectSiblings,
} from "./index.ts";
import type { AdmitObservationRequest } from "./request_schema.ts";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const UUID_D = "44444444-4444-4444-8444-444444444444";
const UUID_E = "55555555-5555-4555-8555-555555555555";

function mkClaim(
  overrides: Partial<AdmitObservationRequest["claim"]> = {},
): AdmitObservationRequest["claim"] {
  return {
    source_table: "patient_lab_observations",
    source_row_id: UUID_A,
    user_id: UUID_B,
    raw_name: "Glucose",
    raw_unit: "mg/dL",
    raw_value: 92,
    raw_method: null,
    raw_reference_low: 70,
    raw_reference_high: 99,
    observed_at: "2025-01-15T10:00:00Z",
    panel_grouping_key: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// projectCandidateConcept.
// ---------------------------------------------------------------------------

Deno.test("projectCandidateConcept: passes through when no unit_conversions", () => {
  const cc: AdmitObservationRequest["candidate_concept"] = {
    concept_id: UUID_C,
    canonical_name: "Glucose",
    canonical_unit: "mg/dL",
    plausibility_band: { low: 20, high: 600 },
    canonical_reference_range: { low: 70, high: 99 },
    dynamics_rule_id: null,
    delta_ceiling: null,
  };
  const out = projectCandidateConcept(cc);
  assertEquals(out.unit_conversions, undefined);
  assertEquals(out.concept_id, UUID_C);
  assertEquals(out.canonical_unit, "mg/dL");
});

Deno.test("projectCandidateConcept: maps to_canonical_factor -> factor and synthesizes conversion_id", () => {
  const cc: AdmitObservationRequest["candidate_concept"] = {
    concept_id: UUID_C,
    canonical_name: "Glucose",
    canonical_unit: "mg/dL",
    unit_conversions: {
      "mmol/L": { to_canonical_factor: 18.0 },
      "g/L": { to_canonical_factor: 100, offset: 0 },
    },
    plausibility_band: null,
    canonical_reference_range: null,
    dynamics_rule_id: null,
    delta_ceiling: null,
  };
  const out = projectCandidateConcept(cc);
  assert(out.unit_conversions);
  assertEquals(out.unit_conversions!["mmol/L"].factor, 18.0);
  assertEquals(out.unit_conversions!["mmol/L"].conversion_id, "req:mmol/L");
  assertEquals(out.unit_conversions!["g/L"].factor, 100);
  assertEquals(out.unit_conversions!["g/L"].conversion_id, "req:g/L");
});

// ---------------------------------------------------------------------------
// projectSiblings (decision 4).
// ---------------------------------------------------------------------------

Deno.test("projectSiblings: keeps siblings carrying concept_id; observation_id = source_row_id", () => {
  const siblings: AdmitObservationRequest["siblings"] = [
    mkClaim({ source_row_id: UUID_A, concept_id: UUID_C }),
    mkClaim({ source_row_id: UUID_B, concept_id: UUID_D }),
  ];
  const { rows, dropped } = projectSiblings(siblings);
  assertEquals(dropped, 0);
  assertEquals(rows.length, 2);
  assertEquals(rows[0], { observation_id: UUID_A, concept_id: UUID_C });
  assertEquals(rows[1], { observation_id: UUID_B, concept_id: UUID_D });
});

Deno.test("projectSiblings: drops siblings missing concept_id and counts them", () => {
  const siblings: AdmitObservationRequest["siblings"] = [
    mkClaim({ source_row_id: UUID_A, concept_id: UUID_C }),
    mkClaim({ source_row_id: UUID_B }), // no concept_id
    mkClaim({ source_row_id: UUID_E }), // no concept_id
  ];
  const { rows, dropped } = projectSiblings(siblings);
  assertEquals(dropped, 2);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].concept_id, UUID_C, "must NOT fabricate concept_id");
});

Deno.test("projectSiblings: empty input yields zero rows and zero drops", () => {
  const { rows, dropped } = projectSiblings([]);
  assertEquals(rows.length, 0);
  assertEquals(dropped, 0);
});

// ---------------------------------------------------------------------------
// projectPriorObservations.
// ---------------------------------------------------------------------------

Deno.test("projectPriorObservations: keeps finite raw_value rows", () => {
  const priors: AdmitObservationRequest["prior_observations"] = [
    mkClaim({ source_row_id: UUID_A, raw_value: 88, observed_at: "2024-01-01T00:00:00Z" }),
    mkClaim({ source_row_id: UUID_B, raw_value: 91, observed_at: "2024-06-01T00:00:00Z" }),
  ];
  const { rows, dropped } = projectPriorObservations(priors);
  assertEquals(dropped, 0);
  assertEquals(rows.length, 2);
  assertEquals(rows[0], {
    witness_id: UUID_A,
    value: 88,
    observed_at: "2024-01-01T00:00:00Z",
  });
});

Deno.test("projectPriorObservations: drops null raw_value and counts the drop", () => {
  const priors: AdmitObservationRequest["prior_observations"] = [
    mkClaim({ source_row_id: UUID_A, raw_value: 88 }),
    mkClaim({ source_row_id: UUID_B, raw_value: null }),
  ];
  const { rows, dropped } = projectPriorObservations(priors);
  assertEquals(dropped, 1);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].witness_id, UUID_A);
});

Deno.test("projectPriorObservations: empty input yields zero rows and zero drops", () => {
  const { rows, dropped } = projectPriorObservations([]);
  assertEquals(rows.length, 0);
  assertEquals(dropped, 0);
});

// ============================================================================
// HTTP-level handler tests (design §13.3, full mocked deps).
// ----------------------------------------------------------------------------
// These exercise handle() end-to-end with every external seam stubbed:
//   - getUserIdFromJwt and hasAdminRole (no auth round-trip)
//   - loadEngineBinding (no DB read)
//   - bindCandidateConceptForAdmission (pure)
//   - adjudicate (synthetic AdmissionDecisionV1)
//   - persistInitialAdmission (synthetic CAW; no RPC)
//   - makeRpcAdmitGateway / makeServiceClient (sentinel stubs)
//
// We never mutate shared modules. We never bind a port (handle is invoked
// in-process). Required env vars are set just before each handler test.
// ============================================================================

import { handle, type HandleDeps } from "./index.ts";
import type { EngineBinding } from "../_shared/rae/edge_loaders.ts";
import type { AdmissionDecisionV1 } from "../_shared/rae/orchestrator.ts";
import type {
  ConceptAssignmentWitness,
  SignalResult,
} from "../_shared/rae/types.ts";
import { RegistryGapError } from "../_shared/rae/orchestrator.ts";

// ---------------------------------------------------------------------------
// Env scaffolding. Set once; handle() reads them per-call.
// ---------------------------------------------------------------------------

function setEnv() {
  Deno.env.set("SUPABASE_URL", "https://test.supabase.local");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "srv-test-key");
}

// ---------------------------------------------------------------------------
// Synthetic fixture builders (kept local; never imported by production code).
// ---------------------------------------------------------------------------

const ENGINE_VERSION_ID = "66666666-6666-4666-8666-666666666666";
const USER_ID = "77777777-7777-4777-8777-777777777777";
const CONCEPT_ID = "33333333-3333-4333-8333-333333333333";
const ROW_ID = "11111111-1111-4111-8111-111111111111";
const CAW_ID = "88888888-8888-4888-8888-888888888888";
const WITNESS_ID = "99999999-9999-4999-8999-999999999999";
const BACK_ANN_WID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function mkRequestBody(over: Record<string, unknown> = {}): unknown {
  return {
    engine_version_id: ENGINE_VERSION_ID,
    claim: {
      source_table: "patient_lab_observations",
      source_row_id: ROW_ID,
      user_id: USER_ID,
      raw_name: "Glucose",
      raw_unit: "mg/dL",
      raw_value: 92,
      raw_method: null,
      raw_reference_low: 70,
      raw_reference_high: 99,
      observed_at: "2025-01-15T10:00:00Z",
      panel_grouping_key: null,
    },
    candidate_concept: {
      concept_id: CONCEPT_ID,
      canonical_name: "Glucose, serum",
      canonical_unit: "mg/dL",
      plausibility_band: { low: 20, high: 600 },
      canonical_reference_range: { low: 70, high: 99 },
      dynamics_rule_id: null,
      delta_ceiling: null,
    },
    ...over,
  };
}

function mkBinding(): EngineBinding {
  return {
    engine_version: {
      engine_version_id: ENGINE_VERSION_ID,
      semver: "1.0.0",
      registry_seed_version: "rsv-1",
      ontology_version: "ov-1",
      threshold_admission: 0.7,
      threshold_rejection_floor: 0.3,
      calibration_mode: false,
    },
    signal_config: {
      lexical: { weight: 1, parameters: {} },
      unit: { weight: 1, parameters: {} },
      value: { weight: 1, parameters: {} },
      method: { weight: 1, parameters: {} },
      ref_range: { weight: 1, parameters: {} },
      panel: { weight: 1, parameters: {} },
      longitudinal: { weight: 1, parameters: {} },
    } as unknown as EngineBinding["signal_config"],
    concept_override: null,
  };
}

function mkSignalResults(): SignalResult[] {
  // Minimum sanity: orchestrator never inspects the synthetic decision in
  // these tests because we mock `adjudicate`. Any well-formed array works.
  return [
    {
      signal_id: "lexical",
      band: "pass",
      score: 1,
      weight: 1,
      contributes_to_denominator: true,
      evidence: { signal_id: "lexical", matched_name: "Glucose", match_type: "exact" },
      notes: [],
    },
  ];
}

function mkDecision(over: {
  state?: "auto_admitted" | "needs_review" | "rejected" | "human_confirmed";
  intent?: "produce_depth0_witness" | "none";
  policy?: "default" | "calibration_all_routes_to_review" | "back_annotation";
} = {}): AdmissionDecisionV1 {
  const state = over.state ?? "auto_admitted";
  const intent = over.intent ??
    (state === "auto_admitted" ? "produce_depth0_witness" : "none");
  return {
    caw: {
      caw_id: CAW_ID,
      user_id: USER_ID,
      source_table: "patient_lab_observations",
      source_row_id: ROW_ID,
      candidate_concept_id: CONCEPT_ID,
      ontology_version: "ov-1",
      registry_seed_version: "rsv-1",
      engine_version_id: ENGINE_VERSION_ID,
      current_state: state,
      current_state_actor_kind: "engine",
      current_state_actor_id: "rae",
      signal_results: mkSignalResults(),
      composite_identity_score: 0.9,
      coherence_result: "pass",
      confidence_value: 0.9,
      confidence_basis: "synthetic basis sufficient length for invariant.",
      limitations: ["synthetic:test"],
      produced_witness_id: null,
      policy_at_decision: over.policy ?? "default",
      founder_review_flag: false,
    },
    witness_intent: intent,
  };
}

function mkPersistedCaw(over: {
  state?: "auto_admitted" | "needs_review" | "rejected" | "human_confirmed";
  produced_witness_id?: string | null;
  policy?: "default" | "calibration_all_routes_to_review" | "back_annotation";
} = {}): ConceptAssignmentWitness {
  const state = over.state ?? "auto_admitted";
  const wid = "produced_witness_id" in over ? over.produced_witness_id! : WITNESS_ID;
  return {
    ...mkDecision({ state, policy: over.policy }).caw,
    produced_witness_id: wid,
    id: "row-id",
    current_state_entered_at: "2025-01-15T10:00:01Z",
    created_at: "2025-01-15T10:00:01Z",
    updated_at: "2025-01-15T10:00:01Z",
  };
}

// Default mock deps: every seam succeeds happily. Individual tests override.
function happyDeps(): HandleDeps {
  return {
    getUserIdFromJwt: () => Promise.resolve(USER_ID),
    hasAdminRole: () => Promise.resolve(true),
    loadEngineBinding: (() => Promise.resolve(mkBinding())) as unknown as HandleDeps["loadEngineBinding"],
    bindCandidateConceptForAdmission: ((input: { candidate_concept: unknown; binding: unknown }) => ({
      candidate_concept: input.candidate_concept!,
      binding: input.binding,
      applied_override: null,
      applied_override_metadata: null,
      override_limitations: [],
    })) as unknown as HandleDeps["bindCandidateConceptForAdmission"],
    adjudicate: (() => mkDecision()) as unknown as HandleDeps["adjudicate"],
    persistInitialAdmission: (() =>
      Promise.resolve({
        mode: "created" as const,
        caw: mkPersistedCaw(),
      })) as unknown as HandleDeps["persistInitialAdmission"],
    makeRpcAdmitGateway: (() =>
      ((body: (gw: unknown) => Promise<unknown>) =>
        body({} as unknown))) as unknown as HandleDeps["makeRpcAdmitGateway"],
    makeServiceClient: () => ({}),
  };
}

function postReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://local/x", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer fake-jwt",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// 1. OPTIONS → 204 + CORS headers.
// ---------------------------------------------------------------------------

Deno.test("handle: OPTIONS returns 204 with CORS headers", async () => {
  setEnv();
  const res = await handle(new Request("http://local/x", { method: "OPTIONS" }));
  assertEquals(res.status, 204);
  assert(res.headers.get("Access-Control-Allow-Origin") === "*");
  assert(res.headers.get("Access-Control-Allow-Methods")?.includes("POST"));
  await res.body?.cancel();
});

// ---------------------------------------------------------------------------
// 2. Non-POST → 405.
// ---------------------------------------------------------------------------

Deno.test("handle: GET returns 405 method_not_allowed", async () => {
  setEnv();
  const res = await handle(new Request("http://local/x", { method: "GET" }));
  assertEquals(res.status, 405);
  const body = await res.json();
  assertEquals(body.error.code, "method_not_allowed");
});

// ---------------------------------------------------------------------------
// 3. Invalid JSON → 400.
// ---------------------------------------------------------------------------

Deno.test("handle: invalid JSON body returns 400 invalid_request", async () => {
  setEnv();
  const res = await handle(
    new Request("http://local/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{",
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error.code, "invalid_request");
});

// ---------------------------------------------------------------------------
// 4. Schema failure → 400.
// ---------------------------------------------------------------------------

Deno.test("handle: schema-invalid body returns 400 invalid_request", async () => {
  setEnv();
  const res = await handle(postReq({ engine_version_id: "not-a-uuid" }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error.code, "invalid_request");
});

// ---------------------------------------------------------------------------
// 5. Missing Authorization → 401.
// ---------------------------------------------------------------------------

Deno.test("handle: missing Authorization header returns 401", async () => {
  setEnv();
  const req = new Request("http://local/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mkRequestBody()),
  });
  const res = await handle(req);
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error.code, "unauthenticated");
});

// ---------------------------------------------------------------------------
// 6. Mocked getUser null → 401.
// ---------------------------------------------------------------------------

Deno.test("handle: invalid JWT (getUser null) returns 401", async () => {
  setEnv();
  const deps = happyDeps();
  deps.getUserIdFromJwt = () => Promise.resolve(null);
  const res = await handle(postReq(mkRequestBody()), deps);
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error.code, "unauthenticated");
});

// ---------------------------------------------------------------------------
// 7. Mocked has_role false → 403.
// ---------------------------------------------------------------------------

Deno.test("handle: non-admin caller returns 403", async () => {
  setEnv();
  const deps = happyDeps();
  deps.hasAdminRole = () => Promise.resolve(false);
  const res = await handle(postReq(mkRequestBody()), deps);
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.error.code, "forbidden");
});

// ---------------------------------------------------------------------------
// 8. loadEngineBinding throws RegistryGapError → 422.
// ---------------------------------------------------------------------------

Deno.test("handle: RegistryGapError from loader maps to 422 registry_gap", async () => {
  setEnv();
  const deps = happyDeps();
  deps.loadEngineBinding = (() =>
    Promise.reject(new RegistryGapError("missing seed for engine version"))) as unknown as HandleDeps["loadEngineBinding"];
  const res = await handle(postReq(mkRequestBody()), deps);
  assertEquals(res.status, 422);
  const body = await res.json();
  assertEquals(body.error.code, "registry_gap");
});

// ---------------------------------------------------------------------------
// 9. Happy auto_admitted path → 200 with diagnostics.
// ---------------------------------------------------------------------------

Deno.test("handle: happy auto_admitted path returns 200 with diagnostics", async () => {
  setEnv();
  const deps = happyDeps();
  const res = await handle(
    postReq(mkRequestBody({
      siblings: [
        {
          source_table: "patient_lab_observations",
          source_row_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          user_id: USER_ID,
          raw_name: "HDL",
          raw_unit: "mg/dL",
          raw_value: 50,
          raw_method: null,
          raw_reference_low: null,
          raw_reference_high: null,
          observed_at: "2025-01-15T10:00:00Z",
          panel_grouping_key: null,
          // No concept_id => dropped.
        },
      ],
      prior_observations: [
        {
          source_table: "patient_lab_observations",
          source_row_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          user_id: USER_ID,
          raw_name: "Glucose",
          raw_unit: "mg/dL",
          raw_value: null, // dropped
          raw_method: null,
          raw_reference_low: null,
          raw_reference_high: null,
          observed_at: "2024-06-15T10:00:00Z",
          panel_grouping_key: null,
        },
      ],
    })),
    deps,
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.caw_id, CAW_ID);
  assertEquals(body.current_state, "auto_admitted");
  assertEquals(body.produced_witness_id, WITNESS_ID);
  assertEquals(body.engine_version_id, ENGINE_VERSION_ID);
  assertEquals(body.diagnostics, {
    dropped_siblings: 1,
    dropped_prior_observations: 1,
  });
});

// ---------------------------------------------------------------------------
// 10. Happy needs_review path → 200 with produced_witness_id null.
// ---------------------------------------------------------------------------

Deno.test("handle: needs_review decision returns 200 with null produced_witness_id", async () => {
  setEnv();
  const deps = happyDeps();
  deps.adjudicate = (() => mkDecision({ state: "needs_review", intent: "none" })) as unknown as HandleDeps["adjudicate"];
  deps.persistInitialAdmission = (() =>
    Promise.resolve({
      mode: "created" as const,
      caw: mkPersistedCaw({ state: "needs_review", produced_witness_id: null }),
    })) as unknown as HandleDeps["persistInitialAdmission"];
  const res = await handle(postReq(mkRequestBody()), deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.current_state, "needs_review");
  assertEquals(body.produced_witness_id, null);
});

// ---------------------------------------------------------------------------
// 11. policy_override='back_annotation' WITHOUT witness id → 400.
// ---------------------------------------------------------------------------

Deno.test("handle: back_annotation override without witness_id returns 400", async () => {
  setEnv();
  const res = await handle(
    postReq(mkRequestBody({ policy_override: "back_annotation" })),
    happyDeps(),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error.code, "invalid_request");
  assert(/back_annotation_witness_id/.test(body.error.message));
});

// ---------------------------------------------------------------------------
// 12. policy_override='back_annotation' WITH witness id → forwarded.
// ---------------------------------------------------------------------------

Deno.test("handle: back_annotation override forwards witness id to persistInitialAdmission", async () => {
  setEnv();
  const deps = happyDeps();
  // Make orchestrator stamp policy_at_decision='back_annotation' so the
  // handler's forward branch fires.
  deps.adjudicate = (() => mkDecision({ state: "needs_review", intent: "none", policy: "back_annotation" })) as unknown as HandleDeps["adjudicate"];
  let capturedWid: string | undefined;
  deps.persistInitialAdmission = ((input: unknown) => {
    const i = input as { back_annotation_witness_id?: string };
    capturedWid = i.back_annotation_witness_id;
    return Promise.resolve({
      mode: "created" as const,
      caw: mkPersistedCaw({
        state: "needs_review",
        produced_witness_id: null,
        policy: "back_annotation",
      }),
    });
  }) as unknown as HandleDeps["persistInitialAdmission"];
  const res = await handle(
    postReq(mkRequestBody({
      policy_override: "back_annotation",
      back_annotation_witness_id: BACK_ANN_WID,
    })),
    deps,
  );
  assertEquals(res.status, 200);
  await res.body?.cancel();
  assertEquals(capturedWid, BACK_ANN_WID);
});

// ---------------------------------------------------------------------------
// 13. persist returns existing → 200 with existing CAW fields.
// ---------------------------------------------------------------------------

Deno.test("handle: idempotent existing CAW returns 200 with the existing row", async () => {
  setEnv();
  const deps = happyDeps();
  const existingCaw = mkPersistedCaw({
    state: "auto_admitted",
    produced_witness_id: WITNESS_ID,
  });
  deps.persistInitialAdmission = (() =>
    Promise.resolve({
      mode: "existing" as const,
      caw: existingCaw,
    })) as unknown as HandleDeps["persistInitialAdmission"];
  const res = await handle(postReq(mkRequestBody()), deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.caw_id, existingCaw.caw_id);
  assertEquals(body.produced_witness_id, existingCaw.produced_witness_id);
  assertEquals(body.engine_version_id, existingCaw.engine_version_id);
  assertEquals(body.ontology_version, existingCaw.ontology_version);
});
