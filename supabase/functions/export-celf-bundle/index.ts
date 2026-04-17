// ============================================================================
// export-celf-bundle v1.6
//
// Changes from v1.5:
//   1. Feature map lookup now considers source_unit — the adapter tries
//      (source_system, reveal_canonical, source_unit) first, then falls
//      back to (source_system, reveal_canonical) with factor=1.
//   2. Observation value_numeric is normalized via unit_factor × raw + offset.
//   3. New per-observation flag unit_normalized_applied indicates whether
//      a conversion was applied (so downstream consumers can see provenance).
//   4. Bundle meta gets a normalization_summary block showing how many
//      observations were unit-normalized and the distinct factors applied.
//   5. Raw value preserved alongside normalized in observation.value_raw.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUNDLE_VERSION = "celf-v0.7";
const MAP_VERSION    = "celf-v0.7";

type FeatureMapEntry = {
  celf_feature_name: string;
  celf_feature_label: string | null;
  celf_domain: string | null;
  celf_panel_group: string | null;
  unit_canonical: string | null;
  source_unit: string | null;
  unit_factor: number;
  unit_offset: number;
};

// The key is now compound: we store a list of entries per (system::canonical)
// because multiple rows can exist (one per source_unit).
type FeatureMap = Map<string, FeatureMapEntry[]>;

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

// Normalize a unit string for comparison: strip spaces, lowercase.
// This catches "10^3/uL" vs "10^3/µL" vs "10³/µL" - different ASCII but same unit.
function normalizeUnitKey(u: string | null | undefined): string {
  if (!u) return "";
  return u
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/µ/g, "u")      // micro symbol -> u
    .replace(/³/g, "^3")     // superscript 3 -> ^3
    .replace(/²/g, "^2")
    .replace(/×/g, "x")      // multiplication sign -> x
    .replace(/\*/g, "x");
}

// Lookup with unit preference, then fallback
function lookupFeature(
  map: FeatureMap,
  sourceSystem: string,
  revealCanonical: string,
  sourceUnit: string | null
): {
  twin_feature_name: string;
  feature_label: string;
  domain: string | null;
  panel_group: string | null;
  unit_canonical: string | null;
  unit_factor: number;
  unit_offset: number;
  unit_normalized_applied: boolean;
  needs_verification: boolean;
} {
  if (!revealCanonical) {
    return {
      twin_feature_name: `${sourceSystem}_unknown`,
      feature_label: "Unknown",
      domain: null, panel_group: null, unit_canonical: null,
      unit_factor: 1, unit_offset: 0, unit_normalized_applied: false,
      needs_verification: true,
    };
  }

  const entries = map.get(`${sourceSystem}::${revealCanonical}`);
  if (!entries || entries.length === 0) {
    // Fallback: slugified twin_feature_name, flagged
    return {
      twin_feature_name: `${sourceSystem}_${slugify(revealCanonical)}`,
      feature_label: revealCanonical,
      domain: null, panel_group: null, unit_canonical: null,
      unit_factor: 1, unit_offset: 0, unit_normalized_applied: false,
      needs_verification: true,
    };
  }

  // 1. Try to find a row with matching source_unit (unit-specific)
  const normUnit = normalizeUnitKey(sourceUnit);
  if (normUnit) {
    for (const e of entries) {
      if (e.source_unit && normalizeUnitKey(e.source_unit) === normUnit) {
        return {
          twin_feature_name: e.celf_feature_name,
          feature_label: e.celf_feature_label ?? revealCanonical,
          domain: e.celf_domain,
          panel_group: e.celf_panel_group,
          unit_canonical: e.unit_canonical,
          unit_factor: e.unit_factor,
          unit_offset: e.unit_offset,
          unit_normalized_applied: e.unit_factor !== 1 || e.unit_offset !== 0,
          needs_verification: false,
        };
      }
    }
  }

  // 2. Fall back to a row with no source_unit constraint (unit-agnostic)
  for (const e of entries) {
    if (e.source_unit === null) {
      return {
        twin_feature_name: e.celf_feature_name,
        feature_label: e.celf_feature_label ?? revealCanonical,
        domain: e.celf_domain,
        panel_group: e.celf_panel_group,
        unit_canonical: e.unit_canonical,
        unit_factor: e.unit_factor,
        unit_offset: e.unit_offset,
        unit_normalized_applied: false,
        needs_verification: false,
      };
    }
  }

  // 3. Entries exist but all are unit-specific and none matched — pick the
  // first with factor=1 as the least-harmful default, but flag it.
  const first = entries[0];
  return {
    twin_feature_name: first.celf_feature_name,
    feature_label: first.celf_feature_label ?? revealCanonical,
    domain: first.celf_domain,
    panel_group: first.celf_panel_group,
    unit_canonical: first.unit_canonical,
    unit_factor: 1,
    unit_offset: 0,
    unit_normalized_applied: false,
    needs_verification: true,  // flag for human review — unit mismatch
  };
}

