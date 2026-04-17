import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, Edit3, Loader2 } from "lucide-react";
import { toast } from "sonner";

type QueueRow = {
  id: string;
  observation_id: string;
  user_id: string;
  upload_id: string | null;
  queued_at: string;
  raw_name: string;
  raw_value: number | null;
  raw_unit: string | null;
  proposed_concept_id: string | null;
  proposed_concept_label: string | null;
  classification_confidence: number | null;
  reject_reason: string | null;
  page_number: number | null;
  review_status: "pending" | "accepted" | "corrected" | "rejected";
};

type OntologyConcept = {
  id: string;
  label: string;
  unit: string | null;
  biomarker_class: string | null;
};

export default function AdminReviewQueue() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [ontology, setOntology] = useState<OntologyConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("observation_review_queue")
        .select("*")
        .order("queued_at", { ascending: false })
        .limit(100);
      if (filter === "pending") query = query.eq("review_status", "pending");
      const { data, error } = await query;
      if (error) throw error;
      setRows((data ?? []) as QueueRow[]);

      const supabaseUrl =
        (supabase as any).supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
      const ontologyRes = await fetch(
        `${supabaseUrl}/storage/v1/object/public/ontology/biomarker_ontology.json`,
      );
      if (ontologyRes.ok) {
        const o = await ontologyRes.json();
        setOntology(o.concepts as OntologyConcept[]);
      }
    } catch (e: any) {
      toast.error("Failed to load queue", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Observation Review Queue</h1>
          <p className="text-sm text-muted-foreground">
            Observations the LLM classified with low confidence or as 'unknown'.
            Accept, correct, or reject each one. Accepting a new concept queues
            it for ontology inclusion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending only</SelectItem>
              <SelectItem value="all">All (incl. reviewed)</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading queue…
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <div className="font-medium">Queue is clean</div>
          <div className="text-xs mt-1">No observations awaiting review.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <ReviewQueueItem
              key={r.id}
              row={r}
              ontology={ontology}
              onUpdated={loadData}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewQueueItem({
  row,
  ontology,
  onUpdated,
}: {
  row: QueueRow;
  ontology: OntologyConcept[];
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [correctedId, setCorrectedId] = useState(row.proposed_concept_id ?? "");
  const [processing, setProcessing] = useState(false);

  const resolve = async (
    reviewStatus: "accepted" | "corrected" | "rejected",
    reviewerConceptId: string | null,
  ) => {
    setProcessing(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const reviewerId = u.user?.id;
      if (!reviewerId) throw new Error("Not authenticated");

      const { error: qErr } = await supabase
        .from("observation_review_queue")
        .update({
          review_status: reviewStatus,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          reviewer_concept_id: reviewerConceptId,
        })
        .eq("id", row.id);
      if (qErr) throw qErr;

      if (reviewStatus !== "rejected" && reviewerConceptId) {
        const concept = ontology.find((c) => c.id === reviewerConceptId);
        const canonicalValue = row.raw_value;
        const { error: oErr } = await supabase
          .from("patient_lab_observations")
          .update({
            canonical_concept_id: reviewerConceptId,
            canonical_unit: concept?.unit ?? null,
            canonical_value: canonicalValue,
            biomarker_class: concept?.biomarker_class ?? null,
            classification_confidence: 1.0,
            classification_method: "human_reviewed",
          })
          .eq("id", row.observation_id);
        if (oErr) throw oErr;

        const inOntology = ontology.some((c) => c.id === reviewerConceptId);
        if (!inOntology) {
          await supabase.from("ontology_concept_proposals").upsert(
            {
              proposed_concept_id: reviewerConceptId,
              proposed_label: reviewerConceptId.replace(/_/g, " "),
              first_seen_observation_id: row.observation_id,
              example_raw_names: [row.raw_name],
              proposed_by: reviewerId,
            },
            { onConflict: "proposed_concept_id" },
          );
        }
      }

      toast.success(`Marked ${reviewStatus}`);
      onUpdated();
    } catch (e: any) {
      toast.error("Update failed", { description: e?.message });
    } finally {
      setProcessing(false);
    }
  };

  const confidence = row.classification_confidence ?? 0;
  const confidenceColor =
    confidence >= 0.7
      ? "text-amber-600"
      : confidence >= 0.4
      ? "text-orange-600"
      : "text-red-600";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm">{row.raw_name}</span>
            <Badge variant="outline" className="text-xs">
              {row.raw_value ?? "—"} {row.raw_unit ?? ""}
            </Badge>
            {row.page_number != null && (
              <span className="text-xs text-muted-foreground">
                page {row.page_number}
              </span>
            )}
            <span className={`text-xs font-medium ${confidenceColor}`}>
              confidence {(confidence * 100).toFixed(0)}%
            </span>
            {row.reject_reason && (
              <Badge variant="secondary" className="text-xs">
                {row.reject_reason.replace(/_/g, " ")}
              </Badge>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            <span>LLM proposed: </span>
            <span className="font-mono">
              {row.proposed_concept_id ?? "(none)"}
            </span>
            {row.proposed_concept_label && (
              <span className="ml-2">— {row.proposed_concept_label}</span>
            )}
          </div>

          {editing && (
            <div className="flex items-center gap-2 pt-1">
              <Input
                value={correctedId}
                onChange={(e) => setCorrectedId(e.target.value)}
                placeholder="canonical_concept_id (e.g. lipid_apoa1)"
                className="font-mono text-xs h-8"
                list={`ontology-concepts-${row.id}`}
              />
              <datalist id={`ontology-concepts-${row.id}`}>
                {ontology.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </datalist>
              <Button
                size="sm"
                onClick={() => resolve("corrected", correctedId)}
                disabled={processing || !correctedId}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {!editing && row.review_status === "pending" && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolve("accepted", row.proposed_concept_id)}
              disabled={processing || !row.proposed_concept_id}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(true);
                setCorrectedId(row.proposed_concept_id ?? "");
              }}
              disabled={processing}
            >
              <Edit3 className="w-3.5 h-3.5 mr-1 text-amber-600" />
              Correct
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolve("rejected", null)}
              disabled={processing}
            >
              <XCircle className="w-3.5 h-3.5 mr-1 text-red-600" />
              Reject
            </Button>
          </div>
        )}

        {row.review_status !== "pending" && (
          <Badge variant="secondary" className="shrink-0">
            {row.review_status}
          </Badge>
        )}
      </div>
    </Card>
  );
}
