import { describe, expect, it } from "vitest";
import {
  assessLabEvidence,
} from "../supabase/functions/_shared/aae/labReassessment.ts";

const NOW = new Date("2026-09-18T00:00:00Z");

function ctx(observations: Array<Record<string, unknown>>, key = "labs") {
  return { [key]: { observations } };
}

describe("lab reassessment — raise concern, never clear", () => {
  it("raises a concern and sustains the existing contraindication flag for low eGFR", () => {
    const r = assessLabEvidence(
      ctx([{ canonical_name: "eGFR", value: 48, unit: "mL/min/1.73m2", collection_date: "2026-08-01" }]),
      { now: NOW },
    );
    expect(r.concerns).toHaveLength(1);
    expect(r.concerns[0].marker).toBe("egfr");
    expect(r.maintainFlags).toContain("ckd");
    expect(r.concerns[0].resolution).toMatch(/will not resolve on its own/);
  });

  it("emits nothing at all when a value is in range — an in-range value is not clearance", () => {
    const r = assessLabEvidence(
      ctx([{ canonical_name: "eGFR", value: 96, collection_date: "2026-09-01" }]),
      { now: NOW },
    );
    expect(r.concerns).toHaveLength(0);
    expect(r.maintainFlags).toHaveLength(0);
  });

  it("never emits a severity outside raise_concern | maintain_hold", () => {
    const r = assessLabEvidence(
      ctx([
        { canonical_name: "eGFR", value: 40, collection_date: "2020-01-01" },
        { canonical_name: "potassium", value: 6.1, unit: "mmol/L", collection_date: "2026-09-10" },
        { canonical_name: "hemoglobin", value: 8.4, unit: "g/dL", collection_date: "2026-09-10" },
      ]),
      { now: NOW },
    );
    expect(r.concerns.length).toBeGreaterThan(0);
    for (const c of r.concerns) {
      expect(["raise_concern", "maintain_hold"]).toContain(c.severity);
      expect(c.explanation.length).toBeGreaterThan(0);
      expect(c.resolution.length).toBeGreaterThan(0);
    }
  });

  it("treats a stale out-of-range value as still standing, not resolved", () => {
    const r = assessLabEvidence(
      ctx([{ canonical_name: "eGFR", value: 41, collection_date: "2021-01-01" }]),
      { now: NOW },
    );
    expect(r.concerns[0].evidence.staleness).toBe("stale");
    expect(r.concerns[0].explanation).toMatch(/still standing, not as resolved/);
    expect(r.maintainFlags).toContain("ckd");
  });

  it("records missing required evidence as a concern rather than reassurance", () => {
    const r = assessLabEvidence(ctx([]), { now: NOW, requiredMarkers: ["ApoB"] });
    expect(r.concerns[0].marker).toBe("missing_evidence");
    expect(r.concerns[0].explanation).toMatch(/Absence is not reassurance/);
    expect(r.insufficientEvidence).toBe(true);
  });

  it("preserves conflicting same-date readings instead of choosing one", () => {
    const r = assessLabEvidence(
      ctx([
        { canonical_name: "potassium", value: 6.2, collection_date: "2026-09-10" },
        { canonical_name: "potassium", value: 4.1, collection_date: "2026-09-10" },
      ]),
      { now: NOW },
    );
    const conflict = r.concerns.find((c) => c.explanation.includes("Two different"));
    expect(conflict).toBeDefined();
    expect(conflict!.severity).toBe("raise_concern");
  });

  it("reads InBody and FibroScan sources too, and reports a trend", () => {
    const r = assessLabEvidence(
      {
        inbody: { observations: [{ canonical_name: "BMI", value: 17.9, collection_date: "2026-09-01" }] },
        fibroscan: { observations: [{ canonical_name: "BMI", value: 19.4, collection_date: "2026-06-01" }] },
      },
      { now: NOW },
    );
    expect(r.maintainFlags).toContain("underweight");
    expect(r.concerns[0].evidence.trend).toBe("falling");
  });

  it("uses the most recent dated reading, not an undated one", () => {
    const r = assessLabEvidence(
      ctx([
        { canonical_name: "eGFR", value: 95, collection_date: null },
        { canonical_name: "eGFR", value: 44, collection_date: "2026-09-01" },
      ]),
      { now: NOW },
    );
    expect(r.concerns[0].evidence.value).toBe(44);
  });
});
