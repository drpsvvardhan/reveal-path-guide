// Using built-in Deno.serve (no remote std import) — std@0.168.0 was returning 500 from the bundler.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  FRAMEWORK_V2,
  TIER_VOCABULARY_LICENSES,
  FORBIDDEN_VOCABULARY_GLOBAL,
  parseProseAndCitations,
  validateProseAgainstClusters,
  stripClusterMarkers,
  buildRetryFeedback,
} from "../_shared/framework_v2.ts";
import type { ClusterTier, VocabularyViolation } from "../_shared/framework_v2.ts";
import { loadPatientContext } from "../_shared/contextLoader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// THE GENERATION SYSTEM PROMPT — Framework v2 with cluster sourcing
// ============================================================================

function buildNarrativeSystemPrompt(clusters: any[]): string {
  const tierVocabLines: string[] = [];
  for (const [tier, license] of Object.entries(TIER_VOCABULARY_LICENSES)) {
    tierVocabLines.push(`- ${tier} tier: Allowed verbs: ${license.allowed_verbs.join(', ')}. Forbidden verbs: ${license.forbidden_verbs.join(', ')}.${license.required_hedging ? ` Required hedging: ${license.required_hedging.join(', ')}.` : ''}`);
  }

  const forbiddenList = FORBIDDEN_VOCABULARY_GLOBAL.map(p => `"${p}"`).join(', ');

  return `You are the Vizzhy Narrative Composer. Your job is to translate structured patient health data into a complete patient-facing narrative that respects the patient's intelligence, explains what the data shows, and points toward agency.

You are NOT a medical advisor. You are NOT making clinical decisions. You are translating structured facts into patient-facing prose. The facts have already been computed deterministically by the rule engine. Your job is narrative synthesis, not clinical judgment.

${FRAMEWORK_V2}

## Cluster sourcing rules

You are writing prose for the patient based on their active cluster set. Each sentence you write in every prose field must be drawn from a specific cluster. At the end of each sentence, append a marker in the form {cluster:<cluster_id>} to indicate the source cluster.

Sentences that do not draw from a single cluster (general framing, transitions, conclusions) may use {cluster:none}. Use {cluster:none} sparingly — most sentences should cite a cluster.

## Active clusters for this patient

${clusters.length > 0 ? JSON.stringify(clusters.map(c => ({
  id: c.id,
  claim: c.claim,
  cluster_kind: c.cluster_kind,
  confidence_tier: c.confidence_tier,
  confidence_score: c.confidence_score,
  coherence_signals: c.coherence_signals,
  missing_evidence: c.missing_evidence,
  tensions_held: c.tensions_held,
})), null, 2) : '(no clusters available — use manifest data directly)'}

## Tier-licensed vocabulary

${tierVocabLines.join('\n')}

## Globally forbidden vocabulary

The following phrases are forbidden regardless of tier: ${forbiddenList}

## Output schema

Your output must be a single JSON object with EXACTLY these fields:

{
  "patientThesis": {
    "title": "string — one sentence, max 100 chars",
    "body": "string — 3-4 sentences expanding the thesis"
  },
  "layerFindings": {
    "blood": "string",
    "sensors": "string",
    "food_log": "string (omit if no data)",
    "symptoms": "string (omit if no data)",
    "vitals": "string (omit if no data)"
  },
  "helpingVsFeeding": {
    "helping": [{ "label": "string", "mechanism": "string" }],
    "feeding": [{ "label": "string", "mechanism": "string" }]
  },
  "symptomBridges": ["string"],
  "reversibility": {
    "weeks": ["string"],
    "months": ["string"],
    "slow": ["string"],
    "permanent": ["string"],
    "closingLine": "string"
  },
  "sequencedActions": {
    "startHere": { "title": "string", "description": "string", "whyFirst": "string" },
    "thenAdd": [{ "title": "string", "description": "string" }],
    "notYet": [{ "title": "string", "description": "string", "why": "string", "unlockedWhen": "string", "unlockedBy": "string" }]
  },
  "expectedProgress": {
    "weeks2": "string",
    "months3": "string",
    "months6": "string",
    "months12": "string"
  },
  "confidenceBreakdown": {
    "confident": ["string"],
    "investigating": ["string"],
    "retest": ["string"]
  }
}

Every prose sentence must end with a {cluster:...} marker. Structured labels (intervention names, axis names, gate identifiers) do NOT need markers.

WRITING RULES:
1. PLAIN LANGUAGE — 8th-grade reading level. Short sentences.
2. GROUND EVERY STATEMENT — trace to data, pattern, or cluster.
3. NEVER MORALIZE — mechanism language, not judgment.
4. PAIR HARD TRUTHS WITH HOPE.
5. HELPING VS FEEDING MUST USE ALL AVAILABLE DATA.
6. SYMPTOM BRIDGES MUST CONNECT TO DATA.
7. REVERSIBILITY TIERS MUST BE REALISTIC.
8. SEQUENCED ACTIONS MUST REFLECT THE DERIVED PATTERNS.
9. EXPECTED PROGRESS MUST BE CALIBRATED.
10. Output only the JSON. No preamble. No markdown code fences.`;
}

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

  if (!obj.layerFindings || typeof obj.layerFindings !== "object") {
    errors.push({ field: "layerFindings", message: "Missing or not an object" });
  }

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

  if (!Array.isArray(obj.symptomBridges)) {
    errors.push({ field: "symptomBridges", message: "Not an array" });
  }

  if (!obj.reversibility || typeof obj.reversibility !== "object") {
    errors.push({ field: "reversibility", message: "Missing or not an object" });
  } else {
    for (const tier of ["weeks", "months", "slow", "permanent"]) {
      if (!Array.isArray(obj.reversibility[tier])) {
        errors.push({ field: `reversibility.${tier}`, message: "Not an array" });
      }
    }
  }

  if (!obj.sequencedActions || typeof obj.sequencedActions !== "object") {
    errors.push({ field: "sequencedActions", message: "Missing or not an object" });
  } else {
    if (!obj.sequencedActions.startHere || typeof obj.sequencedActions.startHere !== "object") {
      errors.push({ field: "sequencedActions.startHere", message: "Missing or not an object" });
    }
    if (!Array.isArray(obj.sequencedActions.thenAdd)) {
      errors.push({ field: "sequencedActions.thenAdd", message: "Not an array" });
    }
    if (!Array.isArray(obj.sequencedActions.notYet)) {
      errors.push({ field: "sequencedActions.notYet", message: "Not an array" });
    }
  }

  if (!obj.expectedProgress || typeof obj.expectedProgress !== "object") {
    errors.push({ field: "expectedProgress", message: "Missing or not an object" });
  } else {
    for (const w of ["weeks2", "months3", "months6", "months12"]) {
      if (typeof obj.expectedProgress[w] !== "string") {
        errors.push({ field: `expectedProgress.${w}`, message: "Missing or not a string" });
      }
    }
  }

  if (!obj.confidenceBreakdown || typeof obj.confidenceBreakdown !== "object") {
    errors.push({ field: "confidenceBreakdown", message: "Missing or not an object" });
  } else {
    for (const c of ["confident", "investigating", "retest"]) {
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

function composeUserMessage(manifest: any, patterns: any[], gateScores?: any[]): string {
  const sections: string[] = [];

  sections.push("PATIENT_CONTEXT:");
  sections.push(
    `Name: ${manifest.patient?.firstName || "unknown"}, Age: ${manifest.patient?.age || "?"}, Sex: ${manifest.patient?.sex || "?"}`
  );

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

  if (gateScores && gateScores.length > 0) {
    sections.push("\nINTAKE GATE SCORES:");
    for (const g of gateScores) {
      sections.push(`- ${g.gate_id} (${g.gate_name}): ${Math.round(g.score)}/100 [${g.traffic_light}] — domains: ${(g.contributing_domains || []).join(", ")}`);
    }
  }

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
  feedbackMessage?: string
): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const messages: any[] = [{ role: "user", content: userMessage }];

  if (feedbackMessage) {
    messages.push({ role: "assistant", content: "{ /* previous attempt */ }" });
    messages.push({ role: "user", content: feedbackMessage });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
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
  return data.content?.[0]?.text || "";
}

function extractJsonFromText(text: string): any {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* continue */ }
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)); } catch { /* continue */ }
  }
  throw new Error("Could not extract valid JSON from LLM output");
}

