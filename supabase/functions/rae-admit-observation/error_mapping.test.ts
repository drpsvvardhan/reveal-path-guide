// ============================================================================
// error_mapping.test.ts — design §9.
// ============================================================================

import { assertEquals } from "jsr:@std/assert@1.0.0";
import {
  ForbiddenError,
  InvalidRequestError,
  mapErrorToResponse,
  MethodNotAllowedError,
  UnauthenticatedError,
} from "./error_mapping.ts";
import {
  InvalidSignalShapeError,
  MalformedClaimError,
  NoCandidateConceptError,
  RegistryGapError,
  UnitNormalizationError,
} from "../_shared/rae/orchestrator.ts";
import {
  CandidateConceptMismatchError,
  CandidateConceptShapeError,
} from "../_shared/rae/concept_binding.ts";
import {
  BackAnnotationVerificationError,
  StorageInputError,
  TransactionRollbackError,
  WitnessifyFailureError,
} from "../_shared/rae/storage/admit.ts";

const cases: Array<[unknown, number, string]> = [
  [new InvalidRequestError("bad", { f: ["x"] }), 400, "invalid_request"],
  [new UnauthenticatedError(), 401, "unauthenticated"],
  [new ForbiddenError(), 403, "forbidden"],
  [new MethodNotAllowedError(), 405, "method_not_allowed"],
  [new MalformedClaimError("m"), 400, "malformed_claim"],
  [new NoCandidateConceptError(), 400, "no_candidate_concept"],
  [new CandidateConceptShapeError("s"), 400, "candidate_concept_shape"],
  [new CandidateConceptMismatchError("m"), 400, "candidate_concept_mismatch"],
  [new InvalidSignalShapeError("i"), 422, "invalid_signal_shape"],
  [new UnitNormalizationError("u"), 422, "unit_normalization_failed"],
  [new RegistryGapError("g"), 422, "registry_gap"],
  [new StorageInputError("s"), 400, "storage_input"],
  [new BackAnnotationVerificationError("b"), 409, "back_annotation_mismatch"],
  [new WitnessifyFailureError("X", "w"), 502, "witness_persist_failed"],
  [new TransactionRollbackError("X", "t"), 500, "transaction_rolled_back"],
  [new Error("boom"), 500, "internal_error"],
  ["nope", 500, "internal_error"],
];

for (const [err, status, code] of cases) {
  Deno.test(`error_mapping: ${code} -> HTTP ${status}`, () => {
    const m = mapErrorToResponse(err);
    assertEquals(m.http_status, status);
    assertEquals(m.body.error.code, code);
  });
}

Deno.test("error_mapping: InvalidRequestError surfaces details payload", () => {
  const m = mapErrorToResponse(new InvalidRequestError("bad", { fields: ["a"] }));
  assertEquals(m.body.error.details, { fields: ["a"] });
});

Deno.test("error_mapping: internal_error scrubs whitespace and caps length", () => {
  const longMsg = "a\n\n   b   ".repeat(50);
  const m = mapErrorToResponse(new Error(longMsg));
  assertEquals(m.body.error.code, "internal_error");
  // Scrubbed: no newlines, no double spaces, length <= 240.
  const msg = m.body.error.message;
  assertEquals(msg.includes("\n"), false);
  assertEquals(msg.length <= 240, true);
});