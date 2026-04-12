import React from "react";

interface BaselineItem {
  name: string;
  value: number;
  unit: string;
  flag: string | null;
}

const PRIORITY_KEYS = [
  "hba1c", "ldl", "hs_crp", "vitamin_d", "apob",
  "phase_angle_whole_body", "visceral_fat_area", "skeletal_muscle_mass",
  "hdl", "triglycerides", "fasting_glucose", "tsh", "ferritin",
];

function matchesPriority(canonical: string): number {
  const lower = canonical.toLowerCase().replace(/[\s\-]/g, "_");
  const idx = PRIORITY_KEYS.findIndex((k) => lower.includes(k));
  return idx >= 0 ? idx : 999;
}

const BaselineCards: React.FC<{
  observations: { canonical_name: string; display_name: string | null; value: number; unit: string; flag: string | null; collection_date: string }[];
}> = ({ observations }) => {
  if (observations.length === 0) return null;

  // Get most recent per canonical_name, sorted by priority
  const latest: Record<string, BaselineItem & { date: string }> = {};
  for (const obs of observations) {
    const existing = latest[obs.canonical_name];
    if (!existing || obs.collection_date > existing.date) {
      latest[obs.canonical_name] = {
        name: obs.display_name || obs.canonical_name,
        value: Number(obs.value),
        unit: obs.unit,
        flag: obs.flag,
        date: obs.collection_date,
      };
    }
  }

  const sorted = Object.entries(latest)
    .sort(([a], [b]) => matchesPriority(a) - matchesPriority(b))
    .slice(0, 8)
    .map(([, v]) => v);

  return (
    <div className="space-y-3">
      <h3 className="text-eyebrow text-muted-foreground">BASELINE CAPTURED</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {sorted.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-sans font-medium text-foreground truncate">
                {item.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.value} {item.unit}
                {item.flag === "H" && <span className="ml-1 text-amber-500">↑</span>}
                {item.flag === "L" && <span className="ml-1 text-blue-400">↓</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground italic">
        Your baseline is saved. Your next lab will become your first trend.
      </p>
    </div>
  );
};

export default BaselineCards;
