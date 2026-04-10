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
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-card border border-border/40 rounded-md p-6 hover:border-border transition-colors duration-150"
    >
      <span className="text-[11px] font-sans font-medium text-muted-foreground uppercase tracking-[0.16em] block mb-3">{title}</span>
      <span className="text-4xl font-sans font-semibold text-foreground tracking-tight block">{value}</span>
      {trendLabel && trend && (
        <span className={`text-[12px] font-sans mt-2 block ${trendColors[trend]}`}>
          {trendLabel}
        </span>
      )}
    </motion.div>
  );
};

export default MetricCard;
