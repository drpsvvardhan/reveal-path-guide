// ============================================================================
// extraction-report — per-file transparency report (read-only)
// ----------------------------------------------------------------------------
// For every uploaded document this returns:
//   * the values that were kept and can be reasoned with (canonical binding)
//   * the values that were read but not yet recognised
//   * the safety concerns those values raise, computed server-side by the
//     shared deterministic lab reassessment
//   * what this document type does not yield at all (diagnoses, medications,
//     free text), stated plainly instead of left to be assumed
//
// Thresholds live only on the server. This endpoint reads; it never writes, and
// it can never clear a hold: assessLabEvidence has no clearance output.
// ============================================================================
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateRequest, jsonResponse, resolveTargetUserId } from "../_shared/auth.ts";
import { assessLabEvidence } from "../_shared/aae/labReassessment.ts";

interface ObsRow {
  id: string;
  upload_id: string | null;
  raw_name: string;
  canonical_name: string;
  display_name: string | null;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: string | null;
  collection_date: string | null;
  canonical_concept_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authed = await authenticateRequest(req);
    if (!authed.ok) return jsonResponse(authed.error.body, authed.error.status, corsHeaders);

    let body: { user_id?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const resolved = await resolveTargetUserId(authed.auth, body.user_id ?? null);
    if (!resolved.ok) return jsonResponse(resolved.error.body, resolved.error.status, corsHeaders);
    const userId = resolved.targetUserId;
    const db = authed.auth.serviceClient;

    const { data: uploads, error: upErr } = await db
      .from("patient_lab_uploads")
      .select(
        "id, original_filename, document_type, source_lab, collection_date, status, observations_extracted, observations_inserted, observations_duplicates, error_message, rejection_reason, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (upErr) throw upErr;

    // Paged read: a full history exceeds the single-request row cap, and a
    // truncated read would understate what was actually extracted.
    const page = 1000;
    const observations: ObsRow[] = [];
    for (let from = 0; ; from += page) {
      const { data, error } = await db
        .from("patient_lab_observations")
        .select(
          "id, upload_id, raw_name, canonical_name, display_name, value, unit, ref_low, ref_high, flag, collection_date, canonical_concept_id",
        )
        .eq("user_id", userId)
        .order("collection_date", { ascending: false })
        .range(from, from + page - 1);
      if (error) throw error;
      const batch = (data ?? []) as ObsRow[];
      observations.push(...batch);
      if (batch.length < page) break;
    }

    // One marker can exist twice for the same draw: an older unbound row and a
    // canonicalized one. Collapse per file so counts report markers, not rows,
    // preferring the bound row so "not yet recognised" stays truthful.
    const perUpload = new Map<string, Map<string, ObsRow>>();
    for (const o of observations) {
      if (!o.upload_id) continue;
      const markers = perUpload.get(o.upload_id) ?? new Map<string, ObsRow>();
      const key = `${o.canonical_name}|${o.collection_date}`;
      const existing = markers.get(key);
      if (!existing || (!existing.canonical_concept_id && o.canonical_concept_id)) markers.set(key, o);
      perUpload.set(o.upload_id, markers);
    }

    const files = (uploads ?? []).map((u: any) => {
      const markers = [...(perUpload.get(u.id)?.values() ?? [])];
      const assessment = assessLabEvidence({ labs: { observations: markers } });
      return {
        upload_id: u.id,
        filename: u.original_filename,
        document_type: u.document_type ?? null,
        source_lab: u.source_lab ?? null,
        collection_date: u.collection_date ?? null,
        status: u.status,
        counts: {
          extracted: u.observations_extracted ?? 0,
          kept: markers.length,
          recognised: markers.filter((m) => m.canonical_concept_id).length,
          unrecognised: markers.filter((m) => !m.canonical_concept_id).length,
          duplicates_of_existing: u.observations_duplicates ?? 0,
          outside_range: markers.filter((m) => m.flag && m.flag !== "normal").length,
        },
        recognised: markers.filter((m) => m.canonical_concept_id),
        unrecognised: markers.filter((m) => !m.canonical_concept_id),
        // Raise-only safety signals from this file's own values.
        safety_concerns: assessment.concerns,
        // Stated rather than implied: these are not read from documents today.
        not_read: [
          "Diagnoses and conditions written as text",
          "Medications and doses",
          "The doctor's comments and interpretation",
        ],
        problem: u.rejection_reason ?? u.error_message ?? null,
      };
    });

    return jsonResponse(
      {
        files,
        totals: {
          files: files.length,
          kept: files.reduce((n, f) => n + f.counts.kept, 0),
          recognised: files.reduce((n, f) => n + f.counts.recognised, 0),
          unrecognised: files.reduce((n, f) => n + f.counts.unrecognised, 0),
          concerns: files.reduce((n, f) => n + f.safety_concerns.length, 0),
        },
      },
      200,
      corsHeaders,
    );
  } catch (e: any) {
    console.error("extraction-report error:", e);
    return jsonResponse({ error: e?.message ?? String(e) }, 500, corsHeaders);
  }
});
