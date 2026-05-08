import { describe, it, expect } from "vitest";
import {
  INTERVENTION_LIBRARY,
  isPermittedInCoreMode,
  isForbiddenInCoreMode,
} from "../supabase/functions/_shared/interventionLibrary.ts";
import {
  convertToCoreMode,
} from "../supabase/functions/_shared/actionPlanCoreMode.ts";
import { extractDoseTokens } from "../supabase/functions/_shared/dosePolicy.ts";

describe("action plan core mode — policy class assignment", () => {
  it("every intervention has a policy_class", () => {
    for (const intervention of INTERVENTION_LIBRARY) {
      expect(intervention.policy_class).toBeDefined();
      expect(typeof intervention.policy_class).toBe("string");
    }
  });

  it("supplement-with-dose interventions are forbidden in Core", () => {
    const supplementsWithDose = INTERVENTION_LIBRARY.filter(
      (i) => i.policy_class === "supplement_with_dose",
    );
    expect(supplementsWithDose.length).toBeGreaterThan(0);
    for (const intervention of supplementsWithDose) {
      expect(isForbiddenInCoreMode(intervention)).toBe(true);
      expect(isPermittedInCoreMode(intervention)).toBe(false);
    }
  });

  it("lifestyle and tracking interventions are permitted in Core", () => {
    const permittedClasses = [
      "lifestyle",
      "movement",
      "tracking",
      "retest",
      "doctor_question",
      "mechanism_education",
      "food_pattern",
      "sleep_circadian",
      "stress_practice",
    ];
    for (const cls of permittedClasses) {
      const interventions = INTERVENTION_LIBRARY.filter((i) => i.policy_class === cls);
      for (const intervention of interventions) {
        expect(isPermittedInCoreMode(intervention)).toBe(true);
      }
    }
  });
});

describe("action plan core mode — conversion", () => {
  it("converts a supplement-with-dose intervention to a doctor-question action", () => {
    const original: any = {
      id: "test_vit_d",
      policy_class: "supplement_with_dose",
      what: "Start Vitamin D3 5,000 IU daily with a fat-containing meal",
      how: "Take 5000 IU vitamin D with breakfast",
      coordinates: ["E12"],
      sequence_priority: 1,
    };
    const converted = convertToCoreMode(original);
    expect(converted.policy_class).toBe("doctor_question");
    expect(converted.what.toLowerCase()).toContain("discuss");
    expect(converted.what.toLowerCase()).toContain("vitamin d");
    expect(converted.doctor_question).toBeDefined();
  });

  it("converted action contains no dose tokens in any field", () => {
    const original: any = {
      id: "test_mag",
      policy_class: "supplement_with_dose",
      what: "Start magnesium glycinate 200 mg before bed",
      how: "Take 200 mg magnesium 30 minutes before sleep",
      coordinates: ["E5"],
      sequence_priority: 2,
    };
    const converted = convertToCoreMode(original);
    expect(extractDoseTokens(converted.what)).toEqual([]);
    expect(extractDoseTokens(converted.how)).toEqual([]);
    if (converted.rationale) expect(extractDoseTokens(converted.rationale)).toEqual([]);
    if (converted.doctor_question) expect(extractDoseTokens(converted.doctor_question)).toEqual([]);
  });

  it("preserves source_intervention_id for traceability", () => {
    const original: any = {
      id: "test_b12",
      policy_class: "supplement_with_dose",
      what: "Start methylcobalamin 1,000 mcg sublingual daily",
      how: "Place 1000 mcg under tongue each morning",
      coordinates: ["E8"],
      sequence_priority: 3,
    };
    const converted = convertToCoreMode(original);
    expect(converted.source_intervention_id).toBe("test_b12");
  });
});

describe("action plan core mode — structural backstop", () => {
  it("none of the existing forbidden interventions, when converted, contain dose tokens", () => {
    const forbidden = INTERVENTION_LIBRARY.filter(isForbiddenInCoreMode);
    expect(forbidden.length).toBeGreaterThan(0);
    for (const intervention of forbidden) {
      const converted = convertToCoreMode(intervention);
      expect(extractDoseTokens(converted.what)).toEqual([]);
      expect(extractDoseTokens(converted.how)).toEqual([]);
      if (converted.rationale) {
        expect(extractDoseTokens(converted.rationale)).toEqual([]);
      }
      if (converted.doctor_question) {
        expect(extractDoseTokens(converted.doctor_question)).toEqual([]);
      }
    }
  });
});