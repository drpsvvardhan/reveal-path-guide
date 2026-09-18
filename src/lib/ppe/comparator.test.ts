import { describe, it, expect } from "vitest";
import { comparePhases, type DailyObservation } from "./comparator";
import { comparePhases as comparePhasesEdge } from "../../../supabase/functions/_shared/ppe/comparator";

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

  // ROOT CAUSE OF THE PREVIOUSLY FAILING CASE
  // ------------------------------------------------------------------
  // This dataset was historically labelled "overlap is high" and expected
  // POSSIBLE_SIGNAL. The label was wrong, not the engine:
  //   run_in        = [100, 95, 98, 92, 105]  -> range 92..105, median 98
  //   intervention  = [93, 96, 90, 99, 91]    -> range 90..99,  median 93
  //   intersection  = 99 - 92 = 7 ; union = 105 - 90 = 15 -> overlap 0.4667
  //   direction consistency (decrease vs median 98) = 4/5 = 0.8
  // Under the declared rule (desired direction met, consistency >= 0.7,
  // overlap < 0.5) SIGNAL_DETECTED is the correct verdict. The fixture is
  // retained here as an explicit LOW-overlap regression with numeric
  // assertions, and a genuinely high-overlap fixture is added below.
  // Production thresholds are unchanged.
  it("SIGNAL_DETECTED on the historical fixture — overlap is 0.467, i.e. low", () => {
    const observations = [
      ...[100, 95, 98, 92, 105].map((v) => mk("run_in", v, false)),
      ...[93, 96, 90, 99, 91].map((v) => mk("intervention", v, true)),
    ];
    const r = comparePhases({ ...base, observations });
    expect(r.median_a).toBe(98);
    expect(r.median_b).toBe(93);
    expect(r.abs_change).toBe(-5);
    expect(r.direction_consistency_pct).toBeCloseTo(0.8, 10);
    expect(r.overlap_ratio).toBeCloseTo(7 / 15, 10);
    expect(r.result).toBe("SIGNAL_DETECTED");
  });

  it("POSSIBLE_SIGNAL on a genuinely high-overlap fixture (overlap 12/14)", () => {
    const observations = [
      ...[100, 95, 98, 92, 105].map((v) => mk("run_in", v, false)),
      ...[93, 96, 91, 104, 92].map((v) => mk("intervention", v, true)),
    ];
    const r = comparePhases({ ...base, observations });
    expect(r.median_a).toBe(98);
    expect(r.median_b).toBe(93);
    expect(r.direction_consistency_pct).toBeCloseTo(0.8, 10);
    expect(r.overlap_ratio).toBeCloseTo(12 / 14, 10);
    expect(r.result).toBe("POSSIBLE_SIGNAL");
  });

  it("overlap exactly 0.50 is NOT low enough for SIGNAL_DETECTED", () => {
    const observations = [
      ...[90, 100, 100, 100, 110].map((v) => mk("run_in", v, false)),
      ...[95, 96, 97, 98, 105].map((v) => mk("intervention", v, true)),
    ];
    const r = comparePhases({ ...base, observations });
    expect(r.overlap_ratio).toBeCloseTo(0.5, 10);
    expect(r.direction_consistency_pct).toBeCloseTo(0.8, 10);
    expect(r.result).toBe("POSSIBLE_SIGNAL");
  });

  it("direction consistency exactly 0.70 with low overlap is SIGNAL_DETECTED", () => {
    const observations = [
      ...[100, 101, 99, 100, 100].map((v) => mk("run_in", v, false)),
      ...[80, 81, 82, 83, 84, 85, 86, 100, 101, 102].map((v) =>
        mk("intervention", v, true),
      ),
    ];
    const r = comparePhases({ ...base, observations });
    expect(r.direction_consistency_pct).toBeCloseTo(0.7, 10);
    expect(r.overlap_ratio!).toBeLessThan(0.5);
    expect(r.result).toBe("SIGNAL_DETECTED");
  });

  it("direction consistency just below 0.70 falls back to POSSIBLE_SIGNAL", () => {
    const observations = [
      ...[100, 101, 99, 100, 100].map((v) => mk("run_in", v, false)),
      ...[80, 81, 82, 83, 84, 85, 100, 101, 102, 103].map((v) =>
        mk("intervention", v, true),
      ),
    ];
    const r = comparePhases({ ...base, observations });
    expect(r.direction_consistency_pct).toBeCloseTo(0.6, 10);
    expect(r.result).toBe("POSSIBLE_SIGNAL");
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

// The edge copy exists because Deno functions cannot import from src/. Its
// prose differs intentionally; every decision and numeric field must not.
describe("PPE comparator — client/edge parity", () => {
  const base = {
    phase_a: "run_in" as const,
    phase_b: "intervention" as const,
    min_observations_per_phase: 5,
    min_adherence_pct: 0.7,
  };

  const fixtures: Array<{ name: string; input: Parameters<typeof comparePhases>[0] }> = [
    {
      name: "low overlap",
      input: {
        ...base,
        desired_direction: "decrease",
        observations: [
          ...[100, 95, 98, 92, 105].map((v) => mk("run_in", v, false)),
          ...[93, 96, 90, 99, 91].map((v) => mk("intervention", v, true)),
        ],
      },
    },
    {
      name: "high overlap",
      input: {
        ...base,
        desired_direction: "decrease",
        observations: [
          ...[100, 95, 98, 92, 105].map((v) => mk("run_in", v, false)),
          ...[93, 96, 91, 104, 92].map((v) => mk("intervention", v, true)),
        ],
      },
    },
    {
      name: "increase direction",
      input: {
        ...base,
        desired_direction: "increase",
        observations: [
          ...[40, 41, 39, 40, 40].map((v) => mk("run_in", v, false)),
          ...[52, 53, 51, 54, 52].map((v) => mk("intervention", v, true)),
        ],
      },
    },
    {
      name: "stabilize direction",
      input: {
        ...base,
        desired_direction: "stabilize",
        observations: [
          ...[100, 120, 80, 130, 70].map((v) => mk("run_in", v, false)),
          ...[100, 101, 99, 100, 100].map((v) => mk("intervention", v, true)),
        ],
      },
    },
    {
      name: "not interpretable",
      input: {
        ...base,
        desired_direction: "decrease",
        observations: [
          ...[100, 100, 100].map((v) => mk("run_in", v, false)),
          ...[85, 84].map((v) => mk("intervention", v, true)),
        ],
      },
    },
  ];

  const numericKeys = [
    "n_a", "n_b", "median_a", "median_b", "abs_change", "pct_change",
    "direction_consistency_pct", "overlap_ratio", "adherence_pct",
    "missingness_pct", "confounder_burden",
  ] as const;

  for (const f of fixtures) {
    it(`matches the edge implementation — ${f.name}`, () => {
      const client = comparePhases(f.input);
      const edge = comparePhasesEdge(f.input as never);
      expect(edge.result).toBe(client.result);
      for (const key of numericKeys) {
        expect(edge[key]).toEqual(client[key]);
      }
    });
  }
});
