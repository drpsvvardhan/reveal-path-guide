// ============================================================================
// export-celf-bundle
// Assembles a CELF v0.2 ingestion bundle from Reveal Path's Supabase state.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUNDLE_VERSION = "celf-v0.2";
const MAP_VERSION = "celf-v0.2";

type FeatureMap = Map<string, {
  celf_feature_name: string;
  celf_feature_label: string | null;
  celf_domain: string | null;
  celf_panel_group: string | null;
  unit_canonical: string | null;
}>;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

async function sha256(obj: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function lookupFeature(map: FeatureMap, sourceSystem: string, revealCanonical: string) {
  const key = `${sourceSystem}::${revealCanonical}`;
  const hit = map.get(key);
  if (hit) {
    return {
      twin_feature_name: hit.celf_feature_name,
      feature_label: hit.celf_feature_label ?? revealCanonical,
      domain: hit.celf_domain,
      panel_group: hit.celf_panel_group,
      unit_canonical: hit.unit_canonical,
      needs_verification: false,
    };
  }
  return {
    twin_feature_name: `${sourceSystem}_${slugify(revealCanonical)}`,
    feature_label: revealCanonical,
    domain: null as string | null,
    panel_group: null as string | null,
    unit_canonical: null as string | null,
    needs_verification: true,
  };
}

async function buildFeatureMap(sb: SupabaseClient): Promise<FeatureMap> {
  const { data, error } = await sb
    .from("celf_feature_map")
    .select("source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical")
    .eq("map_version", MAP_VERSION);
  if (error) throw new Error(`feature_map load failed: ${error.message}`);
  const m: FeatureMap = new Map();
  for (const row of data ?? []) {
    m.set(`${row.source_system}::${row.reveal_canonical}`, {
      celf_feature_name: row.celf_feature_name,
      celf_feature_label: row.celf_feature_label,
      celf_domain: row.celf_domain,
      celf_panel_group: row.celf_panel_group,
      unit_canonical: row.unit_canonical,
    });
  }
  return m;
}

async function buildSubject(sb: SupabaseClient, userId: string) {
  const { data: profile, error } = await sb
    .from("profiles")
    .select("id, first_name, display_name, age, sex")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`profiles load failed: ${error.message}`);

  const externalName = profile?.display_name || profile?.first_name || "Unnamed Subject";
  return [{
    subject_id: userId,
    external_name: externalName,
    dob: null,
    age: profile?.age ?? null,
    sex: profile?.sex ?? null,
    mrn: null,
    source_system: "reveal_path",
  }];
}

async function buildSourceDocuments(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from("patient_lab_uploads")
    .select("id, original_filename, source_lab, collection_date, status, created_at, observations_extracted")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`lab_uploads load failed: ${error.message}`);
  return (data ?? []).map((u: any) => ({
    source_doc_id: u.id,
    source_name: u.original_filename ?? "unnamed_upload",
    source_lab: u.source_lab,
    pages: null,
    document_type: "lab_pdf",
    ingest_confidence: null,
    ingested_at: u.created_at,
    collection_date: u.collection_date,
    observations_extracted: u.observations_extracted,
    status: u.status,
  }));
}

async function buildLabObservations(sb: SupabaseClient, userId: string, map: FeatureMap) {
  const { data, error } = await sb
    .from("patient_lab_observations")
    .select("id, upload_id, canonical_name, raw_name, display_name, value, unit, flag, ref_low, ref_high, source, collection_date, corrected, original_value")
    .eq("user_id", userId);
  if (error) throw new Error(`lab_observations load failed: ${error.message}`);

  const obs: any[] = [];
  for (const r of data ?? []) {
    const subSys = "lab";
    const f = lookupFeature(map, subSys, r.canonical_name ?? r.raw_name ?? "");
    const refRange = (r.ref_low != null || r.ref_high != null)
      ? `${r.ref_low ?? ""}–${r.ref_high ?? ""}`.trim()
      : null;

    obs.push({
      observation_id: r.id,
      subject_id: userId,
      encounter_id: null,
      source_doc_id: r.upload_id,
      source_name: r.display_name ?? r.raw_name ?? r.canonical_name,
      source_class: subSys,
      collection_date: r.collection_date,
      observed_at_precision: r.collection_date ? "date" : "unknown",
      category: subSys,
      domain: f.domain,
      panel_group: f.panel_group,
      panel_original: r.source ?? null,
      analyte_name: f.feature_label,
      test_name_original: r.raw_name,
      twin_feature_name: f.twin_feature_name,
      result_display: r.value != null ? String(r.value) : null,
      value_operator: null,
      value_numeric: r.value,
      value_text: null,
      unit_normalized: f.unit_canonical ?? r.unit,
      unit_original: r.unit,
      flag: r.flag,
      reference_range_text: refRange,
      specimen_type: null,
      status: "final",
      page_number: null,
      ocr_confidence: null,
      needs_pdf_verification: f.needs_verification,
      raw_notes: r.corrected ? JSON.stringify({ corrected: true, original_value: r.original_value }) : null,
    });
  }
  return obs;
}