// ============================================================================
// VOICE VALIDATION HELPERS
// ============================================================================

function extractNarrativeProse(parsed: any): string {
  const parts: string[] = [];

  // patientThesis.body
  if (parsed.patientThesis?.body) parts.push(parsed.patientThesis.body);

  // layerFindings
  if (parsed.layerFindings) {
    for (const val of Object.values(parsed.layerFindings)) {
      if (typeof val === "string" && val.length > 0) parts.push(val);
    }
  }

  // helpingVsFeeding mechanisms
  if (parsed.helpingVsFeeding?.helping) {
    for (const h of parsed.helpingVsFeeding.helping) {
      if (h.mechanism) parts.push(h.mechanism);
    }
  }
  if (parsed.helpingVsFeeding?.feeding) {
    for (const f of parsed.helpingVsFeeding.feeding) {
      if (f.mechanism) parts.push(f.mechanism);
    }
  }

  // symptomBridges
  if (Array.isArray(parsed.symptomBridges)) {
    for (const s of parsed.symptomBridges) {
      if (typeof s === "string" && s.length > 0) parts.push(s);
    }
  }

  // reversibility.closingLine
  if (parsed.reversibility?.closingLine) parts.push(parsed.reversibility.closingLine);

  // expectedProgress
  if (parsed.expectedProgress) {
    for (const val of Object.values(parsed.expectedProgress)) {
      if (typeof val === "string" && val.length > 0) parts.push(val);
    }
  }

  return parts.join("\n\n");
}

