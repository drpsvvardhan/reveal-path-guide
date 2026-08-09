// ============================================================================
// supabase/functions/_shared/biotwin/adapter.ts
// ----------------------------------------------------------------------------
// Deterministic projection of a BioTwin Clinical Evidence Report into governed
// evidence objects. Pure function. No LLM, no I/O, no randomness, no clock.
//
// Truth buckets are preserved exactly. Nothing is flattened.
// ============================================================================

import {
  BIOTWIN_REPORT_TYPE,
  BIOTWIN_SCHEMA_NAME,
  type BiotwinAdaptResult,
  type BiotwinClinicalAuthority,
  type BiotwinDiagnostic,
  type BiotwinHold,
  type BiotwinMeasurement,
  type BiotwinReportDraft,
  type BiotwinStatementDraft,
  type BiotwinStatementKind,
  type BiotwinTruthStatus,
  type BiotwinWitnessCandidate,
} from "./types.ts";
import { lookupAllowlist, unitsMatch } from "./allowlist.ts";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function strList(v: unknown): string[] {
  return arr(v).filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

/**
 * Deterministic 128-bit-ish hex digest (FNV-1a over four offset bases).
 * Used only for source_id derivation when the report supplies no ID, so it
 * must be stable across runtimes — hence no crypto dependency.
 */
function stableHash(input: string): string {
  const bases = [0x811c9dc5, 0x01000193, 0x7fffffff, 0x9e3779b9];
  return bases
    .map((base) => {
      let h = base >>> 0;
      for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return h.toString(16).padStart(8, "0");
    })
    .join("");
}

function deriveSourceId(
  section: string,
  ordinal: number,
  title: string,
  declaredId: string | null
): string {
  if (declaredId) return declaredId;
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, " ").trim();
  return `${section}:${ordinal}:${stableHash(`${section}|${ordinal}|${normalizedTitle}`).slice(0, 16)}`;
}

