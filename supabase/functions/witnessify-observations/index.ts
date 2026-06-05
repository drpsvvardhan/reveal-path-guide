// ============================================================================
// supabase/functions/witnessify-observations/index.ts
// ----------------------------------------------------------------------------
// P1a — Artifact 5 — Backfill Edge Function
//
// Purpose:
//   Reads raw observation rows from the live tables, transforms them into
//   WitnessObjects via witnessify_impl, and inserts them into
//   witness_objects. Idempotent via Pattern Z (unique index +
//   ON CONFLICT DO NOTHING).
//
// Invocation (expected):
//   POST /functions/v1/witnessify-observations
//   body: {
//     user_ids: string[],              // required; restrict to these users
//     source_windows?: string[],        // optional; default all four
//                                       // values: "lab" | "inbody" |
//                                       //         "fibroscan" | "cie"
//     dry_run: boolean,                 // required; no inserts if true
//     registry_seed_version?: string    // optional; default 'p1a_initial'
//   }
//
// Response shape:
//   {
//     ok: boolean,
//     registry_rows_loaded: number,
//     report: {
//       per_user: [{
//         user_id,
//         lab_observations_scanned, inbody_observations_scanned,
//         fibroscan_observations_scanned, cie_assessments_scanned,
//         witnesses_produced, witnesses_inserted, duplicates_skipped,
//         registry_misses, validation_failures, soft_warnings,
//         error_detail
//       }],
//       totals: { ... }
//     }
//   }
//
// Behavior:
//   - Direct measures (lab/inbody/fibroscan): strict registry-miss policy.
//     If a signal is missing, that observation is skipped and recorded.
//   - CIE: lenient registry-miss policy per your recommendation. Missing
//     signals (e.g. new CIE questions added since the registry seed) are
//     recorded as misses; domain/gate scores still witnessify with partial
//     ancestry.
//   - Provenance is set from the source row: source_table + source_row_id.
//   - compound transaction: each user is processed independently. One
//     user's error does not poison another's witnesses.
//   - dry_run=true: everything runs EXCEPT the final INSERT. Report shows
//     what *would* have been inserted.
//
// Hold: P1a does not make the system smarter. It makes future intelligence
// lawful.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import {
  type WitnessObject,
} from "../_shared/witness.ts";

import {
  witnessifyObservation,
  witnessifyCieAssessment,
  type WitnessifyOptions,
  type DirectObservationInput,
  type CieAssessmentInput,
  type CieResponseInput,
  type CieDomainScoreInput,
  type CieGateScoreInput,
  type RegistryAccessor,
  type RegistryMiss,
  type ValidationFailure,
} from "../_shared/witnessify_impl.ts";

import {
  loadRegistryFromSupabase,
} from "./supabaseRegistry.ts";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_REGISTRY_SEED_VERSION = "p1a_initial";
const VALID_SOURCE_WINDOWS = ["lab", "inbody", "fibroscan", "cie"] as const;
type SourceWindowFilter = typeof VALID_SOURCE_WINDOWS[number];

// Batch size for paging raw observation reads. Keep modest so we fit in
// edge function memory and can report progress at useful granularity.
const READ_PAGE_SIZE = 500;

// Batch size for INSERTs into witness_objects.
const INSERT_BATCH_SIZE = 100;

// ============================================================================
// REQUEST + RESPONSE TYPES
// ============================================================================

interface RequestBody {
  user_ids: string[];
  source_windows?: string[];
  dry_run: boolean;
  registry_seed_version?: string;
}

interface PerUserReport {
  user_id: string;
  lab_observations_scanned: number;
  inbody_observations_scanned: number;
  fibroscan_observations_scanned: number;
  cie_assessments_scanned: number;
  witnesses_produced: number;
  witnesses_inserted: number;
  duplicates_skipped: number;
  registry_misses: RegistryMiss[];
  validation_failures: ValidationFailure[];
  soft_warnings: Array<{ signal: string; rule: string; detail: string }>;
  error_detail: string | null;
}

interface BackfillReport {
  per_user: PerUserReport[];
  totals: {
    users_processed: number;
    witnesses_produced: number;
    witnesses_inserted: number;
    duplicates_skipped: number;
    registry_miss_count: number;
    validation_failure_count: number;
    soft_warning_count: number;
  };
}

