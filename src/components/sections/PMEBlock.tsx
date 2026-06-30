import React from "react";

// ─── PME explainer block for the Care Map Causal Spine ───
//
// Renders the patient mechanism explainer BENEATH the cause node, but ONLY when
// the PME admits and its data binding is satisfied. An un-admitted or absent PME
// renders nothing — the spine shows the plain cause → move → effect with no
// teaching block. Teaching is never shown unless it has been admitted.
//
// In clinician/admin mode, an ADMIT_WITH_REVIEW PME shows its review flags
// (which component is provisional). In patient mode, a renderable PME shows only
// the register prose — the patient sees the teaching, never the admission state.

interface PMERenderProps {
  // The admission result + the authored PME (passed from the data layer).
  renderable: boolean;
  verdict: "ADMIT" | "ADMIT_WITH_REVIEW" | "BLOCK";
  registerText?: string;        // the patient-facing teaching prose
  provisional?: boolean;        // draft, not yet clinically signed
  reviewFlags?: string[];       // clinician-only: which components are under review
  mode: "patient" | "clinician";
}

export const PMEBlock: React.FC<PMERenderProps> = ({
  renderable, verdict, registerText, provisional, reviewFlags, mode,
}) => {
  // Not renderable, or no prose → render nothing. The spine stands without teaching.
  if (!renderable || verdict === "BLOCK" || !registerText) return null;

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        Why this matters for you
      </div>
      {/* The teaching prose. Whitespace-pre-line preserves the authored paragraph breaks. */}
      <div className="text-[15px] leading-relaxed text-foreground whitespace-pre-line break-words max-w-prose">
        {registerText}
      </div>

      {/* Clinician-only: surface provisional / review state. Patient never sees this. */}
      {mode === "clinician" && (provisional || verdict === "ADMIT_WITH_REVIEW") && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {provisional && (
            <span className="text-[10px] text-amber-700 italic border border-amber-600/30 rounded-full px-2.5 py-0.5">
              PME provisional — awaiting clinical sign-off
            </span>
          )}
          {verdict === "ADMIT_WITH_REVIEW" && (reviewFlags || []).map((f) => (
            <span key={f} className="text-[10px] text-amber-700 border border-amber-600/30 rounded-full px-2.5 py-0.5">
              review: {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default PMEBlock;
