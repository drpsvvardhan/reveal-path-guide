import type { AcquisitionContract, ObservationNeed } from "./types.ts";
import { canonicalRegistry, sentinelById } from "./registry.ts";
import { ContractError } from "./errors.ts";

export type SafetyRiskDisposition = "no_active_cie_safety_signal_detected" | "routine_review" | "prompt_review" | "urgent";
export type SafetyProtocolActionState = "no_active_protocol" | "active" | "handoff_required" | "handoff_offered" | "handoff_initiated" | "handoff_acknowledged" | "person_exited_before_resolution" | "completed_by_approved_transition";
export interface SafetySummary {
  evaluationState: "not_evaluated" | "insufficient_coverage" | "evaluated";
  riskDisposition?: SafetyRiskDisposition;
  protocolActionState?: SafetyProtocolActionState;
}

export function assertSafetyDisposition(value: string): asserts value is SafetyRiskDisposition {
  if (!canonicalRegistry.safetyRiskDispositions.includes(value as never)) {
    throw new ContractError("SAFETY_DISPOSITION_INVALID", `Safety disposition ${value} is not registered; generic clearance is forbidden.`);
  }
}

export function evaluateImmediateSafetyAnswer(signalPresent: boolean): Readonly<SafetySummary> {
  return Object.freeze(signalPresent
    ? { evaluationState: "evaluated", riskDisposition: "urgent", protocolActionState: "active" }
    : { evaluationState: "evaluated", riskDisposition: "no_active_cie_safety_signal_detected", protocolActionState: "no_active_protocol" });
}

export function transitionSafetyProtocol(
  current: SafetySummary,
  target: SafetyProtocolActionState,
  actor: "approved_human" | "registered_protocol" | "person",
): Readonly<SafetySummary> {
  if (target === "completed_by_approved_transition" && actor === "person") {
    throw new ContractError("SAFETY_SELF_CLEAR_FORBIDDEN", "A person response cannot self-clear an active safety protocol.");
  }
  if (current.protocolActionState === "active" && target === "no_active_protocol") {
    throw new ContractError("SAFETY_GENERIC_CLEAR_FORBIDDEN", "Active protocol has no generic clear transition.");
  }
  if (!canonicalRegistry.safetyProtocolActionStates.includes(target)) throw new ContractError("SAFETY_TRANSITION_INVALID", "Target safety state is not registered.");
  return Object.freeze({ ...current, protocolActionState: target });
}

export function assertRequiredSentinels(contract: AcquisitionContract): void {
  for (const sentinelId of contract.requiredSentinelIds) {
    const sentinel = sentinelById(sentinelId);
    if (!sentinel) throw new ContractError("UNKNOWN_REQUIRED_SENTINEL", `Contract requires unknown sentinel ${sentinelId}.`);
    if (!sentinel.mandatory) throw new ContractError("SENTINEL_NOT_MANDATORY", `${sentinelId} is not registered as mandatory.`);
  }
  const immediate = canonicalRegistry.sentinels.find((entry) => entry.tier === 0);
  if (immediate && !contract.requiredSentinelIds.includes(immediate.id)) {
    throw new ContractError("SAFETY_SENTINEL_MISSING", "Immediate safety sentinel cannot be suppressed from the AcquisitionContract.");
  }
}

export function assertSentinelNeed(need: ObservationNeed): void {
  if (!need.sentinelId) return;
  const sentinel = sentinelById(need.sentinelId);
  if (!sentinel) throw new ContractError("UNKNOWN_SENTINEL", `Unknown sentinel ${need.sentinelId}.`);
  if (need.observable.kind !== "registered") throw new ContractError("SESSION_LOCAL_SENTINEL_FORBIDDEN", "A session-local observable cannot satisfy a locked sentinel.");
  if (need.observable.conceptCode !== sentinel.conceptCode) throw new ContractError("SENTINEL_CONCEPT_MISMATCH", "Sentinel need must target its registered concept.");
  if (need.temporalNeed.frame !== sentinel.window) throw new ContractError("SENTINEL_WINDOW_MISMATCH", "Sentinel observation window cannot be weakened.");
}
