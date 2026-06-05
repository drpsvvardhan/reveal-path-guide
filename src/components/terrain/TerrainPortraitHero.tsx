import React from "react";
import { motion } from "framer-motion";
import FlowLine from "@/components/visuals/FlowLine";
import { useTerrainRender } from "@/context/TerrainRenderContext";
import { Compass, ArrowRight } from "lucide-react";
import TappableProse from "@/components/terrain/TappableProse";
import { formatDistanceToNow } from "date-fns";

interface TerrainPortraitHeroProps {
  /** Override portrait data (e.g. from IntakeResultsScreen before context is populated) */
  portrait?: {
    what_you_already_know: string;
    working_harder_than_you_realize: string;
    where_to_start: string;
    the_one_action: string;
  };
  generatedAt?: string;
  /** Show empty state with CTA to intake */
  showEmptyState?: boolean;
  onStartIntake?: () => void;
}

const SectionDivider = () => (
  <div className="my-6">
    <FlowLine variant="divider" className="w-full h-3 text-secondary/30" />
  </div>
);

const TerrainPortraitHero: React.FC<TerrainPortraitHeroProps> = ({
  portrait: overridePortrait,
  generatedAt: overrideGeneratedAt,
  showEmptyState = false,
  onStartIntake,
}) => {
  const terrainCtx = useTerrainRender();
  const render = terrainCtx?.activeRender;

  const portrait = overridePortrait || (render?.patient_portrait as any);
  const generatedAt = overrideGeneratedAt || render?.generated_at;

  // Empty state
  if (showEmptyState || (!portrait && !terrainCtx?.isLoading)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-10 px-6 rounded-2xl border border-border bg-card/40 text-center space-y-4"
      >
        <Compass className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="font-serif text-lg text-foreground/70 max-w-md mx-auto leading-relaxed">
          Your portrait is waiting for your intake. Complete the 75-question terrain scan to see yourself reflected here.
        </p>
        {onStartIntake && (
          <button
            onClick={onStartIntake}
            className="inline-flex items-center gap-2 rounded-xl bg-secondary text-secondary-foreground px-6 py-2.5 text-sm font-medium hover:bg-secondary/90 transition-colors"
          >
            Start terrain scan
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </motion.div>
    );
  }

  if (!portrait) return null;

  const relativeTime = generatedAt
    ? formatDistanceToNow(new Date(generatedAt), { addSuffix: true })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative py-8 sm:py-12 min-w-0"
    >
      {/* Background FlowLine motif at very low opacity */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.04]">
        <FlowLine variant="hero" className="w-full h-full text-secondary" />
      </div>

      <div className="relative max-w-2xl space-y-0 min-w-0">
        {/* Eyebrow */}
        <p className="text-[10px] sm:text-[11px] font-sans font-semibold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-secondary mb-6 sm:mb-8 break-words">
          YOUR TERRAIN, RIGHT NOW
        </p>

        {/* Section 1: What you already know */}
        <div className="min-w-0">
          <h3 className="text-subhead text-muted-foreground/60 mb-3 break-words">
            What you already know
          </h3>
          <TappableProse text={portrait.what_you_already_know} className="font-serif text-base sm:text-lg text-foreground leading-[1.7] sm:leading-[1.8] tracking-[-0.01em] break-words" />
        </div>

        <SectionDivider />

        {/* Section 2: What's working harder than you realize */}
        <div className="min-w-0">
          <h3 className="text-subhead text-muted-foreground/60 mb-3 break-words">
            What's working harder than you realize
          </h3>
          <TappableProse text={portrait.working_harder_than_you_realize} className="font-serif text-base sm:text-lg text-foreground leading-[1.7] sm:leading-[1.8] tracking-[-0.01em] break-words" />
        </div>

        <SectionDivider />

        {/* Section 3: Where to start */}
        <div className="min-w-0">
          <h3 className="text-subhead text-muted-foreground/60 mb-3 break-words">
            Where to start
          </h3>
          <TappableProse text={portrait.where_to_start} className="font-serif text-base sm:text-lg text-foreground leading-[1.7] sm:leading-[1.8] tracking-[-0.01em] break-words" />
        </div>

        {/* The One Action card */}
        <div className="mt-8 rounded-xl border border-border bg-card/60 p-4 sm:p-6 border-l-4 border-l-secondary min-w-0">
          <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-secondary mb-2 break-words">
            START HERE
          </p>
          <TappableProse text={portrait.the_one_action} className="font-serif text-lg sm:text-xl text-foreground leading-snug break-words" />
        </div>

        {/* Footnote */}
        {relativeTime && (
          <p className="text-xs text-muted-foreground/50 mt-6">
            This portrait was last updated {relativeTime}. It refreshes whenever new data arrives.
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default TerrainPortraitHero;
