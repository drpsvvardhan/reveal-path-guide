// ============================================================================
// supabase/functions/_shared/biotwin/attentionFallback.ts
// ----------------------------------------------------------------------------
// ATTENTION IS NOT ACTION.
//
// Two things live here, both deterministic and both unit-testable without a
// database or an LLM:
//
//   1. isAttentionQuestion() — recognises informational prioritisation
//      questions ("what should I be paying attention to right now").
//      Ranking or explaining released biological state is informational.
//      It never requests treatment authority.
//
//   2. buildBiotwinFallback() — a packet-grounded safety fallback. When a
//      released Twin exists, a failed admission must lose fluency, never
//      intelligence: the patient gets the report's own ranked drivers,
//      open questions and held-open tensions instead of a content-free
//      "I can't answer that the way it was phrased".
//
// No LLM. No network. No prose invention: every line is a title the imported
// report already authored, carrying the statement's own source_id as a
// grounding marker so the existing server parser produces USED evidence refs
// and strips the markers before delivery.
// ============================================================================

import type { BiotwinPacket, BiotwinStatementRow } from "./packet.ts";
import { validateBiotwinOutput } from "./packet.ts";

// ---------------------------------------------------------------------------
// 1. Attention / informational-priority intent
// ---------------------------------------------------------------------------

const ATTENTION_PATTERNS: RegExp[] = [
  /\bpay(ing)?\s+attention\s+to\b/i,
  /\bwhat\s+(matters|counts)\s+(the\s+)?most\b/i,
  /\bmost\s+important\b/i,
  /\bwhat\s+should\s+i\s+focus\s+on\b/i,
  /\bwhat\s+(are\s+the\s+)?main\s+things\b/i,
  /\bwhat\s+should\s+i\s+know\b/i,
  /\b(top|biggest|highest)\s+(priorit(y|ies)|concerns?|risks?)\b/i,
  /\bwhat'?s?\s+(the\s+)?most\s+(important|urgent|pressing)\b/i,
  /\bwhat\s+(is|does)\s+my\s+twin\s+(say|show|think)\b/i,
];

/**
 * True when the question asks the runtime to rank or explain released
 * biological state. This is informational, not a treatment decision, and
 * must never be refused on treatment-authority grounds.
 */
export function isAttentionQuestion(userMessage: string): boolean {
  const q = (userMessage ?? "").trim();
  if (!q) return false;
  return ATTENTION_PATTERNS.some((p) => p.test(q));
}

// ---------------------------------------------------------------------------
// 2. Deterministic packet-grounded fallback
// ---------------------------------------------------------------------------

// Classification vocabulary. A title is only demoted out of the measured
// block when the report says the FINDING is not established — never merely
// because some downstream attribute (etiology, cause) is unquantified.
// "Measured atherogenic particle burden (...) of unquantified etiology" is a
// measurement: the burden is measured, only its cause is open.

/** The report explicitly frames the statement itself as not-yet-established. */
const EXPLICIT_HYPOTHESIS_MARKERS =
  /\b(hypothes\w*|candidate|possible|possibly|suspected|unconfirmed|presumed|putative)\b/i;

/** The persistence or the activity itself is unmeasured — still hypothesis. */
const UNESTABLISHED_MARKERS =
  /\bunestablished\b|\bpersistence\s+unestablished\b|\bnot\s+established\b|\bunmeasured\s+\w+|\bunmeasured\b/i;

/** Title asserts a measurement up front. */
const MEASURED_PREFIX = /^\s*(measured|confirmed|documented|observed)\b/i;

const STRENGTH_MARKERS =
  /within range|within normal|normal|preserved|protective|no evidence of|reassuring|stable/i;

export interface FallbackBlock {
  /** Stable id so a failing block can be dropped without erasing the answer. */
  id: string;
  text: string;
}

function classify(row: BiotwinStatementRow): "measured" | "hypothesis" {
  if (row.truth_status !== "confirmed") return "hypothesis";
  const title = row.title ?? "";
  // Explicit hypothesis/candidate framing always wins, even over a
  // "Measured ..." opening.
  if (EXPLICIT_HYPOTHESIS_MARKERS.test(title)) return "hypothesis";
  // A confirmed measurement stays measured even when the title later notes
  // that the etiology or cause is unquantified/unknown.
  if (MEASURED_PREFIX.test(title)) return "measured";
  // Otherwise, "unestablished persistence" / "unmeasured activity" style
  // wording keeps the statement open.
  if (UNESTABLISHED_MARKERS.test(title)) return "hypothesis";
  return "measured";
}

function marker(row: BiotwinStatementRow, kind: "statement" | "contradiction") {
  return `{${kind}:${row.source_id}}`;
}

function line(row: BiotwinStatementRow, kind: "statement" | "contradiction") {
  return `${row.title.trim()} ${marker(row, kind)}`;
}

/**
 * Builds the fallback as discrete blocks. The caller validates and drops
 * individual blocks rather than erasing the whole answer.
 */
