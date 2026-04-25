// ============================================================================
// supabase/functions/_shared/rae/concept_binding.test.ts
// ----------------------------------------------------------------------------
// Tests for the candidate-concept binding helper.
// ============================================================================

import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.0";
import {
  applyConceptOverrideToBinding,
  CandidateConceptMismatchError,
  CandidateConceptShapeError,
  conceptOverrideLimitations,
  validateCandidateConceptBinding,
} from "./concept_binding.ts";
import type { CandidateConcept, SignalConfig } from "./orchestrator.ts";
import type { EngineBinding } from "./edge_loaders.ts";
import type { EngineVersionConfig } from "./types.ts";

function mkConcept(overrides: Partial<CandidateConcept> = {}): CandidateConcept {
  return {
    concept_id: "concept_glucose_serum",
    canonical_name: "Glucose, serum",
    canonical_unit: "mg/dL",
    plausibility_band: { low: 20, high: 600 },
    canonical_reference_range: { low: 70, high: 99 },
    dynamics_rule_id: null,
    delta_ceiling: null,
    ...overrides,
  };
}

function mkEngine(overrides: Partial<EngineVersionConfig> = {}): EngineVersionConfig {
  return {
    engine_version_id: "11111111-1111-1111-1111-111111111111",
    semver: "1.0.0",
    registry_seed_version: "seed-1",
    ontology_version: "onto-1",
    threshold_admission: 0.8,
    threshold_rejection_floor: 0.2,
    calibration_mode: false,
    ...overrides,
  };
}

function mkSignalConfig(): SignalConfig {
  return {
    lexical: { weight: 1 },
    unit: { weight: 1 },
    value: { weight: 1 },
    method: { weight: 1 },
    ref_range: { weight: 1 },
    panel: { weight: 1 },
    longitudinal: { weight: 1 },
  };
}

function mkBinding(
  override: EngineBinding["concept_override"] = null,
  engine: Partial<EngineVersionConfig> = {},
): EngineBinding {
  return {
    engine_version: mkEngine(engine),
    signal_config: mkSignalConfig(),
    concept_override: override,
  };
}

// ---------------------------------------------------------------------------
// validateCandidateConceptBinding
// ---------------------------------------------------------------------------

Deno.test("validate: accepts matching concept_id with no override", () => {
  const cc = mkConcept();
  validateCandidateConceptBinding({
    binding_lookup_concept_id: cc.concept_id,
    candidate_concept: cc,
    binding: mkBinding(null),
  });
});

Deno.test("validate: accepts matching concept_id with matching override", () => {
  const cc = mkConcept();
  validateCandidateConceptBinding({
    binding_lookup_concept_id: cc.concept_id,
    candidate_concept: cc,
    binding: mkBinding({
      engine_version_id: "11111111-1111-1111-1111-111111111111",
      candidate_concept_id: cc.concept_id,
      reason: "calibration",
    }),
  });
});

Deno.test("validate: rejects concept_id mismatch vs lookup id", () => {
  const cc = mkConcept({ concept_id: "concept_a" });
  assertThrows(
    () =>
      validateCandidateConceptBinding({
        binding_lookup_concept_id: "concept_b",
        candidate_concept: cc,
        binding: mkBinding(null),
      }),
    CandidateConceptMismatchError,
    "does not match",
  );
});

Deno.test("validate: rejects override whose concept_id disagrees with candidate", () => {
  const cc = mkConcept({ concept_id: "concept_a" });
  assertThrows(
    () =>
      validateCandidateConceptBinding({
        binding_lookup_concept_id: "concept_a",
        candidate_concept: cc,
        binding: mkBinding({
          engine_version_id: "11111111-1111-1111-1111-111111111111",
          candidate_concept_id: "concept_b",
          reason: null,
        }),
      }),
    CandidateConceptMismatchError,
  );
});

Deno.test("validate: rejects missing candidate_concept", () => {
  assertThrows(
    () =>
      validateCandidateConceptBinding({
        binding_lookup_concept_id: "concept_a",
        candidate_concept: null,
        binding: mkBinding(null),
      }),
    CandidateConceptShapeError,
  );
});

Deno.test("validate: rejects blank concept_id on candidate", () => {
  assertThrows(
    () =>
      validateCandidateConceptBinding({
        binding_lookup_concept_id: "concept_a",
        candidate_concept: mkConcept({ concept_id: "  " }),
        binding: mkBinding(null),
      }),
    CandidateConceptShapeError,
  );
});

Deno.test("validate: rejects missing canonical_name", () => {
  assertThrows(
    () =>
      validateCandidateConceptBinding({
        binding_lookup_concept_id: "concept_a",
        candidate_concept: mkConcept({ concept_id: "concept_a", canonical_name: "" }),
        binding: mkBinding(null),
      }),
    CandidateConceptShapeError,
  );
});

// ---------------------------------------------------------------------------
// applyConceptOverrideToBinding
// ---------------------------------------------------------------------------

Deno.test("apply: no override → binding pass-through, applied_override null", () => {
  const b = mkBinding(null, { calibration_mode: false });
  const r = applyConceptOverrideToBinding(b);
  assertEquals(r.applied_override, null);
  assertEquals(r.binding.engine_version.calibration_mode, false);
  assertEquals(r.binding, b);
});

