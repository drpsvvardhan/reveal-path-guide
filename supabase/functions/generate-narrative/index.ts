import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// THE GENERATION SYSTEM PROMPT
// ============================================================================

const NARRATIVE_SYSTEM_PROMPT = `You are the Vizzhy Narrative Composer. Your job is to translate structured patient health data into a complete patient-facing narrative that respects the patient's intelligence, explains what the data shows, and points toward agency.

You are NOT a medical advisor. You are NOT making clinical decisions. You are translating structured facts (raw biomarker values, sensor data, computed patterns) into patient-facing prose. The facts have already been computed deterministically by the rule engine. Your job is narrative synthesis, not clinical judgment.

═══════════════════════════════════════════════════════════════════════════
THE CORE PRINCIPLE
═══════════════════════════════════════════════════════════════════════════

You produce a single JSON object that matches the exact schema specified below. No preamble, no apology, no markdown formatting around the JSON. Just the JSON object, starting with { and ending with }.

The JSON must validate against the schema. If you produce invalid JSON, the pipeline will retry and tell you what was wrong.

═══════════════════════════════════════════════════════════════════════════
INPUTS YOU WILL RECEIVE
═══════════════════════════════════════════════════════════════════════════

You will receive the following inputs in the user message:

1. PATIENT_CONTEXT: basic patient identity (name, age, sex)
2. STUDY_OVERVIEW: what data layers were analyzed
3. RAW_DATA: biomarker timeline, vital signs, sensor streams, symptoms journal, food log
4. DERIVED_PATTERNS: structured patterns already detected by the rule engine
5. CURRENT_MEDICATIONS: what the patient is already taking

You must ground EVERY statement in your output in one of these inputs. Never invent a fact the inputs don't contain. Never extrapolate beyond what the data shows.

═══════════════════════════════════════════════════════════════════════════
OUTPUT SCHEMA — EXACT JSON STRUCTURE REQUIRED
═══════════════════════════════════════════════════════════════════════════

Your output must be a single JSON object with EXACTLY these fields and types:

{
  "patientThesis": {
    "title": "string — one sentence, max 100 chars, the core story in plain language",
    "body": "string — 3-4 sentences expanding the thesis, ending with something hopeful grounded in what can change"
  },
  "layerFindings": {
    "blood": "string — one sentence about what the blood work showed",
    "sensors": "string — one sentence about what the wearable/sensor data showed",
    "food_log": "string — one sentence about what the food log revealed (omit if no food log data)",
    "symptoms": "string — one sentence about what the symptom journal showed (omit if no symptoms data)",
    "vitals": "string — one sentence about what the blood pressure / weight / BMI showed (omit if no vitals)"
  },
  "helpingVsFeeding": {
    "helping": [
      {
        "label": "string — name of the intervention",
        "mechanism": "string — one sentence explaining what it's doing"
      }
    ],
    "feeding": [
      {
        "label": "string — name of the driver (behavior, situation, untreated factor)",
        "mechanism": "string — one sentence explaining how it drives the problem, using lever/mechanism language NOT blame language"
      }
    ]
  },
  "symptomBridges": [
    "string — one sentence connecting a feeling/symptom to what the data shows, format: 'The [symptom] you mentioned is likely connected to [finding from data]'"
  ],
  "reversibility": {
    "weeks": ["string — thing that can improve in weeks"],
    "months": ["string — thing that can improve in months"],
    "slow": ["string — thing that changes slowly but is worth the effort"],
    "permanent": ["string — thing we work around because it's harder to reverse"],
    "closingLine": "string — optional one-sentence summary of reversibility"
  },
  "sequencedActions": {
    "startHere": {
      "title": "string — the single most important action",
      "description": "string — one sentence explaining why this one first",
      "whyFirst": "string — optional, deeper explanation of why this action unlocks others"
    },
    "thenAdd": [
      {
        "title": "string",
        "description": "string"
      }
    ],
    "notYet": [
      {
        "title": "string",
        "description": "string",
        "why": "string — why this is on hold (framed as protection, not denial)",
        "unlockedWhen": "string — what condition unlocks this",
        "unlockedBy": "string — 'patient' or 'doctor'"
      }
    ]
  },
  "expectedProgress": {
    "weeks2": "string — what should improve in the first 2 weeks",
    "months3": "string — what should improve by 3 months",
    "months6": "string — what should improve by 6 months",
    "months12": "string — what should improve by 12 months"
  },
  "confidenceBreakdown": {
    "confident": ["string — thing we're confident about"],
    "investigating": ["string — thing we're still investigating"],
    "retest": ["string — thing we're watching more closely"]
  }
}

═══════════════════════════════════════════════════════════════════════════
WRITING RULES
═══════════════════════════════════════════════════════════════════════════

RULE 1 — PLAIN LANGUAGE. 8th-grade reading level. Short sentences. No jargon without immediate definition.

RULE 2 — GROUND EVERY STATEMENT. Every claim in your output must trace back to either the raw data, a derived pattern, or a medication. Don't invent. Don't extrapolate. If the data doesn't show something, don't say it.

RULE 3 — NEVER MORALIZE. When describing behaviors that feed the problem (sugar, late meals, alcohol, sedentary patterns), use mechanism language, not judgment. Never use: excessive, poor, unhealthy, bad, failing to. Instead use: pattern of, feeding, lever, working against, opportunity.

RULE 4 — PAIR HARD TRUTHS WITH HOPE. The thesis body must end with something grounded in what can change. The confidence breakdown frames uncertainty as active attention, not as doubt.

RULE 5 — HELPING VS FEEDING MUST USE DERIVED PATTERNS. The "feeding" list should be populated from the correlation and contradiction patterns in the derived_patterns input. The "helping" list should be populated from the current medications. Do not invent drivers that aren't in the data.

RULE 6 — SYMPTOM BRIDGES MUST CONNECT TO DATA. Only include bridges where the symptoms journal has an entry AND the data has a finding that connects to it. Don't fabricate symptoms the patient didn't report.

RULE 7 — REVERSIBILITY TIERS MUST BE REALISTIC. "Weeks" tier is things that respond to immediate behavioral change (sleep quality, glucose spikes, HRV). "Months" tier is deeper biology (inflammation markers, HbA1c, gut balance). "Slow" tier is 6-12 month changes (epigenetics, muscle mass, cardiovascular remodeling). "Permanent" is things like old surgical changes, genetic variants, prior structural damage.

RULE 8 — SEQUENCED ACTIONS MUST REFLECT THE DERIVED PATTERNS. The "startHere" action should address the highest-severity pattern or the pattern with the strongest behavioral lever. "Not yet" items should be framed as protection (waiting for a test, waiting for a baseline, waiting for another factor to stabilize) not as denial.

RULE 9 — EXPECTED PROGRESS MUST BE CALIBRATED. Don't promise changes the data doesn't support. If the patient has a stubborn pattern, the progress timeline should reflect that realistically. Better to under-promise and over-deliver than the reverse.

RULE 10 — NO JSON IN THE OUTPUT OUTSIDE THE SCHEMA. Do not include explanations, commentary, or preamble. The output is a single JSON object and nothing else.

═══════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT — ABSOLUTELY CRITICAL
═══════════════════════════════════════════════════════════════════════════

Your entire response must be a single valid JSON object. It must start with { and end with }. No markdown code fences. No "Here is the narrative:" preamble. No explanations. Just the JSON.

If you cannot produce valid JSON that matches the schema, produce the most faithful approximation you can — the validator will tell you what's wrong and give you another chance.`;

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationError {
  field: string;
  message: string;
}

