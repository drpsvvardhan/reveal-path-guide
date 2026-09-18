// ============================================================================
// Ready-made plans — client mirror of the server-owned catalogue.
// ----------------------------------------------------------------------------
// This file exists so the patient can SEE and CHOOSE a bounded plan. It has no
// authority: the server re-derives the bounds and the decision from its own
// copy in supabase/functions/_shared/autonomy/actionPolicy.ts. A parity test
// keeps the two in step (src/lib/autonomy/templates.test.ts).
// ============================================================================

export type TemplateCategory =
  | "food"
  | "sleep"
  | "movement"
  | "stress"
  | "timing"
  | "recovery";

export type OutcomeSource = "manual" | "lab" | "inbody" | "fibroscan" | "cie";

export interface TemplateField {
  choices?: (string | number)[];
  min?: number;
  max?: number;
  required?: boolean;
}

export interface ActionTemplate {
  id: string;
  label: string;
  summary: string;
  category: TemplateCategory;
  observationOnly: boolean;
  fields: Record<string, TemplateField>;
  allowedOutcomeSources: OutcomeSource[];
  manualOutcomes: string[];
  minInterventionDays: number;
  maxInterventionDays: number;
  maxRunInDays: number;
  defaultStopCriteria: string[];
}

export const ACTION_TEMPLATES: ActionTemplate[] = [
  {
    id: "morning_walk",
    label: "A walk soon after waking",
    summary:
      "A steady walk within an hour of waking, most days, tracked by hand. Everyday movement at a conversational pace.",
    category: "movement",
    observationOnly: false,
    fields: {
      duration_min: { min: 10, max: 45, required: true },
      timing: { choices: ["morning"], required: true },
      frequency: { choices: ["daily", "5_days_per_week"], required: true },
      intensity: { choices: ["conversational_pace"], required: true },
    },
    allowedOutcomeSources: ["manual", "lab"],
    manualOutcomes: ["energy", "sleep_quality", "mood", "steps", "resting_heart_rate"],
    minInterventionDays: 10,
    maxInterventionDays: 56,
    maxRunInDays: 7,
    defaultStopCriteria: [
      "new chest pain, faintness or breathlessness at rest",
      "a symptom you already track clearly worsens",
    ],
  },
  {
    id: "protein_at_breakfast",
    label: "Protein at breakfast",
    summary:
      "A protein-anchored first meal each day, from ordinary food, within everyday amounts.",
    category: "food",
    observationOnly: false,
    fields: {
      dose: { choices: ["20g_protein", "25g_protein", "30g_protein"], required: true },
      timing: { choices: ["with_breakfast"], required: true },
      frequency: { choices: ["daily"], required: true },
    },
    allowedOutcomeSources: ["manual", "lab"],
    manualOutcomes: ["hunger", "energy", "afternoon_crash", "cravings"],
    minInterventionDays: 10,
    maxInterventionDays: 56,
    maxRunInDays: 7,
    defaultStopCriteria: [
      "new digestive upset that does not settle",
      "a symptom you already track clearly worsens",
    ],
  },
  {
    id: "consistent_sleep_window",
    label: "A consistent sleep window",
    summary:
      "The same bedtime and wake time each day, within a chosen window. No supplements, no restriction.",
    category: "sleep",
    observationOnly: false,
    fields: {
      timing: { choices: ["fixed_bedtime_and_wake"], required: true },
      frequency: { choices: ["daily"], required: true },
      duration_min: { min: 420, max: 540, required: true },
    },
    allowedOutcomeSources: ["manual"],
    manualOutcomes: ["sleep_quality", "energy", "mood", "sleep_hours"],
    minInterventionDays: 10,
    maxInterventionDays: 42,
    maxRunInDays: 7,
    defaultStopCriteria: ["sleep clearly worsens for three nights in a row"],
  },
  {
    id: "evening_screen_curfew",
    label: "An evening screen curfew",
    summary: "Screens off a set time before bed, most evenings.",
    category: "recovery",
    observationOnly: false,
    fields: {
      timing: { choices: ["before_bed"], required: true },
      duration_min: { min: 30, max: 120, required: true },
      frequency: { choices: ["daily", "5_days_per_week"], required: true },
    },
    allowedOutcomeSources: ["manual"],
    manualOutcomes: ["sleep_quality", "sleep_hours", "energy", "mood"],
    minInterventionDays: 10,
    maxInterventionDays: 42,
    maxRunInDays: 7,
    defaultStopCriteria: ["sleep clearly worsens for three nights in a row"],
  },
  {
    id: "strength_twice_weekly",
    label: "Two ordinary strength sessions a week",
    summary:
      "Two moderate strength sessions a week, at an effort you could repeat, never to failure.",
    category: "movement",
    observationOnly: false,
    fields: {
      frequency: { choices: ["2_days_per_week", "3_days_per_week"], required: true },
      duration_min: { min: 20, max: 60, required: true },
      intensity: { choices: ["moderate_repeatable"], required: true },
    },
    allowedOutcomeSources: ["manual", "inbody"],
    manualOutcomes: ["strength_sessions", "energy", "soreness"],
    minInterventionDays: 21,
    maxInterventionDays: 84,
    maxRunInDays: 7,
    defaultStopCriteria: [
      "new chest pain, faintness or breathlessness at rest",
      "joint pain that lasts more than two days",
    ],
  },
  {
    id: "symptom_tracking_only",
    label: "Just track it for a while",
    summary:
      "Change nothing. Log the symptom or measure you care about each day so the picture becomes readable.",
    category: "timing",
    observationOnly: true,
    fields: {
      frequency: { choices: ["daily"], required: true },
    },
    allowedOutcomeSources: ["manual"],
    manualOutcomes: [
      "energy",
      "sleep_quality",
      "mood",
      "pain",
      "bloating",
      "headache",
      "symptom",
      "steps",
      "sleep_hours",
    ],
    minInterventionDays: 7,
    maxInterventionDays: 90,
    maxRunInDays: 0,
    defaultStopCriteria: [],
  },
];

