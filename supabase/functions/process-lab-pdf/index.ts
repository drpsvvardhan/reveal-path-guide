import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// CANONICAL ANALYTE MAPPING
// ============================================================================

const CANONICAL_MAPPING: Record<string, string> = {
  // Glucose / diabetes
  "glucose": "Glucose",
  "fasting glucose": "Glucose",
  "glucose, fasting": "Glucose",
  "blood glucose": "Glucose",
  "hba1c": "HbA1c",
  "hemoglobin a1c": "HbA1c",
  "a1c": "HbA1c",
  "glycohemoglobin": "HbA1c",
  "insulin": "Insulin",
  "insulin, fasting": "Insulin",
  "fasting insulin": "Insulin",
  "c-peptide": "C-Peptide",
  "c peptide": "C-Peptide",

  // Lipid panel
  "total cholesterol": "Total Cholesterol",
  "cholesterol, total": "Total Cholesterol",
  "cholesterol total": "Total Cholesterol",
  "ldl": "LDL-C",
  "ldl-c": "LDL-C",
  "ldl cholesterol": "LDL-C",
  "ldl, calculated": "LDL-C",
  "ldl, direct": "LDL-C",
  "hdl": "HDL-C",
  "hdl-c": "HDL-C",
  "hdl cholesterol": "HDL-C",
  "triglycerides": "Triglycerides",
  "trig": "Triglycerides",
  "non-hdl cholesterol": "Non-HDL Cholesterol",
  "non hdl cholesterol": "Non-HDL Cholesterol",
  "vldl": "VLDL",
  "apolipoprotein b": "ApoB",
  "apo b": "ApoB",
  "apob": "ApoB",
  "lipoprotein(a)": "Lp(a)",
  "lp(a)": "Lp(a)",
  "lp a": "Lp(a)",

  // CMP / liver / kidney
  "bun": "BUN",
  "blood urea nitrogen": "BUN",
  "urea nitrogen": "BUN",
  "creatinine": "Creatinine",
  "creatinine, serum": "Creatinine",
  "egfr": "eGFR",
  "egfr non-african american": "eGFR",
  "estimated gfr": "eGFR",
  "cystatin c": "Cystatin C",
  "sodium": "Sodium",
  "potassium": "Potassium",
  "chloride": "Chloride",
  "co2": "CO2",
  "carbon dioxide": "CO2",
  "calcium": "Calcium",
  "magnesium": "Magnesium",
  "total protein": "Total Protein",
  "protein, total": "Total Protein",
  "albumin": "Albumin",
  "globulin": "Globulin",
  "a/g ratio": "A/G Ratio",
  "albumin/globulin ratio": "A/G Ratio",
  "ast": "AST",
  "aspartate aminotransferase": "AST",
  "sgot": "AST",
  "alt": "ALT",
  "alanine aminotransferase": "ALT",
  "sgpt": "ALT",
  "alk phos": "Alkaline Phosphatase",
  "alkaline phosphatase": "Alkaline Phosphatase",
  "alp": "Alkaline Phosphatase",
  "ggt": "GGT",
  "gamma-glutamyl transferase": "GGT",
  "total bilirubin": "Total Bilirubin",
  "bilirubin, total": "Total Bilirubin",
  "direct bilirubin": "Direct Bilirubin",
  "bilirubin, direct": "Direct Bilirubin",
  "microalbumin": "Microalbumin",
  "albumin/creatinine ratio": "Albumin/Creatinine Ratio",

  // CBC
  "wbc": "WBC",
  "white blood cell count": "WBC",
  "white blood cells": "WBC",
  "rbc": "RBC",
  "red blood cell count": "RBC",
  "red blood cells": "RBC",
  "hemoglobin": "Hemoglobin",
  "hgb": "Hemoglobin",
  "hematocrit": "Hematocrit",
  "hct": "Hematocrit",
  "mcv": "MCV",
  "mch": "MCH",
  "mchc": "MCHC",
  "rdw": "RDW",
  "platelets": "Platelets",
  "platelet count": "Platelets",
  "mpv": "MPV",
  "neutrophils": "Neutrophils",
  "neutrophil percentage": "Neutrophils",
  "lymphocytes": "Lymphocytes",
  "monocytes": "Monocytes",
  "eosinophils": "Eosinophils",
  "basophils": "Basophils",

  // Thyroid
  "tsh": "TSH",
  "thyroid stimulating hormone": "TSH",
  "free t4": "Free T4",
  "ft4": "Free T4",
  "t4, free": "Free T4",
  "free t3": "Free T3",
  "ft3": "Free T3",
  "t3, free": "Free T3",
  "reverse t3": "Reverse T3",
  "rt3": "Reverse T3",
  "tpo antibodies": "TPO Antibodies",
  "thyroid peroxidase antibodies": "TPO Antibodies",
  "thyroglobulin": "Thyroglobulin",

  // Inflammation
  "crp": "CRP",
  "c-reactive protein": "CRP",
  "hs-crp": "hs-CRP",
  "high sensitivity crp": "hs-CRP",
  "hscrp": "hs-CRP",
  "esr": "ESR",
  "sedimentation rate": "ESR",
  "erythrocyte sedimentation rate": "ESR",
  "ferritin": "Ferritin",
  "fibrinogen": "Fibrinogen",
  "homocysteine": "Homocysteine",

  // Vitamins / minerals
  "vitamin d": "Vitamin D",
  "vitamin d, 25-hydroxy": "Vitamin D",
  "25-hydroxyvitamin d": "Vitamin D",
  "25(oh)d": "Vitamin D",
  "vitamin b12": "Vitamin B12",
  "b12": "Vitamin B12",
  "cobalamin": "Vitamin B12",
  "folate": "Folate",
  "folic acid": "Folate",
  "iron": "Iron",
  "iron, serum": "Iron",
  "tibc": "TIBC",
  "total iron binding capacity": "TIBC",
  "transferrin saturation": "Transferrin Saturation",
  "transferrin sat": "Transferrin Saturation",
  "transferrin": "Transferrin",
  "zinc": "Zinc",
  "selenium": "Selenium",

  // Cardiac
  "troponin": "Troponin",
  "troponin i": "Troponin",
  "troponin t": "Troponin",
  "nt-probnp": "NT-proBNP",
  "bnp": "BNP",
  "ck-mb": "CK-MB",

  // Hormones
  "testosterone": "Testosterone",
  "testosterone, total": "Testosterone Total",
  "total testosterone": "Testosterone Total",
  "free testosterone": "Testosterone Free",
  "testosterone, free": "Testosterone Free",
  "estradiol": "Estradiol",
  "e2": "Estradiol",
  "dhea-s": "DHEA-S",
  "dheas": "DHEA-S",
  "cortisol": "Cortisol",
  "cortisol, am": "Cortisol",
  "morning cortisol": "Cortisol",
  "progesterone": "Progesterone",
  "fsh": "FSH",
  "follicle stimulating hormone": "FSH",
  "lh": "LH",
  "luteinizing hormone": "LH",
  "shbg": "SHBG",
  "sex hormone binding globulin": "SHBG",
  "prolactin": "Prolactin",
};

