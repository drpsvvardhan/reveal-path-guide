// Using built-in Deno.serve (no remote std import) — std@0.168.0 was returning 500 from the bundler.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  TIER_VOCABULARY_LICENSES,
  FORBIDDEN_VOCABULARY_GLOBAL,
  parseProseAndCitations,
  validateProseAgainstClusters,
  stripClusterMarkers,
  buildRetryFeedback,
} from "../_shared/framework_v2.ts";
import type { ClusterTier, VocabularyViolation } from "../_shared/framework_v2.ts";
import { loadPatientContext } from "../_shared/contextLoader.ts";
import { detectDosePatternsInActions } from "../_shared/dosePattern.ts";
import { extractDoseTokens } from "../_shared/dosePolicy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Intervention Library ──
// Canonical substrate now lives in supabase/functions/_shared/
// interventionLibrary.ts (mirrored to the client through the @shared
// path alias / src/lib/interventionLibrary.ts shim).
import {
  INTERVENTION_LIBRARY,
  isForbiddenInCoreMode,
  type Intervention,
} from "../_shared/interventionLibrary.ts";
import {
  convertToCoreMode,
  type CoreSafeAction,
} from "../_shared/actionPlanCoreMode.ts";


// ── Biomarker name normalization ──
const BIOMARKER_ALIASES: Record<string, string[]> = {
  vitamin_d: ["vitamin_d", "25_oh_vitamin_d", "25-oh vitamin d", "vitamin d"],
  hs_crp: ["hs_crp", "hs-crp", "high sensitivity crp", "c-reactive protein"],
  hba1c: ["hba1c", "hemoglobin_a1c", "hemoglobin a1c", "a1c"],
  ldl_cholesterol: ["ldl_cholesterol", "ldl", "ldl-c"],
  skeletal_muscle_mass: ["skeletal_muscle_mass", "smm"],
  visceral_fat_area: ["visceral_fat_area", "vfa", "visceral fat area"],
  ecw_tbw_ratio: ["ecw_tbw_ratio", "ecw/tbw", "ecw tbw"],
  phase_angle_whole_body: ["phase_angle_whole_body", "whole body phase angle", "phase angle"],
  magnesium: ["magnesium"],
  vitamin_b12: ["vitamin_b12", "b12", "cobalamin"],
  apolipoprotein_b: ["apolipoprotein_b", "apob", "apo b"],
};

function normalizeBiomarkerName(raw: string): string {
  const lower = raw.toLowerCase().replace(/[\s\-\/]+/g, "_");
  for (const [canonical, aliases] of Object.entries(BIOMARKER_ALIASES)) {
    if (aliases.some((a) => a.replace(/[\s\-\/]+/g, "_") === lower || lower.includes(a.replace(/[\s\-\/]+/g, "_")))) {
      return canonical;
    }
  }
  return lower;
}

// ── Matching engine ──
function checkCondition(operator: string, actual: number, threshold: number): boolean {
  switch (operator) {
    case "<": return actual < threshold;
    case ">": return actual > threshold;
    case "<=": return actual <= threshold;
    case ">=": return actual >= threshold;
    default: return false;
  }
}

interface PatientData {
  gateScores: Record<string, { score: number; traffic_light: string; gate_name: string }>;
  domainScores: Record<string, { final_score: number }>;
  biomarkers: Record<string, { value: number; unit: string }>;
  patterns: Array<{ rule_id: string; severity: string }>;
}

