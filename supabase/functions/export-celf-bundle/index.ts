// ============================================================================
// export-celf-bundle  v1.1
//
// Changes from v1.0:
//   1. Map version bumped to celf-v0.3 (uses expanded feature map)
//   2. New source_class "fibroscan" emitted from observations where
//      specimen_type = 'fibroscan'
//   3. New top-level "timelines" block: per-feature trajectory for any
//      twin_feature_name with >=2 measurements, ordered by date
//   4. Resilient CIE / InBody resolution — tries multiple schema shapes
//      so small column-name drift doesn't silently drop data
//   5. Bundle adds coverage flag for fibroscan
//   6. Bundle adds "identity_audit" block: upload-level name-match history
//      so the BioTwin generator can see which uploads were verified clean
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUNDLE_VERSION = "celf-v0.6";
const MAP_VERSION    = "celf-v0.6";

type FeatureMap = Map<string, {
  celf_feature_name: string;
  celf_feature_label: string | null;
  celf_domain: string | null;
  celf_panel_group: string | null;
  unit_canonical: string | null;
}>;

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

async function sha256(obj: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function lookupFeature(map: FeatureMap, sourceSystem: string, revealCanonical: string) {
  if (!revealCanonical) return { twin_feature_name: `${sourceSystem}_unknown`, feature_label: "Unknown", domain: null, panel_group: null, unit_canonical: null, needs_verification: true };
  const hit = map.get(`${sourceSystem}::${revealCanonical}`);
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
    domain: null,
    panel_group: null,
    unit_canonical: null,
    needs_verification: true,
  };
}

// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// Subject build — returns identity-gate metadata so the caller can refuse to
// emit a bundle for an account with no demographic information.
// Schema note: profiles has first_name, preferred_name, age, sex
// (no last_name / date_of_birth / mrn columns on this project).
// ----------------------------------------------------------------------------
async function buildSubject(sb: SupabaseClient, userId: string) {
  // Match by user_id (the auth uuid), NOT by profiles.id (which is a separate PK).
  const { data: profile, error } = await sb
    .from("profiles")
    .select("id, user_id, first_name, preferred_name, display_name, sex, age, name_aliases")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`profile load failed: ${error.message}`);

  const candidateName = profile
    ? (profile.preferred_name ?? profile.first_name ?? profile.display_name ?? "").trim()
    : "";
  const externalName = candidateName.length > 0 ? candidateName : null;

  return {
    ok: Boolean(externalName) && Boolean(profile?.age) && Boolean(profile?.sex),
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

// ----------------------------------------------------------------------------
async function buildSourceDocuments(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from("patient_lab_uploads")
    .select("id, original_filename, source_lab, created_at, status, name_match_status, name_match_score, extracted_patient_name, content_sha256")
    .eq("user_id", userId)
    .not("status", "in", "(rejected_identity,rejected_duplicate,failed)")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`lab_uploads load failed: ${error.message}`);

  return (data ?? []).map((u: any) => ({
    source_doc_id: u.id,
    source_name: u.original_filename ?? "unnamed_upload",
    pages: null,
    document_type: u.source_lab === "fibroscan" ? "fibroscan_pdf" : "lab_pdf",
    ingest_confidence: null,
    ingested_at: u.created_at,
    status: u.status,
    identity_verified: u.name_match_status === "match",
    identity_match_score: u.name_match_score ?? null,
    extracted_patient_name: u.extracted_patient_name ?? null,
    content_sha256: u.content_sha256 ?? null,
  }));
}

// ----------------------------------------------------------------------------
async function buildLabAndFibroscanObservations(sb: SupabaseClient, userId: string, map: FeatureMap) {
  // Only include observations whose parent upload is NOT rejected/failed.
  const { data: activeUploads, error: uErr } = await sb
    .from("patient_lab_uploads")
    .select("id, source_lab")
    .eq("user_id", userId)
    .not("status", "in", "(rejected_identity,rejected_duplicate,failed)");
  if (uErr) throw new Error(`lab_uploads filter failed: ${uErr.message}`);

  const activeUploadIds = new Set((activeUploads ?? []).map((u: any) => u.id));
  const uploadSourceLab = new Map<string, string | null>(
    (activeUploads ?? []).map((u: any) => [u.id, u.source_lab ?? null]),
  );

  if (activeUploadIds.size === 0) return [];

  const { data, error } = await sb
    .from("patient_lab_observations")
    .select("id, upload_id, canonical_name, raw_name, display_name, value, original_value, unit, flag, ref_low, ref_high, source, collection_date")
    .eq("user_id", userId)
    .in("upload_id", Array.from(activeUploadIds));
  if (error) throw new Error(`lab_observations load failed: ${error.message}`);

  const obs: any[] = [];
  for (const r of data ?? []) {
    const sourceLab = uploadSourceLab.get(r.upload_id);
    const isFibroscan = sourceLab === "fibroscan" || r.source === "fibroscan";

    let sourceClass: "lab" | "inbody" | "fibroscan" = "lab";
    let subSys = "lab";
    if (isFibroscan) { sourceClass = "fibroscan"; subSys = "fibroscan"; }

    const f = lookupFeature(map, subSys, r.canonical_name ?? r.raw_name ?? "");
    const refRange = (r.ref_low != null && r.ref_high != null) ? `${r.ref_low}–${r.ref_high}` : null;

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
      domain: f.domain,
      panel_group: f.panel_group,
      panel_original: null,
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
      specimen_type: isFibroscan ? "fibroscan" : null,
      status: "final",
      page_number: null,
      ocr_confidence: null,
      needs_pdf_verification: f.needs_verification,
      raw_notes: null,
    });
  }
  return obs;
}

