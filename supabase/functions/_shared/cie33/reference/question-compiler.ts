import type { AcquisitionContract, ObservationNeed, QuestionInstance, QuestionPlan, ResponseDefinition } from "./types.ts";
import { canonicalRegistry, conceptByCode, sentinelById } from "./registry.ts";
import { contentHash, deepFreeze } from "./canonical.ts";
import { ContractError, type ValidationIssue } from "./errors.ts";

export interface PlanComposition {
  prompt?: string;
  response?: ResponseDefinition;
  renderedWindow?: string;
  questionClass?: QuestionPlan["questionClass"];
  deploymentState?: QuestionPlan["deploymentState"];
  templateRef?: string;
  policyRefs?: string[];
  missingnessAllowed?: QuestionPlan["missingness"]["allowed"];
  interactionMode?: QuestionPlan["interactionMode"];
}

function defaultResponse(need: ObservationNeed): ResponseDefinition {
  const operation = need.requestedOperations[0];
  if (operation === "quantify_amount") return { kind: "quantity", unit: "person_specified" };
  if (operation === "quantify_frequency") return { kind: "frequency" };
  if (operation === "quantify_duration") return { kind: "duration", unit: "person_specified" };
  if (operation === "identify") return { kind: "short_text" };
  if (operation === "confirm") return { kind: "boolean" };
  return { kind: "boolean" };
}

function defaultWindow(need: ObservationNeed): string {
  switch (need.temporalNeed.frame) {
    case "now": return "right now";
    case "lifetime": return "at any time in your life through today";
    case "bounded_window": return need.temporalNeed.range?.anchorText ?? "during the stated period";
    case "event_relative": return need.temporalNeed.range?.anchorText ?? "relative to the event";
    case "specimen_relative": return need.temporalNeed.range?.anchorText ?? "around the specimen collection";
    case "since_prior": return need.temporalNeed.range?.anchorText ?? "since the prior observation";
  }
}

function defaultPrompt(need: ObservationNeed, window: string): string {
  const observable = need.observable.kind === "session_local" ? `“${need.observable.sourceLabel}”` : need.humanObservable;
  switch (need.requestedOperations[0]) {
    case "identify": return `In your own words, what did you notice about ${observable} ${window}?`;
    case "characterize_response": return `What did you notice after ${observable}, without assuming it was the cause?`;
    case "locate_context": return `When did you notice ${observable} in relation to the event?`;
    case "quantify_frequency": return `How often did you notice ${observable} ${window}?`;
    case "quantify_duration": return `About how long did ${observable} last ${window}?`;
    case "quantify_amount": return `About how much ${observable} was there ${window}?`;
    default: return `Did you observe ${observable} ${window}?`;
  }
}

export function compileQuestionPlan(
  need: ObservationNeed,
  contract: AcquisitionContract,
  composition: PlanComposition = {},
): QuestionPlan {
  if (need.acquisitionContractId !== contract.id) {
    throw new ContractError("NEED_CONTRACT_MISMATCH", "ObservationNeed is not bound to this AcquisitionContract.");
  }
  const sentinel = need.sentinelId ? sentinelById(need.sentinelId) : undefined;
  if (need.sentinelId && !sentinel) throw new ContractError("UNKNOWN_SENTINEL", `Unknown sentinel ${need.sentinelId}.`);
  const renderedWindow = composition.renderedWindow ?? defaultWindow(need);
  const response = composition.response ?? (sentinel ? { kind: sentinel.responseKind } : defaultResponse(need));
  const questionClass = sentinel ? "protocol_locked" : composition.questionClass ?? "template_locked";
  const origin: QuestionPlan["origin"] = sentinel
    ? { kind: "protocol", definitionRef: sentinel.templateId }
    : questionClass === "novel_candidate"
      ? { kind: "candidate", proposalRef: composition.templateRef ?? "unregistered-proposal", proposer: "model_assisted" }
      : { kind: "template", templateRef: composition.templateRef ?? "TPL-GENERIC-OBSERVATION@1.0.0" };

  const draft: QuestionPlan = {
    id: `qplan-${need.id}`,
    version: "3.3.0",
    observationNeedId: need.id,
    questionClass,
    deploymentState: composition.deploymentState ?? "authorized_production",
    origin,
    observable: need.observable,
    humanObservable: need.humanObservable,
    operations: need.requestedOperations,
    temporal: { frame: need.temporalNeed.frame, range: need.temporalNeed.range, renderedWindow },
    response,
    interactionMode: composition.interactionMode ?? (sentinel?.tier === 0 ? "safety" : response.kind === "quantity" || response.kind === "frequency" || response.kind === "duration" ? "quantify" : response.kind === "short_text" ? "narrative" : "recall"),
    prompt: sentinel?.exactPrompt ?? composition.prompt ?? defaultPrompt(need, renderedWindow),
    oneCognitiveAct: true,
    missingness: {
      allowed: composition.missingnessAllowed ?? ["unknown", "not_recalled", "declined", "not_applicable", "temporarily_unable"],
      neverMapsToNegative: true,
    },
    negative: {
      answerCanExpressNegative: response.kind === "boolean",
      boundedMeaning: response.kind === "boolean"
        ? `No observation of ${need.humanObservable} within ${renderedWindow}.`
        : undefined,
      capabilityRequired: response.kind === "boolean",
    },
    governance: {
      topic: need.topic,
      purposeCode: contract.purpose.code,
      policyRefs: composition.policyRefs ?? contract.consent.policyRefs,
    },
    safety: {
      class: sentinel?.tier === 0 ? "protocol_locked" : "ordinary",
      generationProhibited: sentinel?.tier === 0,
    },
    burden: { cognitiveTasks: need.burdenEstimate },
    registryVersion: canonicalRegistry.version,
    templateOrProtocolRef: sentinel?.templateId ?? composition.templateRef ?? "TPL-GENERIC-OBSERVATION@1.0.0",
    outputContract: {
      witnessKind: "human_observation",
      transformRegistryVersion: "CIE33-TRANSFORM@1.0.0",
      prohibitedInferenceCodes: ["diagnosis_from_testimony", "causation_from_sequence", "unregistered_concept_promotion"],
    },
    canonicalizationProfile: "CIE-CANONICAL-JSON@1.0.0",
  };
  draft.planContentHash = contentHash(draft);
  return draft;
}