function validateNarrative(obj: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!obj || typeof obj !== "object") {
    return { valid: false, errors: [{ field: "root", message: "Output is not a JSON object" }] };
  }

  // patientThesis
  if (!obj.patientThesis || typeof obj.patientThesis !== "object") {
    errors.push({ field: "patientThesis", message: "Missing or not an object" });
  } else {
    if (typeof obj.patientThesis.title !== "string" || !obj.patientThesis.title.trim()) {
      errors.push({ field: "patientThesis.title", message: "Missing or empty string" });
    }
    if (typeof obj.patientThesis.body !== "string" || !obj.patientThesis.body.trim()) {
      errors.push({ field: "patientThesis.body", message: "Missing or empty string" });
    }
  }

  // layerFindings
  if (!obj.layerFindings || typeof obj.layerFindings !== "object") {
    errors.push({ field: "layerFindings", message: "Missing or not an object" });
  }

  // helpingVsFeeding
  if (!obj.helpingVsFeeding || typeof obj.helpingVsFeeding !== "object") {
    errors.push({ field: "helpingVsFeeding", message: "Missing or not an object" });
  } else {
    if (!Array.isArray(obj.helpingVsFeeding.helping)) {
      errors.push({ field: "helpingVsFeeding.helping", message: "Not an array" });
    }
    if (!Array.isArray(obj.helpingVsFeeding.feeding)) {
      errors.push({ field: "helpingVsFeeding.feeding", message: "Not an array" });
    }
  }

  // symptomBridges
  if (!Array.isArray(obj.symptomBridges)) {
    errors.push({ field: "symptomBridges", message: "Not an array" });
  }

  // reversibility
  if (!obj.reversibility || typeof obj.reversibility !== "object") {
    errors.push({ field: "reversibility", message: "Missing or not an object" });
  } else {
    const tiers = ["weeks", "months", "slow", "permanent"];
    for (const tier of tiers) {
      if (!Array.isArray(obj.reversibility[tier])) {
        errors.push({ field: `reversibility.${tier}`, message: "Not an array" });
      }
    }
  }

  // sequencedActions
  if (!obj.sequencedActions || typeof obj.sequencedActions !== "object") {
    errors.push({ field: "sequencedActions", message: "Missing or not an object" });
  } else {
    if (!obj.sequencedActions.startHere || typeof obj.sequencedActions.startHere !== "object") {
      errors.push({ field: "sequencedActions.startHere", message: "Missing or not an object" });
    } else {
      if (typeof obj.sequencedActions.startHere.title !== "string") {
        errors.push({ field: "sequencedActions.startHere.title", message: "Missing or not a string" });
      }
      if (typeof obj.sequencedActions.startHere.description !== "string") {
        errors.push({ field: "sequencedActions.startHere.description", message: "Missing or not a string" });
      }
    }
    if (!Array.isArray(obj.sequencedActions.thenAdd)) {
      errors.push({ field: "sequencedActions.thenAdd", message: "Not an array" });
    }
    if (!Array.isArray(obj.sequencedActions.notYet)) {
      errors.push({ field: "sequencedActions.notYet", message: "Not an array" });
    }
  }

  // expectedProgress
  if (!obj.expectedProgress || typeof obj.expectedProgress !== "object") {
    errors.push({ field: "expectedProgress", message: "Missing or not an object" });
  } else {
    const windows = ["weeks2", "months3", "months6", "months12"];
    for (const w of windows) {
      if (typeof obj.expectedProgress[w] !== "string") {
        errors.push({ field: `expectedProgress.${w}`, message: "Missing or not a string" });
      }
    }
  }

  // confidenceBreakdown
  if (!obj.confidenceBreakdown || typeof obj.confidenceBreakdown !== "object") {
    errors.push({ field: "confidenceBreakdown", message: "Missing or not an object" });
  } else {
    const cats = ["confident", "investigating", "retest"];
    for (const c of cats) {
      if (!Array.isArray(obj.confidenceBreakdown[c])) {
        errors.push({ field: `confidenceBreakdown.${c}`, message: "Not an array" });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// INPUT COMPOSITION
// ============================================================================

function composeUserMessage(manifest: any, patterns: any[]): string {
  const sections: string[] = [];

  // Patient context
  sections.push("PATIENT_CONTEXT:");
  sections.push(
    `Name: ${manifest.patient?.firstName || "unknown"}, Age: ${manifest.patient?.age || "?"}, Sex: ${manifest.patient?.sex || "?"}`
  );

  // Study overview
  sections.push("\nSTUDY_OVERVIEW:");
  if (manifest.studyOverview) {
    sections.push(manifest.studyOverview.summary || "");
    sections.push(manifest.studyOverview.statLine || "");
    if (manifest.studyOverview.layers) {
      sections.push("Data layers analyzed:");
      for (const layer of manifest.studyOverview.layers) {
        sections.push(`  - ${layer.title}: ${layer.description}`);
      }
    }
  }

  // Raw data
  const raw = manifest.rawData || {};
  sections.push("\nRAW_DATA:");

  if (raw.biomarkerTimeline && raw.biomarkerTimeline.length > 0) {
    sections.push("Biomarker timeline:");
    for (const obs of raw.biomarkerTimeline) {
      sections.push(
        `  - ${obs.timestamp?.slice(0, 10)} | ${obs.name}: ${obs.value} ${obs.unit}${obs.flag ? ` [${obs.flag}]` : ""}${obs.refLow != null && obs.refHigh != null ? ` (normal: ${obs.refLow}-${obs.refHigh})` : ""}`
      );
    }
  }

  if (raw.vitalSigns && raw.vitalSigns.length > 0) {
    sections.push("Vital signs:");
    for (const v of raw.vitalSigns) {
      sections.push(`  - ${v.timestamp?.slice(0, 10)} | ${v.type}: ${v.value}`);
    }
  }

  if (raw.sensorStreams && raw.sensorStreams.length > 0) {
    sections.push("Sensor streams (wearable data):");
    for (const s of raw.sensorStreams) {
      const parts = [];
      if (s.sleep_hours != null) parts.push(`sleep ${s.sleep_hours}h`);
      if (s.hrv_ms != null) parts.push(`HRV ${s.hrv_ms}ms`);
      if (s.resting_hr != null) parts.push(`RHR ${s.resting_hr}`);
      if (s.spo2_mean != null) parts.push(`SpO2 ${s.spo2_mean}%`);
      sections.push(`  - ${s.date}: ${parts.join(", ")}`);
    }
  }

  if (raw.symptomsJournal && raw.symptomsJournal.length > 0) {
    sections.push("Symptoms journal:");
    for (const e of raw.symptomsJournal) {
      sections.push(
        `  - ${e.date} | ${e.symptom}: severity ${e.severity}${e.notes ? ` — ${e.notes}` : ""}`
      );
    }
  }

  if (raw.foodLogSummary && raw.foodLogSummary.length > 0) {
    sections.push("Food log (daily summaries):");
    for (const f of raw.foodLogSummary) {
      const parts = [];
      if (f.total_calories != null) parts.push(`${f.total_calories} kcal`);
      if (f.sugar_grams != null) parts.push(`${f.sugar_grams}g sugar`);
      if (f.protein_grams != null) parts.push(`${f.protein_grams}g protein`);
      if (f.alcohol_drinks != null && f.alcohol_drinks > 0) parts.push(`${f.alcohol_drinks} drinks`);
      if (f.late_meal) parts.push("late meal");
      sections.push(`  - ${f.date}: ${parts.join(", ")}`);
    }
  }

  // Derived patterns
  sections.push("\nDERIVED_PATTERNS:");
  if (patterns.length === 0) {
    sections.push("(no patterns detected yet)");
  } else {
    for (const p of patterns) {
      sections.push(`- [${p.severity.toUpperCase()}] ${p.category}: ${p.title}`);
      sections.push(`  ${p.summary}`);
      if (p.evidence?.description) {
        sections.push(`  Evidence: ${p.evidence.description}`);
      }
    }
  }

  // CIE gate scores (injected separately for narrative weaving)
  if (gateScores && gateScores.length > 0) {
    sections.push("\nINTAKE GATE SCORES:");
    for (const g of gateScores) {
      sections.push(`- ${g.gate_id} (${g.gate_name}): ${Math.round(g.score)}/100 [${g.traffic_light}] — domains: ${(g.contributing_domains || []).join(", ")}`);
    }
    sections.push("(Weave gate-derived findings into the thesis and terrain analysis when these scores are present.)");
  }

  // Current medications
  sections.push("\nCURRENT_MEDICATIONS:");
  const meds = manifest.careMap?.medications || [];
  if (meds.length === 0) {
    sections.push("(none on file)");
  } else {
    for (const m of meds) {
      sections.push(`- ${m.name}${m.dose ? ` (${m.dose})` : ""}: ${m.purpose || ""}`);
    }
  }

  sections.push("\nNow produce the narrative JSON object following the schema above. Output only the JSON, nothing else.");

  return sections.join("\n");
}

// ============================================================================
// LLM CALL WITH RETRY
// ============================================================================

async function callAnthropicForJson(
  userMessage: string,
  systemPrompt: string,
  previousError?: string
): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const messages: any[] = [{ role: "user", content: userMessage }];

  if (previousError) {
    messages.push({
      role: "assistant",
      content: "{ /* previous attempt had errors */ }",
    });
    messages.push({
      role: "user",
      content: `Your previous output had the following validation errors:\n\n${previousError}\n\nPlease produce a new JSON object that fixes these errors. Output only the JSON, nothing else.`,
    });
  }

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
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  return text;
}

function extractJsonFromText(text: string): any {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code fences if present
    const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]);
      } catch {
        // fall through
      }
    }
    // Try finding the first { and last } and parsing between
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        // fall through
      }
    }
    throw new Error("Could not extract valid JSON from LLM output");
  }
}

