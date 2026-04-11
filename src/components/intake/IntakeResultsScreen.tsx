import React from "react";
import { motion } from "framer-motion";
import { CIE_DOMAINS, CIE_GATES, CIE_DOMAIN_MAP } from "@/lib/cieSeedData";
import { useIntake } from "@/context/IntakeContext";
import { ArrowRight } from "lucide-react";

const LIGHT_COLORS: Record<string, string> = {
  GREEN: "bg-emerald-500",
  YELLOW: "bg-amber-400",
  ORANGE: "bg-orange-500",
  RED: "bg-rose-500",
};

const LIGHT_BG: Record<string, string> = {
  GREEN: "bg-emerald-500/10 border-emerald-500/20",
  YELLOW: "bg-amber-400/10 border-amber-400/20",
  ORANGE: "bg-orange-500/10 border-orange-500/20",
  RED: "bg-rose-500/10 border-rose-500/20",
};

interface IntakeResultsScreenProps {
  onContinue: () => void;
}

const IntakeResultsScreen: React.FC<IntakeResultsScreenProps> = ({ onContinue }) => {
  const { domainScores, gateScores } = useIntake();

  const getTrafficLight = (score: number) => {
    if (score >= 80) return "GREEN";
    if (score >= 60) return "YELLOW";
    if (score >= 40) return "ORANGE";
    return "RED";
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <h1 className="font-serif text-3xl md:text-4xl text-foreground">
            Your biological terrain
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto leading-relaxed">
            Based on your responses, we've mapped 25 biological domains across 9 clinical gates.
            This is your starting point — a snapshot of where your body stands today.
          </p>
        </motion.div>

        {/* 9 Gate cards — 3x3 grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            CLINICAL GATES
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CIE_GATES.map((gate) => {
              const gs = gateScores[gate.id];
              const score = gs?.score ?? 50;
              const tl = gs?.trafficLight ?? getTrafficLight(score);

              return (
                <div
                  key={gate.id}
                  className={`rounded-xl border p-4 ${LIGHT_BG[tl] || "bg-card border-border"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${LIGHT_COLORS[tl]}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
                        {gate.id}
                      </p>
                      <p className="text-sm font-medium text-foreground truncate">{gate.name}</p>
                      <p className="text-2xl font-serif text-foreground mt-1">
                        {Math.round(score)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {gate.domains.join(" · ")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* 25 Domain cards — grouped by axis */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            DOMAIN SCORES
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {CIE_DOMAINS.map((domain) => {
              const ds = domainScores[domain.id];
              const score = ds?.finalScore ?? 50;
              const tl = getTrafficLight(score);

              return (
                <div
                  key={domain.id}
                  className={`rounded-lg border p-3 ${LIGHT_BG[tl] || "bg-card border-border"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${LIGHT_COLORS[tl]}`} />
                    <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
                      {domain.id}
                    </span>
                  </div>
                  <p className="text-xs text-foreground font-medium truncate">{domain.name}</p>
                  <p className="text-lg font-serif text-foreground mt-1">{Math.round(score)}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Continue button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center pt-4 pb-8"
        >
          <button
            onClick={onContinue}
            className="flex items-center gap-2 rounded-xl bg-secondary text-secondary-foreground px-8 py-3 text-sm font-medium hover:bg-secondary/90 transition-colors"
          >
            Continue to your twin
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default IntakeResultsScreen;
