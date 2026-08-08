// ============================================================================
// src/components/biotwin/BioTwinBriefCard.tsx
// ----------------------------------------------------------------------------
// Compact Biological Intelligence Brief — the orientation layer above
// Ask My Twin. Renders the deterministic projection from brief.ts verbatim.
// No interpretation happens here: every string is either the report's own
// words or a version/freshness fact.
// ============================================================================

import React from "react";
import { Activity, CheckCircle2, HelpCircle, FlaskConical, Clock } from "lucide-react";
import type { BiologicalIntelligenceBrief, BriefItem } from "@/lib/biotwin/brief";

const ItemList: React.FC<{ items: BriefItem[] }> = ({ items }) => (
  <ul className="mt-1.5 space-y-1 min-w-0">
    {items.map((it) => (
      <li key={it.source_id} className="font-sans text-xs text-foreground/90 break-words">
        <span className="font-medium">{it.title}</span>
        {it.body ? (
          <span className="text-muted-foreground"> — {it.body}</span>
        ) : null}
      </li>
    ))}
  </ul>
);

const BriefBlock: React.FC<{
  icon: React.ReactNode;
  label: string;
  summary: string | null;
  items?: BriefItem[];
}> = ({ icon, label, summary, items }) => {
  if (!summary && (!items || items.length === 0)) return null;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        {icon}
        <h4 className="font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </h4>
      </div>
      {summary ? (
        <p className="mt-1 font-sans text-xs text-foreground/90 max-w-prose break-words">
          {summary}
        </p>
      ) : null}
      {items && items.length > 0 ? <ItemList items={items} /> : null}
    </div>
  );
};

export interface BioTwinBriefCardProps {
  brief: BiologicalIntelligenceBrief;
  /** latest_witness_as_of — evidence clock; the Twin clock lives in brief.freshness. */
  latestEvidenceDate?: string | null;
}

const BioTwinBriefCard: React.FC<BioTwinBriefCardProps> = ({
  brief,
  latestEvidenceDate,
}) => {
  if (brief.state === "no_report") {
    return (
      <div className="rounded-lg border border-border bg-card p-4 md:p-5 min-w-0">
        <h3 className="font-serif text-base break-words">Your Twin</h3>
        <p className="mt-1 font-sans text-xs text-muted-foreground max-w-prose break-words">
          {brief.version_note} You can still ask questions — answers are grounded in the
          measurements already on file for you.
        </p>
      </div>
    );
  }

  if (brief.state === "release_withheld") {
    return (
      <div className="rounded-lg border border-border bg-card p-4 md:p-5 min-w-0">
        <h3 className="font-serif text-base break-words">Your Twin</h3>
        <p className="mt-1 font-sans text-xs text-muted-foreground max-w-prose break-words">
          {brief.status_line}
        </p>
        <p className="mt-2 font-sans text-[11px] text-muted-foreground">{brief.version_note}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-5 min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <h3 className="font-serif text-base break-words">Your Twin now</h3>
          {brief.headline ? (
            <p className="mt-1 font-sans text-sm text-foreground/90 max-w-prose break-words">
              {brief.headline}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="font-sans text-[11px] text-muted-foreground whitespace-nowrap">
            {brief.freshness.twin_updated
              ? `Twin updated ${brief.freshness.twin_updated}`
              : "Twin date unknown"}
            {latestEvidenceDate ? ` · Evidence through ${latestEvidenceDate}` : ""}
            {brief.freshness.twin_version != null
              ? ` · v${brief.freshness.twin_version}`
              : ""}
          </span>
        </div>
      </div>

      <BriefBlock
        icon={<Activity className="h-3 w-3 text-muted-foreground" />}
        label="What matters now"
        summary={null}
        items={brief.what_matters_now}
      />

      <BriefBlock
        icon={<CheckCircle2 className="h-3 w-3 text-muted-foreground" />}
        label="What is established"
        summary={brief.established.summary}
      />

      <BriefBlock
        icon={<HelpCircle className="h-3 w-3 text-muted-foreground" />}
        label="Still learning"
        summary={brief.still_learning.summary}
        items={brief.still_learning.items}
      />

      <BriefBlock
        icon={<FlaskConical className="h-3 w-3 text-muted-foreground" />}
        label="Watching next"
        summary={brief.watching_next.summary}
        items={brief.watching_next.items}
      />

      <p className="font-sans text-[11px] text-muted-foreground border-t border-border pt-2">
        {brief.version_note}
      </p>
    </div>
  );
};

export default BioTwinBriefCard;