function normalizeAnalyteName(rawName: string): string {
  if (!rawName) return rawName;
  const cleaned = rawName.trim().toLowerCase().replace(/\s+/g, " ");
  return CANONICAL_MAPPING[cleaned] || rawName.trim();
}

// ============================================================================
// THE EXTRACTION SYSTEM PROMPT
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are a structured data extractor for medical lab reports. You will receive a lab PDF and must extract every biomarker observation as structured JSON.

Your output must be a single valid JSON object. No preamble. No markdown code fences. No explanation. Just the JSON, starting with { and ending with }.

═══════════════════════════════════════════════════════════════════════════
OUTPUT SCHEMA — EXACT JSON STRUCTURE REQUIRED
═══════════════════════════════════════════════════════════════════════════

{
  "meta": {
    "source_lab": "string — name of the laboratory (Quest Diagnostics, LabCorp, hospital name) or null",
    "collection_date": "string — specimen collection date in ISO format YYYY-MM-DD, or null if not visible",
    "ordering_provider": "string — doctor or clinic name who ordered the labs, or null"
  },
  "observations": [
    {
      "raw_name": "string — the test name exactly as it appears on the PDF (do not normalize)",
      "value": "number — the numeric result (no units, no symbols, just the number)",
      "unit": "string — the unit of measurement exactly as it appears (mg/dL, %, ng/mL, mIU/L, etc.)",
      "ref_low": "number or null — the lower bound of the reference range",
      "ref_high": "number or null — the upper bound of the reference range",
      "flag": "string — one of 'low', 'normal', 'high', 'critical', based on whether the value is outside the reference range and how the report flags it"
    }
  ]
}

