import { Button } from "@/components/ui/button";
import { Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useCelfExport } from "@/hooks/useCelfExport";
import { toast } from "sonner";

/**
 * CelfExportButton
 *
 * Patient-initiated export of the full Reveal Path data bundle in CELF v0.2
 * format. The bundle is what the Vizzhy BioTwin generator consumes.
 *
 * Place this in the Records section or a "Share with clinician" panel.
 */
export function CelfExportButton() {
  const { exportBundle, isExporting, error, lastResult } = useCelfExport();

  const handleExport = async () => {
    try {
      const result = await exportBundle({ download: true });
      toast.success("BioTwin bundle downloaded", {
        description: `${result.counts.observations} observations · ${result.counts.feature_state} features · bundle ${result.content_sha256.slice(0, 12)}…`,
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
            system uses. Contains your labs, body composition scans, and CIE assessment
            in canonical form. No derived analysis is included — only the observations
            you contributed.
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={isExporting}
          size="sm"
          variant="outline"
          className="shrink-0"
        >
          {isExporting ? (
            <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Building bundle…</>
          ) : (
            <><Download className="w-3.5 h-3.5 mr-2" /> Download bundle</>
          )}
        </Button>
      </div>

      {lastResult && (
        <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Last export · {new Date(lastResult.generated_at).toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
            <div>Observations</div><div className="text-right">{lastResult.counts.observations}</div>
            <div>Distinct features</div><div className="text-right">{lastResult.counts.feature_state}</div>
            <div>Source documents</div><div className="text-right">{lastResult.counts.source_documents}</div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {lastResult.coverage.labs    && <CoverageBadge label="Labs" />}
            {lastResult.coverage.inbody  && <CoverageBadge label="InBody" />}
            {lastResult.coverage.cie     && <CoverageBadge label="CIE" />}
            {!lastResult.coverage.labs && !lastResult.coverage.inbody && !lastResult.coverage.cie && (
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

      {error && (
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
