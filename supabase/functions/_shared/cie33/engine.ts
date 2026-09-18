import {
  FOUNDATION,
  INSTRUMENT_VERSION,
  PROFILE_VERSION,
} from "./foundation.ts";
import type { FoundationQuestion } from "./foundation.ts";
import { canonicalRegistry } from "./reference/registry.ts";
import { contentHash } from "./reference/canonical.ts";
import {
  compileQuestionPlan,
  issueQuestionInstance,
} from "./reference/question-compiler.ts";
import { acceptBoundAnswer } from "./reference/answer.ts";
import { compileWitness, commitWitness } from "./reference/witness-compiler.ts";
import {
  assertRequiredSentinels,
  assertSentinelNeed,
} from "./reference/safety.ts";
import { routeNext } from "./reference/router.ts";
import type {
  AcquisitionContract,
  ObservationNeed,
  QuestionPlan,
  QuestionInstance,
  AcceptedAnswer,
  WitnessEnvelope,
  Hash,
  SemanticResponse,
  MissingEvidence,
  TimeRange,
  RouteDecision,
} from "./reference/types.ts";

export class IntakeError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export interface IntakeEntry {
  key: string;
  chapter: string;
  need: ObservationNeed;
  plan: QuestionPlan;
  question: QuestionInstance;
  answer: AcceptedAnswer;
  witness: WitnessEnvelope;
  supersedes?: string;
}
export interface CurrentQuestion {
  key: string;
  chapter: string;
  need: ObservationNeed;
  plan: QuestionPlan;
  instance: QuestionInstance;
  revisesWitnessId?: string;
}
export interface IntakeState {
  schemaVersion: 1;
  instrumentVersion: typeof INSTRUMENT_VERSION;
  profileVersion: typeof PROFILE_VERSION;
  id: string;
  subjectId: string;
  revision: number;
  phase: "active" | "paused" | "review" | "complete" | "safety_hold";
  safety:
    | "not_evaluated"
    | "insufficient_coverage"
    | "no_signal_reported"
    | "handoff_required";
  contract: AcquisitionContract;
  entries: IntakeEntry[];
  current?: CurrentQuestion;
  stateHash: Hash;
  route?: RouteDecision;
  startedAt: string;
  updatedAt: string;
}
export interface AnswerInput {
  questionInstanceId: string;
  questionInstanceHash: Hash;
  semanticResponse?: SemanticResponse;
  missingness?: MissingEvidence;
  negativeCapabilityConfirmed?: boolean;
}
export type IntakeCommand =
  | { action: "answer"; answer: AnswerInput }
  | { action: "revise"; witnessId: string }
  | { action: "pause" | "resume" | "finish" };

