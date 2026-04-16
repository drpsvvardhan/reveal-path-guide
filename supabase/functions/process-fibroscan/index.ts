// ============================================================================
// process-fibroscan
//
// Ingests a FibroScan report PDF. Extracts:
//   - Patient identity (name, DOB, MRN) for identity match
//   - CAP (Controlled Attenuation Parameter) — dB/m — steatosis
//   - LSM (Liver Stiffness Measurement) — kPa — fibrosis
//   - IQRs, success rate, valid measurement count
//   - Steatosis grade (S0-S3), fibrosis stage (F0-F4) if present
//
// Writes each measurement as a row in patient_lab_observations with
// specimen_type='fibroscan' so the CELF adapter picks them up with
// source_class='fibroscan'.
//
// Same identity/dedup guards as process-lab-pdf.
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

// ----------------------------------------------------------------------------
// Extraction schema
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization") ?? "";

    // Authenticate the caller
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
    if (!uploadId || !storagePath) {
      return new Response(JSON.stringify({ error: "missing upload_id or storage_path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch the upload row (owned by this user via RLS)
    const { data: uploadRow, error: uErr } = await sb
      .from("patient_lab_uploads")
      .select("id, file_name, user_id")
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
      .from("patient-uploads")
      .download(storagePath);
    if (fileErr || !fileData) {
      return new Response(JSON.stringify({ error: "file_download_failed", detail: fileErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = new Uint8Array(await fileData.arrayBuffer());
    const contentSha = await sha256Bytes(pdfBytes);

    // -------- Guard 1: duplicate check --------
    const dedup = await checkContentDuplicate(sb, userId, contentSha);
    if (dedup.isDuplicate) {
      await recordRejection(sb, {
        userId,
        uploadId: uploadRow.id,
        fileName: uploadRow.file_name,
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
      .update({ content_sha256: contentSha, document_type: "fibroscan" })
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

    if (identity.status === "mismatch") {
      await recordRejection(sb, {
        userId,
        uploadId: uploadRow.id,
        fileName: uploadRow.file_name,
        category: "identity_mismatch",
        detail: `FibroScan name "${identity.extractedName}" ≠ account "${identity.accountName}"`,
        accountHolderName: identity.accountName,
        extractedPatientName: identity.extractedName,
        nameMatchScore: identity.score,
        contentSha256: contentSha,
      });
      return new Response(JSON.stringify({
        error: "identity_mismatch",
        message: `This FibroScan appears to be for "${identity.extractedName}". For patient safety, we can't add it to your record.`,
        extracted_name: identity.extractedName,
        account_name: identity.accountName,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (identity.status === "unknown" && identity.reason !== "no_name_extracted") {
      await recordRejection(sb, {
        userId,
        uploadId: uploadRow.id,
        fileName: uploadRow.file_name,
        category: "identity_mismatch",
        detail: `FibroScan identity inconclusive: ${identity.reason}`,
        accountHolderName: identity.accountName,
        extractedPatientName: identity.extractedName,
        nameMatchScore: identity.score,
        contentSha256: contentSha,
      });
      return new Response(JSON.stringify({
        error: "identity_inconclusive",
        message: "We couldn't confirm this FibroScan is for you. Please update your profile with an alias if this is your report.",
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- Write observations --------
    const examDate = extraction.exam_date ?? new Date().toISOString().slice(0, 10);
    const m = extraction.measurements ?? {};

    const obsRows: any[] = [];
    const pushObs = (canonical: string, value: number | string | null, unit: string | null) => {
      if (value === null || value === undefined || value === "") return;
      const numeric = typeof value === "number" ? value : (isFinite(Number(value)) ? Number(value) : null);
      obsRows.push({
        user_id: userId,
        upload_id: uploadRow.id,
        canonical_name: canonical,
        original_name: canonical,
        value_numeric: numeric,
        value_text: numeric === null ? String(value) : null,
        unit,
        flag: null,
        reference_range_text: null,
        specimen_type: "fibroscan",
        collected_at: examDate,
        extraction_confidence: null,
      });
    };

    pushObs("CAP", m.cap_median, "dB/m");
    pushObs("CAP IQR", m.cap_iqr, "dB/m");
    pushObs("LSM", m.lsm_median, "kPa");
    pushObs("LSM IQR", m.lsm_iqr, "kPa");
    pushObs("IQR/Median", m.iqr_median_ratio, "ratio");
    pushObs("Success Rate", m.success_rate_pct, "%");
    pushObs("Valid Measurements", m.valid_measurements, "count");
    pushObs("Steatosis Grade", m.steatosis_grade, "grade");
    pushObs("Fibrosis Stage", m.fibrosis_stage, "stage");

    if (obsRows.length > 0) {
      const { error: insErr } = await sb.from("patient_lab_observations").insert(obsRows);
      if (insErr) throw new Error(`observation_insert_failed: ${insErr.message}`);
    }

    await sb.from("patient_lab_uploads").update({
      status: "extracted",
      document_type: "fibroscan",
    }).eq("id", uploadRow.id);

    return new Response(JSON.stringify({
      ok: true,
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
