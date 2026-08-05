// Deterministic adapter tests. Run with:
//   deno test --allow-read supabase/functions/_shared/biotwin/adapter.test.ts

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectBiotwinReport, validateBiotwinStructure, hasBlockingDiagnostic } from "./detect.ts";
import { adaptBiotwinReport } from "./adapter.ts";
import { buildBiotwinPacket, validateBiotwinOutput } from "./packet.ts";

const fixture = JSON.parse(
  await Deno.readTextFile(
    new URL("./__fixtures__/synthetic_biotwin_report.json", import.meta.url),
  ),
) as Record<string, unknown>;

Deno.test("detect accepts the governed schema", () => {
  const res = detectBiotwinReport(fixture);
  assert(res.accepted);
});

Deno.test("detect refuses a foreign schema name", () => {
  const res = detectBiotwinReport({ schema: { name: "Some Other Report", report_type: "X" } });
  assertEquals(res.accepted, false);
  assertEquals(res.refusal_code, "schema_name_mismatch");
});

Deno.test("detect refuses a non-final report type", () => {
  const res = detectBiotwinReport({
    schema: { name: "Vizzhy BioTwin Clinical Evidence Report", report_type: "DRAFT" },
  });
  assertEquals(res.refusal_code, "report_type_mismatch");
});

Deno.test("structural validation of the fixture is non-blocking", () => {
  const diags = validateBiotwinStructure(fixture);
  assertEquals(hasBlockingDiagnostic(diags), false);
});

Deno.test("missing release_control blocks the import", () => {
  const { release_control: _omit, ...rest } = fixture as Record<string, unknown>;
  const diags = validateBiotwinStructure(rest);
  assert(hasBlockingDiagnostic(diags));
});

Deno.test("missing prohibited headlines blocks the import", () => {
  const clone = structuredClone(fixture) as Record<string, unknown>;
  const proj = clone.clinical_report_projection as Record<string, unknown>;
  delete proj.prohibited_headline_statements;
  const diags = validateBiotwinStructure(clone);
  assert(hasBlockingDiagnostic(diags));
});

Deno.test("truth statuses are never flattened", () => {
  const { statements } = adaptBiotwinReport(fixture);
  const truths = new Set(statements.map((s) => s.truth_status));
  for (const expected of ["confirmed", "candidate", "unknown", "retired", "prohibited"]) {
    assert(truths.has(expected as never), `missing truth status ${expected}`);
  }
});

Deno.test("source ids are stable and unique across runs", () => {
  const a = adaptBiotwinReport(fixture).statements.map((s) => s.source_id);
  const b = adaptBiotwinReport(fixture).statements.map((s) => s.source_id);
  assertEquals(a, b);
  assertEquals(new Set(a).size, a.length);
});

Deno.test("only allowlisted signals become witness candidates", () => {
  const { witness_candidates, diagnostics } = adaptBiotwinReport(fixture);
  const signals = witness_candidates.map((w) => w.signal).sort();
  assertEquals(signals, ["biotwin_apob", "biotwin_ldl_c", "biotwin_lp_a", "biotwin_tsh"]);

  // "Reverse T3" is a real confirmed measurement but is not pre-registered.
  assert(
    diagnostics.some(
      (d) => d.code === "witness_skipped_not_allowlisted" && d.message.includes("Reverse T3"),
    ),
    "expected a skipped-witness diagnostic for the non-allowlisted marker",
  );
});

Deno.test("candidate and unknown findings never become witnesses", () => {
  const { statements, witness_candidates } = adaptBiotwinReport(fixture);
  const nonConfirmed = new Set(
    statements.filter((s) => s.truth_status !== "confirmed").map((s) => s.source_id),
  );
  for (const w of witness_candidates) {
    assertEquals(nonConfirmed.has(w.statement_source_id), false);
  }
});

Deno.test("report holds and review state are carried through", () => {
  const { report } = adaptBiotwinReport(fixture);
  assertEquals(report.clinician_review_required, true);
  assert(report.holds.length > 0);
  assert(report.prohibited_headlines.length === 3);
});

// ---- chat packet -----------------------------------------------------------

function packetFromFixture(mode: "patient" | "clinician") {
  const adapted = adaptBiotwinReport(fixture);
  const reportRow = {
    id: "00000000-0000-0000-0000-000000000001",
    version: 1,
    generated_date: adapted.report.generated_date,
    release_control: adapted.report.release_control,
    executive_synthesis: adapted.report.executive_synthesis,
    holds: adapted.report.holds,
    clinician_review_required: adapted.report.clinician_review_required,
    patient_release_permitted: adapted.report.patient_release_permitted,
  };
  const statementRows = adapted.statements.map((s, i) => ({
    id: `stmt-${i}`,
    source_id: s.source_id,
    section: s.section,
    statement_kind: s.statement_kind,
    truth_status: s.truth_status,
    title: s.title,
    body: s.body,
    bounds: s.bounds,
    measurements: s.measurements,
    timepoint: s.timepoint,
    clinical_authority: s.clinical_authority,
    requires_measurement: s.requires_measurement,
    holds: s.holds,
  }));
  // deno-lint-ignore no-explicit-any
  return buildBiotwinPacket(reportRow as any, statementRows as any, mode);
}

Deno.test("patient packet excludes clinician-only and prohibited statements", () => {
  const packet = packetFromFixture("patient");
  const authorities = new Set([
    ...packet.confirmed.map((s) => s.clinical_authority),
    ...packet.candidate.map((s) => s.clinical_authority),
    ...packet.unknown.map((s) => s.clinical_authority),
  ]);
  assertEquals(authorities.has("prohibited"), false);
  assert(packet.prohibited_statements.length > 0, "prohibitions must still be enforced");
});

Deno.test("clinician packet retains candidate and unknown state", () => {
  const packet = packetFromFixture("clinician");
  assert(packet.candidate.length > 0);
  assert(packet.unknown.length > 0);
});

Deno.test("output validation blocks a prohibited claim", () => {
  const packet = packetFromFixture("patient");
  const res = validateBiotwinOutput("You have insulin resistance, so start treatment.", packet);
  assertEquals(res.status, "blocked");
  assert(res.violations.length > 0);
});

Deno.test("output validation blocks a medication dose change under hold", () => {
  const packet = packetFromFixture("patient");
  const res = validateBiotwinOutput("You should increase your statin dose to 40 mg.", packet);
  assertEquals(res.status, "blocked");
});

Deno.test("output validation passes bounded, non-prescriptive prose", () => {
  const packet = packetFromFixture("patient");
  const res = validateBiotwinOutput(
    "Your report confirms an elevated atherogenic particle burden from a single fasting panel. The inflammation reading is unresolved and needs one repeat measurement before it means anything.",
    packet,
  );
  assertEquals(res.status, "pass");
});