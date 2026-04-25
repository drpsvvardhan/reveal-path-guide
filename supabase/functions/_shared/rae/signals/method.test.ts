import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateMethod } from "./method.ts";

Deno.test("method: HbA1c HPLC matches known assay", () => {
  const r = evaluateMethod({
    raw_method: "HPLC",
    known_assays: ["HPLC", "Immunoassay", "Capillary Electrophoresis"],
    weight: 0.1,
  });
  assertEquals(r.band, "pass");
  if (r.evidence.signal_id === "method") {
    assertEquals(r.evidence.matched_assay, "HPLC");
  }
});

Deno.test("method: substring partial match", () => {
  const r = evaluateMethod({
    raw_method: "HPLC-Tosoh",
    known_assays: ["HPLC"],
    weight: 0.1,
  });
  assertEquals(r.band, "partial");
});

Deno.test("method: missing method abstains", () => {
  const r = evaluateMethod({
    raw_method: null,
    known_assays: ["HPLC"],
    weight: 0.1,
  });
  assertEquals(r.band, "abstain");
  assertEquals(r.contributes_to_denominator, false);
});

Deno.test("method: no known assays declared abstains", () => {
  const r = evaluateMethod({
    raw_method: "HPLC",
    known_assays: [],
    weight: 0.1,
  });
  assertEquals(r.band, "abstain");
});

Deno.test("method: unknown assay fails", () => {
  const r = evaluateMethod({
    raw_method: "MassSpec",
    known_assays: ["HPLC", "Immunoassay"],
    weight: 0.1,
  });
  assertEquals(r.band, "fail");
});