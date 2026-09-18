// ============================================================================
// Patient autonomy action policy (server-owned)
// ----------------------------------------------------------------------------
// Patient Reveal is patient-led. A patient may contribute data, read, ask,
// track, propose and stop WITHOUT any clinician. What a patient may not do is
// certify their own proposal as safe-to-activate. That decision is computed
// here, on the server, from:
//
//   1. a server-owned catalogue of bounded everyday actions (ACTION_TEMPLATES)
//   2. scope rules for the narrow set of actions that belong to a treating
//      clinician (medicines/doses, risky supplements, extreme fasting or
//      training, and interventions contraindicated by this person's own data)
//   3. the existing Experiment Admission Engine (EAE) for contraindications
//      and biomarker binding — reused, not re-implemented
//
// Rules of the road, enforced by tests:
//   • Free text is never proof of safety. A "movement" category or a friendly
//     word cannot make a proposal activatable.
//   • Low confidence / thin evidence is NOT a clinical risk. It never demands
//     a clinician; it demands honest labelling and a tracking path.
//   • Missing data is an explanatory state with a usable next step, never a
//     blanket doctor gate for logging, sleep tracking or symptom tracking.
//   • A hold is scope-specific: it blocks the named action only.
//   • Nothing here establishes clinical validity of the policy itself.
// ============================================================================

import { admitExperiment } from "../aae/experimentAdmission.ts";

export type ActionVerdict = "ADMIT" | "ADMIT_WITH_REVIEW" | "BLOCK";

/** Why an action is not activatable — risk is not the same as uncertainty. */
export type RiskClass =
  | "self_manageable"
  | "evidence_uncertain"
  | "outside_template_bounds"
  | "context_unavailable"
  | "clinician_scope";

export type TemplateCategory =
  | "food"
  | "sleep"
  | "movement"
  | "stress"
  | "timing"
  | "recovery";

export type OutcomeSource = "manual" | "lab" | "inbody" | "fibroscan" | "cie";

export interface TemplateField {
  /** Allowed discrete values. Anything else is out of bounds. */
  choices?: (string | number)[];
  /** Numeric bounds, inclusive. */
  min?: number;
  max?: number;
  required?: boolean;
}

export interface ActionTemplate {
  id: string;
  label: string;
  summary: string;
  category: TemplateCategory;
  /** Observation-only plans change nothing about the body; they only watch. */
  observationOnly: boolean;
  fields: Record<string, TemplateField>;
  allowedOutcomeSources: OutcomeSource[];
  /** Permitted primary-outcome names when the outcome is tracked by hand. */
  manualOutcomes: string[];
  minInterventionDays: number;
  maxInterventionDays: number;
  maxRunInDays: number;
  defaultStopCriteria: string[];
}

// ── The catalogue. Bounded, concrete, everyday. Server-owned. ────────────────
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

// ── The narrow clinician scope ───────────────────────────────────────────────
interface ScopeRule {
  id: string;
  scope: string;
  pattern: RegExp;
  reason: string;
}

