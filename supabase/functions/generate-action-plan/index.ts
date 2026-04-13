import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Intervention Library (duplicated from src/lib to run in Deno edge) ──
interface Intervention {
  id: string;
  trigger: {
    rule_ids?: string[];
    gate_conditions?: Array<{ gate: string; traffic_light: string }>;
    biomarker_conditions?: Array<{ name: string; operator: string; value: number }>;
    domain_conditions?: Array<{ domain: string; operator: string; value: number }>;
  };
  what: string;
  why_template: string;
  how: string;
  coordinates: string[];
  gates: string[];
  retest_weeks: number;
  retest_markers: string[];
  contraindications: string[];
  category: string;
  sequence_priority: number;
}

const INTERVENTION_LIBRARY: Intervention[] = [
  {
    id: "vitamin_d_repletion_low",
    trigger: { biomarker_conditions: [{ name: "vitamin_d", operator: "<", value: 30 }], gate_conditions: [{ gate: "HPI", traffic_light: "YELLOW" }] },
    what: "Start Vitamin D3 5,000 IU daily with a fat-containing meal.",
    why_template: "Your Vitamin D at {vitamin_d} ng/mL sits below the range where muscle protein synthesis and immune regulation operate optimally.",
    how: "One softgel, taken with breakfast if it contains fat (eggs, avocado, butter, nuts), or with lunch otherwise. Daily without interruption. Retest serum 25-OH Vitamin D in 8 weeks.",
    coordinates: ["R", "I"], gates: ["HPI", "TIS"], retest_weeks: 8, retest_markers: ["25-OH Vitamin D"],
    contraindications: ["hypercalcemia", "sarcoidosis"], category: "supplementation", sequence_priority: 2,
  },
  {
    id: "magnesium_repletion",
    trigger: { biomarker_conditions: [{ name: "magnesium", operator: "<", value: 2.0 }], domain_conditions: [{ domain: "E13", operator: "<", value: 60 }] },
    what: "Start magnesium glycinate 200–400 mg before bed.",
    why_template: "Your sleep and circadian domain scored {E13_score}/100. Magnesium is a cofactor in over 300 enzymatic reactions including melatonin synthesis.",
    how: "200 mg magnesium glycinate 30–60 minutes before bedtime. If tolerated, increase to 400 mg after 1 week.",
    coordinates: ["R", "E"], gates: ["BRI", "HPI"], retest_weeks: 6, retest_markers: ["RBC Magnesium"],
    contraindications: ["severe renal impairment"], category: "supplementation", sequence_priority: 3,
  },
  {
    id: "b12_repletion",
    trigger: { biomarker_conditions: [{ name: "vitamin_b12", operator: "<", value: 400 }] },
    what: "Start methylcobalamin (B12) 1,000 mcg sublingual daily.",
    why_template: "Your B12 at {vitamin_b12} pg/mL is below the functional threshold where methylation and nerve myelination operate efficiently.",
    how: "One 1,000 mcg methylcobalamin sublingual tablet dissolved under the tongue each morning. Daily for 8 weeks, then retest.",
    coordinates: ["E", "R"], gates: ["CLI", "BRI"], retest_weeks: 8, retest_markers: ["Vitamin B12", "methylmalonic acid"],
    contraindications: [], category: "supplementation", sequence_priority: 4,
  },
  {
    id: "omega3_inflammation",
    trigger: { biomarker_conditions: [{ name: "hs_crp", operator: ">", value: 3.0 }], gate_conditions: [{ gate: "TIS", traffic_light: "ORANGE" }] },
    what: "Start omega-3 fatty acids (EPA+DHA) 2,000 mg daily with food.",
    why_template: "Your hs-CRP at {hs_crp} mg/L indicates systemic inflammatory tone above the threshold where tissue integrity is under chronic load.",
    how: "EPA+DHA combined at 2,000 mg per serving. Take with your largest meal. Triglyceride form absorbs better than ethyl ester.",
    coordinates: ["I", "V"], gates: ["TIS", "BCS"], retest_weeks: 12, retest_markers: ["hs-CRP", "omega-3 index"],
    contraindications: ["fish allergy", "anticoagulant therapy"], category: "supplementation", sequence_priority: 3,
  },
  {
    id: "protein_targeting_sarcopenia",
    trigger: { biomarker_conditions: [{ name: "skeletal_muscle_mass", operator: "<", value: 70 }], domain_conditions: [{ domain: "F16", operator: "<", value: 60 }] },
    what: "Increase daily protein intake to 1.2–1.6 g per kg of body weight, distributed across 3–4 meals.",
    why_template: "Your skeletal muscle mass at {skeletal_muscle_mass} lb and musculoskeletal domain at {F16_score}/100 indicate your structural scaffold needs more substrate.",
    how: "Target 30–40 g protein per meal. Prioritize complete proteins. Front-load protein at breakfast.",
    coordinates: ["E", "Σ"], gates: ["CLI", "HPI"], retest_weeks: 12, retest_markers: ["body composition", "skeletal muscle mass"],
    contraindications: ["advanced CKD"], category: "nutrition", sequence_priority: 2,
  },
  {
    id: "ldl_particle_nutrition_shift",
    trigger: { biomarker_conditions: [{ name: "ldl_cholesterol", operator: ">", value: 160 }], gate_conditions: [{ gate: "GRIP", traffic_light: "YELLOW" }] },
    what: "Shift dietary pattern toward whole foods, reducing refined carbohydrates and increasing omega-3 sources.",
    why_template: "Your LDL at {ldl_cholesterol} mg/dL indicates more cholesterol-carrying particles than your cellular receptors can efficiently clear.",
    how: "Fatty fish 2×/week, olive oil as primary fat, nuts daily. Reduce refined carbs under 50 g daily. Increase soluble fiber.",
    coordinates: ["V", "E"], gates: ["GRIP", "OFFI"], retest_weeks: 12, retest_markers: ["LDL-C", "ApoB", "triglycerides"],
    contraindications: ["nut allergy"], category: "nutrition", sequence_priority: 3,
  },
  {
    id: "glucose_stability_meal_timing",
    trigger: { biomarker_conditions: [{ name: "hba1c", operator: ">", value: 5.6 }], gate_conditions: [{ gate: "FPIS", traffic_light: "YELLOW" }] },
    what: "Front-load carbohydrates to the first two-thirds of the day and pair every carbohydrate with protein or fat.",
    why_template: "Your HbA1c at {hba1c}% indicates your average glucose is running above the metabolic sweet spot.",
    how: "Move starchy carbs to breakfast and lunch. Dinner = protein + vegetables + healthy fat. Always pair carbs with protein or fat.",
    coordinates: ["E"], gates: ["FPIS", "OFFI"], retest_weeks: 12, retest_markers: ["HbA1c", "fasting glucose"],
    contraindications: [], category: "nutrition", sequence_priority: 2,
  },
  {
    id: "fiber_gut_ecology",
    trigger: { domain_conditions: [{ domain: "D10", operator: "<", value: 60 }], gate_conditions: [{ gate: "BCS", traffic_light: "YELLOW" }] },
    what: "Increase dietary fiber to 30+ grams daily from diverse plant sources.",
    why_template: "Your gut ecology domain scored {D10_score}/100. Microbial diversity depends on prebiotic substrate.",
    how: "2–3 servings of legumes per week. 1 fermented food daily. Aim for 30 different plant species per week. Increase gradually.",
    coordinates: ["I", "E"], gates: ["BCS", "TIS"], retest_weeks: 8, retest_markers: ["gut symptoms", "hs-CRP"],
    contraindications: ["active IBD flare"], category: "nutrition", sequence_priority: 4,
  },
  {
    id: "hydration_baseline",
    trigger: { domain_conditions: [{ domain: "I24", operator: "<", value: 60 }], biomarker_conditions: [{ name: "ecw_tbw_ratio", operator: ">", value: 0.39 }] },
    what: "Establish a consistent hydration baseline — 2.5–3 liters of water daily.",
    why_template: "Your hydration domain scored {I24_score}/100 and your ECW/TBW ratio at {ecw_tbw_ratio} suggests fluid compartment imbalance.",
    how: "Start each morning with 500 mL water before coffee. Keep a water bottle visible. Set 3 reminders. Reduce evening intake 2 hours before bed.",
    coordinates: ["V", "I"], gates: ["TIS", "CLI"], retest_weeks: 4, retest_markers: ["ECW/TBW ratio"],
    contraindications: ["heart failure with fluid restriction"], category: "nutrition", sequence_priority: 5,
  },
  {
    id: "resistance_training_sarcopenia",
    trigger: { domain_conditions: [{ domain: "F16", operator: "<", value: 60 }], biomarker_conditions: [{ name: "skeletal_muscle_mass", operator: "<", value: 70 }] },
    what: "Begin a progressive resistance training program — two sessions per week targeting major muscle groups.",
    why_template: "Your skeletal muscle mass at {skeletal_muscle_mass} lb and musculoskeletal domain at {F16_score}/100 indicate your structural reserve is below where it needs to be.",
    how: "45–60 min, 2×/week, 48 hours between sessions. Compound movements: squat, hinge, push, pull, carry. Start bodyweight, progress weekly.",
    coordinates: ["E", "Σ", "R"], gates: ["CLI", "HPI"], retest_weeks: 12, retest_markers: ["body composition", "skeletal muscle mass", "phase angle"],
    contraindications: ["acute injury", "uncontrolled hypertension"], category: "movement", sequence_priority: 3,
  },
  {
    id: "daily_walking_baseline",
    trigger: { domain_conditions: [{ domain: "H22", operator: "<", value: 70 }] },
    what: "Walk 20–30 minutes daily, preferably outdoors in morning light.",
    why_template: "Your lifestyle movement domain scored {H22_score}/100. Daily walking simultaneously supports glucose disposal, endothelial function, and circadian light exposure.",
    how: "Morning, within 2 hours of waking. Outdoors if possible. Brisk pace. Start with 10 minutes if needed, add 5 per week.",
    coordinates: ["E", "V", "R"], gates: ["HPI", "GRIP"], retest_weeks: 4, retest_markers: ["movement domain", "resting heart rate"],
    contraindications: [], category: "movement", sequence_priority: 1,
  },
  {
    id: "sleep_consistency_window",
    trigger: { domain_conditions: [{ domain: "E13", operator: "<", value: 70 }] },
    what: "Stabilize your sleep window — consistent bedtime and wake time within 30 minutes.",
    why_template: "Your sleep/circadian domain scored {E13_score}/100. Circadian variability disrupts the hormonal cascade that makes sleep restorative.",
    how: "Pick a target bedtime and wake time. Set alarms for both. Hold the window for 14 nights including weekends.",
    coordinates: ["R"], gates: ["BRI", "HPI"], retest_weeks: 3, retest_markers: ["sleep quality", "energy"],
    contraindications: [], category: "sleep", sequence_priority: 1,
  },
  {
    id: "morning_light_exposure",
    trigger: { domain_conditions: [{ domain: "E13", operator: "<", value: 65 }] },
    what: "Get 10–15 minutes of bright outdoor light within the first hour of waking.",
    why_template: "Your sleep domain scored {E13_score}/100. Morning light is the single strongest circadian zeitgeber.",
    how: "Step outside within 60 min of waking. No sunglasses. Overcast is fine. Winter: use 10,000 lux light therapy lamp.",
    coordinates: ["R", "E"], gates: ["BRI", "HPI"], retest_weeks: 3, retest_markers: ["sleep quality", "mood"],
    contraindications: ["photosensitivity"], category: "sleep", sequence_priority: 1,
  },
  {
    id: "stress_downregulation_breathing",
    trigger: { domain_conditions: [{ domain: "C7", operator: "<", value: 60 }], gate_conditions: [{ gate: "BRI", traffic_light: "ORANGE" }] },
    what: "Practice a structured 5-minute breathing protocol twice daily.",
    why_template: "Your adrenal/stress domain scored {C7_score}/100 and your brain-resilience gate is at {BRI_status}. Chronic sympathetic activation suppresses vagal tone.",
    how: "Box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat for 5 min. Once morning, once before bed.",
    coordinates: ["R", "V"], gates: ["BRI", "GRIP"], retest_weeks: 4, retest_markers: ["stress domain", "HRV"],
    contraindications: [], category: "stress", sequence_priority: 2,
  },
  {
    id: "visceral_fat_monitoring",
    trigger: { biomarker_conditions: [{ name: "visceral_fat_area", operator: ">", value: 100 }] },
    what: "Track visceral fat area with body composition analysis every 12 weeks.",
    why_template: "Your visceral fat area at {visceral_fat_area} cm² is above the metabolic load threshold.",
    how: "InBody or DEXA every 12 weeks. Same conditions: morning, fasted. Watch the trend, not the absolute number.",
    coordinates: ["E", "I"], gates: ["OFFI", "FPIS"], retest_weeks: 12, retest_markers: ["visceral fat area", "body fat %"],
    contraindications: [], category: "monitoring", sequence_priority: 5,
  },
  {
    id: "phase_angle_tracking",
    trigger: { biomarker_conditions: [{ name: "phase_angle_whole_body", operator: "<", value: 5.5 }] },
    what: "Retest whole-body phase angle every 12 weeks to track cellular integrity.",
    why_template: "Your phase angle at {phase_angle_whole_body}° is below the range indicating healthy cellular membrane integrity.",
    how: "InBody scan every 12 weeks, same conditions. Phase angle responds to protein, resistance training, and inflammation reduction.",
    coordinates: ["I", "Σ"], gates: ["TIS", "CLI"], retest_weeks: 12, retest_markers: ["phase angle", "ECW/TBW ratio"],
    contraindications: [], category: "monitoring", sequence_priority: 5,
  },
  {
    id: "evening_light_hygiene",
    trigger: { domain_conditions: [{ domain: "E13", operator: "<", value: 60 }], gate_conditions: [{ gate: "BRI", traffic_light: "YELLOW" }] },
    what: "Reduce bright and blue-spectrum light exposure in the 2 hours before bed.",
    why_template: "Your sleep domain at {E13_score}/100 suggests your circadian signaling is under load. Bright light after sunset suppresses melatonin onset.",
    how: "Dim overhead lights after 8 PM. Night mode on devices. Avoid screen scrolling in bed entirely.",
    coordinates: ["R"], gates: ["BRI"], retest_weeks: 3, retest_markers: ["sleep quality"],
    contraindications: [], category: "sleep", sequence_priority: 2,
  },
  // ── Optimization-tier interventions (for patients with good markers) ──
  {
    id: "opt_apob_tracking",
    trigger: { biomarker_conditions: [{ name: "apolipoprotein_b", operator: ">", value: 80 }] },
    what: "Track ApoB as your primary cardiovascular particle metric — target below 80 mg/dL.",
    why_template: "Your ApoB at {apolipoprotein_b} mg/dL is above the optimal range where particle-driven atherogenesis operates at its lowest.",
    how: "Retest ApoB every 6 months. If above 90, consider increasing omega-3 intake and reducing refined carbs. Discuss statin evaluation with your provider if above 100.",
    coordinates: ["V"], gates: ["GRIP"], retest_weeks: 24, retest_markers: ["ApoB", "LDL-P"],
    contraindications: [], category: "monitoring", sequence_priority: 3,
  },
  {
    id: "opt_ldl_particle_awareness",
    trigger: { biomarker_conditions: [{ name: "ldl_cholesterol", operator: ">", value: 100 }] },
    what: "Monitor LDL-C trajectory alongside particle count to catch discordance early.",
    why_template: "Your LDL at {ldl_cholesterol} mg/dL is within a range where particle monitoring adds clarity — standard LDL-C can mask particle-level risk.",
    how: "Request LDL-P or ApoB with your next lab panel. Compare particle count trend with LDL-C to identify concordance or discordance.",
    coordinates: ["V"], gates: ["GRIP", "OFFI"], retest_weeks: 12, retest_markers: ["LDL-C", "ApoB", "LDL-P"],
    contraindications: [], category: "monitoring", sequence_priority: 4,
  },
  {
    id: "opt_hba1c_maintenance",
    trigger: { biomarker_conditions: [{ name: "hba1c", operator: ">=", value: 5.4 }] },
    what: "Maintain glycemic stability — your HbA1c is in the upper-normal zone worth watching.",
    why_template: "Your HbA1c at {hba1c}% is technically normal but sits above 5.4%, where metabolic vigilance starts to pay off.",
    how: "Pair carbohydrates with protein or fat at every meal. Walk 10-15 minutes after your largest meal. Retest HbA1c in 3 months to confirm the trend.",
    coordinates: ["E"], gates: ["FPIS"], retest_weeks: 12, retest_markers: ["HbA1c", "fasting glucose", "fasting insulin"],
    contraindications: [], category: "nutrition", sequence_priority: 3,
  },
  {
    id: "opt_inflammation_baseline",
    trigger: { biomarker_conditions: [{ name: "hs_crp", operator: ">", value: 1.0 }] },
    what: "Track hs-CRP as your systemic inflammation baseline — target below 1.0 mg/L.",
    why_template: "Your hs-CRP at {hs_crp} mg/L is above the optimal floor. While not alarming, keeping it below 1.0 supports long-term tissue integrity.",
    how: "Prioritize anti-inflammatory foods: fatty fish 2×/week, turmeric, berries, leafy greens. Ensure 7-8 hours of sleep. Retest in 8 weeks.",
    coordinates: ["I", "V"], gates: ["TIS"], retest_weeks: 8, retest_markers: ["hs-CRP"],
    contraindications: [], category: "nutrition", sequence_priority: 4,
  },
  {
    id: "opt_daily_movement",
    trigger: { domain_conditions: [{ domain: "H22", operator: "<", value: 90 }] },
    what: "Increase daily movement — aim for 30+ minutes of moderate activity most days.",
    why_template: "Your lifestyle movement domain at {H22_score}/100 has room to improve. Consistent movement is the single broadest-spectrum intervention in biology.",
    how: "Walk briskly for 30 minutes daily, preferably outdoors. Add 2 resistance sessions per week. Track daily steps — target 8,000+.",
    coordinates: ["E", "V", "R"], gates: ["HPI", "GRIP", "CLI"], retest_weeks: 8, retest_markers: ["movement domain", "resting heart rate"],
    contraindications: [], category: "movement", sequence_priority: 2,
  },
  {
    id: "opt_retest_comprehensive",
    trigger: { biomarker_conditions: [{ name: "hs_crp", operator: ">", value: 0 }] },
    what: "Schedule a comprehensive retest in 12 weeks to track trajectory across all biomarkers.",
    why_template: "You have a strong baseline. Retesting at regular intervals is how you detect drift before it becomes a pattern.",
    how: "Book a comprehensive lab panel (CBC, CMP, lipid panel with ApoB, hs-CRP, HbA1c, thyroid, vitamin D) for 12 weeks from your last draw. Same lab, fasted, morning.",
    coordinates: ["E", "I", "V", "R"], gates: ["HPI"], retest_weeks: 12, retest_markers: ["comprehensive panel"],
    contraindications: [], category: "monitoring", sequence_priority: 6,
  },
];

