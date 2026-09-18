import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ClinicalFunctionError, invokeClinical } from "@/lib/clinicalFunctions";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface QueueRow {
  session_id: string;
  patient_user_id: string;
  patient_name: string | null;
  revision: number;
  state_hash: string;
  phase: string;
  safety: string;
  authorization_expires_at: string;
  safety_witness_id: string | null;
  safety_prompt: string | null;
  safety_answer: string | null;
  safety_answered_at: string | null;
  updated_at: string;
}

interface SafetyHistoryRow {
  witness_id: string;
  prompt: string;
  answer: string | null;
  submitted_at: string;
  supersedes: string | null;
}

interface Detail {
  session: {
    session_id: string;
    patient_user_id: string;
    revision: number;
    state_hash: string;
    phase: string;
    safety: string;
    started_at: string;
    updated_at: string;
    answered_count: number;
    safety_history: SafetyHistoryRow[];
  };
  reviews: {
    id: string;
    disposition: string;
    encounter_at: string;
    rationale: string;
    created_at: string;
  }[];
}

const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const ClinicianSafetyReview: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  const [encounterAt, setEncounterAt] = useState(localNow);
  const [assessment, setAssessment] = useState("");
  const [rationale, setRationale] = useState("");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const retry = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const loadVersion = useRef(0);

  const call = <T,>(body: Record<string, unknown>) => invokeClinical<T>("cie33-safety-review", body);

  const loadQueue = async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError(null);
    setSelected(null);
    setDetail(null);
    try {
      const data = await call<{ sessions: QueueRow[] }>({ action: "queue" });
      if (version !== loadVersion.current) return;
      setQueue(data.sessions ?? []);
      setUnauthorized(null);
    } catch (e: any) {
      if (version !== loadVersion.current) return;
      setQueue([]);
      const message = String(e?.message ?? e);
      if (e instanceof ClinicalFunctionError && e.status === 403 || /authoriz|forbidden/i.test(message)) setUnauthorized(message);
      else setLoadError(`Could not load the review queue: ${message}`);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };

  useEffect(() => {
    setQueue([]);
    setUnauthorized(null);
    retry.current = null;
    void loadQueue();
    return () => { loadVersion.current++; };
  }, [user?.id]);

  const open = async (row: QueueRow) => {
    const version = ++loadVersion.current;
    setSelected(row);
    setDetail(null);
    setAssessment("");
    setRationale("");
    setInstructions("");
    setEncounterAt(localNow());
    retry.current = null;
    try {
      const data = await call<Detail>({ action: "detail", session_id: row.session_id });
      if (version === loadVersion.current) setDetail(data);
    } catch (e: any) {
      if (version !== loadVersion.current) return;
      setSelected(null);
      toast.error(`Could not open this intake: ${e?.message ?? e}`);
      if (e instanceof ClinicalFunctionError && e.status === 403) await loadQueue();
    }
  };

  const submit = async (disposition: "keep_hold" | "permit_resumption") => {
    if (!selected || !detail || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const body = {
        action: "submit",
        session_id: selected.session_id,
        patient_user_id: selected.patient_user_id,
        disposition,
        encounter_at: new Date(encounterAt).toISOString(),
        assessment_note: assessment.trim(),
        rationale: rationale.trim(),
        patient_instructions: instructions.trim(),
        source_witness_id: detail.session.safety_history.at(-1)?.witness_id,
        expected_revision: detail.session.revision,
        expected_hash: detail.session.state_hash,
      };
      const fingerprint = JSON.stringify(body);
      if (retry.current?.fingerprint !== fingerprint) {
        retry.current = { fingerprint, requestId: crypto.randomUUID() };
      }
      const data = await call<{ note?: string }>({ ...body, request_id: retry.current.requestId });
      retry.current = null;
      toast.success(data.note ?? "Review recorded.");
      setSelected(null);
      setDetail(null);
      await loadQueue();
    } catch (e: any) {
      toast.error(`${e?.message ?? e}`);
      if (e instanceof ClinicalFunctionError && (e.status === 403 || e.status === 409) || /reload|changed/i.test(String(e?.message ?? ""))) await loadQueue();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const documented =
    assessment.trim().length >= 20 &&
    rationale.trim().length >= 20 &&
    instructions.trim().length >= 10 &&
    !!encounterAt;

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-[1360px] space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="font-serif text-2xl">Paused intakes for review</h1>
          <Button variant="ghost" size="sm" className="ml-auto min-h-11" disabled={loading || submitting} onClick={loadQueue}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading
          </div>
        ) : loadError ? (
          <Card role="alert" className="space-y-3 p-6">
            <p>{loadError}</p>
            <Button variant="outline" onClick={loadQueue}>Try again</Button>
          </Card>
        ) : unauthorized ? (
          <Card className="space-y-3 p-6">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <h2 className="font-serif text-lg">You are not authorized to review anyone yet</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{unauthorized}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              An administrator must authorize you for one named patient at a time, after checking your credentials.
              Being an administrator is not enough on its own.
            </p>
          </Card>
        ) : selected && detail ? (
          <Card className="space-y-6 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg">
                {selected.patient_name ?? "This patient"}
              </h2>
              <Badge variant="secondary">Paused at answer {detail.session.answered_count}</Badge>
              <Badge variant="outline">
                {detail.session.safety === "handoff_required" ? "Paused for review" : "Waiting on the patient"}
              </Badge>
              <Button variant="ghost" size="sm" className="ml-auto min-h-11" disabled={submitting} onClick={() => { loadVersion.current++; setSelected(null); setDetail(null); }}>
                Close
              </Button>
            </div>

            <div className="space-y-3">
              <h3 className="font-sans text-xs uppercase tracking-wide text-muted-foreground">
                What the patient was asked, and answered
              </h3>
              {detail.session.safety_history.map((h, i) => (
                <div key={h.witness_id} className="rounded-md border border-border p-4 text-sm">
                  <p className="leading-relaxed">{h.prompt}</p>
                  <p className="mt-2 font-medium">Answer: {h.answer ?? "Not answered"}</p>
                  <p className="mt-1 text-muted-foreground">
                    {new Date(h.submitted_at).toLocaleString()}
                    {h.supersedes ? " · follows an earlier answer" : ""}
                    {i === detail.session.safety_history.length - 1 ? " · current" : ""}
                  </p>
                </div>
              ))}
            </div>

            {detail.reviews.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-sans text-xs uppercase tracking-wide text-muted-foreground">
                  Earlier reviews
                </h3>
                {detail.reviews.map((r) => (
                  <p key={r.id} className="text-sm text-muted-foreground">
                    {new Date(r.encounter_at).toLocaleString()} — {r.disposition.replace(/_/g, " ")}
                  </p>
                ))}
              </div>
            )}

            {detail.session.safety === "handoff_required" ? (
              <div className="space-y-4">
                <h3 className="font-serif text-base">Your assessment</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="encounter-time">When you assessed or spoke with this patient</Label>
                    <Input
                      id="encounter-time"
                      type="datetime-local"
                      value={encounterAt}
                      onChange={(e) => setEncounterAt(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assessment-note">What you assessed and how you contacted them</Label>
                  <Textarea id="assessment-note" rows={3} disabled={submitting} value={assessment} onChange={(e) => setAssessment(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-rationale">Your rationale for this decision</Label>
                  <Textarea id="review-rationale" rows={3} disabled={submitting} value={rationale} onChange={(e) => setRationale(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patient-instructions">Follow-up and what the patient should do</Label>
                  <Textarea id="patient-instructions" rows={3} disabled={submitting} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Permitting the questions to continue is permission to resume the questionnaire only.
                  It is not a finding that there is no risk, and it is not treatment approval.
                  The patient's original answer is kept, and they will be asked the safety question again themselves —
                  you cannot answer it for them.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    disabled={submitting || !documented}
                    onClick={() => submit("keep_hold")}
                  >
                    Keep the intake paused
                  </Button>
                  <Button
                    className="min-h-11"
                    disabled={submitting || !documented}
                    onClick={() => submit("permit_resumption")}
                  >
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Permit the patient to continue
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                This intake has already been permitted to continue. It is waiting for the patient to answer the
                safety question again themselves. Nothing further is needed from you unless they answer yes again.
              </p>
            )}
          </Card>
        ) : selected ? (
          <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading this intake</p>
        ) : queue.length === 0 ? (
          <Card className="space-y-2 p-6">
            <h2 className="font-serif text-lg">Nothing is waiting for you</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              None of the patients you are authorized for has a paused intake right now.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {queue.map((row) => (
              <li key={row.session_id}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{row.patient_name ?? "Patient"}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {row.safety_answer ? `Answered: ${row.safety_answer}` : "Not answered"}
                      {row.safety_answered_at ? ` · ${new Date(row.safety_answered_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <Badge variant={row.safety === "handoff_required" ? "default" : "secondary"}>
                    {row.safety === "handoff_required" ? "Needs review" : "Waiting on patient"}
                  </Badge>
                  <Button className="ml-auto min-h-11" size="sm" onClick={() => open(row)}>
                    Open
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ClinicianSafetyReview;
