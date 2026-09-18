// ============================================================================
// labReassessment — action-specific, server-controlled lab reassessment (v0.1)
// ----------------------------------------------------------------------------
// Purpose: let a person's own lab evidence RAISE a relevant concern about a
// proposed action, or KEEP an existing restriction in place. This module can
// never clear anything.
//
// Non-negotiable properties, enforced by construction:
//
//   * There is no "clear" verdict in this file's output type. Normal, recent
//     labs produce zero concerns — never a clearance signal — so a clinician
//     hold, a CIE safety handoff, or a medication/treatment restriction can
//     never be resolved by a lab value passing through here.
//   * Missing, stale or conflicting results are NOT clearance. They are
//     recorded as their own concerns so the reason stays visible.
//   * Where no explicit, reviewed resolution criteria exist for a marker, the
//     severity is "raise_concern" — the weakest severity this module can emit.
//     Only markers carrying documented resolution criteria may reach
//     "maintain_hold", and even then they only sustain a restriction.
//   * Every concern carries a plain explanation and a resolution path, so the
//     person can be told what is restricted, why, and what evidence or review
//     could change it.
//
// Nothing here is a clinical assessment and none of these thresholds are
// clinically validated for this purpose. The person may correct or add data;
// the server recomputes from that data and the resulting concerns are recorded
// with the evidence they were computed from. A person cannot edit a verdict.
// ============================================================================

export type LabConcernSeverity = "raise_concern" | "maintain_hold";

export interface LabConcern {
  /** Canonical marker (or "missing_evidence" / "conflicting_evidence"). */
  marker: string;
  severity: LabConcernSeverity;
  /** Contraindication key understood by the admission engine, when one exists. */
  flag?: string;
  /** Plain statement of what the evidence shows. */
  explanation: string;
  /** What evidence or review could change this. Never a promise of clearance. */
  resolution: string;
  /** Evidence actually used, for the record. */
  evidence: {
    value?: number;
    unit?: string | null;
    collected_at?: string | null;
    age_days?: number | null;
    staleness: "fresh" | "aging" | "stale" | "absent";
    trend?: "rising" | "falling" | "flat" | "single_point" | "unknown";
    sources?: string[];
  };
}

export interface LabReassessment {
  concerns: LabConcern[];
  /** Flags that must be carried INTO admission. Additive only. */
  maintainFlags: string[];
  /** True when every marker a rule needed was absent or stale. */
  insufficientEvidence: boolean;
  evaluatedMarkers: string[];
}

interface MarkerRule {
  /** Substring match against canonical name, lowercased. */
  match: (name: string) => boolean;
  label: string;
  /** Concern predicate over the most recent value. */
  triggers: (value: number) => boolean;
  /**
   * Existing admission contraindication key, when this marker already gates
   * actions. Presence of a key is what allows "maintain_hold".
   */
  flag?: string;
  /**
   * Explicit, reviewed resolution criteria. Absent means the concern is
   * "raise_concern" only and cannot be resolved automatically.
   */
  resolutionCriteria?: string;
  explain: (value: number, unit: string | null) => string;
  /** Beyond this age the value is treated as stale (not as reassurance). */
  freshDays: number;
}

const MARKER_RULES: MarkerRule[] = [
  {
    match: (n) => n.includes("egfr"),
    label: "eGFR",
    triggers: (v) => v < 60,
    flag: "ckd",
    explain: (v) => `Kidney filtration (eGFR ${v}) is below 60, which changes how some actions should be approached.`,
    freshDays: 180,
  },
  {
    match: (n) => n.includes("troponin") || n.includes("coronary") || n.includes("cac"),
    label: "cardiac marker",
    triggers: (v) => v > 0,
    flag: "cardiac_risk",
    explain: (v) => `A cardiac marker is present at ${v}, so exertion-based actions need review first.`,
    freshDays: 730,
  },
  {
    match: (n) => n.includes("hrv"),
    label: "HRV",
    triggers: (v) => v < 30,
    flag: "low_hrv",
    explain: (v) => `Heart-rate variability is low (${v}), which suggests limited recovery capacity right now.`,
    freshDays: 30,
  },
  {
    match: (n) => n.includes("bmi") || n.includes("body mass index"),
    label: "BMI",
    triggers: (v) => v < 18.5,
    flag: "underweight",
    explain: (v) => `Body mass index is ${v}, below the range where restrictive actions are appropriate.`,
    freshDays: 180,
  },
  {
    match: (n) => n.includes("potassium"),
    label: "potassium",
    triggers: (v) => v >= 5.5 || v <= 3.0,
    explain: (v, u) => `Potassium is ${v}${u ? ` ${u}` : ""}, outside the range where this action can be assumed safe.`,
    freshDays: 90,
  },
  {
    match: (n) => n.includes("alt") || n.includes("alanine"),
    label: "ALT",
    triggers: (v) => v > 100,
    explain: (v, u) => `Liver enzyme ALT is ${v}${u ? ` ${u}` : ""}, high enough that liver-loading actions need review.`,
    freshDays: 180,
  },
  {
    match: (n) => n.includes("hemoglobin") || n.includes("haemoglobin"),
    label: "hemoglobin",
    triggers: (v) => v < 10,
    explain: (v, u) => `Hemoglobin is ${v}${u ? ` ${u}` : ""}, low enough to limit exertion-based actions.`,
    freshDays: 180,
  },
];

interface Reading {
  value: number;
  unit: string | null;
  collected_at: string | null;
  source: string | null;
}

