// ============================================================================
// request_schema.test.ts — design §13.1.
// ----------------------------------------------------------------------------
// Acceptance/rejection cases for the RAE admit-observation request schema.
// Pure schema parsing only; no I/O.
// ============================================================================

import { assert, assertEquals } from "jsr:@std/assert@1.0.0";
import {
  CandidateConceptSchema,
  RawObservationClaimSchema,
  RequestSchema,
} from "./request_schema.ts";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const UUID_D = "44444444-4444-4444-8444-444444444444";
const UUID_E = "55555555-5555-4555-8555-555555555555";

function mkClaim(overrides: Record<string, unknown> = {}) {
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

function mkConcept(overrides: Record<string, unknown> = {}) {
  return {
    concept_id: UUID_C,
    canonical_name: "Glucose, serum",
    canonical_unit: "mg/dL",
    plausibility_band: { low: 20, high: 600 },
    canonical_reference_range: { low: 70, high: 99 },
    dynamics_rule_id: null,
    delta_ceiling: null,
    ...overrides,
  };
}

function mkRequest(overrides: Record<string, unknown> = {}) {
  return {
    engine_version_id: UUID_D,
    claim: mkClaim(),
    candidate_concept: mkConcept(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Acceptance.
// ---------------------------------------------------------------------------

Deno.test("request_schema: accepts a minimal valid request", () => {
  const parsed = RequestSchema.safeParse(mkRequest());
  assert(parsed.success, JSON.stringify(parsed));
  assertEquals(parsed.data.engine_version_id, UUID_D);
  // Defaults applied.
  assertEquals(parsed.data.siblings, []);
  assertEquals(parsed.data.prior_observations, []);
});

Deno.test("request_schema: accepts request with siblings + prior_observations", () => {
  const parsed = RequestSchema.safeParse(mkRequest({
    siblings: [mkClaim({ raw_name: "HDL" })],
    prior_observations: [mkClaim({ raw_value: 88 })],
  }));
  assert(parsed.success);
  assertEquals(parsed.data.siblings.length, 1);
  assertEquals(parsed.data.prior_observations.length, 1);
});

Deno.test("request_schema: accepts each policy_override enum value", () => {
  for (const v of ["default", "calibration_all_routes_to_review", "back_annotation"]) {
    const parsed = RequestSchema.safeParse(mkRequest({ policy_override: v }));
    assert(parsed.success, `should accept policy_override=${v}`);
  }
});

Deno.test("request_schema: accepts back_annotation_witness_id and request_id as uuids", () => {
  const parsed = RequestSchema.safeParse(mkRequest({
    policy_override: "back_annotation",
    back_annotation_witness_id: UUID_E,
    request_id: UUID_A,
  }));
  assert(parsed.success);
  assertEquals(parsed.data.back_annotation_witness_id, UUID_E);
});

Deno.test("request_schema: accepts full CandidateConcept with all optional fields", () => {
  const parsed = CandidateConceptSchema.safeParse({
    concept_id: UUID_C,
    canonical_name: "Glucose",
    synonyms: ["Glu"],
    ambiguous_alternatives: ["Glucose, urine"],
    canonical_unit: "mg/dL",
    unit_conversions: { "mmol/L": { to_canonical_factor: 18.0, offset: 0 } },
    plausibility_band: { low: 20, high: 600 },
    known_assays: ["hexokinase"],
    method_optional: true,
    canonical_reference_range: { low: 70, high: 99 },
    expected_panel_concept_ids: [UUID_A],
    panel_id: "metabolic",
    dynamics_rule_id: "glucose_default",
    delta_ceiling: 50,
  });
  assert(parsed.success);
});

// ---------------------------------------------------------------------------
// Rejection — strict (unknown keys).
// ---------------------------------------------------------------------------

Deno.test("request_schema: rejects unknown top-level key", () => {
  const parsed = RequestSchema.safeParse({ ...mkRequest(), surprise: 1 });
  assert(!parsed.success);
});

Deno.test("request_schema: rejects unknown key inside CandidateConcept", () => {
  const parsed = CandidateConceptSchema.safeParse({ ...mkConcept(), display_name: "x" });
  assert(!parsed.success, "display_name was the OLD shape; must be rejected");
});

Deno.test("request_schema: rejects unknown key inside RawObservationClaim", () => {
  const parsed = RawObservationClaimSchema.safeParse({ ...mkClaim(), notes: "hi" });
  assert(!parsed.success);
});

// ---------------------------------------------------------------------------
// Rejection — UUID format.
// ---------------------------------------------------------------------------

Deno.test("request_schema: rejects non-UUID engine_version_id", () => {
  const parsed = RequestSchema.safeParse(mkRequest({ engine_version_id: "not-a-uuid" }));
  assert(!parsed.success);
});

Deno.test("request_schema: rejects non-UUID source_row_id and user_id", () => {
  for (const k of ["source_row_id", "user_id"]) {
    const parsed = RawObservationClaimSchema.safeParse(mkClaim({ [k]: "nope" }));
    assert(!parsed.success, `should reject ${k}=nope`);
  }
});

// ---------------------------------------------------------------------------
// D-10: concept_id is an ontology identity string, not a row UUID.
// ---------------------------------------------------------------------------

Deno.test("request_schema: candidate_concept.concept_id accepts \"HbA1c\"", () => {
  const parsed = CandidateConceptSchema.safeParse(mkConcept({ concept_id: "HbA1c" }));
  assert(parsed.success, JSON.stringify(parsed));
});

Deno.test("request_schema: candidate_concept.concept_id accepts \"concept_hba1c\"", () => {
  const parsed = CandidateConceptSchema.safeParse(
    mkConcept({ concept_id: "concept_hba1c" }),
  );
  assert(parsed.success, JSON.stringify(parsed));
});

Deno.test("request_schema: candidate_concept.concept_id rejects \"\"", () => {
  const parsed = CandidateConceptSchema.safeParse(mkConcept({ concept_id: "" }));
  assert(!parsed.success);
});

Deno.test("request_schema: sibling concept_id accepts \"LDL_C\"", () => {
  const parsed = RawObservationClaimSchema.safeParse(
    mkClaim({ concept_id: "LDL_C" }),
  );
  assert(parsed.success, JSON.stringify(parsed));
});

Deno.test("request_schema: sibling concept_id rejects \"\"", () => {
  const parsed = RawObservationClaimSchema.safeParse(
    mkClaim({ concept_id: "" }),
  );
  assert(!parsed.success);
});

// ---------------------------------------------------------------------------
// Rejection — non-finite numerics.
// ---------------------------------------------------------------------------

Deno.test("request_schema: rejects non-finite raw_value", () => {
  for (const v of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
    const parsed = RawObservationClaimSchema.safeParse(mkClaim({ raw_value: v }));
    assert(!parsed.success, `should reject raw_value=${v}`);
  }
});

Deno.test("request_schema: rejects non-finite raw_reference_low/high", () => {
  const a = RawObservationClaimSchema.safeParse(
    mkClaim({ raw_reference_low: Number.NaN }),
  );
  const b = RawObservationClaimSchema.safeParse(
    mkClaim({ raw_reference_high: Number.POSITIVE_INFINITY }),
  );
  assert(!a.success);
  assert(!b.success);
});

// ---------------------------------------------------------------------------
// Rejection — observed_at must be ISO datetime.
// ---------------------------------------------------------------------------

Deno.test("request_schema: rejects invalid observed_at (non-ISO)", () => {
  const parsed = RawObservationClaimSchema.safeParse(
    mkClaim({ observed_at: "yesterday" }),
  );
  assert(!parsed.success);
});

// ---------------------------------------------------------------------------
// Rejection — empty strings.
// ---------------------------------------------------------------------------

Deno.test("request_schema: rejects empty raw_name", () => {
  const parsed = RawObservationClaimSchema.safeParse(mkClaim({ raw_name: "" }));
  assert(!parsed.success);
});

Deno.test("request_schema: rejects empty canonical_name and canonical_unit", () => {
  const a = CandidateConceptSchema.safeParse(mkConcept({ canonical_name: "" }));
  const b = CandidateConceptSchema.safeParse(mkConcept({ canonical_unit: "" }));
  assert(!a.success);
  assert(!b.success);
});

// ---------------------------------------------------------------------------
// Rejection — caps.
// ---------------------------------------------------------------------------

Deno.test("request_schema: rejects siblings.length > 64", () => {
  const siblings = Array.from({ length: 65 }, () => mkClaim());
  const parsed = RequestSchema.safeParse(mkRequest({ siblings }));
  assert(!parsed.success);
});

Deno.test("request_schema: rejects prior_observations.length > 256", () => {
  const prior_observations = Array.from({ length: 257 }, () => mkClaim());
  const parsed = RequestSchema.safeParse(mkRequest({ prior_observations }));
  assert(!parsed.success);
});

// ---------------------------------------------------------------------------
// Rejection — enum.
// ---------------------------------------------------------------------------

Deno.test("request_schema: rejects unknown policy_override value", () => {
  const parsed = RequestSchema.safeParse(
    mkRequest({ policy_override: "fast_track" }),
  );
  assert(!parsed.success);
});

Deno.test("request_schema: rejects non-uuid back_annotation_witness_id", () => {
  const parsed = RequestSchema.safeParse(
    mkRequest({ back_annotation_witness_id: "not-uuid" }),
  );
  assert(!parsed.success);
});

// ---------------------------------------------------------------------------
// Optional `concept_id` on RawObservationClaim (P1).
// ---------------------------------------------------------------------------
// Currently consumed only for siblings; permitted on every claim shape so
// we don't have to split the schema yet.

Deno.test("request_schema: accepts optional concept_id on a claim", () => {
  const parsed = RawObservationClaimSchema.safeParse(
    mkClaim({ concept_id: UUID_C }),
  );
  assert(parsed.success, JSON.stringify(parsed));
});

Deno.test("request_schema: omitting concept_id is still valid", () => {
  const parsed = RawObservationClaimSchema.safeParse(mkClaim());
  assert(parsed.success);
  assertEquals(
    (parsed.data as { concept_id?: string }).concept_id,
    undefined,
  );
});


Deno.test("request_schema: accepts siblings carrying their own concept_id", () => {
  const parsed = RequestSchema.safeParse(mkRequest({
    siblings: [
      mkClaim({ concept_id: UUID_E }),
      mkClaim({ raw_name: "HDL" }), // concept_id omitted
    ],
  }));
  assert(parsed.success);
  assertEquals(parsed.data.siblings.length, 2);
});