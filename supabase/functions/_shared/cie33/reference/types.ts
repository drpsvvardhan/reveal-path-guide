import type { canonicalRegistry } from "./generated/registry.ts";

export type ISODateTime = string;
export type Hash = `sha256:${string}`;

export type ObservableRef =
  | {
      kind: "registered";
      conceptCode: string;
      registryVersion: string;
    }
  | {
      kind: "session_local";
      sourceLabel: string;
      introducedByWitnessId: string;
      scope: "session" | "person";
      mappingStatus:
        | "unmapped"
        | "candidate_mapping"
        | "human_confirmed"
        | "registry_promoted";
      candidateConceptCodes?: string[];
    };

export type SourceRole = "self" | "assisted_self" | "caregiver_proxy" | "other_proxy";
export type EvidenceSourceKind = (typeof canonicalRegistry.sourceKinds)[number];
export type EvidenceActionKind = (typeof canonicalRegistry.evidenceActionKinds)[number];
export type ObservationNeedKind = (typeof canonicalRegistry.observationNeedKinds)[number];
export type HumanEvidenceClass = (typeof canonicalRegistry.humanEvidenceClasses)[number];
export type TemporalFrameKind = (typeof canonicalRegistry.temporalFrames)[number];

export interface TimeRange {
  start?: ISODateTime;
  end?: ISODateTime;
  ongoing?: boolean;
  precision: "instant" | "day" | "week" | "month" | "season" | "year" | "life_stage" | "unknown";
  anchorText?: string;
  timezone?: string;
}

export type SensingOperation = (typeof canonicalRegistry.operations)[number];
export type ResponseKind = (typeof canonicalRegistry.responseKinds)[number];
export type InteractionMode = (typeof canonicalRegistry.interactionModes)[number];
export type SemanticAction = (typeof canonicalRegistry.semanticActions)[number];

export interface InteractionBinding {
  id: string;
  version: string;
  responseSchemaHash: Hash;
  actions: Array<{
    actionId: string;
    semanticAction: SemanticAction;
    semanticValue?: unknown;
    controls: Array<{
      type: "button" | "gesture" | "keyboard" | "voice";
      controlId: string;
    }>;
  }>;
  contentHash: Hash;
}

export type PersonFacingMissingnessKind = (typeof canonicalRegistry.missingness.personFacing)[number];
export type AcquisitionOnlyMissingnessKind = (typeof canonicalRegistry.missingness.acquisitionOnly)[number];
export type MissingnessKind = PersonFacingMissingnessKind | AcquisitionOnlyMissingnessKind;

export type MissingEvidence =
  | { kind: "not_asked"; reason?: string }
  | { kind: "unknown"; reason?: string }
  | { kind: "not_recalled"; approximateMemory?: string }
  | { kind: "declined"; privacyScope?: "question" | "topic" | "session" }
  | { kind: "not_applicable"; reason: string }
  | {
      kind: "temporarily_unable";
      reason: "acute_state" | "accessibility" | "privacy" | "interruption" | "other";
      retryAfter?: ISODateTime;
    }
  | {
      kind: "source_unavailable";
      expectedSource: string;
      searchOrAccessAttemptId: string;
      reason?: string;
    };

export type EvidenceQualityLevel = (typeof canonicalRegistry.qualityStates)[number];
export type WitnessSubstrate = (typeof canonicalRegistry.witnessSubstrates)[number];
export interface QualityAssessment {
  level: EvidenceQualityLevel;
  reasons: string[];
  limitations: string[];
}

export interface EvidenceQualityVector {
  reportFidelity: QualityAssessment;
  recall?: QualityAssessment;
  temporal?: QualityAssessment;
  causalSupport?: QualityAssessment;
  calibration: {
    mode: "ordinal_uncalibrated";
    policyVersion: string;
    probabilityOutputAuthorized: false;
  };
}

export interface ObservationCapability {
  observable: ObservableRef;
  sourceKind: EvidenceSourceKind;
  method: string;
  scope: string;
  observationWindow: TimeRange;
  opportunity: "adequate" | "limited" | "none" | "unknown";
  limitations: string[];
}

