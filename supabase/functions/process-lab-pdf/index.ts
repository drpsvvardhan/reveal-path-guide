import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  sha256Bytes,
  verifyPatientIdentity,
  checkContentDuplicate,
  recordRejection,
} from "../_shared/uploadGuards.ts";
import {
  loadOntology,
  formatOntologyForPrompt,
  validateConceptId,
  type Ontology,
} from "../_shared/ontology.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// CANONICAL ANALYTE MAPPING (standard labs)
// ============================================================================

const CANONICAL_MAPPING: Record<string, string> = {
  // Glucose / diabetes
  "glucose": "Glucose", "fasting glucose": "Glucose", "glucose, fasting": "Glucose",
  "blood glucose": "Glucose", "hba1c": "HbA1c", "hemoglobin a1c": "HbA1c",
  "a1c": "HbA1c", "glycohemoglobin": "HbA1c", "insulin": "Insulin",
  "insulin, fasting": "Insulin", "fasting insulin": "Insulin",
  "c-peptide": "C-Peptide", "c peptide": "C-Peptide",
  // Lipid panel
  "total cholesterol": "Total Cholesterol", "cholesterol, total": "Total Cholesterol",
  "cholesterol total": "Total Cholesterol", "ldl": "LDL-C", "ldl-c": "LDL-C",
  "ldl cholesterol": "LDL-C", "ldl, calculated": "LDL-C", "ldl, direct": "LDL-C",
  "hdl": "HDL-C", "hdl-c": "HDL-C", "hdl cholesterol": "HDL-C",
  "triglycerides": "Triglycerides", "trig": "Triglycerides",
  "non-hdl cholesterol": "Non-HDL Cholesterol", "non hdl cholesterol": "Non-HDL Cholesterol",
  "vldl": "VLDL", "apolipoprotein b": "ApoB", "apo b": "ApoB", "apob": "ApoB",
  "lipoprotein(a)": "Lp(a)", "lp(a)": "Lp(a)", "lp a": "Lp(a)",
  // CMP / liver / kidney
  "bun": "BUN", "blood urea nitrogen": "BUN", "urea nitrogen": "BUN",
  "creatinine": "Creatinine", "creatinine, serum": "Creatinine", "egfr": "eGFR",
  "egfr non-african american": "eGFR", "estimated gfr": "eGFR",
  "cystatin c": "Cystatin C", "sodium": "Sodium", "potassium": "Potassium",
  "chloride": "Chloride", "co2": "CO2", "carbon dioxide": "CO2",
  "calcium": "Calcium", "magnesium": "Magnesium", "total protein": "Total Protein",
  "protein, total": "Total Protein", "albumin": "Albumin", "globulin": "Globulin",
  "a/g ratio": "A/G Ratio", "albumin/globulin ratio": "A/G Ratio",
  "ast": "AST", "aspartate aminotransferase": "AST", "sgot": "AST",
  "alt": "ALT", "alanine aminotransferase": "ALT", "sgpt": "ALT",
  "alk phos": "Alkaline Phosphatase", "alkaline phosphatase": "Alkaline Phosphatase",
  "alp": "Alkaline Phosphatase", "ggt": "GGT", "gamma-glutamyl transferase": "GGT",
  "total bilirubin": "Total Bilirubin", "bilirubin, total": "Total Bilirubin",
  "direct bilirubin": "Direct Bilirubin", "bilirubin, direct": "Direct Bilirubin",
  "microalbumin": "Microalbumin", "albumin/creatinine ratio": "Albumin/Creatinine Ratio",
  // CBC
  "wbc": "WBC", "white blood cell count": "WBC", "white blood cells": "WBC",
  "rbc": "RBC", "red blood cell count": "RBC", "red blood cells": "RBC",
  "hemoglobin": "Hemoglobin", "hgb": "Hemoglobin", "hematocrit": "Hematocrit",
  "hct": "Hematocrit", "mcv": "MCV", "mch": "MCH", "mchc": "MCHC",
  "rdw": "RDW", "platelets": "Platelets", "platelet count": "Platelets",
  "mpv": "MPV", "neutrophils": "Neutrophils", "neutrophil percentage": "Neutrophils",
  "lymphocytes": "Lymphocytes", "monocytes": "Monocytes",
  "eosinophils": "Eosinophils", "basophils": "Basophils",
  // Thyroid
  "tsh": "TSH", "thyroid stimulating hormone": "TSH", "free t4": "Free T4",
  "ft4": "Free T4", "t4, free": "Free T4", "free t3": "Free T3", "ft3": "Free T3",
  "t3, free": "Free T3", "reverse t3": "Reverse T3", "rt3": "Reverse T3",
  "tpo antibodies": "TPO Antibodies", "thyroid peroxidase antibodies": "TPO Antibodies",
  "thyroglobulin": "Thyroglobulin",
  // Inflammation
  "crp": "CRP", "c-reactive protein": "CRP", "hs-crp": "hs-CRP",
  "high sensitivity crp": "hs-CRP", "hscrp": "hs-CRP", "esr": "ESR",
  "sedimentation rate": "ESR", "erythrocyte sedimentation rate": "ESR",
  "ferritin": "Ferritin", "fibrinogen": "Fibrinogen", "homocysteine": "Homocysteine",
  // Vitamins / minerals
  "vitamin d": "Vitamin D", "vitamin d, 25-hydroxy": "Vitamin D",
  "25-hydroxyvitamin d": "Vitamin D", "25(oh)d": "Vitamin D",
  "vitamin b12": "Vitamin B12", "b12": "Vitamin B12", "cobalamin": "Vitamin B12",
  "folate": "Folate", "folic acid": "Folate", "iron": "Iron", "iron, serum": "Iron",
  "tibc": "TIBC", "total iron binding capacity": "TIBC",
  "transferrin saturation": "Transferrin Saturation", "transferrin sat": "Transferrin Saturation",
  "transferrin": "Transferrin", "zinc": "Zinc", "selenium": "Selenium",
  // Cardiac
  "troponin": "Troponin", "troponin i": "Troponin", "troponin t": "Troponin",
  "nt-probnp": "NT-proBNP", "bnp": "BNP", "ck-mb": "CK-MB",
  // Hormones
  "testosterone": "Testosterone", "testosterone, total": "Testosterone Total",
  "total testosterone": "Testosterone Total", "free testosterone": "Testosterone Free",
  "testosterone, free": "Testosterone Free", "estradiol": "Estradiol", "e2": "Estradiol",
  "dhea-s": "DHEA-S", "dheas": "DHEA-S", "cortisol": "Cortisol",
  "cortisol, am": "Cortisol", "morning cortisol": "Cortisol",
  "progesterone": "Progesterone", "fsh": "FSH",
  "follicle stimulating hormone": "FSH", "lh": "LH", "luteinizing hormone": "LH",
  "shbg": "SHBG", "sex hormone binding globulin": "SHBG", "prolactin": "Prolactin",
};

