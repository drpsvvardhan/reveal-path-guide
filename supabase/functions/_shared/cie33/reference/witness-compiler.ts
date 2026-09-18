import type {
  AcceptedAnswer,
  AcquisitionContract,
  ConceptMappingEvent,
  EvidenceQualityVector,
  ObservationCapability,
  ObservationNeed,
  QuestionInstance,
  QuestionPlan,
  TimeRange,
  WitnessEnvelope,
  WitnessPayload,
} from "./types.ts";
import { contentHash, deepFreeze } from "./canonical.ts";
import { assertRegisteredConcept, canonicalRegistry, conceptByCode } from "./registry.ts";
import { ContractError } from "./errors.ts";

export const ordinalUncalibratedQuality: EvidenceQualityVector = {
  reportFidelity: { level: "high", reasons: ["response_specificity"], limitations: [] },
  recall: { level: "unknown", reasons: [], limitations: ["Not independently calibrated."] },
  temporal: { level: "moderate", reasons: ["approximate_time"], limitations: [] },
  calibration: {
    mode: "ordinal_uncalibrated",
    policyVersion: "CIE33-EVIDENCE-QUALITY@1.0.0",
    probabilityOutputAuthorized: false,
  },
};

function validateQuality(quality: EvidenceQualityVector): void {
  const values: unknown[] = [
    quality.reportFidelity.level,
    quality.recall?.level,
    quality.temporal?.level,
    quality.causalSupport?.level,
  ];
  if (values.some((value) => typeof value === "number")) {
    throw new ContractError("NUMERIC_EPISTEMOLOGY_FORBIDDEN", "Evidence quality is categorical unless a calibrated model is authorized.");
  }
  if (quality.calibration.mode !== "ordinal_uncalibrated" || quality.calibration.probabilityOutputAuthorized !== false) {
    throw new ContractError("CALIBRATION_GATE_CLOSED", "The reference kernel does not authorize probability output.");
  }
}

function negative(answer: AcceptedAnswer): boolean {
  if (!answer.semanticResponse) return false;
  if (answer.semanticResponse.kind === "boolean") return answer.semanticResponse.value === false;
  return false;
}

function effectiveTime(answer: AcceptedAnswer, capability?: ObservationCapability): TimeRange {
  if (capability) return capability.observationWindow;
  return answer.temporal.range ?? {
    precision: answer.temporal.frame === "now" ? "instant" : "unknown",
    anchorText: answer.temporal.renderedWindow,
  };
}

function assertAdequateNegativeCapability(answer: AcceptedAnswer, capability?: ObservationCapability): asserts capability is ObservationCapability {
  if (!capability) throw new ContractError("NEGATIVE_CAPABILITY_REQUIRED", "An explicit negative requires an ObservationCapability statement.");
  if (capability.opportunity !== "adequate" || !capability.method.trim() || !capability.scope.trim()) {
    throw new ContractError("NEGATIVE_CAPABILITY_INADEQUATE", "Negative observation capability must declare adequate method and scope.");
  }
  if (contentHash(capability.observable) !== contentHash(answer.observableSnapshot)) {
    throw new ContractError("NEGATIVE_CAPABILITY_OBSERVABLE_MISMATCH", "ObservationCapability must refer to the same ObservableRef as the answer.");
  }
  if (capability.sourceKind !== answer.sourceKind) {
    throw new ContractError("NEGATIVE_CAPABILITY_SOURCE_MISMATCH", "ObservationCapability source must match the witnessing source.");
  }
  if (answer.temporal.range && contentHash(capability.observationWindow) !== contentHash(answer.temporal.range)) {
    throw new ContractError("NEGATIVE_CAPABILITY_WINDOW_MISMATCH", "ObservationCapability window must match the issued question window.");
  }
  const bounded = Boolean(capability.observationWindow.start || capability.observationWindow.end || capability.observationWindow.ongoing || capability.observationWindow.anchorText);
  if (!bounded) throw new ContractError("NEGATIVE_WINDOW_UNBOUNDED", "A negative requires a bounded observation window.");
}

function semanticValue(answer: AcceptedAnswer): unknown {
  const response = answer.semanticResponse;
  if (!response) return undefined;
  switch (response.kind) {
    case "boolean": return response.value;
    case "single_select": return response.optionId;
    case "multi_select": return response.optionIds;
    case "quantity": return { value: response.value, unit: response.unit };
    case "frequency": return { count: response.count, per: response.per };
    case "duration": return { value: response.value, unit: response.unit };
    case "date_or_approximate": return { value: response.value, precision: response.precision };
    case "integer": return response.value;
    case "decimal": return response.value;
    case "short_text": return response.text;
    case "structured": return response.value;
  }
}

export interface WitnessCompilationInput {
  witnessId: string;
  witnessKind: string;
  answer: AcceptedAnswer;
  instance: QuestionInstance;
  plan: QuestionPlan;
  need: ObservationNeed;
  contract: AcquisitionContract;
  compiledAt: string;
  compilerVersion?: string;
  observationCapability?: ObservationCapability;
  evidenceQuality?: EvidenceQualityVector;
  relationshipSemantics?: WitnessPayload["relationshipSemantics"];
}

