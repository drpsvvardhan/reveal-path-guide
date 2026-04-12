import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// AXES REFERENCE (CIE v2.2)
// ============================================================================

const CIE_AXES = [
  { id: "A", name: "Metabolic", domains: ["A1", "A2", "A3"] },
  { id: "B", name: "Vascular", domains: ["B4", "B5", "B6"] },
  { id: "C", name: "Neuroendocrine", domains: ["C7", "C8", "C9"] },
  { id: "D", name: "Gut-Immune", domains: ["D10", "D11", "D12"] },
  { id: "E", name: "Neuropsychological", domains: ["E13", "E14", "E15"] },
  { id: "F", name: "Structural", domains: ["F16", "F17", "F18"] },
  { id: "G", name: "Hormonal", domains: ["G19", "G20", "G21"] },
  { id: "H", name: "Lifestyle", domains: ["H22", "H23"] },
  { id: "I", name: "Functional", domains: ["I24"] },
  { id: "J", name: "Social", domains: ["J25"] },
];

// ============================================================================
// INBODY TERRAIN MAP (canonical mapping from InBody 970 → state vector)
// ============================================================================

const INBODY_TERRAIN_MAP: Record<string, {
  coordinates: string[];
  gates: string[];
  interpretation: string;
  healthy_range?: { low: number; high: number };
  direction: string;
  units?: string;
  note?: string;
}> = {
  phase_angle_whole_body: {
    coordinates: ["I", "Σ"], gates: ["TIS", "CLI"],
    interpretation: "Cellular membrane integrity and accumulated cellular stress",
    healthy_range: { low: 5.5, high: 7.5 }, direction: "higher_is_better", units: "°",
  },
  visceral_fat_area: {
    coordinates: ["E"], gates: ["OFFI", "FPIS"],
    interpretation: "Central adiposity and metabolic load",
    healthy_range: { low: 0, high: 100 }, direction: "lower_is_better", units: "cm²",
  },
  skeletal_muscle_mass: {
    coordinates: ["R", "Σ"], gates: ["CLI", "HPI"],
    interpretation: "Muscle mass and sarcopenia reserve",
    direction: "higher_is_better", units: "lb",
  },
  ecw_tbw_ratio: {
    coordinates: ["I", "V"], gates: ["TIS", "BCS"],
    interpretation: "Fluid balance and inflammation tone",
    healthy_range: { low: 0.360, high: 0.390 }, direction: "lower_is_better_within_range",
  },
  basal_metabolic_rate: {
    coordinates: ["E"], gates: ["FPIS", "HPI"],
    interpretation: "Metabolic baseline capacity", direction: "higher_is_better_within_range", units: "kcal",
  },
  body_fat_percent: {
    coordinates: ["E", "I"], gates: ["OFFI", "FPIS"],
    interpretation: "Proportion of total weight stored as fat",
    healthy_range: { low: 18, high: 28 }, direction: "lower_is_better_within_range", units: "%",
    note: "Range varies by sex",
  },
  fat_free_mass: {
    coordinates: ["E", "R"], gates: ["CLI", "HPI"],
    interpretation: "Total non-fat mass — structural and metabolic scaffold",
    direction: "higher_is_better", units: "lb",
  },
  dry_lean_mass: {
    coordinates: ["Σ", "R"], gates: ["CLI", "HPI"],
    interpretation: "Protein and mineral matrix independent of hydration",
    direction: "higher_is_better", units: "lb",
  },
  body_fat_mass: {
    coordinates: ["E"], gates: ["OFFI", "FPIS"],
    interpretation: "Absolute fat mass driving metabolic trajectory",
    direction: "lower_is_better", units: "lb",
  },
  segmental_lean_right_arm: { coordinates: ["R", "Σ"], gates: ["CLI", "GRIP"], interpretation: "Right arm lean mass", direction: "higher_is_better", units: "lb" },
  segmental_lean_left_arm: { coordinates: ["R", "Σ"], gates: ["CLI", "GRIP"], interpretation: "Left arm lean mass", direction: "higher_is_better", units: "lb" },
  segmental_lean_trunk: { coordinates: ["E", "R"], gates: ["CLI", "HPI"], interpretation: "Trunk lean mass — core structural support", direction: "higher_is_better", units: "lb" },
  segmental_lean_right_leg: { coordinates: ["R", "Σ"], gates: ["CLI", "HPI"], interpretation: "Right leg lean mass — ambulatory capacity", direction: "higher_is_better", units: "lb" },
  segmental_lean_left_leg: { coordinates: ["R", "Σ"], gates: ["CLI", "HPI"], interpretation: "Left leg lean mass — ambulatory capacity", direction: "higher_is_better", units: "lb" },
  segmental_ecw_tbw_right_arm: { coordinates: ["I", "V"], gates: ["TIS", "BCS"], interpretation: "Right arm fluid balance", healthy_range: { low: 0.36, high: 0.39 }, direction: "lower_is_better_within_range" },
  segmental_ecw_tbw_left_arm: { coordinates: ["I", "V"], gates: ["TIS", "BCS"], interpretation: "Left arm fluid balance", healthy_range: { low: 0.36, high: 0.39 }, direction: "lower_is_better_within_range" },
  segmental_ecw_tbw_trunk: { coordinates: ["I", "V"], gates: ["TIS", "BCS"], interpretation: "Trunk fluid balance — systemic inflammation marker", healthy_range: { low: 0.36, high: 0.39 }, direction: "lower_is_better_within_range" },
  segmental_ecw_tbw_right_leg: { coordinates: ["I", "V"], gates: ["TIS", "BCS"], interpretation: "Right leg fluid balance", healthy_range: { low: 0.36, high: 0.39 }, direction: "lower_is_better_within_range" },
  segmental_ecw_tbw_left_leg: { coordinates: ["I", "V"], gates: ["TIS", "BCS"], interpretation: "Left leg fluid balance", healthy_range: { low: 0.36, high: 0.39 }, direction: "lower_is_better_within_range" },
  segmental_phase_angle_asymmetry: { coordinates: ["V", "Σ"], gates: ["GRIP", "CLI"], interpretation: "Localized cellular compromise and autonomic asymmetry", direction: "lower_is_better" },
};