function collectReadings(wc: any): Map<string, Reading[]> {
  const byName = new Map<string, Reading[]>();
  const ingest = (obs: any[], fallbackSource: string) => {
    for (const o of obs ?? []) {
      const value = typeof o?.value === "number" ? o.value : Number.parseFloat(o?.value);
      const name = String(o?.canonical_name ?? "").toLowerCase();
      if (!name || Number.isNaN(value)) continue;
      const list = byName.get(name) ?? [];
      list.push({
        value,
        unit: o?.unit ?? null,
        collected_at: o?.collection_date ?? o?.observed_at ?? null,
        source: o?.source ?? fallbackSource,
      });
      byName.set(name, list);
    }
  };
  ingest(wc?.labs?.observations, "lab");
  ingest(wc?.inbody?.observations, "inbody");
  ingest(wc?.fibroscan?.observations, "fibroscan");
  for (const [, list] of byName) {
    // Most recent first; undated readings sort last so they never masquerade
    // as the current value.
    list.sort((a, b) => {
      const at = a.collected_at ? Date.parse(a.collected_at) : -Infinity;
      const bt = b.collected_at ? Date.parse(b.collected_at) : -Infinity;
      return bt - at;
    });
  }
  return byName;
}

function ageDays(collectedAt: string | null, now: number): number | null {
  if (!collectedAt) return null;
  const t = Date.parse(collectedAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

function stalenessOf(age: number | null, freshDays: number): "fresh" | "aging" | "stale" {
  if (age === null) return "stale";
  if (age <= freshDays) return "fresh";
  if (age <= freshDays * 2) return "aging";
  return "stale";
}

function trendOf(readings: Reading[]): LabConcern["evidence"]["trend"] {
  const dated = readings.filter((r) => r.collected_at);
  if (dated.length === 0) return "unknown";
  if (dated.length === 1) return "single_point";
  const [latest, previous] = dated;
  const delta = latest.value - previous.value;
  const scale = Math.abs(previous.value) || 1;
  if (Math.abs(delta) / scale < 0.05) return "flat";
  return delta > 0 ? "rising" : "falling";
}

/**
 * Assess a person's own lab evidence against the markers that gate actions.
 * Returns concerns only — there is no clearance path out of this function.
 */
export function assessLabEvidence(
  witnessContext: any,
  options: { now?: Date; requiredMarkers?: string[] } = {},
): LabReassessment {
  const now = (options.now ?? new Date()).getTime();
  const readings = collectReadings(witnessContext);
  const concerns: LabConcern[] = [];
  const maintainFlags = new Set<string>();
  const evaluatedMarkers: string[] = [];
  let anyUsable = false;

  for (const rule of MARKER_RULES) {
    const entry = [...readings.entries()].find(([name]) => rule.match(name));
    if (!entry) continue;
    const [name, list] = entry;
    evaluatedMarkers.push(name);
    const latest = list[0];
    const age = ageDays(latest.collected_at, now);
    const staleness = stalenessOf(age, rule.freshDays);
    const trend = trendOf(list);
    const sources = [...new Set(list.map((r) => r.source).filter(Boolean) as string[])];
    if (staleness !== "stale") anyUsable = true;

    // Conflicting same-window readings are preserved, not averaged away.
    const sameDay = list.filter((r) => r.collected_at === latest.collected_at);
    if (sameDay.length > 1 && new Set(sameDay.map((r) => r.value)).size > 1) {
      concerns.push({
        marker: name,
        severity: "raise_concern",
        explanation: `Two different ${rule.label} values are on record for the same date (${sameDay.map((r) => r.value).join(", ")}). We keep both rather than choosing one.`,
        resolution: `A repeat ${rule.label}, or a review that says which reading to use.`,
        evidence: { value: latest.value, unit: latest.unit, collected_at: latest.collected_at, age_days: age, staleness, trend, sources },
      });
    }

    const triggered = rule.triggers(latest.value);
    if (!triggered) {
      // Deliberately silent. A value inside range is not a clearance signal and
      // must never be emitted as one.
      continue;
    }

    // Validated resolution criteria are required before a marker may sustain a
    // hold; without them the concern is raised only.
    const severity: LabConcernSeverity =
      rule.flag && rule.resolutionCriteria ? "maintain_hold" : "raise_concern";
    if (rule.flag) maintainFlags.add(rule.flag);

    const stalenessNote =
      staleness === "fresh"
        ? ""
        : ` This reading is ${age === null ? "undated" : `${age} days old`}, so it is treated as still standing, not as resolved.`;

    concerns.push({
      marker: name,
      severity,
      flag: rule.flag,
      explanation: rule.explain(latest.value, latest.unit) + stalenessNote,
      resolution: rule.resolutionCriteria
        ? `${rule.resolutionCriteria} Until then this stays in place.`
        : `A current ${rule.label} plus a clinician review. There are no agreed criteria for resolving this automatically, so it will not resolve on its own.`,
      evidence: { value: latest.value, unit: latest.unit, collected_at: latest.collected_at, age_days: age, staleness, trend, sources },
    });
  }

  for (const required of options.requiredMarkers ?? []) {
    const key = required.toLowerCase();
    if ([...readings.keys()].some((n) => n.includes(key))) continue;
    concerns.push({
      marker: "missing_evidence",
      severity: "raise_concern",
      explanation: `We have no ${required} on record, so this action is being judged without it. Absence is not reassurance.`,
      resolution: `Add a report containing ${required}.`,
      evidence: { staleness: "absent" },
    });
  }

  return {
    concerns,
    maintainFlags: [...maintainFlags],
    insufficientEvidence: !anyUsable,
    evaluatedMarkers,
  };
}
