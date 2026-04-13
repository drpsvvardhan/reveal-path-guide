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
