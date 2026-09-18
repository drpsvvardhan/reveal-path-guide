// @vitest-environment node
// Exercise the actual HTTP handler. Authentication and the database transport
// are isolated; real SQL authority/locking behavior is tested in the RPC suite.
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { startIntake, applyCommand } from "../../supabase/functions/_shared/cie33/engine";
import type { IntakeState } from "../../supabase/functions/_shared/cie33/engine";

const { authenticate } = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("../../supabase/functions/_shared/auth.ts", () => ({
  authenticateRequest: authenticate,
  jsonResponse: (body: unknown, status: number, headers: Record<string, string>) =>
    new Response(JSON.stringify(body), { status, headers }),
}));

const patient = "11111111-1111-4111-8111-111111111111";
const clinician = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const grantId = "44444444-4444-4444-8444-444444444444";
type Row = Record<string, any>;
let handler: (request: Request) => Promise<Response>;
let tables: Record<string, Row[]>;
let queried: string[];
let hideReceiptReads: number;
let rejectAuthorityAtRpc: boolean;
let held: IntakeState;
let body: Row;

function query(table: string) {
  queried.push(table);
  const predicates: ((row: Row) => boolean)[] = [];
  let columns = "*";
  let maximum = Infinity;
  let single = false;
  const execute = () => {
    let rows = tables[table] ?? [];
    if (table === "cie33_safety_reviews" && columns === "id" && hideReceiptReads > 0) {
      hideReceiptReads--;
      rows = [];
    }
    rows = rows.filter((r) => predicates.every((p) => p(r))).slice(0, maximum);
    const projected = rows.map((row) => columns === "*" ? row : Object.fromEntries(
      columns.split(",").map((key) => [key.trim(), row[key.trim()]]),
    ));
    return { data: single ? projected[0] ?? null : projected, error: null };
  };
  const builder = {
    select(value: string) { columns = value; return builder; },
    eq(key: string, value: unknown) { predicates.push((r) => r[key] === value); return builder; },
    is(key: string, value: unknown) { predicates.push((r) => r[key] === value); return builder; },
    gt(key: string, value: string) { predicates.push((r) => r[key] > value); return builder; },
    order() { return builder; },
    limit(value: number) { maximum = value; return builder; },
    maybeSingle() { single = true; return Promise.resolve(execute()); },
    then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
      return Promise.resolve(execute()).then(resolve, reject);
    },
  };
  return builder;
}

const rpc = vi.fn(async (_name: string, args: Row) => {
  if (rejectAuthorityAtRpc)
    return { data: null, error: { message: "NOT_AUTHORIZED", code: "42501" } };
  const prior = tables.cie33_safety_reviews.find((r) => r.request_id === args.p_request_id);
  if (prior && prior.request_hash !== args.p_request_hash)
    return { data: null, error: { message: "IDEMPOTENCY_CONFLICT", code: "23505" } };
  if (prior)
    return { data: { review_id: prior.id, replayed: true, state: tables.cie33_sessions[0].state }, error: null };
  const state = args.p_state as IntakeState;
  tables.cie33_sessions[0] = {
    id: state.id, user_id: patient, revision: state.revision, state,
  };
  tables.cie33_safety_reviews.push({
    id: state.safetyReview!.reviewId,
    clinician_user_id: clinician,
    patient_user_id: patient,
    session_id: state.id,
    request_id: args.p_request_id,
    request_hash: args.p_request_hash,
  });
  return { data: { review_id: state.safetyReview!.reviewId, replayed: false, state }, error: null };
});

function identify(caller = clinician) {
  authenticate.mockResolvedValue({
    ok: true,
    auth: { callerUserId: caller, serviceClient: { from: query, rpc } },
  });
}

function post(payload: Row) {
  return handler(new Request("https://example.test/cie33-safety-review", {
    method: "POST", headers: { authorization: "Bearer synthetic-test-token" },
    body: JSON.stringify(payload),
  }));
}

