// Using built-in Deno.serve (no remote std import) — std@0.168.0 was returning 500 from the bundler.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { loadPatientContext } from "../_shared/contextLoader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory cache: key → { data, expiresAt }
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const BIOMARKER_SIGNIFICANCE: Record<string, number> = {
  "apolipoprotein b": 10,
  "apob": 10,
  "ldl particle number": 10,
  "ldl-p": 10,
  "hba1c": 9,
  "hemoglobin a1c": 9,
  "hs-crp": 9,
  "c-reactive protein": 9,
  "lp(a)": 9,
  "lipoprotein(a)": 9,
  "fasting insulin": 8,
  "homocysteine": 8,
  "vitamin d": 7,
  "25-hydroxyvitamin d": 7,
  "ferritin": 7,
  "phase angle": 8,
  "skeletal muscle mass": 8,
  "body fat percentage": 7,
  "triglycerides": 7,
  "hdl cholesterol": 7,
  "ldl cholesterol": 7,
  "total cholesterol": 6,
  "tsh": 6,
  "free t3": 6,
  "free t4": 6,
  "cortisol": 6,
  "dhea-s": 6,
  "testosterone": 6,
  "estradiol": 6,
  "omega-3 index": 7,
  "magnesium": 6,
  "zinc": 6,
  "b12": 6,
  "folate": 6,
  "ggt": 6,
  "alt": 5,
  "ast": 5,
  "albumin": 5,
  "uric acid": 5,
  "creatinine": 5,
  "egfr": 6,
  "glucose": 6,
  "fasting glucose": 7,
};

function getSignificance(name: string): number {
  const lower = name.toLowerCase().trim();
  for (const [key, score] of Object.entries(BIOMARKER_SIGNIFICANCE)) {
    if (lower.includes(key) || key.includes(lower)) return score;
  }
  return 3;
}

// Anchor biomarkers that are central to terrain narrative
const ANCHOR_NAMES = [
  "phase angle", "skeletal muscle mass", "apolipoprotein b", "apob",
  "hba1c", "hemoglobin a1c", "body fat percentage", "ldl particle number", "ldl-p",
];

function isAnchor(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return ANCHOR_NAMES.some(a => lower.includes(a) || a.includes(lower));
}

