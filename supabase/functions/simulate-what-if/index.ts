// ============================================================================
// simulate-what-if
// ----------------------------------------------------------------------------
// Reads the patient's terrain context and generates 3–4 What-if simulation
// cards: small, testable hypotheses with predicted biomarker deltas and a
// retest horizon. These feed the Biological Simulator loop (Observe → Explain
// → Simulate → Choose → Act → Compare → Learn → Internalize).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { admitExperiments } from "../_shared/aae/experimentAdmission.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENGINE_VERSION = "simulator_v1";

interface PredictedDelta {
  biomarker: string;
  direction: "increase" | "decrease" | "stabilize";
  magnitude?: string;
  unit?: string;
  coordinate?: string;
  confidence?: number;
  rationale?: string;
}

interface GeneratedCard {
  lever: string;
  rationale: string;
  predicted_deltas: PredictedDelta[];
  horizon_days: number;
  confidence: number;
}

function fallbackCards(): GeneratedCard[] {
  return [
    {
      lever: "Walk 20 minutes within an hour of waking, daily, for 4 weeks",
      rationale:
        "Morning light + low-grade movement is one of the strongest known levers for circadian regulation and insulin sensitivity. We can predict the shape of the response and check it against your labs.",
      predicted_deltas: [
        { biomarker: "fasting_glucose", direction: "decrease", magnitude: "5-10", unit: "mg/dL", coordinate: "E", confidence: 0.6 },
        { biomarker: "hba1c", direction: "decrease", magnitude: "0.1-0.2", unit: "%", coordinate: "E", confidence: 0.5 },
      ],
      horizon_days: 28,
      confidence: 0.6,
    },
    {
      lever: "Add 30g protein at breakfast every day for 6 weeks",
      rationale:
        "If satiety, afternoon crashes, or muscle signal is part of your terrain, a protein-anchored morning often shifts evening cravings and fasting glucose within one cycle.",
      predicted_deltas: [
        { biomarker: "fasting_glucose", direction: "decrease", magnitude: "3-8", unit: "mg/dL", coordinate: "E", confidence: 0.5 },
      ],
      horizon_days: 42,
      confidence: 0.55,
    },
    {
      lever: "Two strength sessions per week (lower body focus) for 8 weeks",
      rationale:
        "Resistance load is the most reliable lever for muscle quality and metabolic flexibility. The retest will tell us how responsive your system is, not just what's typical.",
      predicted_deltas: [
        { biomarker: "skeletal_muscle_mass", direction: "increase", magnitude: "0.3-0.8", unit: "kg", coordinate: "R", confidence: 0.6 },
        { biomarker: "phase_angle_whole_body", direction: "increase", magnitude: "0.1-0.3", unit: "°", coordinate: "R", confidence: 0.55 },
      ],
      horizon_days: 56,
      confidence: 0.6,
    },
  ];
}

