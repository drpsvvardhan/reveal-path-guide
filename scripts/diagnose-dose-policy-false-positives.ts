#!/usr/bin/env -S deno run --allow-net --allow-env
// Diagnostic: detect dose-policy false positives in patient_chat_validation_log.
//
// A "false positive" = a validator-replaced row whose `original_output` contains
// no genuine dose tokens, only lab concentration units (mg/dL, ng/mL, mg/L,
// g/dL, mmol/L, µmol/L, etc.). These rows indicate the dose detector
// incorrectly nuked clean clinical interpretation prose.
//
// Usage (from repo root):
//   psql -At -f scripts/diagnose-dose-policy-false-positives.sql > /tmp/rows.json
//   deno run --allow-read scripts/diagnose-dose-policy-false-positives.ts /tmp/rows.json
//
// Or invoke programmatically — see `analyzeRow` for the pure check.

import {
  extractDoseTokens,
} from "../supabase/functions/_shared/dosePolicy.ts";

// Concentration-unit regex used ONLY for diagnostic classification.
// If the original_output contains numbers attached to these units AND the
// dose detector returned no tokens, the row is structurally clean — meaning
// any prior false-positive replacement (with NO_DOSE_FALLBACK) was a bug.
const CONCENTRATION_UNIT_PATTERN =
  /\b\d{1,5}(?:[.,]\d{1,3})?\s*(?:mg|ng|µg|ug|pg|mcg|g|mmol|µmol|umol|nmol|pmol|mIU|µIU|uIU|IU)\s*\/\s*(?:dL|mL|L|mm3|mm³)\b/gi;

export interface AuditRow {
  id: string;
  created_at: string;
  status: string;
  routing_mode: string | null;
  replacement_template_used: string | null;
  last_user_message: string | null;
  original_output: string | null;
  replaced_with: string | null;
  dose_patterns_matched: string[] | null;
}

export interface Diagnosis {
  id: string;
  created_at: string;
  verdict:
    | "false_positive_concentration_units"
    | "false_positive_no_tokens"
    | "legitimate_dose_replacement"
    | "skipped_not_fallback";
  detected_dose_tokens: string[];
  detected_concentration_units: string[];
  audit_dose_patterns: string[];
  excerpt: string;
}

export function analyzeRow(row: AuditRow): Diagnosis {
  const orig = row.original_output ?? "";
  const detectedDoses = extractDoseTokens(orig);
  const concMatches = orig.match(CONCENTRATION_UNIT_PATTERN) ?? [];
  const concentrationUnits = Array.from(
    new Set(concMatches.map((s) => s.replace(/\s+/g, " ").trim())),
  );

  const isFallbackReplacement =
    row.status === "replaced_with_fallback" &&
    row.replacement_template_used === "NO_DOSE_FALLBACK";

  let verdict: Diagnosis["verdict"];
  if (!isFallbackReplacement) {
    verdict = "skipped_not_fallback";
  } else if (detectedDoses.length === 0 && concentrationUnits.length > 0) {
    verdict = "false_positive_concentration_units";
  } else if (detectedDoses.length === 0) {
    verdict = "false_positive_no_tokens";
  } else {
    verdict = "legitimate_dose_replacement";
  }

  return {
    id: row.id,
    created_at: row.created_at,
    verdict,
    detected_dose_tokens: detectedDoses,
    detected_concentration_units: concentrationUnits,
    audit_dose_patterns: row.dose_patterns_matched ?? [],
    excerpt: orig.slice(0, 240),
  };
}

export function summarize(diagnoses: Diagnosis[]) {
  const counts: Record<string, number> = {};
  for (const d of diagnoses) counts[d.verdict] = (counts[d.verdict] ?? 0) + 1;
  const falsePositives = diagnoses.filter((d) =>
    d.verdict === "false_positive_concentration_units" ||
    d.verdict === "false_positive_no_tokens"
  );
  return { counts, falsePositiveCount: falsePositives.length, falsePositives };
}

// CLI entrypoint
if (import.meta.main) {
  const path = Deno.args[0];
  if (!path) {
    console.error("usage: diagnose-dose-policy-false-positives.ts <rows.json>");
    Deno.exit(2);
  }
  const raw = await Deno.readTextFile(path);
  const rows: AuditRow[] = JSON.parse(raw);
  const diagnoses = rows.map(analyzeRow);
  const summary = summarize(diagnoses);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.falsePositiveCount > 0) Deno.exit(1);
}