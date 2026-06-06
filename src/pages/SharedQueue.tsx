import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Calendar, User } from "lucide-react";

interface SharedQuestion {
  id: string;
  question: string;
  rationale: string | null;
  source: "auto" | "manual";
  priority: number;
  created_at: string;
}

interface SharedPatientInfo {
  display_name: string | null;
}

const SharedQueue: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [questions, setQuestions] = useState<SharedQuestion[]>([]);
  const [patientInfo, setPatientInfo] = useState<SharedPatientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No share token in URL");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc(
          "get_shared_question_queue",
          { p_token: token },
        );
        if (rpcError) throw rpcError;
        const rows = (data || []) as Array<{
          display_name: string | null;
          question_id: string | null;
          question: string | null;
          rationale: string | null;
          source: "auto" | "manual" | null;
          priority: number | null;
          created_at: string | null;
        }>;

        if (rows.length === 0) {
          setError("This share link is no longer valid. Ask the person who sent it to share a new link.");
          setLoading(false);
          return;
        }

        setPatientInfo({ display_name: rows[0].display_name });
        setQuestions(
          rows
            .filter((r) => r.question_id && r.question)
            .map((r) => ({
              id: r.question_id!,
              question: r.question!,
              rationale: r.rationale,
              source: (r.source ?? "auto") as "auto" | "manual",
              priority: r.priority ?? 0,
              created_at: r.created_at ?? new Date().toISOString(),
            })),
        );
      } catch (e: any) {
        console.error("Shared queue load failed:", e);
        setError(e.message || "Could not load the shared questions");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground italic">Loading questions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <p className="text-sm text-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12 md:px-10 md:py-16 min-w-0">
        {/* Header */}
        <div className="space-y-4 pb-8 border-b border-border min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground min-w-0">
            <span className="font-sans uppercase tracking-widest text-secondary break-words">
              Vizzhy Patient Companion
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl text-foreground leading-tight break-words">
            Questions for the next visit
          </h1>
          <div className="flex items-center gap-x-4 gap-y-1 text-sm text-muted-foreground flex-wrap min-w-0">
            {patientInfo?.display_name && (
              <span className="flex items-center gap-1.5 min-w-0">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="break-words min-w-0">{patientInfo.display_name}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 min-w-0">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="break-words min-w-0">Prepared {today}</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl break-words">
            These are the questions{" "}
            {patientInfo?.display_name ? patientInfo.display_name : "this patient"} would like to
            discuss at the next appointment. They were generated through reflection and
            conversation with the Vizzhy Patient Companion, a reasoning tool that helps patients
            understand their own health data.
          </p>
        </div>

        {/* Questions */}
        {questions.length === 0 ? (
          <div className="py-16 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium mb-1">No questions queued</p>
            <p className="text-xs text-muted-foreground">
              The patient hasn't queued any questions yet.
            </p>
          </div>
        ) : (
          <div className="space-y-5 pt-8 min-w-0">
            {questions.map((q, idx) => (
              <div key={q.id} className="space-y-2 min-w-0">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-xs font-sans font-semibold text-secondary mt-1 shrink-0 w-6">
                    {idx + 1}.
                  </span>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <p className="font-serif text-base sm:text-lg text-foreground italic leading-relaxed break-words">
                      "{q.question}"
                    </p>
                    {q.rationale && (
                      <p className="text-sm text-muted-foreground leading-relaxed break-words">
                        {q.rationale}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="pt-12 mt-12 border-t border-border min-w-0">
          <p className="text-xs text-muted-foreground italic leading-relaxed text-center max-w-md mx-auto break-words">
            This list was prepared by a patient using the Vizzhy Patient Companion. It is intended
            to help focus the conversation with their doctor. It is not a medical record or
            clinical recommendation.
          </p>
        </div>

        {/* Print button — only visible in browser, not when printed */}
        <div className="text-center mt-6 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center min-h-[44px] px-4 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Print this page
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharedQueue;
