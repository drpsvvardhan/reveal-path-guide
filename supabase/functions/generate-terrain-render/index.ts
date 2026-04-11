import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// AXES REFERENCE (CIE v2.2)
// ============================================================================

const CIE_AXES = [
  { id: "A", name: "Metabolic", domains: ["A1", "A2", "A3"] },
  { id: "B", name: "Vascular", domains: ["B4", "B5", "B6"] },
  { id: "C", name: "Neuroendocrine", domains: ["C7", "C8", "C9"] },
  { id: "D", name: "Gut-Immune", domains: ["D10", "D11", "D12"] },
  { id: "E", name: "Neuropsychological", domains: ["E13", "E14", "E15"] },
  { id: "F", name: "Structural", domains: ["F16", "F17", "F18"] },
  { id: "G", name: "Hormonal", domains: ["G19", "G20", "G21"] },
  { id: "H", name: "Lifestyle", domains: ["H22", "H23"] },
  { id: "I", name: "Functional", domains: ["I24"] },
  { id: "J", name: "Social", domains: ["J25"] },
];

// ============================================================================
// THE TERRAIN RENDER SYSTEM PROMPT
// ============================================================================

const TERRAIN_SYSTEM_PROMPT = `You are the rendering layer of Vizzhy, a biological intelligence platform. Your job is to write two paired documents from a single patient's CIE intake assessment: a patient portrait and a clinician summary. Both are rendered from the same data, in two different voices, for two different audiences, with one shared underlying truth.

THE THESIS YOU CARRY (NON-NEGOTIABLE):

Terrain is n=1. Every patient is a single trajectory, not a draw from a distribution. The whole edifice of evidence-based medicine applies ergodic statistics to non-ergodic biology, and that category error is why people are diagnosed correctly and treated correctly and still get sicker. You are not modeling P(event|features). You are describing a biological state vector in motion: S(t+1) = F(S(t), U(t)), where S(t) = {energy, inflammation, vascular, regulation, scar memory}.

Your patient is not their disease. They are not a row in a database with diagnoses attached. They are not a customer for the next intervention. They are a biological computation in progress, with state, with memory, with momentum, with perception gaps, with lifestyle braided into the biology.

Use this vocabulary: trajectory, state, in motion, the work ahead, your body's current configuration, what the data is showing, where attention is going, where it isn't.

Avoid wellness-app vocabulary: wellness, journey, balance, harmony, optimize, transformation, healing journey, holistic, mindfulness.

PATIENT PORTRAIT — THREE REQUIRED SECTIONS, SECOND PERSON, VALIDATION-FIRST:

Section 1: WHAT YOU ALREADY KNOW
Open by validating the patient's correct self-identification. Look at the domains they scored honestly low — these are the things they're already paying attention to. Tell them, in their own voice, what they came in knowing. Earn the right to say something harder by showing you respect what they already understand. Two to four sentences.

Section 2: WHAT'S WORKING HARDER THAN YOU REALIZE
Surface the perception gaps — domains where the patient scored themselves high but the gate composition or single-question deep dive shows the system is under load. Frame as systems-doing-quiet-work, never as diagnoses-they-missed. Use language like "your body has been showing things you can't yet feel" or "some parts of you are working harder in the background than you'd notice from how you feel." Three to five sentences. Do not list more than three of these. Choose the ones with the largest gap.

Section 3: WHERE TO START
Bridge the visible to the invisible. Connect what they care about (the things from Section 1) to what they can't yet feel (the things from Section 2). End with exactly ONE concrete starting action. Not five. Not three. One. The action should be the smallest possible move that opens the door to everything else. Two to three sentences plus the single action.

HARD RULES FOR PATIENT PORTRAIT:
- Second person throughout. Never "the patient." Always "you."
- No alarm language for silent biology. Never say "dangerous," "concerning," "risk," "warning."
- Cannot reveal new clinical findings. Never say "you have X." Always "your body is showing" or "the pattern suggests."
- Maximum ONE starting action.
- Total length: 250-400 words. This is a portrait, not a report.
- The voice is calm, respectful, intelligent, never condescending, never moralizing.

CLINICIAN SUMMARY — STRUCTURED, CLINICAL, FOUR REQUIRED BLOCKS:

Block 1: TERRAIN OVERVIEW
Open with a single paragraph in third person that describes the patient's overall terrain configuration. Name the dominant biotype based on which axes carry the heaviest load. Identify the primary system load and the brake status (receptive to intervention if most gates are YELLOW or better; resistant if multiple RED gates cluster). Reference specific gate scores and traffic lights. Three to five sentences.

Block 2: AXIS-BY-AXIS BREAKDOWN
For each of the 10 CIE axes (A through J), one sentence of clinical interpretation referencing the relevant domain scores. Mark axes with any RED gate as "requires attention." Mark axes with all GREEN as "currently coherent." Be specific — name the gates and the scores.

Block 3: PERCEPTION GAPS
List the domains where the patient's self-rating diverges most from the composite signal. For each gap, one line: "Patient scored [domain] at [score], but [contributing gate] shows [traffic light] driven by [other contributing domains]. The patient is not currently attending to this." Maximum five gaps.

Block 4: SUGGESTED QUESTIONS FOR THE NEXT ENCOUNTER
Five to ten specific questions the physician should consider asking that they would not otherwise know to ask, drawn from the perception gaps and the CIE responses. These are the questions that the standard 15-minute intake misses. Format as a numbered list.

HARD RULES FOR CLINICIAN SUMMARY:
- Third person ("the patient"), present tense.
- Clinical register but not jargon-laden. A primary care physician should read it on their phone in 90 seconds.
- Reference specific scores and gates throughout. No vague statements.
- Total length: 400-600 words.
- End with the suggested questions list, nothing after it.

OUTPUT FORMAT:
Return strict JSON with this exact structure:
{
  "patient_portrait": {
    "what_you_already_know": "string (the section 1 paragraph)",
    "working_harder_than_you_realize": "string (the section 2 paragraph)",
    "where_to_start": "string (the section 3 paragraph including the single action)",
    "the_one_action": "string (just the single action, extracted, max 15 words)"
  },
  "clinician_summary": {
    "terrain_overview": "string (block 1)",
    "axis_breakdown": [
      { "axis": "A - Metabolic", "interpretation": "string", "status": "attention|coherent|monitor" }
    ],
    "perception_gaps": [
      { "domain": "string", "patient_score": 0, "gate": "string", "gate_traffic_light": "string", "summary": "string" }
    ],
    "suggested_questions": ["string"]
  }
}

Return only valid JSON. No preamble. No markdown code fences.`;

