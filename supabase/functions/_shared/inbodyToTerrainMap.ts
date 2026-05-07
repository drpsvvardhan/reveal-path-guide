/**
 * Canonical mapping from InBody 970 outputs to Terrain state vector coordinates
 * and CIE gates. This mapping is patient-independent — the same for every patient.
 *
 * State vector coordinates: E (Energy), I (Inflammation), V (Vascular),
 * R (Regulation), Σ (Scar memory)
 *
 * Reference: Terrain Rendering Framework v1, Part 1 & Part 3
 */

export interface InBodyTerrainEntry {
  coordinates: Array<"E" | "I" | "V" | "R" | "Σ">;
  gates: string[];
  interpretation: string;
  healthy_range?: { low: number; high: number };
  direction:
    | "higher_is_better"
    | "lower_is_better"
    | "higher_is_better_within_range"
    | "lower_is_better_within_range";
  units?: string;
  note?: string;
  trigger?: string;
}

export const INBODY_TERRAIN_MAP: Record<string, InBodyTerrainEntry> = {
  // ── Whole-body composition signals ──────────────────────────────────────

  phase_angle_whole_body: {
    coordinates: ["I", "Σ"],
    gates: ["TIS", "CLI"],
    interpretation:
      "Cellular membrane integrity and accumulated cellular stress. Low phase angle signals compromised cell health, chronic inflammation, or sarcopenic load.",
    healthy_range: { low: 5.5, high: 7.5 },
    direction: "higher_is_better",
    units: "°",
  },

  visceral_fat_area: {
    coordinates: ["E"],
    gates: ["OFFI", "FPIS"],
    interpretation:
      "Central adiposity and metabolic load. Visceral fat is the primary driver of insulin resistance, hepatic fat accumulation, and systemic inflammatory tone.",
    healthy_range: { low: 0, high: 100 },
    direction: "lower_is_better",
    units: "cm²",
  },

  skeletal_muscle_mass: {
    coordinates: ["R", "Σ"],
    gates: ["CLI", "HPI"],
    interpretation:
      "Total skeletal muscle and sarcopenia reserve. Muscle mass is the metabolic engine and primary glucose sink.",
    direction: "higher_is_better",
    units: "lb",
    note: "Range depends on sex, age, height — use the InBody-provided target range per patient",
  },

  ecw_tbw_ratio: {
    coordinates: ["I", "V"],
    gates: ["TIS", "BCS"],
    interpretation:
      "Extracellular-to-total body water ratio. Elevated ECW/TBW signals systemic inflammation, fluid retention, or vascular permeability — the body is holding water outside cells.",
    healthy_range: { low: 0.36, high: 0.39 },
    direction: "lower_is_better_within_range",
    units: "ratio",
  },

  basal_metabolic_rate: {
    coordinates: ["E"],
    gates: ["FPIS", "HPI"],
    interpretation:
      "Metabolic baseline capacity. BMR reflects the energy cost of maintaining current tissue mass and organ function at rest.",
    direction: "higher_is_better_within_range",
    units: "kcal",
  },

  body_fat_percent: {
    coordinates: ["E", "I"],
    gates: ["OFFI", "FPIS"],
    interpretation:
      "Proportion of total weight stored as fat. Elevated PBF correlates with metabolic load and inflammatory tone even when BMI appears normal.",
    healthy_range: { low: 18, high: 28 },
    direction: "lower_is_better_within_range",
    units: "%",
    note: "Healthy range varies by sex — 18-28% female, 10-20% male",
  },

  fat_free_mass: {
    coordinates: ["E", "R"],
    gates: ["CLI", "HPI"],
    interpretation:
      "Total non-fat mass including muscle, bone, water, organs. The structural and metabolic scaffold of the body.",
    direction: "higher_is_better",
    units: "lb",
  },

  dry_lean_mass: {
    coordinates: ["Σ", "R"],
    gates: ["CLI", "HPI"],
    interpretation:
      "Lean tissue minus water — the protein and mineral matrix. Reflects the body's structural reserve independent of hydration state.",
    direction: "higher_is_better",
    units: "lb",
  },

  body_fat_mass: {
    coordinates: ["E"],
    gates: ["OFFI", "FPIS"],
    interpretation:
      "Absolute fat mass. Combined with skeletal muscle mass, defines the muscle-fat ratio that drives metabolic trajectory.",
    direction: "lower_is_better",
    units: "lb",
  },

  // ── Segmental analysis ─────────────────────────────────────────────────

  segmental_lean_right_arm: {
    coordinates: ["R", "Σ"],
    gates: ["CLI", "GRIP"],
    interpretation: "Right arm lean mass — functional strength and laterality assessment.",
    direction: "higher_is_better",
    units: "lb",
  },

  segmental_lean_left_arm: {
    coordinates: ["R", "Σ"],
    gates: ["CLI", "GRIP"],
    interpretation: "Left arm lean mass — functional strength and laterality assessment.",
    direction: "higher_is_better",
    units: "lb",
  },

  segmental_lean_trunk: {
    coordinates: ["E", "R"],
    gates: ["CLI", "HPI"],
    interpretation:
      "Trunk lean mass — core structural support and organ-protective muscle.",
    direction: "higher_is_better",
    units: "lb",
  },

  segmental_lean_right_leg: {
    coordinates: ["R", "Σ"],
    gates: ["CLI", "HPI"],
    interpretation: "Right leg lean mass — ambulatory capacity and fall-risk indicator.",
    direction: "higher_is_better",
    units: "lb",
  },

  segmental_lean_left_leg: {
    coordinates: ["R", "Σ"],
    gates: ["CLI", "HPI"],
    interpretation: "Left leg lean mass — ambulatory capacity and fall-risk indicator.",
    direction: "higher_is_better",
    units: "lb",
  },

  // ── Segmental ECW/TBW ──────────────────────────────────────────────────

  segmental_ecw_tbw_right_arm: {
    coordinates: ["I", "V"],
    gates: ["TIS", "BCS"],
    interpretation: "Right arm fluid balance — localized inflammation or lymphatic compromise.",
    healthy_range: { low: 0.36, high: 0.39 },
    direction: "lower_is_better_within_range",
  },

  segmental_ecw_tbw_left_arm: {
    coordinates: ["I", "V"],
    gates: ["TIS", "BCS"],
    interpretation: "Left arm fluid balance — localized inflammation or lymphatic compromise.",
    healthy_range: { low: 0.36, high: 0.39 },
    direction: "lower_is_better_within_range",
  },

  segmental_ecw_tbw_trunk: {
    coordinates: ["I", "V"],
    gates: ["TIS", "BCS"],
    interpretation:
      "Trunk fluid balance — systemic inflammation marker, hepatic congestion indicator.",
    healthy_range: { low: 0.36, high: 0.39 },
    direction: "lower_is_better_within_range",
  },

  segmental_ecw_tbw_right_leg: {
    coordinates: ["I", "V"],
    gates: ["TIS", "BCS"],
    interpretation: "Right leg fluid balance — peripheral edema and venous return.",
    healthy_range: { low: 0.36, high: 0.39 },
    direction: "lower_is_better_within_range",
  },

  segmental_ecw_tbw_left_leg: {
    coordinates: ["I", "V"],
    gates: ["TIS", "BCS"],
    interpretation: "Left leg fluid balance — peripheral edema and venous return.",
    healthy_range: { low: 0.36, high: 0.39 },
    direction: "lower_is_better_within_range",
  },

  // ── Derived asymmetry signals ──────────────────────────────────────────

  segmental_phase_angle_asymmetry: {
    coordinates: ["V", "Σ"],
    gates: ["GRIP", "CLI"],
    interpretation:
      "Localized cellular compromise and autonomic asymmetry. Left-right phase angle differences reveal regional tissue quality divergence.",
    direction: "lower_is_better",
    trigger: "Flag when left-right difference exceeds 0.3 at 50kHz",
  },

  // ── Impedance ──────────────────────────────────────────────────────────

  whole_body_impedance_5khz: {
    coordinates: ["I", "V"],
    gates: ["TIS", "BCS"],
    interpretation:
      "Low-frequency impedance reflects extracellular resistance — elevated values suggest dehydration or tissue edema.",
    direction: "lower_is_better_within_range",
    units: "Ω",
  },

  whole_body_impedance_50khz: {
    coordinates: ["I"],
    gates: ["TIS"],
    interpretation:
      "Mid-frequency impedance crosses cell membranes — the ratio of 5kHz/50kHz impedance helps derive phase angle.",
    direction: "lower_is_better_within_range",
    units: "Ω",
  },
};

