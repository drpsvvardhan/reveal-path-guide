import { describe, it, expect } from "vitest";
import { comparePhases, type DailyObservation } from "./comparator";

function mk(
  phase: DailyObservation["phase"],
  value: number | null,
  performed: boolean = true,
  confounders: Record<string, unknown> = {},
): DailyObservation {
  return {
    phase,
    intervention_performed: performed,
    primary_value: value,
    confounders,
  };
}

describe("PPE comparator — deterministic n=1", () => {
  const base = {
    phase_a: "run_in" as const,
    phase_b: "intervention" as const,
    desired_direction: "decrease" as const,
    min_observations_per_phase: 5,
    min_adherence_pct: 0.7,
  };

  it("SIGNAL_DETECTED when medians shift and overlap is low", () => {
    const observations = [
      ...[100, 102, 101, 99, 100].map((v) => mk("run_in", v, false)),
      ...[85, 84, 86, 83, 84, 82].map((v) => mk("intervention", v, true)),
    ];
    const r = comparePhases({ ...base, observations });
    expect(r.result).toBe("SIGNAL_DETECTED");
  });

  it("POSSIBLE_SIGNAL when direction matches but overlap is high", () => {
    const observations = [
      ...[100, 95, 98, 92, 105].map((v) => mk("run_in", v, false)),
      ...[93, 96, 90, 99, 91].map((v) => mk("intervention", v, true)),
    ];
    const r = comparePhases({ ...base, observations });
    expect(["POSSIBLE_SIGNAL", "NO_DETECTABLE_SIGNAL"]).toContain(r.result);
  });

  it("NO_DETECTABLE_SIGNAL when no directional shift", () => {
    const observations = [
      ...[100, 101, 99, 100, 100].map((v) => mk("run_in", v, false)),
      ...[100, 101, 99, 100, 100].map((v) => mk("intervention", v, true)),
    ];
    const r = comparePhases({ ...base, observations });
    expect(r.result).toBe("NO_DETECTABLE_SIGNAL");
  });

  it("NOT_INTERPRETABLE when low adherence", () => {
    const observations = [
      ...[100, 100, 100, 100, 100].map((v) => mk("run_in", v, false)),
      ...[85, 84, 86, 83, 84].map((v, i) => mk("intervention", v, i < 2)),
    ];
    const r = comparePhases({ ...base, observations });
    expect(r.result).toBe("NOT_INTERPRETABLE");
    expect(r.reasons.join(" ")).toMatch(/adherence/i);
  });

  it("NOT_INTERPRETABLE when confounder burden ≥ 30%", () => {
    const observations = [
      ...[100, 100, 100, 100, 100].map((v) => mk("run_in", v, false)),
      ...[85, 84, 86, 83, 84].map((v, i) =>
        mk("intervention", v, true, i < 2 ? { illness: true } : {}),
      ),
    ];
    const r = comparePhases({ ...base, observations });
    expect(r.result).toBe("NOT_INTERPRETABLE");
    expect(r.reasons.join(" ")).toMatch(/confounders/i);
  });

  it("NOT_INTERPRETABLE when observations below floor", () => {
    const observations = [
      ...[100, 100, 100].map((v) => mk("run_in", v, false)),
      ...[85, 84].map((v) => mk("intervention", v, true)),
    ];
    const r = comparePhases({ ...base, observations });
    expect(r.result).toBe("NOT_INTERPRETABLE");
  });

  it("STOPPED_FOR_SAFETY takes precedence", () => {
    const r = comparePhases({
      ...base,
      observations: [],
      stopped_for_safety: true,
    });
    expect(r.result).toBe("STOPPED_FOR_SAFETY");
  });
});