export interface AcquisitionContract {
  id: string;
  version: string;
  registryVersion: string;
  subjectId: string;
  sessionId: string;
  purpose: { code: string; statement: string; blockedDecisionRefs: string[] };
  allowedActions: EvidenceActionKind[];
  consent: {
    allowedTopics: string[];
    allowedSourceRoles: SourceRole[];
    policyRefs: string[];
  };
  requiredSentinelIds: string[];
  burdenBudget: {
    hardMaximumCognitiveTasks: number;
    usedCognitiveTasks: number;
    pauseAlwaysAvailable: true;
  };
  issuedAt: ISODateTime;
  expiresAt?: ISODateTime;
  contentHash?: Hash;
}

export type ObservationNeedOrigin =
  | { kind: "acquisition_requirement"; requirementRef: string }
  | { kind: "safety_protocol_transition"; protocolId: string }
  | { kind: "observation_debt"; observationDebtId: string }
  | { kind: "contradiction"; contradictionId: string }
  | { kind: "event_or_specimen_trigger"; collectionEventId?: string }
  | { kind: "longitudinal_refresh"; priorWitnessIds: string[] }
  | { kind: "authorized_request"; requestId: string };

export interface ObservationNeed {
  id: string;
  subjectId: string;
  acquisitionContractId: string;
  origin: ObservationNeedOrigin;
  kind: ObservationNeedKind;
  observable: ObservableRef;
  humanObservable: string;
  humanEvidenceClass: HumanEvidenceClass;
  observableClass: "human_observable" | "device_observable" | "record_observable" | "instrument_only";
  topic: string;
  purpose: { statement: string; blockedDecisionRefs: string[] };
  temporalNeed: { frame: TemporalFrameKind; range?: TimeRange; recallHorizon?: string };
  requestedOperations: readonly [SensingOperation, ...SensingOperation[]];
  requestedEvidenceClass: "testimony" | "device" | "record" | "laboratory" | "omics" | "imaging" | "examination";
  negativeEvidenceRequired?: boolean;
  sentinelId?: string;
  safetyPriority: "immediate" | "ordinary";
  burdenEstimate: number;
  longitudinalValue?: "high" | "moderate" | "low";
  createdAt: ISODateTime;
}

export interface ResponseDefinition {
  kind: ResponseKind;
  options?: Array<{ id: string; label: string; semanticValue: unknown }>;
  unit?: string;
  min?: number;
  max?: number;
}

export interface QuestionPlan {
  id: string;
  version: string;
  observationNeedId: string;
  questionClass: "protocol_locked" | "template_locked" | "novel_candidate";
  deploymentState: "draft" | "shadow" | "research_only" | "authorized_production" | "suspended" | "retired";
  origin:
    | { kind: "protocol"; definitionRef: string }
    | { kind: "template"; templateRef: string }
    | { kind: "candidate"; proposalRef: string; proposer: "human_author" | "model_assisted" };
  observable: ObservableRef;
  humanObservable: string;
  operations: readonly [SensingOperation, ...SensingOperation[]];
  temporal: { frame: TemporalFrameKind; range?: TimeRange; renderedWindow: string };
  response: ResponseDefinition;
  interactionMode: InteractionMode;
  prompt: string;
  oneCognitiveAct: boolean;
  missingness: {
    allowed: PersonFacingMissingnessKind[];
    neverMapsToNegative: true;
  };
  negative: {
    answerCanExpressNegative: boolean;
    boundedMeaning?: string;
    capabilityRequired: boolean;
  };
  governance: {
    topic: string;
    purposeCode: string;
    policyRefs: string[];
  };
  safety: {
    class: "ordinary" | "review_linked" | "protocol_locked";
    generationProhibited: boolean;
  };
  burden: { cognitiveTasks: number };
  registryVersion: string;
  templateOrProtocolRef?: string;
  outputContract: {
    witnessKind: string;
    transformRegistryVersion: string;
    prohibitedInferenceCodes: string[];
  };
  canonicalizationProfile: "CIE-CANONICAL-JSON@1.0.0";
  planContentHash?: Hash;
}