function issue(ruleId: string, code: string, message: string): ValidationIssue {
  return { ruleId, code, message };
}

export function validateQuestionPlan(
  plan: QuestionPlan,
  need: ObservationNeed,
  contract: AcquisitionContract,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (plan.observationNeedId !== need.id || need.acquisitionContractId !== contract.id) {
    issues.push(issue("CIE33-QV-001-NEED-BINDING", "NEED_BINDING", "Plan, need, and contract identifiers do not bind."));
  }
  if (need.observableClass !== "human_observable") {
    issues.push(issue("CIE33-QV-002-HUMAN-OBSERVABLE", "NOT_HUMAN_OBSERVABLE", "Ask-human cannot establish an invisible or instrument-only phenomenon."));
  }
  if (!plan.oneCognitiveAct) issues.push(issue("CIE33-QV-003-ONE-COGNITIVE-ACT", "MULTIPLE_ACTS", "A plan must ordinarily be one cognitive act."));
  if (!plan.operations.length || need.requestedOperations[0] !== plan.operations[0]) {
    issues.push(issue("CIE33-QV-004-ONE-PRIMARY-OPERATION", "OPERATION_MISMATCH", "The primary operation must match the need."));
  }
  if (!plan.temporal.frame || !plan.temporal.renderedWindow.trim()) {
    issues.push(issue("CIE33-QV-005-EXPLICIT-TEMPORAL-FRAME", "TIME_UNBOUNDED", "A rendered temporal frame is required."));
  }
  const expectedKinds: Partial<Record<QuestionPlan["operations"][number], ResponseDefinition["kind"][]>> = {
    quantify_amount: ["quantity"],
    quantify_frequency: ["frequency"],
    quantify_duration: ["duration"],
    identify: ["short_text", "single_select"],
    confirm: ["boolean"],
  };
  const primaryOperation = plan.operations[0];
  if (primaryOperation && expectedKinds[primaryOperation] && !expectedKinds[primaryOperation]?.includes(plan.response.kind)) {
    issues.push(issue("CIE33-QV-006-RESPONSE-COMPATIBILITY", "RESPONSE_INCOMPATIBLE", "Response primitive is incompatible with the sensing operation."));
  }
  if (/\b(obviously|surely|don't you agree)\b/i.test(plan.prompt)) {
    issues.push(issue("CIE33-QV-007-NON-COERCIVE-LANGUAGE", "COERCIVE_WORDING", "Prompt contains leading or coercive language."));
  }
  if (!contract.consent.allowedTopics.includes(plan.governance.topic)) {
    issues.push(issue("CIE33-QV-008-CONSENT-COVERAGE", "TOPIC_NOT_AUTHORIZED", "The topic is outside effective consent."));
  }
  if (plan.negative.answerCanExpressNegative && (!plan.negative.capabilityRequired || !plan.negative.boundedMeaning)) {
    issues.push(issue("CIE33-QV-009-NEGATIVE-CAPABILITY-DECLARED", "NEGATIVE_UNBOUNDED", "Negative semantics must be bounded and capability-gated."));
  }
  if (need.sentinelId) {
    const sentinel = sentinelById(need.sentinelId);
    if (!sentinel || plan.observable.kind !== "registered" || plan.observable.conceptCode !== sentinel.conceptCode || plan.prompt !== sentinel.exactPrompt || plan.templateOrProtocolRef !== sentinel.templateId) {
      issues.push(issue("CIE33-QV-010-LOCKED-SENTINEL-EXACT", "SENTINEL_MUTATED", "Locked sentinel wording or reference was changed."));
    }
  }
  if (/\byou (have|suffer from|are diagnosed with)\b/i.test(plan.prompt)) {
    issues.push(issue("CIE33-QV-011-NO-DIAGNOSTIC-ASSERTION", "DIAGNOSTIC_ASSERTION", "A question cannot diagnose the respondent."));
  }
  if (/\bwas caused by\b|\bproves? that\b/i.test(plan.prompt)) {
    issues.push(issue("CIE33-QV-012-NO-CAUSAL-CONVERSION", "CAUSAL_CONVERSION", "Temporal association cannot be written as causation."));
  }
  if (plan.questionClass === "novel_candidate" && plan.deploymentState === "authorized_production") {
    issues.push(issue("CIE33-QV-013-SESSION-LOCAL-RESTRICTIONS", "CANDIDATE_PRODUCTION_FORBIDDEN", "Novel candidates cannot issue in production."));
  }
  if (contract.burdenBudget.usedCognitiveTasks + plan.burden.cognitiveTasks > contract.burdenBudget.hardMaximumCognitiveTasks && need.safetyPriority !== "immediate") {
    issues.push(issue("CIE33-QV-014-BURDEN-BUDGET", "BURDEN_EXCEEDED", "Plan exceeds the active burden contract."));
  }
  if (!contract.allowedActions.includes("ask_human") && need.safetyPriority !== "immediate") {
    issues.push(issue("CIE33-QV-015-SOURCE-AVAILABLE", "ASK_HUMAN_NOT_ALLOWED", "Ask-human is not an allowed acquisition action."));
  }
  if (plan.governance.purposeCode !== contract.purpose.code || !plan.governance.policyRefs.length) {
    issues.push(issue("CIE33-QV-016-GOVERNANCE-PURPOSE", "PURPOSE_UNBOUND", "Plan is not bound to purpose and policy."));
  }
  if (!plan.missingness.allowed.length || plan.missingness.neverMapsToNegative !== true) {
    issues.push(issue("CIE33-QV-017-NO-HIDDEN-DEFAULT", "MISSINGNESS_DEFAULT", "Missingness must remain explicit and must never map to negative."));
  }
  if ((plan.response.kind === "quantity" || plan.response.kind === "duration") && !plan.response.unit) {
    issues.push(issue("CIE33-QV-018-QUANTITY-UNIT", "UNIT_REQUIRED", "Quantities and durations require a unit contract."));
  }
  if (!plan.id || !need.id || !contract.id) {
    issues.push(issue("CIE33-QV-019-STABLE-IDENTIFIERS", "IDENTIFIER_REQUIRED", "Stable identifiers are required."));
  }
  if (plan.registryVersion !== canonicalRegistry.version || contract.registryVersion !== canonicalRegistry.version || plan.version !== "3.3.0") {
    issues.push(issue("CIE33-QV-020-VERSION-PINS", "VERSION_MISMATCH", "Registry and specification versions must be pinned."));
  }
  if (plan.observable.kind === "registered" && !conceptByCode(plan.observable.conceptCode)) {
    issues.push(issue("CIE33-QV-021-VALIDATION-COMPLETE", "REGISTERED_CONCEPT_UNKNOWN", "Registered observable is absent from the pinned registry."));
  }
  return issues;
}

export interface IssueQuestionInput {
  instanceId: string;
  issuedAt: string;
  expiresAt?: string;
  nonce: string;
  expectedSessionStateVersion: number;
  expectedSessionStateHash: `sha256:${string}`;
}

export function issueQuestionInstance(
  plan: QuestionPlan,
  need: ObservationNeed,
  contract: AcquisitionContract,
  input: IssueQuestionInput,
): Readonly<QuestionInstance> {
  const expectedPlanHash = contentHash(Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "planContentHash")));
  if (plan.planContentHash !== expectedPlanHash) throw new ContractError("PLAN_HASH_MISMATCH", "QuestionPlan content hash is invalid.");
  const issues = validateQuestionPlan(plan, need, contract);
  if (issues.length) throw new ContractError("QUESTION_PLAN_REJECTED", "QuestionPlan failed deterministic validation.", issues.map((entry) => `${entry.ruleId}:${entry.code}`));
  const draft: Omit<QuestionInstance, "instanceContentHash"> = {
    id: input.instanceId,
    subjectId: contract.subjectId,
    sessionId: contract.sessionId,
    observationNeedId: need.id,
    questionPlanId: plan.id,
    questionPlanHash: plan.planContentHash,
    contractId: contract.id,
    contractVersion: contract.version,
    registryVersion: plan.registryVersion,
    expectedSessionStateVersion: input.expectedSessionStateVersion,
    expectedSessionStateHash: input.expectedSessionStateHash,
    promptRendered: plan.prompt,
    referenceWindowRendered: plan.temporal.renderedWindow,
    response: plan.response,
    interactionMode: plan.interactionMode,
    temporal: plan.temporal,
    missingnessOptions: [...plan.missingness.allowed],
    observableSnapshot: plan.observable,
    operations: plan.operations,
    negativeCapabilityRequired: plan.negative.capabilityRequired,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    nonce: input.nonce,
  };
  return deepFreeze({ ...draft, instanceContentHash: contentHash(draft) });
}
