// ============================================================================
// process-fibroscan
//
// Ingests a FibroScan report PDF. Extracts CAP, LSM, IQRs, success rate, etc.
// Writes each measurement as a row in patient_lab_observations with
// source='fibroscan' so the CELF adapter picks them up.
//
// Identity flow:
//   - match    -> proceed and write observations.
//   - mismatch -> set status='awaiting_identity_confirmation' and stop.
//                 Front end shows a typed-confirmation modal.
//   - unknown  -> same await state. Front end shows a yes/no modal.
//   - With identity_override:{kind:'unknown_accepted'|'mismatch_overridden',
//     confirmed_name:string} the function bypasses the guard, records the
//     override, and writes observations.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  sha256Bytes,
  verifyPatientIdentity,
  checkContentDuplicate,
  recordRejection,
} from "../_shared/uploadGuards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = "gemini-2.5-flash";

const EXTRACTION_PROMPT = `You are extracting data from a FibroScan liver elastography report.

Return ONLY valid JSON in this exact shape:
{
  "patient_name": "full name as printed, or null",
  "patient_dob": "YYYY-MM-DD or null",
  "patient_mrn": "MRN or Patient ID, or null",
  "exam_date": "YYYY-MM-DD",
  "provider": "facility or provider name, or null",
  "measurements": {
    "cap_median": 0,
    "cap_iqr": 0,
    "lsm_median": 0,
    "lsm_iqr": 0,
    "iqr_median_ratio": 0,
    "success_rate_pct": 0,
    "valid_measurements": 0,
    "steatosis_grade": "S0 or S1 or S2 or S3 or null",
    "fibrosis_stage": "F0 or F1 or F2 or F3 or F4 or null"
  },
  "notes": "any clinical interpretation text from the report"
}

CAP is steatosis in dB/m (typical range 100-400).
LSM is liver stiffness in kPa (typical range 2-75).
If a value is not present, use null.
Do not invent values.`;