export interface QuestionInstance {
  id: string;
  subjectId: string;
  sessionId: string;
  observationNeedId: string;
  questionPlanId: string;
  questionPlanHash: Hash;
  contractId: string;
  contractVersion: string;
  registryVersion: string;
  expectedSessionStateVersion: number;
  expectedSessionStateHash: Hash;
  promptRendered: string;
  referenceWindowRendered: string;
  response: ResponseDefinition;
  interactionMode: InteractionMode;
  temporal: QuestionPlan["temporal"];
  missingnessOptions: PersonFacingMissingnessKind[];
  observableSnapshot: ObservableRef;
  operations: readonly [SensingOperation, ...SensingOperation[]];
  negativeCapabilityRequired: boolean;
  issuedAt: ISODateTime;
  expiresAt?: ISODateTime;
  nonce: string;
  instanceContentHash: Hash;
}

export type SemanticResponse =
  | { kind: "boolean"; value: boolean }
  | { kind: "single_select"; optionId: string }
  | { kind: "multi_select"; optionIds: string[] }
  | { kind: "integer"; value: number }
  | { kind: "decimal"; value: number }
  | { kind: "quantity"; value: number; unit: string }
  | { kind: "frequency"; count: number; per: string }
  | { kind: "duration"; value: number; unit: string }
  | { kind: "date_or_approximate"; value: string; precision: TimeRange["precision"] }
  | { kind: "short_text"; text: string }
  | { kind: "structured"; responseKind: ResponseKind; value: unknown };

export interface AnswerSubmissionAttempt {
  id: string;
  questionInstanceId: string;
  questionInstanceHash: Hash;
  expectedSessionStateVersion: number;
  expectedSessionStateHash: Hash;
  idempotencyKey: string;
  sourceKind: "patient_self_report" | "caregiver_report";
  sourceRole: SourceRole;
  submittedAt: ISODateTime;
  responseLatencyMs?: number;
  semanticResponse?: SemanticResponse;
  missingness?: MissingEvidence;
  exactSourceText?: string;
}

export interface AcceptedAnswer {
  id: string;
  attemptId: string;
  idempotencyKey: string;
  submissionContentHash: Hash;
  questionInstanceId: string;
  questionInstanceHash: Hash;
  subjectId: string;
  sessionId: string;
  observableSnapshot: ObservableRef;
  temporal: QuestionPlan["temporal"];
  operations: readonly [SensingOperation, ...SensingOperation[]];
  sourceKind: "patient_self_report" | "caregiver_report";
  sourceRole: SourceRole;
  acceptedAt: ISODateTime;
  responseLatencyMs?: number;
  semanticResponse?: SemanticResponse;
  missingness?: MissingEvidence;
  exactSourceText?: string;
  answerContentHash: Hash;
}

export interface WitnessPayload {
  kind: string;
  value?: unknown;
  exactSourceText?: string;
  relationshipSemantics?: "reported_after" | "person_attributed" | "compiler_hypothesis";
}

export interface MovementExposurePayload extends WitnessPayload {
  kind: "movement_exposure_episode";
  mode: string;
  dose: string;
  intensity: string;
  frequency: string;
  trainingAge: string;
  recentChange?: string;
  recoveryResponse?: string;
  injuryCost?: string;
}

export interface WitnessEnvelopeCore<TPayload extends WitnessPayload = WitnessPayload> {
  id: string;
  subjectId: string;
  substrate: WitnessSubstrate;
  witnessType: TPayload["kind"];
  observable: ObservableRef;
  effectiveTime: TimeRange;
  observationCapability?: ObservationCapability;
  provenance: {
    origin: { sourceKind: EvidenceSourceKind; sourceRole?: SourceRole };
    producer: { kind: "deterministic_compiler"; artifactId: string; version: string };
    acquisitionContractId: string;
    observationNeedId: string;
    questionPlanId: string;
    questionInstanceId: string;
    answerId: string;
    capturedAt: ISODateTime;
  };
  evidenceQuality: EvidenceQualityVector;
  status: "asserted" | "amended" | "retracted" | "superseded";
  restrictions: string[];
  createdAt: ISODateTime;
  witnessContentHash: Hash;
  commit?: {
    committedAt: ISODateTime;
    registryVersion: string;
    policyDecisionId: string;
    commitHash: Hash;
  };
}

