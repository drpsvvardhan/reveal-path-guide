// ============================================================================
// supabase/functions/_shared/witnessify_impl.test.ts
// ----------------------------------------------------------------------------
// Unit tests for witnessify_impl.ts
//
// Runner: Deno's built-in test runner.
//   Run from repo root:
//     deno test supabase/functions/_shared/witnessify_impl.test.ts
//
// Covered scenarios:
//   1.  Single lab observation → single witness (depth 0, no ancestry)
//   2.  Single InBody observation → single witness
//   3.  Full CIE assessment → three-tier ancestry wired correctly
//   4.  Registry miss with onRegistryMiss='throw' → throws
//   5.  Registry miss with onRegistryMiss='skip_with_warning' → structured miss
//   6.  Validation failure path — bad testimony captured as validation_failures
//   7.  CIE evolution — assessment has responses for a signal not in registry,
//       domain score still witnessifies correctly with partial ancestry
//   8.  Ancestry integrity — gate score references domain witnesses that
//       actually exist in the batch, and domain scores reference response
//       witnesses
//
// Fixture discipline: all fixtures are minimal and self-contained. Each test
// builds its own registry via makeRegistryAccessor(). No Supabase access.
// ============================================================================

import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.0";

import {
  type WitnessSignalRegistryEntry,
  WITNESS_REGISTRY_SEED_VERSION,
} from "./witness.ts";

import {
  witnessifyObservation,
  witnessifyCieAssessment,
  makeRegistryAccessor,
  type WitnessifyOptions,
  type DirectObservationInput,
  type CieAssessmentInput,
  RegistryMissError,
} from "./witnessify_impl.ts";

// ============================================================================
// FIXTURES — registry entries used across tests
// ============================================================================

const REG_HBA1C: WitnessSignalRegistryEntry = {
  source_window: "lab",
  signal: "lab.hba1c",
  domain_of_access: "biochemical_state_snapshot",
  epistemic_role: "direct_measure",
  reliability_class: "high",
  compression_depth: 0,
  label: "Hemoglobin A1c",
  unit: "%",
  description: "Glycated hemoglobin, three-month glycemic exposure.",
  default_limitations: [
    "Cannot distinguish steady-state from recent acute elevation",
    "Affected by red-cell turnover abnormalities (iron deficiency, hemoglobinopathies)",
    "Single timepoint — trajectory requires repeat measurement",
  ],
  default_confidence_basis:
    "Enzyme immunoassay with NGSP-certified calibration. Confidence reflects assay precision, not clinical interpretation.",
  default_confidence_value: 0.95,
  default_validity_window_seconds: 60 * 60 * 24 * 90,
  ontology_version: "celf-ontology-v1.0",
  ontology_concept_id: "hba1c",
  registry_seed_version: "p1a_initial",
};

const REG_INBODY_PHASE_ANGLE: WitnessSignalRegistryEntry = {
  source_window: "inbody",
  signal: "inbody.body_phase_angle_whole",
  domain_of_access: "body_composition",
  epistemic_role: "direct_measure",
  reliability_class: "high",
  compression_depth: 0,
  label: "Whole-body phase angle",
  unit: "degrees",
  description: "Bioimpedance phase angle, whole-body, 50kHz.",
  default_limitations: [
    "Bioimpedance-derived; sensitive to hydration and electrode contact",
    "Whole-body average; does not resolve segmental imbalances",
  ],
  default_confidence_basis:
    "InBody 970 phase angle at 50kHz. Confidence is for the measurement under protocol; interpretation requires reference range + trend.",
  default_confidence_value: 0.90,
  default_validity_window_seconds: 60 * 60 * 24 * 90,
  ontology_version: "celf-ontology-v1.0",
  ontology_concept_id: "body_phase_angle_whole",
  registry_seed_version: "p1a_initial",
};

// CIE fixtures — three responses in domain A1, one domain score, one gate
// that this domain feeds into.
const REG_CIE_A1Q1: WitnessSignalRegistryEntry = {
  source_window: "cie",
  signal: "cie.response.A1Q1",
  domain_of_access: "embodied_perception",
  epistemic_role: "self_report",
  reliability_class: "medium",
  compression_depth: 0,
  label: "CIE A1Q1",
  unit: null,
  description: "Digestive discomfort frequency after fatty meals.",
  default_limitations: [
    "Cannot adjudicate biochemical state",
    "Patient self-report at intake; subject to interpretive frame",
    "Single-intake response; trajectory requires repeat intake",
  ],
  default_confidence_basis:
    "Structured self-report on CIE v2.2 frequency scale. Confidence for the perception claim, not for underlying biology.",
  default_confidence_value: 0.85,
  default_validity_window_seconds: 60 * 60 * 24 * 30,
  ontology_version: null,
  ontology_concept_id: null,
  registry_seed_version: "p1a_initial",
};

