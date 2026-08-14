// ============================================================================
// supabase/functions/_shared/cieWitnessify.ts
// ----------------------------------------------------------------------------
// Witness projection for a completed CIE assessment. Extracted from
// cie-score-assessment so the factory-CIE importer produces the same
// witness objects as a natively-taken assessment — one code path, no drift.
// ============================================================================

import { type WitnessObject } from "./witness.ts";
import {
  witnessifyCieAssessment,
  type CieAssessmentInput,
  type CieResponseInput,
  type CieDomainScoreInput,
  type CieGateScoreInput,
} from "./witnessify_impl.ts";
import { loadRegistryFromSupabase } from "./witnessRegistry.ts";

export const DEFAULT_REGISTRY_SEED_VERSION = "p1a_initial";
const WITNESS_INSERT_BATCH_SIZE = 100;

export interface CompletedAssessmentRow {
  id: string;
  user_id: string;
  status: string;
  full_completed_at: string | null;
  layer1_completed_at: string | null;
  created_at: string;
}

export interface CieWitnessSummary {
  produced: number;
  upserted: number;
  registry_misses: number;
  validation_failures: number;
  soft_warnings: number;
}

export async function witnessifyCompletedCieAssessment(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  assessment: CompletedAssessmentRow
): Promise<CieWitnessSummary> {
  const input = await buildCieAssessmentInputForWitnesses(supabase, assessment);
  const { accessor } = await loadRegistryFromSupabase(supabase, DEFAULT_REGISTRY_SEED_VERSION);
  const result = witnessifyCieAssessment(input, accessor, {
    onRegistryMiss: "skip_with_warning",
    throwOnCatastrophic: true,
  });

  const upserted = await upsertWitnessesBatched(supabase, result.witnesses);

  return {
    produced: result.witnesses.length,
    upserted,
    registry_misses: result.registry_misses.length,
    validation_failures: result.validation_failures.length,
    soft_warnings: result.soft_warnings.length,
  };
}

async function buildCieAssessmentInputForWitnesses(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  assessment: CompletedAssessmentRow
): Promise<CieAssessmentInput> {
  const assessmentId = assessment.id;
  const [respRes, domRes, gateRes] = await Promise.all([
    supabase
      .from("cie_responses")
      .select("id, assessment_id, question_id, domain_id, layer, question_type, raw_response, score")
      .eq("assessment_id", assessmentId),
    supabase
      .from("cie_domain_scores")
      .select("id, assessment_id, domain_id, axis, layer1_score, layer2_score, final_score, triggered_layer2")
      .eq("assessment_id", assessmentId),
    supabase
      .from("cie_gate_scores")
      .select("id, assessment_id, gate_id, gate_name, score, traffic_light, contributing_domains")
      .eq("assessment_id", assessmentId),
  ]);

  if (respRes.error) throw new Error(`cie_responses read: ${respRes.error.message}`);
  if (domRes.error) throw new Error(`cie_domain_scores read: ${domRes.error.message}`);
  if (gateRes.error) throw new Error(`cie_gate_scores read: ${gateRes.error.message}`);

  const bioTs = assessment.full_completed_at ?? assessment.layer1_completed_at ?? assessment.created_at;
  const questionIdsByDomain = new Map<string, string[]>();
  for (const r of respRes.data ?? []) {
    const list = questionIdsByDomain.get(r.domain_id) ?? [];
    list.push(r.question_id);
    questionIdsByDomain.set(r.domain_id, list);
  }

  // deno-lint-ignore no-explicit-any
  const responseInputs: CieResponseInput[] = (respRes.data ?? []).map((r: any) => ({
    question_id: r.question_id,
    response_value: r.raw_response,
    response_unit: null,
    source_row_id: r.id,
    testimony: buildCieResponseWitnessTestimony(r, bioTs),
  }));

  // deno-lint-ignore no-explicit-any
  const domainInputs: CieDomainScoreInput[] = (domRes.data ?? []).map((d: any) => ({
    domain_id: d.domain_id,
    score_value: Number(d.final_score),
    score_unit: "score_0_100",
    source_row_id: d.id,
    testimony: buildCieDomainWitnessTestimony(d, bioTs),
    contributing_question_ids: questionIdsByDomain.get(d.domain_id) ?? [],
  }));

  // deno-lint-ignore no-explicit-any
  const gateInputs: CieGateScoreInput[] = (gateRes.data ?? []).map((g: any) => ({
    gate_id: g.gate_id,
    score_value: Number(g.score),
    score_unit: "score_0_100",
    source_row_id: g.id,
    testimony: buildCieGateWitnessTestimony(g, bioTs),
    contributing_domain_ids: g.contributing_domains ?? [],
  }));

  return {
    user_id: assessment.user_id,
    assessment_id: assessmentId,
    biological_timestamp: bioTs,
    source_table: "cie_assessments",
    assessment_row_id: assessmentId,
    responses: responseInputs,
    domain_scores: domainInputs,
    gate_scores: gateInputs,
  };
}

async function upsertWitnessesBatched(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  witnesses: WitnessObject[]
): Promise<number> {
  const byDepth = [0, 1, 2].flatMap((depth) => witnesses.filter((w) => w.compression_depth === depth));
  let upserted = 0;

  for (let i = 0; i < byDepth.length; i += WITNESS_INSERT_BATCH_SIZE) {
    const batch = byDepth.slice(i, i + WITNESS_INSERT_BATCH_SIZE).map((w) => ({
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

    const { data, error } = await supabase
      .from("witness_objects")
      .upsert(batch, { onConflict: "user_id,source_table,source_row_id,registry_seed_version" })
      .select("witness_id");

    if (error) throw new Error(`witness_objects upsert: ${error.message}`);
    upserted += (data ?? []).length;
  }

  return upserted;
}

// deno-lint-ignore no-explicit-any
function buildCieResponseWitnessTestimony(r: any, bioTs: string): string {
  const layerLabel = r.layer === 1 ? "Layer 1" : "Layer 2 deep-dive";
  return `Patient self-reported '${r.raw_response}' to CIE ${r.question_id} (domain ${r.domain_id}, ${layerLabel}, question_type=${r.question_type}) during intake on ${bioTs.slice(0, 10)}. Derived response score: ${r.score}.`;
}

// deno-lint-ignore no-explicit-any
function buildCieDomainWitnessTestimony(d: any, bioTs: string): string {
  const l2Part = d.triggered_layer2
    ? ` Layer-2 deep-dive was triggered; layer2 score ${d.layer2_score}.`
    : " Layer-2 was not triggered.";
  return `CIE Domain ${d.domain_id} (axis ${d.axis}) final score ${d.final_score} on ${bioTs.slice(0, 10)}. Layer-1 score ${d.layer1_score}.${l2Part}`;
}

// deno-lint-ignore no-explicit-any
function buildCieGateWitnessTestimony(g: any, bioTs: string): string {
  const contrib = (g.contributing_domains ?? []).join(", ");
  return `CIE Gate ${g.gate_id} (${g.gate_name}) score ${g.score} on ${bioTs.slice(0, 10)}, traffic-light ${g.traffic_light}, aggregating domains [${contrib}].`;
}
