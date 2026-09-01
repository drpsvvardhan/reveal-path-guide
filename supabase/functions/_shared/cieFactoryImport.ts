// ============================================================================
// supabase/functions/_shared/cieFactoryImport.ts
// ----------------------------------------------------------------------------
// Deterministic mapping of a factory CIE export (question.json — the file the
// CodexOS intake pipeline produces) into the app's CIE tables, so a patient
// whose CIE was taken in the factory pipeline never retakes Layer 1 in the
// app.
//
// Authority rule: the FACTORY scores are authoritative. The factory engine
// scores natural-language vocabularies the app's maps don't fully know
// ("mostly_regular", "somewhat_refreshed", "4_5_cups"), and the factory's
// domain scores are the exact values already frozen into the patient's Twin
// (Subject-01's E13 = 57.3 appears verbatim in his v18 twin). Re-scoring here
// would create a second, conflicting truth. Per-question display scores use
// the payload's own qScores where given; domain finals are copied, never
// recomputed; gates are aggregated from those finals with the app's shared
// gate definitions.
//
// No LLM anywhere. Pure functions; the edge function persists the output.
// ============================================================================

import {
  GATES,
  DOMAIN_AXIS,
  L1_WEIGHTS,
  SCORE_MAPS,
  trafficLight,
} from "./cieScoring.ts";

export interface FactoryCiePayload {
  Name?: string;
  emailId?: string;
  intakeData: {
    customer_id?: string;
    layer1Responses: Record<string, Record<string, string>>;
    layer2Responses?: Record<string, Record<string, string>>;
    scores?: Record<
      string,
      { score: number; triggered: boolean; qScores?: number[]; hasL2?: boolean }
    >;
    deepDiveDomains?: string[];
  };
}

export interface CieImportRows {
  responseRows: Array<Record<string, unknown>>;
  domainRows: Array<Record<string, unknown>>;
  gateRows: Array<Record<string, unknown>>;
  triggeredDomains: string[];
  totalQuestions: number;
  customerId: string | null;
  diagnostics: string[];
}

export function validateFactoryCiePayload(
  payload: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const p = payload as FactoryCiePayload | null;
  if (!p || typeof p !== "object") errors.push("Payload is not an object.");
  const intake = p?.intakeData;
  if (!intake || typeof intake !== "object") {
    errors.push("intakeData missing — this is not a factory CIE export.");
    return { valid: false, errors };
  }
  const l1 = intake.layer1Responses;
  if (!l1 || typeof l1 !== "object" || Object.keys(l1).length === 0) {
    errors.push("intakeData.layer1Responses missing or empty.");
  } else {
    for (const [domain, qs] of Object.entries(l1)) {
      if (!DOMAIN_AXIS[domain]) errors.push(`Unknown Layer-1 domain "${domain}".`);
      if (!qs || typeof qs !== "object" || Object.keys(qs).length === 0) {
        errors.push(`Domain "${domain}" has no Layer-1 responses.`);
      }
    }
  }
  for (const domain of Object.keys(intake.layer2Responses ?? {})) {
    if (!DOMAIN_AXIS[domain]) errors.push(`Unknown Layer-2 domain "${domain}".`);
  }
  return { valid: errors.length === 0, errors };
}

/** Best-effort question_type from the response vocabulary — provenance only,
 * never used to overrule a factory score. */
export function inferQuestionType(raw: string): string {
  const v = raw.toLowerCase();
  for (const [type, map] of Object.entries(SCORE_MAPS)) {
    if (v in map) return type;
  }
  return "frequency";
}