const REG_CIE_A1Q2: WitnessSignalRegistryEntry = {
  ...REG_CIE_A1Q1,
  signal: "cie.response.A1Q2",
  label: "CIE A1Q2",
  description: "Morning grogginess severity.",
};

const REG_CIE_A1Q3: WitnessSignalRegistryEntry = {
  ...REG_CIE_A1Q1,
  signal: "cie.response.A1Q3",
  label: "CIE A1Q3",
  description: "Post-exercise energy trajectory.",
};

const REG_CIE_DOMAIN_A1: WitnessSignalRegistryEntry = {
  source_window: "cie",
  signal: "cie.domain_score.A1",
  domain_of_access: "embodied_perception",
  epistemic_role: "derived_score",
  reliability_class: "medium",
  compression_depth: 1,
  label: "CIE Domain A1",
  unit: "score_0_100",
  description: "Liver/Hepatic Flux perception domain.",
  default_limitations: [
    "Aggregate of response-level witnesses; individual high-severity responses may be masked by averaging",
    "Patient perception aggregate; not biology",
    "Layer-2 deep-dive questions fire only below threshold; domain shape depends on triggering",
  ],
  default_confidence_basis:
    "Derived score per CIE v2.2 scoring. Confidence reflects aggregation fidelity over underlying response witnesses.",
  default_confidence_value: 0.80,
  default_validity_window_seconds: 60 * 60 * 24 * 30,
  ontology_version: null,
  ontology_concept_id: null,
  registry_seed_version: "p1a_initial",
};

const REG_CIE_GATE_CLI: WitnessSignalRegistryEntry = {
  source_window: "cie",
  signal: "cie.gate_score.CLI",
  domain_of_access: "embodied_perception",
  epistemic_role: "compressed_label",
  reliability_class: "medium",
  compression_depth: 2,
  label: "CIE Gate CLI",
  unit: "score_0_100",
  description: "Cellular Longevity Index gate, aggregating domain scores.",
  default_limitations: [
    "Second-order compression; independent contribution must not be double-counted with domain scores or responses",
    "Traffic-light categorization compresses graded information",
    "Gate represents a specific clinical lens, not a full system reading",
  ],
  default_confidence_basis:
    "Composition of domain-score witnesses into a gate-level lens. Confidence for the compressed signal within the stated lens.",
  default_confidence_value: 0.75,
  default_validity_window_seconds: 60 * 60 * 24 * 30,
  ontology_version: null,
  ontology_concept_id: null,
  registry_seed_version: "p1a_initial",
};

// Convenience: a registry with all the above entries.
function makeFullRegistry() {
  return makeRegistryAccessor([
    REG_HBA1C,
    REG_INBODY_PHASE_ANGLE,
    REG_CIE_A1Q1,
    REG_CIE_A1Q2,
    REG_CIE_A1Q3,
    REG_CIE_DOMAIN_A1,
    REG_CIE_GATE_CLI,
  ]);
}

const VV001_USER_ID = "d75365ce-c45e-48a0-8d30-dab491e17346";

const DEFAULT_OPTS: WitnessifyOptions = {
  onRegistryMiss: "throw",
  throwOnCatastrophic: true,
};

// ============================================================================
// TEST 1 — Single lab observation
// ============================================================================