async function loadCompactContext(supabase: any, userId: string) {
  const [renderRes, clustersRes, obsRes, cieRes] = await Promise.all([
    supabase
      .from("terrain_renders")
      .select("id, patient_portrait, clinician_summary, generated_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("derived_patterns")
      .select("id, rule_id, severity, evidence")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("patient_lab_observations")
      .select("biomarker_name, value, unit, collection_date")
      .eq("user_id", userId)
      .order("collection_date", { ascending: false })
      .limit(40),
    supabase
      .from("cie_domain_scores")
      .select("domain_id, axis, final_score")
      .eq("user_id", userId)
      .limit(40),
  ]);

  return {
    render: renderRes.data || null,
    patterns: clustersRes.data || [],
    labs: obsRes.data || [],
    cie: cieRes.data || [],
  };
}

// Derive the patient's biomarker set (for binding) and safety flags (for
// contraindications) from already-loaded context. Conservative v0.1: flags are
// inferred from labs/CIE where confidently present. This is the one place to
// expand as real contraindication data sources come online.
function derivePatientGuards(ctx: any): { biomarkers: Set<string>; flags: Set<string> } {
  const biomarkers = new Set<string>();
  for (const lab of ctx.labs ?? []) {
    if (lab.biomarker_name) biomarkers.add(String(lab.biomarker_name));
  }
  for (const c of ctx.cie ?? []) {
    if (c.domain_id) biomarkers.add(String(c.domain_id));
  }

  const flags = new Set<string>();
  const labByName: Record<string, number> = {};
  for (const lab of ctx.labs ?? []) {
    const n = String(lab.biomarker_name || "").toLowerCase();
    const v = typeof lab.value === "number" ? lab.value : parseFloat(lab.value);
    if (n && !isNaN(v)) labByName[n] = v;
  }
  // Conservative inferred flags (extend as dedicated sources land):
  // low HRV → poor-recovery terrain
  for (const [n, v] of Object.entries(labByName)) {
    if (n.includes("hrv") && v < 30) flags.add("low_hrv");
    if ((n.includes("bmi") || n.includes("body_mass_index")) && v < 18.5) flags.add("underweight");
    if (n.includes("egfr") && v < 60) flags.add("ckd");
    if ((n.includes("troponin") || n.includes("coronary") || n.includes("cac")) && v > 0) flags.add("cardiac_risk");
  }
  // NOTE: ed_history and pregnancy are NOT inferable from labs — they must come
  // from a profile/condition source. Until that source is wired, these flags are
  // absent, so those contraindication rules cannot fire. Flagged as a known gap.
  return { biomarkers, flags };
}

async function callClaude(ctx: any, focus: string | null): Promise<GeneratedCard[] | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  const system = `You are the Vizzhy Biological Simulator. Your job is to propose small, testable
hypotheses about the patient's biology — not habit advice. The patient will run one
experiment, and a retest will tell us whether the prediction was right.

RULES:
- Return STRICT JSON: { "cards": [ { lever, rationale, predicted_deltas: [{biomarker, direction, magnitude?, unit?, coordinate?, confidence?}], horizon_days, confidence } ] }
- 3 to 4 cards. Each card must be ONE concrete lever the patient can actually run.
- Each card must include 1–3 predicted_deltas tied to biomarkers ALREADY present
  in their data (use their exact biomarker names where possible).
- direction is "increase" | "decrease" | "stabilize". magnitude is a short
  numeric range string (e.g. "5-10"); omit if you cannot estimate.
- coordinate ∈ {E,I,V,R,Σ} (Energy, Inflammation, Vascular, Regulation, Scar memory).
- horizon_days: pick the shortest realistic retest window (14 to 84).
- confidence: 0–1, how strongly the literature + their data support the prediction.
- VOICE: terrain-language, second person, no directives ("do X"). Frame as
  "What if you …", with the rationale grounded in what their terrain is
  showing. Never invent biomarker values.`;

  const compact = {
    patient_portrait: ctx.render?.patient_portrait ?? null,
    clinician_summary: ctx.render?.clinician_summary ?? null,
    derived_patterns: ctx.patterns?.slice(0, 10) ?? [],
    recent_labs: (ctx.labs ?? []).slice(0, 25),
    cie_domain_scores: ctx.cie ?? [],
    focus: focus,
  };

  const user = `Patient context:\n${JSON.stringify(compact, null, 2)}\n\nReturn JSON only.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    console.warn("Anthropic non-2xx:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const text: string = data.content?.[0]?.text || "";
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0) return null;
  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    if (!Array.isArray(parsed.cards)) return null;
    return parsed.cards.filter((c: any) => c.lever && c.rationale).slice(0, 4);
  } catch (e) {
    console.warn("simulate-what-if parse error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, focus } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ctx = await loadCompactContext(supabase, user_id);
    let cards = await callClaude(ctx, focus ?? null);
    if (!cards || cards.length === 0) cards = fallbackCards();

    // ── EXPERIMENT ADMISSION GATE (EAE) ──
    // Generation is done; nothing reaches the patient un-admitted. Each card is
    // a causal edge (lever → predicted biomarker deltas). Gate on binding +
    // safety; label confidence. Blocked (unsafe/unbound) experiments are
    // withheld from the patient and surfaced clinician-only.
    const { biomarkers, flags } = derivePatientGuards(ctx);
    const { results, ledger } = admitExperiments(cards as any[], biomarkers, flags);

    console.log(
      "[simulate-what-if][EAE]",
      JSON.stringify({
        user_id,
        total: ledger.total,
        admitted: ledger.admitted,
        blocked: ledger.blocked,
        blocked_unsafe: ledger.blocked_unsafe,
        blocked_unbound: ledger.blocked_unbound,
        emptiness_ratio: Number(ledger.emptiness_ratio.toFixed(3)),
      }),
    );

    // Persist ALL cards with their verdict (so the clinician can see blocked
    // ones), but mark patient visibility. Patient-facing reads filter on
    // patient_safe = true.
    const rows = cards.map((c, i) => {
      const a = results[i];
      return {
        user_id,
        lever: c.lever,
        rationale: c.rationale,
        predicted_deltas: c.predicted_deltas ?? [],
        horizon_days: c.horizon_days ?? 28,
        confidence: c.confidence ?? null,
        focus: focus ?? null,
        source_terrain_render_id: ctx.render?.id ?? null,
        engine_version: ENGINE_VERSION,
        // EAE admission fields:
        admission_verdict: a.verdict,
        admission_reasons: a.reasons,
        evidence_label: a.evidence_label,
        patient_safe: a.patient_safe,
        safety_flags: a.safety_flags,
        unbound_biomarkers: a.unbound_biomarkers,
      };
    });

    const { data: inserted, error } = await supabase
      .from("simulator_what_if_cards")
      .insert(rows)
      .select();
    if (error) throw error;

    // Return only patient-safe cards to the patient client; full set + ledger
    // available to clinician views via a separate authorized read.
    const patientCards = (inserted ?? []).filter((r: any) => r.patient_safe);

    return new Response(
      JSON.stringify({
        cards: patientCards,
        count: patientCards.length,
        eae: {
          total: ledger.total,
          admitted: ledger.admitted,
          blocked: ledger.blocked,
          blocked_unsafe: ledger.blocked_unsafe,
          blocked_unbound: ledger.blocked_unbound,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("simulate-what-if error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});