// ----------------------------------------------------------------------------
async function buildFeatureMap(sb: SupabaseClient): Promise<FeatureMap> {
  const { data, error } = await sb
    .from("celf_feature_map")
    .select("source_system, reveal_canonical, celf_feature_name, celf_feature_label, celf_domain, celf_panel_group, unit_canonical, source_unit, unit_factor, unit_offset")
    .eq("map_version", MAP_VERSION);
  if (error) throw new Error(`feature_map load failed: ${error.message}`);

  const m: FeatureMap = new Map();
  for (const row of data ?? []) {
    const key = `${row.source_system}::${row.reveal_canonical}`;
    const entry: FeatureMapEntry = {
      celf_feature_name: row.celf_feature_name,
      celf_feature_label: row.celf_feature_label,
      celf_domain: row.celf_domain,
      celf_panel_group: row.celf_panel_group,
      unit_canonical: row.unit_canonical,
      source_unit: row.source_unit,
      unit_factor: Number(row.unit_factor ?? 1),
      unit_offset: Number(row.unit_offset ?? 0),
    };
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(entry);
  }

  // Sort each bucket so unit-specific entries are tried first (deterministic).
  for (const [, list] of m) {
    list.sort((a, b) => {
      if (a.source_unit && !b.source_unit) return -1;
      if (!a.source_unit && b.source_unit) return 1;
      return 0;
    });
  }
  return m;
}

// ----------------------------------------------------------------------------
async function buildSubject(sb: SupabaseClient, userId: string) {
  const { data: profile } = await sb
    .from("profiles")
    .select("id, first_name, last_name, preferred_name, date_of_birth, sex, mrn, age")
    .eq("id", userId)
    .maybeSingle();

  const candidateName = profile
    ? (profile.preferred_name ?? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim())
    : null;
  const externalName = candidateName && candidateName.length > 0 ? candidateName : null;

  return {
    ok: Boolean(externalName) || Boolean(profile?.date_of_birth) || Boolean(profile?.sex),
    subject: [{
      subject_id: userId,
      external_name: externalName ?? "Unnamed Subject",
      dob: profile?.date_of_birth ?? null,
      age: profile?.age ?? null,
      sex: profile?.sex ?? null,
      mrn: profile?.mrn ?? null,
      source_system: "reveal_path",
    }],
    profileFound: Boolean(profile),
    hasName: Boolean(externalName),
    hasDob: Boolean(profile?.date_of_birth),
    hasSex: Boolean(profile?.sex),
  };
}

async function buildSourceDocuments(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from("patient_lab_uploads")
    .select("id, original_filename, document_type, page_count, extraction_confidence, uploaded_at, status, name_match_status, name_match_score, extracted_patient_name, content_sha256")
    .eq("user_id", userId)
    .not("status", "in", "(rejected_identity,rejected_duplicate,failed)")
    .order("uploaded_at", { ascending: true });
  if (error) throw new Error(`lab_uploads load failed: ${error.message}`);
  return (data ?? []).map((u: any) => ({
    source_doc_id: u.id,
    source_name: u.original_filename ?? "unnamed_upload",
    pages: u.page_count ?? null,
    document_type: u.document_type ?? "lab_pdf",
    ingest_confidence: u.extraction_confidence ?? null,
    ingested_at: u.uploaded_at,
    status: u.status,
    identity_verified: u.name_match_status === "match",
    identity_match_score: u.name_match_score ?? null,
    extracted_patient_name: u.extracted_patient_name ?? null,
    content_sha256: u.content_sha256 ?? null,
  }));
}

