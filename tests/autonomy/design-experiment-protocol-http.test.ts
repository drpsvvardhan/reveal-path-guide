// @vitest-environment node
// Exercises the actual design-experiment-protocol HTTP handler. Authentication
// and the database transport are isolated; the admission context loader is
// stubbed here and tested separately in admission-context.test.ts.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, postRequest, stubDenoServe, type FakeDb } from "./harness";

const { authenticate, resolveTarget, loadContext } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  resolveTarget: vi.fn(),
  loadContext: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/auth.ts", () => ({
  authenticateRequest: authenticate,
  resolveTargetUserId: resolveTarget,
  jsonResponse: (body: unknown, status: number, headers: Record<string, string>) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json" } }),
}));

vi.mock("../../supabase/functions/_shared/autonomy/admissionContext.ts", () => ({
  loadAdmissionContext: loadContext,
}));

const patient = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

let handler: (req: Request) => Promise<Response>;
let db: FakeDb;

function readableContext(overrides: Record<string, unknown> = {}) {
  return {
    biomarkers: ["ldl_c"],
    flags: [],
    available: true,
    cieSafetyHold: false,
    cieRecheckPending: false,
    fingerprint: "sha256:context-fingerprint",
    sources: {
      lab_observations: 4,
      inbody_observations: 0,
      fibroscan_observations: 0,
      cie_domain_scores: 0,
      cie_gate_scores: 0,
      cie33_sessions_inspected: 1,
    },
    unavailable_reason: null,
    ...overrides,
  };
}

const canonicalWalk = {
  template_id: "morning_walk",
  intervention: {
    duration_min: 25,
    timing: "morning",
    frequency: "daily",
    intensity: "conversational_pace",
  },
  primary_outcome: { source: "manual", name: "energy", direction: "increase", cadence: "daily" },
  intervention_days: 21,
  run_in_days: 0,
};

const post = (payload: Record<string, unknown>) =>
  handler(postRequest("https://test.invalid/design-experiment-protocol", payload));

beforeAll(async () => {
  const holder = stubDenoServe();
  await import("../../supabase/functions/design-experiment-protocol/index.ts");
  handler = holder.current!;
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  db = createFakeDb({
    simulator_what_if_cards: [
      {
        id: "card-own",
        user_id: patient,
        admission_verdict: "ADMIT",
        patient_safe: true,
        safety_flags: [],
        predicted_deltas: [{ biomarker: "ldl_c", confidence: 0.4 }],
        source_cluster_ids: ["cl-1"],
        source_terrain_render_id: "render-1",
        committed_experiment_id: null,
      },
      {
        id: "card-held",
        user_id: patient,
        admission_verdict: "BLOCK",
        patient_safe: false,
        safety_flags: ["unresolved_anaemia"],
        predicted_deltas: [],
        source_cluster_ids: [],
        source_terrain_render_id: null,
        committed_experiment_id: null,
      },
      {
        id: "card-foreign",
        user_id: other,
        admission_verdict: "ADMIT",
        patient_safe: true,
        safety_flags: [],
        predicted_deltas: [],
        source_cluster_ids: [],
        source_terrain_render_id: null,
        committed_experiment_id: null,
      },
    ],
    simulator_experiments: [],
    simulator_experiment_protocols: [],
  });
  authenticate.mockResolvedValue({
    ok: true,
    auth: { callerUserId: patient, serviceClient: { from: db.from, rpc: db.rpc } },
  });
  resolveTarget.mockResolvedValue({ ok: true, targetUserId: patient, isViewAs: false });
  loadContext.mockResolvedValue(readableContext());
});

