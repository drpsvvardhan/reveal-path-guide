import React, { useState, useRef, useMemo } from "react";
import { useLabUploads } from "@/context/LabUploadsContext";
import { useClusters } from "@/hooks/useClusters";
import {
  Upload, FileText, Loader2, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import CoherenceMap from "@/components/clusters/CoherenceMap";
import ClusterCard from "@/components/clusters/ClusterCard";
import { ClusterTier } from "@/types/clusters";

const TIER_ORDER: { tier: ClusterTier; label: string }[] = [
  { tier: "robust", label: "Robust" },
  { tier: "supported", label: "Supported" },
  { tier: "developing", label: "Developing" },
  { tier: "tentative", label: "Tentative" },
  { tier: "emerging", label: "Emerging" },
];

const FlagPill: React.FC<{ flag: string | null }> = ({ flag }) => {
  if (!flag || flag === "normal") return null;
  const styles: Record<string, string> = {
    low: "bg-blue-50 text-blue-700 border-blue-200",
    high: "bg-amber-50 text-amber-700 border-amber-200",
    critical: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded border ${styles[flag] || ""}`}>
      {flag}
    </span>
  );
};

const RecordsSection: React.FC = () => {
  const { uploads, observations, uploading, processing, uploadAndProcess } = useLabUploads();
  const { clusters, loading: clustersLoading, error: clustersError, refetch } = useClusters();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [unclusteredOpen, setUnclusteredOpen] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastResult(null);
    const result = await uploadAndProcess(file);
    setLastResult(result);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Collect all evidence_ids referenced by clusters
  const clusteredEvidenceIds = useMemo(() => {
    const ids = new Set<string>();
    clusters.forEach((c) => {
      c.constituent_evidence.forEach((ev) => {
        ids.add(ev.evidence_id);
      });
    });
    return ids;
  }, [clusters]);

  // Unclustered observations
  const unclusteredObs = useMemo(() => {
    return observations.filter((o) => !clusteredEvidenceIds.has(o.id));
  }, [observations, clusteredEvidenceIds]);

  // Group unclustered by panel
  const unclusteredByPanel = useMemo(() => {
    const map: Record<string, typeof unclusteredObs> = {};
    unclusteredObs.forEach((o) => {
      const panel = o.source || "Other";
      if (!map[panel]) map[panel] = [];
      map[panel].push(o);
    });
    return map;
  }, [unclusteredObs]);

  // Group clusters by tier for section headers
  const clustersByTier = useMemo(() => {
    const map: Record<ClusterTier, typeof clusters> = {
      robust: [], supported: [], developing: [], tentative: [], emerging: [],
    };
    clusters.forEach((c) => map[c.confidence_tier].push(c));
    return map;
  }, [clusters]);

  const presentTiers = TIER_ORDER.filter((t) => clustersByTier[t.tier].length > 0);
  const showTierHeaders = presentTiers.length > 1;

  // Most recent cluster update
  const lastUpdated = useMemo(() => {
    if (clusters.length === 0) return null;
    return clusters.reduce((latest, c) =>
      c.updated_at > latest ? c.updated_at : latest, clusters[0].updated_at);
  }, [clusters]);

  // Loading skeleton
  if (clustersLoading) {
    return (
      <PatientSectionLayout eyebrow="YOUR TERRAIN" title="Loading your terrain reading…">
        <div className="space-y-4">
          <div className="h-[260px] rounded-lg bg-muted/20 animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[120px] rounded-lg border border-border bg-card animate-pulse" />
          ))}
        </div>
      </PatientSectionLayout>
    );
  }

  // Error state
  if (clustersError) {
    return (
      <PatientSectionLayout eyebrow="YOUR TERRAIN" title="Your terrain">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-6 text-center space-y-3">
          <p className="text-sm text-destructive">{clustersError}</p>
          <button
            onClick={refetch}
            className="inline-flex items-center gap-1.5 text-xs text-foreground hover:text-foreground/80 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </PatientSectionLayout>
    );
  }

  // Empty state
  if (clusters.length === 0) {
    return (
      <PatientSectionLayout
        eyebrow="YOUR TERRAIN"
        title="Your terrain is still forming"
        intro="Upload a lab report or complete the CIE assessment to begin."
      >
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center space-y-3">
          <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-foreground font-medium">No clusters yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your terrain reading builds itself from lab data, intake responses, and sensor readings.
            Upload your first lab report to start.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary text-secondary-foreground px-3 py-1.5 text-xs hover:bg-secondary/90 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" /> Upload lab report
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
        </div>
      </PatientSectionLayout>
    );
  }

  return (
    <PatientSectionLayout
      eyebrow="YOUR TERRAIN"
      title="Your terrain"
      intro="Your biology organized as clusters of converging evidence. Each cluster shows what your data is telling us, how confident the reading is, and what would sharpen it."
    >
      {/* Upload bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || processing}
          className="flex items-center gap-1.5 rounded-lg bg-secondary text-secondary-foreground px-3 py-1.5 text-xs hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >
          {uploading ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading...</>)
           : processing ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading report...</>)
           : (<><Upload className="h-3.5 w-3.5" />Upload lab report</>)}
        </button>
        <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
        <span className="text-xs text-muted-foreground">PDF or image, 20 MB max</span>
      </div>

      {/* Last upload result */}
      {lastResult && !uploading && !processing && (
        <div className="text-xs">
          {lastResult.success ? (
            <div className="flex items-center gap-2 text-teal-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                Extracted {lastResult.observations_extracted} biomarker{lastResult.observations_extracted !== 1 ? "s" : ""}
                {lastResult.observations_inserted > 0 && ` · ${lastResult.observations_inserted} new`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-orange-700">
              <XCircle className="h-3.5 w-3.5" />
              <span>{lastResult.error || "Upload failed"}</span>
            </div>
          )}
        </div>
      )}

      {/* Coherence Map */}
      <div className="py-4">
        <CoherenceMap clusters={clusters} />
      </div>

      {/* Cluster Cards */}
      <div className="space-y-3">
        {presentTiers.map((tierInfo) => (
          <div key={tierInfo.tier}>
            {showTierHeaders && (
              <p className="text-[10px] font-sans font-medium uppercase tracking-[0.18em] text-muted-foreground mb-2 mt-4 first:mt-0">
                {tierInfo.label}
              </p>
            )}
            <div className="space-y-3">
              {clustersByTier[tierInfo.tier].map((cluster) => (
                <ClusterCard key={cluster.id} cluster={cluster} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Everything else accordion */}
      {unclusteredObs.length > 0 && (
        <div className="pt-6 border-t border-border mt-6">
          <button
            onClick={() => setUnclusteredOpen(!unclusteredOpen)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {unclusteredOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Everything else we're tracking ({unclusteredObs.length} markers)
          </button>
          <AnimatePresence>
            {unclusteredOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-3"
              >
                <div className="space-y-4">
                  {Object.entries(unclusteredByPanel).map(([panel, obs]) => (
                    <div key={panel}>
                      <p className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
                        {panel}
                      </p>
                      <div className="space-y-1">
                        {obs.map((o) => (
                          <div key={o.id} className="flex items-center gap-3 py-1 px-2 rounded hover:bg-muted/30 transition-colors">
                            <p className="text-xs text-foreground font-medium flex-1 min-w-0 truncate">
                              {o.canonical_name}
                            </p>
                            <FlagPill flag={o.flag} />
                            <span className="text-xs font-mono text-foreground shrink-0">
                              {o.value} {o.unit}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {o.collection_date}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Footer */}
      {lastUpdated && (
        <div className="text-[11px] text-muted-foreground pt-4 border-t border-border mt-6">
          This terrain reading was last updated {new Date(lastUpdated).toLocaleDateString()}.
          New labs, sensor data, or CIE responses will refine it automatically.
        </div>
      )}
    </PatientSectionLayout>
  );
};

export default RecordsSection;