Deno.test("witnessifyObservation: single lab observation produces a valid depth-0 witness", () => {
  const registry = makeFullRegistry();
  const input: DirectObservationInput = {
    user_id: VV001_USER_ID,
    source_window: "lab",
    signal: "lab.hba1c",
    observed_value: 5.3,
    observed_unit: "%",
    biological_timestamp: "2026-04-15T08:00:00Z",
    derived_from_packet_id: null,
    source_table: "patient_lab_observations",
    source_row_id: "lab-row-123",
    testimony:
      "HbA1c measured at 5.3% on 2026-04-15 via standard enzyme immunoassay. Reference range for non-diabetic adults: <5.7%.",
  };

  const result = witnessifyObservation(input, registry, DEFAULT_OPTS);

  assertEquals(result.registry_misses.length, 0);
  assertEquals(result.validation_failures.length, 0);
  assert(result.witnesses !== null, "witness should be produced");

  const w = result.witnesses!;
  assertEquals(w.source_window, "lab");
  assertEquals(w.signal, "lab.hba1c");
  assertEquals(w.compression_depth, 0);
  assertEquals(w.epistemic_role, "direct_measure");
  assertEquals(w.ancestry_witness_ids, null);
  assertEquals(w.observed_value, 5.3);
  assertEquals(w.user_id, VV001_USER_ID);
  assertEquals(w.registry_seed_version, "p1a_initial");
  assertEquals(w.transformation_version, "witnessify-v1.0.0");
  assert(w.witness_id && w.witness_id.length === 36, "witness_id should be a UUID");
  assertEquals(w.limitations.length, 3); // from registry default
});

// ============================================================================
// TEST 2 — Single InBody observation
// ============================================================================

Deno.test("witnessifyObservation: single InBody observation produces a valid depth-0 witness", () => {
  const registry = makeFullRegistry();
  const input: DirectObservationInput = {
    user_id: VV001_USER_ID,
    source_window: "inbody",
    signal: "inbody.body_phase_angle_whole",
    observed_value: 4.9,
    observed_unit: "degrees",
    biological_timestamp: "2026-04-15T09:00:00Z",
    derived_from_packet_id: null,
    source_table: "patient_body_composition_inbody",
    source_row_id: "inbody-row-456",
    testimony:
      "Whole-body phase angle measured at 4.9 degrees on 2026-04-15 via InBody 970 at 50kHz, standard fasted protocol.",
  };

  const result = witnessifyObservation(input, registry, DEFAULT_OPTS);

  assertEquals(result.registry_misses.length, 0);
  assertEquals(result.validation_failures.length, 0);
  assert(result.witnesses !== null);

  const w = result.witnesses!;
  assertEquals(w.source_window, "inbody");
  assertEquals(w.domain_of_access, "body_composition");
  assertEquals(w.compression_depth, 0);
  assertEquals(w.observed_value, 4.9);
});

// ============================================================================
// TEST 3 — Full CIE assessment with three-tier ancestry
// ============================================================================

Deno.test("witnessifyCieAssessment: full assessment produces response → domain → gate witnesses with correct ancestry", () => {
  const registry = makeFullRegistry();

  const assessment: CieAssessmentInput = {
    user_id: VV001_USER_ID,
    assessment_id: "assess-001",
    biological_timestamp: "2026-04-15T10:00:00Z",
    source_table: "cie_assessments",
    assessment_row_id: "assess-row-001",
    responses: [
      {
        question_id: "A1Q1",
        response_value: "sometimes",
        response_unit: null,
        source_row_id: "resp-A1Q1",
        testimony:
          "Patient self-reported 'sometimes' for post-fatty-meal digestive discomfort during CIE intake on 2026-04-15.",
      },
      {
        question_id: "A1Q2",
        response_value: "mild",
        response_unit: null,
        source_row_id: "resp-A1Q2",
        testimony:
          "Patient self-reported 'mild' severity for morning grogginess during CIE intake on 2026-04-15.",
      },
      {
        question_id: "A1Q3",
        response_value: "improves",
        response_unit: null,
        source_row_id: "resp-A1Q3",
        testimony:
          "Patient self-reported 'improves' for post-exercise energy during CIE intake on 2026-04-15.",
      },
    ],
    domain_scores: [
      {
        domain_id: "A1",
        score_value: 72,
        score_unit: "score_0_100",
        source_row_id: "domain-A1",
        testimony:
          "CIE Domain A1 (Liver/Hepatic Flux) score 72 aggregated from three L1 responses on 2026-04-15.",
        contributing_question_ids: ["A1Q1", "A1Q2", "A1Q3"],
      },
    ],
    gate_scores: [
      {
        gate_id: "CLI",
        score_value: 68,
        score_unit: "score_0_100",
        source_row_id: "gate-CLI",
        testimony:
          "CIE Gate CLI (Cellular Longevity Index) score 68 aggregated from contributing domain A1 on 2026-04-15.",
        contributing_domain_ids: ["A1"],
      },
    ],
  };

  const result = witnessifyCieAssessment(assessment, registry, DEFAULT_OPTS);

  assertEquals(result.registry_misses.length, 0);
  assertEquals(result.validation_failures.length, 0);
  assertEquals(result.witnesses.length, 5); // 3 responses + 1 domain + 1 gate

  const byDepth = new Map<number, typeof result.witnesses>();
  for (const w of result.witnesses) {
    const arr = byDepth.get(w.compression_depth) ?? [];
    arr.push(w);
    byDepth.set(w.compression_depth, arr);
  }
  assertEquals(byDepth.get(0)?.length, 3, "three depth-0 responses");
  assertEquals(byDepth.get(1)?.length, 1, "one depth-1 domain score");
  assertEquals(byDepth.get(2)?.length, 1, "one depth-2 gate score");

  const responseIds = new Set(byDepth.get(0)!.map((w) => w.witness_id!));
  const domainWitness = byDepth.get(1)![0];
  const gateWitness = byDepth.get(2)![0];

  // Domain ancestry must be exactly the three response witness IDs
  assert(domainWitness.ancestry_witness_ids !== null);
  assertEquals(domainWitness.ancestry_witness_ids!.length, 3);
  for (const ancId of domainWitness.ancestry_witness_ids!) {
    assert(responseIds.has(ancId), `domain ancestor ${ancId} should be a response witness`);
  }

  // Gate ancestry must be exactly the domain witness ID
  assert(gateWitness.ancestry_witness_ids !== null);
  assertEquals(gateWitness.ancestry_witness_ids!.length, 1);
  assertEquals(gateWitness.ancestry_witness_ids![0], domainWitness.witness_id!);
});

