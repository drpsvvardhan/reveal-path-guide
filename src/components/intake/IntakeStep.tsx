import { useEffect, useState } from "react";
import { useCIE33 } from "@/hooks/useCIE33";
import { useCIEAssessment } from "@/context/CIEAssessmentContext";
import { useOnboarding } from "@/context/OnboardingContext";
import OnboardingLayout from "@/components/onboarding/OnboardingLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import CIE33Review from "./CIE33Review";
import { currentEntries, MISSING_LABELS } from "@/lib/cie33Presentation";
import type {
  SemanticResponse,
  MissingEvidence,
} from "@shared/cie33/reference/types";

export default function IntakeStep({
  onRetakeComplete,
  newAssessment = false,
}: {
  onRetakeComplete?: () => void;
  newAssessment?: boolean;
}) {
  const { state, loading, busy, error, readOnly, command, reload } = useCIE33();
  const { advanceToStep } = useOnboarding();
  const { refresh } = useCIEAssessment();
  const [startNew, setStartNew] = useState(newAssessment);
  const [consent, setConsent] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [response, setResponse] = useState<SemanticResponse | undefined>();
  const [missingKind, setMissingKind] = useState("");
  const [reason, setReason] = useState("");
  const [capability, setCapability] = useState(false);
  const q = state?.current?.instance;
  useEffect(() => {
    setResponse(undefined);
    setMissingKind("");
    setReason("");
    setCapability(false);
  }, [q?.id]);
  const choose = (value: SemanticResponse) => {
    setResponse(value);
    setMissingKind("");
    setReason("");
  };
  const showConsent = !state || (startNew && state.phase === "complete");
  const canSubmit = response
    ? response.kind === "short_text"
      ? !!response.text.trim()
      : response.kind === "boolean" && response.value === false
        ? capability
        : true
    : !!missingKind &&
      (!["not_applicable", "temporarily_unable"].includes(missingKind) ||
        !!reason.trim());
  const submit = async () => {
    if (!q || !canSubmit) return;
    const missingness = missingKind
      ? ({
          kind: missingKind,
          ...(["not_applicable", "temporarily_unable"].includes(missingKind)
            ? { reason }
            : {}),
        } as MissingEvidence)
      : undefined;
    await command({
      action: "answer",
      answer: {
        questionInstanceId: q.id,
        questionInstanceHash: q.instanceContentHash,
        semanticResponse: missingKind ? undefined : response,
        missingness,
        negativeCapabilityConfirmed: capability,
      },
    });
  };
  const continueToRecords = async () => {
    await refresh();
    if (onRetakeComplete) onRetakeComplete();
    else await advanceToStep("upload");
  };
  return (
    <OnboardingLayout
      stepNumber={3}
      totalSteps={5}
      eyebrow="YOUR ACCOUNT · CIE 3.3"
      title={
        loading
          ? "Loading your saved intake"
          : showConsent
            ? "Start with your own experience"
            : state.phase === "review"
              ? "Review what you've shared"
              : state.phase === "complete"
                ? "Your account is saved"
                : state.phase === "safety_hold"
                  ? "Please seek support now"
                  : "Tell us what life feels like for you"
      }
      intro="Your experience helps ground your BioTwin alongside records, measurements, and future updates."
      footer={<div />}
    >
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive p-4 mb-4"
        >
          <p>{error}</p>
          <Button
            className="mt-2"
            variant="outline"
            disabled={busy}
            onClick={() => void reload()}
          >
            Reload saved intake
          </Button>
        </div>
      )}
      {readOnly && (
        <p className="rounded-lg border p-3 mb-4">
          You are viewing this patient's intake. Only the patient can answer for
          themselves.
        </p>
      )}
      {loading ? (
        <Loader2 aria-label="Loading" className="animate-spin" />
      ) : showConsent ? (
        <div className="space-y-5 max-w-2xl">
          <p>
            We'll cover what matters to you, daily experience, treatments,
            history, and practical circumstances. There are 32 core questions,
            with a few follow-ups when relevant. You can pause and return.
          </p>
          <p>
            Use “I don't know,” “I don't recall,” or another option whenever
            needed. These remain distinct from “No.” This intake records your
            experience; it does not diagnose a condition.
          </p>
          <label className="flex gap-3 items-start">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I am answering for myself, can answer privately, and agree to save
              these answers for my BioTwin and care context.
            </span>
          </label>
          <label className="flex gap-3 items-start">
            <input
              type="checkbox"
              className="mt-1"
              checked={sensitive}
              onChange={(e) => setSensitive(e.target.checked)}
            />
            <span>
              Include optional reproductive, hormonal, and sexual health
              questions.
            </span>
          </label>
          <p className="text-sm text-muted-foreground">
            English self-report is supported in this first version. If you need
            a proxy or another language, ask your care team for help.
          </p>
          <Button
            disabled={!consent || busy || readOnly || !!error}
            onClick={async () => {
              const next = await command({
                action: "start",
                consent: true,
                sensitive_consent: sensitive,
                source_role: "self",
              });
              if (next) setStartNew(false);
            }}
          >
            Begin CIE 3.3
          </Button>
        </div>
      ) : state.phase === "safety_hold" ? (
        <div
          role="alert"
          className="space-y-4 rounded-xl border border-destructive p-5"
        >
          <p>
            Your answer suggests a need for immediate support. If you are in
            immediate danger or might harm yourself or someone else, contact
            local emergency services or go to the nearest emergency department
            now. If possible, ask someone you trust to stay with you.
          </p>
          <p>
            The questionnaire is paused. This app has not contacted emergency
            services or a clinician for you. Please contact your doctor or care
            team directly.
          </p>
          <p className="text-sm">
            Your answers have been saved. This safety hold cannot be cleared by
            changing an answer.
          </p>
        </div>
      ) : state.phase === "paused" ? (
        <div className="space-y-4">
          <p>Your confirmed answers are saved. Resume when you are ready.</p>
          <Button
            disabled={busy || readOnly}
            onClick={() => void command({ action: "resume" })}
          >
            Resume intake
          </Button>
        </div>
      ) : state.phase === "review" || state.phase === "complete" ? (
        <div className="space-y-6">
          <CIE33Review
            state={state}
            busy={busy}
            onRevise={
              readOnly
                ? undefined
                : (id) => void command({ action: "revise", witness_id: id })
            }
          />
          {state.phase === "review" ? (
            <Button
              disabled={busy || readOnly}
              onClick={() => void command({ action: "finish" })}
            >
              Confirm my account
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => void continueToRecords()}>
              {onRetakeComplete ? "Return to my intake" : "Continue to records"}
            </Button>
          )}
        </div>
      ) : q ? (
        <form
          className="space-y-6 max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex justify-between items-center gap-4">
            <p className="text-sm font-medium text-muted-foreground">
              {state.current!.chapter} · {currentEntries(state).length} answers
              saved
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || readOnly}
              onClick={() => void command({ action: "pause" })}
            >
              Save and pause
            </Button>
          </div>
          <fieldset disabled={busy || readOnly} className="space-y-4">
            <legend className="font-serif text-2xl mb-3">
              {q.promptRendered}
            </legend>
            <p className="text-sm text-muted-foreground">
              Time window: {q.referenceWindowRendered}
            </p>
            {q.response.kind === "boolean" && (
              <div className="flex gap-3">
                {[true, false].map((value) => (
                  <Button
                    key={String(value)}
                    type="button"
                    variant={
                      response?.kind === "boolean" &&
                      response.value === value &&
                      !missingKind
                        ? "default"
                        : "outline"
                    }
                    aria-pressed={
                      response?.kind === "boolean" &&
                      response.value === value &&
                      !missingKind
                    }
                    onClick={() => choose({ kind: "boolean", value })}
                  >
                    {value ? "Yes" : "No"}
                  </Button>
                ))}
              </div>
            )}
            {q.response.kind === "short_text" && (
              <Textarea
                aria-label="Your answer"
                maxLength={4000}
                rows={5}
                value={response?.kind === "short_text" ? response.text : ""}
                onChange={(e) =>
                  choose({ kind: "short_text", text: e.target.value })
                }
                placeholder="In your own words…"
              />
            )}
            {q.response.kind === "single_select" && (
              <div className="grid gap-2">
                {q.response.options!.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant={
                      response?.kind === "single_select" &&
                      response.optionId === option.id &&
                      !missingKind
                        ? "default"
                        : "outline"
                    }
                    aria-pressed={
                      response?.kind === "single_select" &&
                      response.optionId === option.id &&
                      !missingKind
                    }
                    onClick={() =>
                      choose({ kind: "single_select", optionId: option.id })
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}
            {response?.kind === "boolean" &&
              !response.value &&
              !missingKind && (
                <label className="flex gap-3 items-start text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={capability}
                    onChange={(e) => setCapability(e.target.checked)}
                  />
                  <span>
                    I can answer from my own experience for this time window.
                    Otherwise, I'll choose an option below.
                  </span>
                </label>
              )}
            <label className="block text-sm space-y-2">
              <span>Or tell us why you cannot answer</span>
              <select
                aria-label="Reason for not answering"
                className="w-full rounded-md border bg-background p-3"
                value={missingKind}
                onChange={(e) => {
                  setMissingKind(e.target.value);
                  if (e.target.value) setResponse(undefined);
                  setReason("");
                }}
              >
                <option value="">Choose an option</option>
                {q.missingnessOptions.map((kind) => (
                  <option key={kind} value={kind}>
                    {MISSING_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            {missingKind === "not_applicable" && (
              <Textarea
                aria-label="Why this does not apply"
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What makes this question not applicable to you?"
              />
            )}
            {missingKind === "temporarily_unable" && (
              <select
                aria-label="Why you cannot answer now"
                className="w-full rounded-md border bg-background p-3"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">Choose a reason</option>
                <option value="acute_state">
                  I'm not feeling able right now
                </option>
                <option value="accessibility">
                  I need accessibility support
                </option>
                <option value="privacy">I don't have privacy</option>
                <option value="interruption">I've been interrupted</option>
                <option value="other">Another reason</option>
              </select>
            )}
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!canSubmit || busy || readOnly}>
              {busy ? "Saving…" : "Save and continue"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || readOnly}
              onClick={() => void command({ action: "resume" })}
            >
              Refresh time window
            </Button>
          </div>
        </form>
      ) : (
        <p>No question is available. Reload your saved intake to continue.</p>
      )}
    </OnboardingLayout>
  );
}
