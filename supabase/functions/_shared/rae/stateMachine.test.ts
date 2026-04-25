// ============================================================================
// supabase/functions/_shared/rae/stateMachine.test.ts
// ----------------------------------------------------------------------------
// Tests for the RAE admission-state machine. Mirrors plan §3.2 + §7.3.
// ============================================================================

import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.0";
import {
  ADMISSION_STATES,
  type AdmissionState,
  type StateTransitionRequest,
} from "./types.ts";
import {
  evaluateTransition,
  isAllowedTransition,
  StateTransitionError,
  FORBIDDEN_TRANSITIONS,
  MIN_REASON_LENGTH,
} from "./stateMachine.ts";

const REASON = "founder confirmed during VV-001 calibration";

function req(
  patch: Partial<StateTransitionRequest> & {
    from_state: AdmissionState | null;
    to_state: AdmissionState;
    actor_kind: "engine" | "human";
  },
): StateTransitionRequest {
  return {
    actor_id: "engine-v0.1.0",
    reason: REASON,
    ...patch,
  };
}

// ---------------------------------------------------------------------------
// Allowed transitions — explicit allow-list.
// ---------------------------------------------------------------------------
const ALLOWED_CASES: ReadonlyArray<
  [AdmissionState | null, AdmissionState, "engine" | "human"]
> = [
  [null, "auto_admitted", "engine"],
  [null, "needs_review", "engine"],
  [null, "rejected", "engine"],
  ["auto_admitted", "needs_review", "engine"],
  ["auto_admitted", "needs_review", "human"],
  ["needs_review", "auto_admitted", "engine"],
  ["needs_review", "rejected", "engine"],
  ["needs_review", "rejected", "human"],
  ["needs_review", "human_confirmed", "human"],
  ["auto_admitted", "human_confirmed", "human"],
  ["auto_admitted", "rejected", "human"],
  ["rejected", "needs_review", "human"],
  ["rejected", "human_confirmed", "human"],
];

for (const [from, to, actor] of ALLOWED_CASES) {
  Deno.test(`stateMachine: allowed ${from ?? "null"} -> ${to} by ${actor}`, () => {
    const out = evaluateTransition(req({ from_state: from, to_state: to, actor_kind: actor }));
    assertEquals(out, { noop: false, allowed: true });
    assert(isAllowedTransition(from, to, actor));
  });
}

// ---------------------------------------------------------------------------
// Forbidden transitions — explicit deny-list from FORBIDDEN_TRANSITIONS.
// ---------------------------------------------------------------------------
Deno.test("stateMachine: every FORBIDDEN_TRANSITIONS entry is rejected", () => {
  for (const f of FORBIDDEN_TRANSITIONS) {
    const actors: Array<"engine" | "human"> =
      f.actor === "any" ? ["engine", "human"] : [f.actor];
    for (const actor of actors) {
      assertThrows(
        () =>
          evaluateTransition(
            req({ from_state: f.from, to_state: f.to, actor_kind: actor }),
          ),
        StateTransitionError,
        undefined,
        `expected throw for ${f.from} -> ${f.to} by ${actor} (rule: ${f.rule})`,
      );
      assert(
        !isAllowedTransition(f.from, f.to, actor),
        `isAllowedTransition should be false for ${f.from} -> ${f.to} by ${actor}`,
      );
    }
  }
});

// Specifically named cases from the prompt.
Deno.test("stateMachine: human_confirmed cannot be rejected by engine", () => {
  assertThrows(
    () =>
      evaluateTransition(
        req({ from_state: "human_confirmed", to_state: "rejected", actor_kind: "engine" }),
      ),
    StateTransitionError,
  );
});

Deno.test("stateMachine: auto_admitted cannot go directly to rejected by engine", () => {
  assertThrows(
    () =>
      evaluateTransition(
        req({ from_state: "auto_admitted", to_state: "rejected", actor_kind: "engine" }),
      ),
    StateTransitionError,
  );
});

// ---------------------------------------------------------------------------
// Missing actor / reason invariants.
// ---------------------------------------------------------------------------
Deno.test("stateMachine: missing actor_id throws", () => {
  assertThrows(
    () =>
      evaluateTransition({
        from_state: null,
        to_state: "auto_admitted",
        actor_kind: "engine",
        actor_id: "",
        reason: REASON,
      }),
    StateTransitionError,
    "actor_id",
  );
});

Deno.test("stateMachine: missing reason throws", () => {
  assertThrows(
    () =>
      evaluateTransition({
        from_state: null,
        to_state: "auto_admitted",
        actor_kind: "engine",
        actor_id: "engine-v0.1.0",
        reason: "",
      }),
    StateTransitionError,
    "reason",
  );
});

Deno.test(`stateMachine: short reason (< ${MIN_REASON_LENGTH} chars) throws`, () => {
  assertThrows(
    () =>
      evaluateTransition({
        from_state: null,
        to_state: "auto_admitted",
        actor_kind: "engine",
        actor_id: "engine-v0.1.0",
        reason: "short",
      }),
    StateTransitionError,
  );
});

Deno.test("stateMachine: invalid actor_kind throws", () => {
  assertThrows(
    () =>
      evaluateTransition({
        from_state: null,
        to_state: "auto_admitted",
        // deno-lint-ignore no-explicit-any
        actor_kind: "robot" as any,
        actor_id: "x",
        reason: REASON,
      }),
    StateTransitionError,
    "actor_kind",
  );
});

// ---------------------------------------------------------------------------
// Idempotence — re-asserting current state is a no-op.
// ---------------------------------------------------------------------------
Deno.test("stateMachine: re-asserting current state is a no-op", () => {
  for (const s of ADMISSION_STATES) {
    const out = evaluateTransition(
      req({ from_state: s, to_state: s, actor_kind: "human" }),
    );
    assertEquals(out, { noop: true, allowed: false }, `re-assert of ${s}`);
  }
});

// ---------------------------------------------------------------------------
// Enum lock — exactly four states, names exactly match schema enum.
// ---------------------------------------------------------------------------
Deno.test("stateMachine: ADMISSION_STATES has exactly four entries", () => {
  assertEquals(ADMISSION_STATES.length, 4);
  assertEquals(
    [...ADMISSION_STATES].sort(),
    ["auto_admitted", "human_confirmed", "needs_review", "rejected"],
  );
});

Deno.test("stateMachine: no fifth state literal appears in module source", async () => {
  const src = await Deno.readTextFile(new URL("./stateMachine.ts", import.meta.url));
  assert(!src.includes("back_annotated_divergent"), "fifth-state literal must not appear");
});