function matchInterventions(data: PatientData): Array<Intervention & { match_score: number }> {
  const matched: Array<Intervention & { match_score: number }> = [];

  for (const iv of INTERVENTION_LIBRARY) {
    let hits = 0;
    let total = 0;

    if (iv.trigger.biomarker_conditions) {
      for (const bc of iv.trigger.biomarker_conditions) {
        total++;
        const bio = data.biomarkers[bc.name];
        if (bio && checkCondition(bc.operator, bio.value, bc.value)) hits++;
      }
    }

    if (iv.trigger.gate_conditions) {
      for (const gc of iv.trigger.gate_conditions) {
        total++;
        const gate = data.gateScores[gc.gate];
        if (gate) {
          const severity = ["GREEN", "YELLOW", "ORANGE", "RED"];
          const gateIdx = severity.indexOf(gate.traffic_light);
          const condIdx = severity.indexOf(gc.traffic_light);
          if (gateIdx >= condIdx) hits++;
        }
      }
    }

    if (iv.trigger.domain_conditions) {
      for (const dc of iv.trigger.domain_conditions) {
        total++;
        const dom = data.domainScores[dc.domain];
        if (dom && checkCondition(dc.operator, dom.final_score, dc.value)) hits++;
      }
    }

    if (iv.trigger.rule_ids) {
      for (const rid of iv.trigger.rule_ids) {
        total++;
        if (data.patterns.some((p) => p.rule_id === rid)) hits++;
      }
    }

    if (total > 0 && hits > 0 && hits >= total * 0.5) {
      matched.push({ ...iv, match_score: hits / total });
    }
  }

  return matched;
}

function templateWhy(template: string, data: PatientData): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (data.biomarkers[key]) return String(data.biomarkers[key].value);
    const domainMatch = key.match(/^([A-Z]\d+)_score$/);
    if (domainMatch) {
      const dom = data.domainScores[domainMatch[1]];
      if (dom) return String(Math.round(dom.final_score));
    }
    const gateMatch = key.match(/^(\w+)_status$/);
    if (gateMatch) {
      const gate = data.gateScores[gateMatch[1]];
      if (gate) return gate.traffic_light;
    }
    return match;
  });
}