// ============================================================================
// ENTRY POINT
// ============================================================================

Deno.serve(async (req: Request) => {
  const started_at = Date.now();
  try {
    // Admin-only backfill tool: require authenticated admin caller.
    const { authenticateRequest } = await import("../_shared/auth.ts");
    const authResult = await authenticateRequest(req);
    if (!authResult.ok) {
      return json(authResult.error.body, authResult.error.status);
    }
    const { data: roleData } = await authResult.auth.userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", authResult.auth.callerUserId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return json({ ok: false, error: "forbidden: admin role required" }, 403);
    }

    // Auth + Supabase client setup.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Parse request.
    if (req.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }
    const body = (await req.json()) as RequestBody;

    // Validate.
    const validation = validateRequest(body);
    if (validation.error) {
      return json({ ok: false, error: validation.error }, 400);
    }

    const seedVersion =
      body.registry_seed_version ?? DEFAULT_REGISTRY_SEED_VERSION;
    const sourceWindows = validation.sourceWindows;
    const dryRun = body.dry_run;

    // Load registry.
    // deno-lint-ignore no-explicit-any
    const sbAny = supabase as any;
    const { accessor, row_count: registryRows } =
      await loadRegistryFromSupabase(sbAny, seedVersion);

    // Process each user independently.
    const perUser: PerUserReport[] = [];
    for (const userId of body.user_ids) {
      const report = await processUser(
        sbAny,
        userId,
        accessor,
        sourceWindows,
        dryRun
      );
      perUser.push(report);
    }

    // Totals.
    const totals = {
      users_processed: perUser.length,
      witnesses_produced: sum(perUser, (r) => r.witnesses_produced),
      witnesses_inserted: sum(perUser, (r) => r.witnesses_inserted),
      duplicates_skipped: sum(perUser, (r) => r.duplicates_skipped),
      registry_miss_count: sum(perUser, (r) => r.registry_misses.length),
      validation_failure_count: sum(
        perUser,
        (r) => r.validation_failures.length
      ),
      soft_warning_count: sum(perUser, (r) => r.soft_warnings.length),
    };

    return json({
      ok: true,
      dry_run: dryRun,
      registry_seed_version: seedVersion,
      registry_rows_loaded: registryRows,
      elapsed_ms: Date.now() - started_at,
      report: { per_user: perUser, totals } as BackfillReport,
    });
  } catch (err) {
    console.error("witnessify-observations fatal error", err);
    return json(
      {
        ok: false,
        error: (err as Error).message ?? String(err),
        elapsed_ms: Date.now() - started_at,
      },
      500
    );
  }
});

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

function validateRequest(
  body: RequestBody
): { error: string | null; sourceWindows: SourceWindowFilter[] } {
  if (!body || typeof body !== "object") {
    return {
      error: "Body must be a JSON object",
      sourceWindows: [],
    };
  }
  if (!Array.isArray(body.user_ids) || body.user_ids.length === 0) {
    return {
      error: "user_ids must be a non-empty array of UUID strings",
      sourceWindows: [],
    };
  }
  for (const uid of body.user_ids) {
    if (typeof uid !== "string" || uid.length !== 36) {
      return {
        error: `user_ids entry is not a valid UUID: ${uid}`,
        sourceWindows: [],
      };
    }
  }
  if (typeof body.dry_run !== "boolean") {
    return {
      error: "dry_run (boolean) is required",
      sourceWindows: [],
    };
  }
  let sourceWindows: SourceWindowFilter[];
  if (body.source_windows === undefined) {
    sourceWindows = [...VALID_SOURCE_WINDOWS];
  } else {
    if (!Array.isArray(body.source_windows)) {
      return {
        error: "source_windows must be an array if provided",
        sourceWindows: [],
      };
    }
    for (const sw of body.source_windows) {
      if (!(VALID_SOURCE_WINDOWS as readonly string[]).includes(sw)) {
        return {
          error:
            `Invalid source_window: '${sw}'. ` +
            `Must be one of [${VALID_SOURCE_WINDOWS.join(", ")}].`,
          sourceWindows: [],
        };
      }
    }
    sourceWindows = body.source_windows as SourceWindowFilter[];
  }
  return { error: null, sourceWindows };
}

