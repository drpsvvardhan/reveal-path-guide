import { useCallback, useState } from "react";
import { useCIEAssessment } from "@/context/CIEAssessmentContext";
import { useCIE33 } from "@/hooks/useCIE33";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import IntakeStep from "@/components/intake/IntakeStep";
import CIE33Review from "@/components/intake/CIE33Review";
import CIEHistory from "@/components/intake/CIEHistory";
import { Button } from "@/components/ui/button";

export default function IntakeResultsSection() {
  const { refresh } = useCIEAssessment();
  const { state, loading, error, readOnly, reload } = useCIE33();
  const [flow, setFlow] = useState<"new" | "resume" | null>(null);
  const onComplete = useCallback(async () => {
    setFlow(null);
    await Promise.all([refresh(), reload()]);
  }, [refresh, reload]);
  if (flow)
    return (
      <IntakeStep
        newAssessment={flow === "new"}
        onRetakeComplete={onComplete}
      />
    );
  return (
    <PatientSectionLayout
      eyebrow="YOUR INTAKE · CIE 3.3"
      title="Your experience, in your words"
      intro="A versioned account of your goals, daily experience, exposures, history, and circumstances."
    >
      {loading ? (
        <p>Loading your intake…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {state ? (
            <>
              <p className="text-sm text-muted-foreground">
                CIE {state.instrumentVersion} ·{" "}
                {state.phase === "complete" ? "Confirmed" : "In progress"} ·
                Started {new Date(state.startedAt).toLocaleDateString()}
              </p>
              <CIE33Review state={state} />
            </>
          ) : (
            <p>
              Start CIE 3.3 to share the context that matters for your twin.
              Earlier CIE results remain available below.
            </p>
          )}
          {!readOnly && (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setFlow(state ? "resume" : "new")}>
                {state?.phase === "complete"
                  ? "Review or correct my answers"
                  : state
                    ? "Continue my intake"
                    : "Start CIE 3.3"}
              </Button>
              {state?.phase === "complete" && (
                <Button variant="outline" onClick={() => setFlow("new")}>
                  Start a new account
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <div className="mt-10 border-t pt-6">
        <CIEHistory />
      </div>
    </PatientSectionLayout>
  );
}
