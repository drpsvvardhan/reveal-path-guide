import React from "react";

interface FlowLineProps {
  variant?: "hero" | "divider" | "accent";
  className?: string;
  color?: string;
}

const FlowLine: React.FC<FlowLineProps> = ({ variant = "hero", className = "", color }) => {
  if (variant === "hero") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 400"
        preserveAspectRatio="xMinYMid slice"
        className={`pointer-events-none ${className}`}
        style={{ color: color || "currentColor" }}
      >
        <defs>
          <linearGradient id="flowlineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.06" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flowlineGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
            <stop offset="70%" stopColor="currentColor" stopOpacity="0.04" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M -50 220 Q 200 140 400 200 T 800 180 Q 1000 160 1250 220" fill="none" stroke="url(#flowlineGrad)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M -50 260 Q 250 200 450 240 T 850 220 Q 1050 210 1250 250" fill="none" stroke="url(#flowlineGrad2)" strokeWidth="1" strokeLinecap="round" />
        <path d="M -50 180 Q 180 100 380 160 T 780 140 Q 980 120 1250 180" fill="none" stroke="url(#flowlineGrad2)" strokeWidth="0.75" strokeLinecap="round" />
      </svg>
    );
  }

  if (variant === "divider") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 800 20"
        preserveAspectRatio="none"
        className={`pointer-events-none ${className}`}
        style={{ color: color || "currentColor" }}
      >
        <path d="M 0 10 Q 200 3 400 10 T 800 10" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 60 12"
      className={`pointer-events-none ${className}`}
      style={{ color: color || "currentColor" }}
    >
      <path d="M 0 6 Q 15 1 30 6 T 60 6" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
};

export default FlowLine;
