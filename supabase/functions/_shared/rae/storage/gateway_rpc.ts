// ============================================================================
// supabase/functions/_shared/rae/storage/gateway_rpc.ts
// ----------------------------------------------------------------------------
// RPC binding for the RAE AdmitGateway abstraction defined in admit.ts.
//
// CodexOS-approved wiring:
//   - Single Postgres transaction lives entirely server-side, inside the
//     SECURITY DEFINER function public.rae_persist_initial_admission.
//   - This module's only allowed Supabase call is:
//         supabaseClient.rpc("rae_persist_initial_admission", { p_payload })
//     No .from(...).insert/update/delete/upsert. No raw SQL. No reads.
//   - The closed write set is enforced at the database layer via the RPC's
//     GRANT/REVOKE surface (service_role only). This file additionally
//     refuses to reference any forbidden table name.
//
// Strategy:
//   admit.ts drives the AdmitGateway as if it owned a transaction, calling
//   findCawByCawId then optionally findWitnessProvenance, then insertCaw,
//   insertStateTransition, then optionally insertWitness +
//   setCawProducedWitnessId. We cannot satisfy these calls one-by-one
//   against a single RPC, so this module BUFFERS them inside a
//   per-transaction context and dispatches exactly one RPC at the end of
//   the body. The RPC then performs its own server-side idempotency probe,
//   back-annotation hard verification, CAW insert, transition insert,
//   witness insert, and produced_witness_id backfill, atomically.
//
//   The TS-side gateway methods return synthetic skeletons that admit.ts
//   uses to thread state through its flow. After the body resolves, this
//   module fires the RPC and rewrites the in-flight CAW skeleton in place
//   so admit.ts's returned reference reflects the authoritative DB row.
// ============================================================================

import {
  BackAnnotationVerificationError,
  StorageInputError,
  TransactionRollbackError,
  WitnessifyFailureError,
  type AdmitGateway,
  type CawLookup,
  type RunInTransaction,
  type WitnessProvenance,
  type WitnessRowInput,
} from "./admit.ts";
import type {
  ActorKind,
  AdmissionState,
  CalibrationPolicy,
  ConceptAssignmentWitness,
  ConceptAssignmentWitnessDraft,
} from "../types.ts";

// ---------------------------------------------------------------------------
// Minimal Supabase client surface this module is allowed to use.
// Intentionally narrow: only `.rpc(name, args)`. Tests inject a fake
// matching this shape.
// ---------------------------------------------------------------------------

export interface RpcResponse<T> {
  data: T | null;
  error: RpcError | null;
}

export interface RpcError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export interface RpcCapableClient {
  rpc<T = unknown>(
    fn: "rae_persist_initial_admission",
    args: { p_payload: RaePersistInitialAdmissionPayload },
  ): Promise<RpcResponse<T>>;
}

// ---------------------------------------------------------------------------
// RPC payload + result shapes (must match the SQL function signature in
// supabase/migrations/<ts>_rae_persist_initial_admission.sql).
// ---------------------------------------------------------------------------

export interface RaePersistInitialAdmissionPayload {
  caw: ConceptAssignmentWitnessDraft;
  witness_intent: "produce_depth0_witness" | "none";
  reason: string;
  policy: CalibrationPolicy;
  from_state: AdmissionState | null;
  to_state: AdmissionState;
  actor_kind: ActorKind;
  actor_id: string;
  back_annotation_existing_witness_id?: string;
  witness_payload?: WitnessPayloadShape;
}

export interface WitnessPayloadShape {
  witness_id: string;
  user_id: string;
  source_table: string;
  source_row_id: string;
  ancestry_witness_ids?: string[];
  source_window: string;
  signal: string;
  domain_of_access: string;
  epistemic_role: string;
  reliability_class: string;
  compression_depth: number;
  observed_value: unknown;
  observed_unit?: string | null;
  testimony: string;
  limitations: string[];
  confidence_value?: number | null;
  confidence_basis: string;
  biological_timestamp?: string | null;
  validity_window_seconds?: number | null;
  conflict_candidates?: string[] | null;
  transformation_version: string;
  registry_seed_version: string;
  derived_from_packet_id?: string | null;
}

export interface RaePersistInitialAdmissionResult {
  mode: "created" | "existing";
  caw: ConceptAssignmentWitness;
  witness_id: string | null;
}

// ---------------------------------------------------------------------------
// Witness payload adapter. Lifts admit.ts's slim WitnessRowInput into the
// full witness payload the RPC requires. Keeps witness shape concerns out
// of admit.ts and out of this binding.
// ---------------------------------------------------------------------------

