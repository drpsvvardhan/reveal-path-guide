import React from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, ArrowUp, FlaskConical, X, Loader2 } from "lucide-react";
import TappableProse from "@/components/terrain/TappableProse";
import type { PredictedDelta, WhatIfCard as WhatIfCardType } from "@/context/SimulatorContext";

const DirectionIcon: React.FC<{ d: PredictedDelta["direction"] }> = ({ d }) => {
  if (d === "increase") return <ArrowUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (d === "decrease") return <ArrowDown className="h-3.5 w-3.5 text-rose-500" />;
  return <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />;
};

interface Props {
  card: WhatIfCardType;
  index: number;
  committing: boolean;
  onCommit: () => void;
  onDismiss: () => void;
}

const WhatIfCard: React.FC<Props> = ({ card, index, committing, onCommit, onDismiss }) => {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-border bg-card p-5 space-y-4 min-w-0"
    >
      <header className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-signature/15 text-signature flex items-center justify-center shrink-0">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
              What if you
            </p>
            <h3 className="font-serif text-lg leading-snug text-foreground break-words">
              <TappableProse text={card.lever} />
            </h3>
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 h-8 w-8 -m-1 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <p className="text-sm text-muted-foreground leading-relaxed break-words">
        <TappableProse text={card.rationale} />
      </p>

      {card.predicted_deltas.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            What this should change in ~{card.horizon_days} days
          </p>
          <ul className="space-y-1.5">
            {card.predicted_deltas.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <DirectionIcon d={d.direction} />
                <span className="font-sans text-foreground">{d.biomarker}</span>
                {d.magnitude && (
                  <span className="text-xs text-muted-foreground">
                    {d.direction === "decrease" ? "−" : d.direction === "increase" ? "+" : ""}
                    {d.magnitude}{d.unit ? ` ${d.unit}` : ""}
                  </span>
                )}
                {d.coordinate && (
                  <span className="ml-auto text-[10px] font-sans uppercase tracking-wide text-muted-foreground">
                    {d.coordinate}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">
          {card.confidence != null
            ? `Confidence ${Math.round(card.confidence * 100)}%`
            : "Prediction"}
        </p>
        <button
          onClick={onCommit}
          disabled={committing}
          className="inline-flex items-center gap-2 rounded-lg bg-signature text-signature-foreground px-3.5 py-2 text-sm font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
          Run this experiment
        </button>
      </div>
    </motion.article>
  );
};

export default WhatIfCard;