// src/lib/biotwin/brief.test.ts
//
// The Brief is a deterministic view of the released Twin, not another
// interpretation of it (docs/ASK_MY_TWIN_CONSTITUTION.md). These tests pin
// the constraints: governed source ranking only, patient-facing authority
// only, release-control gating, the report's own words, and version facts
// that never say "your biology changed".

import { describe, it, expect } from "vitest";
import { projectBrief } from "./brief";
import type { BiotwinReport, BiotwinStatement } from "./types";

function stmt(over: Partial<BiotwinStatement>): BiotwinStatement {
  return {
    id: over.id ?? crypto.randomUUID(),
    source_id: over.source_id ?? "SRC-1",
    section: over.section ?? "clinical_state",
    statement_kind: over.statement_kind ?? "confirmed_measurement",
    truth_status: over.truth_status ?? "confirmed",
    title: over.title ?? "A finding",
    body: over.body ?? null,
    bounds: null,
    measurements: null,
    timepoint: null,
    clinical_authority: over.clinical_authority ?? "patient_facing",
    requires_measurement: over.requires_measurement ?? null,
    holds: null,
    witness_id: null,
    ordinal: over.ordinal ?? 0,
    provenance: over.provenance ?? null,
  };
}

function report(over: Partial<BiotwinReport> = {}): BiotwinReport {
  return {
    id: "r1",
    twin_id: "twin-1",
    version: over.version ?? 1,
    status: "active",
    generated_date: over.generated_date ?? "2026-08-02",
    schema_version: null,
    semantic_repair_version: null,
    release_control: null,
    executive_synthesis: over.executive_synthesis ?? {
      headline: "Confirmed atherogenic lipid burden with an unresolved inflammatory signal.",
      what_is_certain: "Lipid particle burden is measured and bounded.",
      what_is_not_certain: "Glycaemic and inflammatory state are single-timepoint only.",
      what_happens_next: "Two repeat measurements convert candidate signals into decisions.",
    },
    attestation: null,
    holds: null,
    clinician_review_required: false,
    patient_release_permitted: over.patient_release_permitted ?? true,
    ...over,
  } as BiotwinReport;
}

describe("projectBrief — gating", () => {
  it("no report → no_report state, ask still framed as available", () => {
    const b = projectBrief(null, []);
    expect(b.state).toBe("no_report");
    expect(b.version_note).toContain("not been released");
  });

  it("release withheld → status line only, no content leaks", () => {
    const b = projectBrief(report({ patient_release_permitted: false }), [
      stmt({ statement_kind: "driver", provenance: { rank: 1 } }),
    ]);
    expect(b.state).toBe("release_withheld");
    expect(b.what_matters_now).toEqual([]);
    expect(b.headline).toBeNull();
  });

  it("clinician-only statements never appear patient-facing", () => {
    const b = projectBrief(report(), [
      stmt({
        statement_kind: "driver",
        clinical_authority: "clinician_only",
        provenance: { rank: 1 },
        title: "Clinician-only driver",
      }),
    ]);
    expect(b.what_matters_now).toEqual([]);
  });
});

describe("projectBrief — governed ranking only", () => {
  it("orders drivers by the source report's own rank, not ordinal", () => {
    const b = projectBrief(report(), [
      stmt({
        source_id: "D2",
        statement_kind: "driver",
        ordinal: 0,
        provenance: { rank: "2" },
        title: "Second",
      }),
      stmt({
        source_id: "D1",
        statement_kind: "driver",
        ordinal: 5,
        provenance: { rank: 1 },
        title: "First",
      }),
    ]);
    expect(b.what_matters_now.map((i) => i.source_id)).toEqual(["D1", "D2"]);
  });

  it("unranked drivers follow ranked ones and stay unranked (rank null)", () => {
    const b = projectBrief(report(), [
      stmt({ source_id: "DU", statement_kind: "driver", provenance: null }),
      stmt({
        source_id: "D1",
        statement_kind: "driver",
        provenance: { rank: 1 },
      }),
    ]);
    expect(b.what_matters_now.map((i) => i.source_id)).toEqual(["D1", "DU"]);
    expect(b.what_matters_now[1].rank).toBeNull();
  });
});

describe("projectBrief — the report's own words", () => {
  it("section summaries come verbatim from executive_synthesis", () => {
    const b = projectBrief(report(), []);
    expect(b.headline).toBe(
      "Confirmed atherogenic lipid burden with an unresolved inflammatory signal."
    );
    expect(b.established.summary).toBe(
      "Lipid particle burden is measured and bounded."
    );
    expect(b.still_learning.summary).toContain("single-timepoint only");
    expect(b.watching_next.summary).toContain("repeat measurements");
  });

  it("still learning holds candidate/unknown/contradiction, never confirmed reassurance", () => {
    const b = projectBrief(report(), [
      stmt({
        source_id: "C1",
        truth_status: "candidate",
        statement_kind: "candidate_signal",
        title: "Candidate signal",
      }),
      stmt({
        source_id: "CTR1",
        statement_kind: "contradiction",
        truth_status: "unknown",
        title: "Held contradiction",
      }),
      stmt({ source_id: "OK1", truth_status: "confirmed", title: "Confirmed" }),
    ]);
    const ids = b.still_learning.items.map((i) => i.source_id);
    expect(ids).toContain("C1");
    expect(ids).toContain("CTR1");
    expect(ids).not.toContain("OK1");
  });

  it("watching next requires an actual measurement requirement", () => {
    const b = projectBrief(report(), [
      stmt({
        source_id: "A1",
        statement_kind: "action",
        requires_measurement: { minimum_fields: ["hs-CRP"] },
        title: "Repeat hs-CRP",
      }),
      stmt({
        source_id: "A2",
        statement_kind: "action",
        requires_measurement: null,
        title: "General advice",
      }),
    ]);
    expect(b.watching_next.items.map((i) => i.source_id)).toEqual(["A1"]);
  });
});

describe("projectBrief — version facts, never earned-diff language", () => {
  it("first version says so", () => {
    const b = projectBrief(report({ version: 1 }), []);
    expect(b.version_note).toContain("first released version");
  });

  it("later versions state the version fact and never claim biological change", () => {
    const b = projectBrief(report({ version: 3 }), []);
    expect(b.version_note).toContain("version 3");
    expect(b.version_note.toLowerCase()).not.toContain("biology changed");
    expect(b.version_note.toLowerCase()).not.toContain("your biology");
  });
});