export type WitnessPayloadAdapter = (
  row: WitnessRowInput,
) => WitnessPayloadShape;

// ---------------------------------------------------------------------------
// SQLSTATE / message → typed-error mapping.
//
//   23505 unique violation                                     -> Error("duplicate key …")
//   22023 invalid_parameter (payload missing fields)           -> StorageInputError
//   P0001 raise_exception:
//     "back_annotation tuple mismatch" / "back_annotation witness … not found"
//                                                              -> BackAnnotationVerificationError
//     "rae_insert_witness_object:" / "witness_ancestry_" /
//     "caw_ancestry_"                                          -> WitnessifyFailureError
//     "caw_limitations_blank_entry"                            -> StorageInputError
//     other P0001                                              -> TransactionRollbackError("PgRaiseException", …)
//   42501 insufficient_privilege                                -> TransactionRollbackError("PgInsufficientPrivilege", …)
//   anything else                                               -> TransactionRollbackError("Pg<code>"|"PgUnknown", …)
// ---------------------------------------------------------------------------

export function mapRpcError(err: RpcError): Error {
  const msg = err.message ?? "";
  const code = err.code ?? "";

  if (code === "23505") {
    return new Error(
      msg.includes("duplicate key")
        ? msg
        : `duplicate key value violates unique constraint: ${msg}`,
    );
  }

  if (code === "22023") {
    return new StorageInputError(`rpc rejected payload: ${msg}`);
  }

  if (code === "P0001") {
    if (
      msg.includes("back_annotation tuple mismatch") ||
      (msg.includes("back_annotation witness") && msg.includes("not found")) ||
      msg.includes("rae_persist_initial_admission: back_annotation")
    ) {
      return new BackAnnotationVerificationError(msg);
    }
    if (
      msg.startsWith("rae_insert_witness_object:") ||
      msg.includes("witness_ancestry_") ||
      msg.includes("caw_ancestry_")
    ) {
      return new WitnessifyFailureError("PgWitnessRejection", msg);
    }
    if (msg.includes("caw_limitations_blank_entry")) {
      return new StorageInputError(msg);
    }
    return new TransactionRollbackError("PgRaiseException", msg);
  }

  if (code === "42501") {
    return new TransactionRollbackError("PgInsufficientPrivilege", msg);
  }

  return new TransactionRollbackError(
    code ? `Pg${code}` : "PgUnknown",
    msg || "rae_persist_initial_admission rpc failed without message",
  );
}

// ---------------------------------------------------------------------------
// Buffered transaction context.
// ---------------------------------------------------------------------------

interface BufferedContext {
  draft: ConceptAssignmentWitnessDraft | null;
  cawHandle: ConceptAssignmentWitness | null;
  transition: {
    caw_id: string;
    from_state: AdmissionState | null;
    to_state: AdmissionState;
    actor_kind: ActorKind;
    actor_id: string;
    reason: string;
    policy: CalibrationPolicy;
  } | null;
  witnessRow: WitnessRowInput | null;
  backAnnotationWitnessId: string | null;
}

function newContext(): BufferedContext {
  return {
    draft: null,
    cawHandle: null,
    transition: null,
    witnessRow: null,
    backAnnotationWitnessId: null,
  };
}

