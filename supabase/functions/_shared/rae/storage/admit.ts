// ============================================================================
// supabase/functions/_shared/rae/storage/admit.ts
// ----------------------------------------------------------------------------
// RAE storage / persistence layer.
// Controlling spec: docs/RAE_STORAGE_PERSISTENCE_DESIGN_v1.md.
//
// CodexOS-approved design lock:
//   1. Single Postgres transaction; witnessify_impl is a pure in-memory
//      builder, witness_objects insert runs in the same txn.
//   2. Back-annotation hard-verifies (user_id, source_table, source_row_id);
//      ontology_concept_id mismatch becomes founder_review_flag + a
//      "back_annotation_concept_drift:" entry in limitations.
//   3. Closed write set: concept_assignment_witnesses, rae_state_transitions,
//      witness_objects (via the approved insert path only).
//   4. Same module hosts persistInitialAdmission and (later) applyReviewAction.
//
// This file implements persistInitialAdmission only. It is a pure module:
// it takes an AdmitGateway (transaction-capable abstraction) injected by
// the caller. The real edge function wires AdmitGateway to a service-role
// Supabase client running a single Postgres transaction; the test suite
// wires it to an in-memory fake that enforces the same atomic contract.
//
// No I/O is performed inside this file beyond what AdmitGateway exposes.
// ============================================================================

import {
  type AdmissionState,
  type ActorKind,
  type CalibrationPolicy,
  type ConceptAssignmentWitness,
  type ConceptAssignmentWitnessDraft,
} from "../types.ts";
import {
  evaluateTransition,
  StateTransitionError,
} from "../stateMachine.ts";
import type {
  AdmissionDecisionV1,
  WitnessIntent,
} from "../orchestrator.ts";

// ---------------------------------------------------------------------------
// Public typed errors. Surfaced to the caller; never converted to a
// fifth admission state.
// ---------------------------------------------------------------------------

export class StorageInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageInputError";
  }
}

export class BackAnnotationVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackAnnotationVerificationError";
  }
}

export class WitnessifyFailureError extends Error {
  readonly cause_error_name: string;
  constructor(causeName: string, message: string) {
    super(message);
    this.name = "WitnessifyFailureError";
    this.cause_error_name = causeName;
  }
}

export class TransactionRollbackError extends Error {
  readonly underlying_error_name: string;
  constructor(underlyingName: string, message: string) {
    super(message);
    this.name = "TransactionRollbackError";
    this.underlying_error_name = underlyingName;
  }
}

// ---------------------------------------------------------------------------
// Witness shape understood by the storage layer. Mirrors the subset of
// p1a WitnessObject fields needed for the approved insert path. The
// gateway's insertWitness implementation is responsible for delegating
// to that path; the storage layer never hand-rolls an INSERT itself.
// ---------------------------------------------------------------------------

export interface WitnessRowInput {
  witness_id: string;
  user_id: string;
  source_table: string;
  source_row_id: string;
  // The orchestrator never builds a witness payload, so this layer never
  // reads the full WitnessObject — the caller's witnessify build adapter
  // (see WitnessifyAdapter below) returns one of these slim rows that the
  // gateway forwards to the approved insert path.
  ontology_concept_id: string | null;
  // Free-form passthrough for extra columns the approved insert path
  // populates (registry_seed_version, transformation_version, etc).
  // The storage layer does not inspect this object.
  passthrough: Record<string, unknown>;
}

/**
 * In-memory build adapter. The caller wires this to witnessify_impl
 * (witnessifyObservation) so that the resulting WitnessObject is shaped
 * for the approved insert path. The storage layer NEVER constructs a
 * witness payload itself; it only invokes this adapter inside the txn.
 *
 * The adapter must be pure (no DB I/O). Failures must throw — the
 * storage layer catches and rolls back.
 */
export type WitnessifyAdapter = (
  decision: AdmissionDecisionV1,
) => WitnessRowInput;

