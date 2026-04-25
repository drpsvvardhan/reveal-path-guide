// ============================================================================
// witness_adapters.test.ts — design §13.2.
// ----------------------------------------------------------------------------
// Pure tests for makeRaeDepth0WitnessifyAdapter and
// makeRaeDepth0WitnessPayloadAdapter. No I/O.
// ============================================================================

import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.0";
import {
  computeDepth0WitnessId,
  makeRaeDepth0WitnessifyAdapter,
  makeRaeDepth0WitnessPayloadAdapter,
  type RaeDepth0Passthrough,
  type RegistryWitnessFields,
} from "./witness_adapters.ts";
import {
  computeCawId,
  type AdmissionDecisionV1,
} from "../_shared/rae/orchestrator.ts";
import type {
  AdmissionState,
  ConceptAssignmentWitnessDraft,
  SignalResult,
} from "../_shared/rae/types.ts";

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ROW_ID = "22222222-2222-4222-8222-222222222222";
const CONCEPT_ID = "33333333-3333-4333-8333-333333333333";
const ENGINE_ID = "44444444-4444-4444-8444-444444444444";

// Mock registry row mirroring what witness_signal_registry returns for a
// lab/HbA1c-style entry. RAE consumes this verbatim; it never invents
// the four ontology fields.
const LAB_REGISTRY_FIELDS: RegistryWitnessFields = {
  source_window: "lab",
  signal: "lab.hba1c",
  domain_of_access: "biochemical_state_snapshot",
  epistemic_role: "direct_measure",
  reliability_class: "high",
  compression_depth: 0,
  registry_seed_version: "seed@2025-01",
};

function mkSignals(): SignalResult[] {
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
    {
      signal_id: "unit",
      band: "pass",
      score: 1,
      weight: 1,
      contributes_to_denominator: true,
      evidence: {
        signal_id: "unit",
        received_unit: "mg/dL",
        canonical_unit: "mg/dL",
      },
      notes: [],
    },
    {
      signal_id: "value",
      band: "pass",
      score: 1,
      weight: 1,
      contributes_to_denominator: true,
      evidence: {
        signal_id: "value",
        received_value: 92,
        unit_normalized_value: 92,
        plausibility_band: { low: 20, high: 600 },
        position: "inside",
      },
      notes: [],
    },
    {
      signal_id: "method",
      band: "abstain",
      score: 0,
      weight: 0.5,
      contributes_to_denominator: false,
      evidence: {
        signal_id: "method",
        received_method: null,
        matched_assay: null,
        abstention_reason: "no method provided",
      },
      notes: [],
    },
    {
      signal_id: "ref_range",
      band: "pass",
      score: 1,
      weight: 1,
      contributes_to_denominator: true,
      evidence: {
        signal_id: "ref_range",
        received_low: 70,
        received_high: 99,
        canonical_range: { low: 70, high: 99 },
        conflict: false,
      },
      notes: [],
    },
    {
      signal_id: "panel",
      band: "abstain",
      score: 0,
      weight: 0.5,
      contributes_to_denominator: false,
      evidence: {
        signal_id: "panel",
        co_observation_ids: [],
        matched_panel: null,
      },
      notes: [],
    },
    {
      signal_id: "longitudinal",
      band: "abstain",
      score: 0,
      weight: 0.5,
      contributes_to_denominator: false,
      evidence: {
        signal_id: "longitudinal",
        prior_witness_ids: [],
        dynamics_rule_id: null,
        delta_observed: null,
        delta_ceiling: null,
        result: "insufficient_history",
      },
      notes: [],
    },
  ];
}

function mkDraft(
  state: AdmissionState,
  overrides: Partial<ConceptAssignmentWitnessDraft> = {},
): ConceptAssignmentWitnessDraft {
  const caw_id = computeCawId(
    USER_ID, "patient_lab_observations", SOURCE_ROW_ID, CONCEPT_ID, ENGINE_ID,
  );
  return {
    caw_id,
    user_id: USER_ID,
    source_table: "patient_lab_observations",
    source_row_id: SOURCE_ROW_ID,
    candidate_concept_id: CONCEPT_ID,
    ontology_version: "ontology@2025-01",
    registry_seed_version: "seed@2025-01",
    engine_version_id: ENGINE_ID,
    current_state: state,
    current_state_actor_kind: "engine",
    current_state_actor_id: ENGINE_ID,
    signal_results: mkSignals(),
    composite_identity_score: 0.96,
    coherence_result: "abstain",
    confidence_value: 0.96,
    confidence_basis: "identity=0.96 across 4/6 contributing identity signals",
    limitations: ["method_abstain", "panel_abstain"],
    produced_witness_id: null,
    policy_at_decision: "default",
    founder_review_flag: false,
    ...overrides,
  };
}

function mkDecision(
  state: AdmissionState,
  intent: "produce_depth0_witness" | "none",
): AdmissionDecisionV1 {
  return { caw: mkDraft(state), witness_intent: intent };
}