function sortedQuestionIds(qs: Record<string, string>): string[] {
  return Object.keys(qs).sort((a, b) => {
    const na = parseInt(a.match(/\d+$/)?.[0] ?? "0");
    const nb = parseInt(b.match(/\d+$/)?.[0] ?? "0");
    return na - nb;
  });
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function mapFactoryCie(
  payload: FactoryCiePayload,
  ids: { assessmentId: string; userId: string }
): CieImportRows {
  const diagnostics: string[] = [];
  const intake = payload.intakeData;
  const scores = intake.scores ?? {};
  const responseRows: Array<Record<string, unknown>> = [];
  const domainRows: Array<Record<string, unknown>> = [];
  const triggeredDomains: string[] = [];

  // ── Response rows ──
  for (const [domain, qs] of Object.entries(intake.layer1Responses)) {
    const qScores = scores[domain]?.qScores ?? [];
    const ordered = sortedQuestionIds(qs);
    ordered.forEach((qid, idx) => {
      responseRows.push({
        assessment_id: ids.assessmentId,
        user_id: ids.userId,
        question_id: qid,
        domain_id: domain,
        layer: 1,
        question_type: inferQuestionType(qs[qid]),
        raw_response: qs[qid],
        // Factory per-question score where provided (already 0–100).
        score: typeof qScores[idx] === "number" ? qScores[idx] : 50,
      });
    });
  }
  for (const [domain, qs] of Object.entries(intake.layer2Responses ?? {})) {
    for (const qid of sortedQuestionIds(qs)) {
      responseRows.push({
        assessment_id: ids.assessmentId,
        user_id: ids.userId,
        question_id: qid,
        domain_id: domain,
        layer: 2,
        question_type: inferQuestionType(qs[qid]),
        raw_response: qs[qid],
        // The factory export carries no per-question Layer-2 scores; 50 is
        // the schema's declared neutral default, and domain finals never
        // derive from these rows.
        score: 50,
      });
    }
  }

  // ── Domain rows: factory finals copied, never recomputed ──
  for (const domainId of Object.keys(DOMAIN_AXIS)) {
    const s = scores[domainId];
    if (!s) {
      if (intake.layer1Responses[domainId]) {
        diagnostics.push(
          `Domain ${domainId} has responses but no factory score; stored with neutral 50.`
        );
      }
      domainRows.push({
        assessment_id: ids.assessmentId,
        user_id: ids.userId,
        domain_id: domainId,
        axis: DOMAIN_AXIS[domainId],
        layer1_score: 50,
        layer2_score: null,
        final_score: 50,
        triggered_layer2: false,
      });
      continue;
    }

    // Layer-1 component from the factory's own per-question scores.
    const qScores = s.qScores ?? [];
    let layer1Score = 50;
    if (qScores.length > 0) {
      layer1Score = 0;
      for (let i = 0; i < qScores.length && i < L1_WEIGHTS.length; i++) {
        layer1Score += qScores[i] * L1_WEIGHTS[i];
      }
    }

    // The factory final blends L2*0.60 + L1*0.40 when a deep dive ran.
    // Back-derive the L2 component so the row is complete; clamp + warn if
    // the derivation leaves [0,100] (would indicate a foreign blend rule).
    let layer2Score: number | null = null;
    if (s.hasL2) {
      const derived = (s.score - 0.4 * layer1Score) / 0.6;
      layer2Score = Math.min(100, Math.max(0, derived));
      if (derived < -0.05 || derived > 100.05) {
        diagnostics.push(
          `Domain ${domainId}: derived Layer-2 component ${round1(derived)} outside [0,100]; clamped. Factory final ${s.score} kept as authoritative.`
        );
      }
    }

    if (s.triggered) triggeredDomains.push(domainId);

    domainRows.push({
      assessment_id: ids.assessmentId,
      user_id: ids.userId,
      domain_id: domainId,
      axis: DOMAIN_AXIS[domainId],
      layer1_score: round1(layer1Score),
      layer2_score: layer2Score !== null ? round1(layer2Score) : null,
      final_score: round1(s.score),
      triggered_layer2: s.triggered === true,
    });
  }

  // ── Gate rows from factory domain finals, app gate definitions ──
  const finalByDomain = new Map(
    domainRows.map((d) => [d.domain_id as string, d.final_score as number])
  );
  const gateRows = Object.entries(GATES).map(([gateId, gate]) => {
    const vals = gate.domains.map((d) => finalByDomain.get(d) ?? 50);
    const avg = round1(vals.reduce((a, b) => a + b, 0) / vals.length);
    return {
      assessment_id: ids.assessmentId,
      user_id: ids.userId,
      gate_id: gateId,
      gate_name: gate.name,
      score: avg,
      traffic_light: trafficLight(avg),
      contributing_domains: gate.domains,
    };
  });

  return {
    responseRows,
    domainRows,
    gateRows,
    triggeredDomains,
    totalQuestions: responseRows.length,
    customerId: intake.customer_id ?? null,
    diagnostics,
  };
}