// ---------------------------------------------------------------------------
// AdmitGateway — the single seam between this module and Postgres.
//
// All operations run inside the transaction managed by `runInTransaction`.
// The storage layer never holds a connection of its own. Implementations:
//   - real: a service-role Supabase/pg client running BEGIN/COMMIT/ROLLBACK
//     and forwarding insertWitness to the approved witnessify insert path
//     (the same call site witnessify-observations uses).
//   - fake (tests): in-memory store that simulates atomicity and trigger
//     rejections.
//
// AdmitGateway is the only allowed write surface. The closed-write-set
// guard (§9.8) is enforced by static scan over admit.ts itself: this
// module never writes to any table directly.
// ---------------------------------------------------------------------------

export interface ExistingCawLookup {
  found: false;
}
export interface ExistingCawHit {
  found: true;
  caw: ConceptAssignmentWitness;
}
export type CawLookup = ExistingCawLookup | ExistingCawHit;

export interface WitnessProvenance {
  witness_id: string;
  user_id: string;
  source_table: string;
  source_row_id: string;
  ontology_concept_id: string | null;
}

export interface AdmitGateway {
  /**
   * Lookup CAW by deterministic caw_id. Idempotency probe.
   * Must run inside the open transaction.
   */
  findCawByCawId(caw_id: string): Promise<CawLookup>;

  /**
   * Insert the CAW row. produced_witness_id is initially NULL even when
   * a witness will be produced; backfill comes later in the same txn.
   * Must raise on unique-violation of caw_id (idempotency race).
   */
  insertCaw(draft: ConceptAssignmentWitnessDraft): Promise<ConceptAssignmentWitness>;

  /**
   * Insert the initial state transition row. Caller has already run
   * evaluateTransition; the gateway only persists.
   */
  insertStateTransition(row: {
    caw_id: string;
    from_state: AdmissionState | null;
    to_state: AdmissionState;
    actor_kind: ActorKind;
    actor_id: string;
    reason: string;
    policy: CalibrationPolicy;
  }): Promise<void>;

  /**
   * Insert the witness via the approved witnessify insert path.
   * Must NOT be a hand-rolled INSERT against witness_objects in the real
   * gateway implementation; it must forward to the same shared insert
   * helper used by witnessify-observations.
   */
  insertWitness(row: WitnessRowInput): Promise<{ witness_id: string }>;

  /**
   * Backfill produced_witness_id on an already-inserted CAW row.
   * Triggers enforce_caw_ancestry_integrity at the DB layer.
   */
  setCawProducedWitnessId(
    caw_id: string,
    produced_witness_id: string,
  ): Promise<ConceptAssignmentWitness>;

  /**
   * Fetch witness provenance for back-annotation verification.
   * Returns null if witness_id does not exist.
   */
  findWitnessProvenance(witness_id: string): Promise<WitnessProvenance | null>;
}

/**
 * Transaction runner. The gateway is constructed per-transaction by the
 * caller; the body callback runs inside BEGIN/COMMIT, and any thrown
 * error triggers ROLLBACK. The storage layer relies on this contract for
 * §2's single-transaction guarantee.
 */
export type RunInTransaction = <T>(
  body: (gw: AdmitGateway) => Promise<T>,
) => Promise<T>;

// ---------------------------------------------------------------------------
// Public entry point: persistInitialAdmission.
// ---------------------------------------------------------------------------

export interface PersistInitialAdmissionInput {
  decision: AdmissionDecisionV1;
  /**
   * Pre-existing witness id used by back-annotation. Required when
   * decision.caw.policy_at_decision === "back_annotation"; forbidden
   * otherwise.
   */
  back_annotation_witness_id?: string;
  /**
   * Reason string for the initial state transition. Must be
   * ≥ 10 chars (state machine invariant).
   */
  reason: string;
  /**
   * In-memory witness build adapter. Required when
   * decision.witness_intent === "produce_depth0_witness". Not consulted
   * otherwise. The storage layer never builds a witness on its own.
   */
  witnessify_adapter?: WitnessifyAdapter;
}

export interface PersistInitialAdmissionResult {
  mode: "created" | "existing";
  caw: ConceptAssignmentWitness;
}

