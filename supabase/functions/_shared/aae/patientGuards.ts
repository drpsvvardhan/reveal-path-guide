// ============================================================================
// derivePatientGuards — extracted verbatim from simulate-what-if (v0.1)
// ----------------------------------------------------------------------------
// Turns the witness-backed patient terrain context into the two inputs the
// Experiment Admission Engine needs:
//
//   biomarkers — every canonical name the person actually has data for
//   flags      — conservative numeric safety flags from their own numbers
//
// This module is a MOVE, not a rewrite: the numeric rules (eGFR < 60, HRV < 30,
// BMI < 18.5, troponin/CAC > 0) are the same rules simulate-what-if has always
// applied, so both the suggestion path and the activation path now share one
// implementation instead of two drifting copies.
//
// Limitation, stated plainly and unchanged from v0.1: conditions that are not
// present in structured data (pregnancy, a history of disordered eating, and
// any diagnosis that lives only in prose) CANNOT be derived here. Their absence
// from this set means UNKNOWN, never "excluded". Nothing in this file is a
// clinical assessment and none of these thresholds are clinically validated for
// this purpose.
// ============================================================================

export interface PatientGuards {
  biomarkers: Set<string>;
  flags: Set<string>;
}

export function derivePatientGuards(wc: any): PatientGuards {
  const biomarkers = new Set<string>();
  const add = (s: unknown) => {
    if (s) biomarkers.add(String(s));
  };

  // All four admitted observation sources carry canonical_name.
  for (const o of wc?.labs?.observations ?? []) add(o.canonical_name);
  for (const o of wc?.inbody?.observations ?? []) add(o.canonical_name); // Phase Angle, Visceral Fat
  for (const o of wc?.fibroscan?.observations ?? []) add(o.canonical_name);
  // CIE domains + gates (axis names + domain/gate ids the LLM may reference).
  for (const d of wc?.cie?.domain_scores ?? []) {
    add(d.domain_id);
    add(d.axis);
  }
  for (const g of wc?.cie?.gate_scores ?? []) {
    add(g.gate_id);
    add(g.gate_name);
  }

  const flags = new Set<string>();
  // Build a name→value map across all numeric observation sources for flag rules.
  const byName: Record<string, number> = {};
  const ingest = (obs: any[]) => {
    for (const o of obs ?? []) {
      const v = typeof o.value === "number" ? o.value : parseFloat(o.value);
      const n = String(o.canonical_name || "").toLowerCase();
      if (n && !isNaN(v)) byName[n] = v;
    }
  };
  ingest(wc?.labs?.observations);
  ingest(wc?.inbody?.observations);
  ingest(wc?.fibroscan?.observations);

  for (const [n, v] of Object.entries(byName)) {
    if (n.includes("hrv") && v < 30) flags.add("low_hrv");
    if ((n.includes("bmi") || n.includes("body mass index")) && v < 18.5) flags.add("underweight");
    if (n.includes("egfr") && v < 60) flags.add("ckd");
    if ((n.includes("troponin") || n.includes("coronary") || n.includes("cac")) && v > 0) {
      flags.add("cardiac_risk");
    }
  }
  // NOTE: ed_history and pregnancy are NOT inferable from observations — they
  // need a profile/condition source. Until wired, those contraindication rules
  // cannot fire. Known gap (carried from v0.1).
  return { biomarkers, flags };
}
