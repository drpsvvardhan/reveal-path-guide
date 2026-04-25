import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateLexical } from "./lexical.ts";

Deno.test("lexical: exact HbA1c match passes", () => {
  const r = evaluateLexical({
    raw_name: "HbA1c",
    canonical_name: "HbA1c",
    weight: 0.2,
  });
  assertEquals(r.signal_id, "lexical");
  assertEquals(r.band, "pass");
  assertEquals(r.score, 1);
  assertEquals(r.contributes_to_denominator, true);
  assertEquals(r.evidence.signal_id, "lexical");
  if (r.evidence.signal_id === "lexical") {
    assertEquals(r.evidence.match_type, "exact");
    assertEquals(r.evidence.matched_name, "HbA1c");
  }
});

Deno.test("lexical: synonym match passes", () => {
  const r = evaluateLexical({
    raw_name: "Hemoglobin A1C",
    canonical_name: "HbA1c",
    synonyms: ["Hemoglobin A1c", "Glycated Hemoglobin"],
    weight: 0.2,
  });
  assertEquals(r.band, "pass");
  if (r.evidence.signal_id === "lexical") {
    assertEquals(r.evidence.match_type, "synonym");
  }
});

Deno.test("lexical: fuzzy near-match returns partial", () => {
  const r = evaluateLexical({
    raw_name: "HbA1cc",
    canonical_name: "HbA1c",
    weight: 0.2,
  });
  assertEquals(r.band, "partial");
  if (r.evidence.signal_id === "lexical") {
    assertEquals(r.evidence.match_type, "fuzzy");
    assertExists(r.evidence.distance);
  }
});

Deno.test("lexical: unrelated name fails", () => {
  const r = evaluateLexical({
    raw_name: "Cholesterol",
    canonical_name: "HbA1c",
    weight: 0.2,
  });
  assertEquals(r.band, "fail");
  assertEquals(r.score, 0);
});

Deno.test("lexical: empty raw_name abstains", () => {
  const r = evaluateLexical({
    raw_name: "",
    canonical_name: "HbA1c",
    weight: 0.2,
  });
  assertEquals(r.band, "abstain");
  assertEquals(r.contributes_to_denominator, false);
});