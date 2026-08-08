// src/lib/biotwin/suggestedQuestions.test.ts
//
// Suggested questions are deterministic templates over the Brief. The Brief
// contains only patient-releasable material, so no suggestion can name
// withheld evidence; version questions state version facts only.

import { describe, it, expect } from "vitest";
import { buildSuggestedQuestions, MAX_SUGGESTIONS } from "./suggestedQuestions";
import type { BiologicalIntelligenceBrief } from "./brief";

function brief(over: Partial<BiologicalIntelligenceBrief>): BiologicalIntelligenceBrief {
  return {
    state: "released",
    status_line: null,
    headline: null,
    what_matters_now: [],
    established: { summary: null, confirmed_count: 0 },
    still_learning: { summary: null, items: [] },
    watching_next: { summary: null, items: [] },
    freshness: { twin_updated: "2026-08-02", twin_version: 1 },
    version_note: "This is the first released version of your Twin.",
    ...over,
  };
}

const item = {
  source_id: "D1",
  title: "Atherogenic particle burden",
  body: null,
  rank: 1,
  truth_status: "confirmed" as const,
  statement_kind: "driver",
};

describe("buildSuggestedQuestions", () => {
  it("names the top governed driver when one exists", () => {
    const qs = buildSuggestedQuestions(brief({ what_matters_now: [item] }));
    expect(qs[0]).toContain("Atherogenic particle burden");
  });

  it("released brief with no content still offers the doctor-prep question", () => {
    const qs = buildSuggestedQuestions(brief({}));
    expect(qs).toContain("What should I ask my doctor at my next visit?");
  });

  it("no released report → only witness-answerable generics, nothing report-derived", () => {
    const qs = buildSuggestedQuestions(
      brief({ state: "no_report", freshness: { twin_updated: null, twin_version: null } })
    );
    expect(qs.some((q) => q.includes("lab results"))).toBe(true);
    expect(qs.some((q) => q.includes("Atherogenic"))).toBe(false);
  });

  it("withheld release behaves like no report content — nothing leaks", () => {
    // A withheld brief has empty sections by construction (projectBrief
    // gates them), so suggestions cannot name held evidence.
    const qs = buildSuggestedQuestions(brief({ state: "release_withheld" }));
    expect(qs.every((q) => !q.includes("Atherogenic"))).toBe(true);
  });

  it("version question appears only past version 1 and states no biological change", () => {
    const v1 = buildSuggestedQuestions(brief({}));
    expect(v1.some((q) => q.toLowerCase().includes("latest version"))).toBe(false);
    const v3 = buildSuggestedQuestions(
      brief({ freshness: { twin_updated: "2026-08-02", twin_version: 3 } })
    );
    const versionQ = v3.find((q) => q.toLowerCase().includes("latest version"));
    expect(versionQ).toBeTruthy();
    expect(versionQ!.toLowerCase()).not.toContain("changed in my biology");
  });

  it("caps at MAX_SUGGESTIONS", () => {
    const qs = buildSuggestedQuestions(
      brief({
        what_matters_now: [item],
        still_learning: { summary: null, items: [item] },
        watching_next: { summary: null, items: [item] },
        freshness: { twin_updated: "2026-08-02", twin_version: 2 },
      })
    );
    expect(qs.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
  });
});
