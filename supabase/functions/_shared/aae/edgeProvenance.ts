// ─── Edge Provenance Registry v0.1 ───
//
// This is the substrate AAE reads. For each intervention in INTERVENTION_LIBRARY,
// it declares what provenance backs the causal edge "this trigger → this effect".
//
// HONESTY MANDATE: this registry is seeded as it ACTUALLY stands today, not as
// we wish it stood. Most edges in the current library are human-authored
// assertions with, at best, a stateable mechanism. Only a few have the kind of
// literature/population backing that would clear strong admission. Seeding it
// honestly is the entire point — it produces a REAL day-after-AAE emptiness
// number instead of a rigged-to-pass one.
//
// As real evidence is attached (citations, confirmed twin trajectories, provider
// sign-off), edges move from BLOCK → ADMIT_WITH_REVIEW → ADMIT. The Care Map
// surface renders only admitted edges. An empty-ish Care Map on day one is the
// system working, not failing.

import type { ProvenanceRecord, CausalEdge } from "./aae.ts";

// edge_id (== intervention id) → provenance records backing that edge.
// An intervention id ABSENT from this map has zero provenance → AAE BLOCKs it.
export const EDGE_PROVENANCE: Record<string, ProvenanceRecord[]> = {
  // ── Edges with genuine mechanistic + literature backing (will ADMIT) ──
  vitamin_d_repletion_low: [
    { class: "human_authored_protocol", note: "Authored in interventionLibrary v1" },
    {
      class: "mechanistic_inference",
      ref: "vitD-VDR-immune",
      note: "VDR-mediated regulation of innate/adaptive immune signaling and calcium homeostasis is well-characterized.",
      strength: "strong",
    },
    {
      class: "literature_witness",
      ref: "PMID:30675873",
      note: "Vitamin D supplementation in deficiency: dosing and repletion kinetics.",
      strength: "strong",
    },
  ],

  omega3_inflammation: [
    { class: "human_authored_protocol" },
    {
      class: "mechanistic_inference",
      ref: "omega3-SPM",
      note: "EPA/DHA are substrates for specialized pro-resolving mediators (resolvins/protectins) that down-regulate inflammatory signaling.",
      strength: "strong",
    },
    {
      class: "literature_witness",
      ref: "PMID:30019766",
      note: "Marine omega-3 and inflammatory marker reduction.",
      strength: "moderate",
    },
  ],

  resistance_training_sarcopenia: [
    { class: "human_authored_protocol" },
    {
      class: "mechanistic_inference",
      ref: "rt-mps",
      note: "Mechanical loading drives muscle protein synthesis via mTOR signaling; established countermeasure to sarcopenia.",
      strength: "strong",
    },
    {
      class: "population_evidence",
      ref: "rt-elderly-meta",
      note: "Resistance training improves muscle mass/strength in older adults across multiple meta-analyses.",
      strength: "strong",
    },
  ],

  // ── Edges with a stateable mechanism but no strong citation (ADMIT_WITH_REVIEW) ──
  protein_targeting_sarcopenia: [
    { class: "human_authored_protocol" },
    {
      class: "mechanistic_inference",
      ref: "protein-distribution-mps",
      note: "Even protein distribution across meals may better sustain muscle protein synthesis than skewed intake.",
      strength: "moderate",
    },
  ],

  fiber_gut_ecology: [
    { class: "human_authored_protocol" },
    {
      class: "mechanistic_inference",
      ref: "fiber-scfa",
      note: "Dietary fiber diversity feeds distinct microbial communities; SCFA production supports barrier and immune tolerance.",
      strength: "moderate",
    },
  ],

  glucose_stability_meal_timing: [
    { class: "human_authored_protocol" },
    {
      class: "mechanistic_inference",
      ref: "meal-order-glycemia",
      note: "Macronutrient order (protein/fiber before carbohydrate) blunts postprandial glucose excursion.",
      strength: "moderate",
    },
  ],

  sleep_consistency_window: [
    { class: "human_authored_protocol" },
    {
      class: "mechanistic_inference",
      ref: "circadian-consistency",
      note: "Consistent sleep timing stabilizes circadian entrainment; relevant to metabolic and regulatory axes.",
      strength: "moderate",
    },
  ],

  morning_light_exposure: [
    { class: "human_authored_protocol" },
    {
      class: "mechanistic_inference",
      ref: "morning-light-scn",
      note: "Morning bright light advances circadian phase via SCN; supports sleep-onset timing.",
      strength: "moderate",
    },
  ],

  // ── Edges that are human-authored ONLY today (will BLOCK until evidenced) ──
  // These are seeded honestly: real, reasonable interventions whose causal edge
  // has not yet had independent evidence attached in this registry.
  magnesium_repletion: [
    { class: "human_authored_protocol", note: "Mechanism plausible but not yet attached as an evidence record." },
  ],
  b12_repletion: [
    { class: "human_authored_protocol" },
  ],
  ldl_particle_nutrition_shift: [
    { class: "human_authored_protocol" },
  ],
  hydration_baseline: [
    { class: "human_authored_protocol" },
  ],
  daily_walking_baseline: [
    { class: "human_authored_protocol" },
  ],
  evening_light_hygiene: [
    { class: "human_authored_protocol" },
  ],
  stress_downregulation_breathing: [
    { class: "human_authored_protocol" },
  ],

  // Monitoring-class edges: these are observation/retest actions, not causal
  // interventions. They carry monitoring_witness if the marker is validated.
  visceral_fat_monitoring: [
    { class: "human_authored_protocol" },
    { class: "monitoring_witness", ref: "vfa-ct-mri", note: "VFA is a validated imaging-derived metric.", strength: "moderate" },
  ],
  apob_monitoring: [
    { class: "human_authored_protocol" },
    { class: "monitoring_witness", ref: "apob-assay", note: "ApoB is a standardized, validated lab assay.", strength: "strong" },
  ],
  phase_angle_tracking: [
    { class: "human_authored_protocol" },
    { class: "monitoring_witness", ref: "phase-angle-bia", note: "Phase angle is a reproducible BIA-derived metric.", strength: "moderate" },
  ],

  // NOTE: any intervention id NOT in this map → zero provenance → AAE BLOCK.
};

