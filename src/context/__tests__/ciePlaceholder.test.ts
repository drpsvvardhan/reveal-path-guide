import { describe, it, expect } from "vitest";
import { hasCompletedCiePlaceholder } from "@/context/TerrainRenderContext";

const portrait = (text: string) => ({
  id: "r1",
  version: 1,
  status: "active",
  patient_portrait: {
    what_you_already_know: text,
    working_harder_than_you_realize: "",
    where_to_start: "",
    the_one_action: "",
  },
  clinician_summary: null,
  generated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  voice_validation_status: "passed",
  voice_validation_warnings: null,
});

describe("hasCompletedCiePlaceholder", () => {
  it("returns false for null render", () => {
    expect(hasCompletedCiePlaceholder(null)).toBe(false);
  });

  it("returns false for a normal portrait paragraph", () => {
    expect(
      hasCompletedCiePlaceholder(
        portrait("Your metabolic terrain is showing early softening in glucose handling.")
      )
    ).toBe(false);
  });

  it("detects the stale 'CIE has not been completed' copy", () => {
    expect(
      hasCompletedCiePlaceholder(
        portrait("Your terrain cannot be generated because your CIE has not been completed.")
      )
    ).toBe(true);
  });

  it("detects the 'complete your CIE assessment' nudge", () => {
    expect(
      hasCompletedCiePlaceholder(
        portrait("Please complete your CIE assessment to see your portrait.")
      )
    ).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(
      hasCompletedCiePlaceholder(
        portrait("YOUR CIE HAS NOT BEEN COMPLETED YET.")
      )
    ).toBe(true);
  });
});