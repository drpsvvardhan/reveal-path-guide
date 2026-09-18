// @vitest-environment node
// The trusted admission context. The rule under test: a read that fails is
// UNKNOWN, never clearance — and the CIE 3.3 safety state is read from the live
// sessions, including ones still in progress.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./harness";

const { loadPatientContext } = vi.hoisted(() => ({ loadPatientContext: vi.fn() }));
vi.mock("../../supabase/functions/_shared/contextLoader.ts", () => ({
  loadPatientContext,
}));

import { loadAdmissionContext } from "../../supabase/functions/_shared/autonomy/admissionContext.ts";

const patient = "11111111-1111-4111-8111-111111111111";
let db: FakeDb;
let fingerprint: string;

const terrain = {
  labs: {
    observations: [
      { canonical_name: "LDL-C", value: 3.9 },
      { canonical_name: "eGFR", value: 88 },
    ],
  },
  inbody: { observations: [{ canonical_name: "Phase Angle", value: 5.4 }] },
  cie: { domain_scores: [{ domain_id: "F16_musculoskeletal", axis: "structure" }], gate_scores: [] },
};

beforeEach(() => {
  vi.stubGlobal("Deno", {
    env: { get: (key: string) => (key === "SUPABASE_URL" ? "https://test.invalid" : "test-key") },
  });
  loadPatientContext.mockReset();
  loadPatientContext.mockResolvedValue(terrain);
  fingerprint = "snapshot-a";
  db = createFakeDb({ cie33_sessions: [] }, async () => ({data: fingerprint, error: null}));
});
afterEach(() => vi.unstubAllGlobals());

describe("trusted context", () => {
  it("derives biomarkers and counts sources from the witness-backed terrain", async () => {
    const ctx = await loadAdmissionContext(db as any, patient);
    expect(ctx.available).toBe(true);
    expect(ctx.biomarkers).toContain("LDL-C");
    expect(ctx.biomarkers).toContain("Phase Angle");
    expect(ctx.biomarkers).toContain("F16_musculoskeletal");
    expect(ctx.sources.lab_observations).toBe(2);
    expect(ctx.fingerprint).toBe("snapshot-a");
    expect(ctx.unavailable_reason).toBeNull();
  });

  it("applies the shared numeric guards from the person's own numbers", async () => {
    loadPatientContext.mockResolvedValue({
      labs: { observations: [{ canonical_name: "eGFR", value: 41 }, { canonical_name: "hs-Troponin", value: 22 }] },
    });
    const ctx = await loadAdmissionContext(db as any, patient);
    expect(ctx.flags).toContain("ckd");
    expect(ctx.flags).toContain("cardiac_risk");
  });

  it("changes its fingerprint when the underlying data changes", async () => {
    const first = await loadAdmissionContext(db as any, patient);
    loadPatientContext.mockResolvedValue({
      ...terrain,
      labs: { observations: [...terrain.labs.observations, { canonical_name: "ApoB", value: 1.4 }] },
    });
    fingerprint = "snapshot-b";
    const second = await loadAdmissionContext(db as any, patient);
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });
});

describe("CIE 3.3 safety state", () => {
  it("holds on an unresolved handoff recorded on an incomplete session", async () => {
    db.tables.cie33_sessions.push({ id: "s1", user_id: patient, state: { safety: "handoff_required" } });
    const ctx = await loadAdmissionContext(db as any, patient);
    expect(ctx.cieSafetyHold).toBe(true);
    expect(ctx.sources.cie33_sessions_inspected).toBe(1);
  });

  it("reports a pending safety recheck after a clinician permitted resumption", async () => {
    db.tables.cie33_sessions.push({ id: "s1", user_id: patient, state: { safety: "recheck_required" } });
    const ctx = await loadAdmissionContext(db as any, patient);
    expect(ctx.cieRecheckPending).toBe(true);
    expect(ctx.cieSafetyHold).toBe(false);
  });

  it("only inspects this person's sessions", async () => {
    db.tables.cie33_sessions.push(
      { id: "s1", user_id: patient, state: { safety: "none" } },
      { id: "s2", user_id: "other-user", state: { safety: "handoff_required" } },
    );
    const ctx = await loadAdmissionContext(db as any, patient);
    expect(ctx.cieSafetyHold).toBe(false);
    expect(ctx.sources.cie33_sessions_inspected).toBe(1);
  });
});

describe("a failed read is unknown, not clear", () => {
  it("reports unavailable when the terrain context cannot be loaded", async () => {
    loadPatientContext.mockRejectedValue(new Error("witness_objects unreachable"));
    const ctx = await loadAdmissionContext(db as any, patient);
    expect(ctx.available).toBe(false);
    expect(ctx.biomarkers).toEqual([]);
    expect(ctx.flags).toEqual([]);
    expect(ctx.cieSafetyHold).toBe(false);
    expect(ctx.fingerprint).toBe("unavailable");
    expect(ctx.unavailable_reason).toMatch(/witness_objects unreachable/);
  });

  it("reports unavailable when the CIE sessions query errors", async () => {
    db.failReads.add("cie33_sessions");
    const ctx = await loadAdmissionContext(db as any, patient);
    expect(ctx.available).toBe(false);
    expect(ctx.unavailable_reason).toMatch(/cie33_sessions/);
  });

  it("reports unavailable when the CIE sessions table or column does not exist", async () => {
    const missing = createFakeDb({}, async () => ({ data: "snapshot-a", error: null }));
    const ctx = await loadAdmissionContext(missing as any, patient);
    expect(ctx.available).toBe(false);
    expect(ctx.unavailable_reason).toMatch(/cie33_sessions/);
  });
});

 it("does not accept a context that changed while it was being read", async () => {
   db.rpc.mockResolvedValueOnce({ data: "snapshot-a", error: null })
     .mockResolvedValueOnce({ data: "snapshot-b", error: null });
   const ctx = await loadAdmissionContext(db as any, patient);
   expect(ctx.available).toBe(false);
   expect(ctx.fingerprint).toBe("unavailable");
 });
