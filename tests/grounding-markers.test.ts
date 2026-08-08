// tests/grounding-markers.test.ts
//
// Evidence-use grounding markers (Ask My Twin, Release 0).
//
// Doctrine under test (docs/ASK_MY_TWIN_CONSTITUTION.md):
//   - Fabricated provenance never crosses: a marker citing an ID not in the
//     authorized context fails validation.
//   - Available evidence is not used evidence: only cited markers become
//     USED refs.
//   - Missing markers are measured (marker_coverage), not blocked.
//   - Stripping is surgical: markdown structure and time-series indentation
//     survive.

import { describe, it, expect } from "vitest";
import {
  parseGroundingMarkers,
  dedupeMarkers,
  validateGroundingMarkers,
  stripGroundingMarkers,
  computeMarkerCoverage,
  buildGroundingRegenFeedback,
  GROUNDING_FALLBACK_MESSAGE,
  type AllowedGroundingContext,
} from "../supabase/functions/_shared/groundingMarkers.ts";

const allowed: AllowedGroundingContext = {
  witness: new Set(["WIT-1", "WIT-2"]),
  cluster: new Set(["CL-A", "none"]),
  statement: new Set(["BST-233"]),
  contradiction: new Set(["CTR-C01"]),
};

describe("parseGroundingMarkers", () => {
  it("parses all four marker types", () => {
    const text =
      "Your HbA1c is stable. {witness:WIT-1}{cluster:CL-A} " +
      "The report confirms this. {statement:BST-233} " +
      "One question is held open. {contradiction:CTR-C01}";
    const markers = parseGroundingMarkers(text);
    expect(markers).toEqual([
      { type: "witness", id: "WIT-1" },
      { type: "cluster", id: "CL-A" },
      { type: "statement", id: "BST-233" },
      { type: "contradiction", id: "CTR-C01" },
    ]);
  });

  it("ignores non-marker braces", () => {
    expect(parseGroundingMarkers("{time_series:start} {foo:bar}")).toEqual([]);
  });
});

describe("validateGroundingMarkers", () => {
  it("passes markers that exist in the authorized context", () => {
    const r = validateGroundingMarkers(
      [
        { type: "witness", id: "WIT-1" },
        { type: "statement", id: "BST-233" },
      ],
      allowed
    );
    expect(r.valid).toBe(true);
    expect(r.fabricated).toEqual([]);
  });

  it("rejects a fabricated witness ID — fabricated provenance never crosses", () => {
    const r = validateGroundingMarkers(
      [{ type: "witness", id: "WIT-NOT-IN-CONTEXT" }],
      allowed
    );
    expect(r.valid).toBe(false);
    expect(r.fabricated).toEqual([
      { type: "witness", id: "WIT-NOT-IN-CONTEXT" },
    ]);
  });

  it("rejects cross-type citation (a witness ID cited as a statement)", () => {
    const r = validateGroundingMarkers(
      [{ type: "statement", id: "WIT-1" }],
      allowed
    );
    expect(r.valid).toBe(false);
  });

  it("allows the cluster:none sentinel", () => {
    const r = validateGroundingMarkers(
      [{ type: "cluster", id: "none" }],
      allowed
    );
    expect(r.valid).toBe(true);
  });
});

describe("stripGroundingMarkers", () => {
  it("removes markers and at most one preceding space", () => {
    expect(
      stripGroundingMarkers("Your value is stable. {witness:WIT-1}{cluster:CL-A}")
    ).toBe("Your value is stable.");
  });

  it("preserves newlines and time-series indentation (surgical strip)", () => {
    const text =
      "**What this means:**\n" +
      "**From your data:** Stable. {witness:WIT-1}\n\n" +
      "{time_series:start}\n" +
      "marker: HbA1c\n" +
      "points:\n" +
      "  2020-05-27 | 5.3\n" +
      "  2021-03-05 | 5.7\n" +
      "{time_series:end}";
    const stripped = stripGroundingMarkers(text);
    expect(stripped).toContain("**From your data:** Stable.\n\n");
    expect(stripped).toContain("\n  2020-05-27 | 5.3\n");
    expect(stripped).toContain("{time_series:start}");
  });
});

describe("computeMarkerCoverage", () => {
  it("is null when there is no From-your-data content", () => {
    expect(
      computeMarkerCoverage("**From medical knowledge:** General education.")
    ).toBeNull();
  });

  it("counts cited vs uncited sentences inside From-your-data blocks", () => {
    const text =
      "**What this means:**\n" +
      "**From your data:** Your HbA1c is stable. {witness:WIT-1} " +
      "This is an uncited claim.\n\n" +
      "**From medical knowledge:** Unmarked general education is fine here.";
    expect(computeMarkerCoverage(text)).toBeCloseTo(0.5);
  });

  it("does not count cluster:none as evidence", () => {
    const text = "**From your data:** A claim. {cluster:none}";
    expect(computeMarkerCoverage(text)).toBe(0);
  });

  it("counts a cluster citation as grounding", () => {
    const text = "**From your data:** A claim. {cluster:CL-A}";
    expect(computeMarkerCoverage(text)).toBe(1);
  });
});

describe("dedupeMarkers", () => {
  it("dedupes on type+id, preserving order", () => {
    const out = dedupeMarkers([
      { type: "witness", id: "WIT-1" },
      { type: "witness", id: "WIT-1" },
      { type: "cluster", id: "WIT-1" },
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("regen feedback + fallback", () => {
  it("names the fabricated IDs in the feedback", () => {
    const fb = buildGroundingRegenFeedback([
      { type: "witness", id: "WIT-FAKE" },
    ]);
    expect(fb).toContain("{witness:WIT-FAKE}");
    expect(fb).toContain("Do not");
  });

  it("fallback carries no quoted doctor question (extractor must not fire)", () => {
    // Same quote pattern the extractor uses; a quoted question >= 10 chars
    // containing "?" would be auto-queued from a fallback, which must never
    // happen.
    const quotePattern =
      /["“”'‘’]([^"“”'‘’]+?)["“”'‘’]/g;
    const quoted = [...GROUNDING_FALLBACK_MESSAGE.matchAll(quotePattern)]
      .map((m) => m[1])
      .filter((q) => q.includes("?") && q.length >= 10);
    expect(quoted).toEqual([]);
  });
});
