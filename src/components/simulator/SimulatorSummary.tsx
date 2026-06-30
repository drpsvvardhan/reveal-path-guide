import React from "react";
import { FlaskConical, ArrowRight } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { SimulatorProvider, useSimulator } from "@/context/SimulatorContext";

const SummaryInner: React.FC = () => {
  const { cards, experiments, learnings } = useSimulator();
  const nav = useNavigation();
  const openCards = cards.filter((c) => !c.dismissed_at && !c.committed_experiment_id).length;
  const active = experiments.filter((e) => e.status === "active").length;
  const graduated = experiments.filter((e) => e.status === "graduated").length;

  return (
    <button
      onClick={() => nav.navigateTo("simulator")}
      className="w-full text-left rounded-xl border border-border bg-card hover:border-signature/40 transition-colors p-4 sm:p-5 min-w-0 group"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-signature/15 text-signature flex items-center justify-center shrink-0">
          <FlaskConical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
            Biological Simulator
          </p>
          <p className="font-serif text-base text-foreground leading-snug break-words">
            {active > 0
              ? `${active} experiment${active === 1 ? "" : "s"} in flight · ${learnings.length} learning${learnings.length === 1 ? "" : "s"} so far`
              : openCards > 0
                ? `${openCards} What-if simulation${openCards === 1 ? "" : "s"} waiting for you`
                : "Run a small experiment on your own biology"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed break-words">
            Predict → act → compare. Build intuition for how your body actually
            responds, not just what's typical.
            {graduated > 0 && ` · ${graduated} graduated`}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
};

const SimulatorSummary: React.FC = () => (
  <SimulatorProvider>
    <SummaryInner />
  </SimulatorProvider>
);

export default SimulatorSummary;