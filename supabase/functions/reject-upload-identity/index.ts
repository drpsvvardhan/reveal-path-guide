// ============================================================================
// reject-upload-identity
//
// Called when the user looks at the identity-confirmation modal and says
// "No, this isn't me." Hard-rejects the upload, writes the audit row,
// and (best-effort) removes the file from storage. Front end can also
// call this to delete a borderline pending upload.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { recordRejection } from "../_shared/uploadGuards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authData.user.id;

    const body = await req.json();
    const uploadId = body?.upload_id;
    if (!uploadId) {
      return new Response(JSON.stringify({ error: "missing upload_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    const { data: uploadRow, error: uErr } = await sb
      .from("patient_lab_uploads")
      .select("id, user_id, original_filename, storage_path, extracted_patient_name, name_match_score, content_sha256")
      .eq("id", uploadId)
      .eq("user_id", userId)
      .single();

    if (uErr || !uploadRow) {
      return new Response(JSON.stringify({ error: "upload_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up account name for the audit row.
    const { data: profile } = await sb
      .from("profiles")
      .select("display_name, first_name, preferred_name")
      .eq("user_id", userId)
      .maybeSingle();
    const accountName = profile?.display_name || profile?.first_name || profile?.preferred_name || null;

    // Wipe any partial observations (defensive — should not exist for an awaiting upload).
    await sb.from("patient_lab_observations").delete().eq("upload_id", uploadRow.id);

    // Mark rejected + write audit row.
    await recordRejection(sb, {
      userId,
      uploadId: uploadRow.id,
      fileName: uploadRow.original_filename,
      category: "identity_mismatch",
      detail: "User declined: not my report",
      accountHolderName: accountName,
      extractedPatientName: uploadRow.extracted_patient_name,
      nameMatchScore: uploadRow.name_match_score,
      contentSha256: uploadRow.content_sha256,
    });

    // Best-effort: delete the stored file.
    if (uploadRow.storage_path && uploadRow.storage_path !== "pending") {
      await sb.storage.from("lab-uploads").remove([uploadRow.storage_path]);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[reject-upload-identity] error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
