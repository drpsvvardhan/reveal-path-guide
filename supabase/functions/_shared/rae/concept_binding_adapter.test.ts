// ============================================================================
// supabase/functions/_shared/rae/concept_binding_adapter.test.ts
// ----------------------------------------------------------------------------
// Tests for bindCandidateConceptForAdmission — the composition helper used
// by the future rae-admit-observation edge function.
// ============================================================================

import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.0";
import { bindCandidateConceptForAdmission } from "./concept_binding_adapter.ts";
import {
  CandidateConceptMismatchError,
  CandidateConceptShapeError,
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
// Happy paths.
// ---------------------------------------------------------------------------

Deno.test("adapter: no override → unchanged binding, no limitations, null metadata", () => {
  const cc = mkConcept();
  const b = mkBinding(null);
  const r = bindCandidateConceptForAdmission({
    binding_lookup_concept_id: cc.concept_id,
    candidate_concept: cc,
    binding: b,
  });
  assertEquals(r.candidate_concept, cc);
  assertEquals(r.binding, b);
  assertEquals(r.binding.engine_version.calibration_mode, false);
  assertEquals(r.applied_override, null);
  assertEquals(r.applied_override_metadata, null);
  assertEquals(r.override_limitations, []);
});

Deno.test("adapter: override → calibration_mode forced true, metadata + limitations populated", () => {
  const cc = mkConcept({ concept_id: "concept_a" });
  const b = mkBinding(
    {
      engine_version_id: "11111111-1111-1111-1111-111111111111",
      candidate_concept_id: "concept_a",
      reason: "registry seam under review",
    },
    { calibration_mode: false },
  );
  const r = bindCandidateConceptForAdmission({
    binding_lookup_concept_id: "concept_a",
    candidate_concept: cc,
    binding: b,
  });
  assertEquals(r.binding.engine_version.calibration_mode, true);
  // Input not mutated.
  assertEquals(b.engine_version.calibration_mode, false);

  assert(r.applied_override !== null);
  assertEquals(r.applied_override?.effect, "forced_needs_review_via_calibration_mode");

  assert(r.applied_override_metadata !== null);
  assertEquals(r.applied_override_metadata, {
    candidate_concept_id: "concept_a",
    effect: "forced_needs_review_via_calibration_mode",
    reason: "registry seam under review",
  });

  assertEquals(r.override_limitations, [
    "concept_override_applied:concept_a",
    "concept_override_effect:forced_needs_review_via_calibration_mode",
    "concept_override_reason:registry seam under review",
  ]);
  // No blanks.
  for (const tok of r.override_limitations) {
    assert(tok.trim().length > 0, `blank limitation token: ${JSON.stringify(tok)}`);
  }
});

Deno.test("adapter: override with null reason → metadata.reason is null, limitations omit reason", () => {
  const cc = mkConcept({ concept_id: "concept_a" });
  const b = mkBinding({
    engine_version_id: "11111111-1111-1111-1111-111111111111",
    candidate_concept_id: "concept_a",
    reason: null,
  });
  const r = bindCandidateConceptForAdmission({
    binding_lookup_concept_id: "concept_a",
    candidate_concept: cc,
    binding: b,
  });
  assertEquals(r.applied_override_metadata?.reason, null);
  assertEquals(r.override_limitations.length, 2);
  for (const tok of r.override_limitations) {
    assert(tok.trim().length > 0);
    assert(!tok.startsWith("concept_override_reason:"));
  }
});

Deno.test("adapter: override with whitespace-only reason → no reason token, no blanks", () => {
  const cc = mkConcept({ concept_id: "concept_a" });
  const b = mkBinding({
    engine_version_id: "11111111-1111-1111-1111-111111111111",
    candidate_concept_id: "concept_a",
    reason: "   \t  ",
  });
  const r = bindCandidateConceptForAdmission({
    binding_lookup_concept_id: "concept_a",
    candidate_concept: cc,
    binding: b,
  });
  assertEquals(r.override_limitations.length, 2);
  for (const tok of r.override_limitations) {
    assert(tok.trim().length > 0);
  }
});

// ---------------------------------------------------------------------------
// Validation failures.
// ---------------------------------------------------------------------------

Deno.test("adapter: rejects concept_id mismatch", () => {
  const cc = mkConcept({ concept_id: "concept_a" });
  assertThrows(
    () =>
      bindCandidateConceptForAdmission({
        binding_lookup_concept_id: "concept_b",
        candidate_concept: cc,
        binding: mkBinding(null),
      }),
    CandidateConceptMismatchError,
  );
});

Deno.test("adapter: rejects missing candidate_concept", () => {
  assertThrows(
    () =>
      bindCandidateConceptForAdmission({
        binding_lookup_concept_id: "concept_a",
        candidate_concept: null,
        binding: mkBinding(null),
      }),
    CandidateConceptShapeError,
  );
});

Deno.test("adapter: rejects override whose concept_id disagrees with candidate", () => {
  const cc = mkConcept({ concept_id: "concept_a" });
  assertThrows(
    () =>
      bindCandidateConceptForAdmission({
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

// ---------------------------------------------------------------------------
// Response-safe metadata: no DB internals leak.
// ---------------------------------------------------------------------------

Deno.test("adapter: applied_override_metadata exposes only safe keys (no DB internals)", () => {
  const cc = mkConcept({ concept_id: "concept_a" });
  const b = mkBinding({
    engine_version_id: "11111111-1111-1111-1111-111111111111",
    candidate_concept_id: "concept_a",
    reason: "x",
  });
  const r = bindCandidateConceptForAdmission({
    binding_lookup_concept_id: "concept_a",
    candidate_concept: cc,
    binding: b,
  });
  const allowed = new Set(["candidate_concept_id", "effect", "reason"]);
  const keys = Object.keys(r.applied_override_metadata!);
  for (const k of keys) {
    assert(allowed.has(k), `unexpected key in metadata: ${k}`);
  }
  // Must not surface engine_version_id, row id, lifted, timestamps.
  const json = JSON.stringify(r.applied_override_metadata);
  assert(!/engine_version_id/.test(json));
  assert(!/lifted/.test(json));
  assert(!/created_at|updated_at/.test(json));
});

// ---------------------------------------------------------------------------
// Static-scan: helper remains pure (no DB / storage / witness imports).
// ---------------------------------------------------------------------------

Deno.test("concept_binding_adapter.ts: pure — no DB I/O, no storage/witness imports", async () => {
  const src = await Deno.readTextFile(
    new URL("./concept_binding_adapter.ts", import.meta.url).pathname,
  );

  const FORBIDDEN = [
    /generate-clusters/, /generate-narrative/, /generate-action-plan/,
    /generate-terrain-render/, /generate-ask-anything-context/, /patient-chat/,
    /\bcie_assessments\b/, /\bcie_gate_scores\b/, /\bcie_domain_scores\b/,
    /\bcie_responses\b/, /\bderived_patterns\b/, /\bpatient_narratives\b/,
    /\bterrain_renders\b/, /\baction_plans\b/, /\bpatient_lab_observations\b/,
    /\bpatient_lab_uploads\b/,
    /\bwitness_objects\b/, /\bconcept_assignment_witnesses\b/,
    /\brae_state_transitions\b/,
    /\bcelf_feature_map\b/, /\bontology_concept_proposals\b/,
    /witnessify_impl/, /\.\/storage\//, /gateway_rpc/,
    /\.from\(/, /\.rpc\(/, /\.insert\(/, /\.update\(/, /\.delete\(/, /\.upsert\(/,
    /\bINSERT\s+INTO\b/i, /\bUPDATE\s+\w+\s+SET\b/i, /\bDELETE\s+FROM\b/i,
    /\bSELECT\s+.+\s+FROM\b/i,
    /back_annotated_divergent/,
    /\bFHIR\b/, /openapi/i, /swagger/i,
  ];

  for (const pat of FORBIDDEN) {
    assert(!pat.test(src), `concept_binding_adapter.ts contains forbidden pattern: ${pat}`);
  }

  const importRe = /^\s*import[^"']+["']([^"']+)["']/gm;
  const allowedRel = new Set([
    "./orchestrator.ts",
    "./edge_loaders.ts",
    "./concept_binding.ts",
    "./types.ts",
  ]);
  for (const m of src.matchAll(importRe)) {
    const spec = m[1];
    if (spec.startsWith("./") || spec.startsWith("../")) {
      assert(
        allowedRel.has(spec),
        `concept_binding_adapter.ts has unexpected relative import: ${spec}`,
      );
    } else {
      assert(
        spec.startsWith("jsr:@std/") || spec.startsWith("https://deno.land/std"),
        `concept_binding_adapter.ts has unexpected non-std import: ${spec}`,
      );
    }
  }
});
