import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Upload, Loader2, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { useBioTwin } from "@/context/BioTwinContext";
import type { BiotwinDiagnostic } from "@/lib/biotwin/types";

const LEVEL_STYLE: Record<
  BiotwinDiagnostic["level"],
  { border: string; text: string; Icon: React.FC<{ className?: string }> }
> = {
  error: { border: "border-destructive/40", text: "text-destructive", Icon: XCircle },
  warning: { border: "border-amber-300", text: "text-amber-700", Icon: AlertTriangle },
  info: { border: "border-border", text: "text-muted-foreground", Icon: Info },
};

/**
 * Deterministic BioTwin report import control. Never routed through generic
 * document extraction, and never rendered on public or demo routes.
 */
const BioTwinImportCard: React.FC = () => {
  const { importReportFile, importing, lastImport, report } = useBioTwin();
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await importReportFile(file);
  };

  const diagnostics = lastImport?.diagnostics ?? [];

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-base break-words">BioTwin clinical evidence report</h3>
          <p className="font-sans text-xs text-muted-foreground mt-1 max-w-prose break-words">
            A structured final report is read exactly as written. It is validated and
            imported directly — never interpreted by a language model on the way in.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={importing}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-md border border-border px-4 font-sans text-sm hover:bg-muted/50 disabled:opacity-60"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importing ? "Reading report" : report ? "Import a newer report" : "Import report"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onPick}
        />
      </div>

      {lastImport && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-3 min-w-0"
        >
          <div className="flex flex-wrap items-center gap-2 font-sans text-sm">
            {lastImport.imported ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700" />
                <span className="break-words">
                  Imported as version {lastImport.version}. {lastImport.statement_count} evidence
                  statements stored, {lastImport.witnesses_created ?? 0} measurements added to the
                  ledger.
                </span>
              </>
            ) : lastImport.idempotent ? (
              <>
                <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="break-words">
                  Already imported (version {lastImport.version}). Nothing was changed.
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                <span className="break-words">Not imported.</span>
              </>
            )}
          </div>

          {lastImport.clinician_review_required && (
            <p className="font-sans text-xs text-amber-700 break-words">
              This report is held for treating-clinician review. Its own release rules stay in
              force everywhere it is used.
            </p>
          )}

          {diagnostics.length > 0 && (
            <ul className="space-y-1.5">
              {diagnostics.map((d, i) => {
                const s = LEVEL_STYLE[d.level];
                return (
                  <li
                    key={`${d.code}-${i}`}
                    className={`flex items-start gap-2 rounded border ${s.border} bg-background px-3 py-2 min-w-0`}
                  >
                    <s.Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${s.text}`} />
                    <span className="font-sans text-xs text-foreground/90 break-words min-w-0">
                      {d.message}
                      {d.path && (
                        <span className="text-muted-foreground"> ({d.path})</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default BioTwinImportCard;