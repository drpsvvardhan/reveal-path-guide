// ============================================================================
// src/lib/biotwin/brief.ts
// ----------------------------------------------------------------------------
// Biological Intelligence Brief — a DETERMINISTIC view of the released Twin,
// not another interpretation of it (docs/ASK_MY_TWIN_CONSTITUTION.md).
//
// Rules this module enforces:
//   - No LLM. Pure projection over the active report + statements.
//   - No inferred severity from wording. Section text is the report's OWN
//     words (executive_synthesis fields), verbatim.
//   - Ordinal is storage order, not importance. Drivers are ordered ONLY by
//     the source report's governed ranking (provenance.rank, preserved by
//     the deterministic adapter from repaired_driver_hierarchy). Unranked
//     drivers follow the ranked ones in storage order, unranked.
//   - Only clinical_authority === "patient_facing" statements appear.
//   - release_control gates everything: if the report does not permit
//     patient-facing release, the Brief shows the report's status only.
//   - No "your biology changed" language — that phrase must be earned by a
//     real semantic diff engine. Until then, only version facts.
// ============================================================================

import type { BiotwinReport, BiotwinStatement } from "./types";

export interface BriefItem {
  source_id: string;
  title: string;
  body: string | null;
  /** Source report's own governed rank; null = the source did not rank it. */
  rank: number | null;
  truth_status: BiotwinStatement["truth_status"];
  statement_kind: string;
}

export interface BiologicalIntelligenceBrief {
  state: "no_report" | "release_withheld" | "released";
  /** For release_withheld: the report's own status framing. */
  status_line: string | null;

  /** executive_synthesis.headline — the report's own words. */
  headline: string | null;

  /** Drivers, governed-rank order, patient-facing only, max 5. */
  what_matters_now: BriefItem[];

  /** executive_synthesis.what_is_certain + confirmed statement count. */
  established: { summary: string | null; confirmed_count: number };

  /** what_is_not_certain + candidate/unknown/contradiction items, max 5. */
  still_learning: { summary: string | null; items: BriefItem[] };

  /** what_happens_next + actions requiring measurement, max 5. */
  watching_next: { summary: string | null; items: BriefItem[] };

  freshness: {
    twin_updated: string | null;
    twin_version: number | null;
  };

  /** Version facts only — never "your biology changed". */
  version_note: string;
}

const MAX_ITEMS = 5;

function esField(
  report: BiotwinReport,
  key: string
): string | null {
  const es = report.executive_synthesis;
  if (!es) return null;
  const v = es[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function sourceRank(s: BiotwinStatement): number | null {
  const raw = s.provenance?.["rank"];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toItem(s: BiotwinStatement): BriefItem {
  return {
    source_id: s.source_id,
    title: s.title,
    body: s.body,
    rank: sourceRank(s),
    truth_status: s.truth_status,
    statement_kind: s.statement_kind,
  };
}

function patientFacing(statements: BiotwinStatement[]): BiotwinStatement[] {
  return statements.filter((s) => s.clinical_authority === "patient_facing");
}

export function projectBrief(
  report: BiotwinReport | null,
  statements: BiotwinStatement[]
): BiologicalIntelligenceBrief {
  if (!report) {
    return {
      state: "no_report",
      status_line: null,
      headline: null,
      what_matters_now: [],
      established: { summary: null, confirmed_count: 0 },
      still_learning: { summary: null, items: [] },
      watching_next: { summary: null, items: [] },
      freshness: { twin_updated: null, twin_version: null },
      version_note: "Your Twin has not been released yet.",
    };
  }

  const freshness = {
    twin_updated: report.generated_date,
    twin_version: report.version ?? null,
  };

  if (!report.patient_release_permitted) {
    return {
      state: "release_withheld",
      status_line:
        "Your Twin report is awaiting release. Your care team reviews every report before it becomes patient-facing.",
      headline: null,
      what_matters_now: [],
      established: { summary: null, confirmed_count: 0 },
      still_learning: { summary: null, items: [] },
      watching_next: { summary: null, items: [] },
      freshness,
      version_note:
        report.version && report.version > 1
          ? `Version ${report.version} is in review.`
          : "The first version of your Twin is in review.",
    };
  }

  const visible = patientFacing(statements);

  // Drivers: governed source rank only. Ranked first (ascending), then
  // unranked in storage order — never re-ranked by ordinal or wording.
  const drivers = visible.filter((s) => s.statement_kind === "driver");
  const ranked = drivers
    .filter((s) => sourceRank(s) !== null)
    .sort((a, b) => (sourceRank(a) as number) - (sourceRank(b) as number));
  const unranked = drivers.filter((s) => sourceRank(s) === null);
  const whatMattersNow = [...ranked, ...unranked]
    .slice(0, MAX_ITEMS)
    .map(toItem);

  const confirmedCount = visible.filter(
    (s) => s.truth_status === "confirmed"
  ).length;

  // Still learning: held uncertainty, in the report's own truth buckets —
  // candidate and unknown statements plus contradictions held open.
  const stillLearningItems = visible
    .filter(
      (s) =>
        s.statement_kind === "contradiction" ||
        ((s.truth_status === "candidate" || s.truth_status === "unknown") &&
          s.statement_kind !== "driver" &&
          s.statement_kind !== "action")
    )
    .slice(0, MAX_ITEMS)
    .map(toItem);

  // Watching next: the report's measurement/action plan — items that name
  // the measurement that would change the conclusion.
  const watchingNextItems = visible
    .filter(
      (s) => s.statement_kind === "action" && s.requires_measurement !== null
    )
    .slice(0, MAX_ITEMS)
    .map(toItem);

  return {
    state: "released",
    status_line: null,
    headline: esField(report, "headline"),
    what_matters_now: whatMattersNow,
    established: {
      summary: esField(report, "what_is_certain"),
      confirmed_count: confirmedCount,
    },
    still_learning: {
      summary: esField(report, "what_is_not_certain"),
      items: stillLearningItems,
    },
    watching_next: {
      summary: esField(report, "what_happens_next"),
      items: watchingNextItems,
    },
    freshness,
    version_note:
      report.version && report.version > 1
        ? `Your Twin was updated to version ${report.version}. A detailed comparison with earlier versions will appear here once version comparison is available.`
        : "This is the first released version of your Twin.",
  };
}