// ============================================================================
// TEST 4 — Registry miss with 'throw'
// ============================================================================

Deno.test("witnessifyObservation: registry miss with onRegistryMiss='throw' raises RegistryMissError", () => {
  const registry = makeFullRegistry();
  const input: DirectObservationInput = {
    user_id: VV001_USER_ID,
    source_window: "lab",
    signal: "lab.some_unknown_marker_not_in_registry",
    observed_value: 42,
    observed_unit: "U/L",
    biological_timestamp: "2026-04-15T08:00:00Z",
    derived_from_packet_id: null,
    source_table: "patient_lab_observations",
    source_row_id: "lab-row-unknown",
    testimony: "Unknown marker value captured from lab report.",
  };

  assertThrows(
    () => witnessifyObservation(input, registry, { onRegistryMiss: "throw" }),
    RegistryMissError,
    "lab.some_unknown_marker_not_in_registry"
  );
});

// ============================================================================
// TEST 5 — Registry miss with 'skip_with_warning'
// ============================================================================

Deno.test("witnessifyObservation: registry miss with 'skip_with_warning' returns structured miss", () => {
  const registry = makeFullRegistry();
  const input: DirectObservationInput = {
    user_id: VV001_USER_ID,
    source_window: "lab",
    signal: "lab.some_unknown_marker",
    observed_value: 42,
    observed_unit: "U/L",
    biological_timestamp: "2026-04-15T08:00:00Z",
    derived_from_packet_id: null,
    source_table: "patient_lab_observations",
    source_row_id: "lab-row-unknown",
    testimony: "Unknown marker value captured during historical backfill.",
  };

  const result = witnessifyObservation(input, registry, {
    onRegistryMiss: "skip_with_warning",
  });

  assertEquals(result.witnesses, null, "no witness produced on miss");
  assertEquals(result.registry_misses.length, 1);
  const miss = result.registry_misses[0];
  assertEquals(miss.source_window, "lab");
  assertEquals(miss.signal, "lab.some_unknown_marker");
  assertEquals(miss.input_ref.kind, "direct_observation");
});

// ============================================================================
// TEST 6 — Validation failure (short testimony)
// ============================================================================

Deno.test("witnessifyObservation: short testimony captured as validation_failure, not thrown", () => {
  const registry = makeFullRegistry();
  const input: DirectObservationInput = {
    user_id: VV001_USER_ID,
    source_window: "lab",
    signal: "lab.hba1c",
    observed_value: 5.3,
    observed_unit: "%",
    biological_timestamp: "2026-04-15T08:00:00Z",
    derived_from_packet_id: null,
    source_table: "patient_lab_observations",
    source_row_id: "lab-row-short",
    testimony: "too short", // < 20 chars, will fail schema-parity check
  };

  const result = witnessifyObservation(input, registry, {
    onRegistryMiss: "throw",
    throwOnCatastrophic: true,
  });

  assertEquals(result.witnesses, null);
  assertEquals(result.validation_failures.length, 1);
  const failure = result.validation_failures[0];
  assert(
    failure.message.includes("testimony"),
    `expected testimony error, got: ${failure.message}`
  );
});

