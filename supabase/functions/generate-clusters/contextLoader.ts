// supabase/functions/generate-clusters/contextLoader.ts
//
// Loads the patient's complete structured terrain context for the
// triangulation pipeline. Pure read function, no LLM, no writes.
//
// Column names are aligned to the LIVE database schema (types.ts).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    }>;
    gate_scores: Array<{
      gate_id: string;
      gate_name: string;
      score: number;
      traffic_light: string;
      contributing_domains: string[];
    }>;
    sample_responses: Array<{
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
  narrative: {
    has_narrative: boolean;
    latest: {
      narrative_id: string;
      narrative: any; // jsonb — shape varies
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
}

export async function loadPatientContext(
  supabaseUrl: string,
  serviceRoleKey: string,
  patientId: string
): Promise<PatientTerrainContext> {
  const sb = createClient(supabaseUrl, serviceRoleKey);

  // Profile — user_id is the auth uid used across all tables
  const { data: profile } = await sb
    .from("profiles")
    .select("display_name, age, sex")
    .eq("user_id", patientId)
    .maybeSingle();

  // CIE assessment — latest completed or in_progress
  const { data: assessments } = await sb
    .from("cie_assessments")
    .select("id")
    .eq("user_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1);

  const assessment = assessments?.[0] ?? null;

  let domainScores: any[] = [];
  let gateScores: any[] = [];
  let sampleResponses: any[] = [];

  if (assessment) {
    const [dsRes, gsRes] = await Promise.all([
      sb.from("cie_domain_scores")
        .select("domain_id, axis, final_score, triggered_layer2, layer2_score")
        .eq("assessment_id", assessment.id),
      sb.from("cie_gate_scores")
        .select("gate_id, gate_name, score, traffic_light, contributing_domains")
        .eq("assessment_id", assessment.id),
    ]);
    domainScores = dsRes.data ?? [];
    gateScores = gsRes.data ?? [];

    // Sample up to 50 responses across triggered domains
    const triggeredDomains = domainScores
      .filter((d: any) => d.triggered_layer2)
      .map((d: any) => d.domain_id);

    if (triggeredDomains.length > 0) {
      const { data: rs } = await sb
        .from("cie_responses")
        .select("id, question_id, domain_id, raw_response, score")
        .eq("assessment_id", assessment.id)
        .in("domain_id", triggeredDomains)
        .limit(50);
      sampleResponses = (rs ?? []).map((r: any) => ({
        response_id: r.id,
        question_id: r.question_id,
        domain_id: r.domain_id,
        raw_response: r.raw_response,
        score: r.score,
      }));
    }
  }

  // Labs — all observations (up to 1000), split InBody vs standard downstream
  const { data: allLabs } = await sb
    .from("patient_lab_observations")
    .select("id, canonical_name, value, unit, flag, collection_date, ref_low, ref_high, source")
    .eq("user_id", patientId)
    .order("collection_date", { ascending: false })
    .limit(1000);

  const labRows = allLabs ?? [];

  // InBody observations are stored in patient_lab_observations with source="InBody"
  const inbodyRows = labRows.filter((l: any) => l.source === "InBody");
  const standardLabRows = labRows.filter((l: any) => l.source !== "InBody");

  // Latest narrative
  const { data: narrative } = await sb
    .from("patient_narratives")
    .select("id, narrative, created_at")
    .eq("user_id", patientId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Prior derived patterns (legacy)
  const { data: priorPatterns } = await sb
    .from("derived_patterns")
    .select("id, rule_id, title, severity, category")
    .eq("user_id", patientId)
    .eq("status", "active")
    .limit(40);

  return {
    patient_id: patientId,
    profile: {
      display_name: profile?.display_name ?? null,
      age: profile?.age ?? null,
      sex: profile?.sex ?? null,
    },
    cie: {
      has_assessment: !!assessment,
      domain_scores: domainScores.map((d: any) => ({
        domain_id: d.domain_id,
        axis: d.axis,
        final_score: Number(d.final_score),
        triggered_layer2: d.triggered_layer2,
        layer2_score: d.layer2_score != null ? Number(d.layer2_score) : null,
      })),
      gate_scores: gateScores.map((g: any) => ({
        gate_id: g.gate_id,
        gate_name: g.gate_name,
        score: Number(g.score),
        traffic_light: g.traffic_light,
        contributing_domains: g.contributing_domains ?? [],
      })),
      sample_responses: sampleResponses,
    },
    labs: {
      has_observations: standardLabRows.length > 0,
      observations: standardLabRows.map((l: any) => ({
        observation_id: l.id,
        canonical_name: l.canonical_name,
        value: Number(l.value),
        unit: l.unit,
        flag: l.flag,
        collection_date: l.collection_date,
        ref_low: l.ref_low != null ? Number(l.ref_low) : null,
        ref_high: l.ref_high != null ? Number(l.ref_high) : null,
        source: l.source,
      })),
    },
    inbody: {
      has_observations: inbodyRows.length > 0,
      observations: inbodyRows.map((i: any) => ({
        observation_id: i.id,
        canonical_name: i.canonical_name,
        value: Number(i.value),
        unit: i.unit,
        collection_date: i.collection_date,
        source: i.source,
      })),
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
      patterns: (priorPatterns ?? []).map((p: any) => ({
        pattern_id: p.id,
        rule_id: p.rule_id,
        title: p.title,
        severity: p.severity,
        category: p.category,
      })),
    },
  };
}

/**
 * Produces a compact line-oriented representation of the patient context
 * for the critic and reconciler passes. Keeps evidence ids so the LLM can
 * verify generator claims trace to real data, but strips JSON overhead.
 */
export function compressContextForCritique(context: PatientTerrainContext): string {
  const lines: string[] = [];

  lines.push(`# PATIENT ${context.patient_id}`);
  if (context.profile.display_name) lines.push(`name: ${context.profile.display_name}`);
  if (context.profile.age != null) lines.push(`age: ${context.profile.age}`);
  if (context.profile.sex) lines.push(`sex: ${context.profile.sex}`);
  lines.push("");

  if (context.cie.has_assessment) {
    lines.push("## CIE DOMAIN SCORES");
    for (const d of context.cie.domain_scores) {
      const flag = d.triggered_layer2 ? " [deep_dive]" : "";
      lines.push(`${d.domain_id}|${d.axis}|${d.final_score}${flag}`);
    }
    lines.push("");
    lines.push("## CIE GATE SCORES");
    for (const g of context.cie.gate_scores) {
      lines.push(`${g.gate_name}|${g.score}|${g.traffic_light}`);
    }
    lines.push("");
    if (context.cie.sample_responses.length > 0) {
      lines.push("## CIE RESPONSE SAMPLE (id|question_id|domain_id|score)");
      for (const r of context.cie.sample_responses.slice(0, 15)) {
        lines.push(`${r.response_id}|${r.question_id}|${r.domain_id}|${r.score}`);
      }
      lines.push("");
    }
  }

  if (context.labs.has_observations) {
    lines.push(`## LABS (${context.labs.observations.length} observations)`);
    lines.push("# format: id|analyte|value|unit|flag|date");
    for (const l of context.labs.observations) {
      const flag = l.flag ?? "";
      const date = l.collection_date ? String(l.collection_date).slice(0, 10) : "";
      lines.push(`${l.observation_id}|${l.canonical_name}|${l.value}|${l.unit}|${flag}|${date}`);
    }
    lines.push("");
  }

  if (context.inbody.has_observations) {
    lines.push(`## INBODY (${context.inbody.observations.length} observations)`);
    lines.push("# format: id|metric|value|unit|date");
    for (const i of context.inbody.observations) {
      const date = i.collection_date ? String(i.collection_date).slice(0, 10) : "";
      lines.push(`${i.observation_id}|${i.canonical_name}|${i.value}|${i.unit}|${date}`);
    }
    lines.push("");
  }

  if (context.narrative.has_narrative && context.narrative.latest) {
    const n = context.narrative.latest;
    lines.push("## NARRATIVE");
    lines.push(`narrative_id: ${n.narrative_id}`);
    const narr = n.narrative;
    if (typeof narr === "object" && narr !== null) {
      if (narr.thesis) lines.push(`thesis: ${narr.thesis}`);
      if (Array.isArray(narr.helping) && narr.helping.length > 0) lines.push(`helping: ${narr.helping.join("; ")}`);
      if (Array.isArray(narr.feeding) && narr.feeding.length > 0) lines.push(`feeding: ${narr.feeding.join("; ")}`);
      if (Array.isArray(narr.symptoms) && narr.symptoms.length > 0) lines.push(`symptoms: ${narr.symptoms.join("; ")}`);
    }
    lines.push("");
  }

  if (context.prior_patterns.has_patterns) {
    lines.push(`## PRIOR PATTERNS (${context.prior_patterns.patterns.length})`);
    lines.push("# format: id|severity|category|title");
    for (const p of context.prior_patterns.patterns) {
      lines.push(`${p.pattern_id}|${p.severity}|${p.category}|${p.title}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