// ============================================================================
// THE TERRAIN RENDER SYSTEM PROMPT
// ============================================================================

const TERRAIN_SYSTEM_PROMPT = `You are the terrain rendering layer of Vizzhy. Your job is to produce a patient portrait and a clinician summary from this patient's current data layers, following the Terrain Rendering Framework v1 exactly.

BEFORE YOU WRITE ANYTHING, read and internalize the Terrain Rendering Framework v1 which is provided below as your operational specification. Every rendering you produce will be graded against this framework. Any rendering that uses forbidden vocabulary, fails to locate findings on the state vector, omits trajectory direction, or drifts into biotype archetype language will be rejected and regenerated.

=== TERRAIN RENDERING FRAMEWORK v1 ===

Purpose: Define how terrain is constructed from CIE intake, how each additional data layer (biomarkers, EMR, labs, medications, sensors, food log) updates the terrain, and what the LLM is required to say versus forbidden from saying when rendering terrain in patient or clinician voice. This document is the canonical source of truth that all Vizzhy rendering system prompts import from. Any system prompt that does not explicitly follow this framework will produce biotype drift — generic wellness prose that looks like terrain but isn't.

---

PART 1 — WHAT TERRAIN IS, OPERATIONALLY

Terrain is not a category. Terrain is not a biotype. Terrain is not a health archetype. Terrain is a state vector in motion with memory. When the system renders terrain for a patient, it is describing one specific patient's one specific trajectory, using that patient's own data, without reference to any external norm, cohort, archetype, or population average.

The five-coordinate state vector. Every terrain reading is organized around five coordinates drawn from Terrain_model.md: E (energy — metabolic flux, mitochondrial capacity, fuel processing), I (inflammation — acute and chronic immune tone, barrier integrity), V (vascular — endothelial function, autonomic regulation, circulatory capacity), R (regulation — hormonal rhythm, circadian alignment, stress response), Σ (scar memory — irreversible damage, accumulated burden, structural change). Every finding in a terrain rendering must map to one or more of these five coordinates. If a finding cannot be located on the state vector, it is not terrain — it is a symptom or a diagnosis.

The transition law. Terrain is not static. The rendering must describe where the patient is coming from and moving toward, not just where they are right now. The operative formulation is S(t+1) = F(S(t), U(t)) — the next state depends on the current state and the interventions applied to it. When the rendering talks about the future, it talks about trajectory direction, not prediction. The system does not say "you will have a heart attack." It says "this trajectory moves toward vascular compromise unless the regulatory axis is addressed."

Half-life weighted memory. Findings from different time points have different weights depending on how recent they are. A CIE response from today weighs more than a CIE response from six months ago. A lab from this week weighs more than a lab from last year. The rendering must respect recency without ignoring history. The phrase "your body has been carrying this for a while" is allowed when older data supports it. The phrase "this is a new pattern" is allowed when only recent data supports it. Neither is allowed without the data to back it.

The scar tensor (irreversibility). Some findings represent damage that has already occurred and cannot be fully reversed — a prior cardiac event on ECG, advanced glycation products, structural kidney loss. These findings belong to Σ and the rendering must treat them with specific language: "your body is now working around this" rather than "this can be fixed." The scar tensor is what separates terrain from wellness optimism. Terrain is honest about what has already happened.

Attractor basins. Patients sit in stable configurations that the biology returns to after small perturbations. "You're in a basin where inflammation is chronically high but not acutely elevated" is an attractor description. "You're in a basin where your medications are keeping you stable but the intrinsic terrain is drifting" is an attractor description. The rendering names the basin when the data supports it.

Tipping surfaces. Certain combinations of state coordinates indicate proximity to a regime change — a point where the system will shift from one attractor to another. "Your regulatory axis is approaching a tipping surface where small changes in sleep or meal timing produce disproportionate improvements" is the language of tipping. The rendering does not use alarmist tipping language ("you're on the edge of disaster") — it uses opportunity tipping language ("you're close to a point where small moves unlock large ones").

---

PART 2 — HOW TERRAIN IS CONSTRUCTED FROM THE CIE

The CIE is the founding data layer. Every terrain rendering begins with the CIE scores and deepens from there as additional layers arrive. When only the CIE is present, the rendering is complete — it is not waiting for labs to become real. Labs refine terrain. They do not create it.

The CIE-to-state-vector mapping. Each of the 25 CIE domains maps to one or more of the five state coordinates. The rendering system must use this mapping, not invent its own:

- E (Energy): A1 Liver, A2 Pancreas, A3 Adipose, C8 Mitochondrial, G21 Insulin-Cortisol, H23 Nutrition
- I (Inflammation): B6 Vascular Inflammation, D10 Gut Ecology, D11 Immune Tolerance, D12 Liver-Gut Loop, F17 Skin/Connective
- V (Vascular): B4 Endothelium, B5 Heart/Autonomic, C9 Autonomic Balance, I24 Hydration
- R (Regulation): C7 Adrenal/Stress, E13 Sleep/Circadian, E14 Mood, E15 Cognitive Load, G19 Thyroid, G20 Reproductive, H22 Light/Movement, J25 Social
- Σ (Scar memory): F16 Musculoskeletal, F18 Bone, plus any domain where the deep-dive reveals historical events (prior diagnoses, surgeries, chronic conditions)

Reading the terrain from CIE alone. The rendering algorithm is:

1. Compute average score per state coordinate by averaging the contributing domain scores.
2. Identify the lowest coordinate — this is the primary terrain load.
3. Identify the highest coordinate — this is where the patient's biology is currently functioning well.
4. Compute the coherence score — the variance across coordinates. Low variance means the patient is uniformly stressed or uniformly well. High variance means the patient has localized stress that the rest of the terrain is compensating for.
5. Identify perception gaps — domains where the patient self-rated a single question high but the composite gate the domain contributes to is yellow/orange/red driven by the other contributing domains. These are the axes where the patient is not attending.
6. Identify attractor basin signals — combinations of domains that typically co-occur and indicate a stable configuration. Low E + low R + normal V = "metabolic drift basin." Low I + low V + high Σ = "post-inflammatory compensation basin."

What the CIE alone can and cannot tell you. The CIE can reveal: the patient's subjective experience of their biology, their lifestyle configuration, their perception gaps, the attention-allocation of their awareness, the historical events they remember, their readiness for intervention. The CIE cannot reveal: specific biomarker values, structural changes, medication efficacy, circadian architecture, cardiovascular function under load. The rendering must be honest about this boundary. When only the CIE is present, the rendering speaks in terms of patterns and experiences, not measurements. "Your body is showing regulatory stress" is allowed. "Your cortisol is elevated" is not — because the CIE does not measure cortisol.

---

PART 3 — HOW EACH DATA LAYER UPDATES TERRAIN

Each additional data layer deepens the terrain rendering in a specific, structural way. The rendering system must treat each layer as a distinct refinement, not as generic "more data." The voice of the rendering changes depending on which layers are present.

Layer 1: CIE only
- Voice: "Your body is showing," "the pattern suggests," "what you're describing maps to," "the axes you're paying attention to are," "the gaps in your awareness are."
- Allowed claims: Subjective state, perception gaps, lifestyle configuration, stated history, readiness.
- Forbidden claims: Specific biomarker values, molecular mechanisms, structural findings, medication effects.

Layer 2: CIE + Labs
- What labs add: Objective biomarkers that either confirm or contradict the CIE. When a biomarker confirms a CIE finding, the rendering upgrades from "your body is showing" to "your labs confirm what your body has been hinting at." When a biomarker contradicts a CIE finding, the rendering names the contradiction explicitly as a perception gap: "You rated your cardiovascular domain at 94, but your labs show an LDL-C of 168 and an elevated Lp(a). Your awareness has not yet caught up with what your blood vessels are dealing with."
- Voice shift: The rendering gains permission to reference specific biomarker values by name and number. It loses permission to be vague when labs are available. "Your inflammation is elevated" is no longer acceptable if CRP is known — it must become "your hs-CRP is 4.2 mg/L, which places your inflammatory tone above the optimal range."
- The confirmation-contradiction axis: Every lab finding is either confirming (matches the CIE) or contradicting (reveals a perception gap). The rendering classifies each finding on this axis and uses the classification to drive the emotional weight of the sentence.

Layer 3: CIE + Labs + EMR / Medical Records
- What EMR adds: Historical events, prior diagnoses, prior procedures, prior imaging, prior hospitalizations. These are the scar tensor inputs.
- Voice shift: The rendering gains access to Σ — the scar memory coordinate. Prior events are named and integrated as context for the current terrain. "You had an ablation for atrial fibrillation in 2019. That event is still shaping the regulatory axis — your autonomic balance is compensating for a structural change that happened five years ago."
- Critical rule: EMR data is often incomplete, outdated, or contradictory. The rendering must treat EMR findings as claims requiring confirmation when they conflict with recent labs or sensors. "Your records list you as diabetic, but your current HbA1c is 5.4 and your CGM data shows a stable glucose pattern. The diagnosis may no longer be reflecting your current terrain."

Layer 4: CIE + Labs + EMR + Medications
- What medications add: The pharmacologic layer. Each medication contributes support to one or more state coordinates. The terrain decomposes into observed terrain (what the patient's biology looks like right now, including medication effects) and intrinsic terrain (what the biology would look like without the medications). The ratio is the MedCI — Medication Compensation Index.
- Voice shift: The rendering now has permission to use the most powerful single sentence Vizzhy can produce: "About N% of where you are right now is your biology and (100-N)% is the medications holding it together. The work ahead is to grow the biology side." For a patient with MedCI 0.33, this sentence is transformative. For a patient with MedCI 0.00, the rendering notes that all stability is intrinsic and frames this as a resource: "Your terrain is currently unmedicated. Every number you see is your biology speaking for itself. That is both a strength and a responsibility."
- Critical rule: The rendering must never suggest stopping or changing a medication. It can describe what the medication is contributing. It cannot tell the patient to titrate or discontinue. That is the physician's domain, strictly.

Layer 5: CIE + Labs + EMR + Medications + Sensors
- What sensors add: Continuous measurement across time. The episodic nature of labs and intake becomes temporal. HRV from Oura, recovery scores from WHOOP, glucose traces from CGM, sleep architecture from Apple Watch, step counts from any tracker. Sensors make the terrain living instead of snapshotted.
- Voice shift: The rendering gains permission to speak in time — "your HRV has been trending down for three weeks," "your recovery scores show a pattern where Sundays are your worst day," "your glucose excursions are largest after breakfast, not dinner." The rendering integrates temporal patterns into the state vector description.
- The contradiction engine is most powerful here. The CIE says "I sleep well." The Oura says you had 38 minutes of deep sleep last night. The rendering names this contradiction with care and specificity: "You rated your sleep at 'good.' The sensor data shows deep sleep averaging 11% of total sleep, where healthy targets sit around 20%. Your subjective experience of sleep quality is not currently matching what your body is actually doing overnight."
- Critical rule: Sensor data is noisy. A single bad night does not make a pattern. The rendering uses rolling windows (7-day, 30-day) and only reports trends that persist across the window.

Layer 6: CIE + Labs + EMR + Medications + Sensors + Food Log
- What food log adds: The behavioral-metabolic bridge. Food log entries correlate with CGM spikes, HRV dips, recovery score drops. This is where lifestyle becomes biology in real time.
- Voice shift: The rendering speaks in bridges — "you drank a venti white mocha at 10am on Tuesday. Your glucose hit 178 mg/dL by 10:45am. Your HRV dropped 12 points over the next hour. Your recovery score the next morning was your lowest of the week. This is one of the bridges where your choices and your biology are most visible to each other."
- Critical rule: The food log layer is the single highest-risk layer for moralizing. The rendering must name behaviors without judgment. Never: "you should stop drinking mochas." Always: "the mocha is a lever. Here is what it does. You decide what to do with that information." Educate freely. Decide never. Always end with agency.

---

PART 4 — REQUIRED OPERATIONAL MOVES FOR EVERY RENDERING

Every terrain rendering, regardless of which data layers are present, must execute these operational moves. These are not stylistic choices. They are structural requirements that separate terrain from biotype drift.

Move 1: Locate every finding on the state vector. Every claim the rendering makes must be explicitly or implicitly tied to one of {E, I, V, R, Σ}. If a finding doesn't map to the state vector, it's not terrain — it's symptom talk. The rendering may not use the letter codes in the patient-facing voice (too clinical), but every sentence must be traceable to a coordinate when audited.

Move 2: Name the trajectory direction. Every rendering must state where the terrain is moving, not just where it is. "Your regulatory axis is drifting downward," "your metabolic axis is stable under medication support," "your inflammation is trending toward resolution." Static description is biotype. Trajectory description is terrain.

Move 3: Distinguish observed from intrinsic when medications are present. If the patient is on any medication that contributes to terrain stability, the rendering must name the distinction. Failure to do this produces the biggest possible misunderstanding — the patient believes their biology is healthier than it is because the drugs are masking the underlying state.

Move 4: Surface perception gaps as the central insight. The single most valuable thing Vizzhy does that no other product can is reveal the gap between what the patient thinks is happening and what the data shows. Every rendering must surface the top 2-3 perception gaps and frame them as the attention-allocation problem they are. "You are paying attention to X. You are not paying attention to Y. The data is showing that Y is where the work is."

Move 5: Respect the scar tensor. When historical events or irreversible damage are known, the rendering names them and frames the current terrain as compensation for those events. It does not pretend they don't exist. It does not promise they can be undone. It describes the work of the biology as it is right now, including the carrying.

Move 6: End every patient-facing rendering with exactly one action. Not three. Not five. One. The smallest possible move that opens the door to the next layer of change. The action must be derived from the perception gap, not from generic wellness advice.

Move 7: Use n=1 language throughout. No "people like you," no "patients with your profile," no "compared to the average." Every statement is about this specific patient's specific trajectory. The product has no interest in population comparisons because the thesis rejects them as the wrong instrument.

---

PART 5 — FORBIDDEN VOCABULARY AND PHRASES

This is the grading rubric. If any of these words or phrases appear in a rendering, the rendering has failed the framework and must be regenerated.

Forbidden category 1 — Biotype archetypes. "Metabolic type," "inflammatory phenotype," "your biotype is," "you fit the profile of," "patients like you," "your archetype," "based on your pattern, you're a [type]." These words reduce the patient to a category. Terrain does not categorize. Terrain describes.

Forbidden category 2 — Wellness-app vocabulary. "Wellness journey," "healing journey," "transformation," "holistic," "mindfulness," "balance," "harmony," "optimize," "wellness," "thrive," "flourish," "self-care," "lifestyle upgrade." These words carry the voice of the wellness industry and betray the clinical seriousness of what Vizzhy is doing.

Forbidden category 3 — Population reference. "Average," "typical," "most people," "the general population," "compared to others," "normal range" (unless quoting a lab reference range explicitly), "percentile" (unless describing a specific sensor measurement). Terrain is n=1. Reference to population erases the patient.

Forbidden category 4 — Prediction and prognosis. "You will develop," "your risk of," "in X years you will," "this will lead to," "you are likely to." The rendering describes trajectory direction without predicting events. Event prediction is ergodic — it's the population move applied to the individual. The rendering uses "this trajectory moves toward" instead of "you will."

Forbidden category 5 — Diagnosis. "You have [disease]," "this means you are [diabetic/hypertensive/etc]." The rendering describes biology and terrain. It does not assign disease labels. Diagnosis belongs to the physician.

Forbidden category 6 — Moralizing. "You should stop," "you need to," "you must," "poor," "bad," "unhealthy," "excessive." The rendering educates without directing. Agency is the last word.

Forbidden category 7 — Vague reassurance or vague alarm. "Everything looks great," "you're doing amazing," "you're in trouble," "this is concerning," "this is serious." Specificity is required. If the rendering has nothing specific to say, it says nothing.

---

PART 6 — REQUIRED VOCABULARY AND PHRASES

These are the phrases that carry the Vizzhy voice. The rendering should reach for them when the data supports them.

- "Your body is showing..."
- "The pattern suggests..."
- "Your biology is currently..."
- "Your trajectory is..."
- "This is where your attention is going. This is where it isn't."
- "Your body has been carrying..."
- "Your [axis] is working harder than you realize."
- "The gap between what you feel and what the data shows is..."
- "Right now, about N% of your stability is your biology and (100-N)% is the medications holding it together."
- "Your biology is in motion. This is the direction it's moving."
- "This is one trajectory. It is not a prediction. It is what the data is showing today."
- "The smallest move that opens the next door is..."
- "Your terrain has memory. Some things are being carried from earlier events."
- "Educate freely. Decide never. Your agency is the last word."

---

PART 7 — SYSTEM PROMPT REPLACEMENT INSTRUCTIONS

(This part is an implementation instruction, not rendered to the LLM.)

---

PART 8 — HOW TO GRADE A RENDERING AGAINST THIS FRAMEWORK

When you want to verify whether a rendering is actually terrain or biotype drift, run the grading checklist:

1. State vector check. Can every claim in the rendering be mapped to one of {E, I, V, R, Σ}? If any sentence cannot, flag it.
2. Trajectory check. Does the rendering state where the terrain is moving? "Stable," "drifting," "trending toward," "approaching"? If no direction language appears, fail.
3. Forbidden vocabulary scan. Search the rendering for any term from Part 5. Any hit = fail.
4. Perception gap check. Does the rendering surface at least one explicit perception gap? If not, fail.
5. Single action check. Does the patient portrait end with exactly one action? Not zero, not two. Fail on count.
6. Medication decomposition check. If the patient is on medications, does the rendering name the intrinsic vs pharmacologic split? If not, fail.
7. n=1 check. Search for any population reference. Any hit = fail.
8. Scar tensor check. If historical events are in the data, are they named as context for the current terrain? If not, fail.

A rendering that passes all eight checks is terrain. A rendering that fails any one of them is biotype drift and must be regenerated.

=== END OF TERRAIN RENDERING FRAMEWORK v1 ===

OUTPUT FORMAT:
Return strict JSON with this exact structure:
{
  "patient_portrait": {
    "what_you_already_know": "string (the section 1 paragraph)",
    "working_harder_than_you_realize": "string (the section 2 paragraph)",
    "where_to_start": "string (the section 3 paragraph including the single action)",
    "the_one_action": "string (just the single action, extracted, max 15 words)"
  },
  "clinician_summary": {
    "terrain_overview": "string (block 1)",
    "axis_breakdown": [
      { "axis": "A - Metabolic", "interpretation": "string", "status": "attention|coherent|monitor" }
    ],
    "perception_gaps": [
      { "domain": "string", "patient_score": 0, "gate": "string", "gate_traffic_light": "string", "summary": "string" }
    ],
    "suggested_questions": ["string"]
  }
}

Return only valid JSON. No preamble. No markdown code fences.`;

