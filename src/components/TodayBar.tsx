import React, { useState } from "react";
import { useManifest } from "@/context/ManifestContext";
import { Target, ArrowRight, CalendarCheck, Info, Check, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ProgressRing from "./ProgressRing";

interface DailyPriority {
  id: string;
  text: string;
  category: string;
  emoji: string;
  done: boolean;
}

const initialPriorities: DailyPriority[] = [
  { id: "1", text: "Take L-Glutamine (5g) with morning water", category: "Supplement", emoji: "💊", done: false },
  { id: "2", text: "Walk 20 minutes after lunch", category: "Movement", emoji: "🚶", done: false },
  { id: "3", text: "Wind down by 10pm — protect your sleep", category: "Sleep", emoji: "🌙", done: false },
  { id: "4", text: "Choose a Mediterranean-style dinner", category: "Nutrition", emoji: "🥗", done: false },
];

const TodayBar: React.FC = () => {
  const { manifest } = useManifest();
  const today = manifest.todayBar;
  const [priorities, setPriorities] = useState(initialPriorities);

  if (!today) return null;

  const toggleDone = (id: string) => {
    setPriorities((prev) => prev.map((p) => p.id === id ? { ...p, done: !p.done } : p));
  };

  const completed = priorities.filter((p) => p.done).length;
  const progressPct = Math.round((completed / priorities.length) * 100);

  return (
    <div className="space-y-4">
      {/* Focus strip */}
      <div className="glass-card-elevated p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-primary">
            Today
          </h3>
          {today.lastUpdated && (
            <span className="text-[10px] text-muted-foreground italic">{today.lastUpdated}</span>
          )}
        </div>

        <div className="flex items-center gap-5 mb-4">
          <ProgressRing value={progressPct} size={72} strokeWidth={5}>
            <div className="text-center">
              <span className="text-lg font-sans font-bold text-foreground">{completed}</span>
              <span className="text-[9px] text-muted-foreground block -mt-0.5">of {priorities.length}</span>
            </div>
          </ProgressRing>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground leading-snug">{today.focus}</p>
            <p className="text-xs text-muted-foreground mt-1">{today.statusNote}</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-light">
            <ArrowRight className="h-3.5 w-3.5 text-secondary shrink-0" />
            <p className="text-xs text-foreground">{today.keyAction}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-lavender-light">
            <CalendarCheck className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-xs text-foreground">{today.nextCheckpoint}</p>
          </div>
        </div>
      </div>

      {/* Daily priorities */}
      <div>
        <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          Today's Focus
        </h3>
        <div className="space-y-2">
          {priorities.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => toggleDone(p.id)}
              className={`w-full glass-card p-3.5 flex items-center gap-3 text-left transition-all ${
                p.done ? "opacity-60" : "hover:shadow-md"
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                p.done ? "bg-primary border-primary" : "border-muted-foreground/40"
              }`}>
                {p.done && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <span className="text-lg">{p.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-sans font-medium ${p.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {p.text}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{p.category}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TodayBar;
