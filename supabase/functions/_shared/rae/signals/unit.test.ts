import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateUnit } from "./unit.ts";

Deno.test("unit: HbA1c canonical % passes", () => {
  const r = evaluateUnit({
    raw_unit: "%",
    canonical_unit: "%",
    weight: 0.15,
  });
  assertEquals(r.band, "pass");
  assertEquals(r.score, 1);
  assertEquals(r.evidence.signal_id, "unit");
});

Deno.test("unit: HbA1c mmol/mol -> % via conversion partial", () => {
  const r = evaluateUnit({
    raw_unit: "mmol/mol",
    canonical_unit: "%",
    conversions: { "mmol/mol": { factor: 0.0915, conversion_id: "ifcc_to_ngsp" } },
    weight: 0.15,
  });
  assertEquals(r.band, "partial");
  if (r.evidence.signal_id === "unit") {
    assertEquals(r.evidence.conversion_id, "ifcc_to_ngsp");
  }
});

Deno.test("unit: missing unit abstains", () => {
  const r = evaluateUnit({
    raw_unit: null,
    canonical_unit: "%",
    weight: 0.15,
  });
  assertEquals(r.band, "abstain");
  assertEquals(r.contributes_to_denominator, false);
});

Deno.test("unit: unknown unit fails", () => {
  const r = evaluateUnit({
    raw_unit: "g/dL",
    canonical_unit: "%",
    weight: 0.15,
  });
  assertEquals(r.band, "fail");
  assertEquals(r.score, 0);
});