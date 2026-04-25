// ============================================================================
// supabase/functions/rae-admit-observation/witness_adapters.ts
// ----------------------------------------------------------------------------
// Two pure adapters that bridge the orchestrator's AdmissionDecisionV1 and
// the storage / gateway layers (design §8).
//
//   (a) makeRaeDepth0WitnessifyAdapter — WitnessifyAdapter (decision -> row)
//       Consumed by persistInitialAdmission's `witnessify_adapter` input.
//       The orchestrator owns the skip decision via witness_intent;
//       persistInitialAdmission only invokes this adapter when
//       witness_intent === "produce_depth0_witness".
//
//   (b) makeRaeDepth0WitnessPayloadAdapter — WitnessPayloadAdapter
//       (row -> WitnessPayloadShape). Consumed by makeRpcAdmitGateway's
//       options.witnessPayloadAdapter. Lifts the slim row into the full
//       payload required by public.rae_persist_initial_admission.
//
// Discipline:
//   - Pure. No I/O. No DB access. No raw SQL.
//   - Does NOT import witnessify_impl (design §8.3, §12).
//   - Does NOT import storage internals beyond the typed contracts it
//     fulfils (WitnessifyAdapter / WitnessPayloadAdapter / WitnessRowInput
//     / WitnessPayloadShape).
//   - Deterministic witness_id via uuidv5(RAE_CAW_NAMESPACE, caw_id+":depth0").
// ============================================================================

import {
  RAE_CAW_NAMESPACE,
  uuidv5,
  type AdmissionDecisionV1,
} from "../_shared/rae/orchestrator.ts";
import type {
  WitnessifyAdapter,
  WitnessRowInput,
} from "../_shared/rae/storage/admit.ts";
import type {
  WitnessPayloadAdapter,
  WitnessPayloadShape,
} from "../_shared/rae/storage/gateway_rpc.ts";

// ---------------------------------------------------------------------------
// Coupling contract between (a) and (b): the typed key-set that the
// witnessify adapter writes into WitnessRowInput.passthrough and the
// payload adapter reads back out. Storage layer never inspects passthrough.
// ---------------------------------------------------------------------------

export interface RaeDepth0Passthrough {
  /** Engine version this admission was adjudicated under. */
  engine_version_id: string;
  /** Verbatim from CAW draft. Already validated by orchestrator. */
  confidence_value: number;
  /** Verbatim from CAW draft. ≥ 20 chars (P1a-style invariant). */
  confidence_basis: string;
  /** Verbatim from CAW draft. ≥ 1 non-blank entry. */
  limitations: string[];
  /** Provenance marker for the depth-0 RAE admission witness. */
  rae_witness_kind: "rae_depth0";
  /** Stamped from EngineVersionConfig at adjudication time. */
  registry_seed_version: string;
  /** Stamped from EngineVersionConfig at adjudication time. */
  ontology_version: string;
  /** Numeric value normalized to canonical unit, if available. */
  observed_value: number | null;
  /** Canonical unit string, if known. */
  observed_unit: string | null;
  /** ISO timestamp of biological observation, if available. */
  biological_timestamp: string | null;
}

function isRaeDepth0Passthrough(
  v: Record<string, unknown>,
): boolean {
  return (
    typeof v.engine_version_id === "string" &&
    typeof v.confidence_basis === "string" &&
    Array.isArray((v as { limitations?: unknown }).limitations) &&
    v.rae_witness_kind === "rae_depth0" &&
    typeof v.registry_seed_version === "string"
  );
}

// ---------------------------------------------------------------------------
// Deterministic witness_id derivation. Same caw_id => same witness_id.
// ---------------------------------------------------------------------------

export function computeDepth0WitnessId(caw_id: string): string {
  return uuidv5(RAE_CAW_NAMESPACE, `${caw_id}:depth0`);
}

// ---------------------------------------------------------------------------
// (a) WitnessifyAdapter — decision -> WitnessRowInput.
// ---------------------------------------------------------------------------