async function buildCieObservations(sb: SupabaseClient, userId: string, map: FeatureMap) {
  const obs: any[] = [];

  // Domain scores — join to assessments via assessment_id
  const { data: assessments, error: aErr } = await sb
    .from("cie_assessments")
    .select("id, created_at, full_completed_at, status")
    .eq("user_id", userId);
  if (aErr) throw new Error(`cie_assessments load failed: ${aErr.message}`);
  const asmtById = new Map<string, any>();
  for (const a of assessments ?? []) asmtById.set(a.id, a);

  const { data: domainScores, error: dErr } = await sb
    .from("cie_domain_scores")
    .select("id, assessment_id, domain_id, axis, final_score, layer1_score, layer2_score, triggered_layer2, created_at")
    .eq("user_id", userId);
  if (dErr) throw new Error(`cie_domain_scores load failed: ${dErr.message}`);

  for (const r of domainScores ?? []) {
    const f = lookupFeature(map, "cie_domain", r.domain_id);
    const asmt = asmtById.get(r.assessment_id);
    const collectionDate = asmt?.full_completed_at ?? asmt?.created_at ?? r.created_at;
    obs.push({
      observation_id: r.id,
      subject_id: userId,
      encounter_id: r.assessment_id,
      source_doc_id: null,
      source_name: "cie_v2.2_self_report",
      source_class: "cie",
      collection_date: collectionDate,
      observed_at_precision: "date",
      category: "cie",
      domain: f.domain ?? r.axis,
      panel_group: f.panel_group,
      panel_original: "CIE v2.2",
      analyte_name: f.feature_label,
      test_name_original: `Domain ${r.domain_id}`,
      twin_feature_name: f.twin_feature_name,
      result_display: r.final_score != null ? String(r.final_score) : null,
      value_operator: null,
      value_numeric: r.final_score,
      value_text: null,
      unit_normalized: "score_0_100",
      unit_original: "score",
      flag: null,
      reference_range_text: null,
      specimen_type: "self_report",
      status: r.triggered_layer2 ? "final" : "preliminary",
      page_number: null,
      ocr_confidence: null,
      needs_pdf_verification: false,
      raw_notes: JSON.stringify({ layer1_score: r.layer1_score, layer2_score: r.layer2_score, triggered_layer2: r.triggered_layer2 }),
    });
  }

  // Gate scores
  const { data: gateScores, error: gErr } = await sb
    .from("cie_gate_scores")
    .select("id, assessment_id, gate_id, gate_name, score, traffic_light, contributing_domains, created_at")
    .eq("user_id", userId);
  if (gErr) throw new Error(`cie_gate_scores load failed: ${gErr.message}`);

  for (const r of gateScores ?? []) {
    const f = lookupFeature(map, "cie_gate", r.gate_id);
    const asmt = asmtById.get(r.assessment_id);
    const collectionDate = asmt?.full_completed_at ?? asmt?.created_at ?? r.created_at;
    obs.push({
      observation_id: r.id,
      subject_id: userId,
      encounter_id: r.assessment_id,
      source_doc_id: null,
      source_name: "cie_v2.2_gate",
      source_class: "cie",
      collection_date: collectionDate,
      observed_at_precision: "date",
      category: "cie",
      domain: "cie_gate",
      panel_group: f.panel_group,
      panel_original: "CIE v2.2 Gates",
      analyte_name: f.feature_label ?? r.gate_name,
      test_name_original: r.gate_id,
      twin_feature_name: f.twin_feature_name,
      result_display: r.score != null ? String(r.score) : null,
      value_operator: null,
      value_numeric: r.score,
      value_text: r.traffic_light,
      unit_normalized: "score_0_100",
      unit_original: "score",
      flag: r.traffic_light,
      reference_range_text: null,
      specimen_type: "self_report",
      status: "final",
      page_number: null,
      ocr_confidence: null,
      needs_pdf_verification: false,
      raw_notes: JSON.stringify({ contributing_domains: r.contributing_domains }),
    });
  }

  return obs;
}

