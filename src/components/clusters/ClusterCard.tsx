import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClusterRow, ClusterEvidenceItem } from "@/types/clusters";
import ClusterTierBadge from "./ClusterTierBadge";
import { formatClusterKind } from "@/lib/formatClusterKind";

/** Count distinct layer_types */
const countLayers = (evidence: ClusterEvidenceItem[]): number =>
  new Set(evidence.map((e) => e.layer_type)).size;

/** Sort: convergent first, divergent second, neutral last */
const sortedEvidence = (evidence: ClusterEvidenceItem[]): ClusterEvidenceItem[] =>
  [...evidence].sort((a, b) => {
    const order = { convergent: 0, divergent: 1, neutral: 2 };
    return (order[a.direction] ?? 2) - (order[b.direction] ?? 2);
  });

interface ClusterCardProps {
  cluster: ClusterRow;
}

const ClusterCard: React.FC<ClusterCardProps> = ({ cluster }) => {
  const [depth, setDepth] = useState<1 | 2 | 3>(1);

  const evidenceCount = cluster.constituent_evidence.length;
  const layerCount = countLayers(cluster.constituent_evidence);
  const tensionCount = cluster.tensions_held.length;

  const handleCardClick = () => {
    if (depth === 1) setDepth(2);
    else if (depth === 2) setDepth(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm"
    >
      {/* DEPTH 1 — always visible */}
      <div
        className="p-4 cursor-pointer select-none"
        onClick={handleCardClick}
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-subhead text-foreground leading-snug">
            {formatClusterKind(cluster.cluster_kind)}
          </h3>
          <ClusterTierBadge tier={cluster.confidence_tier} className="shrink-0 mt-0.5" />
        </div>

        {/* Claim */}
        <p className="text-sm text-foreground/90 leading-relaxed mt-2">
          {cluster.claim}
        </p>

        {/* Footer metadata */}
        <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
          <span>{evidenceCount} signal{evidenceCount !== 1 ? "s" : ""}</span>
          <span className="text-border">·</span>
          <span>from {layerCount} layer{layerCount !== 1 ? "s" : ""}</span>
          {tensionCount > 0 && (
            <>
              <span className="text-border">·</span>
              <span>with {tensionCount} tension{tensionCount !== 1 ? "s" : ""}</span>
            </>
          )}
        </div>
      </div>

      {/* DEPTH 2 — expanded */}
      <AnimatePresence>
        {depth >= 2 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border bg-muted/10 px-4 py-4 space-y-4">
              {/* Constituent evidence */}
              <div>
                <p className="text-subhead text-muted-foreground mb-2">
                  What this is built from
                </p>
                <div className="space-y-1.5">
                  {sortedEvidence(cluster.constituent_evidence).map((ev, i) => (
                    <div key={i} className="flex items-start gap-2 py-1">
                      <span
                        className={`mt-1.5 block shrink-0 rounded-full ${
                          ev.direction === "convergent"
                            ? "h-[7px] w-[7px] bg-secondary"
                            : ev.direction === "divergent"
                            ? "h-[7px] w-[7px] border border-muted-foreground bg-transparent"
                            : "h-[5px] w-[5px] bg-muted-foreground/40"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground leading-relaxed">
                          {ev.value_summary}
                        </p>
                        {ev.time_point && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(ev.time_point).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tensions held */}
              {cluster.tensions_held.length > 0 && (
                <div className="border-l-2 border-accent/40 pl-3">
                  <p className="text-subhead text-muted-foreground mb-2">
                    Tensions held in this cluster
                  </p>
                  <div className="space-y-2">
                    {cluster.tensions_held.map((t, i) => (
                      <p key={i} className="text-xs text-foreground/85 leading-relaxed">
                        {t.description}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing evidence */}
              {cluster.missing_evidence.length > 0 && (
                <div>
                  <p className="text-subhead text-muted-foreground mb-2">
                    What would sharpen this
                  </p>
                  <div className="space-y-2">
                    {cluster.missing_evidence.map((m, i) => (
                      <div key={i}>
                        <p className="text-xs font-medium text-foreground">{m.item}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {m.why_it_would_sharpen}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit trail toggle */}
              {depth === 2 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDepth(3); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Show audit trail
                </button>
              )}

              {/* DEPTH 3 — audit trail */}
              <AnimatePresence>
                {depth === 3 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-md bg-muted/30 border border-border/40 p-3 space-y-3">
                      <p className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
                        Confidence audit
                      </p>

                      {/* Five dimensions — null/undefined renders as
                          "unmeasured" rather than silently defaulting to a
                          number (Trajectory Correction v2 §1.2 Item F). */}
                      <div className="space-y-1.5">
                        {(() => {
                          const cd = cluster.confidence_dimensions;
                          const completeness =
                            cd?.missing_data_penalty == null
                              ? null
                              : 1 - cd.missing_data_penalty;
                          const dims: Array<{ label: string; value: number | null }> = [
                            { label: "Breadth", value: cd?.breadth ?? null },
                            { label: "Depth", value: cd?.depth ?? null },
                            { label: "Time", value: cd?.time ?? null },
                            { label: "Coherence", value: cd?.coherence_strength ?? null },
                            { label: "Completeness", value: completeness },
                          ];
                          return dims.map((dim) => {
                            const measured = typeof dim.value === "number" && Number.isFinite(dim.value);
                            const v = measured ? (dim.value as number) : 0;
                            return (
                              <div key={dim.label} className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground w-[80px] shrink-0">
                                  {dim.label}
                                </span>
                                <div className="flex-1 h-[6px] rounded-full bg-border overflow-hidden">
                                  {measured && (
                                    <div
                                      className="h-full rounded-full bg-secondary transition-all"
                                      style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }}
                                    />
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground w-[88px] text-right">
                                  {measured ? (v).toFixed(2) : "not yet measured"}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Overall score */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <span className="text-[10px] text-muted-foreground">Overall confidence</span>
                        <span className="text-xs font-mono font-medium text-foreground">
                          {cluster.confidence_score.toFixed(2)}
                        </span>
                      </div>

                      {/* Provenance */}
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Produced by triangulation pipeline (generator → critic → reconciler).
                      </p>
                      {cluster.generation_run_id && (
                        <p className="text-[9px] font-mono text-muted-foreground/60 break-all">
                          Run: {cluster.generation_run_id}
                        </p>
                      )}

                      <button
                        onClick={(e) => { e.stopPropagation(); setDepth(2); }}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Hide audit trail
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ClusterCard;