function normalizeAnalyteName(rawName: string): string {
  if (!rawName) return rawName;
  const cleaned = rawName.trim().toLowerCase().replace(/\s+/g, " ");
  return CANONICAL_MAPPING[cleaned] || rawName.trim();
}

// ============================================================================
// INBODY CANONICAL NAME MAPPING
// ============================================================================

const INBODY_CANONICAL_NAMES: Record<string, string> = {
  "phase angle - whole body": "phase_angle_whole_body",
  "whole body phase angle": "phase_angle_whole_body",
  "phase angle": "phase_angle_whole_body",
  "visceral fat area": "visceral_fat_area",
  "vfa": "visceral_fat_area",
  "skeletal muscle mass": "skeletal_muscle_mass",
  "smm": "skeletal_muscle_mass",
  "ecw/tbw": "ecw_tbw_ratio",
  "ecw/tbw ratio": "ecw_tbw_ratio",
  "basal metabolic rate": "basal_metabolic_rate",
  "bmr": "basal_metabolic_rate",
  "percent body fat": "body_fat_percent",
  "pbf": "body_fat_percent",
  "body fat percentage": "body_fat_percent",
  "fat free mass": "fat_free_mass",
  "ffm": "fat_free_mass",
  "dry lean mass": "dry_lean_mass",
  "body fat mass": "body_fat_mass",
  "right arm lean mass": "segmental_lean_right_arm",
  "left arm lean mass": "segmental_lean_left_arm",
  "trunk lean mass": "segmental_lean_trunk",
  "right leg lean mass": "segmental_lean_right_leg",
  "left leg lean mass": "segmental_lean_left_leg",
  "right arm ecw/tbw": "segmental_ecw_tbw_right_arm",
  "left arm ecw/tbw": "segmental_ecw_tbw_left_arm",
  "trunk ecw/tbw": "segmental_ecw_tbw_trunk",
  "right leg ecw/tbw": "segmental_ecw_tbw_right_leg",
  "left leg ecw/tbw": "segmental_ecw_tbw_left_leg",
  "impedance 5khz - whole body": "whole_body_impedance_5khz",
  "impedance 50khz - whole body": "whole_body_impedance_50khz",
  "whole body impedance at 5khz": "whole_body_impedance_5khz",
  "whole body impedance at 50khz": "whole_body_impedance_50khz",
};

function normalizeInBodyName(rawName: string): string {
  if (!rawName) return rawName;
  const cleaned = rawName.trim().toLowerCase().replace(/\s+/g, " ");
  return INBODY_CANONICAL_NAMES[cleaned] || rawName.trim();
}

// ============================================================================
// SUPPORTED FILE TYPES
// ============================================================================

const SUPPORTED_MIME_TYPES: Record<string, { mediaType: string; contentType: "document" | "image" }> = {
  "application/pdf": { mediaType: "application/pdf", contentType: "document" },
  "image/jpeg": { mediaType: "image/jpeg", contentType: "image" },
  "image/png": { mediaType: "image/png", contentType: "image" },
  "image/webp": { mediaType: "image/webp", contentType: "image" },
  "image/heic": { mediaType: "image/jpeg", contentType: "image" },
};

function detectMimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", webp: "image/webp", heic: "image/heic",
  };
  return map[ext || ""] || "application/pdf";
}

// ============================================================================
// THE STANDARD EXTRACTION SYSTEM PROMPT
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are a structured data extractor for medical lab reports. You will receive a lab report (as a PDF or photo/image) and must extract every biomarker observation as structured JSON.

Your output must be a single valid JSON object. No preamble. No markdown code fences. No explanation. Just the JSON, starting with { and ending with }.

═══════════════════════════════════════════════════════════════════════════
OUTPUT SCHEMA — EXACT JSON STRUCTURE REQUIRED
═══════════════════════════════════════════════════════════════════════════

{
  "meta": {
    "source_lab": "string — name of the laboratory (Quest Diagnostics, LabCorp, hospital name) or null",
    "collection_date": "string — specimen collection date in ISO format YYYY-MM-DD, or null if not visible",
    "ordering_provider": "string — doctor or clinic name who ordered the labs, or null",
    "patient_name": "string — full patient name exactly as printed on the report, or null",
    "patient_dob": "string — patient date of birth in YYYY-MM-DD if present, or null",
    "patient_mrn": "string — Medical Record Number / Patient ID if present, or null"
  },
  "observations": [
    {
      "raw_name": "string — the test name exactly as it appears on the report (do not normalize)",
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

RULE 2 — RAW NAME EXACTLY AS SHOWN. The raw_name field is the test name exactly as it appears on the report. Do not normalize, do not abbreviate, do not expand. If the report says "Alanine Aminotransferase (ALT)", that's the raw_name. If it says "ALT" alone, that's the raw_name. The system will normalize names afterward.

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

RULE 10 — IMAGES AND PHOTOS. If you receive a photo or image of a lab report (instead of a PDF), apply all the same rules. Read the text from the image carefully. If the image is blurry, tilted, or partially cut off, extract what you can see clearly and skip anything illegible.

If you encounter an empty document, an unreadable scan, or a document that is not a lab report, return:
{ "meta": { "source_lab": null, "collection_date": null, "ordering_provider": null }, "observations": [] }`;

// ============================================================================
// INBODY-SPECIFIC EXTRACTION SYSTEM PROMPT
// ============================================================================

const INBODY_EXTRACTION_SYSTEM_PROMPT = `You are a structured data extractor for InBody body composition analysis reports (InBody 970, InBody 770, InBody S10, or any InBody BWA report). You will receive an InBody report and must extract every measurable output as structured JSON.

Your output must be a single valid JSON object. No preamble. No markdown code fences. No explanation. Just the JSON, starting with { and ending with }.

═══════════════════════════════════════════════════════════════════════════
OUTPUT SCHEMA — EXACT JSON STRUCTURE REQUIRED
═══════════════════════════════════════════════════════════════════════════

{
  "meta": {
    "source_lab": "InBody",
    "collection_date": "string — test date in ISO format YYYY-MM-DD",
    "ordering_provider": null,
    "is_inbody": true,
    "patient_name": "string — full patient name exactly as printed on the report, or null",
    "patient_dob": "string — patient date of birth in YYYY-MM-DD if present, or null",
    "patient_mrn": "string — Member ID / Patient ID if present, or null"
  },
  "observations": [
    {
      "raw_name": "string — the measurement name using these EXACT canonical names (see list below)",
      "value": "number — the numeric result",
      "unit": "string — the unit of measurement",
      "ref_low": "number or null",
      "ref_high": "number or null",
      "flag": "string — 'low', 'normal', 'high', or 'critical'"
    }
  ]
}

═══════════════════════════════════════════════════════════════════════════
CANONICAL MEASUREMENT NAMES — USE THESE EXACT STRINGS
═══════════════════════════════════════════════════════════════════════════

Extract these measurements using EXACTLY these raw_name values:

WHOLE BODY COMPOSITION:
- "Skeletal Muscle Mass" — SMM value (unit: lb or kg)
- "Body Fat Mass" — total body fat mass (unit: lb or kg)
- "Fat Free Mass" — FFM value (unit: lb or kg)
- "Dry Lean Mass" — DLM value (unit: lb or kg)
- "Percent Body Fat" — PBF value (unit: %)
- "Visceral Fat Area" — VFA value (unit: cm²)
- "Basal Metabolic Rate" — BMR value (unit: kcal)
- "ECW/TBW" — whole body ECW/TBW ratio (unit: ratio)
- "Phase Angle - Whole Body" — whole body phase angle at 50kHz (unit: °)

BODY WATER:
- "Total Body Water" — TBW value (unit: lb or kg)
- "Intracellular Water" — ICW value (unit: lb or kg)
- "Extracellular Water" — ECW value (unit: lb or kg)

SEGMENTAL LEAN MASS (from Segmental Lean Analysis section):
- "Right Arm Lean Mass" — right arm lean mass (unit: lb or kg)
- "Left Arm Lean Mass" — left arm lean mass (unit: lb or kg)
- "Trunk Lean Mass" — trunk lean mass (unit: lb or kg)
- "Right Leg Lean Mass" — right leg lean mass (unit: lb or kg)
- "Left Leg Lean Mass" — left leg lean mass (unit: lb or kg)

SEGMENTAL ECW/TBW (from Segmental ECW/TBW Analysis or Segmental Lean Analysis ECW/TBW column):
- "Right Arm ECW/TBW" — (unit: ratio)
- "Left Arm ECW/TBW" — (unit: ratio)
- "Trunk ECW/TBW" — (unit: ratio)
- "Right Leg ECW/TBW" — (unit: ratio)
- "Left Leg ECW/TBW" — (unit: ratio)

SEGMENTAL PHASE ANGLES (if available, from Phase Angle section):
- "Phase Angle - Right Arm" (unit: °)
- "Phase Angle - Left Arm" (unit: °)
- "Phase Angle - Trunk" (unit: °)
- "Phase Angle - Right Leg" (unit: °)
- "Phase Angle - Left Leg" (unit: °)

OBESITY:
- "BMI" — Body Mass Index (unit: kg/m²)
- "Weight" — total weight (unit: lb or kg)

═══════════════════════════════════════════════════════════════════════════
EXTRACTION RULES
═══════════════════════════════════════════════════════════════════════════

RULE 1 — EXTRACT EVERY MEASUREMENT LISTED ABOVE that appears in the report. InBody reports are dense — read every section carefully. The bar charts contain numeric values at their endpoints or labels.

RULE 2 — USE THE EXACT RAW_NAME strings listed above. Do NOT use abbreviations like "SMM" or "PBF" as raw_name. Use the full canonical name.

RULE 3 — REFERENCE RANGES. InBody reports show ranges as bar chart regions. Extract the normal range boundaries when visible. For ECW/TBW, the normal range is 0.360-0.390. For PBF female: 18-28%, male: 10-20%. For VFA: 0-100 cm².

RULE 4 — FLAG DETERMINATION. If a value falls outside its reference range:
  - ECW/TBW > 0.390 → "high"
  - PBF above sex-specific range → "high"
  - VFA > 100 → "high"
  - If the bar chart shows the value in the "over" zone → "high"
  - If in normal zone → "normal"
  - If below normal zone → "low"

RULE 5 — TEST DATE. The test date appears near the top of the report (e.g., "09.01.2026 10:42"). Convert to YYYY-MM-DD format. Note: InBody dates may use DD.MM.YYYY or MM.DD.YYYY format — use context clues to determine the correct parsing.

RULE 6 — SEGMENTAL DATA. The Segmental Lean Analysis table has both lean mass values AND ECW/TBW ratios per segment. Extract BOTH — the lean mass as separate observations AND the per-segment ECW/TBW as separate observations.

RULE 7 — OUTPUT MUST BE VALID JSON. Your entire response is a single JSON object. No preamble. No markdown code fences. No closing comments. Just the JSON.

If you cannot read the report or it is not an InBody report, return:
{ "meta": { "source_lab": null, "collection_date": null, "ordering_provider": null, "is_inbody": false }, "observations": [] }`;

// ============================================================================
// CHUNKED BASE64 ENCODING
// ============================================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

// ============================================================================
// INBODY DETECTION
// ============================================================================

function isInBodyReport(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.includes("inbody") || lower.includes("bwa") || lower.includes("body composition");
}

// ============================================================================
// AI VISION CALL — uses Lovable AI Gateway (supports PDF and images)
// ============================================================================

async function callClaudeWithDocument(base64Data: string, mimeType: string, systemPrompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const typeInfo = SUPPORTED_MIME_TYPES[mimeType] || SUPPORTED_MIME_TYPES["application/pdf"];
  const mediaType = typeInfo.mediaType;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "file",
              file: {
                filename: `document.${mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1] || "jpg"}`,
                file_data: `data:${mediaType};base64,${base64Data}`,
              },
            },
            {
              type: "text",
              text: "Extract all measurements from this report. Return only the JSON object as specified in your instructions.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Gateway error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function extractJsonFromText(text: string): any {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* continue */ }
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)); } catch { /* continue */ }
  }
  throw new Error("Could not extract valid JSON from extraction output");
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
  // NEW — LLM canonicalization fields (v0.9)
  canonical_concept_id: string | null;
  proposed_concept_id: string | null;
  proposed_label: string | null;
  canonical_unit: string | null;
  source_unit_conversion_factor: number | null;
  classification_confidence: number | null;
}

interface ExtractionResult {
  meta: {
    source_lab: string | null;
    collection_date: string | null;
    ordering_provider: string | null;
    is_inbody?: boolean;
    patient_name: string | null;
    patient_dob: string | null;
    patient_mrn: string | null;
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
      is_inbody: raw.meta?.is_inbody === true,
      patient_name: typeof raw.meta?.patient_name === "string" ? raw.meta.patient_name : null,
      patient_dob: typeof raw.meta?.patient_dob === "string" ? raw.meta.patient_dob : null,
      patient_mrn: typeof raw.meta?.patient_mrn === "string" ? raw.meta.patient_mrn : null,
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
      canonical_concept_id: typeof obs.canonical_concept_id === "string" ? obs.canonical_concept_id : null,
      proposed_concept_id: typeof obs.proposed_concept_id === "string" ? obs.proposed_concept_id : null,
      proposed_label: typeof obs.proposed_label === "string" ? obs.proposed_label : null,
      canonical_unit: typeof obs.canonical_unit === "string" ? obs.canonical_unit : null,
      source_unit_conversion_factor: typeof obs.source_unit_conversion_factor === "number" ? obs.source_unit_conversion_factor : null,
      classification_confidence: typeof obs.classification_confidence === "number" ? obs.classification_confidence : null,
    });
  }

  return cleaned;
}

// ============================================================================
// BACKGROUND PROCESSING
// ============================================================================

type IdentityOverride = {
  kind: "unknown_accepted" | "mismatch_overridden";
  confirmed_name: string;
};

// User explicitly confirmed ownership in the pre-upload modal BEFORE we read
// anything off the file. This bypasses both the duplicate guard (because they
// are knowingly re-uploading) and the identity guard (because they have
// asserted, with the contamination warning shown, that the file is theirs).
type PreConfirmed = {
  confirmed_name: string;
};

async function processUpload(
  uploadId: string,
  identityOverride?: IdentityOverride,
  preConfirmed?: PreConfirmed,
) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: upload, error: uploadError } = await supabase
    .from("patient_lab_uploads")
    .select("*")
    .eq("id", uploadId)
    .single();

  if (uploadError || !upload) {
    console.error("Upload not found:", uploadId);
    return;
  }

  // Mark as processing
  await supabase
    .from("patient_lab_uploads")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", uploadId);

  try {
    // Download the file from Supabase Storage with retry + signed URL fallback
    let pdfBytes: Uint8Array | null = null;
    let lastErr: string | null = null;

    for (let attempt = 1; attempt <= 3 && !pdfBytes; attempt++) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("lab-uploads")
          .download(upload.storage_path);
        if (downloadError || !fileData) {
          lastErr = downloadError?.message || "no data";
          throw new Error(lastErr);
        }
        const arrayBuffer = await fileData.arrayBuffer();
        pdfBytes = new Uint8Array(arrayBuffer);
        console.log(`[download] SDK succeeded on attempt ${attempt}, size=${pdfBytes.length}`);
      } catch (e) {
        lastErr = (e as Error).message;
        console.warn(`[download] SDK attempt ${attempt} failed: ${lastErr}`);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }

    // Fallback: use signed URL if SDK download keeps failing
    if (!pdfBytes) {
      console.warn(`[download] SDK exhausted, trying signed URL fallback`);
      const { data: signed, error: signErr } = await supabase.storage
        .from("lab-uploads")
        .createSignedUrl(upload.storage_path, 60);
      if (signErr || !signed?.signedUrl) {
        throw new Error(`Failed to download file from storage: ${lastErr || signErr?.message}`);
      }
      const resp = await fetch(signed.signedUrl);
      if (!resp.ok) {
        throw new Error(`Signed URL download failed: HTTP ${resp.status}`);
      }
      const buf = await resp.arrayBuffer();
      pdfBytes = new Uint8Array(buf);
      console.log(`[download] Signed URL fallback succeeded, size=${pdfBytes.length}`);
    }

    // ------------------------------------------------------------------
    // STEP 2 — Content hash + dedup guard (BEFORE Gemini extraction)
    // ------------------------------------------------------------------
    const contentSha256 = await sha256Bytes(pdfBytes);
    const dedup = await checkContentDuplicate(supabase, upload.user_id, contentSha256);
    if (dedup.isDuplicate && dedup.existingUploadId !== uploadId && !preConfirmed) {
      await recordRejection(supabase, {
        userId: upload.user_id,
        uploadId,
        fileName: upload.original_filename,
        category: "duplicate_content",
        detail: `Identical file already uploaded on ${dedup.uploadedAt}`,
        contentSha256,
      });
      console.log(`Upload ${uploadId} rejected as duplicate of ${dedup.existingUploadId}`);
      return;
    }
    if (dedup.isDuplicate && preConfirmed) {
      console.log(`Upload ${uploadId} duplicate of ${dedup.existingUploadId} but user pre-confirmed re-upload — proceeding.`);
    }
    await supabase
      .from("patient_lab_uploads")
      .update({ content_sha256: contentSha256 })
      .eq("id", uploadId);

    // Slice exactly to the view in case Uint8Array is a view over a larger buffer
    const exactBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const base64Data = arrayBufferToBase64(exactBuffer);
    console.log(`[encode] pdfBytes.length=${pdfBytes.length}, base64.length=${base64Data.length}`);
    const mimeType = detectMimeFromPath(upload.storage_path);

    // Detect if this is an InBody report
    const isInBody = isInBodyReport(upload.original_filename);
    const baseSystemPrompt = isInBody ? INBODY_EXTRACTION_SYSTEM_PROMPT : EXTRACTION_SYSTEM_PROMPT;

    // ------------------------------------------------------------------
    // STEP 2.5 — Load ontology and append canonicalization instructions
    // ------------------------------------------------------------------
    let ontology: Ontology | null = null;
    let systemPrompt = baseSystemPrompt;
    try {
      ontology = await loadOntology(SUPABASE_URL);
      const ontologyBlock = formatOntologyForPrompt(ontology, isInBody ? "inbody" : "lab");
      systemPrompt = baseSystemPrompt + `

═══════════════════════════════════════════════════════════════════════════
CANONICALIZATION — ADDITIONAL REQUIRED FIELDS (v0.9 LLM CANONICALIZATION)
═══════════════════════════════════════════════════════════════════════════

${ontologyBlock}

For EACH observation, in addition to raw_name/value/unit/ref_low/ref_high/flag,
you MUST also include these 6 additional fields:

  "canonical_concept_id": "string — the concept id from the ontology list above, OR 'unknown' if no concept fits",
  "proposed_concept_id": "string — if canonical_concept_id is 'unknown', propose a new id in snake_case (e.g. 'lipid_apoe_epsilon4'), else null",
  "proposed_label": "string — if canonical_concept_id is 'unknown', a human-readable label, else null",
  "canonical_unit": "string — the canonical unit from the ontology entry (just copy it), or null if unknown",
  "source_unit_conversion_factor": "number — multiplicative factor to convert the observation's source unit to canonical unit (1.0 if already canonical, 1000 if 10^3/µL → cells/µL, 100 if ng/mL → ng/dL, etc.)",
  "classification_confidence": "number 0-1 — your confidence that canonical_concept_id is correct. Be conservative. Anything <0.80 goes to human review."

CLASSIFICATION RULES:

RULE C1 — USE ONTOLOGY IDS EXACTLY. canonical_concept_id must be an exact string
from the ontology list, or 'unknown'. Do not invent new ids unless the concept
truly is not in the ontology.

RULE C2 — UNIT CONVERSION. When the source unit differs from the canonical unit,
compute the multiplicative factor that converts source to canonical. Common cases:
  - 10^3/µL or 10³/µL or X 10³/µL → cells/µL: factor 1000
  - ng/mL → ng/dL: factor 100
  - pg/mL → ng/L: factor 1
  - mg/L ↔ mcg/L: factor 1000 (check direction!)
  - mmol/L → mg/dL for glucose: factor 18.0
  When source and canonical units are the same: factor 1.0.
  When uncertain: emit factor 1.0 and set classification_confidence below 0.8.

RULE C3 — ALIASES ARE HINTS, NOT LIMITS. The 'known_aliases' in the ontology
are examples of raw_name strings seen before. If the raw_name you extract is
similar in meaning but spelled differently, still match it to the concept id —
you have world knowledge about biomarker synonyms.

RULE C4 — AMBIGUITY. If an observation could match multiple concepts, pick the
best match and reduce confidence to 0.70. Human review decides.

RULE C5 — SKIP BEFORE FORCING. If you cannot determine a canonical concept at
all with reasonable confidence, set canonical_concept_id to 'unknown' and
propose a new concept in snake_case. Never force a wrong match just to avoid
'unknown'.
`;
      console.log(`Loaded ontology v${ontology.ontology_version} with ${ontology.concepts.length} concepts`);
    } catch (e) {
      console.warn(`Ontology load failed; falling back to non-canonicalized extraction:`, e instanceof Error ? e.message : e);
      ontology = null;
      systemPrompt = baseSystemPrompt;
    }

    console.log(`Processing upload ${uploadId}: isInBody=${isInBody}, filename=${upload.original_filename}, ontology=${ontology ? 'loaded' : 'unavailable'}`);

    // Call Gemini vision with appropriate prompt
    const llmStartedAt = Date.now();
    const rawOutput = await callClaudeWithDocument(base64Data, mimeType, systemPrompt);
    const llmMs = Date.now() - llmStartedAt;
    console.log(`[timing] upload=${uploadId} llm_call_ms=${llmMs} model=google/gemini-3-flash-preview`);

    const parseStartedAt = Date.now();
    const parsed = extractJsonFromText(rawOutput);
    const extracted = validateAndCleanExtraction(parsed);
    console.log(`[timing] upload=${uploadId} parse_ms=${Date.now() - parseStartedAt} observations=${extracted?.observations?.length ?? 0}`);

    if (!extracted) {
      throw new Error("Extracted data did not match expected schema");
    }

    // ------------------------------------------------------------------
    // STEP 3 — Patient identity verification (BEFORE writing observations)
    // ------------------------------------------------------------------
    const extractedPatientName = extracted.meta.patient_name;
    const extractedDob = extracted.meta.patient_dob;
    const extractedMrn = extracted.meta.patient_mrn;

    await supabase.from("patient_lab_uploads").update({
      extracted_patient_name: extractedPatientName,
      extracted_patient_dob: extractedDob,
      extracted_patient_mrn: extractedMrn,
    }).eq("id", uploadId);

    const identity = await verifyPatientIdentity(supabase, upload.user_id, extractedPatientName);

    // Persist score so the UI can show context in the confirmation modal.
    await supabase.from("patient_lab_uploads").update({
      name_match_score: identity.score,
    }).eq("id", uploadId);

    if (preConfirmed) {
      // User said "this is mine" up front. Record their assertion and proceed
      // regardless of name match score. Any mismatch becomes an audit-only
      // signal stored in identity_confirmation_kind = 'pre_upload_confirmed'.
      await supabase.from("patient_lab_uploads").update({
        name_match_status: "confirmed_by_user",
        identity_confirmed_at: new Date().toISOString(),
        identity_confirmed_name: preConfirmed.confirmed_name.trim().slice(0, 200),
        identity_confirmation_kind: "pre_upload_confirmed",
      }).eq("id", uploadId);
    } else if (identityOverride) {
      const validKind =
        identityOverride.kind === "unknown_accepted" ||
        identityOverride.kind === "mismatch_overridden";
      if (!validKind || typeof identityOverride.confirmed_name !== "string" || identityOverride.confirmed_name.trim().length < 2) {
        throw new Error("invalid_identity_override");
      }
      await supabase.from("patient_lab_uploads").update({
        name_match_status: "confirmed_by_user",
        identity_confirmed_at: new Date().toISOString(),
        identity_confirmed_name: identityOverride.confirmed_name.trim(),
        identity_confirmation_kind: identityOverride.kind,
      }).eq("id", uploadId);
    } else if (identity.status === "mismatch") {
      await supabase.from("patient_lab_uploads").update({
        status: "awaiting_identity_confirmation",
        name_match_status: "needs_confirmation_mismatch",
      }).eq("id", uploadId);
      console.log(`Upload ${uploadId} awaiting identity confirmation (mismatch, score=${identity.score})`);
      return;
    } else if (identity.status === "unknown") {
      if (identity.reason === "no_name_extracted") {
        await supabase.from("patient_lab_uploads").update({
          name_match_status: "pending",
        }).eq("id", uploadId);
      } else {
        await supabase.from("patient_lab_uploads").update({
          status: "awaiting_identity_confirmation",
          name_match_status: "needs_confirmation_unknown",
        }).eq("id", uploadId);
        console.log(`Upload ${uploadId} awaiting identity confirmation (unknown: ${identity.reason})`);
        return;
      }
    } else {
      await supabase.from("patient_lab_uploads").update({
        name_match_status: "match",
      }).eq("id", uploadId);
    }

    // ------------------------------------------------------------------
    // STEP 4 — Write observations (now with LLM-canonicalized fields)
    // ------------------------------------------------------------------

    const detectedInBody = isInBody || extracted.meta.is_inbody === true;

    const collectionDate = extracted.meta.collection_date || new Date().toISOString().slice(0, 10);
    const sourceLab = detectedInBody ? "InBody" : extracted.meta.source_lab;

    await supabase
      .from("patient_lab_uploads")
      .update({
        source_lab: sourceLab,
        collection_date: collectionDate,
        ordering_provider: extracted.meta.ordering_provider,
        observations_extracted: extracted.observations.length,
      })
      .eq("id", uploadId);

    let inserted = 0;
    let duplicates = 0;
    let queuedForReview = 0;
    const writeStartedAt = Date.now();

    for (const obs of extracted.observations) {
      const canonicalName = detectedInBody
        ? normalizeInBodyName(obs.raw_name)
        : normalizeAnalyteName(obs.raw_name);

      // Validate the LLM's proposed concept against the ontology.
      const validation = ontology
        ? validateConceptId(ontology, obs.canonical_concept_id)
        : { valid: false } as ReturnType<typeof validateConceptId>;

      const factor = obs.source_unit_conversion_factor ?? 1;
      const confidence = obs.classification_confidence ?? 0;
      const isLowConfidence = confidence < 0.80;

      let writeRow: Record<string, unknown> = {
        user_id: upload.user_id,
        upload_id: uploadId,
        raw_name: obs.raw_name,
        canonical_name: canonicalName,
        display_name: obs.raw_name,
        value: obs.value,
        unit: obs.unit,
        ref_low: obs.ref_low,
        ref_high: obs.ref_high,
        flag: obs.flag,
        collection_date: collectionDate,
        source: sourceLab,
      };

      if (ontology && validation.valid && validation.concept) {
        writeRow = {
          ...writeRow,
          canonical_concept_id: validation.concept.id,
          canonical_unit: validation.concept.unit,
          canonical_value: obs.value != null ? obs.value * factor : null,
          classification_confidence: confidence,
          biomarker_class: validation.concept.biomarker_class,
          classification_method: isLowConfidence ? "pending" : "llm_at_ingest",
        };
      } else if (ontology) {
        // Unknown concept — write with concept='unknown' and queue for review
        writeRow = {
          ...writeRow,
          canonical_concept_id: "unknown",
          canonical_unit: null,
          canonical_value: null,
          classification_confidence: confidence,
          biomarker_class: null,
          classification_method: "pending",
        };
      }
      // If ontology is null (load failure), we write the original row shape
      // and the new canonical_* columns simply remain null.

      const { data: insertedRow, error: insertError } = await supabase
        .from("patient_lab_observations")
        .insert(writeRow)
        .select("id")
        .single();

      if (insertError) {
        if (insertError.message?.includes("duplicate") || insertError.code === "23505") {
          duplicates++;
        } else {
          console.error("Insert error for observation:", obs.raw_name, insertError);
        }
        continue;
      }
      inserted++;

      // Queue low-confidence (but valid concept) for review
      if (ontology && validation.valid && isLowConfidence) {
        const { error: queueErr } = await supabase
          .from("observation_review_queue")
          .insert({
            user_id: upload.user_id,
            upload_id: uploadId,
            observation_id: insertedRow!.id,
            raw_name: obs.raw_name,
            raw_value: obs.value,
            raw_unit: obs.unit,
            proposed_concept_id: obs.canonical_concept_id,
            proposed_concept_label: validation.concept!.label,
            proposed_unit: validation.concept!.unit,
            classification_confidence: confidence,
            reject_reason: "low_confidence",
          });
        if (queueErr) console.error("Review-queue insert (low_confidence) failed:", queueErr);
        else queuedForReview++;
      }

      // Queue unknown concepts for review
      if (ontology && !validation.valid) {
        const { error: queueErr } = await supabase
          .from("observation_review_queue")
          .insert({
            user_id: upload.user_id,
            upload_id: uploadId,
            observation_id: insertedRow!.id,
            raw_name: obs.raw_name,
            raw_value: obs.value,
            raw_unit: obs.unit,
            proposed_concept_id: obs.proposed_concept_id ?? null,
            proposed_concept_label: obs.proposed_label ?? null,
            classification_confidence: confidence,
            reject_reason: "unknown_concept",
          });
        if (queueErr) console.error("Review-queue insert (unknown_concept) failed:", queueErr);
        else queuedForReview++;

        // If the LLM proposed a brand-new concept id, track it as a proposal
        if (obs.proposed_concept_id && obs.proposed_label) {
          const { error: propErr } = await supabase
            .from("ontology_concept_proposals")
            .upsert({
              proposed_concept_id: obs.proposed_concept_id,
              proposed_label: obs.proposed_label,
              proposed_unit: obs.unit,
              first_seen_observation_id: insertedRow!.id,
              example_raw_names: [obs.raw_name],
            }, { onConflict: "proposed_concept_id" });
          if (propErr) console.error("Ontology proposal upsert failed:", propErr);
        }
      }
    }

    const writeMs = Date.now() - writeStartedAt;
    console.log(`[timing] upload=${uploadId} db_write_ms=${writeMs} inserted=${inserted} dup=${duplicates} queued=${queuedForReview}`);
    console.log(`Upload ${uploadId} canonicalization: ${inserted} inserted, ${duplicates} dup, ${queuedForReview} queued for review`);


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

    console.log(`Upload ${uploadId} complete: ${extracted.observations.length} extracted, ${inserted} inserted, ${duplicates} duplicates, isInBody=${detectedInBody}`);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(`Upload ${uploadId} failed:`, errorMessage);

    await supabase
      .from("patient_lab_uploads")
      .update({
        status: "failed",
        error_message: errorMessage,
        processing_completed_at: new Date().toISOString(),
      })
      .eq("id", uploadId);
  }
}

// ============================================================================
// REQUEST HANDLER — returns 202 immediately, processes in background
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { uploadId } = body;
    const identityOverride: IdentityOverride | undefined = body.identity_override;
    const preConfirmedRaw = body.pre_confirmed;
    const preConfirmed: PreConfirmed | undefined =
      preConfirmedRaw && typeof preConfirmedRaw.confirmed_name === "string" && preConfirmedRaw.confirmed_name.trim().length > 0
        ? { confirmed_name: preConfirmedRaw.confirmed_name }
        : undefined;

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

    const { data: upload, error: uploadError } = await supabase
      .from("patient_lab_uploads")
      .select("id, status")
      .eq("id", uploadId)
      .single();

    if (uploadError || !upload) {
      return new Response(JSON.stringify({ error: "Upload not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // @ts-ignore — EdgeRuntime is available in Supabase edge functions
    EdgeRuntime.waitUntil(processUpload(uploadId, identityOverride, preConfirmed));

    return new Response(
      JSON.stringify({ message: "Processing started", uploadId }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-lab-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
