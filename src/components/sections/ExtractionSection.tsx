import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";
import {
  FileText, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle, Calendar, Building2, ShieldAlert, EyeOff,
} from "lucide-react";

/**
 * Extraction transparency surface.
 *
 * Per uploaded file: the values kept and reasoned with, the values read but not
 * yet recognised, the safety concerns those values raise, and what this kind of
 * document does not yield at all. Every threshold and concern comes from the
 * server (extraction-report → assessLabEvidence); this file renders only.
 */
interface ValueRowData {
  id: string;
  raw_name: string;
  canonical_name: string;
  display_name: string | null;
  value: number;
  unit: string | null;
  flag: string | null;
}

interface Concern {
  marker: string;
  severity: "raise_concern" | "maintain_hold";
  explanation: string;
  resolution: string;
}

interface FileReport {
  upload_id: string;
  filename: string;
  source_lab: string | null;
  collection_date: string | null;
  status: string;
  counts: {
    extracted: number;
    kept: number;
    recognised: number;
    unrecognised: number;
    duplicates_of_existing: number;
    outside_range: number;
  };
  recognised: ValueRowData[];
  unrecognised: ValueRowData[];
  safety_concerns: Concern[];
  not_read: string[];
  problem: string | null;
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

const ValueRow: React.FC<{ row: ValueRowData }> = ({ row }) => (
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
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const targetUserId = effectiveUserId || user?.id || null;

  const [files, setFiles] = useState<FileReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!targetUserId) { setFiles([]); setLoading(false); return; }
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase.functions.invoke("extraction-report", {
        body: effectiveUserId && effectiveUserId !== user?.id ? { user_id: effectiveUserId } : {},
      });
      if (cancelled) return;
      if (err) {
        setError("We could not load this right now. Try again in a moment.");
        setFiles([]);
      } else {
        setFiles(((data as any)?.files ?? []) as FileReport[]);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [targetUserId, effectiveUserId, user?.id]);

  const totals = useMemo(() => ({
    files: files.length,
    kept: files.reduce((n, f) => n + f.counts.kept, 0),
    recognised: files.reduce((n, f) => n + f.counts.recognised, 0),
    unrecognised: files.reduce((n, f) => n + f.counts.unrecognised, 0),
    concerns: files.reduce((n, f) => n + f.safety_concerns.length, 0),
  }), [files]);

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
        { label: "Files", value: totals.files.toString() },
        { label: "Values read", value: totals.kept.toString(), tone: "accent" },
        { label: "Used by your Twin", value: totals.recognised.toString() },
        { label: "Not yet recognised", value: totals.unrecognised.toString() },
        { label: "Concerns raised", value: totals.concerns.toString() },
      ]}
    />
  );

  return (
    <PatientSectionLayout
      eyebrow="WHAT EACH FILE GAVE US"
      title="Exactly what we read from every file you uploaded"
      intro="One card per file. Inside each: the values your Twin reasons with, the values we read but could not place, anything those values raise a concern about, and what that kind of document never gives us."
      aside={aside}
      asideSticky
    >
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading what was read…
        </div>
      )}

      {!loading && error && <p className="text-sm text-muted-foreground">{error}</p>}

      {!loading && !error && files.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No files uploaded yet. Add a report from Medical Records and it will appear here.
        </p>
      )}

      <div className="space-y-3">
        {!loading && !error && files.map((f) => {
          const isOpen = open.has(f.upload_id);
          return (
            <div key={f.upload_id} className="rounded-lg border border-border/60 bg-card">
              <button
                onClick={() => toggle(f.upload_id)}
                className="w-full flex items-start justify-between gap-3 px-3 py-3 text-left min-h-[44px]"
              >
                <span className="flex items-start gap-2 min-w-0">
                  <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground break-words">{f.filename}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                      {f.collection_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(f.collection_date).toLocaleDateString()}
                        </span>
                      )}
                      {f.source_lab && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{f.source_lab}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        {f.counts.kept > 0
                          ? <><CheckCircle2 className="h-3 w-3 text-teal-600" />{f.counts.kept} values kept</>
                          : <><AlertCircle className="h-3 w-3 text-orange-600" />nothing kept from this file</>}
                      </span>
                      {f.counts.outside_range > 0 && <span>{f.counts.outside_range} outside range</span>}
                      {f.safety_concerns.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <ShieldAlert className="h-3 w-3" />{f.safety_concerns.length} raised a concern
                        </span>
                      )}
                    </span>
                  </span>
                </span>
                {isOpen
                  ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>

              {isOpen && (
                <div className="border-t border-border/50 px-3 py-3 space-y-4">
                  {f.problem && (
                    <p className="text-xs text-orange-700">{f.problem}</p>
                  )}

                  {f.counts.kept === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {f.status === "complete"
                        ? "Every value in this file was already on record from another upload, so nothing new was added."
                        : f.status === "awaiting_identity_confirmation"
                          ? "This file is waiting for you to confirm it is yours before anything is added."
                          : "No values were kept from this file yet."}
                    </p>
                  )}

                  {f.safety_concerns.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
                      <h4 className="font-sans text-[10px] uppercase tracking-[0.08em] text-amber-800 mb-1.5">
                        What these values raise a concern about ({f.safety_concerns.length})
                      </h4>
                      <div className="space-y-2.5">
                        {f.safety_concerns.map((c, i) => (
                          <div key={`${c.marker}-${i}`} className="text-xs leading-relaxed">
                            <p className="text-foreground/90">{c.explanation}</p>
                            <p className="mt-0.5 text-muted-foreground">What could change it: {c.resolution}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        A concern can pause or narrow an action. It never clears a pause on its own, and none of this
                        is a diagnosis.
                      </p>
                    </div>
                  )}

                  {f.recognised.length > 0 && (
                    <div>
                      <h4 className="font-sans text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
                        Your Twin reasons with these ({f.recognised.length})
                      </h4>
                      <div>{f.recognised.map((r) => <ValueRow key={r.id} row={r} />)}</div>
                    </div>
                  )}

                  {f.unrecognised.length > 0 && (
                    <div>
                      <h4 className="font-sans text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
                        Read, but not yet recognised ({f.unrecognised.length})
                      </h4>
                      <p className="text-[11px] text-muted-foreground mb-1.5">
                        These were read correctly but are not yet part of what your Twin can reason with.
                      </p>
                      <div>{f.unrecognised.map((r) => <ValueRow key={r.id} row={r} />)}</div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-sans text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1.5 inline-flex items-center gap-1">
                      <EyeOff className="h-3 w-3" /> Not taken from this file at all
                    </h4>
                    <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                      {f.not_read.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      If something here matters, tell your Twin directly — it will not be picked up from the document.
                    </p>
                  </div>
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