// ── Coordinate impact scoring ──
function coordinateImpactScore(iv: Intervention, data: PatientData): number {
  const coordMap: Record<string, string[]> = {
    E: ["A1", "A2", "A3", "C8", "G21", "H23"],
    I: ["B6", "D10", "D11", "D12", "F17"],
    V: ["B4", "B5", "C9", "I24"],
    R: ["C7", "E13", "E14", "E15", "G19", "G20", "H22", "J25"],
    Σ: ["F16", "F18"],
  };

  let impact = 0;
  for (const coord of iv.coordinates) {
    const domains = coordMap[coord] || [];
    let avgScore = 0;
    let count = 0;
    for (const d of domains) {
      const ds = data.domainScores[d];
      if (ds) { avgScore += ds.final_score; count++; }
    }
    if (count > 0) {
      const avg = avgScore / count;
      impact += (100 - avg);
    }
  }
  return impact;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Load witness-native patient terrain context (P1a contract).
    //    All CIE / lab / pattern signal flows through the governed loader.
    //    No reasoning surface may read patient_lab_observations, cie_gate_scores,
    //    cie_domain_scores, or derived_patterns directly.
    const witnessContext = await loadPatientContext(supabaseUrl, serviceKey, user_id);

    // Read consumer_action_plan_mode for this user. Defaults to 'core'.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("consumer_action_plan_mode")
      .eq("user_id", user_id)
      .maybeSingle();
    const actionPlanMode: "core" | "biotwin_plus" =
      (profileRow as any)?.consumer_action_plan_mode === "biotwin_plus"
        ? "biotwin_plus"
        : "core";

    // Clusters remain a governed-derived-object read, scoped by the
    // loader-returned canonical patient_id (= profiles.id).
    const { data: clusterRows } = await supabase
      .from("clusters")
      .select("id, claim, cluster_kind, confidence_tier, confidence_score")
      .eq("patient_id", witnessContext.patient_id)
      .eq("status", "active")
      .order("confidence_score", { ascending: false });

    // Reconstruct legacy in-memory shapes from witness context. Loader returns
    // rows in newest-first order, so the "first wins" dedupe rule is preserved.
    const gateScores: Record<string, { score: number; traffic_light: string; gate_name: string }> = {};
    for (const g of witnessContext.cie.gate_scores) {
      if (!gateScores[g.gate_id]) {
        gateScores[g.gate_id] = {
          score: g.score,
          traffic_light: g.traffic_light,
          gate_name: g.gate_name,
        };
      }
    }

    const domainScores: Record<string, { final_score: number }> = {};
    for (const d of witnessContext.cie.domain_scores) {
      if (!domainScores[d.domain_id]) {
        domainScores[d.domain_id] = { final_score: d.final_score };
      }
    }

    // Biomarker map: today's raw query physically held labs + inbody + fibroscan
    // in patient_lab_observations. The loader splits them by source_window, so
    // we re-merge here to preserve marker coverage. First-wins dedupe per
    // normalized analyte name, iterating in returned (date-desc) order.
    const biomarkers: Record<string, { value: number; unit: string }> = {};
    const allObservations = [
      ...witnessContext.labs.observations,
      ...witnessContext.inbody.observations,
      ...witnessContext.fibroscan.observations,
    ];
    for (const obs of allObservations) {
      const key = normalizeBiomarkerName(obs.canonical_name);
      if (!biomarkers[key]) biomarkers[key] = { value: obs.value, unit: obs.unit };
    }

    const patientData: PatientData = {
      gateScores,
      domainScores,
      biomarkers,
      patterns: witnessContext.prior_patterns.patterns.map((p) => ({
        rule_id: p.rule_id,
        severity: p.severity,
      })),
    };

    const clusters = clusterRows || [];

    // Build cluster tier map for voice validation
    const clusterTierMap = new Map<string, ClusterTier>();
    for (const c of clusters) {
      clusterTierMap.set(c.id, c.confidence_tier as ClusterTier);
    }

    // 2. Match interventions (DETERMINISTIC — unchanged)
    let matched = matchInterventions(patientData);

    // 3. Rank
    matched.sort((a, b) => {
      if (a.sequence_priority !== b.sequence_priority) return a.sequence_priority - b.sequence_priority;
      return coordinateImpactScore(b, patientData) - coordinateImpactScore(a, patientData);
    });

    // 4. Deduplicate
    const categoryCounts: Record<string, number> = {};
    const selected: typeof matched = [];
    for (const iv of matched) {
      const count = categoryCounts[iv.category] || 0;
      if (count >= 2) continue;
      selected.push(iv);
      categoryCounts[iv.category] = count + 1;
      if (selected.length >= 5) break;
    }

    if (selected.length < 5) {
      for (const iv of matched) {
        if (selected.some((s) => s.id === iv.id)) continue;
        selected.push(iv);
        if (selected.length >= 5) break;
      }
    }

    // 5. Template the why
    const baseTodayActions = selected.map((iv) => ({
      id: iv.id,
      what: iv.what,
      why: templateWhy(iv.why_template, patientData),
      how: iv.how,
      coordinates: iv.coordinates,
      gates: iv.gates,
      retest_weeks: iv.retest_weeks,
      retest_markers: iv.retest_markers,
      category: iv.category,
      sequence_priority: iv.sequence_priority,
      policy_class: iv.policy_class,
      core_title: iv.core_title,
      core_rationale: iv.core_rationale,
      core_observation: iv.core_observation,
      core_clinician_question: iv.core_clinician_question,
      source_intervention: iv,
    }));

    // Apply Core-mode policy filter. Forbidden classes are converted into
    // interpreter-safe doctor-question actions; permitted classes pass
    // through unchanged.
    let todayActions: any[] = baseTodayActions.map((a) => {
      if (actionPlanMode === "core" && isForbiddenInCoreMode(a.source_intervention)) {
        const converted: CoreSafeAction = convertToCoreMode(a.source_intervention);
        return {
          id: converted.id,
          what: converted.what,
          why: a.why,
          how: converted.how,
          rationale: converted.rationale,
          doctor_question: converted.doctor_question,
          coordinates: converted.coordinates,
          gates: a.gates,
          retest_weeks: a.retest_weeks,
          retest_markers: a.retest_markers,
          category: a.category,
          sequence_priority: converted.sequence_priority,
          policy_class: converted.policy_class,
          source_intervention_id: converted.source_intervention_id,
          core_title: a.source_intervention.core_title,
          core_rationale: a.source_intervention.core_rationale,
          core_observation: a.source_intervention.core_observation,
          core_clinician_question: a.source_intervention.core_clinician_question,
        };
      }
      const { source_intervention, ...rest } = a;
      return rest;
    });

    // Structural backstop: in Core mode, today_actions[] must contain zero
    // dose tokens across what/how/rationale/doctor_question. Drops any
    // action that fails and writes an audit row.
    if (actionPlanMode === "core") {
      const cleanActions: any[] = [];
      const droppedActions: Array<{ id: string; field: string; tokens: string[] }> = [];
      for (const action of todayActions) {
        const whatTokens = extractDoseTokens(action.what ?? "");
        const howTokens = extractDoseTokens(action.how ?? "");
        const rationaleTokens = extractDoseTokens(action.rationale ?? "");
        const doctorQuestionTokens = extractDoseTokens(action.doctor_question ?? "");
        const allTokens = [
          ...whatTokens,
          ...howTokens,
          ...rationaleTokens,
          ...doctorQuestionTokens,
        ];
        if (allTokens.length === 0) {
          cleanActions.push(action);
        } else {
          droppedActions.push({
            id: action.id,
            field: whatTokens.length
              ? "what"
              : howTokens.length
              ? "how"
              : rationaleTokens.length
              ? "rationale"
              : "doctor_question",
            tokens: allTokens,
          });
        }
      }
      if (droppedActions.length > 0) {
        console.warn(
          "[generate-action-plan] Core mode backstop dropped actions:",
          droppedActions,
        );
        try {
          await supabase.from("patient_chat_validation_log").insert({
            user_id,
            message_role: "action_plan",
            status: "replaced_with_fallback",
            dose_patterns_matched: droppedActions.flatMap((d) => d.tokens),
            original_output: JSON.stringify(droppedActions),
            replaced_with: `Dropped ${droppedActions.length} actions from Core mode action plan`,
            replacement_template_used: "core_mode_backstop",
            last_user_message: "action_plan_generation",
          });
        } catch (e) {
          console.error("[generate-action-plan] backstop audit insert failed:", e);
        }
      }
      todayActions = cleanActions;
    }

    // 6. Build retest schedule
    const retestMap: Record<number, Set<string>> = {};
    for (const a of todayActions) {
      if (!retestMap[a.retest_weeks]) retestMap[a.retest_weeks] = new Set();
      for (const m of a.retest_markers) retestMap[a.retest_weeks].add(m);
    }
    const retestSchedule = Object.entries(retestMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([weeks, markers]) => ({
        weeks: Number(weeks),
        markers: Array.from(markers),
        rationale: `Retest at ${weeks} weeks to confirm whether interventions are shifting the terrain. The measurement is how we know — not a promise.`,
      }));

    // 7. Generate sequence explanation using LLM with cluster context + voice validation
    let sequenceExplanation = "These actions are ordered by leverage — the first ones stabilize the foundation that makes later ones effective. Start with the top action. As it becomes habit, add the next.";
    let voiceValidationStatus: string | null = null;
    let voiceValidationWarnings: VocabularyViolation[] | null = null;

    try {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (apiKey && todayActions.length > 0) {
        const actionSummary = todayActions.map((a, i) => `${i + 1}. [${a.category}] ${a.what} (coordinates: ${a.coordinates.join(",")})`).join("\n");

        // Build cluster context for the LLM call
        const clusterContext = clusters.length > 0
          ? `\n\nActive clusters for this patient:\n${clusters.map(c => `- ${c.claim} (tier: ${c.confidence_tier}, score: ${c.confidence_score})`).join('\n')}`
          : '';

        const tierVocabSummary = Object.entries(TIER_VOCABULARY_LICENSES)
          .map(([tier, l]) => `${tier}: use ${l.allowed_verbs.slice(0, 3).join('/')}, avoid ${l.forbidden_verbs.slice(0, 3).join('/')}`)
          .join('; ');

        const MAX_RETRIES = 3;
        let lastViolations: VocabularyViolation[] = [];

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          const prompt = attempt === 0
            ? `You are explaining to a patient why these actions are ordered this way. Write ONE paragraph (3-4 sentences). Use second-person voice. No predictions. No wellness language. No "will improve." Explain what each action stabilizes that makes the next one more effective.

Each sentence must end with a cluster citation marker like {cluster:<cluster_id>} or {cluster:none} for general framing.

Tier-licensed vocabulary rules: ${tierVocabSummary}

Globally forbidden phrases: ${FORBIDDEN_VOCABULARY_GLOBAL.slice(0, 10).join(', ')}...

Actions:\n${actionSummary}${clusterContext}`
            : `Your previous attempt had vocabulary violations. Fix them and regenerate.\n\n${buildRetryFeedback(lastViolations)}\n\nActions:\n${actionSummary}${clusterContext}`;

          const llmRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 300,
              messages: [{ role: "user", content: prompt }],
            }),
          });

          if (!llmRes.ok) {
            const errText = await llmRes.text();
            console.warn("LLM sequence explanation failed:", errText);
            break;
          }

          const llmData = await llmRes.json();
          const text = llmData?.content?.[0]?.text;
          if (!text || text.length < 20) break;

          // Voice validate
          if (clusters.length > 0) {
            const { sentenceToClusterMap } = parseProseAndCitations(text);
            const voiceResult = validateProseAgainstClusters(text, clusterTierMap, sentenceToClusterMap);

            if (voiceResult.valid) {
              sequenceExplanation = stripClusterMarkers(text);
              voiceValidationStatus = "passed";
              lastViolations = [];
              break;
            }

            lastViolations = voiceResult.violations;
            console.log(`Sequence explanation attempt ${attempt + 1} voice validation failed: ${voiceResult.violations.length} violations`);

            // On last attempt, use it anyway
            if (attempt === MAX_RETRIES - 1) {
              sequenceExplanation = stripClusterMarkers(text);
              voiceValidationStatus = "failed_with_warnings";
              voiceValidationWarnings = lastViolations;
            }
          } else {
            sequenceExplanation = text;
            voiceValidationStatus = "passed";
            break;
          }
        }
      }
    } catch (e) {
      console.warn("LLM sequence explanation failed, using default:", e);
    }

    // 8. Persist
    // Structural backstop: log any deterministic dose strings present in
    // today_actions. 6c will introduce the policy flag that prevents these
    // from reaching consumer mode in the first place. For now this is the
    // structural trace that proves the gap.
    const dosesInActions = detectDosePatternsInActions(todayActions);
    if (dosesInActions.length > 0) {
      console.warn(
        "[generate-action-plan] dose patterns present in today_actions:",
        JSON.stringify(dosesInActions),
      );
      try {
        await supabase.from("patient_chat_validation_log").insert({
          user_id,
          message_role: "action_plan",
          status: "failed_with_warnings",
          dose_patterns_matched: dosesInActions.map(
            (h) => `${h.id}:${h.field}:${h.pattern}`,
          ),
          original_output: JSON.stringify(
            todayActions.map((a) => ({ id: a.id, what: a.what, how: a.how })),
          ),
          cluster_count: clusters.length,
          last_user_message: "action_plan_generation",
        });
      } catch (e) {
        console.error("[generate-action-plan] dose audit insert failed:", e);
      }
    }

    const { data: versionData } = await supabase.rpc("next_action_plan_version", { p_user_id: user_id });
    const version = versionData || 1;

    const { error: insertError } = await supabase.from("action_plans").insert({
      user_id,
      assessment_id: assessment_id || null,
      version,
      today_actions: todayActions,
      sequence_explanation: sequenceExplanation,
      retest_schedule: retestSchedule,
      status: "active",
      voice_validation_status: voiceValidationStatus,
      voice_validation_warnings: voiceValidationWarnings,
    });

    if (insertError) {
      console.error("Failed to persist action plan:", insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        version,
        today_actions: todayActions,
        sequence_explanation: sequenceExplanation,
        retest_schedule: retestSchedule,
        matched_count: matched.length,
        selected_count: selected.length,
        voice_validation_status: voiceValidationStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("generate-action-plan error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
