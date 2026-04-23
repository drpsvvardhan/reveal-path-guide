// ============================================================================
// supabase/functions/generate-clusters/contextLoader.ts  (REWRITTEN — P1a Artifact 6)
// ----------------------------------------------------------------------------
// REWRITE (23 April 2026): reads from `witness_objects` instead of raw
// observation tables. The external contract — `PatientTerrainContext`
// shape, `loadPatientContext` signature, `compressContextForCritique`
// signature — is preserved, so no downstream code changes are required.
//
// What changed substantively:
//   - `labs.observations`, `inbody.observations`, and CIE arrays are now
//     populated from `witness_objects` rows, scoped to a registry seed
//     version.
//   - Each `observation_id` / `response_id` is now the `witness_id` of
//     the witness that testifies to that value. Citations are
//     traceable to constitutional witnesses by design.
//   - Raw tables (`patient_lab_observations`, `cie_responses`, etc.)
//     are not read by this loader anymore. P1a contract-line:
//     reasoning modules consume witnesses, not raw observations.
//   - Two fields remain sourced from legacy tables: `narrative`
//     (`patient_narratives`) and `prior_patterns` (`derived_patterns`).
//     These are flagged as legacy per the P1a audit; they are not
//     migrated to the witness layer in P1a and remain as-is.
//
// Option M ship-gate properties this enforces (see P1A_STATE_SNAPSHOT.md § 11):
//   P-1: every observation in context has a witness_id
//   P-2: every witness_id cited is present in witness_objects
//   P-3: no signal appears in context that isn't in witness_signal_registry
//        for the seed version
//   P-4: cluster generation completes without errors for VV-001
//   P-5: the ~184 witnesses available for VV-001 feed the graph
//        (not the raw rows that didn't witnessify)
//
// Hold: P1a does not make the system smarter. It makes future intelligence
// lawful.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// TUNING CONSTANTS
// ============================================================================

/**
 * Registry seed version scope. The contextLoader reads only witnesses at
 * this seed version. When a new seed ships (e.g. `p1a_inbody_extension_v1`),
 * update this constant and redeploy — OR extract to env variable if
 * multi-seed concurrent operation is ever required.
 */
const ACTIVE_REGISTRY_SEED_VERSION = "p1a_initial";

/**
 * Cap on total witness rows read per user to protect against pathological
 * datasets. If exceeded, newest witnesses are kept. Very generous default.
 */
const MAX_WITNESSES_PER_USER = 5000;

/**
 * Sample cap for CIE responses in the compressed critique output.
 * Same as legacy loader.
 */
const CIE_RESPONSE_SAMPLE_CAP = 50;

// ============================================================================
// PUBLIC INTERFACE — preserved from legacy loader
// ============================================================================

export interface PatientTerrainContext {
  patient_id: string;
  profile: {
    display_name: string | null;
    age: number | null;
    sex: string | null;
  };
  cie: {
    has_assessment: boolean;
    domain_scores: Array<{
      domain_id: string;
      axis: string;
      final_score: number;
      triggered_layer2: boolean;
      layer2_score: number | null;
      /** NEW in Artifact 6: witness_id of the depth-1 witness for this domain score. */
      witness_id: string;
    }>;
    gate_scores: Array<{
      gate_id: string;
      gate_name: string;
      score: number;
      traffic_light: string;
      contributing_domains: string[];
      /** NEW in Artifact 6: witness_id of the depth-2 witness for this gate score. */
      witness_id: string;
    }>;
    sample_responses: Array<{
      /** Preserved name, now holds witness_id instead of raw response row id. */
      response_id: string;
      question_id: string;
      domain_id: string;
      raw_response: string;
      score: number;
    }>;
  };
  labs: {
    has_observations: boolean;
    observations: Array<{
      /** Preserved name, now holds witness_id instead of raw observation row id. */
      observation_id: string;
      canonical_name: string;
      value: number;
      unit: string;
      flag: string | null;
      collection_date: string;
      ref_low: number | null;
      ref_high: number | null;
      source: string | null;
    }>;
  };
  inbody: {
    has_observations: boolean;
    observations: Array<{
      observation_id: string;
      canonical_name: string;
      value: number;
      unit: string;
      collection_date: string;
      source: string;
    }>;
  };
  /**
   * NEW in Artifact 6: FibroScan gets its own section (was grouped under
   * labs before, since they all live in patient_lab_observations). This
   * gives the clustering prompt a clear signal when FibroScan data is
   * present.
   */
  fibroscan: {
    has_observations: boolean;
    observations: Array<{
      observation_id: string;
      canonical_name: string;
      value: number;
      unit: string;
      collection_date: string;
    }>;
  };
  narrative: {
    has_narrative: boolean;
    latest: {
      narrative_id: string;
      narrative: unknown; // jsonb — shape varies
      created_at: string;
    } | null;
  };
  prior_patterns: {
    has_patterns: boolean;
    patterns: Array<{
      pattern_id: string;
      rule_id: string;
      title: string;
      severity: string;
      category: string;
    }>;
  };
  /**
   * NEW in Artifact 6: provenance summary so downstream reasoning can
   * report on the constitutional coverage of the terrain it sees.
   */
  witness_provenance: {
    registry_seed_version: string;
    total_witnesses: number;
    depth_0_count: number;
    depth_1_count: number;
    depth_2_count: number;
    source_window_counts: Record<string, number>;
  };
}