async function generateWithRetry(
  manifest: any,
  patterns: any[],
  maxRetries: number = 2
): Promise<{ narrative: any; retryCount: number; model: string; generationMs: number; error?: string }> {
  const startTime = Date.now();
  const userMessage = composeUserMessage(manifest, patterns);
  let previousError: string | undefined = undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const rawOutput = await callAnthropicForJson(userMessage, NARRATIVE_SYSTEM_PROMPT, previousError);
      const parsed = extractJsonFromText(rawOutput);
      const validation = validateNarrative(parsed);

      if (validation.valid) {
        return {
          narrative: parsed,
          retryCount: attempt,
          model: "claude-sonnet-4-20250514",
          generationMs: Date.now() - startTime,
        };
      }

      // Validation failed — compose error message for next retry
      previousError = validation.errors
        .map((e) => `  - ${e.field}: ${e.message}`)
        .join("\n");
      console.log(`Attempt ${attempt + 1} failed validation:\n${previousError}`);
    } catch (e) {
      previousError = e instanceof Error ? e.message : String(e);
      console.error(`Attempt ${attempt + 1} threw:`, previousError);
    }
  }

  // All retries exhausted
  return {
    narrative: null,
    retryCount: maxRetries + 1,
    model: "claude-sonnet-4-20250514",
    generationMs: Date.now() - startTime,
    error: previousError || "Generation failed after all retries",
  };
}

