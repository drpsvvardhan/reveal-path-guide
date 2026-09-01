// Deterministic v18 RUNTIME_TWIN_FINAL -> Clinical Evidence Report compiler.
// Pure function: no LLM, no I/O, no clock, no database.

export const RUNTIME_TWIN_ARTIFACT_TYPE = "RUNTIME_TWIN_FINAL";
export const RUNTIME_TWIN_V18_PREFIX = "v18.";
export const RELEASE_DECISION_SCHEMA = "Vizzhy Founding Cohort Release Decision";
export const RELEASE_DECISION_VERSION = "1.0";
export const RELEASE_COMPILER_VERSION = "biotwin_release_compiler_v2_evidence_plane";
export const OUTPUT_SCHEMA_NAME = "Vizzhy BioTwin Clinical Evidence Report";
export const OUTPUT_REPORT_TYPE = "FINAL_CORRECTED_CLINICAL_EVIDENCE_REPORT";

export type JsonObject = Record<string, unknown>;
export type ReviewStatus = "ACCEPT_FOR_RELEASE" | "ACCEPT_WITH_PROVENANCE_DEBT" | "REJECT";

export interface ReleaseDecision {
  schema: { name: string; version: string };
  subject: { twin_id: string; source_twin_version: string; source_twin_sha256: string };
  release: {
    class: "FOUNDING_COHORT";
    status: "RELEASED_WITH_BOUNDS";
    patient_facing: true;
    decision_grade_multiomic_use: false;
    autonomous_medication_action: false;
    pgx_dose_action: false;
  };
  released_claim_ids: string[];
  critical_anchor_review: Array<{ claim_id: string; status: ReviewStatus; basis: string }>;
  measurement_plan_ids?: string[];
  contradiction_ids?: string[];
  explicit_prohibitions: string[];
  provenance_debt?: Array<{ type: string; disposition: string; note?: string }>;
  review: { reviewer_role: string; released_at: string };
}

export interface CompileDiagnostic {
  level: "error" | "warning" | "info";
  code: string;
  path?: string;
  message: string;
}

export interface CompileResult {
  ok: boolean;
  report?: JsonObject;
  diagnostics: CompileDiagnostic[];
  stats: {
    released_claims: number;
    confirmed: number;
    candidate: number;
    unknown: number;
    retired: number;
    drivers: number;
    measurements: number;
    contradictions: number;
    prohibitions: number;
  };
}

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function arr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function strList(v: unknown): string[] {
  return arr(v).filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}
function uniq(items: string[]): string[] { return [...new Set(items)]; }
function dateOnly(s: string): string { return s.includes("T") ? s.split("T")[0] : s; }
function normalize(s: string): string { return s.toLowerCase().replace(/[\s\u00a0]+/g, " ").trim(); }

function claimBounds(claim: JsonObject): string[] {
  const out: string[] = [];
  const state = str(claim.currentState);
  if (state === "DERIVED" || state === "DERIVED_REPORTED_OUTPUT") {
    out.push(`SOURCE_TRUTH_CLASS=${state}; this is a derived output, not a direct measurement.`);
  }
  for (const key of ["claimCeiling", "cannotProve"]) {
    const obj = isObject(claim[key]) ? claim[key] as JsonObject : null;
    const text = obj ? str(obj.text) : null;
    if (text) out.push(text);
  }
  return uniq(out);
}

function claimProhibitions(claim: JsonObject): string[] {
  const p = isObject(claim.prohibitedPhrasings) ? claim.prohibitedPhrasings as JsonObject : {};
  const phrases = strList(p.phrases);
  const r = isObject(p.retractedValues) ? p.retractedValues as JsonObject : {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "number") phrases.push(String(v));
    if (Array.isArray(v)) phrases.push(...v.filter((x): x is string => typeof x === "string"));
    if (k === "tst_hours" && typeof v === "number") phrases.push(`${v} h`);
    if (k === "efficiency_pct" && typeof v === "number") phrases.push(`${v}%`);
  }
  return uniq(phrases);
}

function revealTitleIndex(reveal: JsonObject): Map<string, string> {
  const out = new Map<string, string>();
  for (const section of ["whatIsMeasured", "whatIsInferred", "whatIsNotYetKnown"]) {
    for (const raw of arr(reveal[section])) {
      if (!isObject(raw)) continue;
      const cid = str(raw.claimId);
      const item = str(raw.item);
      if (cid && item && !out.has(cid)) out.set(cid, item);
    }
  }
  return out;
}