// ============================================================================
// PER-USER PROCESSING
// ============================================================================

async function processUser(
  // deno-lint-ignore no-explicit-any
  sb: any,
  userId: string,
  registry: RegistryAccessor,
  sourceWindows: SourceWindowFilter[],
  dryRun: boolean
): Promise<PerUserReport> {
  const report: PerUserReport = {
    user_id: userId,
    lab_observations_scanned: 0,
    inbody_observations_scanned: 0,
    fibroscan_observations_scanned: 0,
    cie_assessments_scanned: 0,
    witnesses_produced: 0,
    witnesses_inserted: 0,
    duplicates_skipped: 0,
    registry_misses: [],
    validation_failures: [],
    soft_warnings: [],
    error_detail: null,
  };

  const witnessesBuffer: WitnessObject[] = [];

  try {
    // Direct measures from patient_lab_observations. Source column tells us
    // whether it's lab / inbody / fibroscan.
    if (
      sourceWindows.includes("lab") ||
      sourceWindows.includes("inbody") ||
      sourceWindows.includes("fibroscan")
    ) {
      await processDirectObservations(
        sb,
        userId,
        registry,
        sourceWindows,
        report,
        witnessesBuffer
      );
    }

    // CIE — one assessment at a time, lenient policy.
    if (sourceWindows.includes("cie")) {
      await processCieAssessments(sb, userId, registry, report, witnessesBuffer);
    }

    report.witnesses_produced = witnessesBuffer.length;

    // Insert (unless dry-run).
    if (!dryRun && witnessesBuffer.length > 0) {
      const { inserted, duplicates } = await insertWitnessesBatched(
        sb,
        witnessesBuffer
      );
      report.witnesses_inserted = inserted;
      report.duplicates_skipped = duplicates;
    }
  } catch (err) {
    report.error_detail = (err as Error).message ?? String(err);
    console.error(`Error processing user ${userId}:`, err);
  }

  return report;
}

// ============================================================================
// DIRECT OBSERVATIONS (lab / inbody / fibroscan)
// ============================================================================

interface PatientLabObservationRow {
  id: string;
  user_id: string;
  canonical_concept_id: string | null;
  canonical_name: string | null;
  value: number;
  unit: string;
  collection_date: string;
  source: string | null;
  raw_name: string | null;
  display_name: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: string | null;
}

/**
 * Map a patient_lab_observations row's `source` column to the canonical
 * witness source_window. Returns null if the row cannot be classified
 * (which usually means we should skip it — tracked as a miss).
 *
 * Known conventions from the codebase:
 *   - source = "InBody" (capitalized) → source_window = "inbody"
 *   - source = "fibroscan" (lowercase) → source_window = "fibroscan"
 *   - source = <lab name, e.g. "Quest", "LabCorp"> or null → "lab"
 */
function classifySourceWindow(source: string | null): SourceWindowFilter | null {
  if (source === null) return "lab"; // legacy rows without source tag are labs
  const s = source.toLowerCase();
  if (s === "inbody") return "inbody";
  if (s === "fibroscan") return "fibroscan";
  return "lab";
}

