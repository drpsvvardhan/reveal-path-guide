// Shared authentication helpers for edge functions.
// Verifies the caller's JWT and enforces owner-or-admin (with view-as session) access.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AuthResult {
  callerUserId: string;
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
}

export interface AuthError {
  status: number;
  body: { error: string; message?: string };
}

export async function authenticateRequest(
  req: Request,
): Promise<{ ok: true; auth: AuthResult } | { ok: false; error: AuthError }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, error: { status: 401, body: { error: "unauthorized" } } };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    return { ok: false, error: { status: 401, body: { error: "unauthorized" } } };
  }

  const serviceClient = createClient(supabaseUrl, serviceKey);
  return {
    ok: true,
    auth: { callerUserId: data.user.id, userClient, serviceClient },
  };
}

// Resolve which user_id the caller is permitted to operate on.
// - If requestedUserId is null or equals callerUserId, returns callerUserId.
// - Otherwise the caller must be an admin AND have an active view-as session for that user.
export async function resolveTargetUserId(
  auth: AuthResult,
  requestedUserId: string | null | undefined,
): Promise<{ ok: true; targetUserId: string; isViewAs: boolean } | { ok: false; error: AuthError }> {
  const { callerUserId, userClient } = auth;
  if (!requestedUserId || requestedUserId === callerUserId) {
    return { ok: true, targetUserId: callerUserId, isViewAs: false };
  }

  const { data: roleData } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerUserId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleData) {
    return { ok: false, error: { status: 403, body: { error: "forbidden", message: "Admin role required" } } };
  }

  const { data: hasSession } = await userClient.rpc("has_valid_view_as_session", {
    p_admin_user_id: callerUserId,
    p_target_user_id: requestedUserId,
  });
  if (!hasSession) {
    return {
      ok: false,
      error: {
        status: 403,
        body: { error: "no_view_as_session", message: "An active view-as session is required to operate on another user's data." },
      },
    };
  }

  return { ok: true, targetUserId: requestedUserId, isViewAs: true };
}

// Resolve target user_id from a patient_id (profiles.id).
export async function resolveUserIdFromPatientId(
  serviceClient: SupabaseClient,
  patientId: string,
): Promise<string | null> {
  const { data } = await serviceClient
    .from("profiles")
    .select("user_id")
    .eq("id", patientId)
    .maybeSingle();
  return data?.user_id ?? null;
}

// Resolve target user_id from a cie_assessments.id.
export async function resolveUserIdFromAssessmentId(
  serviceClient: SupabaseClient,
  assessmentId: string,
): Promise<string | null> {
  const { data } = await serviceClient
    .from("cie_assessments")
    .select("user_id")
    .eq("id", assessmentId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