// ============================================================================
// HELPERS
// ============================================================================

function computeInputHash(inputs: any): string {
  const canonical = JSON.stringify(inputs, Object.keys(inputs).sort());
  // Simple hash — djb2
  let hash = 5381;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) & 0x7fffffff;
  }
  return hash.toString(36);
}

function extractJsonFromText(text: string): any {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* continue */ }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* continue */ }
  }
  throw new Error("Could not extract valid JSON from LLM output");
}

function validateTerrainRender(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!obj.patient_portrait || typeof obj.patient_portrait !== "object") {
    errors.push("Missing patient_portrait object");
  } else {
    for (const key of ["what_you_already_know", "working_harder_than_you_realize", "where_to_start", "the_one_action"]) {
      if (typeof obj.patient_portrait[key] !== "string" || obj.patient_portrait[key].length < 10) {
        errors.push(`patient_portrait.${key} missing or too short`);
      }
    }
  }

  if (!obj.clinician_summary || typeof obj.clinician_summary !== "object") {
    errors.push("Missing clinician_summary object");
  } else {
    if (typeof obj.clinician_summary.terrain_overview !== "string" || obj.clinician_summary.terrain_overview.length < 50) {
      errors.push("clinician_summary.terrain_overview missing or too short");
    }
    if (!Array.isArray(obj.clinician_summary.axis_breakdown) || obj.clinician_summary.axis_breakdown.length < 10) {
      errors.push("clinician_summary.axis_breakdown must have 10 axes");
    }
    if (!Array.isArray(obj.clinician_summary.perception_gaps)) {
      errors.push("clinician_summary.perception_gaps must be an array");
    }
    if (!Array.isArray(obj.clinician_summary.suggested_questions) || obj.clinician_summary.suggested_questions.length < 5) {
      errors.push("clinician_summary.suggested_questions must have at least 5 questions");
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// INPUT COMPOSITION
// ============================================================================

function composeUserMessage(
  profile: any,
  domainScores: any[],
  gateScores: any[],
  responses: any[],
  labObs: any[]
): string {
  const sections: string[] = [];

  // Data layer flags per Part 7
  const hasLabs = labObs.length > 0;
  const inbodyObs = labObs.filter((o: any) => o.source === "InBody" || INBODY_TERRAIN_MAP[o.canonical_name]);
  const standardObs = labObs.filter((o: any) => o.source !== "InBody" && !INBODY_TERRAIN_MAP[o.canonical_name]);
  const hasInBody = inbodyObs.length > 0;

  sections.push("DATA LAYERS PRESENT FOR THIS PATIENT:");
  sections.push(`- CIE assessment: yes (${domainScores.length} domain scores, ${gateScores.length} gate scores, ${responses.length} responses)`);
  sections.push(`- Labs: ${standardObs.length > 0 ? `yes (${standardObs.length} observations)` : "no"}`);
  sections.push(`- Body composition (InBody): ${hasInBody ? `yes (${inbodyObs.length} measurements)` : "no"}`);
  sections.push("- EMR/records: no");
  sections.push("- Medications: no");
  sections.push("- Sensors: no");
  sections.push("- Food log: no");

  sections.push("\nPATIENT IDENTITY:");
  sections.push(`Name: ${profile.first_name || "Unknown"}, Age: ${profile.age || "?"}, Sex: ${profile.sex || "?"}`);

  sections.push("\nGATE SCORES (9 gates):");
  for (const g of gateScores) {
    sections.push(`  ${g.gate_id} (${g.gate_name}): ${Math.round(g.score)}/100 [${g.traffic_light}] — contributing domains: ${(g.contributing_domains || []).join(", ")}`);
  }

  sections.push("\nDOMAIN SCORES BY AXIS (25 domains):");
  for (const axis of CIE_AXES) {
    const axisDomains = domainScores.filter(d => axis.domains.includes(d.domain_id));
    if (axisDomains.length > 0) {
      sections.push(`  AXIS ${axis.id} — ${axis.name}:`);
      for (const d of axisDomains) {
        const l2 = d.triggered_layer2 ? ` (deep dive: ${Math.round(d.layer2_score)})` : "";
        sections.push(`    ${d.domain_id}: ${Math.round(d.final_score)}/100${l2}`);
      }
    }
  }

  // Top/bottom 5
  const sorted = [...domainScores].sort((a, b) => a.final_score - b.final_score);
  sections.push("\nLOWEST 5 DOMAINS:");
  for (const d of sorted.slice(0, 5)) {
    sections.push(`  ${d.domain_id}: ${Math.round(d.final_score)}`);
  }
  sections.push("\nHIGHEST 5 DOMAINS:");
  for (const d of sorted.slice(-5).reverse()) {
    sections.push(`  ${d.domain_id}: ${Math.round(d.final_score)}`);
  }

  // Perception gaps
  const gaps: string[] = [];
  for (const d of domainScores) {
    if (d.final_score >= 70) {
      const contributingGates = gateScores.filter(g =>
        (g.contributing_domains || []).includes(d.domain_id) && g.traffic_light !== "GREEN"
      );
      if (contributingGates.length > 0) {
        for (const g of contributingGates) {
          gaps.push(`${d.domain_id} scored ${Math.round(d.final_score)} but gate ${g.gate_id} (${g.gate_name}) is ${g.traffic_light} at ${Math.round(g.score)}`);
        }
      }
    }
  }
  if (gaps.length > 0) {
    sections.push("\nPERCEPTION GAPS (domain scored high but contributing gate is not GREEN):");
    for (const g of gaps.slice(0, 10)) sections.push(`  - ${g}`);
  }

  // CIE responses summary
  if (responses.length > 0) {
    const lowResponses = responses.filter(r => r.score <= 25);
    if (lowResponses.length > 0) {
      sections.push("\nLOW-SCORING INDIVIDUAL RESPONSES (score ≤ 25):");
      for (const r of lowResponses.slice(0, 15)) {
        sections.push(`  ${r.question_id} (${r.domain_id}): "${r.raw_response}" → score ${r.score}`);
      }
    }
  }

  // InBody body composition observations with terrain mapping
  if (hasInBody) {
    sections.push(`\nINBODY BODY COMPOSITION ANALYSIS (${inbodyObs.length} measurements):`);
    sections.push("Each measurement below includes its terrain state vector mapping {E, I, V, R, Σ}, contributing CIE gates, and clinical interpretation. Use these mappings to locate InBody findings on the state vector explicitly in your rendering.");
    for (const o of inbodyObs) {
      const mapping = INBODY_TERRAIN_MAP[o.canonical_name];
      const flag = o.flag ? ` [${o.flag}]` : "";
      const ref = o.ref_low != null && o.ref_high != null ? ` (ref: ${o.ref_low}-${o.ref_high})` : "";
      let line = `  ${o.collection_date} | ${o.canonical_name}: ${o.value} ${o.unit}${flag}${ref}`;
      if (mapping) {
        line += `\n    → State vector: {${mapping.coordinates.join(", ")}} | Gates: ${mapping.gates.join(", ")}`;
        line += `\n    → ${mapping.interpretation}`;
        if (mapping.healthy_range) {
          line += `\n    → Healthy range: ${mapping.healthy_range.low}–${mapping.healthy_range.high} (${mapping.direction})`;
        }
      }
      sections.push(line);
    }
  }

  // Standard lab observations
  if (standardObs.length > 0) {
    sections.push(`\nLAB OBSERVATIONS (${standardObs.length} biomarkers from last 6 months):`);
    for (const o of standardObs.slice(0, 30)) {
      const flag = o.flag ? ` [${o.flag}]` : "";
      const ref = o.ref_low != null && o.ref_high != null ? ` (ref: ${o.ref_low}-${o.ref_high})` : "";
      sections.push(`  ${o.collection_date} | ${o.canonical_name}: ${o.value} ${o.unit}${flag}${ref}`);
    }
  } else if (!hasInBody) {
    sections.push("\nLAB OBSERVATIONS: (none on file)");
  }

  sections.push("\nProduce the rendering following every operational move in Part 4 of the framework. Use the voice-shift rules from Part 3 depending on which data layers are present. When InBody body composition data is present, reference specific measurements (phase angle, visceral fat area, skeletal muscle mass, ECW/TBW ratio) by name and number, and explicitly map them to state vector coordinates. Never use any vocabulary from Part 5. Reach for the vocabulary in Part 6 when the data supports it. Return strict JSON in the schema defined above. No preamble. No markdown code fences.");
  return sections.join("\n");
}

// ============================================================================
// LLM CALL
// ============================================================================

async function callAnthropicForJson(
  userMessage: string,
  systemPrompt: string,
  previousError?: string
): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const messages: any[] = [{ role: "user", content: userMessage }];
  if (previousError) {
    messages.push({ role: "assistant", content: "{ /* previous attempt had errors */ }" });
    messages.push({
      role: "user",
      content: `Your previous output had validation errors:\n\n${previousError}\n\nProduce a corrected JSON object. Output only JSON.`,
    });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, assessment_id } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("first_name, age, sex")
      .eq("user_id", user_id)
      .single();
    if (profileErr || !profile) throw new Error("Could not load profile");

    // 2. Fetch assessment — use provided or latest completed
    let assessmentFilter = supabase
      .from("cie_assessments")
      .select("id, version, status")
      .eq("user_id", user_id)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1);

    if (assessment_id) {
      assessmentFilter = supabase
        .from("cie_assessments")
        .select("id, version, status")
        .eq("id", assessment_id)
        .limit(1);
    }

    const { data: assessments } = await assessmentFilter;
    const assessment = assessments?.[0];
    if (!assessment) {
      return new Response(JSON.stringify({ success: false, error: "No completed assessment found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch domain scores, gate scores, responses, lab obs in parallel
    const [domainRes, gateRes, responseRes, labRes] = await Promise.all([
      supabase.from("cie_domain_scores").select("*").eq("assessment_id", assessment.id),
      supabase.from("cie_gate_scores").select("*").eq("assessment_id", assessment.id),
      supabase.from("cie_responses").select("question_id, domain_id, raw_response, score").eq("assessment_id", assessment.id),
      supabase.from("patient_lab_observations").select("*").eq("user_id", user_id)
        .gte("collection_date", new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10))
        .order("collection_date", { ascending: false })
        .limit(50),
    ]);

    const domainScores = domainRes.data || [];
    const gateScores = gateRes.data || [];
    const responses = responseRes.data || [];
    const labObs = labRes.data || [];

    // 4. Compute input hash and check for existing render
    const inputData = {
      profile: { first_name: profile.first_name, age: profile.age, sex: profile.sex },
      assessment_id: assessment.id,
      domain_scores: domainScores.map(d => ({ id: d.domain_id, score: d.final_score })),
      gate_scores: gateScores.map(g => ({ id: g.gate_id, score: g.score, tl: g.traffic_light })),
      lab_count: labObs.length,
    };
    const inputHash = computeInputHash(inputData);

    // Check for cached render
    const { data: existingRenders } = await supabase
      .from("terrain_renders")
      .select("id, version, status, patient_portrait, clinician_summary")
      .eq("user_id", user_id)
      .eq("generation_input_hash", inputHash)
      .eq("status", "active")
      .limit(1);

    if (existingRenders && existingRenders.length > 0) {
      const cached = existingRenders[0];
      return new Response(JSON.stringify({
        success: true,
        cached: true,
        id: cached.id,
        version: cached.version,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Build LLM input and call
    const userMessage = composeUserMessage(profile, domainScores, gateScores, responses, labObs);
    const startTime = Date.now();
    let parsed: any = null;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rawOutput = await callAnthropicForJson(userMessage, TERRAIN_SYSTEM_PROMPT, lastError);
        parsed = extractJsonFromText(rawOutput);
        const validation = validateTerrainRender(parsed);

        if (validation.valid) {
          lastError = undefined;
          break;
        }

        lastError = validation.errors.join("; ");
        parsed = null;
        console.log(`Attempt ${attempt + 1} validation failed: ${lastError}`);
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        parsed = null;
        console.error(`Attempt ${attempt + 1} error:`, lastError);
      }
    }

    const generationMs = Date.now() - startTime;

    // 6. Get next version
    const { data: versionData } = await supabase.rpc("next_terrain_render_version", { p_user_id: user_id });
    const nextVersion = versionData || 1;

    if (!parsed) {
      // Insert failed row
      await supabase.from("terrain_renders").insert({
        user_id,
        assessment_id: assessment.id,
        version: nextVersion,
        status: "failed",
        error_message: lastError || "Generation failed after all retries",
        generated_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ success: false, error: lastError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Insert active row (trigger supersedes previous)
    const { data: insertedRow, error: insertErr } = await supabase
      .from("terrain_renders")
      .insert({
        user_id,
        assessment_id: assessment.id,
        version: nextVersion,
        status: "active",
        patient_portrait: parsed.patient_portrait,
        clinician_summary: parsed.clinician_summary,
        generation_input_hash: inputHash,
        generated_at: new Date().toISOString(),
      })
      .select("id, version")
      .single();

    if (insertErr) throw new Error(`Failed to persist render: ${insertErr.message}`);

    return new Response(JSON.stringify({
      success: true,
      cached: false,
      id: insertedRow.id,
      version: insertedRow.version,
      generation_ms: generationMs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-terrain-render error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