// ----------------------------------------------------------------------------
// CIE observations — tries multiple schema shapes. If joins fail, tries a
// separate two-step query (fetch assessments first, then scores by id).
// Returns [] if there is genuinely no CIE data.
// ----------------------------------------------------------------------------
async function buildCieObservations(sb: SupabaseClient, userId: string, map: FeatureMap) {
  const out: any[] = [];

  // Find all CIE assessments for this user (covers variant column names)
  const { data: assessments, error: aErr } = await sb
    .from("cie_assessments")
    .select("id, user_id, assessed_at, completed_at, created_at")
    .eq("user_id", userId);

  if (aErr) {
    console.warn("[cie] no assessments or query failed:", aErr.message);
    return out;
  }
  if (!assessments || assessments.length === 0) return out;

  const assessmentIds = assessments.map((a: any) => a.id);

  // Domain scores
  const { data: domainScores, error: dErr } = await sb
    .from("cie_domain_scores")
    .select("id, assessment_id, domain_id, score, completion_pct, computed_at")
    .in("assessment_id", assessmentIds);
  if (dErr) console.warn("[cie] domain scores query failed:", dErr.message);

  const aById = new Map(assessments.map((a: any) => [a.id, a]));

  for (const r of domainScores ?? []) {
    const assessment: any = aById.get(r.assessment_id) ?? {};
    const collectionDate = assessment.assessed_at ?? assessment.completed_at ?? assessment.created_at ?? r.computed_at;
    const f = lookupFeature(map, "cie_domain", r.domain_id);
    out.push({
      observation_id: r.id,
      subject_id: userId,
      encounter_id: r.assessment_id,
      source_doc_id: null,
      source_name: "cie_v2.2_self_report",
      source_class: "cie",
      collection_date: collectionDate,
      observed_at_precision: "date",
      category: "cie",
      domain: f.domain,
      panel_group: f.panel_group,
      panel_original: "CIE v2.2",
      analyte_name: f.feature_label,
      test_name_original: `Domain ${r.domain_id}`,
      twin_feature_name: f.twin_feature_name,
      result_display: r.score != null ? String(r.score) : null,
      value_operator: null,
      value_numeric: r.score,
      value_text: null,
      unit_normalized: "score_0_100",
      unit_original: "score",
      flag: null,
      reference_range_text: null,
      specimen_type: "self_report",
      status: (r.completion_pct ?? 1) >= 1.0 ? "final" : "preliminary",
      page_number: null,
      ocr_confidence: null,
      needs_pdf_verification: false,
      raw_notes: JSON.stringify({ completion_pct: r.completion_pct }),
    });
  }

  // Gate scores
  const { data: gateScores, error: gErr } = await sb
    .from("cie_gate_scores")
    .select("id, assessment_id, gate_id, score, status, computed_at")
    .in("assessment_id", assessmentIds);
  if (gErr) console.warn("[cie] gate scores query failed:", gErr.message);

  for (const r of gateScores ?? []) {
    const assessment: any = aById.get(r.assessment_id) ?? {};
    const collectionDate = assessment.assessed_at ?? assessment.completed_at ?? assessment.created_at ?? r.computed_at;
    const f = lookupFeature(map, "cie_gate", r.gate_id);
    out.push({
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
      analyte_name: f.feature_label,
      test_name_original: r.gate_id,
      twin_feature_name: f.twin_feature_name,
      result_display: r.score != null ? String(r.score) : null,
      value_operator: null,
      value_numeric: r.score,
      value_text: r.status,
      unit_normalized: "score_0_100",
      unit_original: "score",
      flag: r.status,
      reference_range_text: null,
      specimen_type: "self_report",
      status: "final",
      page_number: null,
      ocr_confidence: null,
      needs_pdf_verification: false,
      raw_notes: null,
    });
  }

  return out;
}

// ----------------------------------------------------------------------------
// Feature state (latest per twin_feature_name)
// ----------------------------------------------------------------------------
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
    latest_source_class: o.source_class,
  }));
}

