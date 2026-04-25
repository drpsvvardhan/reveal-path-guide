import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateRefRange } from "./refRange.ts";

Deno.test("ref_range: HbA1c 4.0-5.6 matches canonical exactly", () => {
  const r = evaluateRefRange({
    received_low: 4.0,
    received_high: 5.6,
    canonical_range: { low: 4.0, high: 5.6 },
    weight: 0.1,
  });
  assertEquals(r.band, "pass");
  if (r.evidence.signal_id === "ref_range") {
    assertEquals(r.evidence.conflict, false);
  }
});

Deno.test("ref_range: small deviation -> partial", () => {
  const r = evaluateRefRange({
    received_low: 4.1,
    received_high: 5.7,
    canonical_range: { low: 4.0, high: 5.6 },
    weight: 0.1,
  });
  assertEquals(r.band, "partial");
});

Deno.test("ref_range: large mismatch -> fail/conflict", () => {
  const r = evaluateRefRange({
    received_low: 0.5,
    received_high: 50,
    canonical_range: { low: 4.0, high: 5.6 },
    weight: 0.1,
  });
  assertEquals(r.band, "fail");
  if (r.evidence.signal_id === "ref_range") {
    assertEquals(r.evidence.conflict, true);
  }
});

Deno.test("ref_range: missing both sides abstains", () => {
  const r = evaluateRefRange({
    received_low: null,
    received_high: null,
    canonical_range: { low: 4.0, high: 5.6 },
    weight: 0.1,
  });
  assertEquals(r.band, "abstain");
  assertEquals(r.contributes_to_denominator, false);
});