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

export interface ManifestWarning {
  path: string;
  message: string;
}

export function lintManifest(m: ManifestPreview): ManifestWarning[] {
  const out: ManifestWarning[] = [];

  // ---- patientJourney ------------------------------------------------------
  const j = m.patientJourney;
  if (j) {
    const events = j.timeline ?? [];
    if (events.length > 0 && !j.currentPhase && !j.nextStep) {
      out.push({
        path: "patientJourney",
        message:
          "timeline is provided but neither currentPhase nor nextStep is set — patients lose the 'where am I now' anchor.",
      });
    }
    events.forEach((e, i) => {
      if (!e.dateLabel || !e.dateLabel.trim()) {
        out.push({
          path: `patientJourney.timeline[${i}]`,
          message: "missing dateLabel — the event will render with a 'Date not provided' fallback.",
        });
      }
      if (!e.status) {
        out.push({
          path: `patientJourney.timeline[${i}]`,
          message: "missing status — no badge will render and the timeline dot stays neutral.",
        });
      }
    });
  }

  return out;
}