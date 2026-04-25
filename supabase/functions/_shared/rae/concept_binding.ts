// ============================================================================
// supabase/functions/_shared/rae/concept_binding.ts
// ----------------------------------------------------------------------------
// Pure helpers for binding a request's `candidate_concept` to a loaded
// EngineBinding (engine_version + signal_config + concept_override).
//
// Controlling spec:
//   docs/RAE_EDGE_FUNCTION_WIRING_DESIGN_v1.md §3 (request shape) + §6
//   (concept-override application) + §11 (closed read surface).
//
// Discipline:
//   - No I/O. No DB access. No imports from reasoning surfaces, storage,
//     witnessify_impl, or ontology tables.
//   - Does NOT mutate inputs. Returns new objects.
//   - Does NOT introduce a fifth admission state. Override application is
//     expressed by:
//       (a) forcing `engine_version.calibration_mode = true` so the
//           orchestrator routes through `calibration_all_routes_to_review`
//           (=> `needs_review`), and
//       (b) returning override-derived limitation entries the caller must
//           merge into the produced CAW.limitations and metadata.
// ============================================================================

import type { CandidateConcept } from "./orchestrator.ts";
import type { EngineBinding } from "./edge_loaders.ts";

// ---------------------------------------------------------------------------
// Typed errors.
// ---------------------------------------------------------------------------

/** Thrown when the request's candidate_concept.concept_id does not match
 *  the concept_id used to load the engine binding (signal-config override
 *  + concept-override lookup key). */
export class CandidateConceptMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidateConceptMismatchError";
  }
}

/** Thrown when the candidate_concept payload is structurally unusable. */
export class CandidateConceptShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidateConceptShapeError";
  }
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

export interface ValidateCandidateConceptBindingInput {
  /** The concept_id the caller (edge function) used to load the binding.
   *  Must equal candidate_concept.concept_id. */
  binding_lookup_concept_id: string | null | undefined;
  candidate_concept: CandidateConcept | null | undefined;
  binding: EngineBinding;
}

/**
 * Validate that:
 *   1. candidate_concept is structurally usable (concept_id, canonical_name,
 *      canonical_unit present).
 *   2. candidate_concept.concept_id equals the concept_id used to load the
 *      binding (so signal-config overrides and concept_override apply to
 *      the same concept the orchestrator will adjudicate).
 *   3. If binding.concept_override is present, its candidate_concept_id
 *      equals candidate_concept.concept_id (defence in depth — the loader
 *      already filters by concept, but a mismatch here means the loader
 *      was called with a different key than the request claims).
 */
export function validateCandidateConceptBinding(
  input: ValidateCandidateConceptBindingInput,
): void {
  const cc = input.candidate_concept;
  if (!cc || typeof cc !== "object") {
    throw new CandidateConceptShapeError(
      "candidate_concept missing or not an object",
    );
  }
  if (typeof cc.concept_id !== "string" || cc.concept_id.trim() === "") {
    throw new CandidateConceptShapeError(
      "candidate_concept.concept_id is required",
    );
  }
  if (typeof cc.canonical_name !== "string" || cc.canonical_name.trim() === "") {
    throw new CandidateConceptShapeError(
      "candidate_concept.canonical_name is required",
    );
  }
  if (typeof cc.canonical_unit !== "string") {
    throw new CandidateConceptShapeError(
      "candidate_concept.canonical_unit is required (may be empty string for unitless)",
    );
  }

  const lookupId = input.binding_lookup_concept_id;
  if (typeof lookupId !== "string" || lookupId.trim() === "") {
    throw new CandidateConceptMismatchError(
      "binding_lookup_concept_id is required and must match candidate_concept.concept_id",
    );
  }
  if (lookupId !== cc.concept_id) {
    throw new CandidateConceptMismatchError(
      `candidate_concept.concept_id (${cc.concept_id}) does not match the concept_id used to load the engine binding (${lookupId})`,
    );
  }

  const ov = input.binding.concept_override;
  if (ov && ov.candidate_concept_id !== cc.concept_id) {
    throw new CandidateConceptMismatchError(
      `binding.concept_override.candidate_concept_id (${ov.candidate_concept_id}) does not match candidate_concept.concept_id (${cc.concept_id})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Override application.
// ---------------------------------------------------------------------------

export interface AppliedConceptOverride {
  candidate_concept_id: string;
  reason: string | null;
  /** Why we forced calibration. Stable token for downstream metadata. */
  effect: "forced_needs_review_via_calibration_mode";
}

export interface BindingApplicationResult {
  /** A binding in which engine_version.calibration_mode is forced true
   *  iff a non-lifted concept_override was present on input. signal_config
   *  is passed through unchanged (concept-scoped signal weights were
   *  already folded by the loader). concept_override is preserved. */
  binding: EngineBinding;
  /** Present iff an override was applied. Caller (edge function adapter)
   *  must merge applied_override.reason into CAW.limitations and into the
   *  response metadata block. */
  applied_override: AppliedConceptOverride | null;
}

/**
 * If `binding.concept_override` is present (loader already filters lifted
 * rows out, so any present override is active), return a *new* binding
 * with `engine_version.calibration_mode = true`. The orchestrator will
 * then set `policy_at_decision = "calibration_all_routes_to_review"`,
 * which routes the decision to `needs_review` regardless of identity
 * score. This preserves the four-state lock.
 *
 * If no override is present, returns the binding unchanged (same ref).
 */
export function applyConceptOverrideToBinding(
  binding: EngineBinding,
): BindingApplicationResult {
  if (!binding.concept_override) {
    return { binding, applied_override: null };
  }
  const ov = binding.concept_override;
  const newEngine = {
    ...binding.engine_version,
    calibration_mode: true,
  };
  return {
    binding: {
      engine_version: newEngine,
      signal_config: binding.signal_config,
      concept_override: ov,
    },
    applied_override: {
      candidate_concept_id: ov.candidate_concept_id,
      reason: ov.reason,
      effect: "forced_needs_review_via_calibration_mode",
    },
  };
}

/**
 * Build the limitation entries the caller must merge into the produced
 * CAW.limitations array. Stable, machine-parseable tokens — no free-form
 * prose. Always returns at least one entry when an override was applied.
 */
export function conceptOverrideLimitations(
  applied: AppliedConceptOverride | null,
): string[] {
  if (!applied) return [];
  const out: string[] = [
    `concept_override_applied:${applied.candidate_concept_id}`,
    `concept_override_effect:${applied.effect}`,
  ];
  const reason = (applied.reason ?? "").trim();
  if (reason.length > 0) {
    // Collapse whitespace; cap to keep limitations array readable.
    const flat = reason.replace(/\s+/g, " ").slice(0, 200);
    out.push(`concept_override_reason:${flat}`);
  }
  return out;
}