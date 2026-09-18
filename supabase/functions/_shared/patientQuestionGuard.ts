/**
 * Deterministic final-output guard for patient-facing suggested questions.
 *
 * Grounding, witness IDs and evidence refs remain intact internally; this guard
 * only governs the strings that are rendered to a patient. Any question that
 * carries an internal identifier or technical marker is dropped rather than
 * mangled, so patients never see broken text.
 */

export const SAFE_FALLBACK_QUESTIONS: readonly string[] = [
  "Tell me what I should be paying attention to right now",
  "What has changed most in my results since last time?",
  "Which of my results is steady and going well?",
  "What is the smallest change that would matter most for me?",
];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/** Bare hex fragments (truncated IDs, sha256 prefixes) of 8+ chars. */
const HEX_FRAGMENT = /\b(?:0x)?[0-9a-f]{8,}\b/i;
/** Internal field / marker vocabulary that must never surface to a patient. */
const INTERNAL_MARKERS =
  /\b(witness[_\s-]?id|witness[_\s-]?ids|witness[_\s-]?object|packet[_\s-]?id|observation[_\s-]?id|source[_\s-]?row[_\s-]?id|caw[_\s-]?id|concept[_\s-]?id|assessment[_\s-]?id|user[_\s-]?id|session[_\s-]?id|request[_\s-]?id|question[_\s-]?instance[_\s-]?hash|registry[_\s-]?seed[_\s-]?version|ontology[_\s-]?version|instrument[_\s-]?version|transformation[_\s-]?version|sha-?256|sha1|md5|state[_\s-]?hash|hash[_\s-]?prefix|uuid|primary key|foreign key|rls|jsonb|select \*|null)\b/i;
/** Citation / template markers such as {cluster:abc} or [[ref:1]] or {{x}}. */
const TEMPLATE_MARKER = /\{[^}]*\}|\[\[|\]\]|<[a-z_]+>/i;

export function containsInternalIdentifier(text: string): boolean {
  return (
    UUID.test(text) ||
    HEX_FRAGMENT.test(text) ||
    INTERNAL_MARKERS.test(text) ||
    TEMPLATE_MARKER.test(text)
  );
}

export interface QuestionGuardResult {
  questions: string[];
  dropped: number;
  usedFallback: boolean;
}

/**
 * Validate and sanitise generated suggested questions.
 * - non-string / empty / whitespace-only values are rejected
 * - questions containing internal identifiers or technical markers are rejected
 * - duplicates are collapsed
 * - if nothing survives, a readable safe fallback is returned
 */
export function sanitizeSuggestedQuestions(
  input: unknown,
  max = 4,
): QuestionGuardResult {
  const raw = Array.isArray(input) ? input : [];
  const kept: string[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const candidate of raw) {
    if (typeof candidate !== "string") {
      dropped++;
      continue;
    }
    const value = candidate.trim().replace(/\s+/g, " ");
    if (value.length === 0) {
      dropped++;
      continue;
    }
    if (containsInternalIdentifier(value)) {
      dropped++;
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);
    kept.push(value);
    if (kept.length >= max) break;
  }

  if (kept.length === 0) {
    return {
      questions: SAFE_FALLBACK_QUESTIONS.slice(0, max),
      dropped,
      usedFallback: true,
    };
  }

  // Top up with safe fallbacks only when generation was partially discarded,
  // so the patient never sees a thinner list because of a leak.
  if (dropped > 0) {
    for (const fb of SAFE_FALLBACK_QUESTIONS) {
      if (kept.length >= max) break;
      if (!seen.has(fb.toLowerCase())) {
        seen.add(fb.toLowerCase());
        kept.push(fb);
      }
    }
  }

  return { questions: kept.slice(0, max), dropped, usedFallback: false };
}