// ---------------------------------------------------------------------------
// computeDepth0WitnessId — determinism.
// ---------------------------------------------------------------------------

Deno.test("witness_adapters: computeDepth0WitnessId is deterministic per caw_id", () => {
  const caw_id = "abcd1234-1234-4123-8123-abcdefabcdef";
  const a = computeDepth0WitnessId(caw_id);
  const b = computeDepth0WitnessId(caw_id);
  assertEquals(a, b);
  // Different caw_id => different witness id.
  const c = computeDepth0WitnessId(caw_id.replace("abcd", "ffff"));
  assert(a !== c);
});

// ---------------------------------------------------------------------------
// (a) Witnessify adapter.
// ---------------------------------------------------------------------------

Deno.test("witnessify adapter: throws on empty engineVersionId", () => {
  assertThrows(() => makeRaeDepth0WitnessifyAdapter("", LAB_REGISTRY_FIELDS));
});

Deno.test("witnessify adapter: throws when registryFields is missing/incomplete", () => {
  assertThrows(() =>
    makeRaeDepth0WitnessifyAdapter(
      ENGINE_ID,
      { source_window: "lab" } as unknown as RegistryWitnessFields,
    ),
  );
});

Deno.test("witnessify adapter: builds WitnessRowInput for auto_admitted decision", () => {
  const adapter = makeRaeDepth0WitnessifyAdapter(ENGINE_ID, LAB_REGISTRY_FIELDS);
  const decision = mkDecision("auto_admitted", "produce_depth0_witness");
  const row = adapter(decision);
  assertEquals(row.user_id, USER_ID);
  assertEquals(row.source_table, "patient_lab_observations");
  assertEquals(row.source_row_id, SOURCE_ROW_ID);
  assertEquals(row.ontology_concept_id, CONCEPT_ID);
  assertEquals(row.witness_id, computeDepth0WitnessId(decision.caw.caw_id));
});

Deno.test("witnessify adapter: builds WitnessRowInput for human_confirmed decision", () => {
  const adapter = makeRaeDepth0WitnessifyAdapter(ENGINE_ID, LAB_REGISTRY_FIELDS);
  const decision = mkDecision("human_confirmed", "produce_depth0_witness");
  const row = adapter(decision);
  assertEquals(row.witness_id, computeDepth0WitnessId(decision.caw.caw_id));
});

Deno.test("witnessify adapter: passthrough carries verbatim confidence/limitations", () => {
  const adapter = makeRaeDepth0WitnessifyAdapter(ENGINE_ID, LAB_REGISTRY_FIELDS);
  const decision = mkDecision("auto_admitted", "produce_depth0_witness");
  const row = adapter(decision);
  const pt = row.passthrough as unknown as RaeDepth0Passthrough;
  assertEquals(pt.confidence_value, decision.caw.confidence_value);
  assertEquals(pt.confidence_basis, decision.caw.confidence_basis);
  assertEquals(pt.limitations, decision.caw.limitations);
  assertEquals(pt.engine_version_id, ENGINE_ID);
  assertEquals(pt.rae_witness_kind, "rae_depth0");
  assertEquals(pt.registry_seed_version, decision.caw.registry_seed_version);
  assertEquals(pt.observed_value, 92);
  assertEquals(pt.observed_unit, "mg/dL");
  // Registry-derived fields stamped verbatim; RAE never invents them.
  assertEquals(pt.registry_fields, LAB_REGISTRY_FIELDS);
});

