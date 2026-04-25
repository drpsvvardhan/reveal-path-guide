// ============================================================================
// src/lib/manifestLint.ts
// ----------------------------------------------------------------------------
// Non-blocking lint pass for validated manifests. Surfaces guidance-level
// warnings that are not schema errors but reduce preview quality.
//
// Discipline:
//   - Pure function; no I/O.
//   - Never throws; never fails validation.
//   - Returns a flat list of warnings the UI can render below the
//     "Manifest is valid" alert.
// ============================================================================

import type { ManifestPreview } from "./manifestSchema";

export type WarningSeverity = "info" | "warning";

export interface ManifestWarning {
  path: string;
  message: string;
  severity: WarningSeverity;
}

export function lintManifest(m: ManifestPreview): ManifestWarning[] {
  const out: ManifestWarning[] = [];

  // ---- schema_version ------------------------------------------------------
  if (!m.schema_version) {
    out.push({
      path: "schema_version",
      severity: "info",
      message:
        "schema_version is not set — declaring one (e.g. '1.0.0') makes downstream consumers safer.",
    });
  }

  // ---- patientJourney ------------------------------------------------------
  const j = m.patientJourney;
  if (j) {
    const events = j.timeline ?? [];
    if (events.length > 0 && !j.currentPhase && !j.nextStep) {
      out.push({
        path: "patientJourney",
        severity: "warning",
        message:
          "timeline is provided but neither currentPhase nor nextStep is set — patients lose the 'where am I now' anchor.",
      });
    }
    events.forEach((e, i) => {
      if (!e.dateLabel || !e.dateLabel.trim()) {
        out.push({
          path: `patientJourney.timeline[${i}]`,
          severity: "warning",
          message: "missing dateLabel — the event will render with a 'Date not provided' fallback.",
        });
      }
      if (!e.status) {
        out.push({
          path: `patientJourney.timeline[${i}]`,
          severity: "warning",
          message: "missing status — no badge will render and the timeline dot stays neutral.",
        });
      }
    });
  }

  return out;
}

export interface LintReport {
  schema_version: string | null;
  generated_at: string;
  counts: { total: number; warning: number; info: number };
  items: ManifestWarning[];
}

/**
 * Build a serializable lint report payload. Always includes ALL items —
 * UI filtering is presentational only and never narrows the export.
 */
export function buildLintReport(
  m: ManifestPreview,
  items: ManifestWarning[],
  now: Date = new Date(),
): LintReport {
  return {
    schema_version: m.schema_version ?? null,
    generated_at: now.toISOString(),
    counts: {
      total: items.length,
      warning: items.filter((i) => i.severity === "warning").length,
      info: items.filter((i) => i.severity === "info").length,
    },
    items,
  };
}