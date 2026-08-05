import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import {
  looksLikeBiotwinReport,
  type BiotwinImportResult,
  type BiotwinReport,
  type BiotwinStatement,
} from "@/lib/biotwin/types";

// The biotwin_* tables ship in a migration that has not been applied yet, so
// they are absent from the generated database types. Reads go through this
// loosely-typed handle; the row shapes are asserted against src/lib/biotwin.
// deno-lint-ignore no-explicit-any
const db = supabase as any;

interface BioTwinContextValue {
  loading: boolean;
  /** Null when this person has no imported BioTwin report. */
  report: BiotwinReport | null;
  statements: BiotwinStatement[];
  error: string | null;
  importing: boolean;
  lastImport: BiotwinImportResult | null;
  refresh: () => Promise<void>;
  importReportFile: (file: File) => Promise<BiotwinImportResult>;
  clearLastImport: () => void;
}

const BioTwinContext = createContext<BioTwinContextValue | null>(null);

export const BioTwinProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const userId = effectiveUserId ?? user?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<BiotwinReport | null>(null);
  const [statements, setStatements] = useState<BiotwinStatement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<BiotwinImportResult | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setReport(null);
      setStatements([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: reportRow, error: reportErr } = await db
        .from("biotwin_reports")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      // A missing table simply means the feature is not provisioned yet.
      if (reportErr) {
        setReport(null);
        setStatements([]);
        return;
      }
      if (!reportRow) {
        setReport(null);
        setStatements([]);
        return;
      }
      setReport(reportRow as BiotwinReport);

      const { data: stmtRows } = await db
        .from("biotwin_statements")
        .select("*")
        .eq("report_id", reportRow.id)
        .order("ordinal", { ascending: true });
      setStatements((stmtRows ?? []) as BiotwinStatement[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the BioTwin report.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const importReportFile = useCallback(
    async (file: File): Promise<BiotwinImportResult> => {
      setImporting(true);
      setLastImport(null);
      try {
        let parsed: unknown;
        try {
          parsed = JSON.parse(await file.text());
        } catch {
          const res: BiotwinImportResult = {
            imported: false,
            refusal_code: "not_json",
            diagnostics: [
              {
                level: "error",
                code: "not_json",
                message: "That file is not valid JSON, so it cannot be read as a BioTwin report.",
              },
            ],
          };
          setLastImport(res);
          return res;
        }

        if (!looksLikeBiotwinReport(parsed)) {
          const res: BiotwinImportResult = {
            imported: false,
            refusal_code: "schema_mismatch",
            diagnostics: [
              {
                level: "error",
                code: "schema_mismatch",
                message:
                  "This is not a final BioTwin clinical evidence report. Nothing was sent for import, and no extraction was attempted.",
              },
            ],
          };
          setLastImport(res);
          return res;
        }

        const { data, error: fnError } = await supabase.functions.invoke(
          "import-biotwin-report",
          { body: { report: parsed, user_id: userId } },
        );

        if (fnError) {
          const res: BiotwinImportResult = {
            imported: false,
            refusal_code: "import_failed",
            diagnostics: [
              { level: "error", code: "import_failed", message: fnError.message },
            ],
          };
          setLastImport(res);
          return res;
        }

        const res = data as BiotwinImportResult;
        setLastImport(res);
        if (res.imported || res.idempotent) await load();
        return res;
      } finally {
        setImporting(false);
      }
    },
    [userId, load],
  );

  const value = useMemo<BioTwinContextValue>(
    () => ({
      loading,
      report,
      statements,
      error,
      importing,
      lastImport,
      refresh: load,
      importReportFile,
      clearLastImport: () => setLastImport(null),
    }),
    [loading, report, statements, error, importing, lastImport, load, importReportFile],
  );

  return <BioTwinContext.Provider value={value}>{children}</BioTwinContext.Provider>;
};

export function useBioTwin(): BioTwinContextValue {
  const ctx = useContext(BioTwinContext);
  if (!ctx) throw new Error("useBioTwin must be used within BioTwinProvider");
  return ctx;
}