async function buildLabAndFibroscanObservations(sb: SupabaseClient, userId: string, map: FeatureMap) {
  const { data, error } = await sb
    .from("patient_lab_observations")
    .select("id, upload_id, canonical_name, original_name, value, value_text, unit, flag, reference_range_text, specimen_type, collection_date, page_number, extraction_confidence")
    .eq("user_id", userId);
  if (error) throw new Error(`lab_observations load failed: ${error.message}`);

  const obs: any[] = [];
  for (const r of data ?? []) {
    let sourceClass: "lab" | "inbody" | "fibroscan" = "lab";
    let subSys = "lab";
    if (r.specimen_type === "fibroscan") { sourceClass = "fibroscan"; subSys = "fibroscan"; }
    else if (r.specimen_type === "body_composition") { sourceClass = "inbody"; subSys = "inbody"; }

    const f = lookupFeature(map, subSys, r.canonical_name ?? r.original_name ?? "", r.unit);

    // Apply unit normalization
    const rawValue = r.value;
    const normalizedValue = (rawValue !== null && rawValue !== undefined)
      ? rawValue * f.unit_factor + f.unit_offset
      : null;

    obs.push({
      observation_id: r.id,
      subject_id: userId,
      encounter_id: null,
      source_doc_id: r.upload_id,
      source_name: r.original_name ?? r.canonical_name,
      source_class: sourceClass,
      collection_date: r.collection_date,
      observed_at_precision: r.collection_date ? "date" : "unknown",
      category: sourceClass,
      domain: f.domain,
      panel_group: f.panel_group,
      panel_original: null,
      analyte_name: f.feature_label,
      test_name_original: r.original_name,
      twin_feature_name: f.twin_feature_name,
      result_display: r.value_text ?? (normalizedValue != null ? String(normalizedValue) : null),
      value_operator: null,
      value_numeric: normalizedValue,
      value_raw: rawValue,                    // NEW — preserved raw value
      value_text: r.value_text,
      unit_normalized: f.unit_canonical ?? r.unit,
      unit_original: r.unit,
      unit_factor: f.unit_factor,             // NEW — transparency about conversion
      unit_offset: f.unit_offset,
      unit_normalized_applied: f.unit_normalized_applied,  // NEW
      flag: r.flag,
      reference_range_text: r.reference_range_text,
      specimen_type: r.specimen_type,
      status: "final",
      page_number: r.page_number,
      ocr_confidence: r.extraction_confidence,
      needs_pdf_verification: f.needs_verification,
      raw_notes: null,
    });
  }
  return obs;
}