export function compileWitness(input: WitnessCompilationInput): Readonly<WitnessEnvelope> {
  const { answer, instance, plan, need, contract } = input;
  if (
    answer.questionInstanceId !== instance.id
    || instance.questionPlanId !== plan.id
    || plan.observationNeedId !== need.id
    || need.acquisitionContractId !== contract.id
  ) {
    throw new ContractError("COMPILER_LINEAGE_BROKEN", "Need, plan, instance, answer, and contract lineage must be exact.");
  }
  if (contentHash(answer.observableSnapshot) !== contentHash(plan.observable) || contentHash(plan.observable) !== contentHash(need.observable)) {
    throw new ContractError("OBSERVABLE_BINDING_BROKEN", "ObservableRef changed between acquisition stages.");
  }
  const quality = input.evidenceQuality ?? ordinalUncalibratedQuality;
  validateQuality(quality);
  const isNegative = negative(answer);
  if (isNegative) assertAdequateNegativeCapability(answer, input.observationCapability);
  const sessionLocal = answer.observableSnapshot.kind === "session_local";
  const restrictions = sessionLocal
    ? [
        "cannot_satisfy_sentinel",
        "cannot_trigger_external_action",
        "cannot_assert_diagnosis",
        "cannot_cross_person_aggregate",
        "cannot_become_registered_by_model_alone",
      ]
    : [];
  const payload: WitnessPayload | undefined = answer.missingness ? undefined : {
    kind: input.witnessKind,
    value: semanticValue(answer),
    exactSourceText: answer.exactSourceText,
    relationshipSemantics: input.relationshipSemantics,
  };
  const draft: Omit<WitnessEnvelope, "witnessContentHash"> = {
    id: input.witnessId,
    subjectId: answer.subjectId,
    substrate: "questionnaire_cie",
    witnessType: input.witnessKind,
    observable: answer.observableSnapshot,
    assertionPolarity: answer.missingness ? "not_asserted" : isNegative ? "negative" : "positive",
    payload,
    missingness: answer.missingness ?? { kind: "present" },
    effectiveTime: effectiveTime(answer, input.observationCapability),
    observationCapability: input.observationCapability,
    provenance: {
      origin: { sourceKind: answer.sourceKind, sourceRole: answer.sourceRole },
      producer: { kind: "deterministic_compiler", artifactId: "cie-v3.3-reference-kernel", version: input.compilerVersion ?? "3.3.0-reference" },
      acquisitionContractId: contract.id,
      observationNeedId: need.id,
      questionPlanId: plan.id,
      questionInstanceId: instance.id,
      answerId: answer.id,
      capturedAt: input.compiledAt,
    },
    evidenceQuality: quality,
    status: "asserted",
    restrictions,
    createdAt: input.compiledAt,
  };
  // Preserve the upstream wire form while making its discriminated union
  // explicit to TypeScript (the reference build only strips types).
  const { payload: _payload, ...withoutPayload } = draft;
  const result: WitnessEnvelope = answer.missingness
    ? { ...withoutPayload, assertionPolarity: "not_asserted", missingness: answer.missingness, witnessContentHash: contentHash(draft) }
    : { ...draft, assertionPolarity: isNegative ? "negative" : "positive", missingness: { kind: "present" }, payload: payload!, witnessContentHash: contentHash(draft) };
  return deepFreeze(result);
}

export function commitWitness(
  witness: WitnessEnvelope,
  input: { committedAt: string; registryVersion: string; policyDecisionId: string },
): Readonly<WitnessEnvelope> {
  const { witnessContentHash: _hash, commit: _commit, ...body } = witness;
  if (contentHash(body) !== witness.witnessContentHash) throw new ContractError("WITNESS_HASH_INVALID", "Witness changed after compilation.");
  if (witness.observable.kind === "registered") {
    assertRegisteredConcept(witness.observable.conceptCode, witness.observable.registryVersion);
    if (witness.observable.registryVersion !== input.registryVersion) throw new ContractError("COMMIT_REGISTRY_MISMATCH", "Commit registry does not match the observable pin.");
  }
  const commitBase = {
    witnessContentHash: witness.witnessContentHash,
    committedAt: input.committedAt,
    registryVersion: input.registryVersion,
    policyDecisionId: input.policyDecisionId,
  };
  return deepFreeze({
    ...witness,
    commit: { ...input, commitHash: contentHash(commitBase) },
  });
}

export function appendConceptMapping(
  witness: WitnessEnvelope,
  input: {
    id: string;
    candidateConceptCode: string;
    status: ConceptMappingEvent["status"];
    actor: ConceptMappingEvent["actor"];
    createdAt: string;
  },
): Readonly<ConceptMappingEvent> {
  if (witness.observable.kind !== "session_local") throw new ContractError("MAPPING_NOT_SESSION_LOCAL", "Only a session-local observable needs a mapping event.");
  if (input.status === "registry_promoted" && input.actor !== "governed_registry_process") {
    throw new ContractError("MODEL_PROMOTION_FORBIDDEN", "Registry promotion requires the governed registry process.");
  }
  if ((input.status === "human_confirmed" || input.status === "registry_promoted") && !conceptByCode(input.candidateConceptCode)) {
    throw new ContractError("MAPPING_CONCEPT_UNREGISTERED", `Confirmed mapping target must exist in ${canonicalRegistry.version}.`);
  }
  const draft: Omit<ConceptMappingEvent, "eventContentHash"> = {
    id: input.id,
    witnessId: witness.id,
    witnessContentHash: witness.witnessContentHash,
    sourceLabel: witness.observable.sourceLabel,
    candidateConceptCode: input.candidateConceptCode,
    status: input.status,
    actor: input.actor,
    createdAt: input.createdAt,
  };
  return deepFreeze({ ...draft, eventContentHash: contentHash(draft) });
}