function stripMarkersFromNarrative(parsed: any): void {
  // Strip from all string fields recursively
  const stripObj = (obj: any): any => {
    if (typeof obj === "string") return stripClusterMarkers(obj);
    if (Array.isArray(obj)) return obj.map(stripObj);
    if (obj && typeof obj === "object") {
      const result: any = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = stripObj(v);
      }
      return result;
    }
    return obj;
  };

  // Apply to all prose-bearing sections
  const proseKeys = ["patientThesis", "layerFindings", "helpingVsFeeding", "symptomBridges", "reversibility", "sequencedActions", "expectedProgress", "confidenceBreakdown"];
  for (const key of proseKeys) {
    if (parsed[key]) {
      parsed[key] = stripObj(parsed[key]);
    }
  }
}

// ============================================================================
// PERSISTENCE
// ============================================================================

async function persistNarrative(
  supabase: any,
  userId: string,
  narrative: any,
  retryCount: number,
  model: string,
  generationMs: number,
  patternCount: number,
  biomarkerCount: number,
  voiceValidationStatus: string | null,
  voiceValidationWarnings: any[] | null,
  error?: string,
): Promise<{ version: number; id: string } | null> {
  const { data: versionData, error: versionError } = await supabase.rpc("next_narrative_version", {
    p_user_id: userId,
  });

  if (versionError) {
    console.error("Failed to get next version:", versionError);
    return null;
  }

  const version = versionData as number;
  const isSuccess = narrative !== null && !error;

  const { data: inserted, error: insertError } = await supabase
    .from("patient_narratives")
    .insert({
      user_id: userId,
      version,
      narrative: narrative || {},
      model_used: model,
      generation_ms: generationMs,
      input_pattern_count: patternCount,
      input_biomarker_count: biomarkerCount,
      status: isSuccess ? "active" : "failed",
      validation_error: error || null,
      retry_count: retryCount,
      voice_validation_status: voiceValidationStatus,
      voice_validation_warnings: voiceValidationWarnings,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { authenticateRequest, resolveTargetUserId } = await import("../_shared/auth.ts");
    const authResult = await authenticateRequest(req);
    if (!authResult.ok) {
      return new Response(JSON.stringify(authResult.error.body), {
        status: authResult.error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json();
    const { manifest, userId: requestedUserId } = body;
    const resolved = await resolveTargetUserId(authResult.auth, requestedUserId ?? null);
    if (!resolved.ok) {
      return new Response(JSON.stringify(resolved.error.body), {
        status: resolved.error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = resolved.targetUserId;

    if (!manifest) {
      return new Response(JSON.stringify({ error: "No manifest provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // P1a: load patient terrain via the witness-native context loader.
    // All biological values, profile fields, CIE gate scores, and prior
    // patterns flow through this single call. No raw observation /
    // cie_* / derived_patterns / profiles reads remain in this function.
    const witnessContext = await loadPatientContext(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      userId,
    );

    // Patient identity is witness-derived. Caller-supplied manifest.patient
    // fields are kept only as a last-resort fallback for non-biological
    // labels (e.g. firstName when display_name is null).
    manifest.patient = {
      ...(manifest.patient || {}),
      firstName: witnessContext.profile.display_name || manifest.patient?.firstName || "unknown",
      age: witnessContext.profile.age ?? manifest.patient?.age ?? 0,
      sex: witnessContext.profile.sex || manifest.patient?.sex || "unknown",
    };

    // Severity ordering matches the legacy `.order("severity", { ascending: true })`
    // semantics: most-severe first.
    const SEVERITY_RANK: Record<string, number> = {
      critical: 0,
      high: 1,
      moderate: 2,
      informational: 3,
      info: 3,
    };
    const patternList = [...witnessContext.prior_patterns.patterns].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99),
    );

    // Gate scores are witness-backed.
    const gateScoresList = witnessContext.cie.gate_scores.map((g) => ({
      gate_id: g.gate_id,
      gate_name: g.gate_name,
      score: g.score,
      traffic_light: g.traffic_light,
      contributing_domains: g.contributing_domains,
    }));

    // Replace any caller-supplied biomarker timeline with a witness-derived
    // one. Caller-supplied biological values are NOT trusted. Non-biological
    // layout fields (vitalSigns, sensorStreams, symptomsJournal, foodLogSummary)
    // remain caller-controlled.
    const witnessBiomarkerTimeline = [
      ...witnessContext.labs.observations.map((o) => ({
        name: o.canonical_name,
        displayName: o.canonical_name,
        value: o.value,
        unit: o.unit,
        timestamp: o.collection_date,
        refLow: o.ref_low ?? undefined,
        refHigh: o.ref_high ?? undefined,
        flag: o.flag ?? undefined,
        source: o.source ?? undefined,
      })),
      ...witnessContext.inbody.observations.map((o) => ({
        name: o.canonical_name,
        displayName: o.canonical_name,
        value: o.value,
        unit: o.unit,
        timestamp: o.collection_date,
        source: o.source,
      })),
      ...witnessContext.fibroscan.observations.map((o) => ({
        name: o.canonical_name,
        displayName: o.canonical_name,
        value: o.value,
        unit: o.unit,
        timestamp: o.collection_date,
        source: "FibroScan",
      })),
    ];
    manifest.rawData = {
      ...(manifest.rawData || {}),
      biomarkerTimeline: witnessBiomarkerTimeline,
    };
    const biomarkerCount = witnessBiomarkerTimeline.length;

    // Clusters scoped by witness-derived patient_id (was profileData.id).
    const { data: clusterData } = await supabase
      .from("clusters")
      .select("*")
      .eq("patient_id", witnessContext.patient_id)
      .eq("status", "active")
      .order("confidence_score", { ascending: false });
    const clusters = clusterData || [];

    // Build cluster tier map
    const clusterTierMap = new Map<string, ClusterTier>();
    for (const c of clusters) {
      clusterTierMap.set(c.id, c.confidence_tier as ClusterTier);
    }

    // Build system prompt with cluster context
    const systemPrompt = buildNarrativeSystemPrompt(clusters);
    const userMessage = composeUserMessage(manifest, patternList, gateScoresList);

    // Generation with voice validation
    const MAX_RETRIES = 3;
    const startTime = Date.now();
    let parsed: any = null;
    let lastStructuralError: string | undefined;
    let lastViolations: VocabularyViolation[] = [];
    let feedbackMessage: string | undefined;
    let voiceValidationStatus: string | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      retryCount = attempt;
      try {
        const rawOutput = await callAnthropicForJson(userMessage, systemPrompt, feedbackMessage);
        parsed = extractJsonFromText(rawOutput);

        // Structural validation
        const structValidation = validateNarrative(parsed);
        if (!structValidation.valid) {
          lastStructuralError = structValidation.errors.map(e => `${e.field}: ${e.message}`).join("; ");
          feedbackMessage = `Your previous output had structural validation errors:\n\n${lastStructuralError}\n\nPlease produce a new JSON object that fixes these errors. Output only the JSON.`;
          parsed = null;
          console.log(`Attempt ${attempt + 1} structural validation failed: ${lastStructuralError}`);
          continue;
        }

        // Voice validation
        if (clusters.length > 0) {
          const narrativeProse = extractNarrativeProse(parsed);
          const { sentenceToClusterMap } = parseProseAndCitations(narrativeProse);
          const voiceResult = validateProseAgainstClusters(narrativeProse, clusterTierMap, sentenceToClusterMap);

          if (voiceResult.valid) {
            stripMarkersFromNarrative(parsed);
            voiceValidationStatus = "passed";
            lastViolations = [];
            break;
          }

          lastViolations = voiceResult.violations;
          feedbackMessage = buildRetryFeedback(voiceResult.violations);
          console.log(`Attempt ${attempt + 1} voice validation failed: ${voiceResult.violations.length} violations`);
        } else {
          voiceValidationStatus = "passed";
          break;
        }
      } catch (e) {
        lastStructuralError = e instanceof Error ? e.message : String(e);
        feedbackMessage = `Your previous output had errors:\n\n${lastStructuralError}\n\nPlease produce a corrected JSON object.`;
        parsed = null;
        console.error(`Attempt ${attempt + 1} threw:`, lastStructuralError);
      }
    }

    const generationMs = Date.now() - startTime;

    // If we have a valid parse but voice validation failed
    if (parsed && !voiceValidationStatus && lastViolations.length > 0) {
      stripMarkersFromNarrative(parsed);
      voiceValidationStatus = "failed_with_warnings";
    }

    // Persist
    const persisted = await persistNarrative(
      supabase,
      userId,
      parsed,
      retryCount,
      "claude-sonnet-4-5",
      generationMs,
      patternList.length,
      biomarkerCount,
      voiceValidationStatus,
      lastViolations.length > 0 ? lastViolations : null,
      parsed ? undefined : (lastStructuralError || "Generation failed after all retries"),
    );

    if (!persisted) {
      return new Response(
        JSON.stringify({ error: "Failed to persist narrative" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!parsed) {
      return new Response(
        JSON.stringify({
          success: false,
          version: persisted.version,
          validation_error: lastStructuralError,
          retry_count: retryCount,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: persisted.version,
        generation_ms: generationMs,
        retry_count: retryCount,
        voice_validation_status: voiceValidationStatus,
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
