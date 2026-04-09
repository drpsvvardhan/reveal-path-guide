import React from "react";

const COGNITIVE_MODES = [
  { prefix: "FROM YOUR DATA:", color: "bg-primary/15 text-primary", label: "Your Data" },
  { prefix: "PUTTING IT TOGETHER:", color: "bg-accent/20 text-accent-foreground", label: "Synthesis" },
  { prefix: "FROM MEDICAL KNOWLEDGE:", color: "bg-secondary/15 text-secondary", label: "Medical Knowledge" },
];

interface Props {
  content: string;
}

const PatientCognitiveText: React.FC<Props> = ({ content }) => {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let buffer = "";
  let currentMode: (typeof COGNITIVE_MODES)[number] | null = null;

  const flushBuffer = (key: string) => {
    if (!buffer.trim()) return;
    elements.push(
      <span key={key} className="whitespace-pre-line">
        {buffer}
      </span>
    );
    buffer = "";
  };

  lines.forEach((line, i) => {
    // Check for section headers: **Header:**
    const headerMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (headerMatch) {
      flushBuffer(`pre-h-${i}`);
      const headerText = headerMatch[1];
      const isUrgent = headerText.toLowerCase().includes("important") && headerText.toLowerCase().includes("don't wait");
      elements.push(
        <strong
          key={`h-${i}`}
          className={`block mt-5 mb-2 font-sans font-semibold text-xs uppercase tracking-wider first:mt-0 ${
            isUrgent ? "text-destructive" : "text-secondary"
          }`}
        >
          {headerText}
        </strong>
      );
      return;
    }

    // Check for cognitive mode labels
    const mode = COGNITIVE_MODES.find((m) => line.trimStart().startsWith(m.prefix));
    if (mode) {
      flushBuffer(`pre-m-${i}`);
      currentMode = mode;
      const rest = line.trimStart().slice(mode.prefix.length).trim();
      elements.push(
        <div key={`mode-${i}`} className="mt-2 mb-1">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${mode.color} mr-2`}
          >
            {mode.label}
          </span>
          {rest && <span className="whitespace-pre-line">{rest}</span>}
        </div>
      );
      return;
    }

    buffer += (buffer ? "\n" : "") + line;
  });

  flushBuffer("tail");

  return <div className="text-sm leading-relaxed text-foreground">{elements}</div>;
};

export default PatientCognitiveText;
