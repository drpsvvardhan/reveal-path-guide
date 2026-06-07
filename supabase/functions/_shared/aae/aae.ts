// ─── Action Admission Engine (AAE) v0.1 ───
//
// AAE governs ONE question, for ONE unit:
//
//   Unit:     a causal edge  →  Cause → Intervention → Expected Effect
//   Question: "May this causal edge exist?"
//
// AAE does NOT plan, sequence, or prioritize. That is CAR's job (not built).
// AAE sits ON TOP OF the existing interventionLibrary — it does not replace it.
// Each intervention in the library carries (or fails to carry) a provenance
// record. AAE reads that record and emits a verdict. Edges that do not clear
// admission are withheld from the action plan, not silently passed through.
//
// Constitutional anchor (from the CPWE handoff, verbatim):
//   "An admission engine that admits everything already written is RAE-theater."
// Therefore the default verdict for an edge with NO provenance is BLOCK, not PASS.
//
// This mirrors RAE's shape (admit / reject / review) but for the
// Intervention Knowledge Track rather than the Observation Track.

// ── Provenance classes (the six the handoff enumerated, + two witnesses) ──
export type ProvenanceClass =
  | "human_authored_protocol"   // a human typed it; weakest, never sufficient alone
  | "literature_witness"        // citation to published evidence
  | "mechanistic_inference"     // grounded in a stated biological mechanism
  | "population_evidence"       // cohort / population-level evidence
  | "twin_evidence"             // this patient's own prior trajectory supports it
  | "provider_judgment"         // a named clinician asserted it
  | "contraindication_witness"  // the contraindication set is itself evidenced
  | "monitoring_witness";       // the monitoring/retest marker is validated for this edge

// A single piece of provenance backing an edge.
export interface ProvenanceRecord {
  class: ProvenanceClass;
  ref?: string;        // PMID, DOI, mechanism id, clinician id, twin event id, etc.
  note?: string;       // human-readable justification
  strength?: "weak" | "moderate" | "strong";
}

// The causal edge itself — the unit AAE admits.
// This is DERIVED from an Intervention in the library; AAE does not invent it.
export interface CausalEdge {
  edge_id: string;             // stable id, == intervention id
  cause: string;               // e.g. "vitamin_d < 30 ng/mL" (the trigger, in words)
  intervention: string;        // e.g. "Vitamin D3 5,000 IU daily"
  expected_effect: string;     // e.g. "regulatory/immune axis support"
  coordinates: string[];       // target axes (E/I/V/R/Σ)
  provenance: ProvenanceRecord[];
}

export type AdmissionVerdict = "ADMIT" | "ADMIT_WITH_REVIEW" | "BLOCK";

export interface AdmissionResult {
  edge_id: string;
  verdict: AdmissionVerdict;
  reasons: string[];           // why this verdict — always populated
  admitted_provenance: ProvenanceClass[];
  // what would resolve a BLOCK/REVIEW, so the gap is actionable (mirrors RAE)
  what_would_resolve?: string;
}

// ── Admission policy (v0.1 — deliberately conservative) ──
//
// The thresholds below are NOT the AAE Constitution. They are a buildable
// v0.1 policy so a real twin can be measured. The Constitution's thresholds
// are authored AFTER measuring day-after-AAE emptiness against real twins.
//
// v0.1 rule set:
//   - human_authored_protocol ALONE  → BLOCK (the anti-RAE-theater rule)
//   - human_authored + ≥1 evidence class (literature/mechanistic/population/
//     twin/provider) → ADMIT_WITH_REVIEW
//   - ≥1 "strong" evidence-class record → ADMIT
//   - no provenance at all → BLOCK
//
// "Evidence classes" = everything except human_authored_protocol.

const EVIDENCE_CLASSES: ProvenanceClass[] = [
  "literature_witness",
  "mechanistic_inference",
  "population_evidence",
  "twin_evidence",
  "provider_judgment",
];

export function admitEdge(edge: CausalEdge): AdmissionResult {
  const classes = edge.provenance.map((p) => p.class);
  const evidenceClasses = classes.filter((c) => EVIDENCE_CLASSES.includes(c));
  const hasStrong = edge.provenance.some(
    (p) => EVIDENCE_CLASSES.includes(p.class) && p.strength === "strong",
  );

  // No provenance at all → BLOCK.
  if (edge.provenance.length === 0) {
    return {
      edge_id: edge.edge_id,
      verdict: "BLOCK",
      reasons: ["Edge carries no provenance. AAE blocks unadmitted causal edges."],
      admitted_provenance: [],
      what_would_resolve:
        "Attach at least one evidence-class provenance record (literature, mechanism, population, twin, or provider).",
    };
  }

  // Only human-authored → BLOCK (anti-RAE-theater).
  if (evidenceClasses.length === 0) {
    return {
      edge_id: edge.edge_id,
      verdict: "BLOCK",
      reasons: [
        "Edge is human-authored only, with no independent evidence class.",
        "An admission engine that admits everything already written is RAE-theater.",
      ],
      admitted_provenance: classes,
      what_would_resolve:
        "Add a literature_witness, mechanistic_inference, population_evidence, twin_evidence, or provider_judgment record.",
    };
  }

  // Has at least one strong evidence-class record → ADMIT.
  if (hasStrong) {
    return {
      edge_id: edge.edge_id,
      verdict: "ADMIT",
      reasons: [
        `Edge backed by strong evidence-class provenance (${evidenceClasses.join(", ")}).`,
      ],
      admitted_provenance: classes,
    };
  }

  // Human-authored + at least one (non-strong) evidence class → ADMIT_WITH_REVIEW.
  return {
    edge_id: edge.edge_id,
    verdict: "ADMIT_WITH_REVIEW",
    reasons: [
      `Edge has evidence-class provenance (${evidenceClasses.join(", ")}) but none rated "strong".`,
      "Admitted provisionally; flagged for review.",
    ],
    admitted_provenance: classes,
    what_would_resolve:
      "Upgrade an evidence record to strength: 'strong' (e.g. a stronger citation or confirmed twin trajectory).",
  };
}

// Batch admission over a set of edges. Returns the admitted set plus a full
// ledger of every verdict (admitted AND blocked), so the caller can both
// render only-admitted edges AND measure day-after-AAE emptiness.
export interface AdmissionLedger {
  admitted: AdmissionResult[];       // ADMIT or ADMIT_WITH_REVIEW
  blocked: AdmissionResult[];        // BLOCK
  total: number;
  admitted_count: number;
  blocked_count: number;
  emptiness_ratio: number;           // blocked / total — the measurable quantity
}

export function admitEdges(edges: CausalEdge[]): AdmissionLedger {
  const results = edges.map(admitEdge);
  const admitted = results.filter((r) => r.verdict !== "BLOCK");
  const blocked = results.filter((r) => r.verdict === "BLOCK");
  return {
    admitted,
    blocked,
    total: results.length,
    admitted_count: admitted.length,
    blocked_count: blocked.length,
    emptiness_ratio: results.length === 0 ? 0 : blocked.length / results.length,
  };
}