export const CLINICIAN_SCOPE_RULES: ScopeRule[] = [
  {
    id: "medication_or_dose",
    scope: "medication_or_treatment_change",
    pattern:
      /\b(medication|medicine|prescri\w*|statin|atorvastatin|rosuvastatin|metformin|insulin|levothyroxine|warfarin|ssri|sertraline|beta.?blocker|amlodipine|lisinopril|semaglutide|tirzepatide|ozempic|mounjaro|titrat\w*|taper\w*|double\s+the\s+dose|stop\s+(?:taking|my)\s+\w+|start\s+taking|\d+(?:\.\d+)?\s*(?:mg|mcg|µg|iu|units)\b)/i,
    reason:
      "This plan changes a medicine or a dose. That decision belongs with your treating clinician.",
  },
  {
    id: "risky_supplement",
    scope: "medication_or_treatment_change",
    pattern:
      /\b(testosterone|anabolic|trenbolone|clenbuterol|dnp|sarms?|peptide|desiccated thyroid|thyroid extract|t3\b|high.?dose\s+(?:niacin|iodine|vitamin\s*[ad])|yohimbine|ephedrine|dmaa)\b/i,
    reason:
      "This involves a substance that is handled like a treatment. A clinician needs to be part of that.",
  },
  {
    id: "extreme_fasting",
    scope: "extreme_restriction",
    pattern:
      /\b(water\s*fast|dry\s*fast|prolonged\s*fast|extended\s*fast|multi.?day\s*fast|zero.?calorie|omad|\d{2,}\s*(?:hour|hr|h)\s*fast|fast(?:ing)?\s*(?:for\s*)?\d{2,}\s*(?:hours?|hrs?|days?))\b/i,
    reason:
      "Long fasts or very low intake are not something to start unsupervised. A clinician needs to be part of that.",
  },
  {
    id: "extreme_training",
    scope: "extreme_exertion",
    pattern:
      /\b(marathon|ultra.?marathon|two.?a.?day|twice\s+daily\s+train\w*|train\w*\s+twice\s+a\s+day|to\s+failure\s+(?:every|daily)|max(?:imal)?\s+effort\s+test|1\s?rm\s+test|vo2\s*max\s+test)\b/i,
    reason:
      "Maximal or very high training loads need clinical clearance before they are started here.",
  },
];

// ── Numeric limits for FREE-FORM proposals only ──────────────────────────────
// These are not the authorization boundary and they are not clinically
// validated thresholds. A free-form proposal is never auto-activatable anyway;
// these rules only decide whether the honest explanation should say "this sits
// with your clinician" instead of "this is your own idea, saved as a proposal".
//
// They are deliberately typed and scoped, so an ordinary value in one kind of
// plan cannot be read as an extreme value in another: a 480-minute sleep window
// is not a 480-minute training session.
const FREEFORM_NUMERIC_LIMITS: {
  path: string;
  max: number;
  categories: TemplateCategory[] | "any";
  scope: string;
  reason: string;
}[] = [
  {
    path: "fasting_hours",
    max: 16,
    categories: "any",
    scope: "extreme_restriction",
    reason: "A fasting window this long needs clinical involvement.",
  },
  {
    path: "duration_min",
    max: 180,
    // Session length only. Sleep, recovery and timing plans measure a window,
    // not exertion, so this rule does not apply to them.
    categories: ["movement"],
    scope: "extreme_exertion",
    reason: "A single training session this long is beyond an everyday self-managed action.",
  },
  {
    path: "sessions_per_week",
    max: 10,
    categories: ["movement"],
    scope: "extreme_exertion",
    reason: "This training frequency is beyond an everyday self-managed action.",
  },
  {
    path: "calorie_deficit",
    max: 750,
    categories: "any",
    scope: "extreme_restriction",
    reason: "A deficit this large is not a self-managed everyday action.",
  },
];

export interface ProposalPrimaryOutcome {
  source: OutcomeSource;
  name: string;
  unit?: string | null;
  direction: "increase" | "decrease" | "stabilize";
  cadence: "daily" | "per_session" | "weekly";
}

export interface ProposalForReview {
  template_id?: string | null;
  lever: string;
  rationale: string;
  perturbation_category: string;
  intervention: Record<string, unknown>;
  primary_outcome: ProposalPrimaryOutcome;
  secondary_outcomes?: unknown[];
  hold_stable?: string[];
  allowed_cointerventions?: string[];
  stop_criteria?: string[];
  contraindications?: string[];
  run_in_days: number;
  intervention_days: number;
  washout_days?: number | null;
  predicted_deltas?: { biomarker: string; confidence?: number }[];
  /**
   * Confidence recorded by the server when the source suggestion was generated.
   * It expresses how sure the prediction is, and it NEVER decides whether the
   * action is safe or "well supported" for activation purposes.
   */
  confidence?: number | null;
  hypothesis_question?: string;
  /** Patient's own words, kept for reading. Never part of executable content. */
  patient_note?: string | null;
}

