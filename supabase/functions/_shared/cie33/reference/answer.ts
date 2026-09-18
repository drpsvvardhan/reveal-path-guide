import type { AcceptedAnswer, AcquisitionContract, AnswerSubmissionAttempt, QuestionInstance, SemanticResponse } from "./types.ts";
import { contentHash, deepFreeze } from "./canonical.ts";
import { ContractError } from "./errors.ts";

function instanceHashValid(instance: QuestionInstance): boolean {
  const { instanceContentHash: _hash, ...body } = instance;
  return contentHash(body) === instance.instanceContentHash;
}

function responseMatches(expected: QuestionInstance["response"], actual: SemanticResponse): boolean {
  if (actual.kind === "structured") return actual.responseKind === expected.kind;
  if (actual.kind === expected.kind) return true;
  return false;
}

export function acceptBoundAnswer(
  attempt: AnswerSubmissionAttempt,
  instance: QuestionInstance,
  contract: AcquisitionContract,
  acceptedAt: string,
  priorAccepted?: AcceptedAnswer,
): Readonly<AcceptedAnswer> {
  if (!instanceHashValid(instance)) throw new ContractError("QUESTION_INSTANCE_HASH_INVALID", "QuestionInstance content no longer matches its hash.");
  if (attempt.questionInstanceId !== instance.id || attempt.questionInstanceHash !== instance.instanceContentHash) {
    throw new ContractError("ANSWER_INSTANCE_MISMATCH", "Answer is not bound to this exact QuestionInstance.");
  }
  if (attempt.expectedSessionStateVersion !== instance.expectedSessionStateVersion || attempt.expectedSessionStateHash !== instance.expectedSessionStateHash) {
    throw new ContractError("STALE_ANSWER", "Answer targets a stale or different session state.");
  }
  if (instance.contractId !== contract.id || instance.contractVersion !== contract.version) {
    throw new ContractError("ANSWER_CONTRACT_MISMATCH", "QuestionInstance is outside the active AcquisitionContract.");
  }
  if (instance.expiresAt && Date.parse(attempt.submittedAt) > Date.parse(instance.expiresAt)) {
    throw new ContractError("QUESTION_INSTANCE_EXPIRED", "Answer was submitted after QuestionInstance expiry.");
  }
  if (!contract.consent.allowedSourceRoles.includes(attempt.sourceRole)) {
    throw new ContractError("RESPONDENT_NOT_AUTHORIZED", "Respondent role is not authorized by the AcquisitionContract.");
  }
  const states = Number(attempt.semanticResponse !== undefined) + Number(attempt.missingness !== undefined);
  if (states !== 1) throw new ContractError("ANSWER_STATE_INVALID", "Exactly one semantic response or missingness state is required.");
  if (attempt.missingness) {
    if (attempt.missingness.kind === "not_asked" || attempt.missingness.kind === "source_unavailable") {
      throw new ContractError("PERSON_MISSINGNESS_SCOPE", `${attempt.missingness.kind} is acquisition-only and cannot be submitted by a person.`);
    }
    if (!instance.missingnessOptions.includes(attempt.missingness.kind)) {
      throw new ContractError("MISSINGNESS_NOT_OFFERED", "Submitted missingness was not offered by the immutable QuestionInstance.");
    }
  }
  if (attempt.semanticResponse && !responseMatches(instance.response, attempt.semanticResponse)) {
    throw new ContractError("RESPONSE_SCHEMA_MISMATCH", "Semantic response does not match the QuestionInstance schema.");
  }
  const submissionContentHash = contentHash({
    questionInstanceId: attempt.questionInstanceId,
    questionInstanceHash: attempt.questionInstanceHash,
    expectedSessionStateVersion: attempt.expectedSessionStateVersion,
    expectedSessionStateHash: attempt.expectedSessionStateHash,
    sourceKind: attempt.sourceKind,
    sourceRole: attempt.sourceRole,
    semanticResponse: attempt.semanticResponse,
    missingness: attempt.missingness,
    exactSourceText: attempt.exactSourceText,
  });
  if (priorAccepted && priorAccepted.idempotencyKey === attempt.idempotencyKey) {
    if (priorAccepted.submissionContentHash === submissionContentHash) return priorAccepted;
    throw new ContractError("IDEMPOTENCY_CONFLICT", "Idempotency key was reused with a different semantic submission.");
  }

  const draft: Omit<AcceptedAnswer, "answerContentHash"> = {
    id: `answer-${attempt.id}`,
    attemptId: attempt.id,
    idempotencyKey: attempt.idempotencyKey,
    submissionContentHash,
    questionInstanceId: instance.id,
    questionInstanceHash: instance.instanceContentHash,
    subjectId: instance.subjectId,
    sessionId: instance.sessionId,
    observableSnapshot: instance.observableSnapshot,
    temporal: instance.temporal,
    operations: instance.operations,
    sourceKind: attempt.sourceKind,
    sourceRole: attempt.sourceRole,
    acceptedAt,
    responseLatencyMs: attempt.responseLatencyMs,
    semanticResponse: attempt.semanticResponse,
    missingness: attempt.missingness,
    exactSourceText: attempt.exactSourceText,
  };
  return deepFreeze({ ...draft, answerContentHash: contentHash(draft) });
}
