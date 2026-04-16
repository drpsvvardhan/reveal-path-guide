import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CelfExportCoverage = {
  labs: boolean;
  inbody: boolean;
  cie: boolean;
};

export type CelfExportCounts = {
  subject: number;
  source_documents: number;
  observations: number;
  feature_state: number;
};

export type CelfExportResult = {
  export_id: string;
  generated_at: string;
  content_sha256: string;
  coverage: CelfExportCoverage;
  counts: CelfExportCounts;
  bundle: unknown;
};

/**
 * useCelfExport
 *
 * Triggers the export-celf-bundle edge function, downloads the resulting JSON
 * to the user's device, and marks the audit row as 'downloaded'.
 *
 * The bundle shape matches CELF v0.2 (Russell Shapiro ingestion format):
 *   { meta, subject[], source_documents[], observations[], feature_state[] }
 *
 * Use the returned `lastResult` to render coverage/counts in the UI.
 */
export function useCelfExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CelfExportResult | null>(null);

  const exportBundle = useCallback(async (opts: { download?: boolean } = {}) => {
    setIsExporting(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<CelfExportResult>(
        "export-celf-bundle",
        { body: {} }
      );

      if (invokeError) throw invokeError;
      if (!data) throw new Error("Empty response from export-celf-bundle");

      setLastResult(data);

      if (opts.download !== false) {
        // Download JSON
        const blob = new Blob([JSON.stringify(data.bundle, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        a.download = `celf_bundle_${ts}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Mark audit row as downloaded (fire-and-forget)
        supabase
          .from("celf_exports")
          .update({ status: "downloaded", downloaded_at: new Date().toISOString() })
          .eq("id", data.export_id)
          .then(() => {}, (err) => console.warn("[useCelfExport] status update failed", err));
      }

      return data;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      throw e;
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    exportBundle,
    isExporting,
    error,
    lastResult,
  };
}