Deno.test("witnessify adapter: two calls with same draft produce identical output (idempotency)", () => {
  const adapter = makeRaeDepth0WitnessifyAdapter(ENGINE_ID, LAB_REGISTRY_FIELDS);
  const decision = mkDecision("auto_admitted", "produce_depth0_witness");
  const a = adapter(decision);
  const b = adapter(decision);
  assertEquals(a.witness_id, b.witness_id);
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

Deno.test("witnessify adapter: rejects draft with too-short confidence_basis", () => {
  const adapter = makeRaeDepth0WitnessifyAdapter(ENGINE_ID, LAB_REGISTRY_FIELDS);
  const decision: AdmissionDecisionV1 = {
    caw: mkDraft("auto_admitted", { confidence_basis: "short" }),
    witness_intent: "produce_depth0_witness",
  };
  assertThrows(() => adapter(decision));
});

Deno.test("witnessify adapter: rejects draft with empty limitations array", () => {
  const adapter = makeRaeDepth0WitnessifyAdapter(ENGINE_ID, LAB_REGISTRY_FIELDS);
  const decision: AdmissionDecisionV1 = {
    caw: mkDraft("auto_admitted", { limitations: [] }),
    witness_intent: "produce_depth0_witness",
  };
  assertThrows(() => adapter(decision));
});

// ---------------------------------------------------------------------------
// (b) Witness payload adapter.
// ---------------------------------------------------------------------------

Deno.test("payload adapter: lifts WitnessRowInput into full WitnessPayloadShape", () => {
  const witnessify = makeRaeDepth0WitnessifyAdapter(ENGINE_ID, LAB_REGISTRY_FIELDS);
  const payloadFn = makeRaeDepth0WitnessPayloadAdapter();
  const decision = mkDecision("auto_admitted", "produce_depth0_witness");
  const row = witnessify(decision);
  const payload = payloadFn(row);

  // Required field set per WitnessPayloadShape contract.
  assertEquals(payload.witness_id, row.witness_id);
  assertEquals(payload.user_id, USER_ID);
  assertEquals(payload.source_table, "patient_lab_observations");
  assertEquals(payload.source_row_id, SOURCE_ROW_ID);
  assertEquals(payload.ancestry_witness_ids, []);
  // Registry-derived (lab/HbA1c-like) — sourced from witness_signal_registry,
  // not invented by RAE.
  assertEquals(payload.source_window, LAB_REGISTRY_FIELDS.source_window);
  assertEquals(payload.signal, LAB_REGISTRY_FIELDS.signal);
  assertEquals(payload.domain_of_access, LAB_REGISTRY_FIELDS.domain_of_access);
  assertEquals(payload.epistemic_role, LAB_REGISTRY_FIELDS.epistemic_role);
  assertEquals(payload.reliability_class, LAB_REGISTRY_FIELDS.reliability_class);
  assertEquals(payload.compression_depth, LAB_REGISTRY_FIELDS.compression_depth);
  assertEquals(payload.observed_value, 92);
  assertEquals(payload.observed_unit, "mg/dL");
  assertEquals(payload.confidence_value, decision.caw.confidence_value);
  assertEquals(payload.confidence_basis, decision.caw.confidence_basis);
  assertEquals(payload.limitations, decision.caw.limitations);
  assertEquals(payload.transformation_version, `rae_depth0:${ENGINE_ID}`);
  assertEquals(payload.registry_seed_version, decision.caw.registry_seed_version);
});

Deno.test("payload adapter: rejects passthrough not stamped by RAE depth-0 witnessify", () => {
  const payloadFn = makeRaeDepth0WitnessPayloadAdapter();
  assertThrows(() =>
    payloadFn({
      witness_id: "x",
      user_id: USER_ID,
      source_table: "t",
      source_row_id: SOURCE_ROW_ID,
      ontology_concept_id: CONCEPT_ID,
      passthrough: { foreign: true },
    }),
  );
});

Deno.test("payload adapter: limitations array is copied (no shared reference)", () => {
  const witnessify = makeRaeDepth0WitnessifyAdapter(ENGINE_ID, LAB_REGISTRY_FIELDS);
  const payloadFn = makeRaeDepth0WitnessPayloadAdapter();
  const decision = mkDecision("auto_admitted", "produce_depth0_witness");
  const row = witnessify(decision);
  const payload = payloadFn(row);
  const pt = row.passthrough as unknown as RaeDepth0Passthrough;
  assert(payload.limitations !== pt.limitations);
  assertEquals(payload.limitations, pt.limitations);
});

// ---------------------------------------------------------------------------
// Registry-derivation guarantees (D-9, task #7).
// ---------------------------------------------------------------------------

Deno.test(
  "witness_adapters: lab/HbA1c-like registry row -> emitted payload uses registry-returned values",
  () => {
    const witnessify = makeRaeDepth0WitnessifyAdapter(ENGINE_ID, LAB_REGISTRY_FIELDS);
    const payloadFn = makeRaeDepth0WitnessPayloadAdapter();
    const decision = mkDecision("auto_admitted", "produce_depth0_witness");
    const payload = payloadFn(witnessify(decision));
    // Verbatim; not the legacy hardcoded RAE strings.
    assertEquals(payload.source_window, "lab");
    assertEquals(payload.signal, "lab.hba1c");
    assertEquals(payload.domain_of_access, "biochemical_state_snapshot");
    assertEquals(payload.epistemic_role, "direct_measure");
    assertEquals(payload.reliability_class, "high");
    assertEquals(payload.compression_depth, 0);
    assert(payload.source_window !== "rae:initial_admission");
    assert(payload.domain_of_access !== "rae");
    assert(payload.epistemic_role !== "admission");
    assert(payload.reliability_class !== "engine_admitted");
  },
);

Deno.test(
  "witness_adapters: missing registry row for non-seeded concept -> adapter construction throws (no payload emitted)",
  () => {
    // Simulates the contract upstream of the adapter: when
    // loadRegistryWitnessFields raises RegistryGapError for a non-seeded
    // concept, the caller cannot construct a complete RegistryWitnessFields
    // and therefore cannot construct the adapter at all. The adapter
    // refuses to fall back to placeholder enum values.
    const incomplete = { source_window: "ct" } as unknown as RegistryWitnessFields;
    assertThrows(() => makeRaeDepth0WitnessifyAdapter(ENGINE_ID, incomplete));
    // No witness payload can ever be produced for this concept until the
    // registry seed is expanded; nothing to assert against payloadFn.
  },
);