import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";
import {
  FileText, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle, Calendar, Building2,
} from "lucide-react";

/**
 * Extraction transparency surface.
 *
 * For every uploaded file this shows exactly which values were read, which of
 * them the Twin can reason with (they carry a canonical concept binding), and
 * which were read but not yet recognised — the honest "what is being missed"
 * list. No thresholds, verdicts or interpretation are produced here.
 */
interface ExtractedRow {
  id: string;
  upload_id: string;
  raw_name: string;
  canonical_name: string;
  display_name: string | null;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  flag: string | null;
  collection_date: string;
  canonical_concept_id: string | null;
}

const FlagPill: React.FC<{ flag: string | null }> = ({ flag }) => {
  if (!flag || flag === "normal") return null;
  const styles: Record<string, string> = {
    low: "bg-blue-50 text-blue-700 border-blue-200",
    high: "bg-amber-50 text-amber-700 border-amber-200",
    critical: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`shrink-0 text-[9px] uppercase font-sans font-medium px-1.5 py-0.5 rounded border ${styles[flag] ?? ""}`}>
      {flag}
    </span>
  );
};

const ValueRow: React.FC<{ row: ExtractedRow }> = ({ row }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
    <span className="text-xs text-foreground/90 break-words min-w-0">
      {row.display_name || row.canonical_name}
    </span>
    <span className="flex items-center gap-1.5 shrink-0">
      <FlagPill flag={row.flag} />
      <span className="font-sans text-xs tabular-nums text-foreground">
        {row.value}{row.unit ? ` ${row.unit}` : ""}
      </span>
    </span>
  </div>
);

const ExtractionSection: React.FC = () => {
  const { uploads, loading: uploadsLoading } = useLabUploads();
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const targetUserId = effectiveUserId || user?.id || null;

  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!targetUserId) { setRows([]); setLoading(false); return; }
      setLoading(true);
      // Paged read: a full lab history exceeds the single-request row cap, and
      // a truncated read would understate what was actually extracted.
      const page = 1000;
      const all: ExtractedRow[] = [];
      for (let from = 0; ; from += page) {
        const { data, error } = await supabase
          .from("patient_lab_observations")
          .select("id, upload_id, raw_name, canonical_name, display_name, value, unit, ref_low, ref_high, flag, collection_date, canonical_concept_id")
          .eq("user_id", targetUserId)
          .order("collection_date", { ascending: false })
          .range(from, from + page - 1);
        if (error) break;
        const batch = (data ?? []) as ExtractedRow[];
        all.push(...batch);
        if (batch.length < page) break;
      }
      if (!cancelled) {
        setRows(all);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [targetUserId]);

  /**
   * One marker can exist twice for the same draw: an older unbound row and a
   * canonicalized one. Collapse them so the page reports markers, not rows,
   * and prefer the bound row so "not yet recognised" stays truthful.
   */
  const byUpload = useMemo(() => {
    const map = new Map<string, Map<string, ExtractedRow>>();
    for (const r of rows) {
      const perUpload = map.get(r.upload_id) ?? new Map<string, ExtractedRow>();
      const key = `${r.canonical_name}|${r.collection_date}`;
      const existing = perUpload.get(key);
      if (!existing || (!existing.canonical_concept_id && r.canonical_concept_id)) {
        perUpload.set(key, r);
      }
      map.set(r.upload_id, perUpload);
    }
    const out = new Map<string, ExtractedRow[]>();
    for (const [uploadId, markers] of map) out.set(uploadId, [...markers.values()]);
    return out;
  }, [rows]);

  const markers = useMemo(() => [...byUpload.values()].flat(), [byUpload]);
  const recognisedCount = markers.filter((r) => r.canonical_concept_id).length;
  const unrecognisedCount = markers.length - recognisedCount;

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const aside = (
    <AsideInfoPanel
      title="What has been read"
      items={[
        { label: "Files", value: uploads.length.toString() },
        { label: "Values read", value: markers.length.toString(), tone: "accent" },
        { label: "Used by your Twin", value: recognisedCount.toString() },
        { label: "Not yet recognised", value: unrecognisedCount.toString() },
      ]}
    />
  );

  const busy = loading || uploadsLoading;

  return (
    <PatientSectionLayout
      eyebrow="WHAT EACH FILE GAVE US"
      title="Exactly what we read from every file you uploaded"
      intro="One card per file. Inside each: the values your Twin can reason with, and the values we read but could not yet place. Anything missing from both lists was not readable in that file."
      aside={aside}
      asideSticky
    >
      {busy && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading what was read…
        </div>
      )}

      {!busy && uploads.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No files uploaded yet. Add a report from Medical Records and it will appear here.
        </p>
      )}

      <div className="space-y-3">
        {!busy && uploads.map((u: any) => {
          const list = byUpload.get(u.id) ?? [];
          const recognised = list.filter((r) => r.canonical_concept_id);
          const unrecognised = list.filter((r) => !r.canonical_concept_id);
          const abnormal = list.filter((r) => r.flag && r.flag !== "normal");
          const isOpen = open.has(u.id);
          return (
            <div key={u.id} className="rounded-lg border border-border/60 bg-card">
              <button
                onClick={() => toggle(u.id)}
                className="w-full flex items-start justify-between gap-3 px-3 py-3 text-left min-h-[44px]"
              >
                <span className="flex items-start gap-2 min-w-0">
                  <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground break-words">
                      {u.original_filename}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                      {u.collection_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(u.collection_date).toLocaleDateString()}
                        </span>
                      )}
                      {u.source_lab && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{u.source_lab}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        {list.length > 0
                          ? <><CheckCircle2 className="h-3 w-3 text-teal-600" />{list.length} values kept</>
                          : <><AlertCircle className="h-3 w-3 text-orange-600" />nothing kept from this file</>}
                      </span>
                      {abnormal.length > 0 && <span>{abnormal.length} outside range</span>}
                    </span>
                  </span>
                </span>
                {isOpen
                  ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>

              {isOpen && (
                <div className="border-t border-border/50 px-3 py-3 space-y-4">
                  {list.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {u.status === "complete"
                        ? "Every value in this file was already on record from another upload, so nothing new was added."
                        : u.status === "awaiting_identity_confirmation"
                          ? "This file is waiting for you to confirm it is yours before anything is added."
                          : "No values were kept from this file yet."}
                    </p>
                  )}

                  {recognised.length > 0 && (
                    <div>
                      <h4 className="font-sans text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
                        Your Twin reasons with these ({recognised.length})
                      </h4>
                      <div>{recognised.map((r) => <ValueRow key={r.id} row={r} />)}</div>
                    </div>
                  )}

                  {unrecognised.length > 0 && (
                    <div>
                      <h4 className="font-sans text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
                        Read, but not yet recognised ({unrecognised.length})
                      </h4>
                      <p className="text-[11px] text-muted-foreground mb-1.5">
                        These were read correctly but are not yet part of what your Twin can reason with.
                      </p>
                      <div>{unrecognised.map((r) => <ValueRow key={r.id} row={r} />)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PatientSectionLayout>
  );
};

export default ExtractionSection;