export interface AdmissionContext {
  biomarkers: string[];
  flags: string[];
  /** False when the trusted context could not be read. Unknown, not clear. */
  available: boolean;
  /** An unresolved CIE 3.3 positive sentinel handoff. */
  cieSafetyHold: boolean;
  /** A clinician permitted resumption; the patient's safety recheck is pending. */
  cieRecheckPending: boolean;
  /** An admin viewing a patient's account has access, never clinical authority. */
  isViewAs?: boolean;
  /**
   * The verdict already recorded on the owner-verified source suggestion. A
   * template id can never launder a held suggestion into an executable plan.
   */
  sourceCard?: {
    verdict?: string | null;
    patient_safe?: boolean | null;
    safety_flags?: string[] | null;
  } | null;
}

export interface ActionAssessment {
  verdict: ActionVerdict;
  activation_allowed: boolean;
  clinician_review_required: boolean;
  risk_class: RiskClass;
  scope: string;
  template_id: string | null;
  observation_only: boolean;
  safety_flags: string[];
  evidence_label: "well_supported" | "exploratory" | "speculative";
  unbound_outcomes: string[];
  reasons: string[];
  next_steps: string[];
  patient_message: string;
  /** What remains available regardless of this decision. */
  still_available: string[];
  /** True when the decision was computed without readable clinical context. */
  context_available: boolean;
}

const ALWAYS_AVAILABLE = [
  "read your own information",
  "ask questions about it",
  "track symptoms and measures",
  "propose a correction or an idea",
  "stop anything you have started",
];

/**
 * Everything a reviewer must see: the lever, the rationale, every nested
 * intervention value, the stop criteria, predictions and the outcome. Editing a
 * nested field therefore changes the assessed text, so an edit cannot inherit
 * the previous decision. This text EXPLAINS holds; it does not authorize
 * anything — authorization comes from the canonical template path below.
 */
export function collectProposalText(p: ProposalForReview): string {
  const parts: string[] = [
    p.lever ?? "",
    p.rationale ?? "",
    p.hypothesis_question ?? "",
    p.perturbation_category ?? "",
    p.patient_note ?? "",
  ];
  const walk = (value: unknown) => {
    if (value == null) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      parts.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      parts.push(key.replace(/_/g, " "));
      walk(nested);
    }
  };
  walk(p.intervention);
  walk(p.stop_criteria ?? []);
  walk(p.hold_stable ?? []);
  walk(p.allowed_cointerventions ?? []);
  walk(p.secondary_outcomes ?? []);
  walk(p.primary_outcome ?? {});
  walk(p.contraindications ?? []);
  walk(p.predicted_deltas ?? []);
  return parts.filter(Boolean).join(" \n ");
}

function freeformNumericViolations(p: ProposalForReview) {
  const hits: { scope: string; reason: string }[] = [];
  const intervention = (p.intervention ?? {}) as Record<string, unknown>;
  const category = p.perturbation_category as TemplateCategory;
  for (const limit of FREEFORM_NUMERIC_LIMITS) {
    if (limit.categories !== "any" && !limit.categories.includes(category)) continue;
    const value = exactNumber(intervention[limit.path]);
    if (value != null && value > limit.max) {
      hits.push({ scope: limit.scope, reason: limit.reason });
    }
  }
  return hits;
}

/**
 * Exact numeric parsing. `"20 arbitrary text"` is NOT twenty — it is invalid.
 * Only a finite number, or a string that is entirely a number, is accepted.
 */
export function exactNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && /^-?\d+(\.\d+)?$/.test(raw.trim())) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ── Canonical, server-owned executable actions ───────────────────────────────
// Automatic execution is only ever a canonical action the server itself built
// from a catalogue entry plus strictly typed bounded parameters. The patient
// chooses a template and its parameters; the server writes the words.

