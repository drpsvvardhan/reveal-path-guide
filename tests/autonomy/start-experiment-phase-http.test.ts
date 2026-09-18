// @vitest-environment node
// Exercises the actual start-experiment-phase HTTP handler: stopping always
// works, starting is re-admitted on current content and context, and stale or
// edited content cannot inherit an earlier decision.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, postRequest, stubDenoServe, type FakeDb, type Row } from "./harness";
import { buildCanonicalAction } from "../../supabase/functions/_shared/autonomy/actionPolicy.ts";
import { executableContentHash } from "../../supabase/functions/_shared/autonomy/protocolContent.ts";

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
let rpcCalls: { name: string; args: Row }[];
let rpcError: string | null;

function context(overrides: Record<string, unknown> = {}) {
  return {
    biomarkers: ["ldl_c"],
    flags: [],
    available: true,
    cieSafetyHold: false,
    cieRecheckPending: false,
    fingerprint: "sha256:ctx",
    sources: {
      lab_observations: 3,
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

const proposal = (() => {
  const built = buildCanonicalAction({
    template_id: "morning_walk",
    intervention: { duration_min: 25, timing: "morning", frequency: "daily", intensity: "conversational_pace" },
    primary_outcome: { source: "manual", name: "energy", direction: "increase", cadence: "daily" },
    intervention_days: 21,
    run_in_days: 0,
  });
  if (!built.ok) throw new Error(built.problems.join("; "));
  return built.proposal!;
})();

const post = (payload: Record<string, unknown>) =>
  handler(postRequest("https://test.invalid/start-experiment-phase", payload));

beforeAll(async () => {
  const holder = stubDenoServe();
  await import("../../supabase/functions/start-experiment-phase/index.ts");
  handler = holder.current!;
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(async () => {
  rpcCalls = [];
  rpcError = null;
  const experiment: Row = {
    id: "exp-1",
    user_id: patient,
    lever: proposal.lever,
    rationale: proposal.rationale,
    predicted_deltas: [],
    source_card_id: null,
    phase: "draft",
    status: "active",
  };
  const sha = await executableContentHash({ proposal, experiment });
  db = createFakeDb(
    {
      simulator_experiments: [
        experiment,
        { ...experiment, id: "exp-foreign", user_id: other },
        { ...experiment, id: "exp-stopped", phase: "stopped", status: "stopped" },
      ],
      simulator_experiment_protocols: [
        {
          id: "proto-1",
          experiment_id: "exp-1",
          user_id: patient,
          protocol_version: 1,
          template_id: proposal.template_id,
          hypothesis_question: proposal.hypothesis_question,
          perturbation_category: proposal.perturbation_category,
          intervention: proposal.intervention,
          primary_outcome: proposal.primary_outcome,
          secondary_outcomes: [],
          hold_stable: [],
          allowed_cointerventions: [],
          stop_criteria: proposal.stop_criteria,
          contraindications: [],
          run_in_days: proposal.run_in_days,
          intervention_days: proposal.intervention_days,
          washout_days: null,
          patient_note: null,
          executable_sha256: sha,
        },
      ],
      simulator_what_if_cards: [
        {
          id: "card-held",
          user_id: patient,
          admission_verdict: "BLOCK",
          patient_safe: false,
          safety_flags: ["unresolved_anaemia"],
        },
        { id: "card-foreign", user_id: other, admission_verdict: "ADMIT", patient_safe: true, safety_flags: [] },
      ],
    },
    async (name, args) => {
      rpcCalls.push({ name, args });
      if (rpcError) return { data: null, error: { message: rpcError } };
      return { data: { committed: true, to_phase: args.p_to_phase }, error: null };
    },
  );
  authenticate.mockResolvedValue({
    ok: true,
    auth: { callerUserId: patient, serviceClient: { from: db.from, rpc: db.rpc } },
  });
  resolveTarget.mockImplementation(async (_auth: unknown, requested: string) => {
    if (requested === other) return { ok: false, error: { status: 403, body: { error: "forbidden" } } };
    return { ok: true, targetUserId: patient, isViewAs: false };
  });
  loadContext.mockResolvedValue(context());
});

describe("ownership and request shape", () => {
  it("requires an experiment id", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it("does not act on another account's plan", async () => {
    const res = await post({ experiment_id: "exp-foreign", target_phase: "run_in" });
    expect(res.status).toBe(403);
    expect(rpcCalls).toHaveLength(0);
  });

  it("returns not found for an unknown plan", async () => {
    const res = await post({ experiment_id: "exp-missing" });
    expect(res.status).toBe(404);
  });
});

describe("stopping is always the patient's", () => {
  it("stops without needing any clinical context at all", async () => {
    loadContext.mockRejectedValue(new Error("context loader must not be needed to stop"));
    const res = await post({ experiment_id: "exp-1", target_phase: "stopped" });
    expect(res.status).toBe(200);
    expect(rpcCalls[0].args.p_to_phase).toBe("stopped");
    expect(rpcCalls[0].args.p_stopped_reason).toBe("patient_stopped");
  });

  it("is idempotent and never reopens a stopped plan", async () => {
    const again = await post({ experiment_id: "exp-stopped", target_phase: "stopped" });
    expect(again.status).toBe(200);
    expect((await again.json()).idempotent).toBe(true);
    expect(rpcCalls).toHaveLength(0);

    const restart = await post({ experiment_id: "exp-stopped", target_phase: "run_in" });
    expect(restart.status).toBe(409);
    expect((await restart.json()).code).toBe("TERMINAL_PHASE");
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("starting is re-admitted at the moment of starting", () => {
  it("starts an ordinary ready-made plan and binds protocol, content and context to the commit", async () => {
    const res = await post({ experiment_id: "exp-1", target_phase: "run_in" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.new_phase).toBe("run_in");
    const args = rpcCalls[0].args;
    expect(args.p_protocol_id).toBe("proto-1");
    expect(args.p_protocol_version).toBe(1);
    expect(args.p_context_fingerprint).toBe("sha256:ctx");
    expect(args.p_executable_sha).toMatch(/^sha256:/);
    expect(args.p_from_phase).toBe("draft");
  });

  it("refuses when the stored protocol content no longer matches its recorded hash", async () => {
    db.tables.simulator_experiment_protocols[0].intervention = {
      ...proposal.intervention,
      duration_min: 44,
    };
    const res = await post({ experiment_id: "exp-1", target_phase: "run_in" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("PROTOCOL_CHANGED");
    expect(rpcCalls).toHaveLength(0);
  });

  it("refuses to start with no saved protocol", async () => {
    db.tables.simulator_experiment_protocols = [];
    const res = await post({ experiment_id: "exp-1", target_phase: "run_in" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("PROTOCOL_REQUIRED");
  });

  it("does not start when the safety context could not be read", async () => {
    loadContext.mockResolvedValue(context({ available: false, biomarkers: [], fingerprint: "unavailable" }));
    const res = await post({ experiment_id: "exp-1", target_phase: "run_in" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("ADMISSION_REQUIRED");
    expect(body.admission.scope).toBe("safety_check_unavailable");
    expect(rpcCalls).toHaveLength(0);
  });

  it("does not start during an unresolved CIE safety handoff", async () => {
    loadContext.mockResolvedValue(context({ cieSafetyHold: true }));
    const res = await post({ experiment_id: "exp-1", target_phase: "run_in" });
    expect(res.status).toBe(403);
    expect((await res.json()).admission.scope).toBe("cie_safety_handoff");
  });

  it("does not start a plan whose source suggestion has since been held", async () => {
    db.tables.simulator_experiments[0].source_card_id = "card-held";
    const res = await post({ experiment_id: "exp-1", target_phase: "run_in" });
    expect(res.status).toBe(403);
    expect((await res.json()).admission.scope).toBe("source_suggestion_held");
    expect(rpcCalls).toHaveLength(0);
  });

  it("refuses a source suggestion that belongs to somebody else", async () => {
    db.tables.simulator_experiments[0].source_card_id = "card-foreign";
    const res = await post({ experiment_id: "exp-1", target_phase: "run_in" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("source_card_not_found");
  });

  it("rejects a transition that is not possible from the current phase", async () => {
    const res = await post({ experiment_id: "exp-1", target_phase: "completed" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_TRANSITION");
    expect(rpcCalls).toHaveLength(0);
  });

  it("surfaces the database's own stale-phase and context refusals", async () => {
    rpcError = "STALE_PHASE: experiment moved on";
    const res = await post({ experiment_id: "exp-1", target_phase: "run_in" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("STALE_PHASE");

    rpcError = "CONTEXT_CHANGED: fingerprint differs";
    const second = await post({ experiment_id: "exp-1", target_phase: "run_in" });
    expect(second.status).toBe(409);
    expect((await second.json()).code).toBe("CONTEXT_CHANGED");
  });

  it("leaves graduation to the database and reports its refusal honestly", async () => {
    rpcError = "REPLICATION_REQUIRED: one cycle only";
    const res = await post({ experiment_id: "exp-1", target_phase: "graduated" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("REPLICATION_REQUIRED");
    expect(rpcCalls[0].name).toBe("simulator_graduate_experiment");
  });
});
