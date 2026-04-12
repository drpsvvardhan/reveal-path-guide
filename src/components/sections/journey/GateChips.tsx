import React from "react";

interface GateChipData {
  gate_id: string;
  gate_name: string;
  score: number;
  traffic_light: string;
}

const LIGHT_COLORS: Record<string, string> = {
  GREEN: "bg-emerald-500",
  YELLOW: "bg-amber-400",
  ORANGE: "bg-orange-500",
  RED: "bg-red-500",
};

const GateChips: React.FC<{ gates: GateChipData[] }> = ({ gates }) => {
  if (gates.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-eyebrow text-muted-foreground">CURRENT STATE</h3>
      <div className="flex flex-wrap gap-2">
        {gates.map((g) => (
          <div
            key={g.gate_id}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-sans"
          >
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${LIGHT_COLORS[g.traffic_light] ?? "bg-muted-foreground"}`}
            />
            <span className="font-medium text-foreground">{g.gate_name}</span>
            <span className="text-muted-foreground">{Math.round(g.score)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GateChips;
