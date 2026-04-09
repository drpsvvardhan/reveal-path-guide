import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ClipboardList, Stethoscope, AlertCircle } from "lucide-react";

interface QueuedQuestion {
  id: string;
  question: string;
  rationale: string | null;
  priority: number;
  created_at: string;
}

const SharedQuestionList = () => {
  const { shareToken } = useParams<{ shareToken: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-questions", shareToken],
    queryFn: async () => {
      if (!shareToken) throw new Error("No share token provided");

      // 1. Look up the user by share_token
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .eq("share_token", shareToken)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error("NOT_FOUND");

      // 2. Fetch queued questions for that user
      const { data: questions, error: qError } = await supabase
        .from("patient_question_queue")
        .select("id, question, rationale, priority, created_at")
        .eq("user_id", profile.user_id)
        .eq("status", "queued")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });

      if (qError) throw qError;

      return {
        displayName: profile.display_name || "Patient",
        questions: (questions || []) as QueuedQuestion[],
      };
    },
    enabled: !!shareToken,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    const isNotFound = (error as Error).message === "NOT_FOUND";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold font-serif text-foreground">
            {isNotFound ? "Link not found" : "Something went wrong"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isNotFound
              ? "This shared question list doesn't exist or has been removed. Ask the patient for an updated link."
              : "We couldn't load this question list. Please try again in a moment."}
          </p>
        </div>
      </div>
    );
  }

  const { displayName, questions } = data!;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold font-serif text-foreground">
                Questions for my next visit
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Prepared by {displayName}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-2xl mx-auto px-4 py-6 sm:px-6 space-y-3">
        {questions.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No questions queued yet.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {questions.length} question{questions.length !== 1 && "s"} queued
            </p>

            <ol className="space-y-3">
              {questions.map((q, i) => (
                <li
                  key={q.id}
                  className="bg-card rounded-xl border border-border p-4 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground leading-relaxed font-medium">
                      "{q.question}"
                    </p>
                  </div>
                  {q.rationale && (
                    <p className="text-xs text-muted-foreground leading-relaxed ml-9">
                      {q.rationale}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}

        {/* Footer note */}
        <div className="pt-8 pb-4 text-center">
          <p className="text-xs text-muted-foreground/60">
            This list was generated with the help of a patient companion tool.
            Questions are meant to support — not replace — the conversation
            between patient and physician.
          </p>
        </div>
      </main>
    </div>
  );
};

export default SharedQuestionList;
