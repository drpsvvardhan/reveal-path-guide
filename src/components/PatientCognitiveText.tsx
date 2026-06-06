import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

/** Render full markdown (headings, lists, bold, italic, code, links, tables) with
 *  patient-safe defaults: no raw HTML, all elements wrap on narrow screens. */
function MD({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ node, ...props }) => (
          <p className="my-2 first:mt-0 last:mb-0 break-words" {...props} />
        ),
        strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
        em: ({ node, ...props }) => <em className="italic" {...props} />,
        h1: ({ node, ...props }) => (
          <h3 className="font-serif text-[18px] font-[550] mt-4 mb-2 break-words" {...props} />
        ),
        h2: ({ node, ...props }) => (
          <h3 className="font-serif text-[17px] font-[550] mt-4 mb-2 break-words" {...props} />
        ),
        h3: ({ node, ...props }) => (
          <h4 className="font-serif text-[16px] font-[550] mt-3 mb-1.5 break-words" {...props} />
        ),
        ul: ({ node, ...props }) => (
          <ul className="list-disc pl-5 my-2 space-y-1 marker:text-muted-foreground/60" {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className="list-decimal pl-5 my-2 space-y-1 marker:text-muted-foreground/60" {...props} />
        ),
        li: ({ node, ...props }) => <li className="break-words leading-[1.55]" {...props} />,
        a: ({ node, ...props }) => (
          <a
            className="underline underline-offset-2 text-secondary break-all"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        ),
        code: ({ node, ...props }) => (
          <code className="px-1 py-0.5 rounded bg-muted/60 text-[0.9em] break-all" {...props} />
        ),
        pre: ({ node, ...props }) => (
          <pre
            className="my-2 p-3 rounded-lg bg-muted/60 text-[13px] overflow-x-auto whitespace-pre-wrap break-words"
            {...props}
          />
        ),
        blockquote: ({ node, ...props }) => (
          <blockquote
            className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic break-words"
            {...props}
          />
        ),
        hr: () => <hr className="my-3 border-border/60" />,
        table: ({ node, ...props }) => (
          <div className="my-2 -mx-1 overflow-x-auto">
            <table className="w-full text-[14px] border-collapse" {...props} />
          </div>
        ),
        th: ({ node, ...props }) => (
          <th className="text-left font-semibold border-b border-border px-2 py-1" {...props} />
        ),
        td: ({ node, ...props }) => (
          <td className="border-b border-border/40 px-2 py-1 align-top break-words" {...props} />
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

interface PatientCognitiveTextProps {
  content: string;
  className?: string;
}

const PatientCognitiveText: React.FC<PatientCognitiveTextProps> = ({ content, className = "" }) => {
  MARKER_REGEX.lastIndex = 0;
  const hasMarkers = MARKER_REGEX.test(content);
  MARKER_REGEX.lastIndex = 0;

  if (!hasMarkers) {
    return (
      <div className={`break-words min-w-0 ${className}`}>
        <MD text={content} />
      </div>
    );
  }

  const parts = content.split(MARKER_REGEX);

  return (
    <div className={`leading-relaxed break-words min-w-0 ${className}`}>
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
        return <MD key={i} text={part} />;
      })}
    </div>
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