type IdentityOverride = {
  kind: "unknown_accepted" | "mismatch_overridden";
  confirmed_name: string;
};

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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authData.user.id;

    const body = await req.json();
    const { upload_id: uploadId, storage_path: storagePath } = body;
    const identityOverride: IdentityOverride | undefined = body.identity_override;
    if (!uploadId || !storagePath) {
      return new Response(JSON.stringify({ error: "missing upload_id or storage_path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    const { data: uploadRow, error: uErr } = await sb
      .from("patient_lab_uploads")
      .select("id, original_filename, user_id, status, extracted_patient_name, name_match_score, name_match_status")
      .eq("id", uploadId)
      .eq("user_id", userId)
      .single();

    if (uErr || !uploadRow) {
      return new Response(JSON.stringify({ error: "upload_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download file bytes from storage
    const { data: fileData, error: fileErr } = await sb.storage
      .from("lab-uploads")
      .download(storagePath);
    if (fileErr || !fileData) {
      return new Response(JSON.stringify({ error: "file_download_failed", detail: fileErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = new Uint8Array(await fileData.arrayBuffer());
    const contentSha = await sha256Bytes(pdfBytes);

    // -------- Guard 1: duplicate check (skip when this is the same upload re-trying after confirmation) --------
    const dedup = await checkContentDuplicate(sb, userId, contentSha);
    if (dedup.isDuplicate && dedup.existingUploadId !== uploadRow.id) {
      await recordRejection(sb, {
        userId,
        uploadId: uploadRow.id,
        fileName: uploadRow.original_filename,
        category: "duplicate_content",
        detail: `Duplicate of upload ${dedup.existingUploadId}`,
        contentSha256: contentSha,
      });
      return new Response(JSON.stringify({
        error: "duplicate_upload",
        message: `You already uploaded this FibroScan on ${new Date(dedup.uploadedAt!).toLocaleDateString()}.`,
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb.from("patient_lab_uploads")
      .update({ content_sha256: contentSha, processing_started_at: new Date().toISOString() })
      .eq("id", uploadRow.id);

    // -------- Gemini extraction --------
    const base64Pdf = btoa(String.fromCharCode(...pdfBytes));
    const geminiReq = {
      contents: [{
        parts: [
          { inlineData: { mimeType: "application/pdf", data: base64Pdf } },
          { text: EXTRACTION_PROMPT },
        ],
      }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiReq),
      }
    );
    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      throw new Error(`gemini_extraction_failed: ${err}`);
    }
    const geminiBody = await geminiRes.json();
    const rawText = geminiBody?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const extraction = JSON.parse(rawText);

    // -------- Guard 2: identity match --------
    const identity = await verifyPatientIdentity(sb, userId, extraction.patient_name);

    await sb.from("patient_lab_uploads").update({
      extracted_patient_name: extraction.patient_name ?? null,
      extracted_patient_dob:  extraction.patient_dob  ?? null,
      extracted_patient_mrn:  extraction.patient_mrn  ?? null,
      name_match_score:       identity.score,
      name_match_status:      identity.status,
    }).eq("id", uploadRow.id);

    // ---- override branch: caller has explicitly confirmed identity from the UI ----
    if (identityOverride) {
      const validKind = identityOverride.kind === "unknown_accepted" || identityOverride.kind === "mismatch_overridden";
      if (!validKind || typeof identityOverride.confirmed_name !== "string" || identityOverride.confirmed_name.trim().length < 2) {
        return new Response(JSON.stringify({ error: "invalid_identity_override" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await sb.from("patient_lab_uploads").update({
        identity_confirmed_at: new Date().toISOString(),
        identity_confirmed_name: identityOverride.confirmed_name.trim(),
        identity_confirmation_kind: identityOverride.kind,
        name_match_status: "confirmed_by_user",
      }).eq("id", uploadRow.id);
    } else {
      // ---- no override: enforce gates ----
      if (identity.status === "mismatch") {
        await sb.from("patient_lab_uploads").update({
          status: "awaiting_identity_confirmation",
          name_match_status: "needs_confirmation_mismatch",
        }).eq("id", uploadRow.id);
        return new Response(JSON.stringify({
          status: "awaiting_identity_confirmation",
          kind: "mismatch",
          extracted_name: identity.extractedName,
          account_name: identity.accountName,
          score: identity.score,
          message: `This FibroScan appears to be for "${identity.extractedName}". Confirm before we add it.`,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (identity.status === "unknown" && identity.reason !== "no_name_extracted") {
        await sb.from("patient_lab_uploads").update({
          status: "awaiting_identity_confirmation",
          name_match_status: "needs_confirmation_unknown",
        }).eq("id", uploadRow.id);
        return new Response(JSON.stringify({
          status: "awaiting_identity_confirmation",
          kind: "unknown",
          extracted_name: identity.extractedName,
          account_name: identity.accountName,
          score: identity.score,
          reason: identity.reason,
          message: `We couldn't confirm this report belongs to you. Is "${identity.extractedName ?? "the name on this report"}" you?`,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // -------- Write observations --------
    const examDate = extraction.exam_date ?? new Date().toISOString().slice(0, 10);
    const m = extraction.measurements ?? {};

    const obsRows: any[] = [];
    const pushObs = (canonical: string, value: number | string | null, unit: string) => {
      if (value === null || value === undefined || value === "") return;
      const numeric = typeof value === "number" ? value : Number(value);
      if (!isFinite(numeric)) return;
      obsRows.push({
        user_id: userId,
        upload_id: uploadRow.id,
        canonical_name: canonical,
        raw_name: canonical,
        display_name: canonical,
        value: numeric,
        unit,
        collection_date: examDate,
        source: "fibroscan",
      });
    };

    pushObs("CAP", m.cap_median, "dB/m");
    pushObs("CAP IQR", m.cap_iqr, "dB/m");
    pushObs("LSM", m.lsm_median, "kPa");
    pushObs("LSM IQR", m.lsm_iqr, "kPa");
    pushObs("IQR/Median", m.iqr_median_ratio, "ratio");
    pushObs("Success Rate", m.success_rate_pct, "%");
    pushObs("Valid Measurements", m.valid_measurements, "count");

    const parseStage = (v: unknown): number | null => {
      if (typeof v !== "string") return null;
      const match = v.match(/(\d)/);
      return match ? Number(match[1]) : null;
    };
    pushObs("Steatosis Grade", parseStage(m.steatosis_grade), "grade");
    pushObs("Fibrosis Stage", parseStage(m.fibrosis_stage), "stage");

    if (obsRows.length > 0) {
      const { error: insErr } = await sb.from("patient_lab_observations").insert(obsRows);
      if (insErr) throw new Error(`observation_insert_failed: ${insErr.message}`);
    }

    await sb.from("patient_lab_uploads").update({
      status: "complete",
      processing_completed_at: new Date().toISOString(),
      observations_extracted: obsRows.length,
      observations_inserted: obsRows.length,
      collection_date: examDate,
    }).eq("id", uploadRow.id);

    return new Response(JSON.stringify({
      ok: true,
      status: "complete",
      extracted: {
        exam_date: examDate,
        measurements_written: obsRows.length,
        measurements: m,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[process-fibroscan] error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