export function buildBiotwinFallbackBlocks(
  packet: BiotwinPacket,
  userMessage: string,
): FallbackBlock[] {
  const blocks: FallbackBlock[] = [];
  const attention = isAttentionQuestion(userMessage);

  blocks.push({
    id: "intro",
    text:
      "**What this means:**\n\n" +
      (attention
        ? "Here is what your imported clinical evidence report ranks highest right now, in its own order, separating what is measured from what is still an open question."
        : "Here is the part of your released Twin I can state safely and directly from the evidence currently available."),
  });

  const measured = packet.drivers.filter((d) => classify(d) === "measured");
  const hypotheses = packet.drivers.filter((d) => classify(d) === "hypothesis");

  if (measured.length > 0) {
    blocks.push({
      id: "drivers_measured",
      text:
        "**Measured and established, in rank order:**\n\n" +
        measured.map((d, i) => `${i + 1}. ${line(d, "statement")}`).join("\n"),
    });
  }

  if (hypotheses.length > 0) {
    blocks.push({
      id: "drivers_hypothesis",
      text:
        "**Held as hypothesis, not established:**\n\n" +
        hypotheses.map((d) => `- ${line(d, "statement")}`).join("\n"),
    });
  }

  const open = [...packet.unknown, ...packet.candidate].slice(0, 3);
  if (open.length > 0) {
    blocks.push({
      id: "open",
      text:
        "**Open — needs confirmation before any conclusion:**\n\n" +
        open.map((s) => `- ${line(s, "statement")}`).join("\n"),
    });
  }

  const strength = packet.confirmed.find((s) => STRENGTH_MARKERS.test(s.title));
  if (strength) {
    blocks.push({
      id: "strength",
      text: `**Something working in your favour:**\n\n- ${line(strength, "statement")}`,
    });
  }

  const tensions = packet.contradictions.slice(0, 2);
  if (tensions.length > 0) {
    blocks.push({
      id: "contradictions",
      text:
        "**Tensions your report deliberately holds open:**\n\n" +
        tensions.map((c) => `- ${line(c, "contradiction")}`).join("\n"),
    });
  }

  const actions = packet.actions.slice(0, 3);
  if (actions.length > 0) {
    blocks.push({
      id: "measurement",
      text:
        "**What would settle the open questions:**\n\n" +
        actions.map((a) => `- ${line(a, "statement")}`).join("\n"),
    });
  }

  blocks.push({
    id: "outro",
    text:
      "**What you can do:**\n\nThese rankings are informational. You can keep asking me to explain any of them in more detail. If you want to start, stop, or change a medication or treatment, that decision belongs with your clinician; understanding what your Twin is showing you does not.",
  });

  return blocks;
}

export interface BiotwinFallbackResult {
  content: string;
  /** Blocks omitted because they failed admission on their own. */
  omittedBlocks: string[];
  /** True when a substantive, packet-grounded answer was produced. */
  substantive: boolean;
}

/**
 * Assembles the fallback and validates it against the report's own
 * governance. A block that fails is dropped; the answer is never erased.
 * `extraValidate` lets the caller add the dose-token / authority checks.
 */
export function buildBiotwinFallback(
  packet: BiotwinPacket,
  userMessage: string,
  extraValidate?: (text: string) => boolean,
): BiotwinFallbackResult {
  if (!packet.has_report) {
    return { content: "", omittedBlocks: [], substantive: false };
  }
  // The one true exception: an unreleased Twin may only produce a
  // status-only response. Everything else must be substantive.
  if (!packet.patient_release_permitted) {
    return { content: "", omittedBlocks: [], substantive: false };
  }

  const admissible = (text: string) =>
    validateBiotwinOutput(text, packet).valid &&
    (extraValidate ? extraValidate(text) : true);

  const kept: FallbackBlock[] = [];
  const omitted: string[] = [];
  for (const block of buildBiotwinFallbackBlocks(packet, userMessage)) {
    if (admissible(block.text)) kept.push(block);
    else omitted.push(block.id);
  }

  const evidenceBlocks = kept.filter(
    (b) => b.id !== "intro" && b.id !== "outro",
  );
  if (evidenceBlocks.length === 0) {
    return { content: "", omittedBlocks: omitted, substantive: false };
  }

  let content = kept.map((b) => b.text).join("\n\n");

  // Final whole-answer check: assembly must not create a violation that no
  // single block carried. Degrade by omission, never by erasure.
  if (!admissible(content)) {
    const trimmed = kept.filter((b) => b.id !== "measurement");
    content = trimmed.map((b) => b.text).join("\n\n");
    omitted.push("measurement");
    if (!admissible(content)) {
      // Last resort: the safest individual released statement(s), never a
      // content-free refusal.
      const safest = safestStatements(packet, admissible);
      if (safest) {
        return {
          content: safest,
          omittedBlocks: [...omitted, ...evidenceBlocks.map((b) => b.id)],
          substantive: true,
        };
      }
      return { content: "", omittedBlocks: omitted, substantive: false };
    }
  }

  return { content, omittedBlocks: omitted, substantive: true };
}

/**
 * Degraded floor: the highest-ranked individually admissible released
 * statements, rendered one per line with their own grounding markers.
 */
function safestStatements(
  packet: BiotwinPacket,
  admissible: (text: string) => boolean,
): string | null {
  const candidates = [
    ...packet.drivers,
    ...packet.confirmed,
    ...packet.candidate,
    ...packet.unknown,
  ];
  const lines: string[] = [];
  for (const row of candidates) {
    const text = `- ${line(row, "statement")}`;
    if (admissible(text)) lines.push(text);
    if (lines.length >= 3) break;
  }
  if (lines.length === 0) return null;
  const content =
    "**What your report establishes:**\n\n" + lines.join("\n");
  return admissible(content) ? content : lines[0];
}

/** Named per the bugfix contract; same deterministic implementation. */
export const buildUsefulBiotwinFallback = buildBiotwinFallback;
