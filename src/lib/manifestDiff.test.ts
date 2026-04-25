import { describe, it, expect } from "vitest";
import { diffManifests } from "./manifestDiff";
import { ManifestPreviewSchema } from "./manifestSchema";
import { sampleManifestPreview } from "./sampleManifestPreview";

describe("diffManifests", () => {
  it("reports identical when comparing the bundled sample to its Zod-parsed self (no phantom key-order diffs)", () => {
    const parsed = ManifestPreviewSchema.parse(sampleManifestPreview);
    const entries = diffManifests(sampleManifestPreview, parsed);
    expect(entries).toEqual([]);
  });

  it("ignores key-order differences inside arrays of objects", () => {
    const a = { items: [{ a: 1, b: 2 }] };
    const b = { items: [{ b: 2, a: 1 }] };
    expect(diffManifests(a, b)).toEqual([]);
  });

  it("still detects real value changes inside arrays of objects", () => {
    const parsed = ManifestPreviewSchema.parse(sampleManifestPreview);
    const edited = {
      ...parsed,
      patient: { ...parsed.patient, firstName: "Changed Name" },
    };
    const entries = diffManifests(sampleManifestPreview, edited);
    const change = entries.find((d) => d.path === "patient.firstName");
    expect(change).toBeDefined();
    expect(change?.kind).toBe("changed");
  });
});
