// ─── Authored PME Registry v0.1 ───
//
// Hand-authored Patient Mechanism Explainers, one per AAE-admitted edge that
// can reach a patient. NO generation. Each is a draft until clinical sign-off
// (provisional: true, analogy.signed_off_by absent).
//
// An edge id ABSENT from this registry has no PME → Care Map renders the plain
// causal spine for it (no explanatory block). That is the correct default:
// no teaching is shown unless a teaching has been authored AND admits.

import type { PME } from "./pme.ts";

export const PME_REGISTRY: Record<string, PME> = {
  // ── The muscle explainer ──
  // Teaches: normal weight can hide a muscle/fat-ratio problem; muscle is the
  // glucose sink; small sink → sugar stored as fat → inflammation → harder to
  // build muscle (self-reinforcing); only loading builds the sink, walking does not.
  resistance_training_sarcopenia: {
    edge_id: "resistance_training_sarcopenia",
    provisional: true, // DRAFT — pending Vishnu clinical sign-off
    authored_by: "draft:claude (for Vishnu review)",

    // A — Data binding: the explainer rests on these RAE-admitted values.
    // The full "vicious cycle" story requires BOTH the muscle-low side AND a
    // glucose-or-fat-high side to be admitted. If only muscle is admitted, the
    // register text below MUST be cut back to the muscle-as-reserve teaching
    // (see register.note). admitted_required is set FALSE here until Vishnu
    // confirms which markers this patient actually has admitted.
    data_binding: {
      required_markers: ["skeletal_muscle_mass", "F16_musculoskeletal"],
      // optional, gates the "cycle" half of the story:
      // ["glucose" | "homa_ir", "body_fat_pct" | "visceral_fat"]
      admitted_required: false, // SET TRUE only when Vishnu confirms availability
      note: "Cycle narrative requires a glucose/fat marker admitted alongside muscle. If absent, use the maintenance-only register variant.",
    },

    // B — Causal model: each edge with honest provenance. The soft link
    // (inflammation → impaired myogenesis) is marked weak; under v0.1 policy a
    // 'weak' evidence edge → ADMIT_WITH_REVIEW (the chain renders clinician-flagged).
    causal_model: {
      edges: [
        { from: "low_muscle_mass", to: "reduced_glucose_disposal", claim: "Muscle is the body's main glucose sink; less muscle means less capacity to absorb dietary glucose.", provenance: "mechanistic", strength: "strong" },
        { from: "reduced_glucose_disposal", to: "elevated_circulating_glucose", claim: "Glucose that muscle cannot take up stays elevated in circulation.", provenance: "mechanistic", strength: "strong" },
        { from: "elevated_glucose_and_ratio", to: "increased_fat_storage", claim: "Surplus glucose and a low muscle:fat ratio favor adipose storage.", provenance: "mechanistic", strength: "moderate" },
        { from: "increased_fat", to: "higher_inflammatory_tone", claim: "Adipose tissue, especially visceral, raises systemic inflammatory tone.", provenance: "literature", strength: "moderate" },
        { from: "inflammation", to: "impaired_muscle_building", claim: "Chronic inflammation impairs muscle protein synthesis, making muscle harder to build.", provenance: "literature", strength: "weak" },
        { from: "resistance_training", to: "builds_muscle_sink", claim: "Loading muscle against resistance is the established stimulus for building it; aerobic exercise alone does not.", provenance: "population", strength: "strong" },
      ],
    },

    // C — Analogy: AMENDED for the maintenance distortion. Plain "savings"
    // implies you can stop once you have enough; muscle erodes without continued
    // loading, so the analogy is corrected to require ongoing deposits.
    // signed_off_by absent → ADMIT_WITH_REVIEW until Vishnu signs.
    analogy: {
      text: "Think of muscle like savings you have to keep topping up. The more you build while you can, the more you have to draw on as you age or when your body is under stress — but unlike money in a bank, muscle quietly erodes if you stop adding to it. The work isn't a one-time deposit; it's what keeps the account from draining.",
      preserves_biology: true,
      distortion_checked: "Plain 'savings' implies you can stop depositing once sufficient. Corrected: analogy explicitly states muscle erodes without continued loading, so it does not mislead on maintenance.",
      // signed_off_by: "<vishnu>",  // REQUIRED for full ADMIT — currently absent
    },

    // D — Register: the patient-facing prose. Two variants implied by data_binding;
    // this is the FULL (cycle) variant. Use the maintenance-only variant if the
    // glucose/fat side is not admitted.
    register: {
      text:
        "You can have a perfectly normal weight — even a normal BMI — and still be carrying a hidden problem, because the scale can't see the one ratio that matters most: how much of you is muscle versus fat.\n\n" +
        "Here's why that ratio runs so much of your health. Muscle is where your body puts the sugar you eat — it's the tank that absorbs it. When the tank is small, the sugar has nowhere to go, so it stays in your blood and gets stored as fat. That fat raises the background inflammation in your body, which makes muscle even harder to build. Small tank, more fat, more inflammation, smaller tank — the cycle quietly feeds itself.\n\n" +
        "And here's the part most people are never told: walking won't break this cycle. Walking is genuinely good for you, but it doesn't build the tank. Only loading your muscles against resistance does. That's why this one move matters more than any number of steps.\n\n" +
        "Think of muscle like savings you have to keep topping up — the reserve you live on later, that quietly erodes if you stop adding to it.",
      reading_level_ok: true,
      no_diagnosis_language: true,
      agency_preserving: true,
    },
  },
};

// Maintenance-only register variant (use when glucose/fat side is NOT admitted):
export const PME_VARIANTS: Record<string, { register_text: string }> = {
  resistance_training_sarcopenia_muscle_only: {
    register_text:
      "Your muscle is carrying less than it ideally should — and the scale can't show you this, because weight and BMI can't see the difference between muscle and fat.\n\n" +
      "Muscle matters more than most people are told. It's the tissue that absorbs the sugar you eat, supports your metabolism, and carries you through illness and aging. Building it is the single thing that most reliably strengthens that reserve — and walking, while good for you, doesn't build it. Only loading your muscles against resistance does.\n\n" +
      "Think of muscle like savings you have to keep topping up: the reserve you live on later, that quietly erodes if you stop adding to it.",
  },
};
