import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateLongitudinal } from "./longitudinal.ts";

Deno.test("longitudinal: HbA1c 5.6 -> 5.8 within ceiling, coherent", () => {
  const r = evaluateLongitudinal({
    current_value: 5.8,
    current_observed_at: "2026-04-01T00:00:00Z",
    prior_observations: [
      { witness_id: "w1", value: 5.6, observed_at: "2026-01-01T00:00:00Z" },
    ],
    delta_ceiling: 1.5,
    dynamics_rule_id: "hba1c_default",
    weight: 0.2,
  });
  assertEquals(r.band, "pass");
  if (r.evidence.signal_id === "longitudinal") {
    assertEquals(r.evidence.result, "coherent");
    assertEquals(r.evidence.dynamics_rule_id, "hba1c_default");
  }
});

Deno.test("longitudinal: HbA1c 5.6 -> 12.0 jump fails (incoherent)", () => {
  const r = evaluateLongitudinal({
    current_value: 12.0,
    current_observed_at: "2026-04-01T00:00:00Z",
    prior_observations: [
      { witness_id: "w1", value: 5.6, observed_at: "2026-03-01T00:00:00Z" },
    ],
    delta_ceiling: 1.5,
    dynamics_rule_id: "hba1c_default",
    weight: 0.2,
  });
  assertEquals(r.band, "fail");
  if (r.evidence.signal_id === "longitudinal") {
    assertEquals(r.evidence.result, "incoherent");
  }
});

Deno.test("longitudinal: no priors -> insufficient_history abstain", () => {
  const r = evaluateLongitudinal({
    current_value: 5.6,
    current_observed_at: "2026-04-01T00:00:00Z",
    prior_observations: [],
    delta_ceiling: 1.5,
    dynamics_rule_id: "hba1c_default",
    weight: 0.2,
  });
  assertEquals(r.band, "abstain");
  assertEquals(r.contributes_to_denominator, false);
  if (r.evidence.signal_id === "longitudinal") {
    assertEquals(r.evidence.result, "insufficient_history");
  }
});

Deno.test("longitudinal: missing ceiling abstains", () => {
  const r = evaluateLongitudinal({
    current_value: 5.6,
    current_observed_at: "2026-04-01T00:00:00Z",
    prior_observations: [
      { witness_id: "w1", value: 5.4, observed_at: "2026-01-01T00:00:00Z" },
    ],
    delta_ceiling: null,
    dynamics_rule_id: null,
    weight: 0.2,
  });
  assertEquals(r.band, "abstain");
});

Deno.test(
  "evaluateLongitudinal: partial band fires when delta is at edge of dynamics",
  () => {
    const r = evaluateLongitudinal({
      current_value: 0.85,
      current_observed_at: "2026-04-01T00:00:00Z",
      prior_observations: [
        { witness_id: "w1", value: 0, observed_at: "2026-01-01T00:00:00Z" },
      ],
      delta_ceiling: 1.0,
      dynamics_rule_id: "edge_default",
      weight: 0.2,
    });
    assertEquals(r.band, "partial");
    assertEquals(r.score, 1);
    assertEquals(r.contributes_to_denominator, true);
    if (r.evidence.signal_id === "longitudinal") {
      assertEquals(r.evidence.result, "edge_of_dynamics");
      assertEquals(r.evidence.delta_observed, 0.85);
      assertEquals(r.evidence.delta_ceiling, 1.0);
    }
    assertEquals(
      r.notes,
      [
        "longitudinal delta within ceiling but at edge of biological dynamics",
      ],
    );
  },
);

Deno.test(
  "evaluateLongitudinal: pass case (delta well within ceiling) unchanged",
  () => {
    const r = evaluateLongitudinal({
      current_value: 0.5,
      current_observed_at: "2026-04-01T00:00:00Z",
      prior_observations: [
        { witness_id: "w1", value: 0, observed_at: "2026-01-01T00:00:00Z" },
      ],
      delta_ceiling: 1.0,
      dynamics_rule_id: "edge_default",
      weight: 0.2,
    });
    assertEquals(r.band, "pass");
    if (r.evidence.signal_id === "longitudinal") {
      assertEquals(r.evidence.result, "coherent");
    }
  },
);

Deno.test(
  "evaluateLongitudinal: fail case (delta over ceiling) unchanged",
  () => {
    const r = evaluateLongitudinal({
      current_value: 1.5,
      current_observed_at: "2026-04-01T00:00:00Z",
      prior_observations: [
        { witness_id: "w1", value: 0, observed_at: "2026-01-01T00:00:00Z" },
      ],
      delta_ceiling: 1.0,
      dynamics_rule_id: "edge_default",
      weight: 0.2,
    });
    assertEquals(r.band, "fail");
    if (r.evidence.signal_id === "longitudinal") {
      assertEquals(r.evidence.result, "incoherent");
    }
  },
);