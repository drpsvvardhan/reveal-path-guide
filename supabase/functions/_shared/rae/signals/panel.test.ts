import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluatePanel } from "./panel.ts";

Deno.test("panel: HbA1c with diabetes panel siblings passes", () => {
  const r = evaluatePanel({
    panel_grouping_key: "req-123",
    siblings: [
      { observation_id: "o1", concept_id: "glucose" },
      { observation_id: "o2", concept_id: "fructosamine" },
    ],
    expected_panel_concept_ids: ["glucose", "fructosamine"],
    panel_id: "diabetes_panel",
    weight: 0.1,
  });
  assertEquals(r.band, "pass");
  if (r.evidence.signal_id === "panel") {
    assertEquals(r.evidence.matched_panel, "diabetes_panel");
    assertEquals(r.evidence.co_observation_ids.length, 2);
  }
});

Deno.test("panel: half coverage -> partial", () => {
  const r = evaluatePanel({
    panel_grouping_key: "req-1",
    siblings: [{ observation_id: "o1", concept_id: "glucose" }],
    expected_panel_concept_ids: ["glucose", "fructosamine"],
    weight: 0.1,
  });
  assertEquals(r.band, "partial");
});

Deno.test("panel: no coverage -> fail", () => {
  const r = evaluatePanel({
    panel_grouping_key: "req-1",
    siblings: [{ observation_id: "o1", concept_id: "creatinine" }],
    expected_panel_concept_ids: ["glucose", "fructosamine"],
    weight: 0.1,
  });
  assertEquals(r.band, "fail");
});

Deno.test("panel: no grouping key abstains", () => {
  const r = evaluatePanel({
    panel_grouping_key: null,
    siblings: [],
    expected_panel_concept_ids: ["glucose"],
    weight: 0.1,
  });
  assertEquals(r.band, "abstain");
  assertEquals(r.contributes_to_denominator, false);
});

Deno.test("panel: no expected composition abstains", () => {
  const r = evaluatePanel({
    panel_grouping_key: "req-1",
    siblings: [{ observation_id: "o1", concept_id: "glucose" }],
    expected_panel_concept_ids: [],
    weight: 0.1,
  });
  assertEquals(r.band, "abstain");
});