// ── Biomarker name normalization ──
const BIOMARKER_ALIASES: Record<string, string[]> = {
  vitamin_d: ["vitamin_d", "25_oh_vitamin_d", "25-oh vitamin d", "vitamin d"],
  hs_crp: ["hs_crp", "hs-crp", "high sensitivity crp", "c-reactive protein"],
  hba1c: ["hba1c", "hemoglobin_a1c", "hemoglobin a1c", "a1c"],
  ldl_cholesterol: ["ldl_cholesterol", "ldl", "ldl-c"],
  skeletal_muscle_mass: ["skeletal_muscle_mass", "smm"],
  visceral_fat_area: ["visceral_fat_area", "vfa", "visceral fat area"],
  ecw_tbw_ratio: ["ecw_tbw_ratio", "ecw/tbw", "ecw tbw"],
  phase_angle_whole_body: ["phase_angle_whole_body", "whole body phase angle", "phase angle"],
  magnesium: ["magnesium"],
  vitamin_b12: ["vitamin_b12", "b12", "cobalamin"],
  apolipoprotein_b: ["apolipoprotein_b", "apob", "apo b"],
};

function normalizeBiomarkerName(raw: string): string {
  const lower = raw.toLowerCase().replace(/[\s\-\/]+/g, "_");
  for (const [canonical, aliases] of Object.entries(BIOMARKER_ALIASES)) {
    if (aliases.some((a) => a.replace(/[\s\-\/]+/g, "_") === lower || lower.includes(a.replace(/[\s\-\/]+/g, "_")))) {
      return canonical;
    }
  }
  return lower;
}

