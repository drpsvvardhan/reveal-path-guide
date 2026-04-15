import React, { useEffect, useMemo, useRef } from "react";
import { useClusters } from "@/hooks/useClusters";
import { Sparkles } from "lucide-react";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideVisualPanel from "@/components/layout/AsideVisualPanel";
import AsideDistributionBar from "@/components/layout/AsideDistributionBar";
import ClusterPatternCard from "@/components/clusters/ClusterPatternCard";
import { ClusterTier } from "@/types/clusters";
import {
  averageCoherence,
  totalTensions,
  tierDistribution,
  topMissingData,
} from "@/lib/clusterAggregations";

/* ── Tier ordering (matches biomarker page) ── */
const TIER_ORDER: { tier: ClusterTier; label: string }[] = [
  { tier: "robust", label: "Robust" },
  { tier: "supported", label: "Supported" },
  { tier: "developing", label: "Developing" },
  { tier: "tentative", label: "Tentative" },
  { tier: "emerging", label: "Emerging" },
];

const NoticedSection: React.FC = () => {
  const { clusters, loading, error } = useClusters();
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Aggregations ── */
  const coherence = useMemo(() => averageCoherence(clusters), [clusters]);
  const tensions = useMemo(() => totalTensions(clusters), [clusters]);
  const tiers = useMemo(() => tierDistribution(clusters), [clusters]);
  const missingTop = useMemo(() => topMissingData(clusters, 3), [clusters]);

  const lastUpdated = useMemo(() => {
    if (clusters.length === 0) return null;
    return clusters.reduce((latest, c) =>
      c.updated_at > latest ? c.updated_at : latest, clusters[0].updated_at);
  }, [clusters]);

  /* ── Cluster grouping ── */
  const clustersByTier = useMemo(() => {
    const map: Record<ClusterTier, typeof clusters> = {
      robust: [], supported: [], developing: [], tentative: [], emerging: [],
    };
    clusters.forEach((c) => map[c.confidence_tier].push(c));
    return map;
  }, [clusters]);

  const presentTiers = TIER_ORDER.filter((t) => clustersByTier[t.tier].length > 0);
  const showTierHeaders = presentTiers.length > 1;

  /* ── Deep-link scroll-and-highlight ── */
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#cluster-")) return;
    const clusterId = hash.replace("#cluster-", "");
    // Small delay to let cards render
    const timer = setTimeout(() => {
      const el = document.getElementById(`cluster-${clusterId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-secondary/60", "ring-offset-2", "ring-offset-background");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-secondary/60", "ring-offset-2", "ring-offset-background");
          window.history.replaceState(null, "", window.location.pathname);
        }, 2000);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clusters]);

  /* ── Tier distribution caption ── */
  const tierCaption = useMemo(() => {
    const parts: string[] = [];
    (["robust", "supported", "developing", "tentative", "emerging"] as ClusterTier[]).forEach((t) => {
      if (tiers[t] > 0) parts.push(`${tiers[t]} ${t}`);
    });
    return parts.length > 0 ? parts.join(", ") : "—";
  }, [tiers]);

  const hasClusters = clusters.length > 0;

  /* ── Inline dashboard strip (3 sections) ── */
  const dashboardStrip = hasClusters ? (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-border bg-card p-3">
      <div className="text-center sm:text-left">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Avg coherence
        </p>
        <p className="text-lg font-mono font-medium text-foreground">
          {coherence !== null ? `${Math.round(coherence * 100)}%` : "—"}
        </p>
        {coherence !== null && (() => {
          const lowCount = clusters.filter((c) => (c.confidence_dimensions?.coherence_strength ?? 0) < 0.5).length;
          return lowCount > 0 ? (
            <p className="text-[10px] text-muted-foreground">
              {lowCount} cluster{lowCount !== 1 ? "s" : ""} under 50%
            </p>
          ) : null;
        })()}
      </div>
      <div className="text-center sm:text-left">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Tensions held
        </p>
        <p className="text-lg font-mono font-medium text-foreground">
          {tensions.totalTensions}
        </p>
        <p className="text-[10px] text-muted-foreground">
          across {tensions.clustersWithTensions} cluster{tensions.clustersWithTensions !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="text-center sm:text-left">
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Provenance
        </p>
        <p className="text-sm font-medium text-foreground mt-1">
          {clusters.length} cluster{clusters.length !== 1 ? "s" : ""} from triangulation
        </p>
      </div>
    </div>
  ) : null;

  /* ── Aside ── */
  const aside = (
    <AsideVisualPanel
      title="Reading shape"
      subtitle={hasClusters ? `${clusters.length} cluster${clusters.length !== 1 ? "s" : ""} active` : "—"}
      visual={
        <AsideDistributionBar
          segments={[
            { label: "Robust", value: tiers.robust, color: "hsl(var(--secondary))" },
            { label: "Supported", value: tiers.supported, color: "hsl(var(--secondary))" },
            { label: "Developing", value: tiers.developing, color: "hsl(var(--secondary))" },
            { label: "Tentative", value: tiers.tentative, color: "hsl(var(--muted-foreground))" },
            { label: "Emerging", value: tiers.emerging, color: "hsl(var(--muted-foreground))" },
          ]}
        />
      }
      items={[
        { label: "Tier breakdown", value: tierCaption },
        {
          label: "Last triangulation",
          value: lastUpdated
            ? new Date(lastUpdated).toLocaleDateString()
            : "—",
        },
      ]}
      footnote={
        missingTop.length > 0
          ? `Most often missing: ${missingTop.map((m) => `${m.item} (${m.count})`).join(", ")}`
          : undefined
      }
    />
  );

  return (
    <PatientSectionLayout
      eyebrow="WHAT WE'VE NOTICED"
      title="Patterns in your data, noticed by the system"
      intro="Trends, tensions, and convergences across your biology. Each cluster below represents a reading — a set of signals the system has grouped because they point in a shared direction. Tap any cluster to see the tensions it holds."
      aside={aside}
      asideSticky
    >
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && clusters.length === 0 && (
        <div className="text-xs text-muted-foreground italic py-4">Loading your reading...</div>
      )}

      {!loading && !hasClusters && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium mb-1">No clusters yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your reading fills as your terrain grows. Upload lab reports or complete your assessment to get started.
          </p>
        </div>
      )}

      {/* Dashboard strip */}
      {dashboardStrip}

      {/* Cluster pattern cards */}
      <div className="space-y-3" ref={containerRef}>
        {presentTiers.map((tierInfo) => (
          <div key={tierInfo.tier}>
            {showTierHeaders && (
              <p className="text-subhead text-muted-foreground mb-2 mt-4 first:mt-0">
                {tierInfo.label}
              </p>
            )}
            <div className="space-y-3">
              {clustersByTier[tierInfo.tier].map((cluster) => (
                <div key={cluster.id} id={`cluster-${cluster.id}`}>
                  <ClusterPatternCard cluster={cluster} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {hasClusters && lastUpdated && (
        <div className="text-[11px] text-muted-foreground pt-4 border-t border-border mt-6">
          This reading was last updated {new Date(lastUpdated).toLocaleDateString()}.
          Tap any cluster to expand it, or tap "View the data behind this" to see the underlying biomarkers.
        </div>
      )}
    </PatientSectionLayout>
  );
};

export default NoticedSection;
