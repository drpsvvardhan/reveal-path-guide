import React from "react";
import { ArrowRight } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";

interface DrillCard {
  sectionId: string;
  title: string;
  preview: string;
}

const DrillDownGrid: React.FC<{ cards: DrillCard[] }> = ({ cards }) => {
  const { navigateTo } = useNavigation();

  return (
    <div className="space-y-3">
      <h3 className="text-eyebrow text-muted-foreground">DRILL DOWN</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <button
            key={card.sectionId}
            onClick={() => navigateTo(card.sectionId)}
            className="group text-left rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:bg-card/80 transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-serif text-sm text-foreground leading-snug">
                {card.title}
              </h4>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {card.preview}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DrillDownGrid;
