import React, { ReactNode } from "react";
import { motion } from "framer-motion";

interface MetricCardProps {
  title: string;
  value: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "stable";
  trendLabel?: string;
}

const trendColors = {
  up: "text-success",
  down: "text-accent",
  stable: "text-muted-foreground",
};

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend, trendLabel }) => {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-sans font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-sans font-bold text-foreground">{value}</span>
        {trendLabel && trend && (
          <span className={`text-xs font-medium ${trendColors[trend]}`}>
            {trendIcon} {trendLabel}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default MetricCard;