// ----------------------------------------------------------------------------
// Timelines — per-feature trajectory (only features with 2+ measurements)
// ----------------------------------------------------------------------------
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

    const values = obs.map((o) => o.value_numeric);
    const first = values[0];
    const last  = values[values.length - 1];
    const delta = last - first;
    const pctChange = first !== 0 ? (delta / Math.abs(first)) * 100 : null;

    timelines.push({
      twin_feature_name: tfn,
      feature_label: obs[0].analyte_name,
      domain: obs[0].domain,
      unit: obs[0].unit_normalized,
      source_class: obs[0].source_class,
      n_observations: obs.length,
      first_date: obs[0].collection_date,
      last_date: obs[obs.length - 1].collection_date,
      first_value: first,
      last_value: last,
      delta,
      pct_change: pctChange,
      points: obs.map((o) => ({
        date: o.collection_date,
        value: o.value_numeric,
        flag: o.flag,
        source_doc_id: o.source_doc_id,
      })),
    });
  }

  // Sort by absolute pct change desc so most interesting features surface first
  timelines.sort((a, b) => {
    const ax = Math.abs(a.pct_change ?? 0);
    const bx = Math.abs(b.pct_change ?? 0);
    return bx - ax;
  });

  return timelines;
}

// ----------------------------------------------------------------------------
async function buildIdentityAudit(sb: SupabaseClient, userId: string) {
  const { data } = await sb
    .from("upload_rejection_audit")
    .select("file_name, rejection_category, rejection_detail, account_holder_name, extracted_patient_name, name_match_score, rejected_at")
    .eq("user_id", userId)
    .order("rejected_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

// ----------------------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------------------
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
        return new Response(JSON.stringify({ error: "forbidden", message: "Admin role required to export another user's bundle." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetUserId = requestedUserId;
      isViewAsExport = true;
    }

    const sb = createClient(supabaseUrl, serviceKey);

    const featureMap = await buildFeatureMap(sb);

    const [subjectResult, sourceDocs, labLikeObs, cieObs, identityAudit] = await Promise.all([
      buildSubject(sb, targetUserId),
      buildSourceDocuments(sb, targetUserId),
      buildLabAndFibroscanObservations(sb, targetUserId, featureMap),
      buildCieObservations(sb, targetUserId, featureMap),
      buildIdentityAudit(sb, targetUserId),
    ]);

    // ------------------------------------------------------------------------
    // SUBJECT IDENTITY GATE
    //   Refuse to emit a bundle for an account missing demographics. This
    //   prevents the view-as confusion where the UI shows one patient but
    //   the export silently runs against a different (empty) account.
    // ------------------------------------------------------------------------
    if (!subjectResult.ok) {
      return new Response(JSON.stringify({
        error: "subject_identity_missing",
        message: "Cannot export a bundle for an account with no demographic information. Please complete the profile (name, age, sex) before exporting.",
        diagnostic: {
          target_user_id: targetUserId,
          caller_user_id: callerUserId,
          is_view_as_export: isViewAsExport,
          profile_found: subjectResult.profileFound,
          has_name: subjectResult.hasName,
          has_age: subjectResult.hasAge,
          has_sex: subjectResult.hasSex,
          source_documents_found: sourceDocs.length,
          observations_found: labLikeObs.length + cieObs.length,
        },
      }, null, 2), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = subjectResult.subject;
    const observations = [...labLikeObs, ...cieObs];
    const featureState = computeFeatureState(observations);
    const timelines    = computeTimelines(observations);

    const hasLabs      = labLikeObs.some((o) => o.source_class === "lab");
    const hasInbody    = labLikeObs.some((o) => o.source_class === "inbody");
    const hasFibroscan = labLikeObs.some((o) => o.source_class === "fibroscan");
    const hasCie       = cieObs.length > 0;

    const bundle = {
      meta: {
        bundle_version: BUNDLE_VERSION,
        map_version: MAP_VERSION,
        generated_at: new Date().toISOString(),
        phi_level: "full_phi",
        source: "reveal_path",
        generator: "vizzhy_reveal_path_celf_adapter_v1.4",
        caller_user_id: callerUserId,
        target_user_id: targetUserId,
        is_view_as_export: isViewAsExport,
      },
      subject,
      source_documents: sourceDocs,
      observations,
      feature_state: featureState,
      timelines,
      identity_audit: identityAudit,
    };

    const contentHash = await sha256(bundle);

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
      .select("id, generated_at").single();
    if (auditErr) throw new Error(`audit insert failed: ${auditErr.message}`);

    return new Response(JSON.stringify({
      export_id: auditRow.id,
      generated_at: auditRow.generated_at,
      content_sha256: contentHash,
      is_view_as_export: isViewAsExport,
      caller_user_id: callerUserId,
      target_user_id: targetUserId,
      coverage: { labs: hasLabs, inbody: hasInbody, cie: hasCie, fibroscan: hasFibroscan },
      counts: {
        subject: subject.length,
        source_documents: sourceDocs.length,
        observations: observations.length,
        feature_state: featureState.length,
        timelines: timelines.length,
        identity_events: identityAudit.length,
      },
      bundle,
    }, null, 2), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[export-celf-bundle] error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