async function processDirectObservations(
  // deno-lint-ignore no-explicit-any
  sb: any,
  userId: string,
  registry: RegistryAccessor,
  sourceWindows: SourceWindowFilter[],
  report: PerUserReport,
  witnessesBuffer: WitnessObject[]
): Promise<void> {
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from("patient_lab_observations")
      .select(
        "id, user_id, canonical_concept_id, canonical_name, value, unit, " +
          "collection_date, source, raw_name, display_name, ref_low, ref_high, flag"
      )
      .eq("user_id", userId)
      .order("collection_date", { ascending: true })
      .range(offset, offset + READ_PAGE_SIZE - 1);

    if (error) throw new Error(`Read patient_lab_observations: ${error.message}`);
    const rows: PatientLabObservationRow[] = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const classification = classifySourceWindow(row.source);
      if (classification === null) {
        // Unclassifiable source — skip silently (this shouldn't happen given
        // our classification rules, but defensive).
        continue;
      }
      // Respect source_windows filter from request.
      if (!sourceWindows.includes(classification)) continue;

      // Per-window scanned counter.
      if (classification === "lab") report.lab_observations_scanned++;
      if (classification === "inbody") report.inbody_observations_scanned++;
      if (classification === "fibroscan") report.fibroscan_observations_scanned++;

      // Skip rows without canonical_concept_id — they're unmapped / in the
      // review queue. Record as a registry miss so we see the volume.
      if (!row.canonical_concept_id) {
        report.registry_misses.push({
          source_window: classification,
          signal: "<no-canonical-concept-id>",
          reason:
            "Row has no canonical_concept_id (unmapped observation). " +
            "Cannot be witnessified until reviewed and concept-assigned.",
          input_ref: {
            kind: "direct_observation",
            source_table: "patient_lab_observations",
            source_row_id: row.id,
          },
        });
        continue;
      }

      // Derive the registry signal from concept id per our P1a convention:
      //   signal = `${source_window}.${canonical_concept_id}`
      const signal = `${classification}.${row.canonical_concept_id}`;
      const testimony = buildDirectObservationTestimony(row, classification);

      const input: DirectObservationInput = {
        user_id: userId,
        source_window: classification,
        signal,
        observed_value: row.value,
        observed_unit: row.unit,
        biological_timestamp: toIsoTimestamp(row.collection_date),
        derived_from_packet_id: null,
        source_table: "patient_lab_observations",
        source_row_id: row.id,
        testimony,
      };

      // Direct measures use skip_with_warning here (same as CIE) because the
      // backfill is historical. For live intake the caller should pass
      // 'throw'. The edge function's job is historical, so lenient.
      const opts: WitnessifyOptions = {
        onRegistryMiss: "skip_with_warning",
        throwOnCatastrophic: true,
      };
      const result = witnessifyObservation(input, registry, opts);
      if (result.witnesses) {
        witnessesBuffer.push(result.witnesses);
      }
      report.registry_misses.push(...result.registry_misses);
      report.validation_failures.push(...result.validation_failures);
      report.soft_warnings.push(...result.soft_warnings);
    }

    if (rows.length < READ_PAGE_SIZE) break;
    offset += READ_PAGE_SIZE;
  }
}

function buildDirectObservationTestimony(
  row: PatientLabObservationRow,
  sourceWindow: SourceWindowFilter
): string {
  const rawName = row.raw_name ?? row.canonical_name ?? row.canonical_concept_id!;
  const windowLabel =
    sourceWindow === "inbody"
      ? "InBody composition"
      : sourceWindow === "fibroscan"
      ? "FibroScan elastography"
      : "lab panel";
  const refPart =
    row.ref_low != null && row.ref_high != null
      ? ` Reference range: ${row.ref_low}–${row.ref_high} ${row.unit}.`
      : "";
  const flagPart = row.flag ? ` Flagged as ${row.flag}.` : "";
  return (
    `Observed value ${row.value} ${row.unit} for ${rawName} on ${row.collection_date}, ` +
    `captured via ${windowLabel}.${refPart}${flagPart}`
  );
}

// ============================================================================
// CIE ASSESSMENTS
// ============================================================================

interface CieAssessmentRow {
  id: string;
  user_id: string;
  status: string;
  full_completed_at: string | null;
  layer1_completed_at: string | null;
  created_at: string;
}

interface CieResponseRow {
  id: string;
  assessment_id: string;
  question_id: string;
  domain_id: string;
  layer: number;
  question_type: string;
  raw_response: string;
  score: number;
}

interface CieDomainScoreRow {
  id: string;
  assessment_id: string;
  domain_id: string;
  axis: string;
  layer1_score: number;
  layer2_score: number | null;
  final_score: number;
  triggered_layer2: boolean;
}

interface CieGateScoreRow {
  id: string;
  assessment_id: string;
  gate_id: string;
  gate_name: string;
  score: number;
  traffic_light: string;
  contributing_domains: string[];
}