function parseMeasurements(raw: unknown, fallbackDate: string | null): BiotwinMeasurement[] {
  const items = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const out: BiotwinMeasurement[] = [];
  for (const m of items) {
    if (!isObject(m)) continue;
    const name = str(m.name);
    if (!name) continue;
    out.push({
      name,
      value: num(m.value),
      unit: str(m.unit),
      timepoint: str(m.collected) ?? str(m.date) ?? str(m.timepoint) ?? fallbackDate,
      percent: num(m.percent),
      window: str(m.window),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Statement builder
// ---------------------------------------------------------------------------

interface StatementInput {
  section: string;
  kind: BiotwinStatementKind;
  truth: BiotwinTruthStatus;
  authority: BiotwinClinicalAuthority;
  title: string;
  body?: string | null;
  bounds?: string[];
  measurements?: BiotwinMeasurement[];
  timepoint?: string | null;
  requires?: BiotwinStatementDraft["requires_measurement"];
  holds?: BiotwinHold[];
  provenance?: Record<string, unknown>;
  declaredId?: string | null;
  ordinal: number;
}

function makeStatement(input: StatementInput): BiotwinStatementDraft {
  return {
    source_id: deriveSourceId(input.section, input.ordinal, input.title, input.declaredId ?? null),
    section: input.section,
    statement_kind: input.kind,
    truth_status: input.truth,
    title: input.title,
    body: input.body ?? null,
    bounds: input.bounds ?? [],
    measurements: input.measurements ?? [],
    timepoint: input.timepoint ?? null,
    clinical_authority: input.authority,
    requires_measurement: input.requires ?? null,
    holds: input.holds ?? [],
    provenance: input.provenance ?? {},
    ordinal: input.ordinal,
  };
}

// ---------------------------------------------------------------------------
// Release-control derived gating
// ---------------------------------------------------------------------------

function isPermitted(value: unknown): boolean {
  const s = typeof value === "string" ? value.toUpperCase() : "";
  return s.startsWith("PERMITTED") || s === "RELEASED" || s === "APPROVED";
}

function deriveReportHolds(report: Record<string, unknown>): BiotwinHold[] {
  const holds = new Set<BiotwinHold>();
  const rc = isObject(report.release_control) ? report.release_control : {};

  if (!isPermitted(rc.patient_facing_release)) holds.add("patient_release_hold");
  if (String(rc.overall_status ?? "").toUpperCase().includes("CLINICIAN_REVIEW")) {
    holds.add("clinician_review_hold");
  }
  if (!isPermitted(rc.medication_or_treatment_decision)) holds.add("medication_hold");
  if (!isPermitted(rc.decision_grade_multiomic_use)) holds.add("decision_grade_hold");

  const gpx = isObject(report.genomics_and_pgx) ? report.genomics_and_pgx : {};
  const pgx = isObject(gpx.pgx) ? gpx.pgx : {};
  if (num(pgx.hard_gates_permitted) === 0 || !isPermitted(pgx.patient_specific_use)) {
    holds.add("pgx_hold");
  }

  const cs = isObject(report.clinical_state) ? report.clinical_state : {};
  const candidates = arr(cs.candidate_or_unverified_signals);
  const cgmMentioned = candidates.some((c) =>
    isObject(c) && JSON.stringify(c).toLowerCase().includes("cgm")
  );
  if (cgmMentioned) holds.add("cgm_hold");

  const med = isObject(report.medication_status) ? report.medication_status : {};
  if (arr(med.historical_or_unresolved_items).length > 0) holds.add("medication_hold");

  return [...holds];
}

// ---------------------------------------------------------------------------
// Main adapter
// ---------------------------------------------------------------------------

export function adaptBiotwinReport(input: Record<string, unknown>): BiotwinAdaptResult {
  const diagnostics: BiotwinDiagnostic[] = [];
  const statements: BiotwinStatementDraft[] = [];
  const witnessCandidates: BiotwinWitnessCandidate[] = [];

  const schema = isObject(input.schema) ? input.schema : {};
  const subject = isObject(input.subject) ? input.subject : {};
  const rc = isObject(input.release_control) ? input.release_control : {};
  const projection = isObject(input.clinical_report_projection)
    ? input.clinical_report_projection
    : {};
  const reportHolds = deriveReportHolds(input);

  let ordinal = 0;
  const next = () => ordinal++;

  // ---- clinical_state: four truth buckets, kept distinct -----------------

  // ---- Evidence Plane: measured evidence, released by default ------------
  // Patient observations (CGM summaries, food log, sensors). Confirmed,
  // patient-facing, no claim authority required — interpretation of them
  // still lives in the governed claim buckets above.
  for (const raw of arr(input.measured_evidence)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "measured_evidence",
        kind: "measured_evidence",
        truth: "confirmed",
        authority: "patient_facing",
        title: str(raw.title) ?? "Measured evidence",
        body: str(raw.summary),
        bounds: [
          "Measured evidence released by default. It reports what was observed; any interpretation beyond the values themselves remains governed by the released claims.",
        ],
        provenance: { source_root: str(raw.source_root) },
        declaredId: str(raw.evidence_id),
        ordinal: next(),
      })
    );
  }

  const cs = isObject(input.clinical_state) ? input.clinical_state : {};

  for (const raw of arr(cs.confirmed_measurements_and_bounded_findings)) {
    if (!isObject(raw)) continue;
    const title = str(raw.title) ?? "Confirmed finding";
    const measurements = parseMeasurements(raw.measurements, null);
    statements.push(
      makeStatement({
        section: "clinical_state.confirmed_measurements_and_bounded_findings",
        kind: "confirmed_measurement",
        truth: "confirmed",
        authority: "patient_facing",
        title,
        body: str(raw.correct_interpretation),
        bounds: strList(raw.important_bounds),
        measurements,
        timepoint: measurements.find((m) => m.timepoint)?.timepoint ?? null,
        holds: reportHolds.includes("clinician_review_hold") ? ["clinician_review_hold"] : [],
        provenance: {
          status: str(raw.status),
          domain: str(raw.domain),
          decision_relevance: str(raw.decision_relevance),
          source_evidence_ids: strList(raw.source_evidence_ids),
        },
        declaredId: str(raw.finding_id),
        ordinal: next(),
      })
    );
  }

  for (const raw of arr(cs.candidate_or_unverified_signals)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "clinical_state.candidate_or_unverified_signals",
        kind: "candidate_signal",
        truth: "candidate",
        authority: "clinician_only",
        title: str(raw.title) ?? "Candidate signal",
        body: str(raw.correct_interpretation),
        bounds: [...strList(raw.unresolved_validity_items), ...(str(raw.do_not_do_yet) ? [str(raw.do_not_do_yet)!] : [])],
        measurements: parseMeasurements(raw.measurements, null),
        requires: { next_truth_test: str(raw.next_truth_test) },
        holds: JSON.stringify(raw).toLowerCase().includes("cgm") ? ["cgm_hold"] : [],
        provenance: {
          status: str(raw.status),
          domain: str(raw.domain),
          urgency_note: str(raw.urgency_note),
          source_evidence_ids: strList(raw.source_evidence_ids),
        },
        declaredId: str(raw.finding_id),
        ordinal: next(),
      })
    );
  }

  for (const raw of arr(cs.open_screening_findings)) {
    if (!isObject(raw)) continue;
    const measurements = parseMeasurements(raw.measurement ?? raw.measurements, null);
    statements.push(
      makeStatement({
        section: "clinical_state.open_screening_findings",
        kind: "open_screening",
        truth: "unknown",
        authority: "clinician_only",
        title: str(raw.title) ?? "Open screening finding",
        body: str(raw.correct_interpretation),
        measurements,
        timepoint: measurements.find((m) => m.timepoint)?.timepoint ?? null,
        requires: { next_truth_test: str(raw.next_truth_test) },
        provenance: {
          status: str(raw.status),
          domain: str(raw.domain),
          source_evidence_ids: strList(raw.source_evidence_ids),
        },
        declaredId: str(raw.finding_id),
        ordinal: next(),
      })
    );
  }

  for (const raw of arr(cs.not_established_or_not_supported)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "clinical_state.not_established_or_not_supported",
        kind: "not_established",
        truth: "retired",
        authority: "clinician_only",
        title: str(raw.claim) ?? "Retired claim",
        body: str(raw.replacement),
        provenance: { verdict: str(raw.verdict) },
        declaredId: str(raw.finding_id),
        ordinal: next(),
      })
    );
  }

  // ---- headline governance ----------------------------------------------

  const allowedHeadlines = strList(projection.allowed_headline_statements);
  const prohibitedHeadlines = strList(projection.prohibited_headline_statements);

  allowedHeadlines.forEach((h) =>
    statements.push(
      makeStatement({
        section: "clinical_report_projection.allowed_headline_statements",
        kind: "allowed_headline",
        truth: "confirmed",
        authority: "patient_facing",
        title: h,
        ordinal: next(),
      })
    )
  );

  prohibitedHeadlines.forEach((h) =>
    statements.push(
      makeStatement({
        section: "clinical_report_projection.prohibited_headline_statements",
        kind: "prohibited_headline",
        truth: "prohibited",
        authority: "prohibited",
        title: h,
        ordinal: next(),
      })
    )
  );

  // ---- driver hierarchy --------------------------------------------------

  for (const raw of arr(input.repaired_driver_hierarchy)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "repaired_driver_hierarchy",
        kind: "driver",
        truth: "confirmed",
        authority: "patient_facing",
        title: str(raw.driver) ?? "Driver",
        body: str(raw.why_it_matters),
        requires: { truth_transition: str(raw.what_would_change_management), priority: num(raw.rank) },
        provenance: { state: str(raw.state), rank: num(raw.rank) },
        ordinal: next(),
      })
    );
  }

  // ---- measurement and action plan --------------------------------------

  for (const raw of arr(input.measurement_and_action_plan)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "measurement_and_action_plan",
        kind: "action",
        truth: "confirmed",
        authority: "patient_facing",
        title: str(raw.action) ?? "Action",
        body: str(raw.truth_transition),
        requires: {
          truth_transition: str(raw.truth_transition),
          minimum_fields: strList(raw.minimum_fields),
          specific_items: strList(raw.specific_items),
          timeframe: str(raw.timeframe),
          priority: num(raw.priority),
        },
        provenance: { priority: num(raw.priority), timeframe: str(raw.timeframe) },
        ordinal: next(),
      })
    );
  }

  // ---- medication status -------------------------------------------------

  const med = isObject(input.medication_status) ? input.medication_status : {};
  for (const raw of arr(med.current_medications_confirmed)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "medication_status.current_medications_confirmed",
        kind: "medication",
        truth: "confirmed",
        authority: "clinician_only",
        title: str(raw.name) ?? "Medication",
        body: str(raw.status) ?? str(raw.clinical_consequence),
        ordinal: next(),
      })
    );
  }
  for (const raw of arr(med.historical_or_unresolved_items)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "medication_status.historical_or_unresolved_items",
        kind: "medication",
        truth: "unknown",
        authority: "clinician_only",
        title: str(raw.name) ?? "Unresolved medication item",
        body: str(raw.clinical_consequence),
        holds: ["medication_hold"],
        provenance: { status: str(raw.status), rule: str(med.rule) },
        ordinal: next(),
      })
    );
  }
  for (const key of ["lipid_lowering_therapy", "glucose_lowering_therapy"]) {
    const value = str(med[key]);
    if (!value) continue;
    statements.push(
      makeStatement({
        section: `medication_status.${key}`,
        kind: "medication",
        truth: "unknown",
        authority: "clinician_only",
        title: key.replace(/_/g, " "),
        body: value,
        holds: ["medication_hold"],
        provenance: { rule: str(med.rule) },
        ordinal: next(),
      })
    );
  }

  // ---- genomics and PGx --------------------------------------------------

  const gpx = isObject(input.genomics_and_pgx) ? input.genomics_and_pgx : {};
  for (const raw of arr(gpx.clinically_bounded_findings)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "genomics_and_pgx.clinically_bounded_findings",
        kind: "genomic",
        truth: "confirmed",
        authority: "clinician_only",
        title: str(raw.finding) ?? "Genomic finding",
        body: str(raw.interpretation),
        provenance: { genome_scope: str(gpx.genome_scope), ancestry: str(gpx.ancestry) },
        ordinal: next(),
      })
    );
  }
  strList(gpx.not_excluded).forEach((item) =>
    statements.push(
      makeStatement({
        section: "genomics_and_pgx.not_excluded",
        kind: "genomic",
        truth: "unknown",
        authority: "clinician_only",
        title: item,
        ordinal: next(),
      })
    )
  );
  const pgx = isObject(gpx.pgx) ? gpx.pgx : {};
  if (Object.keys(pgx).length > 0) {
    statements.push(
      makeStatement({
        section: "genomics_and_pgx.pgx",
        kind: "pgx",
        truth: isPermitted(pgx.patient_specific_use) ? "confirmed" : "unknown",
        authority: isPermitted(pgx.patient_specific_use) ? "clinician_only" : "prohibited",
        title: "Pharmacogenomics status",
        body: str(pgx.clarification),
        holds: isPermitted(pgx.patient_specific_use) ? [] : ["pgx_hold"],
        provenance: {
          sample_id: str(pgx.sample_id),
          gene_drug_pairs: num(pgx.gene_drug_pairs),
          hard_gates_permitted: num(pgx.hard_gates_permitted),
          patient_specific_use: str(pgx.patient_specific_use),
        },
        ordinal: next(),
      })
    );
  }

  // ---- omics readiness ---------------------------------------------------

  const omics = isObject(input.omics_readiness) ? input.omics_readiness : {};
  for (const raw of arr(omics.layers)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "omics_readiness.layers",
        kind: "omics_layer",
        truth: String(raw.state ?? "").toUpperCase() === "BUILT" ? "confirmed" : "unknown",
        authority: "research_only",
        title: str(raw.layer) ?? "Omics layer",
        body: str(raw.clinical_ceiling),
        provenance: {
          state: str(raw.state),
          overall: str(omics.overall),
          external_label: str(omics.external_label),
        },
        declaredId: str(raw.layer),
        ordinal: next(),
      })
    );
  }

  // ---- contradictions and repairs ---------------------------------------

  for (const raw of arr(input.contradiction_reclassification)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "contradiction_reclassification",
        kind: "contradiction",
        truth: "candidate",
        authority: "clinician_only",
        title: str(raw.source_topic) ?? str(raw.source_id) ?? "Contradiction",
        body: str(raw.interpretation),
        provenance: {
          repaired_type: str(raw.repaired_type),
          contradiction_status: str(raw.contradiction_status),
        },
        declaredId: str(raw.source_id),
        ordinal: next(),
      })
    );
  }

  for (const raw of arr(input.semantic_repair_ledger)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "semantic_repair_ledger",
        kind: "repair",
        truth: "confirmed",
        authority: "clinician_only",
        title: str(raw.change) ?? "Repair",
        body: str(raw.materiality),
        declaredId: str(raw.repair_id),
        ordinal: next(),
      })
    );
  }

  for (const raw of arr(input.external_evidence)) {
    if (!isObject(raw)) continue;
    statements.push(
      makeStatement({
        section: "external_evidence",
        kind: "external_evidence",
        truth: "confirmed",
        authority: "clinician_only",
        title: str(raw.title) ?? "External evidence",
        body: str(raw.use_in_report),
        provenance: {
          authority: str(raw.authority),
          url: str(raw.url),
          published: str(raw.published),
          verified: str(raw.verified),
        },
        declaredId: str(raw.evidence_id),
        ordinal: next(),
      })
    );
  }

  // ---- witness projection: allowlist-gated only --------------------------

  for (const st of statements) {
    if (st.truth_status !== "confirmed" || st.statement_kind !== "confirmed_measurement") continue;
    for (const m of st.measurements) {
      if (m.value == null || !m.unit || !m.timepoint) {
        diagnostics.push({
          level: "info",
          code: "witness_skipped_incomplete_measurement",
          path: st.source_id,
          message: `"${m.name}" stayed a governed statement only: a witness needs a numeric value, a unit and a timepoint.`,
        });
        continue;
      }
      const entry = lookupAllowlist(m.name);
      if (!entry) {
        diagnostics.push({
          level: "info",
          code: "witness_skipped_not_allowlisted",
          path: st.source_id,
          message: `"${m.name}" is not a pre-registered BioTwin witness signal, so it was kept as evidence only. Reports cannot register new signals.`,
        });
        continue;
      }
      if (!unitsMatch(entry, m.unit)) {
        diagnostics.push({
          level: "warning",
          code: "witness_skipped_unit_mismatch",
          path: st.source_id,
          message: `"${m.name}" arrived in ${m.unit} but the registered signal ${entry.signal} expects ${entry.unit}, so no witness was created.`,
        });
        continue;
      }
      const bounds = st.bounds.length > 0 ? st.bounds : ["Bounded by the imported BioTwin clinical evidence report."];
      witnessCandidates.push({
        statement_source_id: st.source_id,
        signal: entry.signal,
        source_window: "emr",
        domain_of_access: entry.domain_of_access,
        epistemic_role: "direct_measure",
        reliability_class: entry.reliability_class,
        raw_name: m.name,
        value: m.value,
        unit: m.unit,
        biological_timestamp: m.timepoint,
        testimony:
          `Imported BioTwin clinical evidence report records ${m.name} at ${m.value} ${m.unit} ` +
          `collected ${m.timepoint}, under the finding "${st.title}".`,
        limitations: bounds,
        confidence_value: 0.8,
        confidence_basis:
          "Confirmed measurement in a governed BioTwin clinical evidence report, bounded by the report's own declared limits.",
      });
    }
  }

  // ---- report draft ------------------------------------------------------

  const report: BiotwinReportDraft = {
    twin_id: str(subject.twin_id),
    schema_name: BIOTWIN_SCHEMA_NAME,
    schema_version: str(schema.schema_version),
    report_type: BIOTWIN_REPORT_TYPE,
    semantic_repair_version: str(schema.semantic_repair_version),
    generated_date: str(schema.generated_date),
    release_control: rc,
    executive_synthesis: isObject(input.executive_synthesis) ? input.executive_synthesis : {},
    attestation: isObject(input.final_attestation) ? input.final_attestation : {},
    holds: reportHolds,
    allowed_headlines: allowedHeadlines,
    prohibited_headlines: prohibitedHeadlines,
    clinician_review_required: reportHolds.includes("clinician_review_hold"),
    patient_release_permitted: !reportHolds.includes("patient_release_hold"),
  };

  // ---- counts + duplicate guard -----------------------------------------

  const counts: Record<string, number> = { statements: statements.length, witnesses: witnessCandidates.length };
  for (const st of statements) {
    counts[st.truth_status] = (counts[st.truth_status] ?? 0) + 1;
    counts[st.statement_kind] = (counts[st.statement_kind] ?? 0) + 1;
  }

  const seen = new Set<string>();
  for (const st of statements) {
    if (seen.has(st.source_id)) {
      diagnostics.push({
        level: "error",
        code: "duplicate_source_id",
        path: st.source_id,
        message: `Two statements resolve to the same stable ID "${st.source_id}". The report cannot be imported without unique statement identity.`,
      });
    }
    seen.add(st.source_id);
  }

  diagnostics.unshift({
    level: "info",
    code: "adapted",
    message:
      `Adapted ${statements.length} governed statements ` +
      `(${counts.confirmed ?? 0} confirmed, ${counts.candidate ?? 0} candidate, ` +
      `${counts.unknown ?? 0} unknown, ${counts.retired ?? 0} retired, ` +
      `${counts.prohibited ?? 0} prohibited) and ${witnessCandidates.length} witness projections.`,
  });

  return { report, statements, witness_candidates: witnessCandidates, diagnostics, counts };
}