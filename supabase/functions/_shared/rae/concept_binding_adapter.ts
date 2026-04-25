// ============================================================================
// supabase/functions/_shared/rae/concept_binding_adapter.ts
// ----------------------------------------------------------------------------
// Pure composition helper for the future `rae-admit-observation` edge
// function. Combines candidate-concept validation, concept-override
// application, and limitation-token construction into a single call so the
// edge function can stay a thin transport adapter.
//
// Controlling spec:
//   docs/RAE_EDGE_FUNCTION_WIRING_DESIGN_v1.md §3 (request shape),
//   §6 (concept-override application), §7 (response shape — `applied_override`
//   metadata block), §11 (closed read/write surfaces).
//
// Discipline:
//   - No I/O. No DB imports. No storage/witnessify imports.
//   - Does not mutate inputs.
//   - Does not introduce a fifth admission state.
//   - Returns a sanitized `applied_override_metadata` object that is safe to
//     echo in the edge-function response (no DB internals: no row ids, no
//     timestamps, no `lifted` flag — loader already filtered it).
// ============================================================================

import type { CandidateConcept } from "./orchestrator.ts";
import type { EngineBinding } from "./edge_loaders.ts";
import {
  applyConceptOverrideToBinding,
  type AppliedConceptOverride,
  conceptOverrideLimitations,
  validateCandidateConceptBinding,
} from "./concept_binding.ts";

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

export interface BindCandidateConceptInput {
  /** The concept_id the edge function used to load the engine binding. Must
   *  equal candidate_concept.concept_id. */
  binding_lookup_concept_id: string | null | undefined;
  candidate_concept: CandidateConcept | null | undefined;
  binding: EngineBinding;
}

/** Response-safe projection of an applied concept override. Excludes any
 *  DB internals: no row ids, no engine_version_id (already in the response
 *  envelope), no timestamps, no lifted flag. */
export interface AppliedOverrideMetadata {
  candidate_concept_id: string;
  effect: AppliedConceptOverride["effect"];
  reason: string | null;
}

export interface BindCandidateConceptResult {
  /** The validated, non-null candidate_concept (pass-through reference). */
  candidate_concept: CandidateConcept;
  /** Binding after applyConceptOverrideToBinding (calibration_mode forced
   *  true iff an override was active). Same ref as input when no override. */
  binding: EngineBinding;
  /** Internal applied-override record (full reason text, full effect token).
   *  Pass to `conceptOverrideLimitations` / merge into CAW.metadata. */
  applied_override: AppliedConceptOverride | null;
  /** Response-safe projection. Null iff no override was applied. */
  applied_override_metadata: AppliedOverrideMetadata | null;
  /** Limitation tokens to merge into the CAW.limitations array AFTER
   *  adjudicate() returns. Empty array iff no override was applied. Never
   *  contains blank/empty strings. */
  override_limitations: string[];
}

/**
 * Validate the request's candidate_concept against the loaded engine binding,
 * apply any concept_override (forces engine_version.calibration_mode = true),
 * and return the post-merge limitation tokens plus a sanitized metadata
 * projection suitable for the edge-function response.
 *
 * Throws CandidateConceptShapeError or CandidateConceptMismatchError on
 * invalid input. Caller (edge function) maps these to HTTP 400.
 */
export function bindCandidateConceptForAdmission(
  input: BindCandidateConceptInput,
): BindCandidateConceptResult {
  validateCandidateConceptBinding(input);
  // Validated above: candidate_concept is non-null with required fields.
  const cc = input.candidate_concept as CandidateConcept;

  const { binding, applied_override } = applyConceptOverrideToBinding(
    input.binding,
  );

  const rawLimitations = conceptOverrideLimitations(applied_override);
  // Defensive: drop any blank/whitespace-only token before merge.
  const override_limitations = rawLimitations.filter(
    (t) => typeof t === "string" && t.trim().length > 0,
  );

  const applied_override_metadata: AppliedOverrideMetadata | null =
    applied_override === null
      ? null
      : {
        candidate_concept_id: applied_override.candidate_concept_id,
        effect: applied_override.effect,
        reason: applied_override.reason,
      };

  return {
    candidate_concept: cc,
    binding,
    applied_override,
    applied_override_metadata,
    override_limitations,
  };
}
