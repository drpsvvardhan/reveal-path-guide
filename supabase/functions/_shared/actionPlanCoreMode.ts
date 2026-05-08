// supabase/functions/_shared/actionPlanCoreMode.ts
//
// Converts forbidden-in-Core interventions into interpreter-safe
// alternatives. The constitutional rule: Core mode action plans
// may increase understanding and readiness, but may not transfer
// clinical authority to themselves.

import type { Intervention, InterventionPolicyClass } from "./interventionLibrary.ts";

export interface CoreSafeAction {
  id: string;
  source_intervention_id: string;
  policy_class: InterventionPolicyClass;
  what: string;
  how: string;
  rationale: string;
  doctor_question?: string;
  coordinates: string[];
  sequence_priority: number;
}

export function convertSupplementWithDose(intervention: Intervention): CoreSafeAction {
  const supplementName = extractSupplementName(intervention.what);
  return {
    id: `${intervention.id}_core`,
    source_intervention_id: intervention.id,
    policy_class: "doctor_question",
    what: `Discuss ${supplementName} with your clinician.`,
    how: `Bring your latest lab results and the rationale below to the conversation. Your clinician can determine the right approach for you.`,
    rationale: stripDoseFromRationale(intervention),
    doctor_question: `What ${supplementName} approach is appropriate given my current levels and any other factors you're considering?`,
    coordinates: intervention.coordinates,
    sequence_priority: intervention.sequence_priority,
  };
}

export function convertMedicationChange(intervention: Intervention): CoreSafeAction {
  return {
    id: `${intervention.id}_core`,
    source_intervention_id: intervention.id,
    policy_class: "doctor_question",
    what: `Discuss your current medication with your clinician.`,
    how: `Medication changes need a clinician who knows your full history. Bring this rationale and your symptom log to the conversation.`,
    rationale: stripDoseFromRationale(intervention),
    doctor_question: `Given my current data, would a different medication approach be worth considering for me?`,
    coordinates: intervention.coordinates,
    sequence_priority: intervention.sequence_priority,
  };
}

export function convertTitration(intervention: Intervention): CoreSafeAction {
  return {
    id: `${intervention.id}_core`,
    source_intervention_id: intervention.id,
    policy_class: "doctor_question",
    what: `Discuss whether your current dose is still right for you.`,
    how: `Bring your tracking data — symptoms, labs, and how you're feeling — to your clinician. Dose adjustment is a clinical decision.`,
    rationale: stripDoseFromRationale(intervention),
    doctor_question: `Based on my recent data, should we revisit my current dose?`,
    coordinates: intervention.coordinates,
    sequence_priority: intervention.sequence_priority,
  };
}

export function convertIndividualizedProtocol(intervention: Intervention): CoreSafeAction {
  return {
    id: `${intervention.id}_core`,
    source_intervention_id: intervention.id,
    policy_class: "doctor_question",
    what: `Discuss a coordinated approach with your clinician.`,
    how: `The pattern in your data suggests several connected signals worth addressing together. Bring this rationale to your clinician.`,
    rationale: stripDoseFromRationale(intervention),
    doctor_question: `Given the pattern in my data, would a coordinated plan addressing these signals together be appropriate?`,
    coordinates: intervention.coordinates,
    sequence_priority: intervention.sequence_priority,
  };
}

export function convertToCoreMode(intervention: Intervention): CoreSafeAction {
  switch (intervention.policy_class) {
    case "supplement_with_dose":
      return convertSupplementWithDose(intervention);
    case "medication_change":
      return convertMedicationChange(intervention);
    case "titration":
      return convertTitration(intervention);
    case "individualized_protocol":
      return convertIndividualizedProtocol(intervention);
    default:
      throw new Error(
        `convertToCoreMode called on non-forbidden intervention: ${intervention.id} (${intervention.policy_class})`,
      );
  }
}

// ── Helpers ──

function extractSupplementName(what: string): string {
  const match = what.match(/^(?:Start|Begin|Take|Add)\s+([A-Za-z][A-Za-z0-9\s\-]*?)(?:\s+\d|\s+\(|\s+$|$)/);
  if (match) return match[1].trim().toLowerCase();
  return "this supplement";
}

function stripDoseFromRationale(intervention: Intervention): string {
  const baseRationale = intervention.how || intervention.what || "";
  const DOSE_PATTERN = new RegExp(
    String.raw`\b\d{1,5}(?:[.,]\d{1,3})?\s*(?:IU|mg|mcg|µg|ug|g|ng|tsp|tbsp|ml|cc|kg|grams?|milligrams?|micrograms?|nanograms?|drops?|tablets?|capsules?|softgels?|units?|servings?|pills?|doses?)(?![a-zA-Z])(?!\s*\/)`,
    "gi",
  );
  return baseRationale.replace(DOSE_PATTERN, "[appropriate amount]");
}