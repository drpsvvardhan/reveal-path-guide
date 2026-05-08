import { describe, it, expect } from "vitest";
import {
  analyzeRow,
  summarize,
  type AuditRow,
} from "../scripts/diagnose-dose-policy-false-positives.ts";

function row(overrides: Partial<AuditRow>): AuditRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    created_at: "2026-05-08T00:00:00Z",
    status: "replaced_with_fallback",
    routing_mode: "no_dose_fallback",
    replacement_template_used: "NO_DOSE_FALLBACK",
    last_user_message: null,
    original_output: null,
    replaced_with: null,
    dose_patterns_matched: [],
    ...overrides,
  };
}

describe("dose policy false-positive diagnostic", () => {
  it("flags lipid-cluster-style outputs as false positives", () => {
    const r = row({
      original_output:
        "Your ApoB at 102 mg/dL alongside LDL-C 148 mg/dL points to elevated particle burden. hs-CRP 0.3 mg/L.",
    });
    const d = analyzeRow(r);
    expect(d.verdict).toBe("false_positive_concentration_units");
    expect(d.detected_dose_tokens).toEqual([]);
    expect(d.detected_concentration_units.length).toBeGreaterThan(0);
  });

  it("flags vitamin-D ng/mL output as false positive", () => {
    const r = row({
      original_output: "Your vitamin D at 92 ng/mL is in the optimal range.",
    });
    expect(analyzeRow(r).verdict).toBe("false_positive_concentration_units");
  });

  it("flags g/dL hemoglobin output as false positive", () => {
    const r = row({
      original_output: "Hemoglobin 14.2 g/dL and albumin 4.5 g/dL are normal.",
    });
    expect(analyzeRow(r).verdict).toBe("false_positive_concentration_units");
  });

  it("flags mmol/L glucose output as false positive", () => {
    const r = row({
      original_output: "Fasting glucose 5.2 mmol/L is within range.",
    });
    expect(analyzeRow(r).verdict).toBe("false_positive_concentration_units");
  });

  it("flags whitespace-around-slash variants as false positives", () => {
    const r = row({
      original_output: "ApoB 102 mg / dL is elevated.",
    });
    expect(analyzeRow(r).verdict).toBe("false_positive_concentration_units");
  });

  it("does NOT flag legitimate dose-replacement output", () => {
    const r = row({
      original_output: "Take 5000 IU vitamin D daily with food.",
      dose_patterns_matched: ["5000 IU"],
    });
    expect(analyzeRow(r).verdict).toBe("legitimate_dose_replacement");
  });

  it("classifies non-fallback rows as skipped", () => {
    const r = row({
      status: "passed",
      replacement_template_used: null,
      original_output: "Your ApoB is 102 mg/dL.",
    });
    expect(analyzeRow(r).verdict).toBe("skipped_not_fallback");
  });

  it("flags empty output replacements as no-token false positives", () => {
    const r = row({ original_output: "Some prose with no numbers." });
    expect(analyzeRow(r).verdict).toBe("false_positive_no_tokens");
  });

  it("summary returns nonzero falsePositiveCount when any FP present", () => {
    const diagnoses = [
      analyzeRow(row({ original_output: "ApoB 102 mg/dL." })),
      analyzeRow(row({
        original_output: "Take 5mg melatonin",
        dose_patterns_matched: ["5mg"],
      })),
    ];
    const s = summarize(diagnoses);
    expect(s.falsePositiveCount).toBe(1);
    expect(s.counts.false_positive_concentration_units).toBe(1);
    expect(s.counts.legitimate_dose_replacement).toBe(1);
  });

  it("mixed real-dose + lab values is treated as legitimate", () => {
    const r = row({
      original_output:
        "Vitamin D at 22 ng/mL is low. Clinician may suggest 1000 IU.",
      dose_patterns_matched: ["1000 IU"],
    });
    expect(analyzeRow(r).verdict).toBe("legitimate_dose_replacement");
  });
});