═══════════════════════════════════════════════════════════════════════════
EXTRACTION RULES
═══════════════════════════════════════════════════════════════════════════

RULE 1 — EXTRACT EVERY BIOMARKER. Include every test result on every page. Do not skip results. Do not summarize. Each row in the report becomes one observation in the array.

RULE 2 — RAW NAME EXACTLY AS SHOWN. The raw_name field is the test name exactly as it appears on the PDF. Do not normalize, do not abbreviate, do not expand. If the report says "Alanine Aminotransferase (ALT)", that's the raw_name. If it says "ALT" alone, that's the raw_name. The system will normalize names afterward.

RULE 3 — VALUE IS A NUMBER. The value field must be a JSON number (not a string). If the result is "<3.0" or ">100", extract the numeric portion only (3.0 or 100). If the result is non-numeric (like "Negative", "Positive", "Detected"), skip that observation entirely — only numeric biomarkers go in the output.

RULE 4 — REFERENCE RANGES. Lab reports show reference ranges in many formats:
  "70-99" → ref_low: 70, ref_high: 99
  "< 5.6" → ref_low: null, ref_high: 5.6
  "> 40" → ref_low: 40, ref_high: null
  "Normal: 4-5.6" → ref_low: 4, ref_high: 5.6
  "≤ 100" → ref_low: null, ref_high: 100
  Parse the range into ref_low and ref_high. Use null when one bound is not specified.

RULE 5 — FLAG NORMALIZATION. Lab reports use various flag indicators:
  "H", "HIGH", "↑", "*" near a high value → flag: "high"
  "L", "LOW", "↓" near a low value → flag: "low"
  "C", "CRITICAL", "!!" or anything urgent → flag: "critical"
  No flag and value within range → flag: "normal"
  No flag but value outside range (you can determine from ref_low/ref_high) → set flag based on direction

RULE 6 — COLLECTION DATE. The collection date is when the specimen was taken, NOT the report date or the result date. Look for labels like "Collected", "Specimen Date", "Date Collected", "Drawn". Format as YYYY-MM-DD. If only month/year is visible, use the first day of the month.

RULE 7 — SKIP NON-NUMERIC TESTS. Tests that return categorical results (Negative/Positive, Detected/Not Detected, Reactive/Non-Reactive) should be skipped. Only numeric biomarkers go in the output.

RULE 8 — SKIP COMMENTS AND CALCULATIONS NOTES. Lab reports often include narrative comments, footnotes, and calculation explanations. Do not extract these. Only extract structured numeric results.

RULE 9 — OUTPUT MUST BE VALID JSON. Your entire response is a single JSON object. No preamble like "Here are the results:". No markdown code fences like \`\`\`json. No closing comments. Just the JSON.

If you encounter an empty PDF, an unreadable scan, or a document that is not a lab report, return:
{ "meta": { "source_lab": null, "collection_date": null, "ordering_provider": null }, "observations": [] }`;

// ============================================================================
// CLAUDE VISION CALL
// ============================================================================

async function callClaudeWithPdf(base64Pdf: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Pdf,
              },
            },
            {
              type: "text",
              text: "Extract all biomarker observations from this lab report PDF. Return only the JSON object as specified in your instructions.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

function extractJsonFromText(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]);
      } catch {}
    }
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {}
    }
    throw new Error("Could not extract valid JSON from extraction output");
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

interface ExtractedObservation {
  raw_name: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  flag: string;
}

interface ExtractionResult {
  meta: {
    source_lab: string | null;
    collection_date: string | null;
    ordering_provider: string | null;
  };
  observations: ExtractedObservation[];
}

