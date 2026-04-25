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

import {
  loadEngineBinding,
  loadRegistryWitnessFields,
  type RegistryWitnessFields,
} from "../_shared/rae/edge_loaders.ts";
import { bindCandidateConceptForAdmission } from "../_shared/rae/concept_binding_adapter.ts";
import {
  adjudicate,
  type CandidateConcept as OrchestratorCandidateConcept,
} from "../_shared/rae/orchestrator.ts";
import { persistInitialAdmission } from "../_shared/rae/storage/admit.ts";
import { makeRpcAdmitGateway } from "../_shared/rae/storage/gateway_rpc.ts";

// ---------------------------------------------------------------------------
// Local typed seam helpers (P6).
// ---------------------------------------------------------------------------
// loadEngineBinding and makeRpcAdmitGateway each accept a structural
// subset of the supabase-js client. We narrow the supabase-js client to
// those subsets here so that the rest of the handler never needs an
// `as unknown as` escape hatch. Casts are confined to this module.

type ReadOnlyDbClientShape = Parameters<typeof loadEngineBinding>[0];
type RpcCapableClientShape = Parameters<typeof makeRpcAdmitGateway>[0];
/**
 * Map a RAE source observation table + ontology concept id to the
 * (source_window, signal) pair used to look up the P1a
 * witness_signal_registry row. RAE never invents these — the lookup
 * key is the same shape P1a witnessify-observations consumes.
 *
 * Pure helper; tested in index.test.ts.
 */
export function deriveRegistryLookupKey(
  source_table: string,
  candidate_concept_id: string,
): { source_window: string; signal: string } {
  let source_window: string;
  switch (source_table) {
    case "patient_lab_observations":
      source_window = "lab";
      break;
    case "patient_inbody_metrics":
    case "patient_inbody_observations":
      source_window = "inbody";
      break;
    case "patient_fibroscan_metrics":
    case "patient_fibroscan_observations":
      source_window = "fibroscan";
      break;
    default:
      // Unmapped source table => caller will get RegistryGapError on the
      // subsequent registry lookup. We do NOT invent a source_window; we
      // forward the raw value so the gap message is debuggable.
      source_window = source_table;
  }
  return {
    source_window,
    signal: `${source_window}.${candidate_concept_id}`,
  };
}

// ---------------------------------------------------------------------------
// Transport → orchestrator projection helpers (P5).
// ---------------------------------------------------------------------------
// NOTE (D-10): The request schema is intentionally kept as a thin transport
// contract over the orchestrator's CandidateConcept/PanelSibling/PriorObservation
// shapes. The remaining shape drift is confined to the three pure helpers
// below — projectCandidateConcept, projectSiblings, projectPriorObservations
// — each of which is unit-tested in index.test.ts. This is the only
// approved, documented "temporary transport adapter" surface; no schema
// drift is hidden inline elsewhere in this file.
//

function toReadOnlyDbClient(client: unknown): ReadOnlyDbClientShape {
  return client as ReadOnlyDbClientShape;
}

function toRpcCapableClient(client: unknown): RpcCapableClientShape {
  return client as RpcCapableClientShape;
}

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
// Transport → orchestrator projection helpers (P5).
// ---------------------------------------------------------------------------
// The request schema is a transport contract; the orchestrator consumes
// slimmer / differently-named shapes. Each helper below is the single
// site of that translation. They are pure and synchronous.

/**
 * Project the request's CandidateConcept into the orchestrator's shape.
 * The only difference is `unit_conversions[unit].{to_canonical_factor,
 * offset}` (transport) -> `{factor, conversion_id}` (orchestrator).
 * `conversion_id` is synthesized deterministically per unit key so the
 * orchestrator's audit trail is stable for repeated requests.
 */
export function projectCandidateConcept(
  cc: AdmitObservationRequest["candidate_concept"],
): OrchestratorCandidateConcept {
  return {
    ...cc,
    unit_conversions: cc.unit_conversions
      ? Object.fromEntries(
        Object.entries(cc.unit_conversions).map(([unitKey, c]) => [
          unitKey,
          {
            factor: c.to_canonical_factor,
            conversion_id: `req:${unitKey}`,
          },
        ]),
      )
      : undefined,
  };
}

/**
 * Project request sibling claims into PanelSibling rows.
 * Per decision (4), siblings without `concept_id` are dropped silently and
 * the drop count is surfaced in the success response under
 * `diagnostics.dropped_siblings`. We never fabricate a concept_id from
 * the candidate concept.
 */