export interface CanonicalActionRequest {
  template_id: string;
  intervention: Record<string, unknown>;
  primary_outcome: { source?: unknown; name?: unknown; direction?: unknown; cadence?: unknown };
  intervention_days?: unknown;
  run_in_days?: unknown;
  /** The patient's own wording, preserved but never executable. */
  patient_note?: string | null;
}

export interface CanonicalActionResult {
  ok: boolean;
  /** Present when ok: the executable proposal, authored by the server. */
  proposal: ProposalForReview | null;
  problems: string[];
}

const ALLOWED_DIRECTIONS = new Set(["increase", "decrease", "stabilize"]);
const ALLOWED_CADENCES = new Set(["daily", "per_session", "weekly"]);

export function buildCanonicalAction(req: CanonicalActionRequest): CanonicalActionResult {
  const problems: string[] = [];
  const template = findTemplate(req.template_id);
  if (!template) {
    return { ok: false, proposal: null, problems: ["That ready-made plan does not exist."] };
  }

  // 1. Parameters: only the template's own fields, strictly typed and bounded.
  const supplied = (req.intervention ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(supplied)) {
    if (!template.fields[key]) {
      problems.push(`"${key.replace(/_/g, " ")}" is not part of this ready-made plan.`);
    }
  }
  const intervention: Record<string, string | number> = {};
  for (const [key, field] of Object.entries(template.fields)) {
    const value = supplied[key];
    if (value == null) {
      if (field.required) problems.push(`${key.replace(/_/g, " ")} is missing.`);
      continue;
    }
    if (field.choices) {
      const match = field.choices.find((choice) => String(choice) === String(value));
      if (match == null) {
        problems.push(`"${String(value)}" is not one of the allowed options for ${key.replace(/_/g, " ")}.`);
        continue;
      }
      intervention[key] = match as string | number;
      continue;
    }
    const numeric = exactNumber(value);
    if (numeric == null) {
      problems.push(`${key.replace(/_/g, " ")} needs to be a plain number.`);
      continue;
    }
    if (field.min != null && numeric < field.min) {
      problems.push(`${key.replace(/_/g, " ")} is below the range of this ready-made plan.`);
      continue;
    }
    if (field.max != null && numeric > field.max) {
      problems.push(`${key.replace(/_/g, " ")} is above the range of this ready-made plan.`);
      continue;
    }
    intervention[key] = numeric;
  }

  // 2. Outcome: from the template's own allowed set only.
  const source = String(req.primary_outcome?.source ?? "manual") as OutcomeSource;
  const name = String(req.primary_outcome?.name ?? "");
  if (!template.allowedOutcomeSources.includes(source)) {
    problems.push("The thing being watched is not one this ready-made plan supports.");
  }
  if (source === "manual" && !template.manualOutcomes.includes(name)) {
    problems.push(`"${name}" is not one of the things this ready-made plan tracks.`);
  }
  const direction = String(req.primary_outcome?.direction ?? "stabilize");
  const cadence = String(req.primary_outcome?.cadence ?? "daily");
  if (!ALLOWED_DIRECTIONS.has(direction)) problems.push("That direction is not one we can track.");
  if (!ALLOWED_CADENCES.has(cadence)) problems.push("That logging rhythm is not one we support.");

  // 3. Duration: inside the template's own window.
  const days = exactNumber(req.intervention_days) ?? template.minInterventionDays;
  if (days < template.minInterventionDays || days > template.maxInterventionDays) {
    problems.push(
      `This plan runs between ${template.minInterventionDays} and ${template.maxInterventionDays} days.`,
    );
  }
  const runIn = exactNumber(req.run_in_days) ?? 0;
  if (runIn < 0 || runIn > template.maxRunInDays) {
    problems.push(`The settling-in period for this plan is at most ${template.maxRunInDays} days.`);
  }

  if (problems.length > 0) return { ok: false, proposal: null, problems };

  // 4. The server authors every word of the executable content.
  const proposal: ProposalForReview = {
    template_id: template.id,
    lever: template.label,
    rationale: template.summary,
    hypothesis_question: `What happens to ${name.replace(/_/g, " ")} when I follow "${template.label}"?`,
    perturbation_category: template.category,
    intervention,
    primary_outcome: {
      source,
      name,
      unit: null,
      direction: direction as ProposalPrimaryOutcome["direction"],
      cadence: cadence as ProposalPrimaryOutcome["cadence"],
    },
    secondary_outcomes: [],
    hold_stable: [],
    allowed_cointerventions: [],
    stop_criteria: [...template.defaultStopCriteria],
    contraindications: [],
    run_in_days: runIn,
    intervention_days: days,
    washout_days: null,
    predicted_deltas: [],
    confidence: null,
    patient_note: typeof req.patient_note === "string" ? req.patient_note.slice(0, 2000) : null,
  };
  return { ok: true, proposal, problems: [] };
}

