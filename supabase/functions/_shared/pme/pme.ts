// ─── Patient Mechanism Explainer (PME) v0.1 ───
//
// A PME is a governed TEACHING object attached to an AAE-admitted causal edge.
// It is the explanatory layer: not "do this," but "here is how your own biology
// works, and why this move addresses it" — told as a story the patient can hold.
//
// DOCTRINE (from the Teaching Admission Definition Note):
//   RAE admits observations. AAE admits causal edges.
//   Teaching Admission asks: may this PERSONALIZED EXPLANATION be told to this
//   patient — does the woven, analogized narrative preserve the truth of its parts?
//   A PME can be false even when every fact is true, because the falsehood lives
//   in the weave and the analogy, not in any single fact.
//
// A PME admits ONLY if ALL FOUR components admit. Composition is the unit.
// An un-admitted PME does NOT render — the edge falls back to the plain spine.
//
// v0.1 is HAND-AUTHORED per admitted edge. No generation. The generation step
// (a Teaching Admission Engine) waits until enough hand-authored PMEs exist to
// define its shape — same define→author→measure→constitute sequence as AAE.

// ── The four components, each separately admissible ──

export type ComponentVerdict = "ADMIT" | "ADMIT_WITH_REVIEW" | "BLOCK";

// A — Data binding: which RAE-admitted patient values the explainer rests on.
export interface DataBinding {
  required_markers: string[];        // marker ids this PME binds to
  // the PME may only render if these are admitted for the patient (checked at runtime)
  admitted_required: boolean;        // set true only when authoring confirms availability
  note?: string;
}

// B — Causal model: the woven chain. Each edge must be AAE-admissible.
export interface CausalModelEdge {
  from: string;
  to: string;
  claim: string;                     // plain statement of this link
  provenance: "literature" | "mechanistic" | "population" | "twin" | "provider" | "asserted";
  strength: "strong" | "moderate" | "weak";
}
export interface CausalModel {
  edges: CausalModelEdge[];
  // the chain admits only if no load-bearing edge is "asserted"/"weak" alone
}

// C — Analogy: the story vehicle. Needs explicit clinical sign-off (interpretive).
export interface Analogy {
  text: string;
  preserves_biology: boolean;        // clinician sign-off that the mapping does not distort
  distortion_checked: string;        // what distortion was checked and ruled out
  signed_off_by?: string;            // clinician id — required for ADMIT
}

// D — Register: tone/reading-level/agency. Overlaps patient-projection P-gates.
export interface Register {
  text: string;                      // the actual patient-facing teaching prose
  reading_level_ok: boolean;
  no_diagnosis_language: boolean;
  agency_preserving: boolean;
}

export interface PME {
  edge_id: string;                   // the AAE edge this teaches (== intervention id)
  data_binding: DataBinding;
  causal_model: CausalModel;
  analogy: Analogy;
  register: Register;
  authored_by?: string;
  provisional: boolean;              // true until full clinical sign-off
}

export interface PMEAdmission {
  edge_id: string;
  verdict: ComponentVerdict;
  component_verdicts: {
    data_binding: ComponentVerdict;
    causal_model: ComponentVerdict;
    analogy: ComponentVerdict;
    register: ComponentVerdict;
  };
  reasons: string[];
  renderable: boolean;               // true only if composition admits AND data is present
}

const EVIDENCE = ["literature", "mechanistic", "population", "twin", "provider"];

function admitDataBinding(d: DataBinding): ComponentVerdict {
  return d.admitted_required ? "ADMIT" : "BLOCK";
}

function admitCausalModel(m: CausalModel): ComponentVerdict {
  if (m.edges.length === 0) return "BLOCK";
  // every edge must carry an evidence class; a load-bearing asserted/weak edge blocks.
  const anyAsserted = m.edges.some((e) => e.provenance === "asserted");
  const anyWeakEvidence = m.edges.some(
    (e) => EVIDENCE.includes(e.provenance) && e.strength === "weak",
  );
  if (anyAsserted) return "BLOCK"; // an unevidenced link in the woven chain → block the chain
  if (anyWeakEvidence) return "ADMIT_WITH_REVIEW";
  return "ADMIT";
}

function admitAnalogy(a: Analogy): ComponentVerdict {
  if (!a.preserves_biology) return "BLOCK";
  if (!a.signed_off_by) return "ADMIT_WITH_REVIEW"; // unsigned analogy is provisional
  return "ADMIT";
}

function admitRegister(r: Register): ComponentVerdict {
  if (!r.reading_level_ok || !r.no_diagnosis_language || !r.agency_preserving) return "BLOCK";
  return "ADMIT";
}

// The composition admits only if NO component blocks. Worst non-block verdict carries.
export function admitPME(pme: PME): PMEAdmission {
  const cv = {
    data_binding: admitDataBinding(pme.data_binding),
    causal_model: admitCausalModel(pme.causal_model),
    analogy: admitAnalogy(pme.analogy),
    register: admitRegister(pme.register),
  };
  const verdicts = Object.values(cv);
  const reasons: string[] = [];
  let verdict: ComponentVerdict = "ADMIT";

  if (verdicts.includes("BLOCK")) {
    verdict = "BLOCK";
    for (const [k, v] of Object.entries(cv)) {
      if (v === "BLOCK") reasons.push(`${k} blocked`);
    }
    reasons.push("Composition blocked: a PME admits only if all components admit.");
  } else if (verdicts.includes("ADMIT_WITH_REVIEW")) {
    verdict = "ADMIT_WITH_REVIEW";
    for (const [k, v] of Object.entries(cv)) {
      if (v === "ADMIT_WITH_REVIEW") reasons.push(`${k} admitted with review`);
    }
  } else {
    reasons.push("All four components admitted.");
  }

  return {
    edge_id: pme.edge_id,
    verdict,
    component_verdicts: cv,
    reasons,
    // renderable: composition is not BLOCK and data binding is satisfied.
    renderable: verdict !== "BLOCK" && pme.data_binding.admitted_required,
  };
}
