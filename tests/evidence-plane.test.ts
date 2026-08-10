// tests/evidence-plane.test.ts
//
// Evidence Plane (Release Compiler v2) — the two-plane doctrine:
//
//   Evidence is visible by default; interpretation earns authority.
//
// Live failure this encodes (Aug 9): Peter's v18 Twin holds 4,301 CGM
// readings (mean 105.8, GMI 5.84%, CV 20.1%, TIR 98.1%) and a 14-day food
// log — and the patient runtime said "no CGM or food log present" because
// that evidence was attached to a claim the release decision never
// selected. Measured observations must survive compilation without claim
// authority; raw series must never be inlined.

import { describe, it, expect } from "vitest";
import {
  harvestMeasuredEvidence,
  EVIDENCE_ROOTS,
} from "../supabase/functions/_shared/biotwin/releaseCompiler.ts";
import { adaptBiotwinReport } from "../supabase/functions/_shared/biotwin/adapter.ts";
import {
  buildBiotwinPacket,
  renderBiotwinPacketForPrompt,
  validateBiotwinOutput,
  type BiotwinStatementRow,
} from "../supabase/functions/_shared/biotwin/packet.ts";

const warnings: Array<{ code: string; message: string }> = [];
const warn = (code: string, message: string) => warnings.push({ code, message });

// Peter-shaped twin fragment: real summary scalars + a raw trace that must
// never be inlined.
const twin = {
  sensor_cgm: {
    n_readings: 4301,
    window_days: 14,
    mean_glucose_mg_dl: 105.8,
    gmi_pct: 5.84,
    cv_pct: 20.1,
    tir_70_180_pct: 98.1,
    readings_above_140: 237,
    readings_above_160: 121,
    max_mg_dl: 256,
    trace: Array.from({ length: 4301 }, (_, i) => 100 + (i % 40)),
  },
  food_log: {
    days: 14,
    coffee_servings: 49,
    alcohol_servings: 0,
    notes: "diet soda, pre-workout",
  },
  unrelated_root: { should_not: "appear" },
};

describe("harvestMeasuredEvidence", () => {
  it("releases CGM and food log summaries by default, without claim authority", () => {
    warnings.length = 0;
    const out = harvestMeasuredEvidence(twin as never, new Set(), warn);
    const ids = out.map((e) => (e as { evidence_id: string }).evidence_id);
    expect(ids).toContain("EVID-SENSOR-CGM");
    expect(ids).toContain("EVID-FOOD-LOG");
    const cgm = out.find(
      (e) => (e as { evidence_id: string }).evidence_id === "EVID-SENSOR-CGM"
    ) as { summary: string };
    expect(cgm.summary).toContain("mean_glucose_mg_dl: 105.8");
    expect(cgm.summary).toContain("tir_70_180_pct: 98.1");
    expect(cgm.summary).toContain("n_readings: 4301");
  });

  it("never inlines a raw series — existence is recorded instead", () => {
    const out = harvestMeasuredEvidence(twin as never, new Set(), warn);
    const cgm = out.find(
      (e) => (e as { evidence_id: string }).evidence_id === "EVID-SENSOR-CGM"
    ) as { summary: string };
    expect(cgm.summary).toContain("trace: [4301 entries — raw series retained in the Twin, not inlined]");
    expect(cgm.summary.length).toBeLessThan(3000);
  });

  it("only harvests declared evidence roots, never arbitrary twin content", () => {
    const out = harvestMeasuredEvidence(twin as never, new Set(), warn);
    expect(JSON.stringify(out)).not.toContain("should_not");
    expect(EVIDENCE_ROOTS).not.toContain("unrelated_root" as never);
  });

  it("quarantine is explicit and loud, never silent", () => {
    warnings.length = 0;
    const out = harvestMeasuredEvidence(
      twin as never,
      new Set(["sensor_cgm"]),
      warn
    );
    expect(
      out.some((e) => (e as { evidence_id: string }).evidence_id === "EVID-SENSOR-CGM")
    ).toBe(false);
    expect(warnings.some((w) => w.code === "evidence_quarantined")).toBe(true);
  });
});

