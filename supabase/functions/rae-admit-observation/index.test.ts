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