export function latestEntries(state: IntakeState): IntakeEntry[] {
  const byKey = new Map<string, IntakeEntry>();
  for (const entry of state.entries) byKey.set(entry.key, entry);
  return [...byKey.values()];
}
function eligibleQuestions(state: IntakeState): FoundationQuestion[] {
  const entries = latestEntries(state);
  return FOUNDATION.filter(
    (q) =>
      (!q.sensitive ||
        state.contract.consent.allowedTopics.includes(q.topic)) &&
      (!q.condition ||
        entries.some(
          (e) =>
            e.key === q.condition &&
            e.answer.semanticResponse?.kind === "boolean" &&
            e.answer.semanticResponse.value,
        )),
  );
}
function hashState(state: IntakeState): Hash {
  const { current: _current, route: _route, stateHash: _hash, ...body } = state;
  return contentHash(body);
}
function rangeFor(q: FoundationQuestion, now: string): TimeRange {
  if (q.frame === "now")
    return {
      start: now,
      end: now,
      precision: "instant",
      anchorText: "right now",
      timezone: "UTC",
    };
  if (q.frame === "lifetime")
    return {
      end: now,
      precision: "life_stage",
      anchorText: "at any time in your life through today",
    };
  return {
    start: new Date(Date.parse(now) - (q.days ?? 30) * 86400000).toISOString(),
    end: now,
    precision: "day",
    anchorText: `during the past ${q.days ?? 30} days`,
    timezone: "UTC",
  };
}
function needFor(
  q: FoundationQuestion,
  state: IntakeState,
  now: string,
): ObservationNeed {
  const index = FOUNDATION.indexOf(q).toString().padStart(3, "0");
  const need: ObservationNeed = {
    id: `${index}:${state.id}:${q.key}:${state.revision}`,
    subjectId: state.subjectId,
    acquisitionContractId: state.contract.id,
    origin: {
      kind: "acquisition_requirement",
      requirementRef: PROFILE_VERSION,
    },
    kind: q.key === "safety" ? "safety_obligation" : "minimum_biography",
    observable: {
      kind: "registered",
      conceptCode: q.code,
      registryVersion: canonicalRegistry.version,
    },
    humanObservable: q.key,
    humanEvidenceClass: q.evidenceClass,
    observableClass: "human_observable",
    topic: q.topic,
    purpose: {
      statement: "Preserve the person's account to ground their BioTwin.",
      blockedDecisionRefs: [],
    },
    temporalNeed: { frame: q.frame, range: rangeFor(q, now) },
    requestedOperations: [
      q.response.kind === "boolean" ? "confirm" : "identify",
    ],
    requestedEvidenceClass: "testimony",
    negativeEvidenceRequired: q.response.kind === "boolean",
    sentinelId: q.sentinelId,
    safetyPriority: q.key === "safety" ? "immediate" : "ordinary",
    burdenEstimate: 1,
    createdAt: now,
  };
  assertSentinelNeed(need);
  return need;
}
function issue(
  state: IntakeState,
  q: FoundationQuestion,
  now: string,
  revisesWitnessId?: string,
): void {
  const need = needFor(q, state, now);
  const plan = compileQuestionPlan(need, state.contract, {
    prompt: q.prompt,
    response: q.response,
    renderedWindow: need.temporalNeed.range!.anchorText,
    templateRef: `VIZZHY-FOUNDATION-${q.key}@1.0.0`,
  });
  const instance = issueQuestionInstance(plan, need, state.contract, {
    instanceId: crypto.randomUUID(),
    nonce: crypto.randomUUID(),
    issuedAt: now,
    expiresAt: new Date(
      Date.parse(now) + (q.key === "safety" ? 15 * 60000 : 86400000),
    ).toISOString(),
    expectedSessionStateVersion: state.revision,
    expectedSessionStateHash: state.stateHash,
  });
  state.current = {
    key: q.key,
    chapter: q.chapter,
    need,
    plan,
    instance,
    revisesWitnessId,
  };
}
function route(state: IntakeState, now: string): void {
  delete state.current;
  state.stateHash = hashState(state);
  if (state.phase !== "active") return;
  const answered = new Set(latestEntries(state).map((e) => e.key));
  const pending = eligibleQuestions(state).filter((q) => !answered.has(q.key));
  if (!pending.length) {
    state.phase = "review";
    state.stateHash = hashState(state);
    return;
  }
  const needs = pending.map((q) => needFor(q, state, now));
  state.route = routeNext(
    needs.map((need) => ({ need })),
    state.contract,
    {
      decisionId: crypto.randomUUID(),
      decidedAt: now,
      pinnedStateHash: state.stateHash,
      activeSafetyProtocolState:
        state.safety === "handoff_required"
          ? "handoff_required"
          : "no_active_protocol",
    },
  );
  const selected = needs.findIndex(
    (n) => n.id === state.route!.selectedObservationNeedId,
  );
  if (selected < 0)
    throw new IntakeError("NO_ROUTE", "No authorized question is available.");
  issue(state, pending[selected], now);
}
export function startIntake(
  subjectId: string,
  sensitiveConsent: boolean,
  now: string,
): IntakeState {
  const id = crypto.randomUUID();
  const contract: AcquisitionContract = {
    id: crypto.randomUUID(),
    version: "1.0.0",
    registryVersion: canonicalRegistry.version,
    subjectId,
    sessionId: id,
    purpose: {
      code: "patient_reveal_foundation",
      statement:
        "Build a source-backed subjective account for the patient's BioTwin.",
      blockedDecisionRefs: [],
    },
    allowedActions: ["ask_human"],
    consent: {
      allowedTopics: [
        ...new Set(
          FOUNDATION.filter((q) => !q.sensitive || sensitiveConsent).map(
            (q) => q.topic,
          ),
        ),
      ],
      allowedSourceRoles: ["self"],
      policyRefs: ["VIZZHY-FOUNDATION-CONSENT@1.0.0"],
    },
    requiredSentinelIds: canonicalRegistry.sentinels.map((s) => s.id),
    burdenBudget: {
      hardMaximumCognitiveTasks: 64,
      usedCognitiveTasks: 0,
      pauseAlwaysAvailable: true,
    },
    issuedAt: now,
  };
  assertRequiredSentinels(contract);
  const state: IntakeState = {
    schemaVersion: 1,
    instrumentVersion: INSTRUMENT_VERSION,
    profileVersion: PROFILE_VERSION,
    id,
    subjectId,
    revision: 0,
    phase: "active",
    safety: "not_evaluated",
    contract,
    entries: [],
    stateHash: "sha256:pending",
    startedAt: now,
    updatedAt: now,
  };
  route(state, now);
  return state;
}

