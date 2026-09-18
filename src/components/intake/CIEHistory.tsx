import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useViewAs } from "@/context/ViewAsContext";
import { Button } from "@/components/ui/button";
import CIE33Review from "./CIE33Review";
import type { IntakeState } from "@shared/cie33/engine";

type Assessment = {
  id: string;
  version: number;
  instrument_version: string;
  status: string;
  created_at: string;
};
type LegacyResponse = {
  question_id: string;
  raw_response: string;
  layer: number;
};
type Gate = { gate_name: string; score: number; traffic_light: string };
type Domain = {
  domain_id: string;
  axis: string;
  layer1_score: number;
  layer2_score: number | null;
  final_score: number;
};
export default function CIEHistory() {
  const { effectiveUserId } = useViewAs();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selected, setSelected] = useState("");
  const [responses, setResponses] = useState<LegacyResponse[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [snapshot, setSnapshot] = useState<IntakeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setAssessments([]);
    setSelected("");
    if (effectiveUserId)
      void supabase
        .from("cie_assessments")
        .select("id, version, instrument_version, status, created_at")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (!cancelled) {
            setAssessments(data ?? []);
            if (error) setError("Assessment history could not be loaded.");
          }
        });
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId]);
  useEffect(() => {
    let cancelled = false;
    setResponses([]);
    setGates([]);
    setDomains([]);
    setSnapshot(null);
    setError(null);
    const assessment = assessments.find((a) => a.id === selected);
    if (!assessment) return;
    setLoading(true);
    void (async () => {
      try {
        if (assessment.instrument_version === "3.3.0") {
          const { data, error } = await supabase.functions.invoke("cie-v33", {
            body: {
              action: "read",
              user_id: effectiveUserId,
              session_id: selected,
            },
          });
          if (error) throw error;
          if (!cancelled) setSnapshot(data.state);
        } else {
          const [answers, scores, domainScores] = await Promise.all([
            supabase
              .from("cie_responses")
              .select("question_id, raw_response, layer")
              .eq("assessment_id", selected)
              .order("created_at"),
            supabase
              .from("cie_gate_scores")
              .select("gate_name, score, traffic_light")
              .eq("assessment_id", selected),
            supabase
              .from("cie_domain_scores")
              .select(
                "domain_id, axis, layer1_score, layer2_score, final_score",
              )
              .eq("assessment_id", selected)
              .order("domain_id"),
          ]);
          if (answers.error || scores.error || domainScores.error)
            throw answers.error || scores.error || domainScores.error;
          if (!cancelled) {
            setResponses(answers.data ?? []);
            setGates(scores.data ?? []);
            setDomains(domainScores.data ?? []);
          }
        }
      } catch {
        if (!cancelled) setError("This assessment could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, assessments, effectiveUserId]);
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-xl">Assessment history</h2>
      <p className="text-sm text-muted-foreground">
        Previous answers retain their original instrument version. CIE 2.2
        scores are historical and are not converted into CIE 3.3 evidence.
      </p>
      <label className="block text-sm space-y-2">
        <span>Choose an assessment</span>
        <select
          className="block w-full rounded-md border bg-background p-3"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select an assessment</option>
          {assessments.map((a) => (
            <option key={a.id} value={a.id}>
              CIE {a.instrument_version} · Assessment {a.version} ·{" "}
              {new Date(a.created_at).toLocaleDateString()} · {a.status}
            </option>
          ))}
        </select>
      </label>
      {loading && <p>Loading saved answers…</p>}
      {error && <p role="alert">{error}</p>}
      {snapshot && <CIE33Review state={snapshot} />}
      {gates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left mb-2">
              Historical CIE 2.2 gate scores
            </caption>
            <thead>
              <tr>
                <th className="text-left">Gate</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {gates.map((g) => (
                <tr key={g.gate_name}>
                  <td>{g.gate_name}</td>
                  <td className="text-center">{g.score}</td>
                  <td className="text-center">{g.traffic_light}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {domains.length > 0 && (
        <details>
          <summary className="cursor-pointer">
            Historical CIE 2.2 domain scores
          </summary>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Domain</th>
                  <th>Layer 1</th>
                  <th>Layer 2</th>
                  <th>Final</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => (
                  <tr key={d.domain_id}>
                    <td>
                      {d.domain_id} · Axis {d.axis}
                    </td>
                    <td className="text-center">{d.layer1_score}</td>
                    <td className="text-center">
                      {d.layer2_score ?? "Not recorded"}
                    </td>
                    <td className="text-center">{d.final_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {responses.length > 0 && (
        <details>
          <summary className="cursor-pointer">
            Original CIE 2.2 responses ({responses.length})
          </summary>
          <div className="space-y-3 mt-3">
            {responses.map((r, i) => (
              <div
                key={`${r.question_id}-${i}`}
                className="rounded-lg border p-3"
              >
                <p className="text-xs text-muted-foreground">
                  {r.question_id} · Layer {r.layer}
                </p>
                <p className="whitespace-pre-wrap">{r.raw_response}</p>
              </div>
            ))}
          </div>
        </details>
      )}
      {selected && (
        <Button variant="ghost" onClick={() => setSelected("")}>
          Close history
        </Button>
      )}
    </section>
  );
}