export type WitnessEnvelope<TPayload extends WitnessPayload = WitnessPayload> = WitnessEnvelopeCore<TPayload> & (
  | {
      missingness: { kind: "present" };
      assertionPolarity: "positive" | "negative";
      payload: TPayload;
    }
  | {
      missingness: MissingEvidence;
      assertionPolarity: "not_asserted";
      payload?: never;
    }
);

export interface ObservationDebt {
  id: string;
  subjectId: string;
  observable: ObservableRef;
  reason: string;
  decisionImpact: "high" | "moderate" | "low" | "none";
  staleness: "current" | "aging" | "stale" | "unknown";
  resolvability: "easy" | "moderate" | "hard" | "unknown";
  burden: "low" | "moderate" | "high";
  disposition: "owed" | "deferred" | "waived" | "resolved";
  reactivationPolicy: "context_change_required";
  createdAt: ISODateTime;
}

export interface Contradiction {
  id: string;
  subjectId: string;
  kind: "perception_measurement_discordance" | "source_disagreement" | "temporal_inconsistency";
  witnessIds: string[];
  status: "open" | "clarified" | "accepted_as_contextual";
  neutralRevisitPrompt: string;
}

export interface RouteDecision {
  id: string;
  schemaVersion: "cie.route-decision@1";
  acquisitionContractId: string;
  pinnedStateHash: Hash;
  selectedObservationNeedId?: string;
  selectedAction?: EvidenceActionKind;
  selectedTier?: 0 | 1 | 2 | 3 | 4 | 5;
  selectedTierName?:
    | "safety"
    | "minimum_safe_biography"
    | "contradiction"
    | "observation_debt"
    | "longitudinal_value"
    | "enrichment";
  outcome: "selected" | "no_eligible_action" | "session_complete" | "paused";
  reasonCodes: string[];
  evaluatedObservationNeedIds: string[];
  routerVersion: string;
  registryVersion: string;
  decidedAt: ISODateTime;
  contentHash: Hash;
}

export interface ConceptMappingEvent {
  id: string;
  witnessId: string;
  witnessContentHash: Hash;
  sourceLabel: string;
  candidateConceptCode: string;
  status: "candidate_mapping" | "human_confirmed" | "registry_promoted";
  actor: "human" | "governed_registry_process";
  createdAt: ISODateTime;
  eventContentHash: Hash;
}

export interface AnswerRevision {
  id: string;
  priorAnswerId: string;
  priorAnswerHash: Hash;
  revisedAnswerId: string;
  revisedAnswerHash: Hash;
  reason: "flip" | "soften" | "harden" | "clarify" | "correct";
  createdAt: ISODateTime;
  revisionContentHash: Hash;
}

export interface WitnessRevision {
  id: string;
  priorWitnessId: string;
  priorWitnessHash: Hash;
  revisedWitnessId: string;
  revisedWitnessHash: Hash;
  answerRevisionId: string;
  createdAt: ISODateTime;
  revisionContentHash: Hash;
}

export interface SampleContextCapsule {
  id: string;
  subjectId: string;
  collectionEventId: string;
  collectionBinding: {
    adapter: "lims" | "collection_system";
    collectionEventHash: Hash;
    verifiedAt: ISODateTime;
    verifierId: string;
  };
  collectedAt: ISODateTime;
  specimenIds: string[];
  chainOfCustody: Array<{ specimenId: string; collectionEventId: string; linkHash: Hash }>;
  contextWitnessIds: string[];
  sensitiveTopics: string[];
  microConsentRefs: string[];
  capsuleContentHash: Hash;
}

export interface ReplayEvent {
  sequence: number;
  priorEventHash?: Hash;
  eventHash: Hash;
  registryVersion: string;
  kind: "question_issued" | "answer_accepted" | "witness_committed" | "mapping_appended";
  object: QuestionInstance | AcceptedAnswer | WitnessEnvelope | ConceptMappingEvent;
  objectHash: Hash;
}

export interface ReplayState {
  questions: QuestionInstance[];
  answers: AcceptedAnswer[];
  witnesses: WitnessEnvelope[];
  mappings: ConceptMappingEvent[];
  projectionHashes: {
    coverage: Hash;
    contradiction: Hash;
    debt: Hash;
    completion: Hash;
  };
  stateHash: Hash;
}