async function processCieAssessments(
  // deno-lint-ignore no-explicit-any
  sb: any,
  userId: string,
  registry: RegistryAccessor,
  report: PerUserReport,
  witnessesBuffer: WitnessObject[]
): Promise<void> {
  // Only backfill completed assessments. In-progress assessments are not yet
  // a stable witness surface.
  const { data: assessments, error: aErr } = await sb
    .from("cie_assessments")
    .select("id, user_id, status, full_completed_at, layer1_completed_at, created_at")
    .eq("user_id", userId)
    .in("status", ["completed", "layer1_complete", "complete"]);
  if (aErr) throw new Error(`Read cie_assessments: ${aErr.message}`);

  for (const a of (assessments ?? []) as CieAssessmentRow[]) {
    report.cie_assessments_scanned++;
    try {
      const input = await buildCieAssessmentInput(sb, userId, a);
      const result = witnessifyCieAssessment(input, registry, {
        onRegistryMiss: "skip_with_warning",
        throwOnCatastrophic: true,
      });
      witnessesBuffer.push(...result.witnesses);
      report.registry_misses.push(...result.registry_misses);
      report.validation_failures.push(...result.validation_failures);
      report.soft_warnings.push(...result.soft_warnings);
    } catch (err) {
      report.validation_failures.push({
        input_ref: {
          kind: "cie_response",
          assessment_id: a.id,
          question_id: "<whole-assessment>",
        },
        error_name: "AssessmentBuildFailed",
        message: (err as Error).message ?? String(err),
      });
    }
  }
}

async function buildCieAssessmentInput(
  // deno-lint-ignore no-explicit-any
  sb: any,
  userId: string,
  assessment: CieAssessmentRow
): Promise<CieAssessmentInput> {
  const assessmentId = assessment.id;

  const [respRes, domRes, gateRes] = await Promise.all([
    sb
      .from("cie_responses")
      .select("id, assessment_id, question_id, domain_id, layer, question_type, raw_response, score")
      .eq("assessment_id", assessmentId),
    sb
      .from("cie_domain_scores")
      .select("id, assessment_id, domain_id, axis, layer1_score, layer2_score, final_score, triggered_layer2")
      .eq("assessment_id", assessmentId),
    sb
      .from("cie_gate_scores")
      .select("id, assessment_id, gate_id, gate_name, score, traffic_light, contributing_domains")
      .eq("assessment_id", assessmentId),
  ]);

  if (respRes.error) throw new Error(`cie_responses read: ${respRes.error.message}`);
  if (domRes.error) throw new Error(`cie_domain_scores read: ${domRes.error.message}`);
  if (gateRes.error) throw new Error(`cie_gate_scores read: ${gateRes.error.message}`);

  const respRows: CieResponseRow[] = respRes.data ?? [];
  const domRows: CieDomainScoreRow[] = domRes.data ?? [];
  const gateRows: CieGateScoreRow[] = gateRes.data ?? [];

  // Group question_ids by domain_id for ancestry wiring in CIE batch.
  const questionIdsByDomain = new Map<string, string[]>();
  for (const r of respRows) {
    const list = questionIdsByDomain.get(r.domain_id) ?? [];
    list.push(r.question_id);
    questionIdsByDomain.set(r.domain_id, list);
  }

  const bioTs =
    assessment.full_completed_at ??
    assessment.layer1_completed_at ??
    assessment.created_at;

  const responses: CieResponseInput[] = respRows.map((r) => ({
    question_id: r.question_id,
    response_value: r.raw_response,
    response_unit: null,
    source_row_id: r.id,
    testimony: buildCieResponseTestimony(r, bioTs),
  }));

  const domainScores: CieDomainScoreInput[] = domRows.map((d) => ({
    domain_id: d.domain_id,
    score_value: Number(d.final_score),
    score_unit: "score_0_100",
    source_row_id: d.id,
    testimony: buildCieDomainTestimony(d, bioTs),
    contributing_question_ids: questionIdsByDomain.get(d.domain_id) ?? [],
  }));

  const gateScores: CieGateScoreInput[] = gateRows.map((g) => ({
    gate_id: g.gate_id,
    score_value: Number(g.score),
    score_unit: "score_0_100",
    source_row_id: g.id,
    testimony: buildCieGateTestimony(g, bioTs),
    contributing_domain_ids: g.contributing_domains ?? [],
  }));

  return {
    user_id: userId,
    assessment_id: assessmentId,
    biological_timestamp: bioTs,
    source_table: "cie_assessments",
    assessment_row_id: assessmentId,
    responses,
    domain_scores: domainScores,
    gate_scores: gateScores,
  };
}