describe("adapter → packet → prompt chain", () => {
  const report = {
    schema: {
      name: "Vizzhy BioTwin Clinical Evidence Report",
      version: "1.1",
      report_type: "FINAL_CORRECTED_CLINICAL_EVIDENCE_REPORT",
    },
    subject: { twin_id: "VZ-TEST", generated_date: "2026-08-09" },
    release_control: {
      overall_status: "TEST",
      patient_facing_release: "PERMITTED_FOR_RELEASED_FINDINGS_ONLY",
      medication_or_treatment_decision: "HOLD_CLINICIAN_ONLY",
    },
    clinical_report_projection: { prohibited_headline_statements: [] },
    clinical_state: {},
    measured_evidence: [
      {
        evidence_id: "EVID-SENSOR-CGM",
        source_root: "sensor_cgm",
        title: "Measured evidence — sensor cgm",
        summary: "mean_glucose_mg_dl: 105.8\ntir_70_180_pct: 98.1",
      },
    ],
  };

  it("adapter maps measured evidence to confirmed patient-facing statements", () => {
    const res = adaptBiotwinReport(report as never);
    const ev = res.statements.filter(
      (s) => s.statement_kind === "measured_evidence"
    );
    expect(ev).toHaveLength(1);
    expect(ev[0].truth_status).toBe("confirmed");
    expect(ev[0].clinical_authority).toBe("patient_facing");
    expect(ev[0].body).toContain("105.8");
  });

  it("prompt overrides stale conversation history when evidence is present", () => {
    const row: BiotwinStatementRow = {
      source_id: "EVID-SENSOR-CGM",
      section: "measured_evidence",
      statement_kind: "measured_evidence",
      truth_status: "confirmed",
      title: "Measured evidence — sensor cgm",
      body: "mean_glucose_mg_dl: 105.8",
      bounds: [],
      timepoint: null,
      clinical_authority: "patient_facing",
      requires_measurement: null,
      holds: null,
      ordinal: 0,
    };
    const packet = buildBiotwinPacket(
      {
        id: "r1",
        twin_id: "VZ-TEST",
        version: 2,
        generated_date: "2026-08-09",
        release_control: {},
        executive_synthesis: {},
        holds: [],
        clinician_review_required: false,
        patient_release_permitted: true,
      },
      [row]
    );
    const prompt = renderBiotwinPacketForPrompt(packet);
    expect(prompt).toContain("that statement is outdated");
  });

  it("packet carries an evidence bucket and the prompt renders it citable", () => {
    const row: BiotwinStatementRow = {
      source_id: "EVID-SENSOR-CGM",
      section: "measured_evidence",
      statement_kind: "measured_evidence",
      truth_status: "confirmed",
      title: "Measured evidence — sensor cgm",
      body: "mean_glucose_mg_dl: 105.8",
      bounds: [],
      timepoint: null,
      clinical_authority: "patient_facing",
      requires_measurement: null,
      holds: null,
      ordinal: 0,
    };
    const packet = buildBiotwinPacket(
      {
        id: "r1",
        twin_id: "VZ-TEST",
        version: 2,
        generated_date: "2026-08-09",
        release_control: {},
        executive_synthesis: {},
        holds: [],
        clinician_review_required: false,
        patient_release_permitted: true,
      },
      [row]
    );
    expect(packet.evidence).toHaveLength(1);
    const prompt = renderBiotwinPacketForPrompt(packet);
    expect(prompt).toContain("MEASURED EVIDENCE");
    expect(prompt).toContain("[id:EVID-SENSOR-CGM]");
    expect(prompt).toContain("105.8");
  });
});

describe("evidence-absence denial gate (validator 1.3.0)", () => {
  // Live failure (Aug 10, receipt f7eef0c5): the packet carried all 7
  // evidence statements — the receipt's context_ref_manifest proves it —
  // and the model still opened with "your BioTwin does not yet contain any
  // continuous glucose monitor (CGM) data or a food log", following its own
  // earlier wrong turns in the conversation history over the packet.
  const evidenceRows: BiotwinStatementRow[] = [
    {
      source_id: "EVID-SENSORSTATE-CHANNELS-CGM",
      section: "measured_evidence",
      statement_kind: "measured_evidence",
      truth_status: "confirmed",
      title: "Measured evidence — cgm",
      body: "n_readings: 4301\ngmi_pct: 5.84\ntir_pct: 98.1",
      bounds: [],
      timepoint: null,
      clinical_authority: "patient_facing",
      requires_measurement: null,
      holds: null,
      ordinal: 104,
    },
    {
      source_id: "EVID-LIFESTYLEVIEW-FOODLOG",
      section: "measured_evidence",
      statement_kind: "measured_evidence",
      truth_status: "confirmed",
      title: "Measured evidence — food log",
      body: "days_logged: 14\ncoffee_servings_14d: 49",
      bounds: [],
      timepoint: null,
      clinical_authority: "patient_facing",
      requires_measurement: null,
      holds: null,
      ordinal: 106,
    },
  ];
  const report = {
    id: "r1",
    twin_id: "VZ-TEST",
    version: 2,
    generated_date: "2026-08-09",
    release_control: {},
    executive_synthesis: {},
    holds: [],
    clinician_review_required: false,
    patient_release_permitted: true,
  };
  const packetWithEvidence = buildBiotwinPacket(report, evidenceRows);
  const packetWithoutEvidence = buildBiotwinPacket(report, []);

  it("flags the exact live denial sentence when the stream is present", () => {
    const live =
      "It is important to start with the most significant gap in your current map: your BioTwin does not yet contain any continuous glucose monitor (CGM) data or a food log.";
    const res = validateBiotwinOutput(live, packetWithEvidence);
    expect(res.valid).toBe(false);
    expect(
      res.violations.some((v) => v.kind === "evidence_absence_denial")
    ).toBe(true);
  });

  it("flags 'no CGM or food log present' phrasing", () => {
    const res = validateBiotwinOutput(
      "Right now there is no CGM or food log present in your record.",
      packetWithEvidence
    );
    expect(res.valid).toBe(false);
  });

  it("never blocks the honest answer when the stream truly is absent", () => {
    const res = validateBiotwinOutput(
      "Your BioTwin does not yet contain any continuous glucose monitor (CGM) data or a food log.",
      packetWithoutEvidence
    );
    expect(res.valid).toBe(true);
  });

  it("does not fire on faithful value-level negations about present data", () => {
    const res = validateBiotwinOutput(
      "Your CGM shows no values above 180 mg/dL, and your food log records zero alcohol servings.",
      packetWithEvidence
    );
    expect(res.valid).toBe(true);
  });

  it("does not fire on forward-looking suggestions about wearing a sensor", () => {
    const res = validateBiotwinOutput(
      "Wearing a CGM for another 14-day window would deepen the picture your data already shows.",
      packetWithEvidence
    );
    expect(res.valid).toBe(true);
  });

  it("catches the linking-verb form: 'CGM data is not available'", () => {
    const res = validateBiotwinOutput(
      "Unfortunately your CGM data is not available in the Twin.",
      packetWithEvidence
    );
    expect(res.valid).toBe(false);
  });
});
