import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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

/**
 * AdminReviewQueue v2.0
 *
 * Updated to call resolve_observation_review_queue_item() as a single atomic
 * database function instead of doing three separate client-side writes.
 *
 * Benefits vs previous version:
 *   1. Atomicity — either all writes succeed or none. No more partial state.
 *   2. DB-enforced admin role check (function has SECURITY DEFINER and
 *      validates user_roles.role = 'admin' internally).
 *   3. Audit logging is guaranteed — happens in the same transaction.
 *   4. Client code is simpler (one RPC call instead of three).
 */
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

      const supabaseUrl = (supabase as any).supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
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

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Observation Review Queue</h1>
          <p className="text-sm text-muted-foreground">
            Observations the LLM classified with low confidence or as 'unknown'.
            Accept, correct, or reject each one. Accepting a concept not in the
            ontology queues it for inclusion in the next ontology version.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending only</SelectItem>
              <SelectItem value="all">All (incl. reviewed)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Refresh"}
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
            <ReviewQueueItem key={r.id} row={r} ontology={ontology} onUpdated={loadData} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewQueueItem({
  row, ontology, onUpdated,
}: {
  row: QueueRow;
  ontology: OntologyConcept[];
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [correctedId, setCorrectedId] = useState(row.proposed_concept_id ?? "");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const resolve = async (
    action: "accepted" | "corrected" | "rejected",
    conceptId: string | null,
  ) => {
    setProcessing(true);
    try {
      // Call the atomic Postgres function. One RPC, one transaction.
      const { data, error } = await supabase.rpc("resolve_observation_review_queue_item", {
        p_queue_item_id: row.id,
        p_action: action,
        p_concept_id: conceptId,
        p_reviewer_notes: notes || null,
      });

      if (error) {
        // Function throws specific error codes P0001-P0006. Map to user-friendly messages.
        const code = error.code ?? "";
        const friendlyMessage =
          code === "P0001" ? "You must be logged in" :
          code === "P0002" ? "Admin role required" :
          code === "P0003" ? "Invalid action" :
          code === "P0004" ? "Concept ID required for accept/correct" :
          code === "P0005" ? "Queue item not found" :
          code === "P0006" ? "This item was already resolved by another reviewer" :
          error.message;
        throw new Error(friendlyMessage);
      }

      const proposalCreated = (data as any)?.proposal_created;
      toast.success(`Marked ${action}`, {
        description: proposalCreated
          ? `New concept "${conceptId}" queued for ontology review`
          : undefined,
      });
      onUpdated();
    } catch (e: any) {
      toast.error("Resolution failed", { description: e?.message });
    } finally {
      setProcessing(false);
    }
  };

  const confidence = row.classification_confidence ?? 0;
  const confidenceColor =
    confidence >= 0.7 ? "text-amber-600" :
    confidence >= 0.4 ? "text-orange-600" : "text-red-600";

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
              <span className="text-xs text-muted-foreground">page {row.page_number}</span>
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
            <span className="font-mono">{row.proposed_concept_id ?? "(none)"}</span>
            {row.proposed_concept_label && (
              <span className="ml-2">— {row.proposed_concept_label}</span>
            )}
          </div>

          {editing && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Input
                  value={correctedId}
                  onChange={(e) => setCorrectedId(e.target.value)}
                  placeholder="canonical_concept_id (e.g. lipid_apoa1)"
                  className="font-mono text-xs h-8"
                  list={`ontology-concepts-${row.id}`}
                />
                <datalist id={`ontology-concepts-${row.id}`}>
                  {ontology.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </datalist>
              </div>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional reviewer notes"
                className="text-xs h-8"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => resolve("corrected", correctedId)}
                  disabled={processing || !correctedId}>
                  Save correction
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {!editing && row.review_status === "pending" && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="outline"
              onClick={() => resolve("accepted", row.proposed_concept_id)}
              disabled={processing || !row.proposed_concept_id}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Accept
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => { setEditing(true); setCorrectedId(row.proposed_concept_id ?? ""); }}
              disabled={processing}>
              <Edit3 className="w-3.5 h-3.5 mr-1 text-amber-600" />
              Correct
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => resolve("rejected", null)}
              disabled={processing}>
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