/** Strict boundary around the reference kernel, which checks response kinds only. */
export function validateAnswer(
  input: AnswerInput,
  instance: QuestionInstance,
): void {
  if (!input || typeof input !== "object")
    throw new IntakeError(
      "INVALID_ANSWER",
      "Choose an answer or a reason for not answering.",
    );
  if (
    input.questionInstanceId !== instance.id ||
    input.questionInstanceHash !== instance.instanceContentHash
  )
    throw new IntakeError(
      "STALE_QUESTION",
      "The question has changed. Reload your saved intake.",
      409,
    );
  if (
    Number(input.semanticResponse !== undefined) +
      Number(input.missingness !== undefined) !==
    1
  )
    throw new IntakeError(
      "INVALID_ANSWER",
      "Choose exactly one answer or missingness state.",
    );
  const response = input.semanticResponse;
  if (response !== undefined) {
    if (!response || response.kind !== instance.response.kind)
      throw new IntakeError(
        "INVALID_RESPONSE",
        "That response does not match this question.",
      );
    if (response.kind === "boolean") {
      if (typeof response.value !== "boolean")
        throw new IntakeError("INVALID_BOOLEAN", "Select Yes or No.");
      if (!response.value && input.negativeCapabilityConfirmed !== true)
        throw new IntakeError(
          "NEGATIVE_CAPABILITY_REQUIRED",
          "Confirm that you can answer for the stated period, or choose a missingness option.",
        );
    } else if (response.kind === "short_text") {
      if (
        typeof response.text !== "string" ||
        !response.text.trim() ||
        response.text.length > 4000
      )
        throw new IntakeError(
          "INVALID_TEXT",
          "Enter between 1 and 4,000 characters, or choose a missingness option.",
        );
    } else if (response.kind === "single_select") {
      if (!instance.response.options?.some((o) => o.id === response.optionId))
        throw new IntakeError("INVALID_OPTION", "Select an offered answer.");
    } else
      throw new IntakeError(
        "UNSUPPORTED_RESPONSE",
        "This response type is not supported by the Foundation profile.",
      );
  }
  const missing = input.missingness;
  if (missing !== undefined) {
    if (
      !missing ||
      !instance.missingnessOptions.includes(missing.kind as never)
    )
      throw new IntakeError(
        "INVALID_MISSINGNESS",
        "Select an offered missingness option.",
      );
    if (
      missing.kind === "not_applicable" &&
      (typeof missing.reason !== "string" ||
        !missing.reason.trim() ||
        missing.reason.length > 1000)
    )
      throw new IntakeError(
        "REASON_REQUIRED",
        "Explain why this question does not apply.",
      );
    if (
      missing.kind === "temporarily_unable" &&
      ![
        "acute_state",
        "accessibility",
        "privacy",
        "interruption",
        "other",
      ].includes(missing.reason)
    )
      throw new IntakeError(
        "REASON_REQUIRED",
        "Choose why you are unable to answer now.",
      );
  }
}
export function applyCommand(
  previous: IntakeState,
  command: IntakeCommand,
  requestId: string,
  now: string,
): IntakeState {
  if (previous.stateHash !== hashState(previous))
    throw new IntakeError(
      "STATE_INTEGRITY",
      "The saved intake could not be verified.",
      500,
    );
  if (previous.safety === "handoff_required")
    throw new IntakeError(
      "SAFETY_HOLD",
      "This intake is paused for a safety handoff. It cannot be self-cleared.",
      409,
    );
  const state = structuredClone(previous);
  state.revision++;
  state.updatedAt = now;
  if (command.action === "answer") {
    const current = previous.current;
    if (previous.phase !== "active" || !current)
      throw new IntakeError("NO_QUESTION", "There is no active question.", 409);
    validateAnswer(command.answer, current.instance);
    if (Date.parse(now) > Date.parse(current.instance.expiresAt!))
      throw new IntakeError(
        "QUESTION_EXPIRED",
        "Refresh this question to answer for a current time window.",
        409,
      );
    const input = command.answer;
    const exactSourceText =
      input.semanticResponse?.kind === "short_text"
        ? input.semanticResponse.text
        : undefined;
    const answer = acceptBoundAnswer(
      {
        id: requestId,
        idempotencyKey: requestId,
        questionInstanceId: current.instance.id,
        questionInstanceHash: current.instance.instanceContentHash,
        expectedSessionStateVersion: previous.revision,
        expectedSessionStateHash: previous.stateHash,
        sourceKind: "patient_self_report",
        sourceRole: "self",
        submittedAt: now,
        semanticResponse: input.semanticResponse,
        missingness: input.missingness,
        exactSourceText,
      },
      current.instance,
      state.contract,
      now,
    );
    const isNegative =
      answer.semanticResponse?.kind === "boolean" &&
      !answer.semanticResponse.value;
    const witness = commitWitness(
      compileWitness({
        witnessId: crypto.randomUUID(),
        witnessKind: "human_observation",
        answer,
        instance: current.instance,
        plan: current.plan,
        need: current.need,
        contract: state.contract,
        compiledAt: now,
        observationCapability: isNegative
          ? {
              observable: current.need.observable,
              sourceKind: "patient_self_report",
              method:
                "Patient explicitly confirms ability to report their own experience for the stated period.",
              scope: current.instance.promptRendered,
              observationWindow: current.instance.temporal.range!,
              opportunity: "adequate",
              limitations: [
                "Self-report; not independent evidence of biological absence.",
              ],
            }
          : undefined,
      }),
      {
        committedAt: now,
        registryVersion: canonicalRegistry.version,
        policyDecisionId: "VIZZHY-FOUNDATION-CONSENT@1.0.0",
      },
    );
    state.entries.push({
      key: current.key,
      chapter: current.chapter,
      need: current.need,
      plan: current.plan,
      question: current.instance,
      answer,
      witness,
      supersedes: current.revisesWitnessId,
    });
    state.contract.burdenBudget.usedCognitiveTasks++;
    if (current.key === "safety") {
      state.safety =
        answer.semanticResponse?.kind === "boolean"
          ? answer.semanticResponse.value
            ? "handoff_required"
            : "no_signal_reported"
          : "insufficient_coverage";
      if (state.safety === "handoff_required") state.phase = "safety_hold";
    }
    route(state, now);
  } else if (command.action === "revise") {
    if (!["review", "complete"].includes(previous.phase))
      throw new IntakeError(
        "NOT_REVIEWING",
        "Finish this intake before correcting a saved answer.",
        409,
      );
    const entry = latestEntries(previous).find(
      (e) => e.witness.id === command.witnessId,
    );
    if (!entry)
      throw new IntakeError(
        "INVALID_REVISION",
        "Select a current answer to correct.",
      );
    state.phase = "active";
    delete state.current;
    state.stateHash = hashState(state);
    issue(
      state,
      FOUNDATION.find((q) => q.key === entry.key)!,
      now,
      entry.witness.id,
    );
  } else if (command.action === "pause") {
    if (previous.phase !== "active")
      throw new IntakeError(
        "NOT_ACTIVE",
        "Only an active intake can be paused.",
        409,
      );
    // Preserve the revision target; resume issues a fresh, bound question.
    state.phase = "paused";
    state.stateHash = hashState(state);
  } else if (command.action === "resume") {
    if (!["paused", "active"].includes(previous.phase))
      throw new IntakeError(
        "NOT_PAUSED",
        "This intake cannot be resumed.",
        409,
      );
    state.phase = "active";
    state.stateHash = hashState(state);
    if (previous.current)
      issue(
        state,
        FOUNDATION.find((q) => q.key === previous.current!.key)!,
        now,
        previous.current.revisesWitnessId,
      );
    else route(state, now);
  } else if (command.action === "finish") {
    if (previous.phase !== "review" || previous.current)
      throw new IntakeError(
        "INCOMPLETE",
        "Review all required questions before finishing.",
        409,
      );
    if (
      eligibleQuestions(state).some(
        (q) => !latestEntries(state).some((e) => e.key === q.key),
      )
    )
      throw new IntakeError(
        "INCOMPLETE",
        "Some questions still need a response.",
      );
    state.phase = "complete";
    state.stateHash = hashState(state);
  } else throw new IntakeError("UNKNOWN_ACTION", "Unknown intake action.");
  return state;
}