function renderableStrings(report: JsonObject): string[] {
  const out: string[] = [];
  const es = isObject(report.executive_synthesis) ? report.executive_synthesis as JsonObject : {};
  for (const v of Object.values(es)) if (typeof v === "string") out.push(v);
  const cs = isObject(report.clinical_state) ? report.clinical_state as JsonObject : {};
  for (const bucket of ["confirmed_measurements_and_bounded_findings", "candidate_or_unverified_signals", "open_screening_findings"]) {
    for (const raw of arr(cs[bucket])) {
      if (!isObject(raw)) continue;
      for (const key of ["title", "correct_interpretation"]) {
        const v = str(raw[key]); if (v) out.push(v);
      }
    }
  }
  for (const raw of arr(report.repaired_driver_hierarchy)) {
    if (!isObject(raw)) continue;
    for (const key of ["driver", "why_it_matters"]) { const v = str(raw[key]); if (v) out.push(v); }
  }
  for (const raw of arr(report.measurement_and_action_plan)) {
    if (!isObject(raw)) continue;
    for (const key of ["action", "truth_transition"]) { const v = str(raw[key]); if (v) out.push(v); }
  }
  return out;
}

function hasProhibitedLeak(text: string, prohibitions: string[]): string | null {
  const n = normalize(text);
  for (const p of prohibitions) {
    const np = normalize(p);
    if (np.length >= 4 && n.includes(np)) return p;
  }
  return null;
}


// ---------------------------------------------------------------------------
// Evidence Plane (compiler v2)
// ---------------------------------------------------------------------------
// "May this interpretation be released?" and "May the patient access their
// own measured data?" are different questions. v1 conflated them: evidence
// attached to an unreleased claim vanished (Subject-01's 4,301-reading CGM,
// food log). The Evidence Plane releases legitimate patient observations
// BY DEFAULT — summaries and scalars only, never raw series — unless the
// decision explicitly quarantines a root. Interpretation still earns
// authority through the claim machinery; evidence is visible by default.
export const EVIDENCE_ROOTS = [
  // Verified against Subject-01 VZSYN0001 RUNTIME_TWIN_FINAL v18 (frozen bytes
  // e4b9ef8e...): the evidence objects live nested under observations.
  "observations.sensorState.channels.cgm",
  "observations.sensorState.channels.sleep",
  "observations.lifestyleView.foodLog",
  "observations.lifestyleView.cgmMealCoupling",
  "observations.lifestyleView.heartRate",
  "observations.lifestyleView.sleep",
  "observations.questionnaire.objective_sensor_crosswalk",
  // Legacy/top-level names kept for other twin shapes; harmless if absent.
  "sensor_cgm",
  "sensor_sleep",
  "sensor_hrv",
  "sensors",
  "food_log",
  "food_behavior_log",
  "behavior_log",
  "body_composition",
  "vitals",
  "activity",
] as const;

/** Dot-path resolver — evidence roots may be nested (they are, in v18). */
function resolveEvidencePath(obj: JsonObject, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (!isObject(cur)) return undefined;
    cur = (cur as JsonObject)[seg];
  }
  return cur;
}

const EVIDENCE_MAX_LINES_PER_ROOT = 40;
const EVIDENCE_MAX_INLINE_ARRAY = 8;
const EVIDENCE_MAX_STRING = 240;

function flattenEvidenceObject(
  obj: JsonObject,
  prefix: string,
  lines: string[],
  depth: number,
): void {
  for (const key of Object.keys(obj).sort()) {
    if (lines.length >= EVIDENCE_MAX_LINES_PER_ROOT) return;
    const value = obj[key];
    const label = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "number" || typeof value === "boolean") {
      lines.push(`${label}: ${value}`);
    } else if (typeof value === "string") {
      if (value.trim() !== "") {
        lines.push(`${label}: ${value.slice(0, EVIDENCE_MAX_STRING)}`);
      }
    } else if (Array.isArray(value)) {
      const scalars = value.every(
        (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean",
      );
      if (scalars && value.length <= EVIDENCE_MAX_INLINE_ARRAY) {
        lines.push(`${label}: ${value.join(", ")}`);
      } else {
        // Raw series (e.g. 4,301 CGM readings) stay in the Twin. The
        // release records their existence so the runtime can say so.
        lines.push(`${label}: [${value.length} entries — raw series retained in the Twin, not inlined]`);
      }
    } else if (isObject(value) && depth < 2) {
      flattenEvidenceObject(value as JsonObject, label, lines, depth + 1);
    }
  }
}

