// ============================================================================
// supabase/functions/_shared/rae/stateMachine.ts
// ----------------------------------------------------------------------------
// RAE admission-state machine. Encodes allowed and forbidden transitions
// from docs/RAE_IMPLEMENTATION_PLAN_v1.md §3.2.
//
// Locked invariants:
//   - Exactly four states (no fifth).
//   - human_confirmed cannot be reversed by an engine actor.
//   - auto_admitted cannot transition directly to rejected by engine
//     (must pass through needs_review).
//   - Every transition requires actor_kind, non-empty actor_id, non-empty
//     reason (≥ 10 chars per plan §3.2 audit table).
//
// PURE module. No I/O. No imports outside ./types.ts.
// ============================================================================

import {
  ADMISSION_STATES,
  type AdmissionState,
  type StateTransitionRequest,
} from "./types.ts";

export const MIN_REASON_LENGTH = 10;

/**
 * Allowed transitions, encoded as a Set of "from->to" pairs, paired with
 * the actor_kinds permitted on that edge. A `null` from-state represents
 * the initial transition (CAW creation).
 */
type ActorKind = "engine" | "human";
type Edge = { from: AdmissionState | null; to: AdmissionState; actors: ActorKind[] };

const ALLOWED_EDGES: Edge[] = [
  // Initial admit by engine.
  { from: null, to: "auto_admitted", actors: ["engine"] },
  { from: null, to: "needs_review", actors: ["engine"] },
  { from: null, to: "rejected", actors: ["engine"] },

  // Engine re-evaluation paths.
  { from: "auto_admitted", to: "needs_review", actors: ["engine", "human"] },
  { from: "needs_review", to: "auto_admitted", actors: ["engine"] },
  { from: "needs_review", to: "rejected", actors: ["engine", "human"] },

  // Human (founder) actions during calibration / review.
  { from: "needs_review", to: "human_confirmed", actors: ["human"] },
  { from: "auto_admitted", to: "human_confirmed", actors: ["human"] },
  { from: "auto_admitted", to: "rejected", actors: ["human"] },
  { from: "rejected", to: "needs_review", actors: ["human"] },
  { from: "rejected", to: "human_confirmed", actors: ["human"] },
];

function edgeKey(from: AdmissionState | null, to: AdmissionState): string {
  return `${from ?? "null"}->${to}`;
}

const EDGE_INDEX: Map<string, ActorKind[]> = new Map(
  ALLOWED_EDGES.map((e) => [edgeKey(e.from, e.to), e.actors]),
);

/**
 * Forbidden transitions enumerated explicitly for spec_alignment guards
 * (plan §3.2 / spec §6.3). The state machine refuses anything not in
 * ALLOWED_EDGES, but this list is the contract surface tests assert on.
 */
export const FORBIDDEN_TRANSITIONS: ReadonlyArray<{
  from: AdmissionState;
  to: AdmissionState;
  actor: ActorKind | "any";
  rule: string;
}> = [
  {
    from: "auto_admitted",
    to: "rejected",
    actor: "engine",
    rule: "engine cannot directly reject an auto_admitted claim; must pass through needs_review",
  },
  {
    from: "human_confirmed",
    to: "auto_admitted",
    actor: "any",
    rule: "human_confirmed cannot be downgraded to auto_admitted",
  },
  {
    from: "human_confirmed",
    to: "rejected",
    actor: "engine",
    rule: "engine cannot reject a human_confirmed claim",
  },
  {
    from: "human_confirmed",
    to: "needs_review",
    actor: "engine",
    rule: "engine cannot reopen a human_confirmed claim for review",
  },
];

export class StateTransitionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "StateTransitionError";
  }
}

export interface TransitionEvaluation {
  /** True when no mutation should occur (re-asserting current state). */
  noop: boolean;
  /** True when the transition is allowed and a row should be appended. */
  allowed: boolean;
}

/**
 * Validate a transition request. Throws StateTransitionError on any
 * invariant violation. Returns { noop: true } when from === to (idempotent
 * re-assertion).
 */
export function evaluateTransition(req: StateTransitionRequest): TransitionEvaluation {
  // Actor + reason invariants apply uniformly.
  if (req.actor_kind !== "engine" && req.actor_kind !== "human") {
    throw new StateTransitionError(
      "actor_kind_invalid",
      `actor_kind must be "engine" or "human", got: ${String(req.actor_kind)}`,
    );
  }
  if (!req.actor_id || req.actor_id.trim().length === 0) {
    throw new StateTransitionError(
      "actor_id_missing",
      "actor_id is required and cannot be empty",
    );
  }
  if (!req.reason || req.reason.trim().length < MIN_REASON_LENGTH) {
    throw new StateTransitionError(
      "reason_missing",
      `reason is required (≥ ${MIN_REASON_LENGTH} chars)`,
    );
  }

  // to-state must be one of the four locked values.
  if (!ADMISSION_STATES.includes(req.to_state)) {
    throw new StateTransitionError(
      "to_state_invalid",
      `to_state ${String(req.to_state)} is not a known AdmissionState`,
    );
  }
  if (req.from_state !== null && !ADMISSION_STATES.includes(req.from_state)) {
    throw new StateTransitionError(
      "from_state_invalid",
      `from_state ${String(req.from_state)} is not a known AdmissionState`,
    );
  }

  // Idempotent no-op: re-asserting current state.
  if (req.from_state !== null && req.from_state === req.to_state) {
    return { noop: true, allowed: false };
  }

  const allowedActors = EDGE_INDEX.get(edgeKey(req.from_state, req.to_state));
  if (!allowedActors) {
    throw new StateTransitionError(
      "transition_forbidden",
      `transition ${req.from_state ?? "null"} -> ${req.to_state} is not in the allowed edge set`,
    );
  }
  if (!allowedActors.includes(req.actor_kind)) {
    throw new StateTransitionError(
      "transition_forbidden_for_actor",
      `transition ${req.from_state ?? "null"} -> ${req.to_state} is not allowed for actor_kind=${req.actor_kind}`,
    );
  }

  return { noop: false, allowed: true };
}

/** Boolean helper; does not throw. */
export function isAllowedTransition(
  from: AdmissionState | null,
  to: AdmissionState,
  actor: ActorKind,
): boolean {
  const allowedActors = EDGE_INDEX.get(edgeKey(from, to));
  return Boolean(allowedActors && allowedActors.includes(actor));
}

/** Internal export for spec_alignment test. */
export const _ALLOWED_EDGES_FOR_TEST: ReadonlyArray<Edge> = ALLOWED_EDGES;