function validateAndCleanExtraction(raw: any): ExtractionResult | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.observations || !Array.isArray(raw.observations)) return null;

  const cleaned: ExtractionResult = {
    meta: {
      source_lab: typeof raw.meta?.source_lab === "string" ? raw.meta.source_lab : null,
      collection_date: typeof raw.meta?.collection_date === "string" ? raw.meta.collection_date : null,
      ordering_provider: typeof raw.meta?.ordering_provider === "string" ? raw.meta.ordering_provider : null,
    },
    observations: [],
  };

  for (const obs of raw.observations) {
    if (!obs || typeof obs !== "object") continue;
    if (typeof obs.raw_name !== "string" || !obs.raw_name.trim()) continue;
    if (typeof obs.value !== "number" || isNaN(obs.value)) continue;
    if (typeof obs.unit !== "string") continue;

    const flag = ["low", "normal", "high", "critical"].includes(obs.flag) ? obs.flag : "normal";

    cleaned.observations.push({
      raw_name: obs.raw_name.trim(),
      value: obs.value,
      unit: obs.unit.trim(),
      ref_low: typeof obs.ref_low === "number" ? obs.ref_low : null,
      ref_high: typeof obs.ref_high === "number" ? obs.ref_high : null,
      flag,
    });
  }

  return cleaned;
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { uploadId } = body;

    if (!uploadId) {
      return new Response(JSON.stringify({ error: "No uploadId provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Fetch the upload row
    const { data: upload, error: uploadError } = await supabase
      .from("patient_lab_uploads")
      .select("*")
      .eq("id", uploadId)
      .single();

    if (uploadError || !upload) {
      return new Response(JSON.stringify({ error: "Upload not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as processing
    await supabase
      .from("patient_lab_uploads")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
      })
      .eq("id", uploadId);

    // Download the PDF from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("lab-uploads")
      .download(upload.storage_path);

    if (downloadError || !fileData) {
      await supabase
        .from("patient_lab_uploads")
        .update({
          status: "failed",
          error_message: `Failed to download PDF from storage: ${downloadError?.message}`,
          processing_completed_at: new Date().toISOString(),
        })
        .eq("id", uploadId);

      return new Response(JSON.stringify({ error: "Failed to download PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Pdf = btoa(binary);

    // Call Claude vision
    let extracted: ExtractionResult | null = null;
    let extractionError: string | null = null;
    try {
      const rawOutput = await callClaudeWithPdf(base64Pdf);
      const parsed = extractJsonFromText(rawOutput);
      extracted = validateAndCleanExtraction(parsed);
      if (!extracted) {
        extractionError = "Extracted data did not match expected schema";
      }
    } catch (e) {
      extractionError = e instanceof Error ? e.message : String(e);
    }

    if (!extracted || extractionError) {
      await supabase
        .from("patient_lab_uploads")
        .update({
          status: "failed",
          error_message: extractionError || "Extraction failed",
          processing_completed_at: new Date().toISOString(),
        })
        .eq("id", uploadId);

      return new Response(JSON.stringify({ error: extractionError || "Extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine collection_date
    const collectionDate = extracted.meta.collection_date || new Date().toISOString().slice(0, 10);

    // Update upload metadata
    await supabase
      .from("patient_lab_uploads")
      .update({
        source_lab: extracted.meta.source_lab,
        collection_date: collectionDate,
        ordering_provider: extracted.meta.ordering_provider,
        observations_extracted: extracted.observations.length,
      })
      .eq("id", uploadId);

    // Insert observations with deduplication
    let inserted = 0;
    let duplicates = 0;

    for (const obs of extracted.observations) {
      const canonicalName = normalizeAnalyteName(obs.raw_name);

      const { error: insertError } = await supabase
        .from("patient_lab_observations")
        .insert({
          user_id: upload.user_id,
          upload_id: uploadId,
          raw_name: obs.raw_name,
          canonical_name: canonicalName,
          display_name: canonicalName,
          value: obs.value,
          unit: obs.unit,
          ref_low: obs.ref_low,
          ref_high: obs.ref_high,
          flag: obs.flag,
          collection_date: collectionDate,
          source: extracted.meta.source_lab,
        });

      if (insertError) {
        if (insertError.message?.includes("duplicate") || insertError.code === "23505") {
          duplicates++;
        } else {
          console.error("Insert error for observation:", obs.raw_name, insertError);
        }
      } else {
        inserted++;
      }
    }

    // Mark as complete
    await supabase
      .from("patient_lab_uploads")
      .update({
        status: "complete",
        processing_completed_at: new Date().toISOString(),
        observations_inserted: inserted,
        observations_duplicates: duplicates,
      })
      .eq("id", uploadId);

    return new Response(
      JSON.stringify({
        success: true,
        observations_extracted: extracted.observations.length,
        observations_inserted: inserted,
        observations_duplicates: duplicates,
        source_lab: extracted.meta.source_lab,
        collection_date: collectionDate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-lab-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