export function projectSiblings(
  siblings: AdmitObservationRequest["siblings"],
): { rows: Array<{ observation_id: string; concept_id: string }>; dropped: number } {
  const rows: Array<{ observation_id: string; concept_id: string }> = [];
  let dropped = 0;
  for (const s of siblings) {
    if (typeof s.concept_id === "string" && s.concept_id.length > 0) {
      rows.push({
        observation_id: s.source_row_id,
        concept_id: s.concept_id,
      });
    } else {
      dropped += 1;
    }
  }
  return { rows, dropped };
}

/**
 * Project request prior observations into orchestrator PriorObservation
 * rows. Drops entries missing a finite numeric raw_value; that count is
 * surfaced as `diagnostics.dropped_prior_observations`.
 */
export function projectPriorObservations(
  priors: AdmitObservationRequest["prior_observations"],
): { rows: Array<{ witness_id: string; value: number; observed_at: string }>; dropped: number } {
  const rows: Array<{ witness_id: string; value: number; observed_at: string }> = [];
  let dropped = 0;
  for (const p of priors) {
    if (typeof p.raw_value === "number" && Number.isFinite(p.raw_value)) {
      rows.push({
        witness_id: p.source_row_id,
        value: p.raw_value,
        observed_at: p.observed_at,
      });
    } else {
      dropped += 1;
    }
  }
  return { rows, dropped };
}

// ---------------------------------------------------------------------------
// Dependency-injection seam for tests.
// ----------------------------------------------------------------------------
// `handle()` accepts an optional `deps` object so the HTTP-level test in
// `index.test.ts` can swap the auth check, engine loader, orchestrator,
// gateway and persistence call without touching the network or the DB.
// Production callers pass nothing; the defaults wire to the real shared
// modules and the supabase-js client. This seam is the ONLY reason
// `handle()` is exported.
// ---------------------------------------------------------------------------

export interface HandleDeps {
  /** Resolves the JWT to a user id, or returns null on invalid token. */
  getUserIdFromJwt: (
    supabaseUrl: string,
    anonKey: string,
    bearerToken: string,
  ) => Promise<string | null>;
  /** Returns true iff the caller has the 'admin' role. */
  hasAdminRole: (
    supabaseUrl: string,
    anonKey: string,
    bearerToken: string,
    userId: string,
  ) => Promise<boolean>;
  /** Engine-binding loader (default = shared edge_loaders). */
  loadEngineBinding: typeof loadEngineBinding;
  /** Witness-signal-registry loader (default = shared edge_loaders). */
  loadRegistryWitnessFields: typeof loadRegistryWitnessFields;
  /** Concept-binding adapter (default = shared concept_binding_adapter). */
  bindCandidateConceptForAdmission: typeof bindCandidateConceptForAdmission;
  /** Orchestrator (default = shared orchestrator). */
  adjudicate: typeof adjudicate;
  /** Storage entry point (default = shared storage/admit). */
  persistInitialAdmission: typeof persistInitialAdmission;
  /** RPC gateway factory (default = shared storage/gateway_rpc). */
  makeRpcAdmitGateway: typeof makeRpcAdmitGateway;
  /** Service-role client factory. Returns the opaque client we cast at
   *  the seam helpers above. */
  makeServiceClient: (supabaseUrl: string, serviceRoleKey: string) => unknown;
}

function defaultGetUserIdFromJwt(
  supabaseUrl: string,
  anonKey: string,
  bearerToken: string,
): Promise<string | null> {
  const authClient = createClient(supabaseUrl, anonKey);
  return authClient.auth.getUser(bearerToken).then(({ data, error }) => {
    if (error || !data?.user) return null;
    return data.user.id;
  });
}

async function defaultHasAdminRole(
  supabaseUrl: string,
  anonKey: string,
  bearerToken: string,
  userId: string,
): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/has_role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify({ _user_id: userId, _role: "admin" }),
  });
  if (!res.ok) {
    await res.text().catch(() => "");
    return false;
  }
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return false;
  }
  return payload === true;
}

