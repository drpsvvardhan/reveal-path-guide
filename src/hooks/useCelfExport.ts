import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAccessToken } from "@/lib/session";
import { useViewAs } from "@/context/ViewAsContext";

export type CelfExportCoverage = {
  labs: boolean;
  inbody: boolean;
  cie: boolean;
  fibroscan?: boolean;
};

export type CelfExportCounts = {
  subject: number;
  source_documents: number;
  observations: number;
  feature_state: number;
  timelines?: number;
  identity_events?: number;
  excluded?: number;
};

export type CelfExportResult = {
  export_id: string;
  generated_at: string;
  content_sha256: string;
  is_view_as_export?: boolean;
  caller_user_id?: string;
  target_user_id?: string;
  coverage: CelfExportCoverage;
  counts: CelfExportCounts;
  bundle: unknown;
};

export type CelfExportErrorDiagnostic = {
  target_user_id: string;
  caller_user_id: string;
  is_view_as_export: boolean;
  profile_found: boolean;
  has_name: boolean;
  has_age: boolean;
  has_sex: boolean;
  source_documents_found: number;
  observations_found: number;
};

/**
 * useCelfExport v1.3
 *
 * - View-as aware: when admin is impersonating, passes ?user_id=<viewed>
 *   so the bundle targets the viewed patient, not the admin's own account.
 * - Surfaces 409 (subject_identity_missing) cleanly for UI display.
 */
export function useCelfExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDiagnostic, setErrorDiagnostic] = useState<CelfExportErrorDiagnostic | null>(null);
  const [lastResult, setLastResult] = useState<CelfExportResult | null>(null);

  const { effectiveUserId, isViewingAs } = useViewAs();
  const viewAsUserId = isViewingAs ? effectiveUserId : null;

  const exportBundle = useCallback(
    async (opts: { download?: boolean } = {}) => {
      setIsExporting(true);
      setError(null);
      setErrorDiagnostic(null);

      try {
        const qs = viewAsUserId ? `?user_id=${encodeURIComponent(viewAsUserId)}` : "";

        // We must use direct fetch — supabase.functions.invoke strips query strings.
        const accessToken = await getAccessToken();
        const token = accessToken;
        if (!token) throw new Error("Not authenticated");

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const endpoint = `${SUPABASE_URL}/functions/v1/export-celf-bundle${qs}`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({}),
        });

        const payload = await response.json();

        if (!response.ok) {
          const msg = payload?.message ?? payload?.error ?? `Export failed (${response.status})`;
          setError(msg);
          if (payload?.diagnostic) setErrorDiagnostic(payload.diagnostic);
          throw new Error(msg);
        }

        const data = payload as CelfExportResult;
        setLastResult(data);

        if (opts.download !== false) {
          const json = JSON.stringify(data.bundle, null, 2);
          const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
          const viewAsTag =
            data.is_view_as_export && data.target_user_id
              ? `_viewas-${data.target_user_id.slice(0, 8)}`
              : "";
          const filename = `celf_bundle_${ts}${viewAsTag}.json`;

          // iOS Safari and in-app browsers often ignore anchor downloads, and
          // very large data: URLs can open as a blank page. Prefer the native
          // share sheet when available, otherwise open a blob URL in a new tab.
          const ua = navigator.userAgent || "";
          const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
          const isInAppBrowser = /(FBAN|FBAV|Instagram|Line|Twitter|LinkedIn|WhatsApp)/i.test(ua);

          if (isIOS || isInAppBrowser) {
            const file = new File([json], filename, { type: "application/json" });
            const canNativeShare =
              typeof navigator !== "undefined" &&
              typeof navigator.share === "function" &&
              typeof navigator.canShare === "function" &&
              navigator.canShare({ files: [file] });

            if (canNativeShare) {
              await navigator.share({
                files: [file],
                title: filename,
              });
            } else {
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const win = window.open(url, "_blank", "noopener,noreferrer");
              if (!win) {
                window.location.assign(url);
              }
              setTimeout(() => URL.revokeObjectURL(url), 60_000);
            }
          } else {
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }

          supabase
            .from("celf_exports")
            .update({ status: "downloaded", downloaded_at: new Date().toISOString() })
            .eq("id", data.export_id)
            .then(
              () => {},
              (err) => console.warn("[useCelfExport] status update failed", err),
            );
        }

        return data;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setError((prev) => prev ?? msg);
        throw e;
      } finally {
        setIsExporting(false);
      }
    },
    [viewAsUserId],
  );

  return {
    exportBundle,
    isExporting,
    error,
    errorDiagnostic,
    lastResult,
    isViewAsActive: Boolean(viewAsUserId),
    viewAsUserId,
  };
}
