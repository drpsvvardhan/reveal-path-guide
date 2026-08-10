// ============================================================================
// supabase/functions/_shared/biotwin/packet.ts
// ----------------------------------------------------------------------------
// Bounded BioTwin evidence packet for the EXISTING patient-chat runtime, plus
// the output admission checks that enforce the report's own governance.
//
// This does not replace chat. It adds one source window and one gate.
// ============================================================================

import type { BiotwinHold } from "./types.ts";

// Stamped into every Answer Receipt. Bump on any change to the packet shape,
// caps, or the validateBiotwinOutput admission checks in this module.
// 1.2.0: merged matcher — sentence-level, negation/retirement-aware
//        assertion detection (branch 1.1.0) combined with generic-token
//        filtering, distinctive-token paraphrase criteria and scoped hold
//        regexes (main 1.1.1). Both sides fixed the Aug 9 live-smoke
//        false-positive class; this version carries the union.
export const BIOTWIN_VALIDATOR_VERSION = "1.3.0";

/** Hard caps — the packet must never grow with report size. */
export const PACKET_CAPS = {
  per_bucket: 12,
  drivers: 6,
  actions: 8,
  prohibited: 40,
  allowed: 12,
  contradictions: 8,
  evidence: 12,
  bounds_per_statement: 4,
} as const;

export interface BiotwinStatementRow {
  source_id: string;
  section: string;
  statement_kind: string;
  truth_status: string;
  title: string;
  body: string | null;
  bounds: string[] | null;
  timepoint: string | null;
  clinical_authority: string;
  requires_measurement: Record<string, unknown> | null;
  holds: string[] | null;
  ordinal: number;
}

export interface BiotwinReportRow {
  id: string;
  twin_id: string | null;
  version: number;
  generated_date: string | null;
  release_control: Record<string, unknown> | null;
  executive_synthesis: Record<string, unknown> | null;
  holds: string[] | null;
  clinician_review_required: boolean;
  patient_release_permitted: boolean;
}

export interface BiotwinPacket {
  has_report: boolean;
  report_id: string | null;
  version: number | null;
  generated_date: string | null;
  release_control: Record<string, unknown>;
  holds: BiotwinHold[];
  clinician_review_required: boolean;
  patient_release_permitted: boolean;
  executive_synthesis: Record<string, unknown>;
  confirmed: BiotwinStatementRow[];
  candidate: BiotwinStatementRow[];
  unknown: BiotwinStatementRow[];
  retired: BiotwinStatementRow[];
  drivers: BiotwinStatementRow[];
  actions: BiotwinStatementRow[];
  contradictions: BiotwinStatementRow[];
  evidence: BiotwinStatementRow[];
  allowed_headlines: string[];
  prohibited_headlines: string[];
}

export const EMPTY_BIOTWIN_PACKET: BiotwinPacket = {
  has_report: false,
  report_id: null,
  version: null,
  generated_date: null,
  release_control: {},
  holds: [],
  clinician_review_required: false,
  patient_release_permitted: true,
  executive_synthesis: {},
  confirmed: [],
  candidate: [],
  unknown: [],
  retired: [],
  drivers: [],
  actions: [],
  contradictions: [],
  evidence: [],
  allowed_headlines: [],
  prohibited_headlines: [],
};

function capBounds(rows: BiotwinStatementRow[]): BiotwinStatementRow[] {
  return rows.map((r) => ({
    ...r,
    bounds: (r.bounds ?? []).slice(0, PACKET_CAPS.bounds_per_statement),
  }));
}

