import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClusterRow } from "@/types/clusters";
import ClusterTierBadge from "./ClusterTierBadge";
import { formatClusterKind } from "@/lib/formatClusterKind";
import { useNavigation } from "@/context/NavigationContext";
import { ArrowRight } from "lucide-react";

interface Props {
  cluster: ClusterRow;
}

const ClusterPatternCard: React.FC<Props> = ({ cluster }) => {
  const [expanded, setExpanded] = useState(false);
  const { navigateTo } = useNavigation();

  const tensionCount = cluster.tensions_held.length;
  const layerCount = new Set(cluster.constituent_evidence.map((e) => e.layer_type)).size;

  const handleViewData = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.history.replaceState(null, "", `#cluster-${cluster.id}`);
    navigateTo("records");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm"
    >
      {/* DEPTH 1 — collapsed */}
      <div
        className="p-4 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Kicker */}
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground mb-1">
          {formatClusterKind(cluster.cluster_kind)}
        </p>

        {/* Claim + badge */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-foreground leading-relaxed flex-1">
            {cluster.claim}
          </p>
          <ClusterTierBadge tier={cluster.confidence_tier} className="shrink-0 mt-0.5" />
        </div>

        {/* Footer signals */}
        {(tensionCount > 0 || layerCount > 1) && (
          <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted-foreground">
            {tensionCount > 0 && (
              <span>with {tensionCount} tension{tensionCount !== 1 ? "s" : ""}</span>
            )}
            {tensionCount > 0 && layerCount > 1 && <span className="text-border">·</span>}
            {layerCount > 1 && (
              <span>from {layerCount} layers</span>
            )}
          </div>
        )}
      </div>

      {/* DEPTH 2 — expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border bg-muted/10 px-4 py-4 space-y-4">
              {/* Claim restated */}
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {cluster.claim}
              </p>

              {/* Tensions held — centerpiece */}
              {cluster.tensions_held.length > 0 && (
                <div className="border-l-2 border-accent/40 pl-3">
                  <p className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground mb-2">
                    Tensions held
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
                  <p className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground mb-2">
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

              {/* View data link */}
              <button
                onClick={handleViewData}
                className="flex items-center gap-1.5 text-[11px] text-secondary hover:text-secondary/80 transition-colors"
              >
                View the data behind this
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ClusterPatternCard;
