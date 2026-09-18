// ============================================================================
// clinician-authorization
// ----------------------------------------------------------------------------
// Administrative management of clinician review authority.
//
// Granting access is administrative. It is NOT a clinical decision and it does
// not, by itself, release any safety hold. Every grant is patient-scoped,
// expiring, revocable and audited, requires a credential-review reference plus
// an attestation, and can never be issued to the granting admin themselves.
// No role is inferred from client metadata.
// ============================================================================
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_WINDOW_DAYS = 365;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);

  const result = await authenticateRequest(req);
  if (!result.ok)
    return jsonResponse(result.error.body, result.error.status, cors);
  const actor = result.auth.callerUserId;
  const db = result.auth.serviceClient;

  const { data: adminRow } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", actor)
    .eq("role", "admin")
    .maybeSingle();
  if (!adminRow)
    return jsonResponse(
      { error: "forbidden", message: "Admin role required." },
      403,
      cors,
    );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }

  try {
    if (body.action === "list") {
      const { data, error } = await db
        .from("clinician_patient_authorizations")
        .select(
          "id, clinician_user_id, patient_user_id, credential_reference, credential_attestation, granted_by, granted_at, expires_at, revoked_at, revoked_by, revocation_reason",
        )
        .order("granted_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = [
        ...new Set(
          (data ?? []).flatMap((r) => [r.clinician_user_id, r.patient_user_id]),
        ),
      ];
      const { data: profiles } = ids.length
        ? await db
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", ids)
        : { data: [] as { user_id: string; display_name: string | null }[] };
      const names = new Map(
        (profiles ?? []).map((p) => [p.user_id, p.display_name]),
      );
      const now = Date.now();
      return jsonResponse(
        {
          authorizations: (data ?? []).map((r) => ({
            ...r,
            clinician_name: names.get(r.clinician_user_id) ?? null,
            patient_name: names.get(r.patient_user_id) ?? null,
            status: r.revoked_at
              ? "revoked"
              : Date.parse(r.expires_at) <= now
                ? "expired"
                : "active",
          })),
        },
        200,
        cors,
      );
    }

    if (body.action === "grant") {
      const clinician = String(body.clinician_user_id ?? "");
      const patient = String(body.patient_user_id ?? "");
      const credential = String(body.credential_reference ?? "").trim();
      const attestation = String(body.credential_attestation ?? "").trim();
      const days = Number(body.expires_in_days ?? 0);
      if (!uuid.test(clinician) || !uuid.test(patient))
        return jsonResponse(
          {
            error: "invalid_request",
            message: "Select both a clinician and a patient.",
          },
          400,
          cors,
        );
      if (clinician === patient)
        return jsonResponse(
          {
            error: "self_authorization_forbidden",
            message: "A person cannot be authorized to review their own intake.",
          },
          400,
          cors,
        );
      if (clinician === actor)
        return jsonResponse(
          {
            error: "self_grant_forbidden",
            message:
              "You cannot grant clinical review authority to your own account.",
          },
          403,
          cors,
        );
      if (credential.length < 3)
        return jsonResponse(
          {
            error: "credential_required",
            message: "Record the credential-review reference.",
          },
          400,
          cors,
        );
      if (attestation.length < 20)
        return jsonResponse(
          {
            error: "attestation_required",
            message:
              "Record who verified the credential and what was verified (at least 20 characters).",
          },
          400,
          cors,
        );
      if (!Number.isFinite(days) || days < 1 || days > MAX_WINDOW_DAYS)
        return jsonResponse(
          {
            error: "window_invalid",
            message: `Set an expiry between 1 and ${MAX_WINDOW_DAYS} days.`,
          },
          400,
          cors,
        );

      const { data, error } = await db.rpc("clinician_grant_authorization", {
        p_actor: actor,
        p_clinician: clinician,
        p_patient: patient,
        p_credential_reference: credential,
        p_credential_attestation: attestation,
        p_expires_at: new Date(Date.now() + days * 86400000).toISOString(),
      });
      if (error) throw error;
      return jsonResponse({ authorization: data }, 200, cors);
    }

    if (body.action === "revoke") {
      const id = String(body.authorization_id ?? "");
      const reason = String(body.reason ?? "").trim();
      if (!uuid.test(id))
        return jsonResponse({ error: "invalid_request" }, 400, cors);
      if (reason.length < 3)
        return jsonResponse(
          {
            error: "reason_required",
            message: "Record why this authority is being revoked.",
          },
          400,
          cors,
        );
      const { data, error } = await db.rpc("clinician_revoke_authorization", {
        p_actor: actor,
        p_authorization_id: id,
        p_reason: reason,
      });
      if (error) throw error;
      return jsonResponse({ authorization: data }, 200, cors);
    }

    if (body.action === "audit") {
      const id = String(body.authorization_id ?? "");
      if (!uuid.test(id))
        return jsonResponse({ error: "invalid_request" }, 400, cors);
      const { data, error } = await db
        .from("clinician_authorization_audit")
        .select("id, action, actor_user_id, occurred_at, detail")
        .eq("authorization_id", id)
        .order("occurred_at", { ascending: true });
      if (error) throw error;
      return jsonResponse({ audit: data ?? [] }, 200, cors);
    }

    return jsonResponse({ error: "unknown_action" }, 400, cors);
  } catch (error) {
    const message = (error as { message?: string })?.message ?? "";
    if (message.includes("ADMIN_REQUIRED") || message.includes("SELF_GRANT"))
      return jsonResponse({ error: "forbidden", message }, 403, cors);
    if (
      message.includes("AUTHORIZATION_WINDOW") ||
      message.includes("AUTHORIZATION_ALREADY_REVOKED") ||
      message.includes("AUTHORIZATION_NOT_FOUND") ||
      message.includes("cpa_")
    )
      return jsonResponse({ error: "invalid_request", message }, 400, cors);
    console.error("clinician-authorization failed", {
      code: (error as { code?: string })?.code ?? "internal",
    });
    return jsonResponse(
      {
        error: "authority_unavailable",
        message: "The authority register could not be updated. Retry.",
      },
      500,
      cors,
    );
  }
});
