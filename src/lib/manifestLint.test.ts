import { describe, it, expect } from "vitest";
import { lintManifest } from "./manifestLint";
import type { ManifestPreview } from "./manifestSchema";

const baseValid: ManifestPreview = {
  schema_version: "1.0.0",
  patient: { firstName: "Test", age: 40, sex: "Female" },
};

describe("lintManifest", () => {
  it("returns no warnings for a minimal valid manifest with schema_version", () => {
    expect(lintManifest(baseValid)).toEqual([]);
  });

  it("emits an info warning when schema_version is missing", () => {
    const m: ManifestPreview = { patient: baseValid.patient };
    const w = lintManifest(m);
    expect(w).toHaveLength(1);
    expect(w[0].severity).toBe("info");
    expect(w[0].path).toBe("schema_version");
  });

  it("warns when patientJourney timeline exists without currentPhase/nextStep", () => {
    const m: ManifestPreview = {
      ...baseValid,
      patientJourney: {
        timeline: [{ title: "Kickoff", dateLabel: "Day 0", status: "complete" }],
      },
    };
    const w = lintManifest(m);
    const phaseWarning = w.find((x) => x.path === "patientJourney");
    expect(phaseWarning).toBeDefined();
    expect(phaseWarning?.severity).toBe("warning");
  });

  it("does not warn about phase when currentPhase is set", () => {
    const m: ManifestPreview = {
      ...baseValid,
      patientJourney: {
        currentPhase: "Phase 1",
        timeline: [{ title: "Kickoff", dateLabel: "Day 0", status: "complete" }],
      },
    };
    expect(lintManifest(m).find((x) => x.path === "patientJourney")).toBeUndefined();
  });

  it("warns when a timeline event is missing dateLabel", () => {
    const m: ManifestPreview = {
      ...baseValid,
      patientJourney: {
        currentPhase: "Phase 1",
        timeline: [
          { title: "No date", status: "complete" },
          { title: "Blank date", dateLabel: "   ", status: "complete" },
        ],
      },
    };
    const w = lintManifest(m).filter((x) => x.message.includes("dateLabel"));
    expect(w).toHaveLength(2);
    expect(w[0].severity).toBe("warning");
    expect(w[0].path).toBe("patientJourney.timeline[0]");
    expect(w[1].path).toBe("patientJourney.timeline[1]");
  });

  it("warns when a timeline event is missing status", () => {
    const m: ManifestPreview = {
      ...baseValid,
      patientJourney: {
        currentPhase: "Phase 1",
        timeline: [{ title: "No status", dateLabel: "Day 0" }],
      },
    };
    const w = lintManifest(m).filter((x) => x.message.includes("status"));
    expect(w).toHaveLength(1);
    expect(w[0].severity).toBe("warning");
  });

  it("does not return any 'warning'-severity items when patientJourney is absent", () => {
    const m: ManifestPreview = { patient: baseValid.patient };
    const w = lintManifest(m);
    expect(w.every((x) => x.severity === "info")).toBe(true);
  });

  describe("ordering", () => {
    it("emits schema_version info before any patientJourney warnings", () => {
      const m: ManifestPreview = {
        patient: baseValid.patient,
        patientJourney: {
          timeline: [{ title: "Kickoff" }],
        },
      };
      const w = lintManifest(m);
      expect(w[0].path).toBe("schema_version");
      // Every later item should belong to patientJourney.
      for (let i = 1; i < w.length; i++) {
        expect(w[i].path.startsWith("patientJourney")).toBe(true);
      }
    });

    it("emits the patientJourney phase warning before any per-event warnings", () => {
      const m: ManifestPreview = {
        ...baseValid,
        patientJourney: {
          timeline: [{ title: "Kickoff" }, { title: "Next" }],
        },
      };
      const w = lintManifest(m);
      expect(w[0].path).toBe("patientJourney");
      for (let i = 1; i < w.length; i++) {
        expect(w[i].path.startsWith("patientJourney.timeline[")).toBe(true);
      }
    });

    it("emits per-event warnings in event index order", () => {
      const m: ManifestPreview = {
        ...baseValid,
        patientJourney: {
          currentPhase: "Phase 1",
          timeline: [
            { title: "Event 0" }, // missing dateLabel + status
            { title: "Event 1", dateLabel: "Day 1", status: "complete" }, // clean
            { title: "Event 2", dateLabel: "Day 2" }, // missing status
            { title: "Event 3", status: "current" }, // missing dateLabel
          ],
        },
      };
      const w = lintManifest(m);
      const indices = w.map((x) => {
        const m2 = x.path.match(/timeline\[(\d+)\]/);
        return m2 ? Number(m2[1]) : -1;
      });
      // Indices must be non-decreasing (per-event order preserved).
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
      }
      // First per-event entry should reference index 0.
      expect(indices[0]).toBe(0);
    });
  });
});