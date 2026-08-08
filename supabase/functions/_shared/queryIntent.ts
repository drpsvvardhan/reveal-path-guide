// ============================================================================
// supabase/functions/_shared/queryIntent.ts
// ----------------------------------------------------------------------------
// Deterministic query-intent classifier (Ask My Twin, Release 0).
//
// Telemetry doctrine: NO LLM call in the patient answer path just to
// classify intent. This is a first-match rule cascade — cheap, auditable,
// and stamped onto the Answer Receipt (query_intent + the matched rule) so
// product learning is a read-model over receipts. A richer asynchronous
// classifier can re-classify offline later; it never runs inline.
//
// Rule order matters and is part of the contract: more specific intents
// (WHAT_CHANGED, DOCTOR_PREP, MEDICATION, domain signals) match before
// generic shapes (TRAJECTORY, VALUE, WHY). Classification is presentation/
// telemetry only — it never affects what the runtime may say.
// ============================================================================

export const QUERY_INTENTS = [
  "WHAT_CHANGED",
  "DOCTOR_PREP",
  "MEDICATION",
  "GLUCOSE",
  "SLEEP",
  "FOOD",
  "GENETICS",
  "AGING",
  "UNCERTAINTY",
  "TRAJECTORY",
  "VALUE",
  "WHY",
  "OTHER",
] as const;

export type QueryIntent = (typeof QUERY_INTENTS)[number];

export interface QueryIntentResult {
  intent: QueryIntent;
  /** Name of the first rule that matched; null for the OTHER fallback. */
  matched_rule: string | null;
}

interface IntentRule {
  intent: QueryIntent;
  name: string;
  pattern: RegExp;
}

// First match wins — ordered most-specific first.
const RULES: IntentRule[] = [
  {
    intent: "WHAT_CHANGED",
    name: "what_changed",
    pattern:
      /\bwhat('s| has| is)? (changed|different|new)\b|\bsince (my|the) last (visit|twin|report|version)\b|\bany(thing)? new\b/i,
  },
  {
    intent: "DOCTOR_PREP",
    name: "doctor_prep",
    pattern:
      /\b(ask|tell|discuss with|bring up with|question[s]? for) (my |the )?(doctor|physician|cardiologist|clinician|specialist)\b|\b(next|upcoming) (visit|appointment)\b/i,
  },
  {
    intent: "MEDICATION",
    name: "medication",
    pattern:
      /\b(medication|medicine|drug|statin|metformin|prescription|supplement|pill|dose|dosage|side effect)s?\b/i,
  },
  {
    intent: "GLUCOSE",
    name: "glucose",
    pattern:
      /\b(glucose|blood sugar|cgm|hba1c|a1c|insulin|diabet(es|ic)|glyc(a?emic|emia))\b/i,
  },
  {
    intent: "SLEEP",
    name: "sleep",
    pattern: /\b(sleep|insomnia|waking up|rem|deep sleep|oura|apnea)\b/i,
  },
  {
    intent: "FOOD",
    name: "food",
    pattern:
      /\b(food|diet|eat(ing)?|nutrition|meal|breakfast|lunch|dinner|snack|fasting|protein|carb(ohydrate)?s?|sugar intake)\b/i,
  },
  {
    intent: "GENETICS",
    name: "genetics",
    pattern:
      /\b(gene|genetic|genome|genomic|dna|variant|mutation|hereditary|apoe|pgx|polygenic|prs)s?\b/i,
  },
  {
    intent: "AGING",
    name: "aging",
    pattern:
      /\b(aging|ageing|biological age|longevity|lifespan|epigenetic clock|organ age)\b/i,
  },
  {
    intent: "UNCERTAINTY",
    name: "uncertainty",
    pattern:
      /\b(not sure|unsure|uncertain|don'?t know|unknown|unresolved|contradiction|how (sure|confident))\b|\bwhat (do(es)?n'?t|can'?t) (you|my twin) (know|answer|see)\b/i,
  },
  {
    intent: "TRAJECTORY",
    name: "trajectory",
    pattern:
      /\b(over time|trend(ing)?|trajectory|history of|past (year|month|week)s?|last \d+ (day|week|month|year)s?|improv(e|ed|ing)|wors(e|ened|ening)|going (up|down))\b/i,
  },
  {
    intent: "VALUE",
    name: "value",
    pattern:
      /\bwhat('s| is| are| was| were)? my\b|\bhow (is|are|was|were) my\b|\b(current|latest|recent) (value|level|number|result|reading)s?\b/i,
  },
  {
    intent: "WHY",
    name: "why",
    pattern: /\bwhy\b|\bwhat('s| is) causing\b|\bhow come\b|\breason for\b/i,
  },
];

export function classifyQueryIntent(question: string): QueryIntentResult {
  const q = (question ?? "").trim();
  if (q === "") return { intent: "OTHER", matched_rule: null };
  for (const rule of RULES) {
    if (rule.pattern.test(q)) {
      return { intent: rule.intent, matched_rule: rule.name };
    }
  }
  return { intent: "OTHER", matched_rule: null };
}