// ============================================================================
// TEST 7 — CIE evolution: assessment has extra questions not in registry
// ============================================================================

Deno.test("witnessifyCieAssessment: responses for signals not in registry skip-with-warning, domain score still produces with partial ancestry", () => {
  const registry = makeFullRegistry();

  const assessment: CieAssessmentInput = {
    user_id: VV001_USER_ID,
    assessment_id: "assess-evolution-001",
    biological_timestamp: "2026-04-15T10:00:00Z",
    source_table: "cie_assessments",
    assessment_row_id: "assess-row-evolution-001",
    // Four responses — A1Q1, A1Q2, A1Q3 are in registry;
    // A1Q4 is NOT (simulates CIE evolution: added a new question)
    responses: [
      {
        question_id: "A1Q1",
        response_value: "sometimes",
        response_unit: null,
        source_row_id: "resp-ev-A1Q1",
        testimony:
          "Patient self-reported 'sometimes' for post-fatty-meal digestive discomfort during CIE intake on 2026-04-15.",
      },
      {
        question_id: "A1Q2",
        response_value: "mild",
        response_unit: null,
        source_row_id: "resp-ev-A1Q2",
        testimony:
          "Patient self-reported 'mild' severity for morning grogginess during CIE intake on 2026-04-15.",
      },
      {
        question_id: "A1Q3",
        response_value: "improves",
        response_unit: null,
        source_row_id: "resp-ev-A1Q3",
        testimony:
          "Patient self-reported 'improves' for post-exercise energy during CIE intake on 2026-04-15.",
      },
      {
        question_id: "A1Q4",
        response_value: "often",
        response_unit: null,
        source_row_id: "resp-ev-A1Q4",
        testimony:
          "Patient self-reported 'often' for a new A1Q4 question (not yet in registry) on 2026-04-15.",
      },
    ],
    domain_scores: [
      {
        domain_id: "A1",
        score_value: 65,
        score_unit: "score_0_100",
        source_row_id: "domain-ev-A1",
        testimony:
          "CIE Domain A1 score 65 aggregated from four responses on 2026-04-15 (one of which was a newly added question).",
        contributing_question_ids: ["A1Q1", "A1Q2", "A1Q3", "A1Q4"],
      },
    ],
    gate_scores: [],
  };

  const result = witnessifyCieAssessment(assessment, registry, {
    onRegistryMiss: "skip_with_warning",
  });

  // Three responses land, one misses.
  assertEquals(result.registry_misses.length, 1);
  assertEquals(result.registry_misses[0].signal, "cie.response.A1Q4");

  // Domain still produces.
  assertEquals(result.validation_failures.length, 0);
  assertEquals(result.witnesses.length, 4, "3 responses + 1 domain score");

  // Domain ancestry has three IDs, not four.
  const domainWitness = result.witnesses.find((w) => w.compression_depth === 1)!;
  assertEquals(
    domainWitness.ancestry_witness_ids!.length,
    3,
    "domain ancestry reflects only the responses that witnessified"
  );

  // A soft warning about partial ancestry should be present.
  const partialWarning = result.soft_warnings.find(
    (w) => w.rule === "domain_ancestry_partial"
  );
  assert(partialWarning, "soft warning for partial domain ancestry should be emitted");
});

// ============================================================================
// TEST 8 — Batch integrity: all ancestry references resolve within the batch
// ============================================================================

