// ============================================================================
// admin-view-as-mint — server-enforced view-as session minting
//
// Purpose: replace frontend-chosen view-as with a proper session model.
//
// Flow:
//   1. Admin POSTs { target_user_id, reason, duration_minutes? } to this function
//   2. Function validates:
//      - Caller is authenticated
//      - Caller has admin role (checked against user_roles at DB layer)
//      - target_user_id exists and is a different user
//      - reason is at least 10 characters (meaningful)
//      - duration is within allowed bounds (max 4 hours)
//   3. Creates admin_view_as_sessions row
//   4. Writes session_minted audit event
//   5. Returns session_id, expires_at
//
// The frontend then sends session_id with subsequent view-as operations.
// Other edge functions (export-celf-bundle, etc.) validate by calling
// has_valid_view_as_session(auth.uid(), target_user_id).
//
// Actions on the session:
//   - GET /admin-view-as-mint/current?target_user_id=<uuid>  → fetches active session
//   - POST /admin-view-as-mint                                → mints new session
//   - DELETE /admin-view-as-mint/<session_id>                 → revokes session early
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
};

const MAX_DURATION_MINUTES = 240;      // 4 hours
const DEFAULT_DURATION_MINUTES = 60;   // 1 hour default
const MIN_REASON_LENGTH = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization") ?? "";

    // Authenticate the caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData.user) {
      return json({ error: "unauthorized" }, 401);
    }
    const adminUserId = authData.user.id;

    // Validate admin role — check database, not client claims
    const { data: role } = await userClient
      .from("user_roles").select("role").eq("user_id", adminUserId).eq("role", "admin").maybeSingle();
    if (!role) {
      return json({ error: "forbidden", message: "Admin role required" }, 403);
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const url = new URL(req.url);

    // -----------------------------------------------------------------------
    // GET /current?target_user_id=<uuid> — fetch active session (if any)
    // -----------------------------------------------------------------------
    if (req.method === "GET") {
      const targetUserId = url.searchParams.get("target_user_id");
      if (!targetUserId) {
        return json({ error: "target_user_id required" }, 400);
      }

      const { data: session } = await sb
        .from("admin_view_as_sessions")
        .select("id, granted_at, expires_at, reason, access_count, last_accessed_at")
        .eq("admin_user_id", adminUserId)
        .eq("target_user_id", targetUserId)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("granted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return json({ session });
    }

    // -----------------------------------------------------------------------
    // POST — mint a new session
    // -----------------------------------------------------------------------
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { target_user_id, reason, duration_minutes } = body as {
        target_user_id?: string;
        reason?: string;
        duration_minutes?: number;
      };

      // Validate inputs
      if (!target_user_id) {
        return json({ error: "target_user_id required" }, 400);
      }
      if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
        return json({
          error: "reason required",
          message: `Reason must be at least ${MIN_REASON_LENGTH} characters. This is logged for audit purposes.`,
        }, 400);
      }

      const duration = Math.min(
        Math.max(duration_minutes ?? DEFAULT_DURATION_MINUTES, 5),
        MAX_DURATION_MINUTES,
      );
      const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();

      // Accept either profiles.user_id (preferred) or profiles.id, then normalize to user_id.
      const { data: targetProfile } = await sb
        .from("profiles")
        .select("id, user_id")
        .or(`user_id.eq.${target_user_id},id.eq.${target_user_id}`)
        .maybeSingle();
      if (!targetProfile?.user_id) {
        return json({ error: "target user not found" }, 404);
      }

      const normalizedTargetUserId = targetProfile.user_id;
      if (normalizedTargetUserId === adminUserId) {
        return json({ error: "cannot impersonate self" }, 400);
      }

      // Revoke any existing active sessions for this admin→target pair (one at a time)
      await sb
        .from("admin_view_as_sessions")
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: adminUserId,
          revoke_reason: "superseded by new session",
        })
        .eq("admin_user_id", adminUserId)
        .eq("target_user_id", normalizedTargetUserId)
        .is("revoked_at", null);

      // Mint new session
      const { data: session, error: mintErr } = await sb
        .from("admin_view_as_sessions")
        .insert({
          admin_user_id: adminUserId,
          target_user_id: normalizedTargetUserId,
          reason: reason.trim(),
          expires_at: expiresAt,
        })
        .select("id, granted_at, expires_at")
        .single();
      if (mintErr) throw new Error(`mint failed: ${mintErr.message}`);

      // Audit log
      await sb.from("admin_view_as_audit").insert({
        session_id: session.id,
        admin_user_id: adminUserId,
        target_user_id,
        event_type: "session_minted",
        event_detail: {
          reason: reason.trim(),
          duration_minutes: duration,
          expires_at: expiresAt,
        },
      });

      return json({
        session_id: session.id,
        granted_at: session.granted_at,
        expires_at: session.expires_at,
        duration_minutes: duration,
      });
    }

    // -----------------------------------------------------------------------
    // DELETE /<session_id> — revoke an active session early
    // -----------------------------------------------------------------------
    if (req.method === "DELETE") {
      const parts = url.pathname.split("/").filter(Boolean);
      const sessionId = parts[parts.length - 1];
      if (!sessionId || sessionId === "admin-view-as-mint") {
        return json({ error: "session_id required in path" }, 400);
      }

      const body = await req.json().catch(() => ({}));
      const revokeReason = (body as any)?.reason ?? "explicit revocation by admin";

      const { data: session } = await sb
        .from("admin_view_as_sessions")
        .select("id, admin_user_id, target_user_id, revoked_at")
        .eq("id", sessionId).maybeSingle();
      if (!session) {
        return json({ error: "session not found" }, 404);
      }
      if (session.admin_user_id !== adminUserId) {
        return json({ error: "forbidden: not your session" }, 403);
      }
      if (session.revoked_at) {
        return json({ error: "session already revoked" }, 400);
      }

      await sb
        .from("admin_view_as_sessions")
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: adminUserId,
          revoke_reason: revokeReason,
        })
        .eq("id", sessionId);

      await sb.from("admin_view_as_audit").insert({
        session_id: sessionId,
        admin_user_id: adminUserId,
        target_user_id: session.target_user_id,
        event_type: "session_revoked",
        event_detail: { reason: revokeReason },
      });

      return json({ revoked: true, session_id: sessionId });
    }

    return json({ error: "method not allowed" }, 405);

  } catch (e: any) {
    console.error("[admin-view-as-mint] error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