/**
 * A stored protocol is executable only if it is byte-identical to what the
 * server would author today for the same template and parameters. This is the
 * authorization boundary — not a regex over prose.
 */
export function matchesCanonicalAction(p: ProposalForReview): { ok: boolean; problems: string[] } {
  if (!p.template_id) return { ok: false, problems: ["This is not a ready-made plan."] };
  const rebuilt = buildCanonicalAction({
    template_id: p.template_id,
    intervention: p.intervention ?? {},
    primary_outcome: p.primary_outcome ?? ({} as ProposalPrimaryOutcome),
    intervention_days: p.intervention_days,
    run_in_days: p.run_in_days,
    patient_note: p.patient_note ?? null,
  });
  if (!rebuilt.ok || !rebuilt.proposal) return { ok: false, problems: rebuilt.problems };
  const strip = (x: ProposalForReview) => ({ ...x, patient_note: null, confidence: null, predicted_deltas: [] });
  const same = JSON.stringify(strip(rebuilt.proposal)) === JSON.stringify(strip(p));
  return {
    ok: same,
    problems: same ? [] : ["This plan's content no longer matches the ready-made plan it claims to be."],
  };
}

export function assessProposal(p: ProposalForReview, ctx: AdmissionContext): ActionAssessment {
  const text = collectProposalText(p);
  const biomarkers = new Set(ctx.biomarkers ?? []);
  const flags = new Set(ctx.flags ?? []);

  // Reuse EAE unchanged for contraindications and biomarker binding. The full
  // proposal text (not just the title) is what gets checked.
  const eae = admitExperiment(
    {
      lever: text,
      rationale: p.rationale ?? "",
      predicted_deltas: (p.predicted_deltas ?? []).map((d) => ({
        biomarker: d.biomarker,
        direction: "stabilize" as const,
        confidence: d.confidence,
      })),
      horizon_days: p.intervention_days ?? 0,
      // Deliberately fixed: a confidence number must never be able to buy a
      // stronger evidence label for activation purposes.
      confidence: 0.5,
    },
    biomarkers,
    flags,
  );

  const scopeHits = CLINICIAN_SCOPE_RULES.filter((rule) => rule.pattern.test(text));
  const template = findTemplate(p.template_id);
  const numericHits = template ? [] : freeformNumericViolations(p);
  const canonical = template ? matchesCanonicalAction(p) : null;
  const sourceCardHeld = Boolean(
    ctx.sourceCard &&
      (ctx.sourceCard.verdict === "BLOCK" ||
        ctx.sourceCard.patient_safe === false ||
        (ctx.sourceCard.safety_flags ?? []).length > 0),
  );

  const outcome = p.primary_outcome;
  const unbound_outcomes: string[] = [];
  if (outcome && outcome.source !== "manual") {
    const norm = (outcome.name ?? "").toLowerCase().replace(/[\s_]+/g, "");
    const bound = [...biomarkers].some((b) => {
      const bn = b.toLowerCase().replace(/[\s_]+/g, "");
      return bn === norm || bn.includes(norm) || norm.includes(bn);
    });
    if (!bound && norm) unbound_outcomes.push(outcome.name);
  }

  const base = {
    template_id: template?.id ?? null,
    observation_only: template?.observationOnly ?? false,
    safety_flags: eae.safety_flags,
    evidence_label: eae.evidence_label,
    unbound_outcomes,
    still_available: ALWAYS_AVAILABLE,
    context_available: ctx.available,
  };

  // 0. An unresolved CIE 3.3 positive sentinel holds anything that changes the
  //    body. Tracking, reading and asking are untouched.
  if (ctx.cieSafetyHold && !template?.observationOnly) {
    return {
      ...base,
      verdict: "BLOCK",
      activation_allowed: false,
      clinician_review_required: true,
      risk_class: "clinician_scope",
      scope: "cie_safety_handoff",
      reasons: [
        "Your intake raised something that is being handed to a clinician, so new plans that change anything are on hold.",
      ],
      next_steps: [
        "Follow the safety instructions already shown to you.",
        "Tracking, reading and asking questions all stay open.",
      ],
      patient_message:
        "While that safety item is open, starting a plan that changes something is on hold. Everything you read, ask and track continues.",
    };
  }

  // 1. A held suggestion stays held, whatever it is turned into.
  if (sourceCardHeld) {
    return {
      ...base,
      verdict: "BLOCK",
      activation_allowed: false,
      clinician_review_required: true,
      risk_class: "clinician_scope",
      scope: "source_suggestion_held",
      safety_flags: [...new Set([...(ctx.sourceCard?.safety_flags ?? []), ...eae.safety_flags])],
      reasons: [
        "The suggestion this came from is already held for safety, so building a plan from it does not release it.",
      ],
      next_steps: [
        "Keep it saved and bring it to your clinician.",
        "You can start any of the ready-made plans right now instead.",
      ],
      patient_message:
        "This one came from a suggestion that is held for safety, so it is saved rather than started. Only this action is affected.",
    };
  }

  // 2. Contraindicated by this person's own data — never auto-activated.
  if (eae.safety_flags.length > 0) {
    return {
      ...base,
      verdict: "BLOCK",
      activation_allowed: false,
      clinician_review_required: true,
      risk_class: "clinician_scope",
      scope: "contraindicated_for_this_person",
      reasons: eae.safety_flags,
      next_steps: [
        "Keep this saved — it stays here as a proposal.",
        "Bring it to your clinician before starting it.",
        "Meanwhile you can still track the same thing by hand.",
      ],
      patient_message:
        "Your own information says this particular plan should not be started on your own. Everything else here is unaffected.",
    };
  }

  // 3. Inside a clinician's scope — saved and discussable, not activatable.
  if (scopeHits.length > 0 || numericHits.length > 0) {
    return {
      ...base,
      verdict: "ADMIT_WITH_REVIEW",
      activation_allowed: false,
      clinician_review_required: true,
      risk_class: "clinician_scope",
      scope: scopeHits[0]?.scope ?? numericHits[0]?.scope ?? "medication_or_treatment_change",
      reasons: [...scopeHits.map((s) => s.reason), ...numericHits.map((n) => n.reason)],
      next_steps: [
        "This is saved exactly as you wrote it — nothing was changed or deleted.",
        "Discuss it with your clinician before doing it.",
        "You can start any of the ready-made plans right now instead.",
      ],
      patient_message:
        "This one belongs in a conversation with your clinician, so it is not something to start here. Only this action is held — reading, asking, tracking and your other plans all continue.",
    };
  }

  // 4. An admin looking at this account can read and prepare, never activate.
  if (ctx.isViewAs) {
    return {
      ...base,
      verdict: "ADMIT_WITH_REVIEW",
      activation_allowed: false,
      clinician_review_required: false,
      risk_class: "evidence_uncertain",
      scope: "view_as_session",
      reasons: ["A support session viewing this account cannot start a plan on the person's behalf."],
      next_steps: ["The account holder can start this from their own device."],
      patient_message: "Saved as a draft. Starting a plan is the account holder's decision.",
    };
  }

  // 5. Not a canonical, server-authored action — savable and discussable, but
  //    never executable. Flags and free text cannot promote it.
  if (!template || !canonical?.ok) {
    return {
      ...base,
      verdict: "ADMIT_WITH_REVIEW",
      activation_allowed: false,
      clinician_review_required: false,
      risk_class: template ? "outside_template_bounds" : "evidence_uncertain",
      scope: template ? "outside_ready_made_bounds" : "not_a_ready_made_plan",
      reasons:
        canonical?.problems?.length
          ? canonical.problems
          : [
              "This is your own idea rather than one of the ready-made plans, so it is saved as a proposal rather than started automatically.",
            ],
      next_steps: [
        "Keep it as a proposal, read it back and ask questions about it here.",
        "Edit it and submit again — that re-checks it from scratch.",
        "Or start a ready-made plan right away.",
      ],
      patient_message: template
        ? "This version sits outside the ready-made plan's range, so it is saved as your proposal rather than started. Bring the settings back inside the range and it can start immediately."
        : "Saved as your proposal — yours to read, edit and ask about. It is not running. You can start one of the ready-made plans whenever you like.",
    };
  }

  // 6. Observation-only plans need nothing from anyone — including readable
  //    clinical context. Watching changes nothing.
  if (template.observationOnly) {
    return {
      ...base,
      verdict: "ADMIT",
      activation_allowed: true,
      clinician_review_required: false,
      risk_class: "self_manageable",
      scope: "none",
      reasons: ["Tracking changes nothing about your body, so it starts immediately."],
      next_steps: ["Log it each day; the picture becomes readable as entries build up."],
      patient_message: "Ready to start. You are only watching — nothing is being changed.",
    };
  }

  // 7. Context could not be read. Unknown is not clearance, and it is not a
  //    doctor gate either: tracking is still open and this is retryable.
  if (!ctx.available) {
    return {
      ...base,
      verdict: "ADMIT_WITH_REVIEW",
      activation_allowed: false,
      clinician_review_required: false,
      risk_class: "context_unavailable",
      scope: "safety_check_unavailable",
      reasons: [
        "We could not read your own information just now, so the safety check for this plan could not be completed.",
      ],
      next_steps: [
        "Try again in a few minutes — this is usually temporary.",
        "You can start tracking the same thing today; that needs no check.",
      ],
      patient_message:
        "We could not complete the safety check because your information could not be read just now. It is saved, and you can try again shortly.",
    };
  }

  // 8. A bounded everyday action whose outcome we cannot yet read from data.
  if (unbound_outcomes.length > 0) {
    return {
      ...base,
      verdict: "ADMIT_WITH_REVIEW",
      activation_allowed: false,
      clinician_review_required: false,
      risk_class: "evidence_uncertain",
      scope: "outcome_not_readable_yet",
      reasons: [
        `We cannot read "${unbound_outcomes[0]}" from your information yet, so there would be nothing to compare against.`,
      ],
      next_steps: [
        "Switch what you are watching to something you log by hand, and start today.",
        "Or upload the result that contains it, then start.",
      ],
      patient_message:
        "The plan itself is fine — we just cannot yet read the thing it is meant to move. Pick something you can log by hand and it starts immediately.",
    };
  }

  // 9. Ready to start, with honest calibration about how sure we are.
  return {
    ...base,
    verdict: "ADMIT",
    activation_allowed: true,
    clinician_review_required: false,
    risk_class: "self_manageable",
    scope: "none",
    reasons: [
      `Everyday, reversible, and exactly as written in "${template.label}".`,
      "How much this moves for you is genuinely uncertain — that is what we are finding out.",
    ],
    next_steps: [
      "Start it, log each day, and we compare when there is enough to read.",
      "Stop it whenever you want; that never needs anyone's permission.",
    ],
    patient_message: "Ready to start now.",
  };
}