function defaultMakeServiceClient(
  supabaseUrl: string,
  serviceRoleKey: string,
): unknown {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

const DEFAULT_DEPS: HandleDeps = {
  getUserIdFromJwt: defaultGetUserIdFromJwt,
  hasAdminRole: defaultHasAdminRole,
  loadEngineBinding,
  loadRegistryWitnessFields,
  bindCandidateConceptForAdmission,
  adjudicate,
  persistInitialAdmission,
  makeRpcAdmitGateway,
  makeServiceClient: defaultMakeServiceClient,
};

// ---------------------------------------------------------------------------
// Main handler — design §4.
// ---------------------------------------------------------------------------

async function handle(
  req: Request,
  depsOverride?: Partial<HandleDeps>,
): Promise<Response> {
  const deps: HandleDeps = depsOverride
    ? { ...DEFAULT_DEPS, ...depsOverride }
    : DEFAULT_DEPS;

  // §4.1 — CORS / method gate.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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

  // Pairing precheck: back_annotation override REQUIRES a witness id.
  // The schema permits the witness id independently; we enforce the
  // pairing here so callers see a single 400 instead of a downstream 500.
  if (
    reqBody.policy_override === "back_annotation" &&
    !reqBody.back_annotation_witness_id
  ) {
    return errorResponse(
      new InvalidRequestError(
        "policy_override='back_annotation' requires back_annotation_witness_id",
      ),
    );
  }

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

  // JWT resolution.
  let userId: string | null;
  try {
    userId = await deps.getUserIdFromJwt(supabaseUrl, anonKey, bearerToken);
  } catch (e) {
    return errorResponse(e);
  }
  if (!userId) {
    return errorResponse(
      new UnauthenticatedError("bearer token could not be validated"),
    );
  }

  // Admin gate.
  let isAdmin: boolean;
  try {
    isAdmin = await deps.hasAdminRole(
      supabaseUrl,
      anonKey,
      bearerToken,
      userId,
    );
  } catch (e) {
    return errorResponse(e);
  }
  if (!isAdmin) {
    return errorResponse(new ForbiddenError("admin role required"));
  }

  // §4.6 — service-role client. Used for engine binding reads + the single
  // admission RPC call. Never used for user-scoped RLS.
  const serviceClient = deps.makeServiceClient(supabaseUrl, serviceRoleKey);

  try {
    // §4.7 — load engine binding.
    // toReadOnlyDbClient narrows the supabase-js client to the shared
    // loader's structural subset. The cast is confined to that helper.
    const binding = await deps.loadEngineBinding(toReadOnlyDbClient(serviceClient), {
      engine_version_id: reqBody.engine_version_id,
      candidate_concept_id: reqBody.candidate_concept.concept_id,
    });

    // Registry-derived witness ontology fields. RAE is a decision layer
    // over existing biological witnesses; the four witness ontology fields
    // (source_window, domain_of_access, epistemic_role, reliability_class)
    // come from the same witness_signal_registry P1a uses. Missing row =>
    // RegistryGapError (mapped to HTTP 422).
    const registryLookupKey = deriveRegistryLookupKey(
      reqBody.claim.source_table,
      reqBody.candidate_concept.concept_id,
    );
    const registryFields: RegistryWitnessFields =
      await deps.loadRegistryWitnessFields(toReadOnlyDbClient(serviceClient), {
        source_window: registryLookupKey.source_window,
        signal: registryLookupKey.signal,
        registry_seed_version: binding.engine_version.registry_seed_version,
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

    // §4.8 — bind candidate concept. Projection is performed by the
    // single-purpose helper above so this site stays declarative.
    const candidateConceptForOrchestrator = projectCandidateConcept(
      reqBody.candidate_concept,
    );

    const bound = deps.bindCandidateConceptForAdmission({
      candidate_concept: candidateConceptForOrchestrator,
      binding_lookup_concept_id: reqBody.candidate_concept.concept_id,
      binding: {
        ...binding,
        engine_version: engineVersionForAdjudication,
      },
    });

    // §4.9 — adjudicate.
    // Per decision (4): sibling rows without an explicit `concept_id` are
    // dropped (we do NOT fabricate from the candidate concept). Drop
    // counts surface in the response `diagnostics`.
    const { rows: siblings, dropped: dropped_siblings } = projectSiblings(
      reqBody.siblings,
    );
    const { rows: priorObservations, dropped: dropped_prior_observations } =
      projectPriorObservations(reqBody.prior_observations);

    const decision = deps.adjudicate({
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
      registryFields,
    );
    const witnessPayloadAdapter = makeRaeDepth0WitnessPayloadAdapter();

    // §4.11 — construct the gateway and persist via the RPC.
    // toRpcCapableClient narrows the supabase-js client to the gateway's
    // structural subset. The cast is confined to that helper.
    const runInTxn = deps.makeRpcAdmitGateway(toRpcCapableClient(serviceClient), {
      witnessPayloadAdapter,
    });

    const persistResult = await deps.persistInitialAdmission(
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
    // `diagnostics` carries non-fatal projection drops (decision 3+4).
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
      diagnostics: {
        dropped_siblings,
        dropped_prior_observations,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

// Only start the HTTP server when this module is the entry point.
// Importing index.ts from tests must not bind a port.
if (import.meta.main) {
  Deno.serve((req) => handle(req));
}

export { handle };