/** Pure assembly so it can be unit-tested without a database. */
export function buildBiotwinPacket(
  report: BiotwinReportRow | null,
  statements: BiotwinStatementRow[]
): BiotwinPacket {
  if (!report) return EMPTY_BIOTWIN_PACKET;

  const byTruth = (t: string) =>
    capBounds(statements.filter((s) => s.truth_status === t)).slice(0, PACKET_CAPS.per_bucket);
  const byKind = (k: string, cap: number) =>
    capBounds(statements.filter((s) => s.statement_kind === k)).slice(0, cap);

  return {
    has_report: true,
    report_id: report.id,
    version: report.version,
    generated_date: report.generated_date,
    release_control: report.release_control ?? {},
    holds: (report.holds ?? []) as BiotwinHold[],
    clinician_review_required: report.clinician_review_required,
    patient_release_permitted: report.patient_release_permitted,
    executive_synthesis: report.executive_synthesis ?? {},
    confirmed: byTruth("confirmed").filter((s) => s.statement_kind === "confirmed_measurement"),
    candidate: byTruth("candidate"),
    unknown: byTruth("unknown"),
    retired: byTruth("retired"),
    drivers: byKind("driver", PACKET_CAPS.drivers),
    actions: byKind("action", PACKET_CAPS.actions),
    contradictions: byKind("contradiction", PACKET_CAPS.contradictions),
    evidence: byKind("measured_evidence", PACKET_CAPS.evidence),
    allowed_headlines: statements
      .filter((s) => s.statement_kind === "allowed_headline")
      .slice(0, PACKET_CAPS.allowed)
      .map((s) => s.title),
    prohibited_headlines: statements
      .filter((s) => s.statement_kind === "prohibited_headline")
      .slice(0, PACKET_CAPS.prohibited)
      .map((s) => s.title),
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

const HOLD_TEXT: Record<string, string> = {
  medication_hold:
    "Medication reconciliation is incomplete. Never state that a medication is taken, not taken, started or stopped, and never suggest starting, stopping, dosing or changing one. SCOPE: this restricts medication claims and medication decisions ONLY. It does not restrict explaining ApoB, tobacco exposure, an iron finding, a vascular hypothesis or any other biological finding.",
  pgx_hold:
    "Pharmacogenomic results may not be used to make a drug or dose decision for this person. SCOPE: this restricts drug/dose conclusions drawn from PGx ONLY. It does not restrict explaining any other released finding.",
  cgm_hold:
    "The continuous glucose signal is unconfirmed. Never call it hypoglycaemia or any diagnosis; describe it as unconfirmed sensor readings requiring verification.",
  clinician_review_hold:
    "The report is awaiting treating-clinician review. Every answer must say the findings are pending clinician review.",
  patient_release_hold:
    "The report is not yet released for patient-facing conclusions. Report only what it explicitly permits and route conclusions to the clinician.",
  decision_grade_hold:
    "The multi-omic layers are not decision grade. Never present them as a decision-grade multiomic result. SCOPE: this restricts the decision-grade claim ONLY. Explanatory discussion of bounded released findings, including proteomic abundance signals described as bounded hypotheses, remains permitted.",
};

export function renderBiotwinPacketForPrompt(packet: BiotwinPacket): string {
  if (!packet.has_report) return "";

  const lines: string[] = [];
  const listOf = (label: string, rows: BiotwinStatementRow[]) => {
    if (rows.length === 0) return;
    lines.push(`${label}:`);
    rows.forEach((r) => {
      // [id:...] is the statement's source_id — the identifier the model
      // must copy into {statement:<id>} / {contradiction:<id>} grounding
      // markers. Without it printed here, statement citations would be
      // unverifiable guesses.
      lines.push(`- [id:${r.source_id}] ${r.title}${r.body ? ` — ${r.body}` : ""}`);
      (r.bounds ?? []).forEach((b) => lines.push(`    bound: ${b}`));
    });
  };

  lines.push("## BIOTWIN SOURCE WINDOW (imported clinical evidence report — CONTROLLING SOURCE)");
  lines.push("");
  lines.push(
    "PRECEDENCE: this imported report overrides CIE-derived scores, cluster narratives, " +
      "generated manifests and any threshold heuristics. Where they disagree, the report wins. " +
      "Never restate a claim the report retired."
  );
  lines.push("");
  lines.push(
    "EXPLANATORY LICENCE: explain freely within the released Twin. Ranking or explaining " +
      "what deserves attention is informational, not a treatment decision. Holds restrict the " +
      "specific prohibited action or claim, not unrelated biological explanation. Never refuse " +
      "a question merely because some other domain is on hold. If asked what matters most or " +
      "what to pay attention to, answer with the released driver hierarchy in rank order, " +
      "clearly separating what is measured from what is held open as hypothesis."
  );
  lines.push(`Report version ${packet.version ?? "?"}, generated ${packet.generated_date ?? "unknown"}.`);
  lines.push("");
  lines.push("RELEASE CONTROL:");
  Object.entries(packet.release_control).forEach(([k, v]) => {
    if (typeof v === "string") lines.push(`- ${k}: ${v}`);
  });
  lines.push("");
  if (packet.holds.length > 0) {
    lines.push("ACTIVE HOLDS — these are absolute:");
    packet.holds.forEach((h) => lines.push(`- ${HOLD_TEXT[h] ?? h}`));
    lines.push("");
  }
  const es = packet.executive_synthesis as Record<string, unknown>;
  if (typeof es.patient_summary === "string") lines.push(`PATIENT SUMMARY (report's own words): ${es.patient_summary}`);
  if (typeof es.bottom_line === "string") lines.push(`BOTTOM LINE (report's own words): ${es.bottom_line}`);
  lines.push("");

  listOf("CONFIRMED MEASUREMENTS AND BOUNDED FINDINGS", packet.confirmed);
  listOf("CANDIDATE / UNVERIFIED SIGNALS (never state as fact)", packet.candidate);
  listOf("OPEN / UNKNOWN (needs measurement before any conclusion)", packet.unknown);
  listOf("RETIRED CLAIMS (never restate; use the replacement wording)", packet.retired);
  listOf("DRIVER HIERARCHY", packet.drivers);
  listOf("MEASUREMENT AND ACTION PLAN", packet.actions);
  listOf("CONTRADICTIONS HELD OPEN", packet.contradictions);
  if (packet.evidence.length > 0) {
    lines.push("");
    lines.push(
      "Every stream in MEASURED EVIDENCE below IS present in this person's Twin. If an earlier turn in this conversation said one of these streams was missing, absent, or not connected, that statement is outdated — correct it plainly and answer from the values below."
    );
  }
  listOf(
    "MEASURED EVIDENCE (the person's own observations — released by default; cite freely, interpret only within the released claims)",
    packet.evidence
  );

  if (packet.allowed_headlines.length > 0) {
    lines.push("");
    lines.push("HEADLINE STATEMENTS YOU MAY MAKE:");
    packet.allowed_headlines.forEach((h) => lines.push(`- ${h}`));
  }
  if (packet.prohibited_headlines.length > 0) {
    lines.push("");
    lines.push("PROHIBITED STATEMENTS — never assert these, in any wording:");
    packet.prohibited_headlines.forEach((h) => lines.push(`- ${h}`));
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Output admission gate
// ---------------------------------------------------------------------------

export interface BiotwinOutputViolation {
  kind: "prohibited_headline" | "hold_violation" | "evidence_absence_denial";
  detail: string;
  matched: string;
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Content words of a prohibited statement, used for overlap scoring. */
function contentTokens(s: string): string[] {
  const stop = new Set([
    "the","a","an","of","on","in","to","is","are","has","have","and","or","for","with","from","based","by","at","as","that","this","was","were","be","been","not","no","it","their","his","her",
  ]);
  return normalizeForMatch(s)
    .split(" ")
    .filter((t) => t.length > 2 && !stop.has(t));
}

const HOLD_FORBIDDEN_PATTERNS: Record<string, RegExp[]> = {
  medication_hold: [
    /\b(start|stop|begin|discontinue|increase|decrease|titrate|switch)\s+(your\s+)?(statin|metformin|levothyroxine|estradiol|progesterone|sertraline|medication|drug|dose)/i,
    // Scope: a *medication* claim, not any sentence containing "you are
    // on" — "you are on the right track" is encouragement, not
    // prescribing, and suppressed benign answers in the Aug 9 smoke.
    // Requires an actual medication object (union of both fixes: named
    // agents, generic terms, and drug-name suffix heuristics).
    /\byou (are|aren'?t|are not) (currently )?(taking|on)\s+(?:a |an |the |any |your |this |that )?(?:statin|metformin|levothyroxine|estradiol|progesterone|sertraline|medication|medications|medicine|medicines|drug|drugs|dose|doses|therapy|treatment|supplement|supplements|pill|pills|prescription|prescriptions|[a-z]+(?:statin|formin|pril|sartan|olol|prazole|tidine))\b/i,
  ],
  pgx_hold: [/\b(your|this)\s+(pgx|pharmacogenomic)\s+(result|profile)\s+(means|shows|indicates|supports)\b/i],
  cgm_hold: [/\b(recurrent |nocturnal )?hypoglyc(a)?emi[ac]\b(?![^.]*\bunconfirmed\b)/i],
  // Narrow: block only POSITIVE decision-grade claims. Negated or bounded
  // wording ("is not decision-grade", "bounded hypotheses, not decision-grade
  // evidence") must remain permitted, and ordinary uses of "decision" or
  // "grade" must never trip this.
  decision_grade_hold: [
    // Requires an affirmative copula immediately before the claim, so every
    // negated form ("is not decision-grade", "are not decision grade",
    // "bounded hypotheses, not decision-grade evidence") is permitted.
    /\b(?:is|are|remains|represents)\s+(?:a\s+|an\s+|your\s+|the\s+|this\s+)?decision[-\s]?grade\b/i,
  ],
};

// ---------------------------------------------------------------------------
// Prohibition matching — sentence-level and negation-aware.
//
// The prohibited list contains claims that must never be ASSERTED. The
// correct patient-facing behavior — "your record does not show chronic
// short sleep; that earlier reading was retracted" — necessarily contains
// the prohibited claim's words. A matcher that counts scattered tokens
// across the whole output and ignores negation flags precisely the honest
// sentences the constitution requires (scar discipline, rule 8), and the
// richer the report (more scars → more prohibitions), the more certainly
// every substantive answer trips it. That is the inversion observed in the
// first live smoke: the better the twin, the less it could say.
//
// Rules:
//   - Sentences are evaluated individually; tokens scattered across
//     different sentences never combine into a violation.
//   - A sentence carrying a negation/retirement cue is treating the claim
//     as absent, retired, or uncertain — not asserting it.
//   - Short prohibitions (< 4 content tokens) match only as an exact
//     normalized phrase; longer ones also match at >= 85% token overlap
//     within a single sentence (paraphrase protection).
// ---------------------------------------------------------------------------

const NON_ASSERTION_CUES = [
  " not ", " no ", " never ", " cannot ", " can t ", " won t ",
  " isn t ", " aren t ", " wasn t ", " weren t ",
  " doesn t ", " don t ", " didn t ",
  " no longer ", " retracted ", " retired ", " corrected ",
  " invalidated ", " superseded ", " withdrawn ", " ruled out ",
  " unconfirmed ", " unverified ", " unresolved ", " uncertain ",
  " held open ", " rather than ", " instead of ",
];

function splitOutputSentences(output: string): string[] {
  return output
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function sentenceAsserts(paddedSentence: string): boolean {
  return !NON_ASSERTION_CUES.some((cue) => paddedSentence.includes(cue));
}

/**
 * Words too generic to make a prohibited headline identifiable on their own.
 * Bag-of-words overlap over vocabulary like "biological", "age", "single"
 * used to fire on perfectly admissible answers — that was the defect that
 * turned an attention question into a generic refusal.
 */
const GENERIC_TOKENS = new Set([
  "biological","biology","age","single","level","levels","value","values","result","results",
  "risk","high","higher","low","lower","elevated","data","report","patient","status","state",
  "measure","measured","measurement","signal","signals","marker","markers","panel","score",
  "range","normal","current","currently","time","years","year","study","test","tests",
]);


// ---------------------------------------------------------------------------
// Evidence-absence denial (validator 1.3.0)
// ---------------------------------------------------------------------------
// Live failure (Aug 10): the packet carried the full MEASURED EVIDENCE bucket
// — 4,301 CGM readings, a 14-day food log — and the model still answered
// "your BioTwin does not yet contain any CGM data or a food log", following
// its own earlier (wrong) turns in the conversation history over the packet
// in front of it. Denying the existence of released measured data is a
// governance violation of the same rank as asserting a prohibited claim:
// police assertions, not topics.

/** Aliases (in normalizeForMatch space) per recognizable evidence stream. */
const EVIDENCE_STREAM_ALIASES: Array<{ match: RegExp; aliases: string[] }> = [
  {
    match: /cgm|glucose/,
    aliases: ["cgm", "continuous glucose", "glucose monitor", "glucose sensor"],
  },
  {
    match: /food/,
    aliases: ["food log", "food diary", "food record", "meal log", "nutrition log"],
  },
  {
    match: /sleep/,
    aliases: ["sleep data", "sleep tracking", "sleep log", "sleep records", "sleep sensor"],
  },
  {
    match: /heart|hrv/,
    aliases: ["hrv", "heart rate variability", "heart rate data"],
  },
];

const NEGATED_EXISTENCE_LEAD =
  "(?:no|not(?: yet)?|does not(?: yet)?|doesn t(?: yet)?|do not|don t|never|without|lacks?|lacking|missing|absent|yet to (?:contain|have|include|receive))";
const NEGATED_EXISTENCE_TAIL =
  "(?:is|are|was|were|has(?: been)?|have(?: been)?) (?:not(?: yet)?|never|no longer) (?:\\w+ ){0,2}?(?:available|present|connected|recorded|collected|captured|contained|included|uploaded|linked|found|on file)|(?:is|are) (?:unavailable|missing|absent)";

/**
 * A sentence denies a present evidence stream when the denial and the
 * stream's alias sit adjacently: negation within a few words BEFORE the
 * alias ("does not yet contain any … CGM data"), or the alias followed by a
 * negated linking verb ("CGM data is not available"). Adjacency keeps
 * value-level negations honest — "your CGM shows no values above 180" is a
 * faithful reading of the data, not a denial of its existence.
 */
function sentenceDeniesStream(paddedSentence: string, alias: string): boolean {
  const lead = new RegExp(
    `\\b${NEGATED_EXISTENCE_LEAD}\\b(?: \\w+){0,4}? ${alias}\\b`
  );
  const tail = new RegExp(
    `\\b${alias}\\b(?: \\w+){0,4}? (?:${NEGATED_EXISTENCE_TAIL})\\b`
  );
  return lead.test(paddedSentence) || tail.test(paddedSentence);
}

/**
 * Deterministic admission check of model output against the report's own
 * governance. Returns every violation found; the caller decides the template.
 */
export function validateBiotwinOutput(
  output: string,
  packet: BiotwinPacket
): { valid: boolean; violations: BiotwinOutputViolation[] } {
  if (!packet.has_report) return { valid: true, violations: [] };

  const violations: BiotwinOutputViolation[] = [];
  const sentences = splitOutputSentences(output).map((s) => ({
    raw: s,
    padded: ` ${normalizeForMatch(s)} `,
  }));

  for (const prohibited of packet.prohibited_headlines) {
    const normProhibited = normalizeForMatch(prohibited);
    if (!normProhibited) continue;
    const paddedProhibited = ` ${normProhibited} `;
    const tokens = contentTokens(prohibited);
    const distinctive = tokens.filter((t) => !GENERIC_TOKENS.has(t));

    // Combined matcher (validator 1.2.0): main's exact-phrase and
    // distinctive-token paraphrase criteria, evaluated INSIDE the branch's
    // sentence-level, negation-aware frame. A sentence carrying
    // negation/retirement language is stating the claim's absence — the
    // required scar wording — and never counts as assertion; tokens
    // scattered across different sentences never combine.
    let asserted = false;
    for (const sentence of sentences) {
      if (!sentenceAsserts(sentence.padded)) continue;
      // (a) exact scar wording within one asserting sentence — keeps
      // "5.01 h", "chronic short sleep", "APOE-driven ApoB axis" from
      // ever crossing.
      if (sentence.padded.includes(paddedProhibited)) {
        asserted = true;
        break;
      }
      // (b) paraphrase: only headlines long enough to be identifiable,
      // word-boundary scored, and only when EVERY distinctive
      // (non-generic) token co-occurs in the same sentence.
      if (tokens.length >= 4 && distinctive.length >= 2) {
        const hits = tokens.filter((t) =>
          sentence.padded.includes(` ${t} `)
        ).length;
        const distinctiveHits = distinctive.filter((t) =>
          sentence.padded.includes(` ${t} `)
        ).length;
        if (
          hits / tokens.length >= 0.9 &&
          distinctiveHits === distinctive.length
        ) {
          asserted = true;
          break;
        }
      }
    }

    if (asserted) {
      violations.push({
        kind: "prohibited_headline",
        detail: "Output asserts a statement the imported report prohibits.",
        matched: prohibited,
      });
    }
  }

  // Evidence-absence denial: only streams actually present in the packet's
  // evidence bucket are defended — when a stream truly is absent, saying so
  // is the honest answer and must never be blocked.
  const presentStreams: Array<{ id: string; aliases: string[] }> = [];
  for (const ev of packet.evidence) {
    const key = `${ev.source_id} ${ev.title}`.toLowerCase();
    for (const stream of EVIDENCE_STREAM_ALIASES) {
      if (stream.match.test(key)) {
        presentStreams.push({ id: ev.source_id, aliases: stream.aliases });
        break;
      }
    }
  }
  const deniedIds = new Set<string>();
  for (const sentence of sentences) {
    for (const stream of presentStreams) {
      if (deniedIds.has(stream.id)) continue;
      for (const alias of stream.aliases) {
        if (!sentence.padded.includes(` ${alias.split(" ")[0]}`)) continue;
        if (sentenceDeniesStream(sentence.padded, alias)) {
          deniedIds.add(stream.id);
          violations.push({
            kind: "evidence_absence_denial",
            detail: `The Twin CONTAINS this measured stream — it is released in the packet as [id:${stream.id}]. Never claim it is missing, absent, or not yet collected; correct any earlier such claim and answer from its released values.`,
            matched: sentence.raw.slice(0, 200),
          });
          break;
        }
      }
    }
  }

  for (const hold of packet.holds) {
    for (const pattern of HOLD_FORBIDDEN_PATTERNS[hold] ?? []) {
      const m = output.match(pattern);
      if (m) {
        violations.push({
          kind: "hold_violation",
          detail: `Output breaches the report's ${hold.replace(/_/g, " ")}.`,
          matched: m[0],
        });
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

// Quote-free (the doctor-question extractor must not fire on a fallback).
// Reached only after a corrective regeneration has also failed — it is a
// last resort, not the ordinary response to a hard question.
export function biotwinReplacementMessage(packet: BiotwinPacket): string {
  const review = packet.clinician_review_required
    ? " Your report is also still awaiting review by your treating clinician."
    : "";
  return `**What this means:**
Your clinical evidence report does not currently contain a patient-released statement that can answer this safely, so I'm not showing the answer I drafted.${review} That check exists so that nothing you read here outruns your own evidence.

**What you can do:**
- Ask me what your report confirms — that is always answerable.
- Ask what it holds open as unconfirmed, and which measurement would settle each open question.
- For any decision this touches, your clinician has the final say; I can help you prepare exactly what to raise with them.`;
}