function buildCieResponseTestimony(r: CieResponseRow, bioTs: string): string {
  const layerLabel = r.layer === 1 ? "Layer 1" : "Layer 2 deep-dive";
  return (
    `Patient self-reported '${r.raw_response}' to CIE ${r.question_id} (domain ${r.domain_id}, ${layerLabel}, ` +
    `question_type=${r.question_type}) during intake on ${bioTs.slice(0, 10)}. ` +
    `Derived response score: ${r.score}.`
  );
}

function buildCieDomainTestimony(d: CieDomainScoreRow, bioTs: string): string {
  const l2Part = d.triggered_layer2
    ? ` Layer-2 deep-dive was triggered; layer2 score ${d.layer2_score}.`
    : " Layer-2 was not triggered.";
  return (
    `CIE Domain ${d.domain_id} (axis ${d.axis}) final score ${d.final_score} on ${bioTs.slice(0, 10)}. ` +
    `Layer-1 score ${d.layer1_score}.${l2Part}`
  );
}

function buildCieGateTestimony(g: CieGateScoreRow, bioTs: string): string {
  const contrib = g.contributing_domains.join(", ");
  return (
    `CIE Gate ${g.gate_id} (${g.gate_name}) score ${g.score} on ${bioTs.slice(0, 10)}, ` +
    `traffic-light ${g.traffic_light}, aggregating domains [${contrib}].`
  );
}

// ============================================================================
// INSERT (Pattern Z idempotency)
// ============================================================================

async function insertWitnessesBatched(
  // deno-lint-ignore no-explicit-any
  sb: any,
  witnesses: WitnessObject[]
): Promise<{ inserted: number; duplicates: number }> {
  // Insert in depth order so FK-like ancestry references are already
  // present when depth-1/2 witnesses land. witness_objects ancestry is
  // a TEXT[], not a FK, but ordering is still a good habit.
  const byDepth = [0, 1, 2].flatMap((d) => witnesses.filter((w) => w.compression_depth === d));

  let inserted = 0;
  let duplicates = 0;
  for (let i = 0; i < byDepth.length; i += INSERT_BATCH_SIZE) {
    const batch = byDepth.slice(i, i + INSERT_BATCH_SIZE).map((w) => ({
      witness_id: w.witness_id,
      user_id: w.user_id,
      derived_from_packet_id: w.derived_from_packet_id,
      source_table: w.source_table,
      source_row_id: w.source_row_id,
      ancestry_witness_ids: w.ancestry_witness_ids,
      source_window: w.source_window,
      signal: w.signal,
      domain_of_access: w.domain_of_access,
      epistemic_role: w.epistemic_role,
      reliability_class: w.reliability_class,
      compression_depth: w.compression_depth,
      observed_value: w.observed_value,
      observed_unit: w.observed_unit,
      testimony: w.testimony,
      limitations: w.limitations,
      confidence_value: w.confidence_value,
      confidence_basis: w.confidence_basis,
      biological_timestamp: w.biological_timestamp,
      validity_window_seconds: w.validity_window_seconds,
      conflict_candidates: w.conflict_candidates,
      transformation_version: w.transformation_version,
      registry_seed_version: w.registry_seed_version,
    }));

    // ON CONFLICT handled via upsert with ignoreDuplicates.
    const { data, error } = await sb
      .from("witness_objects")
      .upsert(batch, {
        onConflict: "user_id,source_table,source_row_id,registry_seed_version",
        ignoreDuplicates: true,
      })
      .select("witness_id");

    if (error) throw new Error(`witness_objects insert: ${error.message}`);
    const gotBack = (data ?? []).length;
    inserted += gotBack;
    duplicates += batch.length - gotBack;
  }
  return { inserted, duplicates };
}

// ============================================================================
// HELPERS
// ============================================================================

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sum<T>(arr: T[], f: (x: T) => number): number {
  return arr.reduce((acc, x) => acc + f(x), 0);
}

/**
 * Convert a `YYYY-MM-DD` DATE string to a full ISO timestamp.
 * `patient_lab_observations.collection_date` is a DATE (no time), so we
 * normalize to midnight UTC on that date.
 */
function toIsoTimestamp(dateOrIso: string): string {
  if (dateOrIso.includes("T")) return dateOrIso;
  return `${dateOrIso}T00:00:00.000Z`;
}

// ============================================================================
// END OF witnessify-observations/index.ts
// ============================================================================
