import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all profiles
    const { data: profiles, error: profilesErr } = await admin
      .from("profiles")
      .select("id, user_id, display_name, first_name, preferred_name, age, sex, signature_color, onboarding_step, onboarding_completed_at, created_at")
      .order("created_at", { ascending: false });

    if (profilesErr) throw profilesErr;

    // Fetch auth users (paginated)
    const emailMap = new Map<string, { email: string | null; created_at: string; last_sign_in_at: string | null }>();
    let page = 1;
    while (true) {
      const { data: usersPage, error: usersErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (usersErr) throw usersErr;
      for (const u of usersPage.users) {
        emailMap.set(u.id, {
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (usersPage.users.length < 1000) break;
      page++;
    }

    // Fetch role assignments
    const { data: roles } = await admin.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }

    const enriched = (profiles ?? []).map((p) => ({
      ...p,
      email: emailMap.get(p.user_id)?.email ?? null,
      auth_created_at: emailMap.get(p.user_id)?.created_at ?? null,
      last_sign_in_at: emailMap.get(p.user_id)?.last_sign_in_at ?? null,
      roles: roleMap.get(p.user_id) ?? [],
    }));

    return new Response(JSON.stringify({ profiles: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("admin-list-profiles error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