// ── Matching engine ──
function checkCondition(operator: string, actual: number, threshold: number): boolean {
  switch (operator) {
    case "<": return actual < threshold;
    case ">": return actual > threshold;
    case "<=": return actual <= threshold;
    case ">=": return actual >= threshold;
    default: return false;
  }
}

interface PatientData {
  gateScores: Record<string, { score: number; traffic_light: string; gate_name: string }>;
  domainScores: Record<string, { final_score: number }>;
  biomarkers: Record<string, { value: number; unit: string }>;
  patterns: Array<{ rule_id: string; severity: string }>;
}

function matchInterventions(data: PatientData): Array<Intervention & { match_score: number }> {
  const matched: Array<Intervention & { match_score: number }> = [];

  for (const iv of INTERVENTION_LIBRARY) {
    let hits = 0;
    let total = 0;

    // Check biomarker conditions
    if (iv.trigger.biomarker_conditions) {
      for (const bc of iv.trigger.biomarker_conditions) {
        total++;
        const bio = data.biomarkers[bc.name];
        if (bio && checkCondition(bc.operator, bio.value, bc.value)) hits++;
      }
    }

    // Check gate conditions
    if (iv.trigger.gate_conditions) {
      for (const gc of iv.trigger.gate_conditions) {
        total++;
        const gate = data.gateScores[gc.gate];
        if (gate) {
          // Match if traffic light is the specified level OR worse
          const severity = ["GREEN", "YELLOW", "ORANGE", "RED"];
          const gateIdx = severity.indexOf(gate.traffic_light);
          const condIdx = severity.indexOf(gc.traffic_light);
          if (gateIdx >= condIdx) hits++;
        }
      }
    }

    // Check domain conditions
    if (iv.trigger.domain_conditions) {
      for (const dc of iv.trigger.domain_conditions) {
        total++;
        const dom = data.domainScores[dc.domain];
        if (dom && checkCondition(dc.operator, dom.final_score, dc.value)) hits++;
      }
    }

    // Check rule IDs
    if (iv.trigger.rule_ids) {
      for (const rid of iv.trigger.rule_ids) {
        total++;
        if (data.patterns.some((p) => p.rule_id === rid)) hits++;
      }
    }

    // Need at least one condition matched, and at least half of all conditions
    if (total > 0 && hits > 0 && hits >= total * 0.5) {
      matched.push({ ...iv, match_score: hits / total });
    }
  }

  return matched;
}

