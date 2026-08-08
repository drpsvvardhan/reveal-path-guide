// supabase/functions/_shared/dosePolicy.ts
//
// Special case of clinical authority policy: emergency-shaped queries.
// Per CodexOS adjudication: do not encode toxicology thresholds as
// doctrine. The trigger is intent-shaped, not dose-shaped.

// Stamped into every Answer Receipt. Bump on any change to the patterns,
// routing modes, or fallback text in this module.
export const DOSE_POLICY_VERSION = "1.0.0";

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

export function validateDoseTokens(
  output: string,
  context: DosePolicyContext,
): { valid: boolean; unauthorizedTokens: string[] } {
  const outputTokens = extractDoseTokens(output);
  const allowed = new Set(context.allowedDoseTokens.map((t) => t.toLowerCase()));
  const unauthorized = outputTokens.filter((t) => !allowed.has(t.toLowerCase()));

  return { valid: unauthorized.length === 0, unauthorizedTokens: unauthorized };
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
