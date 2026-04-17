// ============================================================================
// export-celf-bundle v1.7
//
// Post-pivot version. All canonicalization happens at ingest time via the LLM
// in process-lab-pdf. This function does NOT look up celf_feature_map, does
// NOT apply unit_factor transforms, does NOT do alias resolution.
//
// Reads canonical_concept_id, canonical_unit, canonical_value, biomarker_class,
// classification_confidence directly from patient_lab_observations.
//
// Filters: classification_confidence >= 0.80 OR classification_method = 'human_reviewed',
// AND canonical_concept_id is set and != 'unknown'.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUNDLE_VERSION = "celf-v0.9";
const ONTOLOGY_VERSION = "celf-ontology-v1.0";
const CONFIDENCE_THRESHOLD = 0.80;

async function sha256(obj: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildSubject(sb: SupabaseClient, userId: string) {
  const { data: profile, error } = await sb
    .from("profiles")
    .select("id, user_id, first_name, display_name, preferred_name, age, sex")
    .eq("user_id", userId).maybeSingle();
  if (error) console.error("[buildSubject] profile lookup error", error);

  const candidateName = profile
    ? (profile.preferred_name ?? profile.display_name ?? profile.first_name ?? null)
    : null;
  const externalName = candidateName && candidateName.length > 0 ? candidateName : null;

  return {
    ok: Boolean(externalName) || Boolean(profile?.age) || Boolean(profile?.sex),
    subject: [{
      subject_id: userId,
      external_name: externalName ?? "Unnamed Subject",
      dob: null,
      age: profile?.age ?? null,
      sex: profile?.sex ?? null,
      mrn: null,
      source_system: "reveal_path",
    }],
    profileFound: Boolean(profile),
    hasName: Boolean(externalName),
    hasAge: Boolean(profile?.age),
    hasSex: Boolean(profile?.sex),
  };
}

async function buildSourceDocuments(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from("patient_lab_uploads")
    .select("id, original_filename, document_type, created_at, status, name_match_status, name_match_score, extracted_patient_name, content_sha256, collection_date, source_lab")
    .eq("user_id", userId)
    .not("status", "in", "(rejected_identity,rejected_duplicate,failed)")
    .order("created_at", { ascending: true });
  if (error) console.error("[buildSourceDocuments] error", error);
  return (data ?? []).map((u: any) => ({
    source_doc_id: u.id,
    source_name: u.original_filename ?? "unnamed_upload",
    pages: null,
    document_type: u.document_type ?? "lab_pdf",
    ingest_confidence: null,
    ingested_at: u.created_at,
    collection_date: u.collection_date ?? null,
    source_lab: u.source_lab ?? null,
    status: u.status,
    identity_verified: u.name_match_status === "match",
    identity_match_score: u.name_match_score ?? null,
    extracted_patient_name: u.extracted_patient_name ?? null,
    content_sha256: u.content_sha256 ?? null,
  }));
}

async function buildLabAndFibroscanObservations(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from("patient_lab_observations")
    .select(`
      id, upload_id, canonical_name, raw_name, display_name,
      value, original_value, unit, flag, ref_low, ref_high,
      specimen_type, collection_date,
      canonical_concept_id, canonical_unit, canonical_value,
      classification_confidence, biomarker_class, classification_method, source
    `)
    .eq("user_id", userId);
  if (error) console.error("[buildLabAndFibroscanObservations] error", error);

  const obs: any[] = [];
  const excluded: any[] = [];

  for (const r of data ?? []) {
    const confident = (r.classification_confidence ?? 0) >= CONFIDENCE_THRESHOLD;
    const humanReviewed = r.classification_method === "human_reviewed";
    const hasCanonical = r.canonical_concept_id && r.canonical_concept_id !== "unknown";

    if (!hasCanonical || (!confident && !humanReviewed)) {
      excluded.push({
        observation_id: r.id,
        reason: !hasCanonical ? "no_canonical" : "low_confidence",
        canonical_concept_id: r.canonical_concept_id,
        classification_confidence: r.classification_confidence,
      });
      continue;
    }

    let sourceClass: "lab" | "inbody" | "fibroscan" = "lab";
    if (r.specimen_type === "fibroscan") sourceClass = "fibroscan";
    else if (r.specimen_type === "body_composition") sourceClass = "inbody";

    obs.push({
      observation_id: r.id,
      subject_id: userId,
      encounter_id: null,
      source_doc_id: r.upload_id,
      source_name: r.display_name ?? r.raw_name ?? r.canonical_name,
      source_class: sourceClass,
      collection_date: r.collection_date,
      observed_at_precision: r.collection_date ? "date" : "unknown",
      category: sourceClass,
      domain: null,
      biomarker_class: r.biomarker_class,
      analyte_name: r.canonical_concept_id,
      test_name_original: r.raw_name,
      twin_feature_name: r.canonical_concept_id,
      result_display: r.canonical_value != null ? String(r.canonical_value) : (r.value != null ? String(r.value) : null),
      value_numeric: r.canonical_value,
      value_raw: r.value,
      value_original: r.original_value,
      unit_normalized: r.canonical_unit,
      unit_original: r.unit,
      classification_confidence: r.classification_confidence,
      classification_method: r.classification_method,
      flag: r.flag,
      reference_range_text: r.ref_low != null && r.ref_high != null ? `${r.ref_low}-${r.ref_high}` : null,
      ref_low: r.ref_low,
      ref_high: r.ref_high,
      specimen_type: r.specimen_type,
      source: r.source,
      status: "final",
    });
  }

  return { observations: obs, excluded };
}

async function buildCieObservations(sb: SupabaseClient, userId: string) {
  const out: any[] = [];
  const { data: assessments, error: aErr } = await sb
    .from("cie_assessments")
    .select("id, full_completed_at, layer1_completed_at, layer2_completed_at, created_at")
    .eq("user_id", userId);
  if (aErr) console.error("[buildCieObservations] assessments error", aErr);
  if (!assessments || assessments.length === 0) return out;

  const aIds = assessments.map((a: any) => a.id);
  const [{ data: ds }, { data: gs }] = await Promise.all([
    sb.from("cie_domain_scores").select("id, assessment_id, domain_id, final_score, axis, created_at").in("assessment_id", aIds),
    sb.from("cie_gate_scores").select("id, assessment_id, gate_id, gate_name, score, traffic_light, created_at").in("assessment_id", aIds),
  ]);
  const aById = new Map(assessments.map((a: any) => [a.id, a]));

  for (const r of ds ?? []) {
    const a: any = aById.get(r.assessment_id) ?? {};
    const collectedAt = a.full_completed_at ?? a.layer2_completed_at ?? a.layer1_completed_at ?? a.created_at ?? r.created_at;
    out.push({
      observation_id: r.id, subject_id: userId, encounter_id: r.assessment_id,
      source_doc_id: null, source_name: "cie_self_report", source_class: "cie",
      collection_date: collectedAt,
      category: "cie", domain: r.axis ?? "cie_domain", biomarker_class: "cie",
      analyte_name: r.domain_id, twin_feature_name: `cie_domain_${r.domain_id}`,
      value_numeric: r.final_score, value_raw: r.final_score, unit_normalized: "score_0_100",
      classification_method: "structured_intake",
      classification_confidence: 1.0,
      specimen_type: "self_report", status: a.full_completed_at ? "final" : "preliminary",
    });
  }
  for (const r of gs ?? []) {
    const a: any = aById.get(r.assessment_id) ?? {};
    const collectedAt = a.full_completed_at ?? a.layer2_completed_at ?? a.layer1_completed_at ?? a.created_at ?? r.created_at;
    out.push({
      observation_id: r.id, subject_id: userId, encounter_id: r.assessment_id,
      source_doc_id: null, source_name: "cie_gate", source_class: "cie",
      collection_date: collectedAt,
      category: "cie", domain: "cie_gate", biomarker_class: "cie",
      analyte_name: r.gate_id, twin_feature_name: `cie_gate_${r.gate_id}`,
      value_numeric: r.score, value_raw: r.score, unit_normalized: "score_0_100",
      classification_method: "structured_intake",
      classification_confidence: 1.0,
      flag: r.traffic_light, specimen_type: "self_server", status: "final",
    });
  }
  return out;
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
    unit: o.unit_normalized,
    latest_flag: o.flag,
    biomarker_class: o.biomarker_class,
    latest_source_class: o.source_class,
    latest_classification_confidence: o.classification_confidence,
  }));
}

