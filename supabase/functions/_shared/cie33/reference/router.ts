import type { AcquisitionContract, EvidenceActionKind, ObservationDebt, ObservationNeed, RouteDecision } from "./types.ts";
import { contentHash, deepFreeze } from "./canonical.ts";
import { ContractError } from "./errors.ts";

export interface RouteInputCandidate {
  need: ObservationNeed;
  debt?: ObservationDebt;
  satisfiedByWitnessId?: string;
}

function tierFor(candidate: RouteInputCandidate): { tier: 0 | 1 | 2 | 3 | 4 | 5; name: NonNullable<RouteDecision["selectedTierName"]> } {
  const { need } = candidate;
  if (need.safetyPriority === "immediate" || need.kind === "safety_obligation") return { tier: 0, name: "safety" };
  if (need.sentinelId || need.kind === "minimum_biography") return { tier: 1, name: "minimum_safe_biography" };
  if (need.kind === "material_contradiction") return { tier: 2, name: "contradiction" };
  if (need.origin.kind === "observation_debt" || need.kind === "decision_linked_uncertainty") return { tier: 3, name: "observation_debt" };
  if (need.kind === "longitudinal_change") return { tier: 4, name: "longitudinal_value" };
  return { tier: 5, name: "enrichment" };
}

function actionFor(need: ObservationNeed): EvidenceActionKind {
  if (need.observableClass === "human_observable" && need.requestedEvidenceClass === "testimony") return "ask_human";
  if (need.observableClass === "device_observable" || need.requestedEvidenceClass === "device") return "query_wearable";
  if (need.observableClass === "record_observable" || need.requestedEvidenceClass === "record") return "query_ehr";
  switch (need.requestedEvidenceClass) {
    case "laboratory": return "request_lab";
    case "omics": return "inspect_existing_omic";
    case "imaging": return "retrieve_imaging";
    case "examination": return "clinician_exam";
    default: return "wait_observe";
  }
}

const impactOrder = { high: 0, moderate: 1, low: 2, none: 3 } as const;

export function routeNext(
  candidates: RouteInputCandidate[],
  contract: AcquisitionContract,
  input: {
    decisionId: string;
    decidedAt: string;
    pinnedStateHash?: `sha256:${string}`;
    activeSafetyProtocolState?: "no_active_protocol" | "active" | "handoff_required" | "handoff_offered" | "handoff_initiated" | "handoff_acknowledged" | "person_exited_before_resolution" | "completed_by_approved_transition";
  },
): Readonly<RouteDecision> {
  let active = candidates.filter((candidate) => (!candidate.debt || candidate.debt.disposition === "owed") && !candidate.satisfiedByWitnessId);
  const reasonCodes: string[] = [];
  const safetyBlocksOrdinary = input.activeSafetyProtocolState !== undefined
    && !["no_active_protocol", "completed_by_approved_transition"].includes(input.activeSafetyProtocolState);
  if (safetyBlocksOrdinary) {
    active = active.filter((candidate) => tierFor(candidate).tier === 0);
    reasonCodes.push("ACTIVE_SAFETY_PROTOCOL_BLOCKS_ORDINARY_ROUTING");
  }
  const base = {
    id: input.decisionId,
    schemaVersion: "cie.route-decision@1" as const,
    acquisitionContractId: contract.id,
    pinnedStateHash: input.pinnedStateHash ?? contentHash({ contractId: contract.id, candidates: candidates.map((entry) => entry.need.id) }),
    evaluatedObservationNeedIds: candidates.map((entry) => entry.need.id),
    routerVersion: "CIE33-ROUTER@1.0.0",
    registryVersion: contract.registryVersion,
    decidedAt: input.decidedAt,
  };
  if (!active.length) {
    const draft: Omit<RouteDecision, "contentHash"> = {
      ...base,
      outcome: "no_eligible_action",
      reasonCodes: [...reasonCodes, candidates.some((entry) => entry.satisfiedByWitnessId) ? "ADEQUATE_AUTHORIZED_EVIDENCE_EXISTS" : "NO_ACTIVE_OBSERVATION_NEED"],
    };
    return deepFreeze({ ...draft, contentHash: contentHash(draft) });
  }
  const sorted = [...active].sort((left, right) => {
    const tierDelta = tierFor(left).tier - tierFor(right).tier;
    if (tierDelta) return tierDelta;
    const leftImpact = left.debt ? impactOrder[left.debt.decisionImpact] : 1;
    const rightImpact = right.debt ? impactOrder[right.debt.decisionImpact] : 1;
    if (leftImpact !== rightImpact) return leftImpact - rightImpact;
    return left.need.createdAt < right.need.createdAt ? -1 : left.need.createdAt > right.need.createdAt ? 1 : left.need.id < right.need.id ? -1 : 1;
  });
  const selected = sorted[0];
  if (!selected) throw new ContractError("ROUTER_EMPTY", "Router selection failed.");
  const tier = tierFor(selected);
  let action: EvidenceActionKind | undefined = actionFor(selected.need);
  reasonCodes.push(`TIER_${tier.tier}_${tier.name.toUpperCase()}`);
  if (selected.need.observable.kind === "session_local" && !["ask_human", "wait_observe"].includes(action)) {
    action = undefined;
    reasonCodes.push("SESSION_LOCAL_EXTERNAL_ACTION_FORBIDDEN");
  }
  if (selected.need.observableClass === "instrument_only" && action === "ask_human") {
    throw new ContractError("INVISIBLE_BIOLOGY_ASK_FORBIDDEN", "Invisible biology cannot be established by asking a person.");
  }
  if (action && !contract.allowedActions.includes(action)) {
    if (tier.tier === 0 && action === "ask_human") reasonCodes.push("LOCKED_SAFETY_PATH_NOT_SUPPRESSED_BY_BURDEN");
    else {
      action = undefined;
      reasonCodes.push("ACTION_NOT_AUTHORIZED_REQUIRES_NEW_CONTRACT");
    }
  }
  if (tier.tier === 0) reasonCodes.push("SAFETY_LEXICOGRAPHIC_PRIORITY");
  if (selected.need.sentinelId) reasonCodes.push("LOCKED_SENTINEL");
  const draft: Omit<RouteDecision, "contentHash"> = {
    ...base,
    selectedObservationNeedId: selected.need.id,
    selectedAction: action,
    selectedTier: tier.tier,
    selectedTierName: tier.name,
    outcome: action ? "selected" : "no_eligible_action",
    reasonCodes,
  };
  return deepFreeze({ ...draft, contentHash: contentHash(draft) });
}

export function createObservationDebt(input: Omit<ObservationDebt, "reactivationPolicy">): Readonly<ObservationDebt> {
  return deepFreeze({ ...input, reactivationPolicy: "context_change_required" });
}

export function waiveObservationDebt(debt: ObservationDebt): Readonly<ObservationDebt> {
  return deepFreeze({ ...debt, disposition: "waived", reactivationPolicy: "context_change_required" });
}
