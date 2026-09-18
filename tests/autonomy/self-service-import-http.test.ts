// @vitest-environment node
// The patient self-service upload path. A patient's file is their own evidence:
// it is kept verbatim and readable immediately, and it cannot certify itself.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, postRequest, stubDenoServe, type FakeDb } from "./harness";

const { authenticate, resolveTarget } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  resolveTarget: vi.fn(),
}));

vi.mock("npm:@supabase/supabase-js@2/cors", () => ({
  corsHeaders: { "Access-Control-Allow-Origin": "*" },
}));
vi.mock("../../supabase/functions/_shared/auth.ts", () => ({
  authenticateRequest: authenticate,
  resolveTargetUserId: resolveTarget,
}));

const patient = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

let handler: (req: Request) => Promise<Response>;
let db: FakeDb;

/** A file that loudly claims its own sign-off, release and treatment approval. */
function selfCertifyingReport(extra: Record<string, unknown> = {}) {
  return {
    schema: {
      name: "biotwin_clinical_evidence_report",
      report_type: "final_corrected_clinical_evidence_report",
      version: "1.0",
    },
    generated_date: "2026-01-04",
    attestation: { clinician_name: "Synthetic Reviewer", signed: true, license: "SYN-0001" },
    release_control: {
      patient_facing_release: "released",
      medication_or_treatment_decision: "approved",
      overall_status: "cleared",
    },
    clinical_report_projection: {
      measurements: [{ name: "ApoB", value: 1.4, unit: "g/L" }],
    },
    ...extra,
  };
}

const post = (payload: Record<string, unknown>) =>
  handler(postRequest("https://test.invalid/import-biotwin-report", payload));

beforeAll(async () => {
  const holder = stubDenoServe();
  await import("../../supabase/functions/import-biotwin-report/index.ts");
  handler = holder.current!;
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  db = createFakeDb({
    biotwin_patient_submissions: [],
    biotwin_reports: [],
    biotwin_statements: [],
    witness_objects: [],
  });
  authenticate.mockResolvedValue({
    ok: true,
    auth: { callerUserId: patient, serviceClient: { from: db.from, rpc: db.rpc } },
  });
  resolveTarget.mockResolvedValue({ ok: true, targetUserId: patient, isViewAs: false });
});

describe("the patient can contribute immediately", () => {
  it("accepts a self-service upload and records it as the patient's own submission", async () => {
    const res = await post({ report: selfCertifyingReport(), filename: "my-report.json" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.imported).toBe(false);
    expect(body.submission_id).toBeTruthy();
    expect(body.witnesses_created).toBe(0);
    expect(db.tables.biotwin_patient_submissions).toHaveLength(1);
    expect(db.tables.biotwin_patient_submissions[0].user_id).toBe(patient);
  });

  it("tells the patient plainly that the file's own sign-off wording grants nothing", async () => {
    const res = await post({ report: selfCertifyingReport() });
    const body = await res.json();
    expect(body.authority_asserted_in_file).toBe(true);
    const codes = (body.diagnostics as { code: string }[]).map((d) => d.code);
    expect(codes).toContain("kept_as_your_own_evidence");
    expect(codes).toContain("authority_not_inherited");
  });

  it("does not duplicate the same file", async () => {
    await post({ report: selfCertifyingReport() });
    const again = await post({ report: selfCertifyingReport() });
    const body = await again.json();
    expect(body.idempotent).toBe(true);
    expect(db.tables.biotwin_patient_submissions).toHaveLength(1);
  });

  it("refuses a file that is not a BioTwin report, with a readable reason", async () => {
    const res = await post({ report: { hello: "world" } });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.accepted).toBe(false);
    expect(body.refusal_code).toBe("missing_schema_block");
    expect(db.tables.biotwin_patient_submissions).toHaveLength(0);
  });

  it("rejects a malformed request body", async () => {
    const res = await handler(
      new Request("https://test.invalid/import-biotwin-report", {
        method: "POST",
        headers: { authorization: "Bearer synthetic-test-token" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("refuses when the caller is not authenticated", async () => {
    authenticate.mockResolvedValue({ ok: false, error: { status: 401, body: { error: "unauthorized" } } });
    const res = await post({ report: selfCertifyingReport() });
    expect(res.status).toBe(401);
    expect(db.tables.biotwin_patient_submissions).toHaveLength(0);
  });
});

describe("an upload cannot mint authority", () => {
  it("never writes governed reports, statements or witness objects", async () => {
    await post({ report: selfCertifyingReport() });
    expect(db.writesTo("biotwin_reports")).toHaveLength(0);
    expect(db.writesTo("biotwin_statements")).toHaveLength(0);
    expect(db.writesTo("witness_objects")).toHaveLength(0);
  });

  it("leaves an existing trusted active report untouched and says so", async () => {
    db.tables.biotwin_reports.push({
      id: "trusted-1",
      user_id: patient,
      status: "active",
      version: 7,
      created_at: "2025-12-01T00:00:00Z",
    });
    const res = await post({ report: selfCertifyingReport() });
    const body = await res.json();
    expect((body.diagnostics as { code: string }[]).map((d) => d.code)).toContain(
      "existing_report_preserved",
    );
    expect(db.tables.biotwin_reports[0].version).toBe(7);
    expect(db.writesTo("biotwin_reports")).toHaveLength(0);
  });

  it("ignores a caller-supplied trusted flag", async () => {
    const res = await post({ report: selfCertifyingReport(), trusted: true, actor_kind: "compiler" });
    const body = await res.json();
    expect(body.imported).toBe(false);
    expect(db.writesTo("biotwin_reports")).toHaveLength(0);
  });

  it("binds the submission to the resolved owner, not the body's user_id", async () => {
    await post({ report: selfCertifyingReport(), user_id: other });
    expect(db.tables.biotwin_patient_submissions[0].user_id).toBe(patient);
  });

  it("refuses when the caller may not act for the requested account", async () => {
    resolveTarget.mockResolvedValue({ ok: false, error: { status: 403, body: { error: "forbidden" } } });
    const res = await post({ report: selfCertifyingReport(), user_id: other });
    expect(res.status).toBe(403);
    expect(db.tables.biotwin_patient_submissions).toHaveLength(0);
  });
});
