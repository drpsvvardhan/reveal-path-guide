// tests/cie-factory-import.test.ts
//
// Factory CIE bootstrap import — the mapping from a CodexOS intake export
// (question.json) into the app's CIE tables.
//
// Authority rule under test: FACTORY scores are authoritative. The factory
// engine scores natural-language vocabularies the app's maps don't know, and
// its domain scores are the exact values frozen into the patient's Twin
// (Subject-01's E13 = 57.3 appears verbatim in his v18 twin). Import must copy,
// never re-score.

import { describe, it, expect } from "vitest";
import {
  validateFactoryCiePayload,
  mapFactoryCie,
  inferQuestionType,
  type FactoryCiePayload,
} from "../supabase/functions/_shared/cieFactoryImport.ts";

// Subject-01-shaped fixture: real domains, real score shapes, factory vocabulary
// the app's score maps don't contain.
const syntheticCie: FactoryCiePayload = {
  Name: "Test Patient",
  intakeData: {
    customer_id: "VZSYN0001",
    layer1Responses: {
      A1: { A1Q1: "excellent", A1Q2: "no", A1Q3: "sometimes" },
      E13: { E13Q1: "sometimes", E13Q2: "twice", E13Q3: "somewhat_refreshed" },
      B5: { B5Q1: "never", B5Q2: "no", B5Q3: "never" },
    },
    layer2Responses: {
      E13: {
        E13D1: "rarely", E13D2: "always", E13D3: "yes", E13D4: "no",
        E13D5: "often", E13D6: "no", E13D7: "rarely", E13D8: "afternoon",
        E13D9: "rarely", E13D10: "excellent",
      },
    },
    scores: {
      A1: { score: 87.5, triggered: false, qScores: [100, 100, 50], hasL2: false },
      E13: { score: 57.3, triggered: true, qScores: [50, 50, 75], hasL2: true },
      B5: { score: 100, triggered: false, qScores: [100, 100, 100], hasL2: false },
    },
    deepDiveDomains: ["E13"],
  },
};

const ids = { assessmentId: "aaaaaaaa-0000-0000-0000-000000000001", userId: "bbbbbbbb-0000-0000-0000-000000000002" };

describe("validateFactoryCiePayload", () => {
  it("accepts the factory export shape", () => {
    expect(validateFactoryCiePayload(syntheticCie).valid).toBe(true);
  });

  it("rejects non-factory shapes with named reasons", () => {
    const r1 = validateFactoryCiePayload({});
    expect(r1.valid).toBe(false);
    expect(r1.errors.join(" ")).toContain("intakeData");

    const r2 = validateFactoryCiePayload({
      intakeData: { layer1Responses: { ZZ99: { ZZ99Q1: "yes" } } },
    });
    expect(r2.valid).toBe(false);
    expect(r2.errors.join(" ")).toContain("ZZ99");
  });
});

describe("mapFactoryCie", () => {
  const mapped = mapFactoryCie(syntheticCie, ids);

  it("factory domain finals are copied verbatim, never re-scored", () => {
    const e13 = mapped.domainRows.find((d) => d.domain_id === "E13")!;
    expect(e13.final_score).toBe(57.3);
    expect(e13.triggered_layer2).toBe(true);
    const a1 = mapped.domainRows.find((d) => d.domain_id === "A1")!;
    expect(a1.final_score).toBe(87.5);
    expect(a1.triggered_layer2).toBe(false);
  });

  it("layer-1 component derives from the factory's own per-question scores", () => {
    // E13 qScores [50, 50, 75] with weights [0.40, 0.35, 0.25] → 56.25 → 56.3
    const e13 = mapped.domainRows.find((d) => d.domain_id === "E13")!;
    expect(e13.layer1_score).toBe(56.3);
    // Back-derived L2 component: (57.3 − 0.4·56.25)/0.6 ≈ 58.0
    expect(e13.layer2_score).toBeCloseTo(58, 0);
  });

  it("response rows carry raw factory vocabulary with per-question factory scores", () => {
    const e13q3 = mapped.responseRows.find((r) => r.question_id === "E13Q3")!;
    expect(e13q3.raw_response).toBe("somewhat_refreshed");
    expect(e13q3.layer).toBe(1);
    expect(e13q3.score).toBe(75); // qScores[2]
    const e13d8 = mapped.responseRows.find((r) => r.question_id === "E13D8")!;
    expect(e13d8.layer).toBe(2);
    expect(e13d8.raw_response).toBe("afternoon");
  });

  it("unscored domains default neutral with a diagnostic, never invented", () => {
    const noScores = mapFactoryCie(
      {
        intakeData: {
          layer1Responses: { A1: { A1Q1: "no", A1Q2: "no", A1Q3: "never" } },
        },
      },
      ids
    );
    const a1 = noScores.domainRows.find((d) => d.domain_id === "A1")!;
    expect(a1.final_score).toBe(50);
    expect(noScores.diagnostics.some((d) => d.includes("A1"))).toBe(true);
  });

  it("gates aggregate factory finals with the shared gate definitions", () => {
    // CLI = mean(B5, C8, E15, F16, I24) = mean(100, 50, 50, 50, 50) = 60
    const cli = mapped.gateRows.find((g) => g.gate_id === "CLI")!;
    expect(cli.score).toBe(60);
    expect(cli.traffic_light).toBe("YELLOW");
  });

  it("counts and trigger lists round-trip", () => {
    expect(mapped.totalQuestions).toBe(9 + 10);
    expect(mapped.triggeredDomains).toEqual(["E13"]);
    expect(mapped.customerId).toBe("VZSYN0001");
  });
});

describe("inferQuestionType", () => {
  it("recognizes known vocabularies and defaults the factory's own", () => {
    expect(inferQuestionType("sometimes")).toBe("frequency");
    expect(inferQuestionType("yes")).toBe("yesno");
    expect(inferQuestionType("excellent")).toBe("effectiveness");
    expect(inferQuestionType("mild")).toBe("severity");
    expect(inferQuestionType("afternoon")).toBe("chronotype");
    expect(inferQuestionType("somewhat_refreshed")).toBe("frequency"); // default
  });
});
