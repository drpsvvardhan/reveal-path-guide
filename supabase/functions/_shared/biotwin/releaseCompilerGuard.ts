// ============================================================================
// BioTwin Release Compiler v1 — governed entry gate
// ----------------------------------------------------------------------------
// Public compiler entry. It validates the untrusted release-decision shape and
// narrows v18 presentation roots before delegating to the pure compiler core.
//
// Why a separate gate? The core assumes a typed ReleaseDecision. The edge
// endpoint receives JSON. This layer converts malformed JSON into diagnostics,
// and ensures presentation text cannot widen the released canonical-claim set.
// ============================================================================

import {
  compileRuntimeTwinV18,
  type CompileDiagnostic,
  type CompileResult,
  type JsonObject,
  type ReleaseDecision,
  RELEASE_DECISION_SCHEMA,
  RELEASE_DECISION_VERSION,
} from "./releaseCompiler.ts";

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function arr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
function strList(v: unknown): string[] {
  return arr(v).filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}
function normalize(s: string): string { return s.toLowerCase().replace(/[\s\u00a0]+/g, " ").trim(); }

function emptyFailure(code: string, message: string, path?: string): CompileResult {
  return {
    ok: false,
    diagnostics: [{ level: "error", code, message, path }],
    stats: { released_claims: 0, confirmed: 0, candidate: 0, unknown: 0, retired: 0, drivers: 0, measurements: 0, contradictions: 0, prohibitions: 0 },
  };
}

function parseDecision(input: unknown): ReleaseDecision | null {
  if (!isObject(input)) return null;
  const schema = isObject(input.schema) ? input.schema : null;
  const subject = isObject(input.subject) ? input.subject : null;
  const release = isObject(input.release) ? input.release : null;
  const review = isObject(input.review) ? input.review : null;
  if (!schema || !subject || !release || !review) return null;
  if (schema.name !== RELEASE_DECISION_SCHEMA || schema.version !== RELEASE_DECISION_VERSION) return null;
  if (!str(subject.twin_id) || !str(subject.source_twin_version) || !str(subject.source_twin_sha256)) return null;
  if (!Array.isArray(input.released_claim_ids) || !Array.isArray(input.critical_anchor_review) || !Array.isArray(input.explicit_prohibitions)) return null;
  if (!str(review.reviewer_role) || !str(review.released_at)) return null;
  if (input.released_claim_ids.some((x) => typeof x !== "string" || x.trim().length === 0)) return null;
  if (input.explicit_prohibitions.some((x) => typeof x !== "string" || x.trim().length === 0)) return null;
  for (const raw of input.critical_anchor_review) {
    if (!isObject(raw) || !str(raw.claim_id) || !str(raw.status) || !str(raw.basis)) return null;
    if (!["ACCEPT_FOR_RELEASE", "ACCEPT_WITH_PROVENANCE_DEBT", "REJECT"].includes(String(raw.status))) return null;
  }
  if (input.measurement_plan_ids != null && (!Array.isArray(input.measurement_plan_ids) || input.measurement_plan_ids.some((x) => typeof x !== "string"))) return null;
  if (input.contradiction_ids != null && (!Array.isArray(input.contradiction_ids) || input.contradiction_ids.some((x) => typeof x !== "string"))) return null;
  return input as unknown as ReleaseDecision;
}

function containsProhibition(text: string, prohibitions: string[]): boolean {
  const n = normalize(text);
  return prohibitions.some((p) => {
    const np = normalize(p);
    return np.length >= 4 && n.includes(np);
  });
}

function narrowReveal(reveal: JsonObject, released: Set<string>, prohibitions: string[]): JsonObject {
  const out: JsonObject = {};
  for (const section of ["whatIsMeasured", "whatIsInferred", "whatIsNotYetKnown"]) {
    out[section] = arr(reveal[section]).filter((raw) => {
      if (!isObject(raw)) return false;
      const cid = str(raw.claimId);
      const item = str(raw.item);
      return !!cid && released.has(cid) && (!item || !containsProhibition(item, prohibitions));
    });
  }
  // coreThesis is intentionally NOT copied. A free-form synthesis can mention
  // claims outside the released subset even when every word is scientifically
  // true. The safe headline is constructed from fully released driver rows.
  return out;
}

function fullyReleasedRows(rows: unknown, released: Set<string>): JsonObject[] {
  return arr(rows).filter((raw): raw is JsonObject => {
    if (!isObject(raw)) return false;
    const ids = strList(raw.claimIds);
    return ids.length > 0 && ids.every((id) => released.has(id));
  });
}

/**
 * The ONLY public v18 compiler entry for Founding Cohort use.
 *
 * - malformed decisions become a governed diagnostic, never a thrown TypeError;
 * - clinicalReveal cannot widen the release set;
 * - driver/contradiction rows cross only when ALL linked claims are released;
 * - a deterministic headline is constructed only from fully released drivers;
 * - the source Twin's own R3 block is preserved as provenance and a warning.
 */
export function compileRuntimeTwinV18Governed(
  runtimeTwin: JsonObject,
  decisionInput: unknown,
): CompileResult {
  const decision = parseDecision(decisionInput);
  if (!decision) {
    return emptyFailure(
      "release_decision_malformed",
      "Founding Cohort release decision is missing required typed sections or fields.",
      "release_decision",
    );
  }

  const released = new Set(decision.released_claim_ids);
  const observations = isObject(runtimeTwin.observations) ? runtimeTwin.observations : {};
  const safeDrivers = fullyReleasedRows(observations.driverHierarchy, released);
  const safeContradictions = fullyReleasedRows(observations.contradictions, released);
  const safeReveal = narrowReveal(
    isObject(observations.clinicalReveal) ? observations.clinicalReveal : {},
    released,
    decision.explicit_prohibitions,
  );

  const safeDriverTitles = safeDrivers
    .slice()
    .sort((a, b) => Number(a.rank ?? 9999) - Number(b.rank ?? 9999))
    .map((row) => str(row.driver))
    .filter((x): x is string => !!x && !containsProhibition(x, decision.explicit_prohibitions))
    .slice(0, 3);

  safeReveal.coreThesis = safeDriverTitles.length > 0
    ? safeDriverTitles.join(" · ")
    : `Founding Cohort BioTwin release for ${decision.subject.twin_id}.`;

  const narrowedTwin: JsonObject = {
    ...runtimeTwin,
    observations: {
      ...observations,
      clinicalReveal: safeReveal,
      driverHierarchy: safeDrivers,
      contradictions: safeContradictions,
    },
  };

  const result = compileRuntimeTwinV18(narrowedTwin, decision);
  if (!result.ok) return result;

  const releaseClass = isObject(observations.releaseClass) ? observations.releaseClass : {};
  const r3 = str(releaseClass.R3_individual_reveal)?.toUpperCase();
  if (r3 === "BLOCKED") {
    const warning: CompileDiagnostic = {
      level: "warning",
      code: "source_r3_block_superseded_by_founding_cohort_decision",
      path: "observations.releaseClass.R3_individual_reveal",
      message: "The frozen source Twin declares R3 individual reveal BLOCKED. The separate Founding Cohort release decision authorizes only its explicitly reviewed bounded claim subset; this does not mutate or upgrade the source Twin's own release class.",
    };
    return { ...result, diagnostics: [...result.diagnostics, warning] };
  }
  return result;
}
