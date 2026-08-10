// supabase/functions/_shared/dosePolicy.ts
//
// Special case of clinical authority policy: emergency-shaped queries.
// Per CodexOS adjudication: do not encode toxicology thresholds as
// doctrine. The trigger is intent-shaped, not dose-shaped.

// Stamped into every Answer Receipt. Bump on any change to the patterns,
// routing modes, or fallback text in this module.
export const DOSE_POLICY_VERSION = "1.1.0";

export interface DosePolicyContext {
  userMentionedDose: boolean;
  userDoseTokens: string[];
  emergencyIntentPresent: boolean;
  allowedDoseTokens: string[];
  routingMode: "none" | "emergency_routing" | "no_dose_fallback";
}

const EMERGENCY_INTENT_PATTERNS: RegExp[] = [
  /\boverdose\b/i,
  /\btoo\s+much\b/i,
  /\baccidentally\s+(?:took|gave|swallowed|ingested)\b/i,
  /\bwrong\s+dose\b/i,
  /\bpoison(?:ed|ing|ous)?\b/i,
  /\bingested\b/i,
  /\bdouble\s+(?:dose|dosed)\b/i,
  /\bdangerous\s+amount\b/i,
  /\bchild\s+(?:took|swallowed|ate|ingested|got\s+into)\b/i,
  /\b(?:dog|cat|pet)\s+(?:ate|swallowed|ingested|got\s+into)\b/i,
  /\b(?:severe|serious)\s+(?:symptoms|reaction|side\s+effects)\b/i,
  /\bcan(?:'t|not)\s+(?:wake|be\s+woken|be\s+awakened)\b/i,
  /\bseiz(?:ure|ing)\b/i,
  /\btrouble\s+breathing\b/i,
  /\bcollapsed?\b/i,
];

const DOSE_TOKEN_PATTERN = new RegExp(
  String.raw`\b\d{1,5}(?:[.,]\d{1,3})?\s*(?:` +
    String.raw`IU|mg|mcg|µg|ug|g|ng|tsp|tbsp|ml|cc|kg|` +
    String.raw`grams?|milligrams?|micrograms?|nanograms?|` +
    String.raw`drops?|tablets?|capsules?|softgels?|units?|servings?|pills?|doses?` +
    String.raw`)(?![a-zA-Z])(?!\s*\/)`,
  "gi",
);

export function detectEmergencyIntent(userMessage: string): boolean {
  return EMERGENCY_INTENT_PATTERNS.some((p) => p.test(userMessage));
}

export function extractDoseTokens(text: string): string[] {
  const matches = text.match(DOSE_TOKEN_PATTERN);
  if (!matches) return [];
  const normalized = matches.map((m) => m.replace(/\s+/g, " ").trim().toLowerCase());
  return Array.from(new Set(normalized));
}

export function computeDosePolicyContext(userMessage: string): DosePolicyContext {
  const userDoseTokens = extractDoseTokens(userMessage);
  const userMentionedDose = userDoseTokens.length > 0;
  const emergencyIntentPresent = detectEmergencyIntent(userMessage);

  let routingMode: DosePolicyContext["routingMode"] = "none";
  let allowedDoseTokens: string[] = [];

  if (emergencyIntentPresent && userMentionedDose) {
    routingMode = "emergency_routing";
    allowedDoseTokens = userDoseTokens;
  } else if (emergencyIntentPresent && !userMentionedDose) {
    routingMode = "emergency_routing";
    allowedDoseTokens = [];
  }

  return {
    userMentionedDose,
    userDoseTokens,
    emergencyIntentPresent,
    allowedDoseTokens,
    routingMode,
  };
}

// Live failure (Aug 10, receipt 283c349f — dose policy 1.1.0): a fluent,
// correct CGM answer was replaced by the no-dose fallback because it
// faithfully described the measured food log — "protein supplements: 22
// servings in two weeks". A quantity the model REPORTS from the patient's
// own data is not a dose the model DIRECTS. Police directives, not
// descriptions: a dose token violates only when its own sentence tells the
// patient to take/change/limit an amount.
const DOSE_DIRECTIVE_CUES =
  /\b(?:take|taking|start|stop|begin|increase|decrease|reduce|lower|raise|add|switch|swap|replace|try|aim(?:\s+for)?|target|limit|restrict|cut(?:\s+(?:back|down))?|recommend(?:ed|ing)?|suggest(?:ed|ing)?|consider|should|prescrib\w*|up\s+to|no\s+more\s+than)\b/i;

export function validateDoseTokens(
  output: string,
  context: DosePolicyContext,
): { valid: boolean; unauthorizedTokens: string[] } {
  const allowed = new Set(context.allowedDoseTokens.map((t) => t.toLowerCase()));
  const unauthorized: string[] = [];
  for (const sentence of output.split(/(?<=[.!?])\s+|\n+/)) {
    const tokens = extractDoseTokens(sentence);
    if (tokens.length === 0) continue;
    // Descriptive sentence (no directive cue): reporting measured amounts
    // from the patient's own record is faithful interpretation, not dosing.
    // NEVER lenient under emergency intent — in an overdose-shaped
    // conversation, even "standard doses range from 1mg to 5mg" is dosing
    // information that must not cross.
    if (
      !context.emergencyIntentPresent &&
      !DOSE_DIRECTIVE_CUES.test(sentence)
    ) {
      continue;
    }
    for (const t of tokens) {
      if (!allowed.has(t.toLowerCase())) unauthorized.push(t);
    }
  }
  return {
    valid: unauthorized.length === 0,
    unauthorizedTokens: Array.from(new Set(unauthorized)),
  };
}

const EMERGENCY_ROUTING_BASE = `If you already took it, contact Poison Control now at 1-800-222-1222 in the U.S., or seek urgent medical care. If there is trouble breathing, collapse, seizure, severe confusion, or the person cannot be awakened, call 911.

I should not determine a safe dose for you in this chat. Please share the product label, amount taken, timing, and symptoms with Poison Control or a clinician.`;

export function buildEmergencyRoutingMessage(context: DosePolicyContext): string {
  if (context.userMentionedDose && context.userDoseTokens[0]) {
    return `You mentioned ${context.userDoseTokens[0]}, which may be a safety concern. ${EMERGENCY_ROUTING_BASE}`;
  }
  return `You mentioned a specific amount that may be a safety concern. ${EMERGENCY_ROUTING_BASE}`;
}

export const NO_DOSE_FALLBACK = `I want to keep this in the right lane. I can help explain what your data may be showing and help you prepare the right question, but I should not tell you to start, stop, switch, increase, reduce, or dose a medication or supplement.

What I can do: explain the relevant signals in your data, describe why this topic may matter, and help you frame a doctor-ready question.`;
