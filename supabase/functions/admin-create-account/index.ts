// ============================================================================
// admin-create-account
// ----------------------------------------------------------------------------
// Admin-only account provisioning. Creates a confirmed auth account with a
// temporary password so an operator can stand up a new outlay/patient without
// waiting on an email round-trip, then fills the profile fields the app reads.
//
// The profile row itself is created by the existing on_auth_user_created
// trigger; this function only updates it. Roles are never written to profiles.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_SEX = ["female", "male", "other", "prefer_not_to_say"];
const ALLOWED_ROLES = ["admin", "moderator", "user"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return json({ error: "forbidden", message: "Admin role required." }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) {
    return json({ error: "invalid_email" }, 400);
  }
  if (password.length < 10 || password.length > 128) {
    return json({ error: "invalid_password", message: "Password must be 10-128 characters." }, 400);
  }

  const str = (key: string, max: number): string | null => {
    const v = payload[key];
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length === 0 ? null : t.slice(0, max);
  };

  const displayName = str("display_name", 120);
  const firstName = str("first_name", 80);
  const preferredName = str("preferred_name", 80);
  const sexRaw = str("sex", 32);
  const sex = sexRaw && ALLOWED_SEX.includes(sexRaw) ? sexRaw : null;
  const ageRaw = payload.age;
  const ageNum = typeof ageRaw === "number" ? ageRaw : Number(ageRaw);
  const age = Number.isInteger(ageNum) && ageNum > 0 && ageNum < 130 ? ageNum : null;
  const roleRaw = str("role", 32);
  const role = roleRaw && ALLOWED_ROLES.includes(roleRaw) ? roleRaw : null;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName ?? firstName ?? email },
  });
  if (createErr || !created?.user) {
    return json(
      { error: "create_user_failed", message: createErr?.message ?? "unknown error" },
      createErr?.status === 422 ? 409 : 500,
    );
  }

  const newUserId = created.user.id;

  const profilePatch: Record<string, unknown> = {};
  if (displayName) profilePatch.display_name = displayName;
  if (firstName) profilePatch.first_name = firstName;
  if (preferredName) profilePatch.preferred_name = preferredName;
  if (sex) profilePatch.sex = sex;
  if (age !== null) profilePatch.age = age;

  let profileWarning: string | null = null;
  if (Object.keys(profilePatch).length > 0) {
    const { error: profileErr } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("user_id", newUserId);
    if (profileErr) profileWarning = profileErr.message;
  }

  let roleWarning: string | null = null;
  if (role && role !== "user") {
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: newUserId, role });
    if (roleErr) roleWarning = roleErr.message;
  }

  return json({
    created: true,
    user_id: newUserId,
    email,
    role_assigned: role && role !== "user" && !roleWarning ? role : null,
    profile_warning: profileWarning,
    role_warning: roleWarning,
  });
});