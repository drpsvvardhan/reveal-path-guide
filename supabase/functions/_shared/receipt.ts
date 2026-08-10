// ============================================================================
// supabase/functions/_shared/receipt.ts
// ----------------------------------------------------------------------------
// Answer Receipt v1 — canonical hashing, version constants, and the receipt
// field assembly used by patient-chat.
//
// Doctrine (docs/ASK_MY_TWIN_CONSTITUTION.md):
//   - Every admitted answer must be receipted and replayable.
//   - Hashes bind to what the model actually saw: canonical serialization
//     (stable key order) before hashing. Never hash an object graph with
//     unstable key ordering.
//   - Two freshness clocks, never one ambiguous cutoff.
//
// This module is pure except for sha256Hex, which uses WebCrypto
// (available in both the Deno edge runtime and Node >= 20 for vitest).
// ============================================================================

// ---------------------------------------------------------------------------
// Version constants
// ---------------------------------------------------------------------------
// RUNTIME_VERSION identifies the patient-chat pipeline shape (gate order,
// receipt semantics). Bump on any change to what the pipeline does.
export const RUNTIME_VERSION = "r0.1.1";

// PROMPT_TEMPLATE_VERSION identifies the system-prompt template in
// buildPatientSystemPrompt. Bump on any wording/structure change so old
// receipts remain attributable to the exact template that produced them.
export const PROMPT_TEMPLATE_VERSION = "pt-2026-08-09.1";

// ---------------------------------------------------------------------------
// Canonical serialization (stable key order, recursive)
// ---------------------------------------------------------------------------
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortValue(obj[key]);
    }
    return sorted;
  }
  return value;
}

// ---------------------------------------------------------------------------
// SHA-256 (hex)
// ---------------------------------------------------------------------------
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------
// Used only when the provider response carries no usage block. Receipts
// stamped with an estimate set tokens_estimated = true so analytics never
// mistake an estimate for a measurement.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Conversation binding
// ---------------------------------------------------------------------------
// Live failure (Aug 10): the client sends a placeholder id like
// "tmp-1786258344875" when its own chat_conversations insert fails (RLS
// denies the row in admin view-as), and a non-uuid string kills the receipt
// insert — an answered question with no receipt. A receipt with a null
// conversation binding is worth more than no receipt at all.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sanitizeConversationId(raw: unknown): string | null {
  return typeof raw === "string" && UUID_RE.test(raw) ? raw : null;
}

// ---------------------------------------------------------------------------
// Freshness clocks
// ---------------------------------------------------------------------------
// latest_witness_as_of = newest collection_date across the admitted witness
// observations that were available to this answer. Returns null when no
// witnessed observation carries a date — never fabricates freshness.
export function latestWitnessDate(
  collectionDates: Array<string | null | undefined>
): string | null {
  let latest: string | null = null;
  for (const d of collectionDates) {
    if (!d) continue;
    const day = d.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (latest === null || day > latest) latest = day;
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Receipt field bundle
// ---------------------------------------------------------------------------
// The scalar receipt fields patient-chat writes onto its validation-log row.
// Kept as one typed object so the insert site and the tests share a shape.
export interface AnswerReceiptFields {
  answer_id: string;
  conversation_id: string | null;
  question_timestamp: string | null;

  biotwin_report_id: string | null;
  twin_id: string | null;
  twin_version: string | null;
  report_generated_at: string | null;
  biotwin_packet_sha256: string | null;
  context_packet_sha256: string;

  twin_state_as_of: string | null;
  latest_witness_as_of: string | null;

  model_provider: string;
  model_name: string;
  runtime_version: string;
  prompt_template_version: string;
  authority_policy_version: string;
  dose_policy_version: string;
  biotwin_validator_version: string;

  input_tokens: number | null;
  output_tokens: number | null;
  tokens_estimated: boolean;
  context_bytes: number;
  latency_ms: number | null;

  /** ALL admitted witnesses loaded for the patient (every witness class). */
  witness_count_available: number;
  /** The subset whose IDs are printed into the grounding block (citable). */
  grounding_witness_count: number;
  cluster_count_available: number;
  biotwin_statement_count_available: number;

  /**
   * Exactly what was available: the ID sets the model could have cited.
   * Together with context_packet_sha256 (exactly what the model saw) and
   * answer_evidence_refs (exactly what the answer used), this makes the
   * receipt epistemic replay even if the witness store changes later.
   */
  context_ref_manifest: {
    witness: string[];
    cluster: string[];
    statement: string[];
  };

  marker_coverage: number | null;

  /** Deterministic intent classification of the user's question (telemetry
   *  only — never affects what the runtime may say). */
  query_intent: string;
  query_intent_rule: string | null;

  emergency_routed: boolean;
  fallback_used: boolean;
  doctor_question_generated: boolean;
}

export interface UsedEvidenceRef {
  ref_type:
    | "witness"
    | "cluster"
    | "biotwin_statement"
    | "claim"
    | "contradiction"
    | "efe"
    | "live_window"
    | "external_source";
  ref_id: string;
}