function computeFeatureState(observations: any[]) {
  const latest = new Map<string, any>();
  for (const o of observations) {
    if (!o.twin_feature_name) continue;
    const existing = latest.get(o.twin_feature_name);
    const oDate = o.collection_date ? new Date(o.collection_date).getTime() : 0;
    const eDate = existing?.collection_date ? new Date(existing.collection_date).getTime() : -1;
    if (!existing || oDate > eDate) latest.set(o.twin_feature_name, o);
  }
  return Array.from(latest.values()).map((o) => ({
    feature_state_id: crypto.randomUUID(),
    subject_id: o.subject_id,
    twin_feature_name: o.twin_feature_name,
    feature_label: o.analyte_name,
    last_observed_date: o.collection_date,
    latest_value_numeric: o.value_numeric,
    latest_value_text: o.value_text,
    unit: o.unit_normalized,
    latest_flag: o.flag,
    domain: o.domain,
    latest_source_name: o.source_name,
    latest_page_number: o.page_number,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") ?? "";

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerUserId = authData.user.id;

    const url = new URL(req.url);
    const requestedUserId = url.searchParams.get("user_id");
    let targetUserId = callerUserId;

    if (requestedUserId && requestedUserId !== callerUserId) {
      const { data: roleData } = await userClient
        .from("user_roles").select("role").eq("user_id", callerUserId).eq("role", "admin").maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "forbidden: admin role required for cross-user export" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      targetUserId = requestedUserId;
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const featureMap = await buildFeatureMap(sb);

    const [subject, sourceDocs, labObs, cieObs] = await Promise.all([
      buildSubject(sb, targetUserId),
      buildSourceDocuments(sb, targetUserId),
      buildLabObservations(sb, targetUserId, featureMap),
      buildCieObservations(sb, targetUserId, featureMap),
    ]);

    const observations = [...labObs, ...cieObs];
    const featureState = computeFeatureState(observations);

    const bundle = {
      meta: {
        bundle_version: BUNDLE_VERSION,
        map_version: MAP_VERSION,
        generated_at: new Date().toISOString(),
        phi_level: "full_phi",
        source: "reveal_path",
        generator: "vizzhy_reveal_path_celf_adapter_v1.0",
      },
      subject,
      source_documents: sourceDocs,
      observations,
      feature_state: featureState,
    };

    const contentHash = await sha256(bundle);
    const hasLabs = labObs.length > 0;
    const hasInbody = false;
    const hasCie = cieObs.length > 0;

    const { data: auditRow, error: auditErr } = await sb
      .from("celf_exports")
      .insert({
        user_id: targetUserId,
        bundle_version: BUNDLE_VERSION,
        map_version: MAP_VERSION,
        status: "ready",
        phi_level: "full_phi",
        subject_count: subject.length,
        source_document_count: sourceDocs.length,
        observation_count: observations.length,
        feature_state_count: featureState.length,
        has_labs: hasLabs,
        has_inbody: hasInbody,
        has_cie: hasCie,
        has_food_log: false,
        bundle,
        content_sha256: contentHash,
      })
      .select("id, generated_at")
      .single();

    if (auditErr) throw new Error(`audit insert failed: ${auditErr.message}`);

    return new Response(JSON.stringify({
      export_id: auditRow.id,
      generated_at: auditRow.generated_at,
      content_sha256: contentHash,
      coverage: { labs: hasLabs, inbody: hasInbody, cie: hasCie },
      counts: {
        subject: subject.length,
        source_documents: sourceDocs.length,
        observations: observations.length,
        feature_state: featureState.length,
      },
      bundle,
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[export-celf-bundle] error", e);
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