export function findTemplate(id: string | null | undefined): ActionTemplate | null {
  if (!id) return null;
  return ACTION_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Human wording for a stored option value. */
export function optionLabel(value: string | number): string {
  return String(value)
    .replace(/_/g, " ")
    .replace(/(\d+)g protein/, "$1 g of protein")
    .replace(/(\d+) days per week/, "$1 days a week");
}

export interface TemplateDraft {
  template_id: string;
  hypothesis_question: string;
  perturbation_category: TemplateCategory;
  lever: string;
  rationale: string;
  intervention: Record<string, string | number>;
  primary_outcome: {
    source: OutcomeSource;
    name: string;
    unit: string;
    direction: "increase" | "decrease" | "stabilize";
    cadence: "daily" | "per_session" | "weekly";
  };
  run_in_days: number;
  intervention_days: number;
  stop_criteria: string[];
}

/** A starting draft that already sits inside the plan's bounds. */
export function draftFromTemplate(template: ActionTemplate): TemplateDraft {
  const intervention: Record<string, string | number> = {};
  for (const [key, field] of Object.entries(template.fields)) {
    if (field.choices?.length) intervention[key] = field.choices[0];
    else if (field.min != null) intervention[key] = field.min;
  }
  return {
    template_id: template.id,
    hypothesis_question: `How does "${template.label.toLowerCase()}" land for me?`,
    perturbation_category: template.category,
    lever: template.label,
    rationale: template.summary,
    intervention,
    primary_outcome: {
      source: "manual",
      name: template.manualOutcomes[0],
      unit: "",
      direction: template.observationOnly ? "stabilize" : "increase",
      cadence: "daily",
    },
    run_in_days: 0,
    intervention_days: template.minInterventionDays,
    stop_criteria: [...template.defaultStopCriteria],
  };
}