const QUESTION_SYSTEM_PROMPT = `You are the question generation layer for Vizzhy, a biological intelligence platform. You are generating suggested questions that a specific patient would benefit from asking their reasoning companion.

The patient's full terrain context is provided. Generate exactly 4 questions that:
- Are in second person ("your", "my")
- Reference the patient's actual findings by name and number where appropriate
- Are specific, grounded, and curious — the kinds of questions a smart patient would ask their best doctor if they had unlimited time
- Cover different aspects of the patient's terrain: one about the most concerning finding, one about trajectory/momentum, one about what's working well, one about actionable next steps
- Use the Vizzhy framework voice: no biotype language, no wellness-app vocabulary, n=1 framing throughout
- Are each under 25 words
- Never use words like "optimize", "biohack", "wellness", "holistic", "journey" (in the wellness sense)

Return JSON: { "questions": ["q1", "q2", "q3", "q4"] }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { authenticateRequest, resolveTargetUserId } = await import("../_shared/auth.ts");
    const authResult = await authenticateRequest(req);
    if (!authResult.ok) {
      return new Response(JSON.stringify(authResult.error.body), {
        status: authResult.error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { user_id: requestedUserId, assessment_id } = await req.json();
    const resolved = await resolveTargetUserId(authResult.auth, requestedUserId ?? null);
    if (!resolved.ok) {
      return new Response(JSON.stringify(resolved.error.body), {
        status: resolved.error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user_id = resolved.targetUserId;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch terrain render
    const { data: terrainRender } = await supabase
      .from("terrain_renders")
      .select("patient_portrait, clinician_summary, version, assessment_id")
      .eq("user_id", user_id)
      .eq("status", "active")
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const terrainVersion = terrainRender?.version || 0;
    const effectiveAssessmentId = assessment_id || terrainRender?.assessment_id;

    // Check cache
    const cacheKey = `${user_id}::${effectiveAssessmentId || "none"}::${terrainVersion}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all data in parallel
    // P1a: all reasoning context flows through the witness-native loader.
    // Raw reads of patient_lab_observations / cie_gate_scores /
    // derived_patterns / profiles are forbidden on this surface.
    const witnessContext = await loadPatientContext(supabaseUrl, serviceRoleKey, user_id);

    // Derive the legacy `labs` shape from the union of witness-backed
    // observation streams (labs + inbody + fibroscan). Downstream dedupe,
    // significance scoring, anchor classification, and bucketing logic is
    // unchanged.
    const labs = [
      ...witnessContext.labs.observations.map((o) => ({
        canonical_name: o.canonical_name,
        display_name: o.canonical_name,
        value: o.value,
        unit: o.unit,
        flag: o.flag,
        ref_low: o.ref_low,
        ref_high: o.ref_high,
        collection_date: o.collection_date,
        source: o.source,
      })),
      ...witnessContext.inbody.observations.map((o) => ({
        canonical_name: o.canonical_name,
        display_name: o.canonical_name,
        value: o.value,
        unit: o.unit,
        flag: null as string | null,
        ref_low: null as number | null,
        ref_high: null as number | null,
        collection_date: o.collection_date,
        source: o.source,
      })),
      ...witnessContext.fibroscan.observations.map((o) => ({
        canonical_name: o.canonical_name,
        display_name: o.canonical_name,
        value: o.value,
        unit: o.unit,
        flag: null as string | null,
        ref_low: null as number | null,
        ref_high: null as number | null,
        collection_date: o.collection_date,
        source: "FibroScan",
      })),
    ];

    const gates = witnessContext.cie.gate_scores.map((g) => ({
      gate_id: g.gate_id,
      gate_name: g.gate_name,
      score: g.score,
      traffic_light: g.traffic_light,
      contributing_domains: g.contributing_domains,
    }));

    const SEVERITY_RANK: Record<string, number> = {
      critical: 0,
      high: 1,
      moderate: 2,
      low: 3,
      info: 4,
    };
    const patterns = [...witnessContext.prior_patterns.patterns]
      .sort((a, b) => {
        const ra = SEVERITY_RANK[a.severity?.toLowerCase()] ?? 99;
        const rb = SEVERITY_RANK[b.severity?.toLowerCase()] ?? 99;
        return ra - rb;
      })
      .slice(0, 20)
      .map((p) => ({
        title: p.title,
        severity: p.severity,
        category: p.category,
        // legacy `summary` field is not present in witness layer; downstream
        // tolerates undefined and only renders if truthy.
        summary: "",
      }));

    const profile = {
      first_name: witnessContext.profile.display_name,
      age: witnessContext.profile.age,
      sex: witnessContext.profile.sex,
    };

    // Deduplicate labs — keep most recent per canonical_name
    const seenLabs = new Map<string, typeof labs[0]>();
    for (const lab of labs) {
      const key = lab.canonical_name.toLowerCase();
      if (!seenLabs.has(key)) {
        seenLabs.set(key, lab);
      }
    }
    const uniqueLabs = Array.from(seenLabs.values());

    // Categorize biomarkers
    const flagged: Array<{ name: string; value: string; unit: string; flag: string; significance: number }> = [];
    const notable: Array<{ name: string; value: string; unit: string; significance: number }> = [];
    const anchor: Array<{ name: string; value: string; unit: string; significance: number }> = [];

    for (const lab of uniqueLabs) {
      const displayName = lab.display_name || lab.canonical_name;
      const sig = getSignificance(lab.canonical_name);
      const entry = {
        name: displayName,
        value: String(lab.value),
        unit: lab.unit,
        flag: lab.flag || "normal",
        significance: sig,
      };

      if (isAnchor(lab.canonical_name)) {
        anchor.push(entry);
      } else if (lab.flag && lab.flag !== "normal") {
        flagged.push(entry);
      } else if (sig >= 7) {
        // In-range but high clinical significance = notable
        notable.push(entry);
      }
    }

    // Sort by significance and take top N
    flagged.sort((a, b) => b.significance - a.significance);
    notable.sort((a, b) => b.significance - a.significance);
    anchor.sort((a, b) => b.significance - a.significance);

    const chipsFlagged = flagged.slice(0, 4).map(b => ({
      name: b.name,
      value: b.value,
      unit: b.unit,
      flag: b.flag as "high" | "low" | "critical",
    }));

    const chipsNotable = notable.slice(0, 3).map(b => ({
      name: b.name,
      value: b.value,
      unit: b.unit,
    }));

    const chipsAnchor = anchor.slice(0, 3).map(b => ({
      name: b.name,
      value: b.value,
      unit: b.unit,
    }));

    // Build terrain context for question generation
    const portrait = terrainRender?.patient_portrait;
    const clinicianSummary = terrainRender?.clinician_summary;

    const contextParts: string[] = [];
    if (profile) {
      contextParts.push(`Patient: ${profile.first_name || "Unknown"}, ${profile.age || "unknown age"}, ${profile.sex || "unknown sex"}`);
    }
    if (portrait) {
      contextParts.push(`Patient Portrait: ${JSON.stringify(portrait).slice(0, 2000)}`);
    }
    if (clinicianSummary) {
      contextParts.push(`Clinician Summary: ${JSON.stringify(clinicianSummary).slice(0, 1500)}`);
    }
    if (chipsFlagged.length > 0) {
      contextParts.push(`Flagged biomarkers (out of range): ${chipsFlagged.map(b => `${b.name}: ${b.value} ${b.unit} [${b.flag}]`).join(", ")}`);
    }
    if (chipsNotable.length > 0) {
      contextParts.push(`Notable biomarkers (in range, worth celebrating): ${chipsNotable.map(b => `${b.name}: ${b.value} ${b.unit}`).join(", ")}`);
    }
    if (chipsAnchor.length > 0) {
      contextParts.push(`Anchor biomarkers (central to narrative): ${chipsAnchor.map(b => `${b.name}: ${b.value} ${b.unit}`).join(", ")}`);
    }
    if (gates.length > 0) {
      contextParts.push(`CIE Gate Scores: ${gates.map((g: any) => `${g.gate_name}: ${g.score}/100 (${g.traffic_light})`).join(", ")}`);
    }
    if (patterns.length > 0) {
      contextParts.push(`Active Patterns: ${patterns.map((p: any) => `[${p.severity}] ${p.title}: ${p.summary}`).join("; ").slice(0, 1000)}`);
    }

    const terrainContext = contextParts.join("\n\n");

    // Generate suggested questions via Lovable AI gateway
    let suggestedQuestions: string[] = [];
    if (lovableKey) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: QUESTION_SYSTEM_PROMPT },
            { role: "user", content: terrainContext },
          ],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const text = result.choices?.[0]?.message?.content || "";
        try {
          const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed.questions)) {
            suggestedQuestions = parsed.questions.slice(0, 4);
          }
        } catch {
          console.error("Failed to parse question JSON:", text);
        }
      } else {
        console.error("Gateway question gen failed:", response.status);
      }
      } catch (e) {
        console.error("Question generation error:", e);
      }
    }

    // Fallback
    if (suggestedQuestions.length === 0) {
      suggestedQuestions = ["Tell me what I should be paying attention to right now"];
    }

    const result = {
      biomarker_chips: {
        flagged: chipsFlagged,
        notable: chipsNotable,
        anchor: chipsAnchor,
      },
      suggested_questions: suggestedQuestions,
      terrain_version: terrainVersion,
    };

    // Cache
    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    // Prune old entries
    if (cache.size > 100) {
      const now = Date.now();
      for (const [k, v] of cache) {
        if (v.expiresAt < now) cache.delete(k);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ask-anything-context error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
