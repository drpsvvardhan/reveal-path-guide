import React from "react";

const PATIENT_MODES = [
  {
    marker: "FROM YOUR DATA:",
    label: "From your data",
    className:
      "text-[10px] px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200/60 font-sans font-medium",
  },
  {
    marker: "PUTTING IT TOGETHER:",
    label: "Putting it together",
    className:
      "text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-sans font-medium",
  },
  {
    marker: "FROM MEDICAL KNOWLEDGE:",
    label: "From medical knowledge",
    className:
      "text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60 font-sans font-medium",
  },
] as const;

const MARKER_REGEX = /(FROM YOUR DATA:|PUTTING IT TOGETHER:|FROM MEDICAL KNOWLEDGE:)/g;

interface PatientCognitiveTextProps {
  content: string;
  className?: string;
}

const PatientCognitiveText: React.FC<PatientCognitiveTextProps> = ({ content, className = "" }) => {
  MARKER_REGEX.lastIndex = 0;
  const hasMarkers = MARKER_REGEX.test(content);
  MARKER_REGEX.lastIndex = 0;

  if (!hasMarkers) {
    return <span className={`whitespace-pre-line ${className}`}>{renderInlineMarkdown(content)}</span>;
  }

  const parts = content.split(MARKER_REGEX);

  return (
    <span className={`whitespace-pre-line leading-relaxed ${className}`}>
      {parts.map((part, i) => {
        const mode = PATIENT_MODES.find((m) => m.marker === part);
        if (mode) {
          return (
            <span
              key={i}
              className={`${mode.className} inline-flex items-center mr-1.5 align-baseline`}
            >
              {mode.label}
            </span>
          );
        }
        return <React.Fragment key={i}>{renderInlineMarkdown(part)}</React.Fragment>;
      })}
    </span>
  );
};

export const PatientModeLegend: React.FC = () => (
  <div className="flex flex-wrap items-center gap-3 py-2 text-[10px] text-muted-foreground">
    <span className="text-muted-foreground mr-1">What the labels mean:</span>
    {PATIENT_MODES.map((m) => (
      <span key={m.label} className="flex items-center gap-1.5">
        <span className={m.className}>{m.label}</span>
        <span>
          {m.label === "From your data"
            ? "your test results"
            : m.label === "Putting it together"
            ? "connecting your data"
            : "general knowledge"}
        </span>
      </span>
    ))}
  </div>
);

export default PatientCognitiveText;