export async function persistInitialAdmission(
  input: PersistInitialAdmissionInput,
  runInTransaction: RunInTransaction,
): Promise<PersistInitialAdmissionResult> {
  validateInput(input);

  const { decision, back_annotation_witness_id, reason, witnessify_adapter } =
    input;
  const draft = decision.caw;
  const intent = decision.witness_intent;

  return await runInTransaction(async (gw) => {
    // Step 1: idempotency probe.
    const probe = await gw.findCawByCawId(draft.caw_id);
    if (probe.found) {
      return { mode: "created" as const, caw: probe.caw }._asExisting();
    }

    // Step 2: validate state transition BEFORE any insert.
    // Throws StateTransitionError on any violation; rollback via thrown
    // error from the txn body.
    evaluateTransition({
      from_state: null,
      to_state: draft.current_state,
      actor_kind: draft.current_state_actor_kind,
      actor_id: draft.current_state_actor_id,
      reason,
      policy: draft.policy_at_decision,
    });

    // Step 3: in-memory witness build (when intent says so).
    // For back-annotation, intent must be "none" and we instead verify
    // the supplied witness id below.
    let builtWitness: WitnessRowInput | null = null;
    if (intent === "produce_depth0_witness") {
      if (!witnessify_adapter) {
        throw new StorageInputError(
          "witnessify_adapter is required when witness_intent='produce_depth0_witness'",
        );
      }
      try {
        builtWitness = witnessify_adapter(decision);
      } catch (err) {
        throw new WitnessifyFailureError(
          err instanceof Error ? err.name : "Unknown",
          `witnessify build failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      // Sanity: the built witness must align on (user_id, source_table,
      // source_row_id) with the CAW being persisted. This is the same
      // invariant the DB ancestry trigger enforces, surfaced earlier.
      if (
        builtWitness.user_id !== draft.user_id ||
        builtWitness.source_table !== draft.source_table ||
        builtWitness.source_row_id !== draft.source_row_id
      ) {
        throw new WitnessifyFailureError(
          "WitnessProvenanceMismatch",
          "witnessify_adapter produced a witness whose provenance does not match the CAW",
        );
      }
    }

    // Back-annotation verification (hard).
    let backAnnotationLimitationsSuffix: string[] = [];
    let backAnnotationFlagOverride = false;
    if (draft.policy_at_decision === "back_annotation") {
      const wid = back_annotation_witness_id!;
      const prov = await gw.findWitnessProvenance(wid);
      if (!prov) {
        throw new BackAnnotationVerificationError(
          `back_annotation_witness_id ${wid} does not exist`,
        );
      }
      if (
        prov.user_id !== draft.user_id ||
        prov.source_table !== draft.source_table ||
        prov.source_row_id !== draft.source_row_id
      ) {
        throw new BackAnnotationVerificationError(
          `back_annotation provenance mismatch: witness ${wid} provenance ` +
            `(${prov.user_id}, ${prov.source_table}, ${prov.source_row_id}) ` +
            `!= caw (${draft.user_id}, ${draft.source_table}, ${draft.source_row_id})`,
        );
      }
      // Soft verification: ontology_concept_id drift becomes a flag + limitation.
      if (
        prov.ontology_concept_id !== null &&
        prov.ontology_concept_id !== draft.candidate_concept_id
      ) {
        backAnnotationLimitationsSuffix = [
          `back_annotation_concept_drift: witness ontology_concept_id ` +
            `${prov.ontology_concept_id} != caw candidate_concept_id ${draft.candidate_concept_id}`,
        ];
        backAnnotationFlagOverride = true;
      }
    }

    // Compose the draft to persist (limitations + founder_review_flag may
    // be amended by back-annotation soft verification).
    const persistableDraft: ConceptAssignmentWitnessDraft = {
      ...draft,
      limitations: backAnnotationLimitationsSuffix.length > 0
        ? [...draft.limitations, ...backAnnotationLimitationsSuffix]
        : draft.limitations,
      founder_review_flag: draft.founder_review_flag || backAnnotationFlagOverride,
      // produced_witness_id is set later (or, for back-annotation, here from input).
      produced_witness_id: draft.policy_at_decision === "back_annotation"
        ? back_annotation_witness_id ?? null
        : null,
    };

    // Step 4: insert the CAW row.
    const insertedCaw = await gw.insertCaw(persistableDraft);

    // Step 5: insert the initial transition row.
    await gw.insertStateTransition({
      caw_id: insertedCaw.caw_id,
      from_state: null,
      to_state: insertedCaw.current_state,
      actor_kind: insertedCaw.current_state_actor_kind,
      actor_id: insertedCaw.current_state_actor_id,
      reason,
      policy: insertedCaw.policy_at_decision,
    });

    // Step 6 + 7: insert witness via approved path, then backfill.
    if (builtWitness) {
      let inserted: { witness_id: string };
      try {
        inserted = await gw.insertWitness(builtWitness);
      } catch (err) {
        // Trigger rollback via re-throw, wrapping for clarity.
        throw new WitnessifyFailureError(
          err instanceof Error ? err.name : "Unknown",
          `witness insert failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      const backfilled = await gw.setCawProducedWitnessId(
        insertedCaw.caw_id,
        inserted.witness_id,
      );
      return { mode: "created" as const, caw: backfilled };
    }

    // Back-annotation path: produced_witness_id was set on the CAW row at
    // insert time (above). Final read-back is the inserted row itself.
    return { mode: "created" as const, caw: insertedCaw };
  });
}

// ---------------------------------------------------------------------------
// Internal helpers.
// ---------------------------------------------------------------------------

function validateInput(input: PersistInitialAdmissionInput): void {
  if (!input || !input.decision || !input.decision.caw) {
    throw new StorageInputError("decision.caw is required");
  }
  const draft = input.decision.caw;
  if (!draft.caw_id) {
    throw new StorageInputError("decision.caw.caw_id is required");
  }
  if (draft.current_state_actor_kind !== "engine") {
    throw new StorageInputError(
      "persistInitialAdmission requires actor_kind='engine'; " +
        "human-driven transitions belong in applyReviewAction",
    );
  }
  if (!input.reason || input.reason.trim().length < 10) {
    throw new StorageInputError(
      "reason is required and must be >= 10 chars (state machine invariant)",
    );
  }

  const policy = draft.policy_at_decision;
  const intent = input.decision.witness_intent;

  if (policy === "back_annotation") {
    if (!input.back_annotation_witness_id) {
      throw new StorageInputError(
        "back_annotation policy requires back_annotation_witness_id",
      );
    }
    if (intent !== "none") {
      throw new StorageInputError(
        "back_annotation policy requires witness_intent='none'; " +
          "back-annotation never produces a new witness",
      );
    }
    if (!draft.founder_review_flag) {
      // Orchestrator already enforces this; restate as a hard guard so
      // a misconfigured orchestrator can't slip past us.
      throw new StorageInputError(
        "back_annotation policy requires founder_review_flag=true on the CAW draft",
      );
    }
  } else {
    if (input.back_annotation_witness_id) {
      throw new StorageInputError(
        "back_annotation_witness_id is only valid with policy='back_annotation'",
      );
    }
  }

  if (intent !== "produce_depth0_witness" && intent !== "none") {
    throw new StorageInputError(
      `witness_intent must be 'produce_depth0_witness' or 'none'; got ${String(intent)}`,
    );
  }
}

// Tiny helper to convert mode at the type level. Kept inline to avoid
// branching the return shape twice. (Also documents intent.)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  interface Object {
    _asExisting?: () => PersistInitialAdmissionResult;
  }
}
Object.defineProperty(Object.prototype, "_asExisting", {
  value: function (this: PersistInitialAdmissionResult) {
    return { mode: "existing" as const, caw: this.caw };
  },
  enumerable: false,
  configurable: true,
  writable: true,
});

// ---------------------------------------------------------------------------
// Module-level affirmation for the §9.8 closed-write-set static scan.
//
// This file performs ZERO database I/O. All writes go through the
// AdmitGateway abstraction. The static test scans this file for any
// table-targeting write patterns and asserts none exist.
// ---------------------------------------------------------------------------