function skeletonFromDraft(
  draft: ConceptAssignmentWitnessDraft,
): ConceptAssignmentWitness {
  return {
    ...draft,
    id: "00000000-0000-0000-0000-000000000000",
    current_state_entered_at: new Date(0).toISOString(),
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

function rewriteHandle(
  handle: ConceptAssignmentWitness,
  authoritative: ConceptAssignmentWitness,
): void {
  for (const k of Object.keys(handle)) {
    delete (handle as unknown as Record<string, unknown>)[k];
  }
  Object.assign(handle, authoritative);
}

// ---------------------------------------------------------------------------
// Public factory: makeRpcAdmitGateway.
// Returns a RunInTransaction bound to the supplied client + adapter.
// Wire this into persistInitialAdmission as its second argument.
// ---------------------------------------------------------------------------

export interface MakeRpcAdmitGatewayOptions {
  witnessPayloadAdapter: WitnessPayloadAdapter;
}

export function makeRpcAdmitGateway(
  client: RpcCapableClient,
  options: MakeRpcAdmitGatewayOptions,
): RunInTransaction {
  const { witnessPayloadAdapter } = options;

  return async function runInTransaction<T>(
    body: (gw: AdmitGateway) => Promise<T>,
  ): Promise<T> {
    const ctx = newContext();

    const gw: AdmitGateway = {
      // Idempotency probe is delegated to the RPC. Always report not
      // found here so admit.ts proceeds; the RPC short-circuits and
      // returns mode=existing if the caw_id already exists.
      findCawByCawId(_caw_id: string): Promise<CawLookup> {
        return Promise.resolve({ found: false });
      },

      // Back-annotation hard verification runs server-side inside the
      // RPC against the authoritative witness_objects row. We cannot
      // read witness_objects from this module, so we return a synthetic
      // provenance keyed off the supplied draft. ontology_concept_id is
      // null so admit.ts's TS-side soft-drift check is suppressed; soft
      // drift will be reintroduced once witness_objects.ontology_concept_id
      // exists (separate, CodexOS-approved change).
      findWitnessProvenance(
        witness_id: string,
      ): Promise<WitnessProvenance | null> {
        ctx.backAnnotationWitnessId = witness_id;
        const d = ctx.draft;
        return Promise.resolve({
          witness_id,
          user_id: d ? d.user_id : "",
          source_table: d ? d.source_table : "",
          source_row_id: d ? d.source_row_id : "",
          ontology_concept_id: null,
        });
      },

      insertCaw(
        draft: ConceptAssignmentWitnessDraft,
      ): Promise<ConceptAssignmentWitness> {
        ctx.draft = draft;
        ctx.cawHandle = skeletonFromDraft(draft);
        return Promise.resolve(ctx.cawHandle);
      },

      insertStateTransition(row): Promise<void> {
        ctx.transition = { ...row };
        return Promise.resolve();
      },

      insertWitness(row: WitnessRowInput): Promise<{ witness_id: string }> {
        ctx.witnessRow = row;
        return Promise.resolve({ witness_id: row.witness_id });
      },

      setCawProducedWitnessId(
        caw_id: string,
        produced_witness_id: string,
      ): Promise<ConceptAssignmentWitness> {
        if (!ctx.cawHandle || !ctx.draft) {
          return Promise.reject(
            new TransactionRollbackError(
              "GatewayMisuse",
              "setCawProducedWitnessId called before insertCaw",
            ),
          );
        }
        if (ctx.cawHandle.caw_id !== caw_id) {
          return Promise.reject(
            new TransactionRollbackError(
              "GatewayMisuse",
              "setCawProducedWitnessId caw_id mismatch",
            ),
          );
        }
        ctx.draft = { ...ctx.draft, produced_witness_id };
        ctx.cawHandle.produced_witness_id = produced_witness_id;
        return Promise.resolve(ctx.cawHandle);
      },
    };

    const result = await body(gw);

    if (!ctx.draft || !ctx.cawHandle) {
      return result;
    }
    if (!ctx.transition) {
      throw new TransactionRollbackError(
        "GatewayMisuse",
        "insertCaw fired without insertStateTransition; RPC not dispatched",
      );
    }

    const payload: RaePersistInitialAdmissionPayload = {
      caw: ctx.draft,
      witness_intent: ctx.witnessRow ? "produce_depth0_witness" : "none",
      reason: ctx.transition.reason,
      policy: ctx.transition.policy,
      from_state: ctx.transition.from_state,
      to_state: ctx.transition.to_state,
      actor_kind: ctx.transition.actor_kind,
      actor_id: ctx.transition.actor_id,
    };
    if (ctx.backAnnotationWitnessId) {
      payload.back_annotation_existing_witness_id =
        ctx.backAnnotationWitnessId;
    }
    if (ctx.witnessRow) {
      payload.witness_payload = witnessPayloadAdapter(ctx.witnessRow);
    }

    const { data, error } = await client.rpc<RaePersistInitialAdmissionResult>(
      "rae_persist_initial_admission",
      { p_payload: payload },
    );

    if (error) {
      throw mapRpcError(error);
    }
    if (!data || !data.caw) {
      throw new TransactionRollbackError(
        "PgEmptyResult",
        "rae_persist_initial_admission returned no caw row",
      );
    }

    rewriteHandle(ctx.cawHandle, data.caw);

    if (
      result &&
      typeof result === "object" &&
      "mode" in (result as Record<string, unknown>) &&
      "caw" in (result as Record<string, unknown>)
    ) {
      (result as unknown as { mode: "created" | "existing" }).mode = data.mode;
    }

    return result;
  };
}