Deno.test("apply: override present → forces calibration_mode=true (new object, no input mutation)", () => {
  const b = mkBinding(
    {
      engine_version_id: "11111111-1111-1111-1111-111111111111",
      candidate_concept_id: "concept_a",
      reason: "registry seam under review",
    },
    { calibration_mode: false },
  );
  const r = applyConceptOverrideToBinding(b);
  assert(r.applied_override !== null);
  assertEquals(r.applied_override?.candidate_concept_id, "concept_a");
  assertEquals(
    r.applied_override?.effect,
    "forced_needs_review_via_calibration_mode",
  );
  assertEquals(r.binding.engine_version.calibration_mode, true);
  // Input not mutated.
  assertEquals(b.engine_version.calibration_mode, false);
  // Override row preserved.
  assertEquals(r.binding.concept_override?.candidate_concept_id, "concept_a");
  // signal_config passed through.
  assertEquals(r.binding.signal_config, b.signal_config);
});

Deno.test("apply: 'lifted' overrides are absent at this layer (loader filters them) → null override is pass-through", () => {
  // Mirrors edge_loaders.loadConceptOverride which filters .is('lifted', false).
  // A lifted override surfaces here as concept_override === null.
  const b = mkBinding(null);
  const r = applyConceptOverrideToBinding(b);
  assertEquals(r.applied_override, null);
  assertEquals(r.binding.engine_version.calibration_mode, false);
});

Deno.test("apply: override with already-true calibration_mode stays true and still flags applied", () => {
  const b = mkBinding(
    {
      engine_version_id: "11111111-1111-1111-1111-111111111111",
      candidate_concept_id: "concept_a",
      reason: null,
    },
    { calibration_mode: true },
  );
  const r = applyConceptOverrideToBinding(b);
  assertEquals(r.binding.engine_version.calibration_mode, true);
  assert(r.applied_override !== null);
});

// ---------------------------------------------------------------------------
// conceptOverrideLimitations
// ---------------------------------------------------------------------------

Deno.test("limitations: empty when no override applied", () => {
  assertEquals(conceptOverrideLimitations(null), []);
});

Deno.test("limitations: includes applied + effect tokens; reason when present", () => {
  const out = conceptOverrideLimitations({
    candidate_concept_id: "concept_a",
    reason: "registry seam   under   review",
    effect: "forced_needs_review_via_calibration_mode",
  });
  assertEquals(out, [
    "concept_override_applied:concept_a",
    "concept_override_effect:forced_needs_review_via_calibration_mode",
    "concept_override_reason:registry seam under review",
  ]);
});

Deno.test("limitations: omits reason token when reason is null/blank", () => {
  const a = conceptOverrideLimitations({
    candidate_concept_id: "c",
    reason: null,
    effect: "forced_needs_review_via_calibration_mode",
  });
  assertEquals(a.length, 2);
  const b = conceptOverrideLimitations({
    candidate_concept_id: "c",
    reason: "   ",
    effect: "forced_needs_review_via_calibration_mode",
  });
  assertEquals(b.length, 2);
});

// ---------------------------------------------------------------------------
// Static-scan: no forbidden imports/references in concept_binding.ts.
// ---------------------------------------------------------------------------

Deno.test("concept_binding.ts: no reasoning-surface or storage imports, no DB I/O, no ontology reads", async () => {
  const src = await Deno.readTextFile(
    new URL("./concept_binding.ts", import.meta.url).pathname,
  );

  const FORBIDDEN = [
    // Reasoning surfaces / P1a edge functions.
    /generate-clusters/, /generate-narrative/, /generate-action-plan/,
    /generate-terrain-render/, /generate-ask-anything-context/, /patient-chat/,
    // Reasoning / patient tables.
    /\bcie_assessments\b/, /\bcie_gate_scores\b/, /\bcie_domain_scores\b/,
    /\bcie_responses\b/, /\bderived_patterns\b/, /\bpatient_narratives\b/,
    /\bterrain_renders\b/, /\baction_plans\b/, /\bpatient_lab_observations\b/,
    /\bpatient_lab_uploads\b/,
    // Witness / CAW tables (helper must not touch storage).
    /\bwitness_objects\b/, /\bconcept_assignment_witnesses\b/,
    /\brae_state_transitions\b/,
    // Ontology tables.
    /\bcelf_feature_map\b/, /\bontology_concept_proposals\b/,
    // Storage / witnessify.
    /witnessify_impl/, /\.\/storage\//,
    // DB I/O.
    /\.from\(/, /\.rpc\(/, /\.insert\(/, /\.update\(/, /\.delete\(/, /\.upsert\(/,
    // Raw SQL keywords.
    /\bINSERT\s+INTO\b/i, /\bUPDATE\s+\w+\s+SET\b/i, /\bDELETE\s+FROM\b/i,
    /\bSELECT\s+.+\s+FROM\b/i,
    // Fifth state guard.
    /back_annotated_divergent/,
    // External API framing.
    /\bFHIR\b/, /openapi/i, /swagger/i,
  ];

  for (const pat of FORBIDDEN) {
    assert(!pat.test(src), `concept_binding.ts contains forbidden pattern: ${pat}`);
  }

  // Allow only relative imports to ./orchestrator.ts, ./edge_loaders.ts,
  // ./types.ts, plus jsr/std.
  const importRe = /^\s*import[^"']+["']([^"']+)["']/gm;
  const allowedRel = new Set([
    "./orchestrator.ts",
    "./edge_loaders.ts",
    "./types.ts",
  ]);
  for (const m of src.matchAll(importRe)) {
    const spec = m[1];
    if (spec.startsWith("./") || spec.startsWith("../")) {
      assert(
        allowedRel.has(spec),
        `concept_binding.ts has unexpected relative import: ${spec}`,
      );
    } else {
      assert(
        spec.startsWith("jsr:@std/") || spec.startsWith("https://deno.land/std"),
        `concept_binding.ts has unexpected non-std import: ${spec}`,
      );
    }
  }
});