function computeTimelines(observations: any[]) {
  const byFeature = new Map<string, any[]>();
  for (const o of observations) {
    if (!o.twin_feature_name || o.value_numeric === null || o.value_numeric === undefined) continue;
    if (!o.collection_date) continue;
    if (!byFeature.has(o.twin_feature_name)) byFeature.set(o.twin_feature_name, []);
    byFeature.get(o.twin_feature_name)!.push(o);
  }
  const timelines: any[] = [];
  for (const [tfn, obs] of byFeature) {
    if (obs.length < 2) continue;
    obs.sort((a, b) => new Date(a.collection_date).getTime() - new Date(b.collection_date).getTime());
    const units = new Set(obs.map((o) => o.unit_normalized).filter(Boolean));
    const values = obs.map((o) => o.value_numeric);
    const first = values[0], last = values[values.length - 1];
    const delta = last - first;
    const pctChange = first !== 0 ? (delta / Math.abs(first)) * 100 : null;
    const confidences = obs.map((o) => o.classification_confidence ?? 0);
    timelines.push({
      twin_feature_name: tfn,
      feature_label: obs[0].analyte_name,
      biomarker_class: obs[0].biomarker_class,
      unit: obs[0].unit_normalized,
      source_class: obs[0].source_class,
      n_observations: obs.length,
      first_date: obs[0].collection_date,
      last_date: obs[obs.length - 1].collection_date,
      first_value: first, last_value: last, delta, pct_change: pctChange,
      unit_heterogeneous: units.size > 1,
      min_classification_confidence: Math.min(...confidences),
      points: obs.map((o) => ({
        date: o.collection_date, value: o.value_numeric, raw: o.value_raw,
        unit: o.unit_normalized, source_unit: o.unit_original,
        flag: o.flag, source_doc_id: o.source_doc_id,
        confidence: o.classification_confidence,
      })),
    });
  }
  timelines.sort((a, b) => Math.abs(b.pct_change ?? 0) - Math.abs(a.pct_change ?? 0));
  return timelines;
}

