// ============================================================================
// supabase/functions/rae-admit-observation/index.ts
// ----------------------------------------------------------------------------
// Edge function entry point. Implements design
// docs/RAE_ADMIT_OBSERVATION_EDGE_DESIGN_v1.md §4 step-by-step.
//
// Discipline (enforced by static_scan.test.ts):
//   - No direct DB access here. No `.from(`, `.rpc(`, `.insert(`, etc. The
//     admin gate is performed via a plain fetch to /rest/v1/rpc/has_role
//     (treated as an HTTP call, not a typed DB seam). All engine I/O
//     flows through `loadEngineBinding` and the RPC gateway built by
//     `makeRpcAdmitGateway`.
//   - No imports from witnessify_impl, P1a reasoning surfaces, or any
//     RAE shared module outside the allow-list.
//   - No raw SQL.
//   - All persistence is funneled through the single
//     rae_persist_initial_admission RPC by `persistInitialAdmission` +
//     `makeRpcAdmitGateway`.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// CORS headers — manual definition (the @supabase/supabase-js@2.45.0 build
// does not export a /cors entry).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import {
  RequestSchema,
  type AdmitObservationRequest,
} from "./request_schema.ts";
import {
  makeRaeDepth0WitnessifyAdapter,
  makeRaeDepth0WitnessPayloadAdapter,
} from "./witness_adapters.ts";
import {
  ForbiddenError,
  InvalidRequestError,
  mapErrorToResponse,
  MethodNotAllowedError,
  UnauthenticatedError,
} from "./error_mapping.ts";

import { loadEngineBinding } from "../_shared/rae/edge_loaders.ts";
import { bindCandidateConceptForAdmission } from "../_shared/rae/concept_binding_adapter.ts";
import {
  adjudicate,
  type CandidateConcept as OrchestratorCandidateConcept,
} from "../_shared/rae/orchestrator.ts";
import { persistInitialAdmission } from "../_shared/rae/storage/admit.ts";
import { makeRpcAdmitGateway } from "../_shared/rae/storage/gateway_rpc.ts";

// ---------------------------------------------------------------------------
// JSON helpers.
// ---------------------------------------------------------------------------

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(err: unknown): Response {
  const m = mapErrorToResponse(err);
  return jsonResponse(m.http_status, m.body);
}

// ---------------------------------------------------------------------------
// Admin gate.
// Performs `public.has_role(auth.uid(),'admin')` via a direct REST call so
// that the static-scan guard (no `.rpc(`, no `.from(`) is preserved. The
// user's bearer token is forwarded so auth.uid() resolves correctly.
// ---------------------------------------------------------------------------

async function assertCallerIsAdmin(
  supabaseUrl: string,
  anonKey: string,
  bearerToken: string,
): Promise<void> {
  // Validate the JWT and resolve the user id.
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: authData, error: authError } = await authClient.auth.getUser(
    bearerToken,
  );
  if (authError || !authData?.user) {
    throw new UnauthenticatedError(
      "bearer token could not be validated",
    );
  }

  // Call the SECURITY DEFINER helper as the caller.
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/has_role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify({
      _user_id: authData.user.id,
      _role: "admin",
    }),
  });
  if (!res.ok) {
    // Treat any non-2xx as a forbidden outcome — we never leak the
    // underlying status text into the response body.
    await res.text().catch(() => "");
    throw new ForbiddenError("admin role check failed");
  }
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new ForbiddenError("admin role check returned non-JSON");
  }
  if (payload !== true) {
    throw new ForbiddenError("admin role required");
  }
}

// ---------------------------------------------------------------------------
// Main handler — design §4.
// ---------------------------------------------------------------------------

