import { Button } from "@/components/ui/button";
import { Download, Loader2, CheckCircle2, AlertCircle, Eye, UserX } from "lucide-react";
import { useCelfExport } from "@/hooks/useCelfExport";
import { toast } from "sonner";

/**
 * CelfExportButton v1.3
 *
 * Shows a clear banner when exporting in view-as mode, and surfaces the 409
 * "subject_identity_missing" diagnostic so the user knows exactly which
 * profile field is missing on the target account.
 */
export function CelfExportButton() {
  const {
    exportBundle,
    isExporting,
    error,
    errorDiagnostic,
    lastResult,
    isViewAsActive,
    viewAsUserId,
  } = useCelfExport();

  const handleExport = async () => {
    try {
      const result = await exportBundle({ download: true });
      const viewAsSuffix = result.is_view_as_export ? " (view-as export)" : "";
      toast.success(`BioTwin bundle downloaded${viewAsSuffix}`, {
        description: `${result.counts.observations} observations · ${result.counts.feature_state} features`,
      });
    } catch (e: any) {
      toast.error("Export failed", {
        description: e?.message ?? "Unknown error",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">BioTwin data bundle</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
            Download your full data as a single file in the format the Vizzhy BioTwin
            system uses. Contains labs, body composition, FibroScan, and CIE assessment
            in canonical form.
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={isExporting}
          size="sm"
          variant={isViewAsActive ? "default" : "outline"}
          className="shrink-0"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Building bundle…
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 mr-2" /> Download bundle
            </>
          )}
        </Button>
      </div>

      {/* View-as banner */}
      {isViewAsActive && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2">
          <Eye className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <span className="font-semibold">View-as mode is active.</span>{" "}
            Clicking download will export the bundle for the patient you are viewing
            ({viewAsUserId?.slice(0, 8)}…), not your own account.
          </div>
        </div>
      )}

      {/* Identity gate diagnostic (409) */}
      {errorDiagnostic && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-destructive text-xs font-medium">
            <UserX className="w-3.5 h-3.5" />
            Bundle not generated — account is missing demographics
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>Profile found: <span className="font-mono">{String(errorDiagnostic.profile_found)}</span></li>
              <li>Name: <span className="font-mono">{errorDiagnostic.has_name ? "yes" : "missing"}</span></li>
              <li>Age: <span className="font-mono">{errorDiagnostic.has_age ? "yes" : "missing"}</span></li>
              <li>Sex: <span className="font-mono">{errorDiagnostic.has_sex ? "yes" : "missing"}</span></li>
              <li>Uploads found: <span className="font-mono">{errorDiagnostic.source_documents_found}</span></li>
              <li>Observations found: <span className="font-mono">{errorDiagnostic.observations_found}</span></li>
            </ul>
          </div>
        </div>
      )}

      {lastResult && (
        <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Last export · {new Date(lastResult.generated_at).toLocaleString()}</span>
            {lastResult.is_view_as_export && (
              <span className="ml-auto text-amber-700 dark:text-amber-400 font-medium">
                view-as
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
            <div>Observations</div><div className="text-right">{lastResult.counts.observations}</div>
            <div>Distinct features</div><div className="text-right">{lastResult.counts.feature_state}</div>
            <div>Source documents</div><div className="text-right">{lastResult.counts.source_documents}</div>
            {typeof lastResult.counts.excluded === "number" && lastResult.counts.excluded > 0 && (
              <>
                <div className="text-amber-700 dark:text-amber-400">Excluded (low confidence)</div>
                <div className="text-right text-amber-700 dark:text-amber-400">{lastResult.counts.excluded}</div>
              </>
            )}
          </div>
          {typeof lastResult.counts.excluded === "number" && lastResult.counts.excluded > 0 && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {lastResult.counts.excluded} observation{lastResult.counts.excluded === 1 ? "" : "s"} filtered out — classifier confidence below 0.80 or no canonical concept match.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {lastResult.coverage.labs && <CoverageBadge label="Labs" />}
            {lastResult.coverage.inbody && <CoverageBadge label="InBody" />}
            {lastResult.coverage.fibroscan && <CoverageBadge label="FibroScan" />}
            {lastResult.coverage.cie && <CoverageBadge label="CIE" />}
            {!lastResult.coverage.labs && !lastResult.coverage.inbody && !lastResult.coverage.fibroscan && !lastResult.coverage.cie && (
              <span className="text-amber-600 inline-flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> No data yet
              </span>
            )}
          </div>
          <div className="pt-1 font-mono text-[10px] text-muted-foreground break-all">
            sha256: {lastResult.content_sha256}
          </div>
        </div>
      )}

      {error && !errorDiagnostic && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}

function CoverageBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-600/10 text-emerald-700 px-2 py-0.5 text-[10px] font-medium">
      {label}
    </span>
  );
}