async function buildIdentityAudit(sb: SupabaseClient, userId: string) {
  const { data } = await sb
    .from("upload_rejection_audit")
    .select("file_name, rejection_category, rejection_detail, account_holder_name, extracted_patient_name, name_match_score, rejected_at")
    .eq("user_id", userId).order("rejected_at", { ascending: false }).limit(50);
  return data ?? [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerUserId = authData.user.id;

    const url = new URL(req.url);
    const requestedUserId = url.searchParams.get("user_id");
    let targetUserId = callerUserId;
    let isViewAsExport = false;

    if (requestedUserId && requestedUserId !== callerUserId) {
      const { data: roleData } = await userClient
        .from("user_roles").select("role").eq("user_id", callerUserId).eq("role", "admin").maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetUserId = requestedUserId;
      isViewAsExport = true;
    }

    const sb = createClient(supabaseUrl, serviceKey);

    const [subjectResult, sourceDocs, labResult, cieObs, identityAudit] = await Promise.all([
      buildSubject(sb, targetUserId),
      buildSourceDocuments(sb, targetUserId),
      buildLabAndFibroscanObservations(sb, targetUserId),
      buildCieObservations(sb, targetUserId),
      buildIdentityAudit(sb, targetUserId),
    ]);

    if (!subjectResult.ok) {
      return new Response(JSON.stringify({
        error: "subject_identity_missing",
        message: "Cannot export a bundle for an account with no demographic information.",
        diagnostic: {
          target_user_id: targetUserId, caller_user_id: callerUserId,
          is_view_as_export: isViewAsExport,
          profile_found: subjectResult.profileFound,
          has_name: subjectResult.hasName,
          has_dob: subjectResult.hasDob, has_sex: subjectResult.hasSex,
          source_documents_found: sourceDocs.length,
          observations_found: labResult.observations.length + cieObs.length,
        },
      }, null, 2), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const observations = [...labResult.observations, ...cieObs];
    const featureState = computeFeatureState(observations);
    const timelines = computeTimelines(observations);

    const hasLabs = labResult.observations.some((o) => o.source_class === "lab");
    const hasInbody = labResult.observations.some((o) => o.source_class === "inbody");
    const hasFibroscan = labResult.observations.some((o) => o.source_class === "fibroscan");
    const hasCie = cieObs.length > 0;

    const bundle = {
      meta: {
        bundle_version: BUNDLE_VERSION,
        ontology_version: ONTOLOGY_VERSION,
        generated_at: new Date().toISOString(),
        phi_level: "full_phi",
        source: "reveal_path",
        generator: "vizzhy_reveal_path_celf_adapter_v1.7_llm_canonical",
        caller_user_id: callerUserId,
        target_user_id: targetUserId,
        is_view_as_export: isViewAsExport,
        canonicalization_method: "llm_at_ingest",
        confidence_threshold: CONFIDENCE_THRESHOLD,
        excluded_observations: labResult.excluded.length,
      },
      subject: subjectResult.subject,
      source_documents: sourceDocs,
      observations,
      feature_state: featureState,
      timelines,
      identity_audit: identityAudit,
      excluded: labResult.excluded,
    };

    const contentHash = await sha256(bundle);

    const { data: auditRow, error: auditErr } = await sb
      .from("celf_exports").insert({
        user_id: targetUserId,
        bundle_version: BUNDLE_VERSION, map_version: ONTOLOGY_VERSION,
        status: "ready", phi_level: "full_phi",
        subject_count: subjectResult.subject.length,
        source_document_count: sourceDocs.length,
        observation_count: observations.length,
        feature_state_count: featureState.length,
        has_labs: hasLabs, has_inbody: hasInbody, has_cie: hasCie, has_food_log: false,
        bundle, content_sha256: contentHash,
      }).select("id, generated_at").single();
    if (auditErr) throw new Error(`audit insert failed: ${auditErr.message}`);

    return new Response(JSON.stringify({
      export_id: auditRow.id,
      generated_at: auditRow.generated_at,
      content_sha256: contentHash,
      is_view_as_export: isViewAsExport,
      caller_user_id: callerUserId, target_user_id: targetUserId,
      coverage: { labs: hasLabs, inbody: hasInbody, cie: hasCie, fibroscan: hasFibroscan },
      counts: {
        subject: subjectResult.subject.length,
        source_documents: sourceDocs.length,
        observations: observations.length,
        feature_state: featureState.length,
        timelines: timelines.length,
        identity_events: identityAudit.length,
        excluded: labResult.excluded.length,
      },
      bundle,
    }, null, 2), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[export-celf-bundle v1.7] error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
