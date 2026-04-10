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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-card border border-border/50 rounded-md p-5 hover:border-border transition-colors duration-150"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] font-sans font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        {icon && <div className="text-muted-foreground/60">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2.5">
        <span className="text-3xl font-sans font-semibold text-foreground tracking-tight">{value}</span>
        {trendLabel && trend && (
          <span className={`text-[12px] font-medium ${trendColors[trend]}`}>
            {trendIcon} {trendLabel}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default MetricCard;
