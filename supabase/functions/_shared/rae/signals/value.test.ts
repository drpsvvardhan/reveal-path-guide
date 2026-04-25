import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateValue } from "./value.ts";

Deno.test("value: HbA1c 5.6% inside band passes", () => {
  const r = evaluateValue({
    raw_value: 5.6,
    unit_normalized_value: 5.6,
    plausibility_band: { low: 3, high: 18 },
    weight: 0.15,
  });
  assertEquals(r.band, "pass");
  assertEquals(r.score, 1);
  if (r.evidence.signal_id === "value") {
    assertEquals(r.evidence.position, "inside");
  }
});

Deno.test("value: HbA1c 18.5% just over upper -> edge/partial", () => {
  const r = evaluateValue({
    raw_value: 18.5,
    unit_normalized_value: 18.5,
    plausibility_band: { low: 3, high: 18 },
    weight: 0.15,
  });
  assertEquals(r.band, "partial");
  if (r.evidence.signal_id === "value") {
    assertEquals(r.evidence.position, "edge");
  }
});

Deno.test("value: HbA1c 250% wildly out fails", () => {
  const r = evaluateValue({
    raw_value: 250,
    unit_normalized_value: 250,
    plausibility_band: { low: 3, high: 18 },
    weight: 0.15,
  });
  assertEquals(r.band, "fail");
  if (r.evidence.signal_id === "value") {
    assertEquals(r.evidence.position, "outside");
  }
});

Deno.test("value: missing value abstains", () => {
  const r = evaluateValue({
    raw_value: null,
    unit_normalized_value: null,
    plausibility_band: { low: 3, high: 18 },
    weight: 0.15,
  });
  assertEquals(r.band, "abstain");
  assertEquals(r.contributes_to_denominator, false);
});

Deno.test("value: missing band abstains", () => {
  const r = evaluateValue({
    raw_value: 5.6,
    unit_normalized_value: 5.6,
    plausibility_band: null,
    weight: 0.15,
  });
  assertEquals(r.band, "abstain");
});