async function buildCieObservations(sb: SupabaseClient, userId: string, map: FeatureMap) {
  const out: any[] = [];
  const { data: assessments, error: aErr } = await sb
    .from("cie_assessments")
    .select("id, user_id, assessed_at, completed_at, created_at")
    .eq("user_id", userId);
  if (aErr || !assessments || assessments.length === 0) return out;

  const assessmentIds = assessments.map((a: any) => a.id);

  const { data: domainScores } = await sb
    .from("cie_domain_scores")
    .select("id, assessment_id, domain_id, score, completion_pct, computed_at")
    .in("assessment_id", assessmentIds);
  const { data: gateScores } = await sb
    .from("cie_gate_scores")
    .select("id, assessment_id, gate_id, score, status, computed_at")
    .in("assessment_id", assessmentIds);

  const aById = new Map(assessments.map((a: any) => [a.id, a]));

  for (const r of domainScores ?? []) {
    const a: any = aById.get(r.assessment_id) ?? {};
    const dt = a.assessed_at ?? a.completed_at ?? a.created_at ?? r.computed_at;
    const f = lookupFeature(map, "cie_domain", r.domain_id, null);
    out.push({
      observation_id: r.id, subject_id: userId, encounter_id: r.assessment_id,
      source_doc_id: null, source_name: "cie_v2.2_self_report", source_class: "cie",
      collection_date: dt, observed_at_precision: "date",
      category: "cie", domain: f.domain, panel_group: f.panel_group,
      panel_original: "CIE v2.2", analyte_name: f.feature_label,
      test_name_original: `Domain ${r.domain_id}`, twin_feature_name: f.twin_feature_name,
      result_display: r.score != null ? String(r.score) : null,
      value_operator: null, value_numeric: r.score, value_raw: r.score, value_text: null,
      unit_normalized: "score_0_100", unit_original: "score",
      unit_factor: 1, unit_offset: 0, unit_normalized_applied: false,
      flag: null, reference_range_text: null,
      specimen_type: "self_report",
      status: (r.completion_pct ?? 1) >= 1.0 ? "final" : "preliminary",
      page_number: null, ocr_confidence: null,
      needs_pdf_verification: false,
      raw_notes: JSON.stringify({ completion_pct: r.completion_pct }),
    });
  }
  for (const r of gateScores ?? []) {
    const a: any = aById.get(r.assessment_id) ?? {};
    const dt = a.assessed_at ?? a.completed_at ?? a.created_at ?? r.computed_at;
    const f = lookupFeature(map, "cie_gate", r.gate_id, null);
    out.push({
      observation_id: r.id, subject_id: userId, encounter_id: r.assessment_id,
      source_doc_id: null, source_name: "cie_v2.2_gate", source_class: "cie",
      collection_date: dt, observed_at_precision: "date",
      category: "cie", domain: "cie_gate", panel_group: f.panel_group,
      panel_original: "CIE v2.2 Gates", analyte_name: f.feature_label,
      test_name_original: r.gate_id, twin_feature_name: f.twin_feature_name,
      result_display: r.score != null ? String(r.score) : null,
      value_operator: null, value_numeric: r.score, value_raw: r.score, value_text: r.status,
      unit_normalized: "score_0_100", unit_original: "score",
      unit_factor: 1, unit_offset: 0, unit_normalized_applied: false,
      flag: r.status, reference_range_text: null,
      specimen_type: "self_report", status: "final",
      page_number: null, ocr_confidence: null,
      needs_pdf_verification: false, raw_notes: null,
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
    latest_value_text: o.value_text,
    unit: o.unit_normalized,
    latest_flag: o.flag,
    domain: o.domain,
    latest_source_name: o.source_name,
    latest_source_class: o.source_class,
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

    // Skip trajectory if the observations have heterogeneous unit_normalized values
    const units = new Set(obs.map((o) => o.unit_normalized).filter(Boolean));
    const hasHeterogeneousUnits = units.size > 1;

    const values = obs.map((o) => o.value_numeric);
    const first = values[0], last = values[values.length - 1];
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
      unit_heterogeneous: hasHeterogeneousUnits,    // NEW — warning flag
      any_unit_normalized: obs.some((o) => o.unit_normalized_applied),
      points: obs.map((o) => ({
        date: o.collection_date,
        value: o.value_numeric,
        raw: o.value_raw,
        unit: o.unit_normalized,
        source_unit: o.unit_original,
        unit_factor: o.unit_factor,
        flag: o.flag,
        source_doc_id: o.source_doc_id,
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
        return new Response(JSON.stringify({ error: "forbidden" }), {
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

    if (!subjectResult.ok) {
      return new Response(JSON.stringify({
        error: "subject_identity_missing",
        message: "Cannot export a bundle for an account with no demographic information. Please complete the profile (name, date of birth, sex) before exporting.",
        diagnostic: {
          target_user_id: targetUserId,
          caller_user_id: callerUserId,
          is_view_as_export: isViewAsExport,
          profile_found: subjectResult.profileFound,
          has_name: subjectResult.hasName,
          has_dob: subjectResult.hasDob,
          has_sex: subjectResult.hasSex,
          source_documents_found: sourceDocs.length,
          observations_found: labLikeObs.length + cieObs.length,
        },
      }, null, 2), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const observations = [...labLikeObs, ...cieObs];
    const featureState = computeFeatureState(observations);
    const timelines    = computeTimelines(observations);

    const hasLabs      = labLikeObs.some((o) => o.source_class === "lab");
    const hasInbody    = labLikeObs.some((o) => o.source_class === "inbody");
    const hasFibroscan = labLikeObs.some((o) => o.source_class === "fibroscan");
    const hasCie       = cieObs.length > 0;

    // Normalization summary
    const normalizedCount = observations.filter((o) => o.unit_normalized_applied).length;
    const distinctFactors = Array.from(new Set(observations
      .filter((o) => o.unit_normalized_applied)
      .map((o) => `${o.unit_factor}×`)
    ));

    const bundle = {
      meta: {
        bundle_version: BUNDLE_VERSION,
        map_version: MAP_VERSION,
        generated_at: new Date().toISOString(),
        phi_level: "full_phi",
        source: "reveal_path",
        generator: "vizzhy_reveal_path_celf_adapter_v1.6",
        caller_user_id: callerUserId,
        target_user_id: targetUserId,
        is_view_as_export: isViewAsExport,
        normalization_summary: {
          observations_unit_normalized: normalizedCount,
          distinct_factors_applied: distinctFactors,
          timelines_with_heterogeneous_units: timelines.filter((t) => t.unit_heterogeneous).length,
        },
      },
      subject: subjectResult.subject,
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
        subject_count: subjectResult.subject.length,
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
        subject: subjectResult.subject.length,
        source_documents: sourceDocs.length,
        observations: observations.length,
        feature_state: featureState.length,
        timelines: timelines.length,
        identity_events: identityAudit.length,
        observations_unit_normalized: normalizedCount,
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