// ============================================================================
// HELPERS
// ============================================================================

function computeInputHash(inputs: any): string {
  const canonical = JSON.stringify(inputs, Object.keys(inputs).sort());
  // Simple hash — djb2
  let hash = 5381;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) & 0x7fffffff;
  }
  return hash.toString(36);
}

function extractJsonFromText(text: string): any {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* continue */ }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* continue */ }
  }
  throw new Error("Could not extract valid JSON from LLM output");
}

function validateTerrainRender(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!obj.patient_portrait || typeof obj.patient_portrait !== "object") {
    errors.push("Missing patient_portrait object");
  } else {
    for (const key of ["what_you_already_know", "working_harder_than_you_realize", "where_to_start", "the_one_action"]) {
      if (typeof obj.patient_portrait[key] !== "string" || obj.patient_portrait[key].length < 10) {
        errors.push(`patient_portrait.${key} missing or too short`);
      }
    }
  }

  if (!obj.clinician_summary || typeof obj.clinician_summary !== "object") {
    errors.push("Missing clinician_summary object");
  } else {
    if (typeof obj.clinician_summary.terrain_overview !== "string" || obj.clinician_summary.terrain_overview.length < 50) {
      errors.push("clinician_summary.terrain_overview missing or too short");
    }
    if (!Array.isArray(obj.clinician_summary.axis_breakdown) || obj.clinician_summary.axis_breakdown.length < 10) {
      errors.push("clinician_summary.axis_breakdown must have 10 axes");
    }
    if (!Array.isArray(obj.clinician_summary.perception_gaps)) {
      errors.push("clinician_summary.perception_gaps must be an array");
    }
    if (!Array.isArray(obj.clinician_summary.suggested_questions) || obj.clinician_summary.suggested_questions.length < 5) {
      errors.push("clinician_summary.suggested_questions must have at least 5 questions");
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// INPUT COMPOSITION
// ============================================================================

function composeUserMessage(
  profile: any,
  domainScores: any[],
  gateScores: any[],
  responses: any[],
  labObs: any[]
): string {
  const sections: string[] = [];

  sections.push("PATIENT IDENTITY:");
  sections.push(`Name: ${profile.first_name || "Unknown"}, Age: ${profile.age || "?"}, Sex: ${profile.sex || "?"}`);

  sections.push("\nGATE SCORES (9 gates):");
  for (const g of gateScores) {
    sections.push(`  ${g.gate_id} (${g.gate_name}): ${Math.round(g.score)}/100 [${g.traffic_light}] — contributing domains: ${(g.contributing_domains || []).join(", ")}`);
  }

  sections.push("\nDOMAIN SCORES BY AXIS (25 domains):");
  for (const axis of CIE_AXES) {
    const axisDomains = domainScores.filter(d => axis.domains.includes(d.domain_id));
    if (axisDomains.length > 0) {
      sections.push(`  AXIS ${axis.id} — ${axis.name}:`);
      for (const d of axisDomains) {
        const l2 = d.triggered_layer2 ? ` (deep dive: ${Math.round(d.layer2_score)})` : "";
        sections.push(`    ${d.domain_id}: ${Math.round(d.final_score)}/100${l2}`);
      }
    }
  }

  // Top/bottom 5
  const sorted = [...domainScores].sort((a, b) => a.final_score - b.final_score);
  sections.push("\nLOWEST 5 DOMAINS:");
  for (const d of sorted.slice(0, 5)) {
    sections.push(`  ${d.domain_id}: ${Math.round(d.final_score)}`);
  }
  sections.push("\nHIGHEST 5 DOMAINS:");
  for (const d of sorted.slice(-5).reverse()) {
    sections.push(`  ${d.domain_id}: ${Math.round(d.final_score)}`);
  }

  // Perception gaps
  const gaps: string[] = [];
  for (const d of domainScores) {
    if (d.final_score >= 70) {
      // High domain score — check if any gate it contributes to is YELLOW/ORANGE/RED
      const contributingGates = gateScores.filter(g =>
        (g.contributing_domains || []).includes(d.domain_id) && g.traffic_light !== "GREEN"
      );
      if (contributingGates.length > 0) {
        for (const g of contributingGates) {
          gaps.push(`${d.domain_id} scored ${Math.round(d.final_score)} but gate ${g.gate_id} (${g.gate_name}) is ${g.traffic_light} at ${Math.round(g.score)}`);
        }
      }
    }
  }
  if (gaps.length > 0) {
    sections.push("\nPERCEPTION GAPS (domain scored high but contributing gate is not GREEN):");
    for (const g of gaps.slice(0, 10)) sections.push(`  - ${g}`);
  }

  // CIE responses summary — just counts by domain for context
  if (responses.length > 0) {
    const lowResponses = responses.filter(r => r.score <= 25);
    if (lowResponses.length > 0) {
      sections.push("\nLOW-SCORING INDIVIDUAL RESPONSES (score ≤ 25):");
      for (const r of lowResponses.slice(0, 15)) {
        sections.push(`  ${r.question_id} (${r.domain_id}): "${r.raw_response}" → score ${r.score}`);
      }
    }
  }

  // Lab observations
  if (labObs.length > 0) {
    sections.push(`\nLAB OBSERVATIONS (${labObs.length} biomarkers from last 6 months):`);
    for (const o of labObs.slice(0, 30)) {
      const flag = o.flag ? ` [${o.flag}]` : "";
      const ref = o.ref_low != null && o.ref_high != null ? ` (ref: ${o.ref_low}-${o.ref_high})` : "";
      sections.push(`  ${o.collection_date} | ${o.canonical_name}: ${o.value} ${o.unit}${flag}${ref}`);
    }
  } else {
    sections.push("\nLAB OBSERVATIONS: (none on file)");
  }

  sections.push("\nProduce the terrain render JSON now. Output only the JSON, nothing else.");
  return sections.join("\n");
}

// ============================================================================
// LLM CALL
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
    messages.push({ role: "assistant", content: "{ /* previous attempt had errors */ }" });
    messages.push({
      role: "user",
      content: `Your previous output had validation errors:\n\n${previousError}\n\nProduce a corrected JSON object. Output only JSON.`,
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
  return data.content?.[0]?.text || "";
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, assessment_id } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("first_name, age, sex")
      .eq("user_id", user_id)
      .single();
    if (profileErr || !profile) throw new Error("Could not load profile");

    // 2. Fetch assessment — use provided or latest completed
    let assessmentFilter = supabase
      .from("cie_assessments")
      .select("id, version, status")
      .eq("user_id", user_id)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1);

    if (assessment_id) {
      assessmentFilter = supabase
        .from("cie_assessments")
        .select("id, version, status")
        .eq("id", assessment_id)
        .limit(1);
    }

    const { data: assessments } = await assessmentFilter;
    const assessment = assessments?.[0];
    if (!assessment) {
      return new Response(JSON.stringify({ success: false, error: "No completed assessment found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch domain scores, gate scores, responses, lab obs in parallel
    const [domainRes, gateRes, responseRes, labRes] = await Promise.all([
      supabase.from("cie_domain_scores").select("*").eq("assessment_id", assessment.id),
      supabase.from("cie_gate_scores").select("*").eq("assessment_id", assessment.id),
      supabase.from("cie_responses").select("question_id, domain_id, raw_response, score").eq("assessment_id", assessment.id),
      supabase.from("patient_lab_observations").select("*").eq("user_id", user_id)
        .gte("collection_date", new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10))
        .order("collection_date", { ascending: false })
        .limit(50),
    ]);

    const domainScores = domainRes.data || [];
    const gateScores = gateRes.data || [];
    const responses = responseRes.data || [];
    const labObs = labRes.data || [];

    // 4. Compute input hash and check for existing render
    const inputData = {
      profile: { first_name: profile.first_name, age: profile.age, sex: profile.sex },
      assessment_id: assessment.id,
      domain_scores: domainScores.map(d => ({ id: d.domain_id, score: d.final_score })),
      gate_scores: gateScores.map(g => ({ id: g.gate_id, score: g.score, tl: g.traffic_light })),
      lab_count: labObs.length,
    };
    const inputHash = computeInputHash(inputData);

    // Check for cached render
    const { data: existingRenders } = await supabase
      .from("terrain_renders")
      .select("id, version, status, patient_portrait, clinician_summary")
      .eq("user_id", user_id)
      .eq("generation_input_hash", inputHash)
      .eq("status", "active")
      .limit(1);

    if (existingRenders && existingRenders.length > 0) {
      const cached = existingRenders[0];
      return new Response(JSON.stringify({
        success: true,
        cached: true,
        id: cached.id,
        version: cached.version,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Build LLM input and call
    const userMessage = composeUserMessage(profile, domainScores, gateScores, responses, labObs);
    const startTime = Date.now();
    let parsed: any = null;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rawOutput = await callAnthropicForJson(userMessage, TERRAIN_SYSTEM_PROMPT, lastError);
        parsed = extractJsonFromText(rawOutput);
        const validation = validateTerrainRender(parsed);

        if (validation.valid) {
          lastError = undefined;
          break;
        }

        lastError = validation.errors.join("; ");
        parsed = null;
        console.log(`Attempt ${attempt + 1} validation failed: ${lastError}`);
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        parsed = null;
        console.error(`Attempt ${attempt + 1} error:`, lastError);
      }
    }

    const generationMs = Date.now() - startTime;

    // 6. Get next version
    const { data: versionData } = await supabase.rpc("next_terrain_render_version", { p_user_id: user_id });
    const nextVersion = versionData || 1;

    if (!parsed) {
      // Insert failed row
      await supabase.from("terrain_renders").insert({
        user_id,
        assessment_id: assessment.id,
        version: nextVersion,
        status: "failed",
        error_message: lastError || "Generation failed after all retries",
        generated_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ success: false, error: lastError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Insert active row (trigger supersedes previous)
    const { data: insertedRow, error: insertErr } = await supabase
      .from("terrain_renders")
      .insert({
        user_id,
        assessment_id: assessment.id,
        version: nextVersion,
        status: "active",
        patient_portrait: parsed.patient_portrait,
        clinician_summary: parsed.clinician_summary,
        generation_input_hash: inputHash,
        generated_at: new Date().toISOString(),
      })
      .select("id, version")
      .single();

    if (insertErr) throw new Error(`Failed to persist render: ${insertErr.message}`);

    return new Response(JSON.stringify({
      success: true,
      cached: false,
      id: insertedRow.id,
      version: insertedRow.version,
      generation_ms: generationMs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-terrain-render error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