export function makeRaeDepth0WitnessifyAdapter(
  engineVersionId: string,
): WitnessifyAdapter {
  if (typeof engineVersionId !== "string" || engineVersionId.trim() === "") {
    throw new Error(
      "makeRaeDepth0WitnessifyAdapter: engineVersionId must be a non-empty string",
    );
  }

  return function witnessifyAdapter(
    decision: AdmissionDecisionV1,
  ): WitnessRowInput {
    const draft = decision.caw;

    // Internal sanity: orchestrator guarantees these, but a stale wiring
    // could drift. Adapter throws => storage wraps as WitnessifyFailureError.
    if (
      typeof draft.confidence_basis !== "string" ||
      draft.confidence_basis.trim().length < 20
    ) {
      throw new Error(
        "depth-0 witnessify: draft.confidence_basis must be >= 20 chars",
      );
    }
    if (!Array.isArray(draft.limitations) || draft.limitations.length < 1) {
      throw new Error(
        "depth-0 witnessify: draft.limitations must contain >= 1 entry",
      );
    }

    // Pull observed_value (unit-normalized) and observed_unit if the value
    // signal recorded them; otherwise leave null. The signal_results array
    // is ordered per SIGNAL_IDS so signal_results[2] is "value".
    const valueSig = draft.signal_results.find((s) => s.signal_id === "value");
    const unitSig = draft.signal_results.find((s) => s.signal_id === "unit");
    const observed_value =
      valueSig && valueSig.evidence.signal_id === "value"
        ? valueSig.evidence.unit_normalized_value
        : null;
    const observed_unit =
      unitSig && unitSig.evidence.signal_id === "unit"
        ? unitSig.evidence.canonical_unit
        : null;

    const passthrough: RaeDepth0Passthrough = {
      engine_version_id: engineVersionId,
      confidence_value: draft.confidence_value,
      confidence_basis: draft.confidence_basis,
      limitations: [...draft.limitations],
      rae_witness_kind: "rae_depth0",
      registry_seed_version: draft.registry_seed_version,
      ontology_version: draft.ontology_version,
      observed_value,
      observed_unit,
      biological_timestamp: null,
    };

    const row: WitnessRowInput = {
      witness_id: computeDepth0WitnessId(draft.caw_id),
      user_id: draft.user_id,
      source_table: draft.source_table,
      source_row_id: draft.source_row_id,
      ontology_concept_id: draft.candidate_concept_id,
      passthrough: passthrough as unknown as Record<string, unknown>,
    };
    return row;
  };
}

// ---------------------------------------------------------------------------
// (b) WitnessPayloadAdapter — WitnessRowInput -> WitnessPayloadShape.
// ---------------------------------------------------------------------------

export function makeRaeDepth0WitnessPayloadAdapter(): WitnessPayloadAdapter {
  return function payloadAdapter(row: WitnessRowInput): WitnessPayloadShape {
    const pt = row.passthrough ?? {};
    if (!isRaeDepth0Passthrough(pt)) {
      throw new Error(
        "rae-admit-observation payload adapter: row.passthrough is not a RaeDepth0Passthrough; " +
          "wire makeRaeDepth0WitnessifyAdapter as the witnessify_adapter",
      );
    }
    const p = pt as unknown as RaeDepth0Passthrough;

    const payload: WitnessPayloadShape = {
      witness_id: row.witness_id,
      user_id: row.user_id,
      source_table: row.source_table,
      source_row_id: row.source_row_id,
      // No ancestry for a depth-0 admission witness.
      ancestry_witness_ids: [],
      // Stable, machine-parseable depth-0 RAE markers.
      source_window: "rae:initial_admission",
      signal: "rae:depth0",
      domain_of_access: "rae",
      epistemic_role: "admission",
      reliability_class: "engine_admitted",
      compression_depth: 0,
      observed_value: p.observed_value,
      observed_unit: p.observed_unit,
      testimony: "Depth-0 RAE admission witness produced by the engine.",
      limitations: [...p.limitations],
      confidence_value: p.confidence_value,
      confidence_basis: p.confidence_basis,
      biological_timestamp: p.biological_timestamp,
      validity_window_seconds: null,
      conflict_candidates: null,
      transformation_version: `rae_depth0:${p.engine_version_id}`,
      registry_seed_version: p.registry_seed_version,
      derived_from_packet_id: null,
    };
    return payload;
  };
}