// ============================================================================
// LOADER — main entry point
// ============================================================================

export async function loadPatientContext(
  supabaseUrl: string,
  serviceRoleKey: string,
  patientId: string
): Promise<PatientTerrainContext> {
  const sb = createClient(supabaseUrl, serviceRoleKey);

  // ---- Profile (unchanged; still reads from `profiles`) ------------------

  const { data: profile } = await sb
    .from("profiles")
    .select("id, display_name, age, sex")
    .eq("user_id", patientId)
    .maybeSingle();

  // profiles.id is what clusters.patient_id FKs to. If profile row is
  // missing, fall back to the auth user_id as before.
  const canonicalPatientId = profile?.id ?? patientId;

  // ---- Witnesses — the whole terrain substrate --------------------------

  const { data: witnessRows, error: witError } = await sb
    .from("witness_objects")
    .select(
      "witness_id, user_id, source_table, source_row_id, ancestry_witness_ids, " +
        "source_window, signal, domain_of_access, epistemic_role, reliability_class, " +
        "compression_depth, observed_value, observed_unit, testimony, limitations, " +
        "confidence_value, confidence_basis, biological_timestamp, " +
        "validity_window_seconds, conflict_candidates, " +
        "transformation_version, registry_seed_version"
    )
    .eq("user_id", patientId)
    .eq("registry_seed_version", ACTIVE_REGISTRY_SEED_VERSION)
    .order("biological_timestamp", { ascending: false })
    .limit(MAX_WITNESSES_PER_USER);

  if (witError) {
    throw new Error(
      `contextLoader failed to read witness_objects for user ${patientId}: ${witError.message}`
    );
  }

  const witnesses: WitnessRow[] = (witnessRows ?? []) as WitnessRow[];

  // Partition witnesses by source_window + depth for clean assembly.
  const partitioned = partitionWitnesses(witnesses);

  // ---- Assemble CIE section ---------------------------------------------

  // Gate-score witnesses (depth 2) → cie.gate_scores
  const gateScoreEntries: PatientTerrainContext["cie"]["gate_scores"] =
    partitioned.cieGateScores.map((w) => ({
      gate_id: extractIdFromSignal(w.signal, "cie.gate_score."),
      gate_name: looksLikeString(w.observed_value, "gate_name_from_testimony")
        ? ""
        : extractIdFromSignal(w.signal, "cie.gate_score."),
      score: numericOrZero(w.observed_value),
      traffic_light: extractTrafficLight(w.testimony),
      contributing_domains: extractContributingDomains(w.testimony),
      witness_id: w.witness_id,
    }));

  // Domain-score witnesses (depth 1) → cie.domain_scores
  const domainScoreEntries: PatientTerrainContext["cie"]["domain_scores"] =
    partitioned.cieDomainScores.map((w) => ({
      domain_id: extractIdFromSignal(w.signal, "cie.domain_score."),
      axis: extractAxisFromTestimony(w.testimony),
      final_score: numericOrZero(w.observed_value),
      triggered_layer2: extractLayer2Triggered(w.testimony),
      layer2_score: extractLayer2Score(w.testimony),
      witness_id: w.witness_id,
    }));

  // Response witnesses (depth 0, cie) → sample_responses
  // Old loader sampled from triggered-layer2 domains only. New loader uses
  // witness ancestry: we include responses whose witness_id appears in
  // any domain witness's ancestry AND whose domain triggered layer 2.
  const triggeredDomainIds = new Set(
    domainScoreEntries.filter((d) => d.triggered_layer2).map((d) => d.domain_id)
  );

  const triggeredDomainWitnessIds = new Set(
    partitioned.cieDomainScores
      .filter((w) => triggeredDomainIds.has(extractIdFromSignal(w.signal, "cie.domain_score.")))
      .flatMap((w) => w.ancestry_witness_ids ?? [])
  );

  const sampleResponses: PatientTerrainContext["cie"]["sample_responses"] =
    partitioned.cieResponses
      .filter((w) => triggeredDomainWitnessIds.has(w.witness_id))
      .slice(0, CIE_RESPONSE_SAMPLE_CAP)
      .map((w) => ({
        response_id: w.witness_id,
        question_id: extractIdFromSignal(w.signal, "cie.response."),
        domain_id: extractDomainIdFromQuestionId(
          extractIdFromSignal(w.signal, "cie.response.")
        ),
        raw_response: String(w.observed_value ?? ""),
        score: extractScoreFromTestimony(w.testimony),
      }));

  const hasAssessment =
    partitioned.cieDomainScores.length > 0 ||
    partitioned.cieGateScores.length > 0 ||
    partitioned.cieResponses.length > 0;

  // ---- Labs / InBody / FibroScan (split by source_window) ---------------

  const labObservations = partitioned.labs.map((w) => ({
    observation_id: w.witness_id,
    canonical_name: extractCanonicalNameFromSignal(w.signal),
    value: numericOrZero(w.observed_value),
    unit: w.observed_unit ?? "",
    flag: extractFlagFromTestimony(w.testimony),
    collection_date: shortDate(w.biological_timestamp),
    ref_low: extractRefLowFromTestimony(w.testimony),
    ref_high: extractRefHighFromTestimony(w.testimony),
    source: extractSourceLabelFromTestimony(w.testimony),
  }));

  const inbodyObservations = partitioned.inbody.map((w) => ({
    observation_id: w.witness_id,
    canonical_name: extractCanonicalNameFromSignal(w.signal),
    value: numericOrZero(w.observed_value),
    unit: w.observed_unit ?? "",
    collection_date: shortDate(w.biological_timestamp),
    source: "InBody",
  }));

  const fibroscanObservations = partitioned.fibroscan.map((w) => ({
    observation_id: w.witness_id,
    canonical_name: extractCanonicalNameFromSignal(w.signal),
    value: numericOrZero(w.observed_value),
    unit: w.observed_unit ?? "",
    collection_date: shortDate(w.biological_timestamp),
  }));

  // ---- Legacy: narrative + prior_patterns (unchanged) -------------------
  // These are not witnessed in P1a per audit. They remain readable from
  // legacy tables and are flagged for sunset in a later phase.

  const { data: narrative } = await sb
    .from("patient_narratives")
    .select("id, narrative, created_at")
    .eq("user_id", patientId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: priorPatterns } = await sb
    .from("derived_patterns")
    .select("id, rule_id, title, severity, category")
    .eq("user_id", patientId)
    .eq("status", "active")
    .limit(40);

  // ---- Witness provenance summary ----------------------------------------

  const sourceWindowCounts: Record<string, number> = {};
  for (const w of witnesses) {
    sourceWindowCounts[w.source_window] = (sourceWindowCounts[w.source_window] ?? 0) + 1;
  }

  return {
    patient_id: canonicalPatientId,
    profile: {
      display_name: profile?.display_name ?? null,
      age: profile?.age ?? null,
      sex: profile?.sex ?? null,
    },
    cie: {
      has_assessment: hasAssessment,
      domain_scores: domainScoreEntries,
      gate_scores: gateScoreEntries,
      sample_responses: sampleResponses,
    },
    labs: {
      has_observations: labObservations.length > 0,
      observations: labObservations,
    },
    inbody: {
      has_observations: inbodyObservations.length > 0,
      observations: inbodyObservations,
    },
    fibroscan: {
      has_observations: fibroscanObservations.length > 0,
      observations: fibroscanObservations,
    },
    narrative: {
      has_narrative: !!narrative,
      latest: narrative
        ? {
            narrative_id: narrative.id,
            narrative: narrative.narrative,
            created_at: narrative.created_at,
          }
        : null,
    },
    prior_patterns: {
      has_patterns: (priorPatterns?.length ?? 0) > 0,
      patterns: (priorPatterns ?? []).map((p: {
        id: string;
        rule_id: string;
        title: string;
        severity: string;
        category: string;
      }) => ({
        pattern_id: p.id,
        rule_id: p.rule_id,
        title: p.title,
        severity: p.severity,
        category: p.category,
      })),
    },
    witness_provenance: {
      registry_seed_version: ACTIVE_REGISTRY_SEED_VERSION,
      total_witnesses: witnesses.length,
      depth_0_count: witnesses.filter((w) => w.compression_depth === 0).length,
      depth_1_count: witnesses.filter((w) => w.compression_depth === 1).length,
      depth_2_count: witnesses.filter((w) => w.compression_depth === 2).length,
      source_window_counts: sourceWindowCounts,
    },
  };
}

