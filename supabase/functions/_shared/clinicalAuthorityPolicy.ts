// supabase/functions/_shared/clinicalAuthorityPolicy.ts
//
// Constitutional layer of the patient-chat validator.
//
// The patient-chat may increase understanding, but may not transfer
// clinical authority to itself. This module enforces that boundary.
//
// The real violation is not the dose number. The real violation is
// authority transfer. Dose policy (dosePolicy.ts) sits underneath this
// as a special case.

export type AuthorityViolationKind =
  | "dosing_directive"
  | "protocol_directive"
  | "medication_substitution"
  | "escalation_directive"
  | "optimization_claim"
  | "generic_authority";

export interface AuthorityViolation {
  kind: AuthorityViolationKind;
  matched_phrase: string;
  matched_pattern: string;
  sentence: string;
  position: number;
}

export interface RoleValidationResult {
  valid: boolean;
  violations: AuthorityViolation[];
}

// The forbidden authority-transfer patterns. Adding to this list is a
// doctrinal change that should pass through CodexOS, not a routine
// engineering edit.
export const FORBIDDEN_AUTHORITY_PATTERNS: Array<{
  kind: AuthorityViolationKind;
  pattern: RegExp;
  description: string;
}> = [
  {
    kind: "dosing_directive",
    pattern: /\b(you\s+should\s+(?:take|be\s+taking)|i(?:'d|\s+would)\s+recommend\s+(?:you\s+take|taking)|the\s+right\s+dose\s+for\s+you|your\s+(?:correct|appropriate|optimal)\s+dose|take\s+this\s+(?:daily|twice|three\s+times))\b/i,
    description: "personalized dose or dosing schedule",
  },
  {
    kind: "dosing_directive",
    pattern: /\b(start\s+(?:taking\s+)?(?:vitamin|magnesium|omega|iron|zinc|melatonin|vitamin\s*d|b12|coq10|berberine|metformin|statin|aspirin)|begin\s+taking)\b/i,
    description: "directive to start a specific intervention",
  },
  {
    kind: "escalation_directive",
    pattern: /\b(increase\s+(?:to|your\s+dose|your\s+intake)|reduce\s+(?:to|your\s+dose)|titrate\s+(?:up|down|to)|taper\s+(?:up|down|off))\b/i,
    description: "titration or dose escalation directive",
  },
  {
    kind: "medication_substitution",
    pattern: /\b(switch\s+from\s+\w+\s+to\s+\w+|replace\s+(?:your\s+)?\w+\s+with|stop\s+(?:taking\s+)?(?:your\s+)?(?:medication|prescription|pill|drug)|discontinue\s+(?:your\s+)?\w+)\b/i,
    description: "medication substitution or discontinuation",
  },
  {
    kind: "protocol_directive",
    pattern: /\b(your\s+protocol\s+(?:is|should\s+be)|the\s+protocol\s+for\s+you|i(?:'ll|\s+will)\s+create\s+(?:a|your)\s+protocol|here(?:'s|\s+is)\s+your\s+(?:treatment\s+)?(?:plan|protocol))\b/i,
    description: "protocol or treatment plan directive",
  },
  {
    kind: "optimization_claim",
    pattern: /\b((?:this|that)\s+(?:supplement|medication|protocol|intervention)\s+is\s+(?:safe|right|optimal|best)\s+for\s+you|the\s+(?:right|best|optimal)\s+(?:choice|option)\s+for\s+you\s+is|is\s+the\s+(?:right|best|optimal)\s+(?:choice|option)\s+for\s+you)\b/i,
    description: "claim that a specific intervention is right for the patient",
  },
];

function splitSentences(text: string): Array<{ sentence: string; position: number }> {
  const result: Array<{ sentence: string; position: number }> = [];
  const re = /[^.!?\n]+[.!?]+|\S[^.!?\n]*$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const sentence = m[0].trim();
    if (sentence) result.push({ sentence, position: m.index });
  }
  return result;
}

export function validateInterpreterRole(output: string): RoleValidationResult {
  const violations: AuthorityViolation[] = [];
  const sentences = splitSentences(output);

  for (const { sentence, position } of sentences) {
    for (const { kind, pattern, description } of FORBIDDEN_AUTHORITY_PATTERNS) {
      const match = sentence.match(pattern);
      if (match) {
        violations.push({
          kind,
          matched_phrase: match[0],
          matched_pattern: description,
          sentence,
          position,
        });
        break;
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

export const ROLE_VIOLATION_TEMPLATES: Record<AuthorityViolationKind, string> = {
  dosing_directive: `I want to keep this safe and useful. I should not give you a personalized dose or dosing schedule here. What I can do is explain what your data shows, why this option may come up, and what to ask your clinician before deciding.`,

  medication_substitution: `I should not tell you to stop, replace, or switch a medication. That decision needs a clinician who knows your full history. I can help you understand the biological question behind it and prepare a focused discussion for your doctor.`,

  protocol_directive: `I should not turn this into a treatment protocol on my own. I can help map the terrain, explain the trade-offs, and identify what evidence would make a clinician more or less confident.`,

  escalation_directive: `I should not tell you to increase, reduce, or titrate a treatment. I can help you understand the signal we're watching and what change would be worth discussing with your clinician.`,

  optimization_claim: `I should not claim that a specific intervention is "right for you" based only on this chat. I can help explain what your BioTwin currently suggests, what remains uncertain, and what questions would sharpen the decision.`,

  generic_authority: `I want to keep this in the right lane. I can help explain what your data may be showing and help you prepare the right question, but I should not tell you to start, stop, switch, increase, reduce, or dose a medication or supplement.\n\nWhat I can do: explain the relevant signals in your data, describe why this topic may matter, and help you frame a doctor-ready question.`,
};

export function replacementTemplateForViolation(
  violations: AuthorityViolation[],
): string {
  if (violations.length === 0) return ROLE_VIOLATION_TEMPLATES.generic_authority;

  const severityOrder: AuthorityViolationKind[] = [
    "medication_substitution",
    "dosing_directive",
    "escalation_directive",
    "protocol_directive",
    "optimization_claim",
    "generic_authority",
  ];

  for (const kind of severityOrder) {
    if (violations.some((v) => v.kind === kind)) {
      return ROLE_VIOLATION_TEMPLATES[kind];
    }
  }

  return ROLE_VIOLATION_TEMPLATES.generic_authority;
}

export function buildCorrectiveRegenFeedback(
  violations: AuthorityViolation[],
): string {
  const phrases = violations
    .slice(0, 3)
    .map((v) => `- "${v.matched_phrase}" (${v.matched_pattern})`)
    .join("\n");

  return `Your previous response crossed the biological-interpreter / clinical-authority boundary at:

${phrases}

Rewrite the response keeping all the biological interpretation, terrain explanation, and contextualization, but remove any directive language. Do not tell the patient what to take, start, stop, switch, increase, or reduce. Replace any directive sentences with framings the patient could bring to their clinician as a question. Do not add new dose numbers. Preserve the cluster citations.`;
}