Deno.test("witnessifyCieAssessment: every ancestry_witness_id in emitted batch resolves to a witness_id in the same batch", () => {
  const registry = makeFullRegistry();

  const assessment: CieAssessmentInput = {
    user_id: VV001_USER_ID,
    assessment_id: "assess-integrity-001",
    biological_timestamp: "2026-04-15T10:00:00Z",
    source_table: "cie_assessments",
    assessment_row_id: "assess-row-integrity-001",
    responses: [
      {
        question_id: "A1Q1",
        response_value: "sometimes",
        response_unit: null,
        source_row_id: "ri-A1Q1",
        testimony:
          "Patient self-reported 'sometimes' for post-fatty-meal digestive discomfort during CIE intake on 2026-04-15.",
      },
      {
        question_id: "A1Q2",
        response_value: "mild",
        response_unit: null,
        source_row_id: "ri-A1Q2",
        testimony:
          "Patient self-reported 'mild' severity for morning grogginess during CIE intake on 2026-04-15.",
      },
    ],
    domain_scores: [
      {
        domain_id: "A1",
        score_value: 75,
        score_unit: "score_0_100",
        source_row_id: "ri-domain-A1",
        testimony:
          "CIE Domain A1 score 75 aggregated from two responses on 2026-04-15.",
        contributing_question_ids: ["A1Q1", "A1Q2"],
      },
    ],
    gate_scores: [
      {
        gate_id: "CLI",
        score_value: 70,
        score_unit: "score_0_100",
        source_row_id: "ri-gate-CLI",
        testimony:
          "CIE Gate CLI score 70 aggregated from contributing domain A1 on 2026-04-15.",
        contributing_domain_ids: ["A1"],
      },
    ],
  };

  const result = witnessifyCieAssessment(assessment, registry, DEFAULT_OPTS);

  const allIds = new Set(result.witnesses.map((w) => w.witness_id!));
  for (const w of result.witnesses) {
    if (!w.ancestry_witness_ids) continue;
    for (const ancId of w.ancestry_witness_ids) {
      assert(
        allIds.has(ancId),
        `witness ${w.signal} references ancestor ${ancId} not in batch`
      );
    }
  }

  // Depth-1 witnesses must reference depth-0 only.
  for (const w of result.witnesses) {
    if (w.compression_depth !== 1) continue;
    for (const ancId of w.ancestry_witness_ids ?? []) {
      const anc = result.witnesses.find((x) => x.witness_id === ancId)!;
      assertEquals(anc.compression_depth, 0);
    }
  }

  // Depth-2 witnesses must reference depth-1 only.
  for (const w of result.witnesses) {
    if (w.compression_depth !== 2) continue;
    for (const ancId of w.ancestry_witness_ids ?? []) {
      const anc = result.witnesses.find((x) => x.witness_id === ancId)!;
      assertEquals(anc.compression_depth, 1);
    }
  }
});

// ============================================================================
// TEST 9-12 — Deterministic witness_id (UUIDv5 fix, 23 Apr 2026)
// ----------------------------------------------------------------------------
// Per CodexOS: witness_id must be a pure function of the provenance tuple
// so that re-runs of the backfill produce stable ancestry references.
// Random UUIDs would break Pattern Z idempotency at the ancestry layer.
// ============================================================================

Deno.test("determinism: same direct-observation input → same witness_id", () => {
  const registry = makeFullRegistry();
  const input: DirectObservationInput = {
    user_id: VV001_USER_ID,
    source_window: "lab",
    signal: "lab.hba1c",
    observed_value: 5.3,
    observed_unit: "%",
    biological_timestamp: "2026-04-15T08:00:00Z",
    derived_from_packet_id: null,
    source_table: "patient_lab_observations",
    source_row_id: "stable-row-123",
    testimony:
      "HbA1c measured at 5.3% on 2026-04-15 via enzyme immunoassay, reference range <5.7%.",
  };
  const r1 = witnessifyObservation(input, registry, DEFAULT_OPTS);
  const r2 = witnessifyObservation(input, registry, DEFAULT_OPTS);
  assert(r1.witnesses && r2.witnesses);
  assertEquals(
    r1.witnesses.witness_id,
    r2.witnesses.witness_id,
    "two runs with identical input must produce identical witness_id"
  );
});

Deno.test("determinism: different source_row_id → different witness_id", () => {
  const registry = makeFullRegistry();
  const base = {
    user_id: VV001_USER_ID,
    source_window: "lab" as const,
    signal: "lab.hba1c",
    observed_value: 5.3,
    observed_unit: "%",
    biological_timestamp: "2026-04-15T08:00:00Z",
    derived_from_packet_id: null,
    source_table: "patient_lab_observations",
    testimony:
      "HbA1c measured at 5.3% on 2026-04-15 via enzyme immunoassay, reference range <5.7%.",
  };
  const r1 = witnessifyObservation(
    { ...base, source_row_id: "row-aaa" },
    registry,
    DEFAULT_OPTS
  );
  const r2 = witnessifyObservation(
    { ...base, source_row_id: "row-bbb" },
    registry,
    DEFAULT_OPTS
  );
  assert(r1.witnesses && r2.witnesses);
  assert(
    r1.witnesses.witness_id !== r2.witnesses.witness_id,
    "different source_row_id must yield different witness_ids"
  );
});