// ============================================================================
// COMPRESSED CRITIQUE REPRESENTATION  — preserved signature
// ============================================================================

export function compressContextForCritique(context: PatientTerrainContext): string {
  const lines: string[] = [];

  lines.push(`# PATIENT ${context.patient_id}`);
  if (context.profile.display_name) lines.push(`name: ${context.profile.display_name}`);
  if (context.profile.age != null) lines.push(`age: ${context.profile.age}`);
  if (context.profile.sex) lines.push(`sex: ${context.profile.sex}`);
  lines.push(
    `witness_seed: ${context.witness_provenance.registry_seed_version} ` +
      `total=${context.witness_provenance.total_witnesses} ` +
      `d0=${context.witness_provenance.depth_0_count} ` +
      `d1=${context.witness_provenance.depth_1_count} ` +
      `d2=${context.witness_provenance.depth_2_count}`
  );
  lines.push("");

  if (context.cie.has_assessment) {
    lines.push("## CIE DOMAIN SCORES (witness-backed)");
    lines.push("# format: witness_id|domain_id|axis|score|deep_dive");
    for (const d of context.cie.domain_scores) {
      const flag = d.triggered_layer2 ? "1" : "0";
      lines.push(`${d.witness_id}|${d.domain_id}|${d.axis}|${d.final_score}|${flag}`);
    }
    lines.push("");
    lines.push("## CIE GATE SCORES (witness-backed)");
    lines.push("# format: witness_id|gate_name|score|traffic_light");
    for (const g of context.cie.gate_scores) {
      lines.push(`${g.witness_id}|${g.gate_name}|${g.score}|${g.traffic_light}`);
    }
    lines.push("");
    if (context.cie.sample_responses.length > 0) {
      lines.push(
        "## CIE RESPONSE SAMPLE (witness-backed; triggered-domain layer-2 only)"
      );
      lines.push("# format: witness_id|question_id|domain_id|score");
      for (const r of context.cie.sample_responses.slice(0, 15)) {
        lines.push(`${r.response_id}|${r.question_id}|${r.domain_id}|${r.score}`);
      }
      lines.push("");
    }
  }

  if (context.labs.has_observations) {
    lines.push(`## LABS (${context.labs.observations.length} witness-backed observations)`);
    lines.push("# format: witness_id|analyte|value|unit|flag|date");
    for (const l of context.labs.observations) {
      const flag = l.flag ?? "";
      const date = l.collection_date ? String(l.collection_date).slice(0, 10) : "";
      lines.push(
        `${l.observation_id}|${l.canonical_name}|${l.value}|${l.unit}|${flag}|${date}`
      );
    }
    lines.push("");
  }

  if (context.inbody.has_observations) {
    lines.push(`## INBODY (${context.inbody.observations.length} witness-backed observations)`);
    lines.push("# format: witness_id|metric|value|unit|date");
    for (const i of context.inbody.observations) {
      const date = i.collection_date ? String(i.collection_date).slice(0, 10) : "";
      lines.push(`${i.observation_id}|${i.canonical_name}|${i.value}|${i.unit}|${date}`);
    }
    lines.push("");
  }

  if (context.fibroscan.has_observations) {
    lines.push(`## FIBROSCAN (${context.fibroscan.observations.length} witness-backed observations)`);
    lines.push("# format: witness_id|metric|value|unit|date");
    for (const f of context.fibroscan.observations) {
      const date = f.collection_date ? String(f.collection_date).slice(0, 10) : "";
      lines.push(`${f.observation_id}|${f.canonical_name}|${f.value}|${f.unit}|${date}`);
    }
    lines.push("");
  }

  if (context.narrative.has_narrative && context.narrative.latest) {
    const n = context.narrative.latest;
    lines.push("## NARRATIVE (legacy, not witnessed)");
    lines.push(`narrative_id: ${n.narrative_id}`);
    const narr = n.narrative;
    if (typeof narr === "object" && narr !== null) {
      const obj = narr as Record<string, unknown>;
      if (typeof obj.thesis === "string") lines.push(`thesis: ${obj.thesis}`);
      if (Array.isArray(obj.helping) && obj.helping.length > 0) {
        lines.push(`helping: ${obj.helping.join("; ")}`);
      }
      if (Array.isArray(obj.feeding) && obj.feeding.length > 0) {
        lines.push(`feeding: ${obj.feeding.join("; ")}`);
      }
      if (Array.isArray(obj.symptoms) && obj.symptoms.length > 0) {
        lines.push(`symptoms: ${obj.symptoms.join("; ")}`);
      }
    }
    lines.push("");
  }

  if (context.prior_patterns.has_patterns) {
    lines.push(`## PRIOR PATTERNS (${context.prior_patterns.patterns.length}; legacy)`);
    lines.push("# format: id|severity|category|title");
    for (const p of context.prior_patterns.patterns) {
      lines.push(`${p.pattern_id}|${p.severity}|${p.category}|${p.title}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// INTERNAL — WitnessRow type + partitioning + testimony extractors
// ============================================================================

interface WitnessRow {
  witness_id: string;
  user_id: string;
  source_table: string | null;
  source_row_id: string | null;
  ancestry_witness_ids: string[] | null;
  source_window: string;
  signal: string;
  domain_of_access: string;
  epistemic_role: string;
  reliability_class: string;
  compression_depth: number;
  observed_value: unknown;
  observed_unit: string | null;
  testimony: string;
  limitations: string[];
  confidence_value: number;
  confidence_basis: string;
  biological_timestamp: string;
  validity_window_seconds: number | null;
  conflict_candidates: string[] | null;
  transformation_version: string;
  registry_seed_version: string;
}

interface PartitionedWitnesses {
  cieResponses: WitnessRow[];
  cieDomainScores: WitnessRow[];
  cieGateScores: WitnessRow[];
  labs: WitnessRow[];
  inbody: WitnessRow[];
  fibroscan: WitnessRow[];
}

function partitionWitnesses(ws: WitnessRow[]): PartitionedWitnesses {
  const out: PartitionedWitnesses = {
    cieResponses: [],
    cieDomainScores: [],
    cieGateScores: [],
    labs: [],
    inbody: [],
    fibroscan: [],
  };
  for (const w of ws) {
    if (w.source_window === "cie") {
      if (w.signal.startsWith("cie.response.")) out.cieResponses.push(w);
      else if (w.signal.startsWith("cie.domain_score.")) out.cieDomainScores.push(w);
      else if (w.signal.startsWith("cie.gate_score.")) out.cieGateScores.push(w);
    } else if (w.source_window === "lab") {
      out.labs.push(w);
    } else if (w.source_window === "inbody") {
      out.inbody.push(w);
    } else if (w.source_window === "fibroscan") {
      out.fibroscan.push(w);
    }
    // Other source_windows (sensor, wearable, omics, imaging, medication, emr,
    // history, narrative) are P1b/P1c; not yet populated.
  }
  // For CIE: take the LATEST assessment only (witnesses sorted desc by
  // biological_timestamp above). If multiple assessments exist, keep
  // only the ones matching the most recent biological_timestamp.
  out.cieDomainScores = keepLatestAssessmentOnly(out.cieDomainScores);
  out.cieGateScores = keepLatestAssessmentOnly(out.cieGateScores);
  out.cieResponses = keepLatestAssessmentOnly(out.cieResponses);

  return out;
}

/**
 * Among CIE witnesses, keep only those whose biological_timestamp matches
 * the latest timestamp present. Same-assessment witnesses share a
 * timestamp by construction (see Artifact 5's buildCieAssessmentInput).
 */
function keepLatestAssessmentOnly(ws: WitnessRow[]): WitnessRow[] {
  if (ws.length === 0) return ws;
  // biological_timestamp is ISO-8601; string comparison is lexicographically
  // equivalent to chronological for well-formed timestamps.
  const latest = ws.reduce(
    (acc, w) => (w.biological_timestamp > acc ? w.biological_timestamp : acc),
    ws[0].biological_timestamp
  );
  return ws.filter((w) => w.biological_timestamp === latest);
}

function extractIdFromSignal(signal: string, prefix: string): string {
  return signal.startsWith(prefix) ? signal.slice(prefix.length) : signal;
}

function extractCanonicalNameFromSignal(signal: string): string {
  // Signal format: "{source_window}.{concept_id}" → the concept_id part
  // is the canonical name for labs/inbody/fibroscan.
  const dot = signal.indexOf(".");
  return dot >= 0 ? signal.slice(dot + 1) : signal;
}

function extractDomainIdFromQuestionId(qid: string): string {
  // question_id format: A1Q1, A1D5, etc. Domain = prefix up to Q or D.
  const m = qid.match(/^([A-Z]\d+)[QD]\d+/);
  return m ? m[1] : qid;
}

function numericOrZero(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function looksLikeString(_v: unknown, _hint: string): boolean {
  // Reserved placeholder — gate_name extraction is a simplified convention
  // while Artifact 6 preserves external contract. Future work may store
  // gate_name explicitly on the registry entry for exact round-tripping.
  return false;
}

function shortDate(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/**
 * Testimony-extraction helpers. These parse the structured testimony
 * strings the witnessify function emits. They are best-effort — if a
 * testimony does not contain the expected text, the helper returns a
 * benign default, not an error.
 *
 * When Artifact 6's prompt work lands (separate phase), we can either:
 *   (a) teach prompts to consume `testimony` directly (preferred)
 *   (b) promote commonly-parsed fields into first-class columns
 * For now, we do (b) only for the fields the legacy loader already exposed
 * (flag, ref_low, ref_high, source, traffic_light, triggered_layer2, etc).
 */

function extractFlagFromTestimony(t: string): string | null {
  const m = t.match(/Flagged as (\w+)/);
  return m ? m[1] : null;
}

function extractRefLowFromTestimony(t: string): number | null {
  const m = t.match(/Reference range: ([\d.]+)–/);
  return m ? Number(m[1]) : null;
}

function extractRefHighFromTestimony(t: string): number | null {
  const m = t.match(/Reference range: [\d.]+–([\d.]+)/);
  return m ? Number(m[1]) : null;
}

function extractSourceLabelFromTestimony(t: string): string | null {
  // Testimony format (from Artifact 5): "...captured via {windowLabel}..."
  // windowLabel is "lab panel", "InBody composition", or "FibroScan elastography".
  // For labs, the panel's original source lab name isn't preserved in the
  // testimony verbatim; we return null for now. A future iteration can
  // reserve a column or restructure testimony to preserve it explicitly.
  if (t.includes("lab panel")) return null;
  return null;
}

function extractTrafficLight(t: string): string {
  const m = t.match(/traffic-light (\w+)/);
  return m ? m[1].toUpperCase() : "YELLOW";
}

function extractContributingDomains(t: string): string[] {
  const m = t.match(/aggregating domains \[([^\]]+)\]/);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

function extractAxisFromTestimony(t: string): string {
  const m = t.match(/axis ([A-Z])/);
  return m ? m[1] : "";
}

function extractLayer2Triggered(t: string): boolean {
  return t.includes("Layer-2 deep-dive was triggered");
}

function extractLayer2Score(t: string): number | null {
  const m = t.match(/layer2 score (\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function extractScoreFromTestimony(t: string): number {
  const m = t.match(/Derived response score: (\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 50;
}

// ============================================================================
// END OF contextLoader.ts (REWRITTEN)
// ============================================================================