// ============================================================================
// PERSISTENCE
// ============================================================================

async function persistNarrative(
  supabase: any,
  userId: string,
  result: Awaited<ReturnType<typeof generateWithRetry>>,
  patternCount: number,
  biomarkerCount: number
): Promise<{ version: number; id: string } | null> {
  // Get next version number atomically
  const { data: versionData, error: versionError } = await supabase.rpc("next_narrative_version", {
    p_user_id: userId,
  });

  if (versionError) {
    console.error("Failed to get next version:", versionError);
    return null;
  }

  const version = versionData as number;
  const isSuccess = result.narrative !== null && !result.error;

  const { data: inserted, error: insertError } = await supabase
    .from("patient_narratives")
    .insert({
      user_id: userId,
      version,
      narrative: result.narrative || {},
      model_used: result.model,
      generation_ms: result.generationMs,
      input_pattern_count: patternCount,
      input_biomarker_count: biomarkerCount,
      status: isSuccess ? "active" : "failed",
      validation_error: result.error || null,
      retry_count: result.retryCount,
    })
    .select("id, version")
    .single();

  if (insertError) {
    console.error("Failed to insert narrative:", insertError);
    return null;
  }

  return { version: inserted.version, id: inserted.id };
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { manifest, userId } = body;

    if (!manifest) {
      return new Response(JSON.stringify({ error: "No manifest provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "No userId provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Fetch the patient's active derived patterns
    const { data: patterns, error: patternError } = await supabase
      .from("derived_patterns")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("severity", { ascending: true });

    if (patternError) {
      console.error("Failed to fetch patterns:", patternError);
      return new Response(JSON.stringify({ error: "Could not fetch derived patterns" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patternList = patterns || [];
    const biomarkerCount = manifest.rawData?.biomarkerTimeline?.length || 0;

    // Run generation with retry
    const result = await generateWithRetry(manifest, patternList, 2);

    // Persist the result (success or failure)
    const persisted = await persistNarrative(supabase, userId, result, patternList.length, biomarkerCount);

    if (!persisted) {
      return new Response(
        JSON.stringify({ error: "Failed to persist narrative" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result.error) {
      return new Response(
        JSON.stringify({
          success: false,
          version: persisted.version,
          validation_error: result.error,
          retry_count: result.retryCount,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: persisted.version,
        generation_ms: result.generationMs,
        retry_count: result.retryCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-narrative error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