export function harvestMeasuredEvidence(
  twin: JsonObject,
  quarantined: Set<string>,
  warn: (code: string, message: string, path?: string) => void,
): JsonObject[] {
  const out: JsonObject[] = [];
  for (const root of EVIDENCE_ROOTS) {
    const value = resolveEvidencePath(twin, root);
    if (!isObject(value)) continue;
    if (quarantined.has(root)) {
      warn(
        "evidence_quarantined",
        `Evidence root "${root}" exists in the Twin but is quarantined by the release decision. The runtime will report this stream as unavailable.`,
        root,
      );
      continue;
    }
    const lines: string[] = [];
    flattenEvidenceObject(value as JsonObject, "", lines, 0);
    if (lines.length === 0) continue;
    const shortPath = root.replace(/^observations\./, "");
    out.push({
      evidence_id: `EVID-${shortPath.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
      source_root: root,
      title: `Measured evidence — ${shortPath.split(".").pop()!.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase()}`,
      summary: lines.join("\n"),
    });
  }

  // The omics-layer inventory is the patient's own meta-data: WHICH assays
  // were run and what each covers. Live failure (Aug 14): asked "what does
  // my omics tell and what is in each layer", the runtime named two layers
  // out of thirteen — the packet carried claim fragments but no inventory,
  // so the model honestly reconstructed from the two claims that happened
  // to describe platforms. One summary line per domain, released by
  // default; quarantine (by "omicsDomains" or its full path) withholds it
  // loudly like any other stream.
  const OMICS_INVENTORY_ROOT = "observations.omicsDomains";
  const domains = resolveEvidencePath(twin, OMICS_INVENTORY_ROOT);
  if (isObject(domains)) {
    if (quarantined.has("omicsDomains") || quarantined.has(OMICS_INVENTORY_ROOT)) {
      warn(
        "evidence_quarantined",
        `Evidence root "${OMICS_INVENTORY_ROOT}" exists in the Twin but is quarantined by the release decision. The runtime will report this stream as unavailable.`,
        OMICS_INVENTORY_ROOT,
      );
    } else {
      const lines: string[] = [];
      for (const [domain, spec] of Object.entries(domains as JsonObject)) {
        if (!isObject(spec)) continue;
        const s = spec as JsonObject;
        const avail = s.available === true ? "AVAILABLE" : "NOT AVAILABLE";
        const depth = typeof s.depth === "string" ? (s.depth as string).slice(0, 200) : "";
        lines.push(`${domain}: ${avail}${depth ? ` — ${depth}` : ""}`);
      }
      if (lines.length > 0) {
        out.push({
          evidence_id: "EVID-OMICS-INVENTORY",
          source_root: OMICS_INVENTORY_ROOT,
          title: "Measured evidence — omics layer inventory",
          summary: lines.join("\n"),
        });
      }
    }
  }
  return out;
}

export function compileRuntimeTwinV18(
  runtimeTwin: JsonObject,
  decision: ReleaseDecision,
): CompileResult {
  const diagnostics: CompileDiagnostic[] = [];
  const fail = (code: string, message: string, path?: string) => diagnostics.push({ level: "error", code, message, path });
  const warn = (code: string, message: string, path?: string) => diagnostics.push({ level: "warning", code, message, path });

  if (runtimeTwin.artifactType !== RUNTIME_TWIN_ARTIFACT_TYPE) fail("artifact_type_mismatch", `Expected ${RUNTIME_TWIN_ARTIFACT_TYPE}.`, "artifactType");
  const twinVersion = str(runtimeTwin.twinVersion);
  if (!twinVersion || !twinVersion.startsWith(RUNTIME_TWIN_V18_PREFIX)) fail("runtime_twin_version_mismatch", "Compiler v1 accepts v18.x RUNTIME_TWIN_FINAL only.", "twinVersion");
  const twinId = str(runtimeTwin.subject);
  if (!twinId) fail("missing_subject", "RUNTIME_TWIN_FINAL.subject must be the Twin identity.", "subject");

  if (decision.schema?.name !== RELEASE_DECISION_SCHEMA || decision.schema?.version !== RELEASE_DECISION_VERSION) {
    fail("release_decision_schema_mismatch", `Expected ${RELEASE_DECISION_SCHEMA} v${RELEASE_DECISION_VERSION}.`, "decision.schema");
  }
  if (twinId && decision.subject.twin_id !== twinId) fail("identity_mismatch", "Release decision twin_id does not match RUNTIME_TWIN_FINAL.subject.", "decision.subject.twin_id");
  if (twinVersion && decision.subject.source_twin_version !== twinVersion) fail("version_mismatch", "Release decision source_twin_version does not match the frozen Twin.", "decision.subject.source_twin_version");
  if (decision.release.class !== "FOUNDING_COHORT" || decision.release.status !== "RELEASED_WITH_BOUNDS" || decision.release.patient_facing !== true) {
    fail("release_not_authorized", "Founding Cohort patient-facing release was not explicitly authorized.", "decision.release");
  }
  if (decision.release.decision_grade_multiomic_use || decision.release.autonomous_medication_action || decision.release.pgx_dose_action) {
    fail("authority_violation", "Compiler v1 forbids decision-grade multiomic use, autonomous medication action, and PGx dose action.", "decision.release");
  }

  const observations = isObject(runtimeTwin.observations) ? runtimeTwin.observations as JsonObject : null;
  if (!observations) fail("missing_observations", "RUNTIME_TWIN_FINAL.observations is required.", "observations");
  const claims = observations && isObject(observations.canonicalClaims) ? observations.canonicalClaims as JsonObject : null;
  if (!claims) fail("missing_canonical_claims", "observations.canonicalClaims is required and is the truth authority.", "observations.canonicalClaims");
  const reveal = observations && isObject(observations.clinicalReveal) ? observations.clinicalReveal as JsonObject : {};

  const reviewByClaim = new Map(decision.critical_anchor_review.map((r) => [r.claim_id, r]));
  for (const cid of decision.released_claim_ids) {
    const review = reviewByClaim.get(cid);
    if (!review || review.status === "REJECT") fail("critical_anchor_not_released", `Released claim ${cid} lacks an accepting release review.`, `decision.critical_anchor_review.${cid}`);
    if (claims && !isObject(claims[cid])) fail("released_claim_missing", `Released claim ${cid} does not exist in canonicalClaims.`, `observations.canonicalClaims.${cid}`);
  }
  if (diagnostics.some((d) => d.level === "error")) return emptyResult(diagnostics);

  const titleIndex = revealTitleIndex(reveal);
  const released = new Set(decision.released_claim_ids);

  // ---- Unreleased-claim inventory --------------------------------------
  // "Nothing leaves the factory merely because it exists" is doctrine —
  // but nothing may be left behind SILENTLY. Discovered live (Aug 9):
  // Subject-01's glycemic-control claim was simply never selected by the
  // release decision, so the patient runtime truthfully reported "no CGM
  // data" against a 40k-line Twin that has it. The decision author must
  // see the full cost of their selection at compile time.
  if (claims) {
    const unreleased = Object.keys(claims).filter(
      (cid) => !released.has(cid) && !cid.startsWith("_"),
    );
    for (const cid of unreleased) {
      warn(
        "unreleased_claim",
        `Canonical claim ${cid} exists in the Twin but was NOT selected by the release decision. It will be entirely absent from the patient-facing release — the runtime will report this domain as unmeasured.`,
        `observations.canonicalClaims.${cid}`,
      );
    }
    if (unreleased.length > 0) {
      diagnostics.push({
        level: "info",
        code: "unreleased_claim_summary",
        message: `${unreleased.length} of ${Object.keys(claims).length} canonical claims are not released: ${unreleased.join(", ")}.`,
      });
    }
  }
  const confirmed: JsonObject[] = [];
  const candidate: JsonObject[] = [];
  const unknown: JsonObject[] = [];
  const retired: JsonObject[] = [];
  const autoProhibitions: string[] = [];

  for (const cid of decision.released_claim_ids) {
    const claim = claims![cid] as JsonObject;
    const state = str(claim.currentState);
    const statement = str(claim.canonicalStatement);
    if (!state || !statement) {
      fail("canonical_claim_incomplete", `Released claim ${cid} lacks currentState or canonicalStatement.`, `observations.canonicalClaims.${cid}`);
      continue;
    }
    const title = titleIndex.get(cid) ?? cid;
    const bounds = claimBounds(claim);
    const evidenceIds = strList(claim.evidenceIds);
    const next = str(claim.nextMeasurementThatCouldChangeThis);
    autoProhibitions.push(...claimProhibitions(claim));

    const base: JsonObject = {
      finding_id: cid,
      status: state,
      domain: "individual_biology",
      title,
      correct_interpretation: statement,
      source_truth_class: state,
      evidence_role: str(claim.evidenceRole),
      coverage_bound: str(claim.coverageBound),
      source_evidence_ids: evidenceIds,
    };

    if (state === "MEASURED" || state === "DERIVED" || state === "DERIVED_REPORTED_OUTPUT") {
      confirmed.push({
        ...base,
        important_bounds: bounds,
        measurements: [],
        decision_relevance: "FOUNDING_COHORT_RELEASED_WITH_BOUNDS",
      });
      if (state !== "MEASURED") warn("derived_output_confirmed_bucket", `${cid} is preserved as ${state} inside the confirmed/non-hypothesis bucket; its bound explicitly says it is not a direct measurement.`, `observations.canonicalClaims.${cid}`);
    } else if (state === "HYPOTHESIS") {
      candidate.push({
        ...base,
        unresolved_validity_items: bounds,
        do_not_do_yet: bounds[0] ?? "Do not promote this hypothesis to fact.",
        next_truth_test: next,
        urgency_note: "Founding Cohort: explanatory only; clinician owns decisions.",
      });
    } else if (state === "RAW_GAP" || state === "UNKNOWN") {
      unknown.push({
        ...base,
        next_truth_test: next,
        important_bounds: bounds,
      });
    } else if (state === "RETRACTED" || state === "SUPERSEDED" || state === "NOT_SUPPORTED") {
      retired.push({ finding_id: cid, claim: title, verdict: state, replacement: statement });
    } else {
      fail("unsupported_truth_state", `Claim ${cid} has unsupported currentState ${state}.`, `observations.canonicalClaims.${cid}.currentState`);
    }
  }

  const prohibitions = uniq([...decision.explicit_prohibitions, ...autoProhibitions]);

  const sourceDrivers = arr(observations!.driverHierarchy).filter(isObject) as JsonObject[];
  const drivers: JsonObject[] = [];
  for (const raw of sourceDrivers) {
    const rank = typeof raw.rank === "number" ? raw.rank : null;
    const cids = strList(raw.claimIds).filter((x) => released.has(x));
    if (rank == null || cids.length === 0) continue;
    const primary = claims![cids[0]] as JsonObject;
    const driver = str(raw.driver) ?? titleIndex.get(cids[0]) ?? cids[0];
    const leak = hasProhibitedLeak(driver, prohibitions);
    if (leak) { warn("driver_suppressed_prohibited_text", `Driver rank ${rank} suppressed because its title contains prohibited text: ${leak}.`, `observations.driverHierarchy`); continue; }
    drivers.push({
      rank,
      driver,
      state: str(primary.currentState) ?? "UNKNOWN",
      why_it_matters: str(primary.canonicalStatement),
      what_would_change_management: str(primary.nextMeasurementThatCouldChangeThis),
      source_claim_ids: cids,
    });
  }
  drivers.sort((a,b) => Number(a.rank) - Number(b.rank));

  const wantedMeasurements = new Set(decision.measurement_plan_ids ?? []);
  const queue = isObject(observations!.measurementPlan) ? arr((observations!.measurementPlan as JsonObject).queue).filter(isObject) as JsonObject[] : [];
  const measurements: JsonObject[] = [];
  for (const raw of queue) {
    const id = str(raw.id);
    if (!id || (wantedMeasurements.size > 0 && !wantedMeasurements.has(id))) continue;
    if (raw.is_action === true) { fail("measurement_plan_action_violation", `${id} is marked as an action; compiler accepts recommendations only.`, `observations.measurementPlan.queue.${id}`); continue; }
    const measurement = str(raw.measurement);
    if (!measurement) continue;
    const leak = hasProhibitedLeak(measurement, prohibitions);
    if (leak) { warn("measurement_suppressed_prohibited_text", `${id} suppressed because it contains prohibited text: ${leak}.`, `observations.measurementPlan.queue.${id}`); continue; }
    measurements.push({
      priority: typeof raw.rank === "number" ? raw.rank : measurements.length + 1,
      action: `Measure / verify: ${measurement}`,
      truth_transition: "Reduces a declared uncertainty; this is a measurement recommendation, never an autonomous order or treatment action.",
      specific_items: [id],
      timeframe: str(raw.measurement_class) ?? "As clinically appropriate",
    });
  }

  const wantedContradictions = new Set(decision.contradiction_ids ?? []);
  const contradictions: JsonObject[] = [];
  for (const raw of arr(observations!.contradictions).filter(isObject) as JsonObject[]) {
    const id = str(raw.id);
    if (!id || (wantedContradictions.size > 0 && !wantedContradictions.has(id))) continue;
    const cids = strList(raw.claimIds);
    if (cids.length > 0 && !cids.some((x) => released.has(x))) continue;
    const title = str(raw.tension) ?? str(raw.title_clinical) ?? str(raw.title) ?? id;
    const interpretation = str(raw.meaning_clinical) ?? str(raw.omics_update) ?? str(raw.status_note) ?? "Held contradiction; no automatic resolution.";
    const leak = hasProhibitedLeak(`${title} ${interpretation}`, prohibitions);
    if (leak) { warn("contradiction_suppressed_prohibited_text", `${id} suppressed because it contains prohibited text: ${leak}.`, `observations.contradictions.${id}`); continue; }
    contradictions.push({ source_id: id, source_topic: title, interpretation, repaired_type: str(raw.type) ?? "HELD", contradiction_status: str(raw.state) ?? str(raw.status) ?? "HELD" });
  }

  const headline = str(reveal.coreThesis) ?? `Founding Cohort BioTwin release for ${twinId}.`;
  const certainTitles = confirmed.slice(0, 4).map((x) => String(x.title));
  const uncertainTitles = [...candidate, ...unknown].slice(0, 4).map((x) => String(x.title));
  const nextTests = [...candidate, ...unknown].map((x) => str(x.next_truth_test)).filter((x): x is string => !!x).slice(0, 3);

  const sourceReleaseClass = isObject(observations!.releaseClass) ? observations!.releaseClass as JsonObject : {};
  const quarantinedEvidence = new Set(
    Array.isArray((decision as JsonObject).quarantined_evidence)
      ? ((decision as JsonObject).quarantined_evidence as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [],
  );
  const measuredEvidence = harvestMeasuredEvidence(runtimeTwin, quarantinedEvidence, warn);
  if (measuredEvidence.length > 0) {
    diagnostics.push({
      level: "info",
      code: "evidence_released",
      message: `Evidence Plane: ${measuredEvidence.length} measured evidence stream(s) released by default: ${measuredEvidence.map((e) => String((e as JsonObject).source_root)).join(", ")}.`,
    });
  }

  const report: JsonObject = {
    schema: {
      name: OUTPUT_SCHEMA_NAME,
      version: "1.1",
      schema_version: "1.1",
      report_type: OUTPUT_REPORT_TYPE,
      semantic_repair_version: RELEASE_COMPILER_VERSION,
      generated_date: dateOnly(decision.review.released_at),
    },
    subject: {
      twin_id: twinId,
      generated_date: dateOnly(decision.review.released_at),
      source_twin_version: twinVersion,
      source_twin_sha256: decision.subject.source_twin_sha256,
    },
    release_control: {
      overall_status: "FOUNDING_COHORT_RELEASED_WITH_BOUNDS",
      patient_facing_release: "PERMITTED_FOR_RELEASED_FINDINGS_ONLY",
      medication_or_treatment_decision: "HOLD_CLINICIAN_ONLY",
      decision_grade_multiomic_use: "HOLD_NOT_DECISION_GRADE",
      pharmacogenomic_action: "HOLD_CLINICIAN_ONLY",
    },
    clinical_report_projection: {
      allowed_headline_statements: headline ? [headline] : [],
      prohibited_headline_statements: prohibitions,
    },
    executive_synthesis: {
      headline,
      patient_summary: headline,
      bottom_line: headline,
      what_is_certain: certainTitles.length ? certainTitles.join("; ") : "No patient-facing claim was released as established.",
      what_is_not_certain: uncertainTitles.length ? uncertainTitles.join("; ") : "No additional uncertainty was released.",
      what_happens_next: nextTests.length ? nextTests.join("; ") : "Continue clinician-directed follow-up and provenance hardening.",
    },
    measured_evidence: measuredEvidence,
    clinical_state: {
      confirmed_measurements_and_bounded_findings: confirmed,
      candidate_or_unverified_signals: candidate,
      open_screening_findings: unknown,
      not_established_or_not_supported: retired,
    },
    repaired_driver_hierarchy: drivers,
    measurement_and_action_plan: measurements,
    medication_status: {
      decision_status: "HOLD_CLINICIAN_ONLY",
      current_medications_confirmed: [],
      historical_or_unresolved_items: [],
      rule: "Release Compiler v1 emits no medication or dose instruction. Medication state remains clinician-owned.",
    },
    genomics_and_pgx: {
      decision_status: "HOLD_CLINICIAN_ONLY",
      genome_scope: "As declared by released canonical claims only.",
      not_excluded: [],
      pgx: {
        hard_gates_permitted: 0,
        patient_specific_use: "HOLD_CLINICIAN_ONLY",
        clarification: "PGx may be discussed as bounded context only; no drug or dose action is licensed by this release.",
      },
    },
    omics_readiness: {},
    contradiction_reclassification: contradictions,
    semantic_repair_ledger: prohibitions.slice(0, 40).map((p, i) => ({ repair_id: `FCR-PROHIB-${String(i+1).padStart(3,"0")}`, change: `Prohibited from patient-facing assertion: ${p}`, materiality: "Founding Cohort scar/prohibition guard." })),
    external_evidence: [],
    provenance: {
      compiler: RELEASE_COMPILER_VERSION,
      source_artifact_type: RUNTIME_TWIN_ARTIFACT_TYPE,
      source_twin_version: twinVersion,
      source_twin_sha256: decision.subject.source_twin_sha256,
      source_release_class: str(sourceReleaseClass.class),
      source_R3_individual_reveal: str(sourceReleaseClass.R3_individual_reveal),
      release_decision_schema: `${RELEASE_DECISION_SCHEMA} v${RELEASE_DECISION_VERSION}`,
      provenance_debt: decision.provenance_debt ?? [],
      doctrine: "Founding Cohort release may proceed with declared noncritical provenance debt; identity, canonical consistency, scar containment, authority boundaries and reviewed release claims remain hard gates.",
    },
    final_attestation: {
      clinician_review_required: false,
      attested_by: decision.review.reviewer_role,
      attestation_status: "FOUNDING_COHORT_RELEASED_WITH_BOUNDS",
      released_at: decision.review.released_at,
    },
  };

  for (const text of renderableStrings(report)) {
    const leak = hasProhibitedLeak(text, prohibitions);
    if (leak) fail("prohibited_text_leak", `Renderable release text contains prohibited phrase: ${leak}.`);
  }

  if (diagnostics.some((d) => d.level === "error")) return emptyResult(diagnostics);
  diagnostics.push({ level: "info", code: "compiled", message: `Compiled ${decision.released_claim_ids.length} released canonical claims from ${twinId} ${twinVersion} into ${OUTPUT_REPORT_TYPE}.` });
  return {
    ok: true,
    report,
    diagnostics,
    stats: {
      released_claims: decision.released_claim_ids.length,
      confirmed: confirmed.length,
      candidate: candidate.length,
      unknown: unknown.length,
      retired: retired.length,
      drivers: drivers.length,
      measurements: measurements.length,
      contradictions: contradictions.length,
      prohibitions: prohibitions.length,
    },
  };
}

function emptyResult(diagnostics: CompileDiagnostic[]): CompileResult {
  return { ok: false, diagnostics, stats: { released_claims: 0, confirmed: 0, candidate: 0, unknown: 0, retired: 0, drivers: 0, measurements: 0, contradictions: 0, prohibitions: 0 } };
}