Deno.test("determinism: full CIE batch — witness_ids AND ancestry pointers stable across runs", () => {
  const registry = makeFullRegistry();
  const assessment: CieAssessmentInput = {
    user_id: VV001_USER_ID,
    assessment_id: "assess-determ-001",
    biological_timestamp: "2026-04-15T10:00:00Z",
    source_table: "cie_assessments",
    assessment_row_id: "arow-determ-001",
    responses: [
      {
        question_id: "A1Q1",
        response_value: "sometimes",
        response_unit: null,
        source_row_id: "rd1",
        testimony:
          "Patient self-reported 'sometimes' for post-fatty-meal digestive discomfort during intake on 2026-04-15.",
      },
      {
        question_id: "A1Q2",
        response_value: "mild",
        response_unit: null,
        source_row_id: "rd2",
        testimony:
          "Patient self-reported 'mild' severity for morning grogginess during intake on 2026-04-15.",
      },
    ],
    domain_scores: [
      {
        domain_id: "A1",
        score_value: 72,
        score_unit: "score_0_100",
        source_row_id: "dd1",
        testimony:
          "CIE Domain A1 score 72 aggregated from two responses on 2026-04-15 intake.",
        contributing_question_ids: ["A1Q1", "A1Q2"],
      },
    ],
    gate_scores: [
      {
        gate_id: "CLI",
        score_value: 68,
        score_unit: "score_0_100",
        source_row_id: "gd1",
        testimony:
          "CIE Gate CLI score 68 aggregated from contributing domain A1 on 2026-04-15.",
        contributing_domain_ids: ["A1"],
      },
    ],
  };
  const r1 = witnessifyCieAssessment(assessment, registry, DEFAULT_OPTS);
  const r2 = witnessifyCieAssessment(assessment, registry, DEFAULT_OPTS);

  assertEquals(r1.witnesses.length, r2.witnesses.length);

  // witness_ids match across runs
  const ids1 = r1.witnesses.map((w) => `${w.signal}=${w.witness_id!}`).sort();
  const ids2 = r2.witnesses.map((w) => `${w.signal}=${w.witness_id!}`).sort();
  assertEquals(ids1, ids2);

  // Critical: ancestry pointers must resolve identically — this is the
  // actual invariant Pattern Z idempotency depends on.
  const ancPairs1 = r1.witnesses
    .filter((w) => w.ancestry_witness_ids && w.ancestry_witness_ids.length)
    .flatMap((w) =>
      w.ancestry_witness_ids!.map((aid) => `${w.witness_id}<-${aid}`)
    )
    .sort();
  const ancPairs2 = r2.witnesses
    .filter((w) => w.ancestry_witness_ids && w.ancestry_witness_ids.length)
    .flatMap((w) =>
      w.ancestry_witness_ids!.map((aid) => `${w.witness_id}<-${aid}`)
    )
    .sort();
  assertEquals(ancPairs1, ancPairs2);
});

Deno.test("determinism: witness_id is a structurally valid UUIDv5", () => {
  const registry = makeFullRegistry();
  const r = witnessifyObservation(
    {
      user_id: VV001_USER_ID,
      source_window: "lab",
      signal: "lab.hba1c",
      observed_value: 5.3,
      observed_unit: "%",
      biological_timestamp: "2026-04-15T08:00:00Z",
      derived_from_packet_id: null,
      source_table: "patient_lab_observations",
      source_row_id: "uuid-format-check",
      testimony:
        "HbA1c measured at 5.3% on 2026-04-15 via enzyme immunoassay, reference range <5.7%.",
    },
    registry,
    DEFAULT_OPTS
  );
  const wid = r.witnesses!.witness_id!;
  const uuidv5Re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert(
    uuidv5Re.test(wid),
    `witness_id ${wid} is not a valid UUIDv5 (version byte or variant bits wrong)`
  );
});

// ============================================================================
// END OF witnessify_impl.test.ts
// ============================================================================