/**
 * Canonical name mappings for InBody raw extracted names → terrain map keys.
 * Used by process-lab-pdf to normalize InBody observations.
 */
export const INBODY_CANONICAL_NAMES: Record<string, string> = {
  // Phase angle
  "phase angle - whole body": "phase_angle_whole_body",
  "whole body phase angle": "phase_angle_whole_body",
  "phase angle": "phase_angle_whole_body",

  // Visceral fat
  "visceral fat area": "visceral_fat_area",
  "vfa": "visceral_fat_area",

  // Skeletal muscle mass
  "skeletal muscle mass": "skeletal_muscle_mass",
  "smm": "skeletal_muscle_mass",

  // ECW/TBW
  "ecw/tbw": "ecw_tbw_ratio",
  "ecw/tbw ratio": "ecw_tbw_ratio",

  // BMR
  "basal metabolic rate": "basal_metabolic_rate",
  "bmr": "basal_metabolic_rate",

  // Body fat
  "percent body fat": "body_fat_percent",
  "pbf": "body_fat_percent",
  "body fat percentage": "body_fat_percent",

  // Fat-free mass
  "fat free mass": "fat_free_mass",
  "ffm": "fat_free_mass",

  // Dry lean mass
  "dry lean mass": "dry_lean_mass",

  // Body fat mass
  "body fat mass": "body_fat_mass",

  // Segmental lean
  "right arm lean mass": "segmental_lean_right_arm",
  "right arm": "segmental_lean_right_arm",
  "left arm lean mass": "segmental_lean_left_arm",
  "left arm": "segmental_lean_left_arm",
  "trunk lean mass": "segmental_lean_trunk",
  "trunk": "segmental_lean_trunk",
  "right leg lean mass": "segmental_lean_right_leg",
  "right leg": "segmental_lean_right_leg",
  "left leg lean mass": "segmental_lean_left_leg",
  "left leg": "segmental_lean_left_leg",

  // Segmental ECW/TBW
  "right arm ecw/tbw": "segmental_ecw_tbw_right_arm",
  "left arm ecw/tbw": "segmental_ecw_tbw_left_arm",
  "trunk ecw/tbw": "segmental_ecw_tbw_trunk",
  "right leg ecw/tbw": "segmental_ecw_tbw_right_leg",
  "left leg ecw/tbw": "segmental_ecw_tbw_left_leg",

  // Impedance
  "impedance 5khz - whole body": "whole_body_impedance_5khz",
  "impedance 50khz - whole body": "whole_body_impedance_50khz",
  "whole body impedance at 5khz": "whole_body_impedance_5khz",
  "whole body impedance at 50khz": "whole_body_impedance_50khz",
};

/**
 * Alias used by the generate-terrain-render edge function. Mirrors
 * INBODY_CANONICAL_NAMES and is exported under both names so the
 * canonical substrate satisfies every consumer.
 */
export const INBODY_NAME_LOOKUP: Record<string, string> = INBODY_CANONICAL_NAMES;

/**
 * Resolve a raw extracted InBody marker name (canonical key or human
 * variant) to its terrain-map entry. Returns null when no mapping exists.
 */
export function resolveInBodyMapping(
  canonicalName: string,
): InBodyTerrainEntry | null {
  if (!canonicalName) return null;
  if (INBODY_TERRAIN_MAP[canonicalName]) return INBODY_TERRAIN_MAP[canonicalName];
  const key = INBODY_NAME_LOOKUP[canonicalName.toLowerCase()];
  if (key && INBODY_TERRAIN_MAP[key]) return INBODY_TERRAIN_MAP[key];
  return null;
}
