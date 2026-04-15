import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  validateVocabularyLicense,
  validateVocabularyLicenseWithAudience,
  validateProseAgainstClusters,
  validateProseAgainstClustersWithAudience,
  parseProseAndCitations,
  stripClusterMarkers,
  validateStructuredFieldForBiotypeName,
} from "./framework_v2.ts";
import type { ClusterTier } from "./framework_v2.ts";

// ── validateVocabularyLicense tests (patient audience, default) ──

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
  // Cleaned sentences are used as keys
  assertEquals(sentenceToClusterMap.get("Your iron is depleted"), "abc-123");
  assertEquals(sentenceToClusterMap.get("This is a general observation"), null);
});

// ── stripClusterMarkers tests ──

Deno.test("stripClusterMarkers removes all markers", () => {
  const raw = "Your iron is depleted {cluster:abc-123}. This is fine {cluster:none}.";
  const clean = stripClusterMarkers(raw);
  assertEquals(clean.includes("{cluster:"), false);
  assertEquals(clean.includes("Your iron is depleted"), true);
});

// ── CLINICIAN AUDIENCE TESTS (5g.b) ──

Deno.test("clinician: tentative + 'confirms' → tier_forbidden_verb", () => {
  const result = validateVocabularyLicenseWithAudience(
    "Lab findings confirms iron depletion with clinical correlation pending.",
    "tentative",
    "cluster-1",
    "clinician",
  );
  assertEquals(result?.rule_violated, "tier_forbidden_verb");
  assertEquals(result?.matched_phrase, "confirms");
});

Deno.test("clinician: tentative + 'evidence base is insufficient' hedging → passes", () => {
  const result = validateVocabularyLicenseWithAudience(
    "The current evidence base is insufficient for definitive determination of iron deficiency; workup indicated.",
    "tentative",
    "cluster-1",
    "clinician",
  );
  assertEquals(result, null);
});

Deno.test("clinician: robust + 'establishes elevated cardiovascular risk' → passes", () => {
  const result = validateVocabularyLicenseWithAudience(
    "The data establishes elevated cardiovascular risk across four data layers.",
    "robust",
    "cluster-1",
    "clinician",
  );
  assertEquals(result, null);
});

Deno.test("patient: 'your risk of cardiovascular disease' → global_forbidden", () => {
  // Same risk language fails on patient audience because 'your risk of' is forbidden
  const result = validateVocabularyLicenseWithAudience(
    "Your risk of cardiovascular disease is elevated based on particle data.",
    "robust",
    "cluster-1",
    "patient",
  );
  assertEquals(result?.rule_violated, "global_forbidden");
  assertEquals(result?.matched_phrase, "your risk of");
});

Deno.test("clinician: emerging + 'suggests' → tier_forbidden_verb", () => {
  const result = validateVocabularyLicenseWithAudience(
    "The pattern suggests iron depletion.",
    "emerging",
    "cluster-1",
    "clinician",
  );
  assertEquals(result?.rule_violated, "tier_forbidden_verb");
  assertEquals(result?.matched_phrase, "suggests");
});

Deno.test("clinician: 'wellness journey' → global_forbidden", () => {
  const result = validateVocabularyLicenseWithAudience(
    "The patient is on a wellness journey.",
    null,
    null,
    "clinician",
  );
  assertEquals(result?.rule_violated, "global_forbidden");
  assertEquals(result?.matched_phrase, "wellness journey");
});

Deno.test("clinician prose validation with audience → passes", () => {
  const prose = "The data establishes metabolic compromise. Insufficient data to characterize thyroid axis; warrants monitoring on follow-up.";
  const clusterTierMap = new Map<string, ClusterTier>([
    ["c1", "robust"],
    ["c2", "emerging"],
  ]);
  const sentenceToClusterMap = new Map<string, string | null>([
    ["The data establishes metabolic compromise.", "c1"],
    ["Insufficient data to characterize thyroid axis; warrants monitoring on follow-up.", "c2"],
  ]);
  const result = validateProseAgainstClustersWithAudience(prose, clusterTierMap, sentenceToClusterMap, "clinician");
  assertEquals(result.valid, true);
  assertEquals(result.violations.length, 0);
});

// ── validateStructuredFieldForBiotypeName tests ──

Deno.test("biotype name 'sage' in structured field → global_forbidden", () => {
  const result = validateStructuredFieldForBiotypeName("Sage", "dominant_pattern");
  assertEquals(result?.rule_violated, "global_forbidden");
  assertEquals(result?.matched_phrase, "sage");
  assertEquals(result?.section, "dominant_pattern");
});

Deno.test("biotype name 'seeker' case-insensitive → global_forbidden", () => {
  const result = validateStructuredFieldForBiotypeName("SEEKER", "archetype");
  assertEquals(result?.rule_violated, "global_forbidden");
  assertEquals(result?.matched_phrase, "seeker");
});

Deno.test("non-biotype name in structured field → no violation", () => {
  const result = validateStructuredFieldForBiotypeName("Gut-centered coherence", "dominant_pattern");
  assertEquals(result, null);
});
