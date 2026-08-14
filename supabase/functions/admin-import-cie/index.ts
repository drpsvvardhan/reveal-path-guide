// ============================================================================
// admin-import-cie
// ----------------------------------------------------------------------------
// Admin-only bootstrap of an already-taken factory CIE assessment
// (question.json from the CodexOS intake pipeline) for a named account, so a
// patient whose CIE was captured in the factory never retakes Layer 1 in the
// app. Periodic in-app retakes are unaffected — each import or retake is its
// own versioned assessment.
//
// No LLM. Factory scores are authoritative (see cieFactoryImport.ts); the
// witness projection reuses the exact code path of a natively-taken
// assessment.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  validateFactoryCiePayload,
  mapFactoryCie,
  type FactoryCiePayload,
} from "../_shared/cieFactoryImport.ts";
import {
  witnessifyCompletedCieAssessment,
  type CieWitnessSummary,
} from "../_shared/cieWitnessify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { data: roleRow } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "forbidden", message: "Admin role required." }, 403);

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const targetUserId = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) {
    return json({ error: "invalid_target_user", message: "Provide the target account's user_id." }, 400);
  }

  const { data: targetProfile } = await serviceClient
    .from("profiles")
    .select("user_id")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!targetProfile) {
    return json({ error: "target_not_found", message: "No profile exists for that account." }, 404);
  }

  const cieJson = payload.cie_json;
  const validation = validateFactoryCiePayload(cieJson);
  if (!validation.valid) {
    return json({ error: "invalid_cie_payload", messages: validation.errors }, 400);
  }

  // Optional: the date the assessment was actually taken. Without it the
  // import timestamp is used, and the witness testimony reflects import
  // time rather than intake time.
  const takenAtRaw = typeof payload.taken_at === "string" ? payload.taken_at.trim() : "";
  const takenAt = /^\d{4}-\d{2}-\d{2}/.test(takenAtRaw)
    ? new Date(takenAtRaw).toISOString()
    : new Date().toISOString();

  // ── Create the versioned assessment ──
  const { data: versionData, error: vErr } = await serviceClient.rpc("next_cie_version", {
    p_user_id: targetUserId,
  });
  if (vErr) return json({ error: "version_allocation_failed", message: vErr.message }, 500);

  const { data: assessment, error: aErr } = await serviceClient
    .from("cie_assessments")
    .insert({
      user_id: targetUserId,
      version: versionData ?? 1,
      status: "complete",
      layer1_completed_at: takenAt,
      layer2_completed_at: takenAt,
      full_completed_at: takenAt,
    })
    .select("id, user_id, status, full_completed_at, layer1_completed_at, created_at, version")
    .single();
  if (aErr || !assessment) {
    return json({ error: "assessment_insert_failed", message: aErr?.message }, 500);
  }

  const mapped = mapFactoryCie(cieJson as FactoryCiePayload, {
    assessmentId: assessment.id,
    userId: targetUserId,
  });

  // ── Persist rows; any failure rolls the assessment back (cascade) ──
  const fail = async (step: string, message: string | undefined) => {
    await serviceClient.from("cie_assessments").delete().eq("id", assessment.id);
    return json({ error: `${step}_failed`, message }, 500);
  };

  const { error: rErr } = await serviceClient.from("cie_responses").insert(mapped.responseRows);
  if (rErr) return await fail("responses_insert", rErr.message);

  const { error: dErr } = await serviceClient.from("cie_domain_scores").insert(mapped.domainRows);
  if (dErr) return await fail("domain_scores_insert", dErr.message);

  const { error: gErr } = await serviceClient.from("cie_gate_scores").insert(mapped.gateRows);
  if (gErr) return await fail("gate_scores_insert", gErr.message);

  const { error: uErr } = await serviceClient
    .from("cie_assessments")
    .update({
      total_questions_answered: mapped.totalQuestions,
      triggered_domains: mapped.triggeredDomains,
    })
    .eq("id", assessment.id);
  if (uErr) return await fail("assessment_update", uErr.message);

  // ── Witness projection — identical path to a natively-taken assessment ──
  let witnessSummary: CieWitnessSummary | null = null;
  let witnessError: string | null = null;
  try {
    witnessSummary = await witnessifyCompletedCieAssessment(serviceClient, {
      id: assessment.id,
      user_id: assessment.user_id,
      status: "complete",
      full_completed_at: takenAt,
      layer1_completed_at: takenAt,
      created_at: assessment.created_at,
    });
  } catch (err) {
    witnessError = err instanceof Error ? err.message : String(err);
    console.error("CIE_IMPORT_WITNESS_FAILED:", witnessError);
  }

  return json({
    imported: true,
    assessment_id: assessment.id,
    version: assessment.version,
    customer_id: mapped.customerId,
    responses: mapped.responseRows.length,
    domains: mapped.domainRows.length,
    gates: mapped.gateRows.length,
    triggered_domains: mapped.triggeredDomains,
    taken_at: takenAt,
    diagnostics: mapped.diagnostics,
    cie_witnesses: witnessSummary,
    witness_error: witnessError,
  });
});
