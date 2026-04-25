import { describe, it, expect } from "vitest";
import { z } from "zod";
import { lintManifest, buildLintReport } from "./manifestLint";
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

describe("buildLintReport", () => {
  const m: ManifestPreview = {
    schema_version: "1.0.0",
    patient: { firstName: "Test", age: 40, sex: "Female" },
    patientJourney: {
      timeline: [{ title: "Kickoff" }],
    },
  };

  it("captures schema_version, generated_at, counts, and ALL items", () => {
    const items = lintManifest(m);
    const fixed = new Date("2025-01-02T03:04:05.000Z");
    const report = buildLintReport(m, items, fixed);
    expect(report.schema_version).toBe("1.0.0");
    expect(report.generated_at).toBe("2025-01-02T03:04:05.000Z");
    expect(report.counts.total).toBe(items.length);
    expect(report.counts.warning).toBe(items.filter((i) => i.severity === "warning").length);
    expect(report.counts.info).toBe(items.filter((i) => i.severity === "info").length);
    expect(report.items).toEqual(items);
  });

  it("emits null schema_version when undeclared", () => {
    const m2: ManifestPreview = { patient: m.patient };
    const report = buildLintReport(m2, lintManifest(m2));
    expect(report.schema_version).toBeNull();
  });

  it("does not narrow items even when caller passes a filtered list", () => {
    // The helper exports whatever items the caller hands it. Document that
    // the UI must always pass the full unfiltered list.
    const all = lintManifest(m);
    const report = buildLintReport(m, all);
    expect(report.items).toHaveLength(all.length);
  });

  it("download payload exposes schema_version, generated_at, counts, and items with path/severity/message", () => {
    const items = lintManifest(m);
    const fixed = new Date("2025-06-15T12:00:00.000Z");
    const report = buildLintReport(m, items, fixed);

    // Round-trip through JSON to mirror what the download blob contains.
    const serialized = JSON.parse(JSON.stringify(report));

    expect(Object.keys(serialized).sort()).toEqual(
      ["counts", "generated_at", "items", "schema_version"],
    );
    expect(serialized.schema_version).toBe("1.0.0");
    expect(serialized.generated_at).toBe("2025-06-15T12:00:00.000Z");
    expect(serialized.counts).toEqual({
      total: items.length,
      warning: items.filter((i) => i.severity === "warning").length,
      info: items.filter((i) => i.severity === "info").length,
    });
    expect(Array.isArray(serialized.items)).toBe(true);
    expect(serialized.items.length).toBeGreaterThan(0);
    for (const it of serialized.items) {
      expect(typeof it.path).toBe("string");
      expect(typeof it.message).toBe("string");
      expect(["info", "warning"]).toContain(it.severity);
    }
  });

  it("buildLintReport output conforms to a Zod schema for the payload", () => {
    const LintItemSchema = z.object({
      path: z.string().min(1),
      message: z.string().min(1),
      severity: z.enum(["info", "warning"]),
    });
    const LintReportSchema = z.object({
      schema_version: z.string().nullable(),
      generated_at: z.string().refine(
        (s) => !Number.isNaN(Date.parse(s)),
        { message: "generated_at must be an ISO timestamp" },
      ),
      counts: z.object({
        total: z.number().int().nonnegative(),
        warning: z.number().int().nonnegative(),
        info: z.number().int().nonnegative(),
      }),
      items: z.array(LintItemSchema),
    }).superRefine((val, ctx) => {
      if (val.counts.total !== val.items.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "counts.total must match items.length",
        });
      }
      const w = val.items.filter((i) => i.severity === "warning").length;
      const inf = val.items.filter((i) => i.severity === "info").length;
      if (val.counts.warning !== w || val.counts.info !== inf) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "counts.warning/info must match items grouped by severity",
        });
      }
    });

    // Case 1: manifest with mixed warnings + info.
    const items1 = lintManifest(m);
    const report1 = buildLintReport(m, items1, new Date("2025-03-04T05:06:07.000Z"));
    expect(() => LintReportSchema.parse(JSON.parse(JSON.stringify(report1)))).not.toThrow();

    // Case 2: clean manifest — empty items, null schema_version variant.
    const clean: ManifestPreview = { patient: m.patient };
    const items2 = lintManifest(clean);
    const report2 = buildLintReport(clean, items2);
    expect(() => LintReportSchema.parse(JSON.parse(JSON.stringify(report2)))).not.toThrow();
  });
});