// Build a CausalEdge from a library intervention + its action object.
// `cause` is rendered from the trigger in plain words; `expected_effect` from
// the coordinates/why. This is the ADAPTER — AAE does not read the library
// directly, it reads CausalEdges built here, keeping the boundary clean.
export function buildCausalEdge(action: {
  id: string;
  what: string;
  why?: string;
  coordinates: string[];
  // the original trigger, if available, for a precise cause string
  source_intervention?: {
    trigger?: {
      biomarker_conditions?: Array<{ name: string; operator: string; value: number }>;
      gate_conditions?: Array<{ gate: string; traffic_light: string }>;
      domain_conditions?: Array<{ domain: string; operator: string; value: number }>;
      rule_ids?: string[];
    };
  };
}): CausalEdge {
  const trig = action.source_intervention?.trigger;
  const causeParts: string[] = [];
  if (trig?.biomarker_conditions) {
    for (const b of trig.biomarker_conditions) causeParts.push(`${b.name} ${b.operator} ${b.value}`);
  }
  if (trig?.gate_conditions) {
    for (const g of trig.gate_conditions) causeParts.push(`${g.gate} ≥ ${g.traffic_light}`);
  }
  if (trig?.domain_conditions) {
    for (const d of trig.domain_conditions) causeParts.push(`${d.domain} ${d.operator} ${d.value}`);
  }
  if (trig?.rule_ids) {
    for (const r of trig.rule_ids) causeParts.push(`pattern:${r}`);
  }

  return {
    edge_id: action.id,
    cause: causeParts.length ? causeParts.join(" AND ") : "(trigger unavailable)",
    intervention: action.what,
    expected_effect: action.why || `axis support: ${action.coordinates.join(", ")}`,
    coordinates: action.coordinates,
    provenance: EDGE_PROVENANCE[action.id] ?? [],
  };
}
