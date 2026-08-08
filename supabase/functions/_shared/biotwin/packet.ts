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
export const BIOTWIN_VALIDATOR_VERSION = "1.0.0";

/** Hard caps — the packet must never grow with report size. */
export const PACKET_CAPS = {
  per_bucket: 12,
  drivers: 6,
  actions: 8,
  prohibited: 40,
  allowed: 12,
  contradictions: 8,
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
    "Medication reconciliation is incomplete. Never state that a medication is taken, not taken, started or stopped, and never suggest starting, stopping or changing one.",
  pgx_hold:
    "Pharmacogenomic results may not be used for this person. Never use a PGx result to justify a drug or dose statement.",
  cgm_hold:
    "The continuous glucose signal is unconfirmed. Never call it hypoglycaemia or any diagnosis; describe it as unconfirmed sensor readings requiring verification.",
  clinician_review_hold:
    "The report is awaiting treating-clinician review. Every answer must say the findings are pending clinician review.",
  patient_release_hold:
    "The report is not yet released for patient-facing conclusions. Report only what it explicitly permits and route conclusions to the clinician.",
  decision_grade_hold:
    "The multi-omic layers are not decision grade. Never present them as a decision-grade multiomic result.",
};

export function renderBiotwinPacketForPrompt(packet: BiotwinPacket): string {
  if (!packet.has_report) return "";

  const lines: string[] = [];
  const listOf = (label: string, rows: BiotwinStatementRow[]) => {
    if (rows.length === 0) return;
    lines.push(`${label}:`);
    rows.forEach((r) => {
      lines.push(`- ${r.title}${r.body ? ` — ${r.body}` : ""}`);
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
  kind: "prohibited_headline" | "hold_violation";
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
    /\byou (are|aren'?t|are not) (currently )?(taking|on)\b/i,
  ],
  pgx_hold: [/\b(your|this)\s+(pgx|pharmacogenomic)\s+(result|profile)\s+(means|shows|indicates|supports)\b/i],
  cgm_hold: [/\b(recurrent |nocturnal )?hypoglyc(a)?emi[ac]\b(?![^.]*\bunconfirmed\b)/i],
};

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
  const normalizedOutput = normalizeForMatch(output);

  for (const prohibited of packet.prohibited_headlines) {
    const tokens = contentTokens(prohibited);
    if (tokens.length === 0) continue;
    const hits = tokens.filter((t) => normalizedOutput.includes(t)).length;
    const ratio = hits / tokens.length;
    if (ratio >= 0.85) {
      violations.push({
        kind: "prohibited_headline",
        detail: "Output asserts a statement the imported report prohibits.",
        matched: prohibited,
      });
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

export function biotwinReplacementMessage(packet: BiotwinPacket): string {
  const review = packet.clinician_review_required
    ? " Your imported clinical evidence report is still awaiting treating-clinician review."
    : "";
  return (
    "I can't answer that the way it was phrased, because it would go past what your imported " +
    "clinical evidence report actually establishes." +
    review +
    " Here is what I can do: I can tell you what the report confirms, what it holds open as " +
    "unconfirmed, and what measurement would settle the question. Bring this to your clinician " +
    "so it can be resolved with them."
  );
}