describe("identity and reference binding", () => {
  it("refuses an unauthenticated request", async () => {
    authenticate.mockResolvedValue({ ok: false, error: { status: 401, body: { error: "unauthorized" } } });
    const res = await post(canonicalWalk);
    expect(res.status).toBe(401);
    expect(db.writesTo("simulator_experiments")).toHaveLength(0);
  });

  it("refuses a source suggestion belonging to another account", async () => {
    const res = await post({ ...canonicalWalk, source_card_id: "card-foreign" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("source_card_not_found");
    expect(db.writesTo("simulator_experiments")).toHaveLength(0);
  });

  it("writes the experiment for the resolved owner, not the body's user_id", async () => {
    const res = await post({ ...canonicalWalk, user_id: other });
    expect(res.status).toBe(200);
    expect(db.tables.simulator_experiments[0].user_id).toBe(patient);
  });

  it("rejects a malformed free-form request with the missing fields named", async () => {
    const res = await post({ lever: "walk more" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_fields");
    expect(body.missing).toContain("hypothesis_question");
  });
});

describe("server-computed admission", () => {
  it("creates an ordinary ready-made plan that is cleared to start", async () => {
    const res = await post(canonicalWalk);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.admission.verdict).toBe("ADMIT");
    expect(body.admission.activation_allowed).toBe(true);
    expect(body.protocol.activation_allowed).toBe(true);
    expect(body.protocol.template_id).toBe("morning_walk");
    expect(body.protocol.admission_context_fingerprint).toBe("sha256:context-fingerprint");
    expect(body.executable_sha256).toMatch(/^sha256:/);
  });

  it("ignores client-supplied admission, review and safety flags", async () => {
    const res = await post({
      ...canonicalWalk,
      template_id: null,
      lever: "Double my atorvastatin",
      rationale: "because my LDL is high",
      hypothesis_question: "Would a higher dose help?",
      perturbation_category: "food",
      clinician_review_required: false,
      admission_verdict: "ADMIT",
      activation_allowed: true,
      patient_safe: true,
      confidence: 0.99,
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.admission.activation_allowed).toBe(false);
    expect(body.protocol.activation_allowed).toBe(false);
    expect(body.protocol.clinician_review_required).toBe(true);
    expect(body.protocol.admission_verdict).not.toBe("ADMIT");
  });

  it("stores unsafe custom wording as a non-executable proposal even under a valid template id", async () => {
    const res = await post({
      ...canonicalWalk,
      lever: "Walk, and start taking 40mg of rosuvastatin",
      rationale: "smuggled",
      hypothesis_question: "Would this help me?",
      perturbation_category: "movement",
      intervention: { ...canonicalWalk.intervention, extra_drug: "rosuvastatin 40mg" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.admission.activation_allowed).toBe(false);
    expect(body.protocol.template_id).toBeNull();
  });

  it("does not release a held source suggestion through a ready-made plan", async () => {
    const res = await post({ ...canonicalWalk, source_card_id: "card-held" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.admission.verdict).toBe("BLOCK");
    expect(body.admission.activation_allowed).toBe(false);
    expect(body.protocol.activation_allowed).toBe(false);
  });

  it("saves rather than starts when the safety context cannot be read", async () => {
    loadContext.mockResolvedValue(
      readableContext({ available: false, biomarkers: [], fingerprint: "unavailable", unavailable_reason: "cie33_sessions unreadable" }),
    );
    const res = await post(canonicalWalk);
    const body = await res.json();
    expect(body.admission.activation_allowed).toBe(false);
    expect(body.admission.scope).toBe("safety_check_unavailable");
    expect(body.protocol.admission_context.unavailable_reason).toBe("cie33_sessions unreadable");
  });

  it("does not start a plan during a CIE safety handoff", async () => {
    loadContext.mockResolvedValue(readableContext({ cieSafetyHold: true }));
    const res = await post(canonicalWalk);
    const body = await res.json();
    expect(body.admission.activation_allowed).toBe(false);
    expect(body.admission.scope).toBe("cie_safety_handoff");
  });

  it("takes predictions and terrain references from the verified card, never the body", async () => {
    const res = await post({
      template_id: null,
      lever: "Walk after dinner",
      rationale: "curious",
      hypothesis_question: "Does an evening walk help my sleep?",
      perturbation_category: "movement",
      intervention: { duration_min: 20 },
      primary_outcome: { source: "manual", name: "sleep_quality", direction: "increase", cadence: "daily" },
      intervention_days: 21,
      run_in_days: 0,
      source_card_id: "card-own",
      source_cluster_ids: ["forged-cluster"],
      source_terrain_render_id: "forged-render",
      predicted_deltas: [{ biomarker: "forged", confidence: 1 }],
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.experiment.source_cluster_ids).toEqual(["cl-1"]);
    expect(body.experiment.source_terrain_render_id).toBe("render-1");
    expect(body.experiment.predicted_deltas).toEqual([{ biomarker: "ldl_c", confidence: 0.4 }]);
  });
});