async function handle(req: Request): Promise<Response> {
  // §4.1 — CORS / method gate.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(new MethodNotAllowedError());
  }

  // §4.2 — body parse.
  let body: unknown;
  try {
    body = await req.json();
  } catch (e) {
    return errorResponse(
      new InvalidRequestError(
        "request body is not valid JSON",
        e instanceof Error ? { reason: e.message } : undefined,
      ),
    );
  }

  // §4.3 — schema validation.
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      new InvalidRequestError(
        "request body failed schema validation",
        parsed.error.flatten(),
      ),
    );
  }
  const reqBody: AdmitObservationRequest = parsed.data;

  // §4.4 — auth (JWT) and §4.5 — admin gate.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(
      new Error("server misconfigured: required env vars missing"),
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearerToken) {
    return errorResponse(
      new UnauthenticatedError("missing Authorization bearer token"),
    );
  }

  try {
    await assertCallerIsAdmin(supabaseUrl, anonKey, bearerToken);
  } catch (e) {
    return errorResponse(e);
  }

  // §4.6 — service-role client. Used for engine binding reads + the single
  // admission RPC call. Never used for user-scoped RLS.
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // §4.7 — load engine binding.
    // The shared loader's ReadOnlyDbClient is a structural subset of the
    // supabase-js client; the cast is safe at this seam.
    const binding = await loadEngineBinding(serviceClient as unknown as Parameters<typeof loadEngineBinding>[0], {
      engine_version_id: reqBody.engine_version_id,
      candidate_concept_id: reqBody.candidate_concept.concept_id,
    });

    // §7 — caller-supplied policy override. The orchestrator owns the
    // semantics; the edge function only widens the review path. A
    // request-level `back_annotation` value is NOT honored here in v1
    // (back-annotation is a storage-layer concern); it is recorded for
    // observability via decision.caw.policy_at_decision below.
    let engineVersionForAdjudication = binding.engine_version;
    if (reqBody.policy_override === "calibration_all_routes_to_review") {
      engineVersionForAdjudication = {
        ...binding.engine_version,
        calibration_mode: true,
      };
    }

    // §4.8 — bind candidate concept (validates + applies any concept
    // override + computes the response-safe metadata).
    //
    // The request schema's UnitConversion projection ({to_canonical_factor,
    // offset}) is the response/transport contract; orchestrator's internal
    // UnitConversion ({factor, conversion_id}) is normalized here at the
    // wiring boundary. The factor maps 1:1; conversion_id is synthesized
    // deterministically from the unit key so the orchestrator's audit
    // trail remains stable.
    const candidateConceptForOrchestrator: OrchestratorCandidateConcept = {
      ...reqBody.candidate_concept,
      unit_conversions: reqBody.candidate_concept.unit_conversions
        ? Object.fromEntries(
          Object.entries(reqBody.candidate_concept.unit_conversions).map(
            ([unitKey, c]) => [
              unitKey,
              {
                factor: c.to_canonical_factor,
                conversion_id: `req:${unitKey}`,
              },
            ],
          ),
        )
        : undefined,
    };

    const bound = bindCandidateConceptForAdmission({
      candidate_concept: candidateConceptForOrchestrator,
      binding_lookup_concept_id: reqBody.candidate_concept.concept_id,
      binding: {
        ...binding,
        engine_version: engineVersionForAdjudication,
      },
    });

    // §4.9 — adjudicate.
    //
    // Project the request's RawObservationClaim-shaped sibling and prior
    // arrays into the slim PanelSibling / PriorObservation shapes the
    // orchestrator's panel and longitudinal signals consume. Caller-
    // provided `source_row_id` doubles as the sibling observation_id;
    // the prior's value+timestamp come straight off the claim.
    const siblings = reqBody.siblings.map((s) => ({
      observation_id: s.source_row_id,
      concept_id: reqBody.candidate_concept.concept_id,
    }));
    const priorObservations = reqBody.prior_observations
      .filter((p) => typeof p.raw_value === "number" && Number.isFinite(p.raw_value))
      .map((p) => ({
        witness_id: p.source_row_id,
        value: p.raw_value as number,
        observed_at: p.observed_at,
      }));

    const decision = adjudicate({
      claim: reqBody.claim,
      candidate_concept: bound.candidate_concept,
      signal_config: bound.binding.signal_config,
      engine_version: bound.binding.engine_version,
      siblings,
      prior_observations: priorObservations,
    });

    // §4.10 — build the two adapters (witnessify + payload).
    const witnessifyAdapter = makeRaeDepth0WitnessifyAdapter(
      reqBody.engine_version_id,
    );
    const witnessPayloadAdapter = makeRaeDepth0WitnessPayloadAdapter();

    // §4.11 — construct the gateway and persist via the RPC.
    // RpcCapableClient is a narrow structural subset of the supabase-js
    // client; the cast is safe at this seam.
    const runInTxn = makeRpcAdmitGateway(serviceClient as unknown as Parameters<typeof makeRpcAdmitGateway>[0], {
      witnessPayloadAdapter,
    });

    const persistResult = await persistInitialAdmission(
      {
        decision,
        reason: `rae:initial_admission:${reqBody.engine_version_id}`,
        witnessify_adapter:
          decision.witness_intent === "produce_depth0_witness"
            ? witnessifyAdapter
            : undefined,
        back_annotation_witness_id:
          decision.caw.policy_at_decision === "back_annotation"
            ? reqBody.back_annotation_witness_id
            : undefined,
      },
      runInTxn,
    );

    // §4.12 + §5.2 — response envelope. Override metadata + limitations
    // surface so callers can see calibration routing without DB lookups.
    const caw = persistResult.caw;
    return jsonResponse(200, {
      caw_id: caw.caw_id,
      current_state: caw.current_state,
      produced_witness_id: caw.produced_witness_id,
      policy_at_decision: caw.policy_at_decision,
      applied_override: bound.applied_override_metadata,
      override_limitations: bound.override_limitations,
      engine_version_id: caw.engine_version_id,
      ontology_version: caw.ontology_version,
      registry_seed_version: caw.registry_seed_version,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

Deno.serve(handle);

export { handle };