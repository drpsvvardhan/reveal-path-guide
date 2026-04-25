// ============================================================================
// supabase/functions/rae-admit-observation/error_mapping.ts
// ----------------------------------------------------------------------------
// Maps internal typed errors (engine, storage, gateway) into stable
// caller-facing { http_status, error.code, error.message } tuples per
// design §9. Pure. No I/O. No DB access.
//
// SQLSTATE codes and DB messages are NEVER leaked: gateway errors are
// already normalized via mapRpcError into typed errors handled here.
// ============================================================================

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

// ---------------------------------------------------------------------------
// Stable caller-facing error code namespace (design §9 + §15 OQ-6).
// ---------------------------------------------------------------------------

export const ERROR_CODES = [
  "invalid_request",
  "unauthenticated",
  "forbidden",
  "method_not_allowed",
  "malformed_claim",
  "no_candidate_concept",
  "candidate_concept_shape",
  "candidate_concept_mismatch",
  "invalid_signal_shape",
  "unit_normalization_failed",
  "registry_gap",
  "storage_input",
  "back_annotation_mismatch",
  "witness_persist_failed",
  "transaction_rolled_back",
  "internal_error",
] as const;

export type ErrorCode = typeof ERROR_CODES[number];

export interface MappedError {
  http_status: number;
  body: {
    error: {
      code: ErrorCode;
      message: string;
      details?: unknown;
    };
  };
}

// ---------------------------------------------------------------------------
// Sentinel sub-classes for shapes that don't have a dedicated typed error
// class (the edge function constructs these locally before calling map()).
// ---------------------------------------------------------------------------

/** Thrown by the edge function for body parse / Zod validation failures. */
export class InvalidRequestError extends Error {
  readonly details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "InvalidRequestError";
    this.details = details;
  }
}

/** Thrown by the edge function when the JWT is missing/invalid. */
export class UnauthenticatedError extends Error {
  constructor(message = "missing or invalid bearer token") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/** Thrown by the edge function when has_role(...,'admin') returns false. */
export class ForbiddenError extends Error {
  constructor(message = "admin role required") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown by the edge function for non-POST/OPTIONS requests. */
export class MethodNotAllowedError extends Error {
  constructor(message = "only POST and OPTIONS are allowed") {
    super(message);
    this.name = "MethodNotAllowedError";
  }
}

// ---------------------------------------------------------------------------
// Scrub a message for the "Anything else => internal_error" branch.
// ---------------------------------------------------------------------------

function scrub(message: string): string {
  // Strip newlines and runs of whitespace; cap length.
  return message.replace(/\s+/g, " ").trim().slice(0, 240);
}

// ---------------------------------------------------------------------------
// Public mapper.
// ---------------------------------------------------------------------------

export function mapErrorToResponse(err: unknown): MappedError {
  if (err instanceof InvalidRequestError) {
    return {
      http_status: 400,
      body: { error: { code: "invalid_request", message: err.message, details: err.details } },
    };
  }
  if (err instanceof UnauthenticatedError) {
    return {
      http_status: 401,
      body: { error: { code: "unauthenticated", message: err.message } },
    };
  }
  if (err instanceof ForbiddenError) {
    return {
      http_status: 403,
      body: { error: { code: "forbidden", message: err.message } },
    };
  }
  if (err instanceof MethodNotAllowedError) {
    return {
      http_status: 405,
      body: { error: { code: "method_not_allowed", message: err.message } },
    };
  }
  if (err instanceof MalformedClaimError) {
    return {
      http_status: 400,
      body: { error: { code: "malformed_claim", message: err.message } },
    };
  }
  if (err instanceof NoCandidateConceptError) {
    return {
      http_status: 400,
      body: { error: { code: "no_candidate_concept", message: err.message } },
    };
  }
  if (err instanceof CandidateConceptShapeError) {
    return {
      http_status: 400,
      body: { error: { code: "candidate_concept_shape", message: err.message } },
    };
  }
  if (err instanceof CandidateConceptMismatchError) {
    return {
      http_status: 400,
      body: { error: { code: "candidate_concept_mismatch", message: err.message } },
    };
  }
  if (err instanceof InvalidSignalShapeError) {
    return {
      http_status: 422,
      body: { error: { code: "invalid_signal_shape", message: err.message } },
    };
  }
  if (err instanceof UnitNormalizationError) {
    return {
      http_status: 422,
      body: { error: { code: "unit_normalization_failed", message: err.message } },
    };
  }
  if (err instanceof RegistryGapError) {
    return {
      http_status: 422,
      body: { error: { code: "registry_gap", message: err.message } },
    };
  }
  if (err instanceof StorageInputError) {
    return {
      http_status: 400,
      body: { error: { code: "storage_input", message: err.message } },
    };
  }
  if (err instanceof BackAnnotationVerificationError) {
    return {
      http_status: 409,
      body: { error: { code: "back_annotation_mismatch", message: err.message } },
    };
  }
  if (err instanceof WitnessifyFailureError) {
    return {
      http_status: 502,
      body: { error: { code: "witness_persist_failed", message: err.message } },
    };
  }
  if (err instanceof TransactionRollbackError) {
    return {
      http_status: 500,
      body: { error: { code: "transaction_rolled_back", message: err.message } },
    };
  }

  const raw = err instanceof Error ? err.message : String(err);
  return {
    http_status: 500,
    body: { error: { code: "internal_error", message: scrub(raw) } },
  };
}