function templateWhy(template: string, data: PatientData): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    // Check biomarkers
    if (data.biomarkers[key]) return String(data.biomarkers[key].value);
    // Check domain scores (e.g., {E13_score})
    const domainMatch = key.match(/^([A-Z]\d+)_score$/);
    if (domainMatch) {
      const dom = data.domainScores[domainMatch[1]];
      if (dom) return String(Math.round(dom.final_score));
    }
    // Check gate status (e.g., {BRI_status})
    const gateMatch = key.match(/^(\w+)_status$/);
    if (gateMatch) {
      const gate = data.gateScores[gateMatch[1]];
      if (gate) return gate.traffic_light;
    }
    return match; // Leave placeholder if no data
  });
}

// ── Coordinate impact scoring ──
function coordinateImpactScore(iv: Intervention, data: PatientData): number {
  // Higher score = addresses more compromised coordinates
  const coordMap: Record<string, string[]> = {
    E: ["A1", "A2", "A3", "C8", "G21", "H23"],
    I: ["B6", "D10", "D11", "D12", "F17"],
    V: ["B4", "B5", "C9", "I24"],
    R: ["C7", "E13", "E14", "E15", "G19", "G20", "H22", "J25"],
    Σ: ["F16", "F18"],
  };

  let impact = 0;
  for (const coord of iv.coordinates) {
    const domains = coordMap[coord] || [];
    let avgScore = 0;
    let count = 0;
    for (const d of domains) {
      const ds = data.domainScores[d];
      if (ds) { avgScore += ds.final_score; count++; }
    }
    if (count > 0) {
      const avg = avgScore / count;
      impact += (100 - avg); // Lower score = higher impact
    }
  }
  return impact;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, assessment_id } = await req.json();
    if (!user_id) throw new Error("user_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch patient data
    const [gateRes, domainRes, obsRes, patternRes] = await Promise.all([
      supabase.from("cie_gate_scores").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(50),
      supabase.from("cie_domain_scores").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(100),
      supabase.from("patient_lab_observations").select("*").eq("user_id", user_id).order("collection_date", { ascending: false }).limit(1000),
      supabase.from("derived_patterns").select("rule_id, severity").eq("user_id", user_id).eq("status", "active"),
    ]);

    // Build gate scores map (latest per gate)
    const gateScores: Record<string, any> = {};
    for (const g of (gateRes.data || [])) {
      if (!gateScores[g.gate_id]) gateScores[g.gate_id] = g;
    }

    // Build domain scores map (latest per domain)
    const domainScores: Record<string, any> = {};
    for (const d of (domainRes.data || [])) {
      if (!domainScores[d.domain_id]) domainScores[d.domain_id] = d;
    }

    // Build biomarker map (latest per analyte)
    const biomarkers: Record<string, { value: number; unit: string }> = {};
    for (const obs of (obsRes.data || [])) {
      const key = normalizeBiomarkerName(obs.canonical_name);
      if (!biomarkers[key]) biomarkers[key] = { value: obs.value, unit: obs.unit };
    }

    const patientData: PatientData = {
      gateScores,
      domainScores,
      biomarkers,
      patterns: patternRes.data || [],
    };

    // 2. Match interventions
    let matched = matchInterventions(patientData);

    // 3. Rank: priority first, then coordinate impact
    matched.sort((a, b) => {
      if (a.sequence_priority !== b.sequence_priority) return a.sequence_priority - b.sequence_priority;
      return coordinateImpactScore(b, patientData) - coordinateImpactScore(a, patientData);
    });

    // 4. Deduplicate by category — max 2 per category to ensure diversity
    const categoryCounts: Record<string, number> = {};
    const selected: typeof matched = [];
    for (const iv of matched) {
      const count = categoryCounts[iv.category] || 0;
      if (count >= 2) continue;
      selected.push(iv);
      categoryCounts[iv.category] = count + 1;
      if (selected.length >= 5) break;
    }

    // If fewer than 5, fill from remaining
    if (selected.length < 5) {
      for (const iv of matched) {
        if (selected.some((s) => s.id === iv.id)) continue;
        selected.push(iv);
        if (selected.length >= 5) break;
      }
    }

    // 5. Template the why for each
    const todayActions = selected.map((iv) => ({
      id: iv.id,
      what: iv.what,
      why: templateWhy(iv.why_template, patientData),
      how: iv.how,
      coordinates: iv.coordinates,
      gates: iv.gates,
      retest_weeks: iv.retest_weeks,
      retest_markers: iv.retest_markers,
      category: iv.category,
      sequence_priority: iv.sequence_priority,
    }));

    // 6. Build retest schedule
    const retestMap: Record<number, Set<string>> = {};
    for (const a of todayActions) {
      if (!retestMap[a.retest_weeks]) retestMap[a.retest_weeks] = new Set();
      for (const m of a.retest_markers) retestMap[a.retest_weeks].add(m);
    }
    const retestSchedule = Object.entries(retestMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([weeks, markers]) => ({
        weeks: Number(weeks),
        markers: Array.from(markers),
        rationale: `Retest at ${weeks} weeks to confirm whether interventions are shifting the terrain. The measurement is how we know — not a promise.`,
      }));

    // 7. Generate sequence explanation using LLM (lightweight call)
    let sequenceExplanation = "These actions are ordered by leverage — the first ones stabilize the foundation that makes later ones effective. Start with the top action. As it becomes habit, add the next.";

    try {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (apiKey && todayActions.length > 0) {
        const actionSummary = todayActions.map((a, i) => `${i + 1}. [${a.category}] ${a.what} (coordinates: ${a.coordinates.join(",")})`).join("\n");
        const llmRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 200,
            messages: [{
              role: "user",
              content: `You are explaining to a patient why these 5 actions are ordered this way. Write ONE paragraph (3-4 sentences). Use second-person voice. No predictions. No wellness language. No "will improve." Explain what each action stabilizes that makes the next one more effective. Actions:\n${actionSummary}`,
            }],
          }),
        });
        if (llmRes.ok) {
          const llmData = await llmRes.json();
          const text = llmData?.content?.[0]?.text;
          if (text && text.length > 20) sequenceExplanation = text;
        }
      }
    } catch (e) {
      console.warn("LLM sequence explanation failed, using default:", e);
    }

    // 8. Persist
    const { data: versionData } = await supabase.rpc("next_action_plan_version", { p_user_id: user_id });
    const version = versionData || 1;

    const { error: insertError } = await supabase.from("action_plans").insert({
      user_id,
      assessment_id: assessment_id || null,
      version,
      today_actions: todayActions,
      sequence_explanation: sequenceExplanation,
      retest_schedule: retestSchedule,
      status: "active",
    });

    if (insertError) {
      console.error("Failed to persist action plan:", insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        version,
        today_actions: todayActions,
        sequence_explanation: sequenceExplanation,
        retest_schedule: retestSchedule,
        matched_count: matched.length,
        selected_count: selected.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("generate-action-plan error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