beforeAll(async () => {
  vi.stubGlobal("Deno", { serve: (callback: typeof handler) => { handler = callback; } });
  await import("../../supabase/functions/cie33-safety-review/index.ts");
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  rpc.mockClear();
  queried = [];
  hideReceiptReads = 0;
  rejectAuthorityAtRpc = false;
  const now = new Date().toISOString();
  const start = startIntake(patient, false, now);
  held = applyCommand(start, {
    action: "answer", answer: {
      questionInstanceId: start.current!.instance.id,
      questionInstanceHash: start.current!.instance.instanceContentHash,
      semanticResponse: { kind: "boolean", value: true },
    },
  }, crypto.randomUUID(), now);
  tables = {
    clinician_patient_authorizations: [{
      id: grantId, patient_user_id: patient, clinician_user_id: clinician,
      expires_at: new Date(Date.now() + 86400000).toISOString(), revoked_at: null,
    }],
    cie33_sessions: [{ id: held.id, user_id: patient, revision: held.revision, state: held }],
    cie33_safety_reviews: [],
  };
  body = {
    action: "submit", request_id: crypto.randomUUID(), session_id: held.id,
    patient_user_id: patient, expected_revision: held.revision, expected_hash: held.stateHash,
    source_witness_id: held.entries[0].witness.id, disposition: "permit_resumption",
    encounter_at: now, assessment_note: "Synthetic clinician documented an assessment.",
    rationale: "Synthetic rationale based on the documented encounter.",
    patient_instructions: "Synthetic follow-up instructions for the patient.",
  };
  identify();
});

describe("clinician safety review HTTP boundary", () => {
  it("replays a lost successful permit response despite its now-stale revision", async () => {
    const first = await post(body);
    expect(first.status).toBe(200);
    const original = await first.json();
    const retry = await post(body);
    expect(retry.status).toBe(200);
    const replay = await retry.json();
    expect(replay.review.replayed).toBe(true);
    expect(replay.review.review_id).toBe(original.review.review_id);
    expect(tables.cie33_safety_reviews).toHaveLength(1);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1].p_state).toBeNull();
    expect(original.review).not.toHaveProperty("state");
    expect(Object.keys(original.review).sort()).toEqual(["disposition", "replayed", "review_id"]);
    const saved = tables.cie33_sessions[0].state as IntakeState;
    expect(saved.safetyReview!.authorizationId).toBe(grantId);
    expect(saved.safetyReview!.reviewId).toBe(original.review.review_id);
  });

  it("finds a receipt committed between its first probe and the session read", async () => {
    expect((await post(body)).status).toBe(200);
    hideReceiptReads = 1;
    const retry = await post(body);
    expect(retry.status).toBe(200);
    expect((await retry.json()).review.replayed).toBe(true);
    expect(tables.cie33_safety_reviews).toHaveLength(1);
  });

  it("rejects changed content using the same request ID rather than returning stale_state", async () => {
    await post(body);
    const conflict = await post({ ...body, rationale: "A different documented rationale for the same request." });
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toBe("idempotency_conflict");
  });

  it("honors transactional authority denial on replay even after a positive edge lookup", async () => {
    await post(body);
    rejectAuthorityAtRpc = true;
    const retry = await post(body);
    expect(retry.status).toBe(403);
    expect((await retry.json()).error).toBe("not_authorized");
  });

  it("returns a distinct-patient access count without querying patient state", async () => {
    tables.clinician_patient_authorizations.push({
      ...tables.clinician_patient_authorizations[0], id: other,
    });
    const response = await post({ action: "access" });
    expect(await response.json()).toEqual({ authorized_patients: 1 });
    expect(queried).toEqual(["clinician_patient_authorizations"]);
    identify(patient);
    expect(await (await post({ action: "access" })).json()).toEqual({ authorized_patients: 0 });
  });

  it("shows owners only the patient-facing notice and denies clinician/view-as substitution", async () => {
    tables.cie33_safety_reviews.push({
      id: crypto.randomUUID(), session_id: held.id, patient_user_id: patient,
      disposition: "keep_hold", patient_instructions: "Contact your treating clinician.",
      created_at: new Date().toISOString(), assessment_note: "Private assessment.", rationale: "Private reasoning.",
    });
    identify(patient);
    const response = await post({ action: "patient_notice", session_id: held.id });
    expect(response.status).toBe(200);
    expect(Object.keys((await response.json()).notice).sort()).toEqual([
      "created_at", "disposition", "patient_instructions",
    ]);
    identify(clinician);
    const substitute = await post({ action: "patient_notice", session_id: held.id, patient_user_id: patient });
    expect(substitute.status).toBe(403);
    identify(other);
    expect((await post({ action: "patient_notice", session_id: held.id })).status).toBe(403);
  });

  it("rejects unauthenticated requests before any database read", async () => {
    authenticate.mockResolvedValue({ ok: false, error: { status: 401, body: { error: "unauthorized" } } });
    expect((await post(body)).status).toBe(401);
    expect(queried).toHaveLength(0);
  });
});
