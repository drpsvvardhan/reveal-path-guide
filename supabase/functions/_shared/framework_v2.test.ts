import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  validateVocabularyLicense,
  validateProseAgainstClusters,
  parseProseAndCitations,
  stripClusterMarkers,
} from "./framework_v2.ts";
import type { ClusterTier } from "./framework_v2.ts";

// ── validateVocabularyLicense tests ──

Deno.test("tentative tier + 'shows definitively' → tier_forbidden_verb", () => {
  const result = validateVocabularyLicense(
    "Your data shows definitively that iron is depleted.",
    "tentative",
    "cluster-1",
  );
  assertEquals(result?.rule_violated, "tier_forbidden_verb");
  assertEquals(result?.matched_phrase, "shows definitively");
});

Deno.test("tentative tier + 'softly suggests' with hedging → no violation", () => {
  const result = validateVocabularyLicense(
    "Your data softly suggests a pattern is starting to form around iron depletion.",
    "tentative",
    "cluster-1",
  );
  assertEquals(result, null);
});

Deno.test("robust tier + 'Your data shows X' → no violation", () => {
  const result = validateVocabularyLicense(
    "Your data shows iron stores are depleted at ferritin 20 ng/mL.",
    "robust",
    "cluster-1",
  );
  assertEquals(result, null);
});

Deno.test("emerging tier + 'shows X' → tier_forbidden_verb", () => {
  const result = validateVocabularyLicense(
    "Your data shows a clear iron depletion pattern.",
    "emerging",
    "cluster-1",
  );
  assertEquals(result?.rule_violated, "tier_forbidden_verb");
  assertEquals(result?.matched_phrase, "shows");
});

Deno.test("emerging tier + hint language → no violation", () => {
  const result = validateVocabularyLicense(
    "A hint of iron depletion is worth watching, only three signals so far.",
    "emerging",
    "cluster-1",
  );
  assertEquals(result, null);
});

Deno.test("any tier + 'your risk of' → global_forbidden", () => {
  const result = validateVocabularyLicense(
    "Your risk of cardiovascular disease is elevated.",
    "robust",
    "cluster-1",
  );
  assertEquals(result?.rule_violated, "global_forbidden");
  assertEquals(result?.matched_phrase, "your risk of");
});

Deno.test("developing tier + no hedging keyword → tier_missing_hedging", () => {
  const result = validateVocabularyLicense(
    "Your iron stores are depleted at ferritin 20 ng/mL.",
    "developing",
    "cluster-1",
  );
  assertEquals(result?.rule_violated, "tier_missing_hedging");
});

Deno.test("developing tier + 'consistent with' hedging → no violation", () => {
  const result = validateVocabularyLicense(
    "Your data is consistent with iron depletion across two layers.",
    "developing",
    "cluster-1",
  );
  assertEquals(result, null);
});

// ── validateProseAgainstClusters tests ──

Deno.test("validateProseAgainstClusters with all passing → valid=true", () => {
  const prose = "Your data softly suggests iron depletion is starting to form. A hint of inflammation is worth watching, only two signals so far.";
  const clusterTierMap = new Map<string, ClusterTier>([
    ["c1", "tentative"],
    ["c2", "emerging"],
  ]);
  const sentenceToClusterMap = new Map<string, string | null>([
    ["Your data softly suggests iron depletion is starting to form.", "c1"],
    ["A hint of inflammation is worth watching, only two signals so far.", "c2"],
  ]);
  const result = validateProseAgainstClusters(prose, clusterTierMap, sentenceToClusterMap);
  assertEquals(result.valid, true);
  assertEquals(result.violations.length, 0);
  assertEquals(result.sentences_checked, 2);
});

Deno.test("validateProseAgainstClusters with 3 violations → returns them all", () => {
  const prose = "Your risk of heart disease is high. Your data shows definitively iron is depleted. Your data confirms the pattern.";
  const clusterTierMap = new Map<string, ClusterTier>([
    ["c1", "robust"],
    ["c2", "tentative"],
    ["c3", "tentative"],
  ]);
  const sentenceToClusterMap = new Map<string, string | null>([
    ["Your risk of heart disease is high.", "c1"],
    ["Your data shows definitively iron is depleted.", "c2"],
    ["Your data confirms the pattern.", "c3"],
  ]);
  const result = validateProseAgainstClusters(prose, clusterTierMap, sentenceToClusterMap);
  assertEquals(result.valid, false);
  assertEquals(result.violations.length, 3);
});

// ── parseProseAndCitations tests ──

Deno.test("parseProseAndCitations extracts cluster id", () => {
  const raw = "Your iron is depleted {cluster:abc-123}. This is a general observation {cluster:none}.";
  const { sentenceToClusterMap } = parseProseAndCitations(raw);
  assertEquals(sentenceToClusterMap.get("Your iron is depleted"), undefined); // cleaned sentence
  // The map uses cleaned sentences — verify a known entry
  let found = false;
  for (const [key, val] of sentenceToClusterMap) {
    if (key.includes("iron is depleted")) {
      assertEquals(val, "abc-123");
      found = true;
    }
    if (key.includes("general observation")) {
      assertEquals(val, null);
    }
  }
  assertEquals(found, true);
});

// ── stripClusterMarkers tests ──

Deno.test("stripClusterMarkers removes all markers", () => {
  const raw = "Your iron is depleted {cluster:abc-123}. This is fine {cluster:none}.";
  const clean = stripClusterMarkers(raw);
  assertEquals(clean.includes("{cluster:"), false);
  assertEquals(clean.includes("Your iron is depleted"), true);
});
