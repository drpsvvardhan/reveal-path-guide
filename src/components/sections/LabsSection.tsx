import React, { useMemo } from "react";
import { useLabUploads } from "@/context/LabUploadsContext";
import { useNavigation } from "@/context/NavigationContext";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import BiomarkerTimeline from "@/components/visuals/BiomarkerTimeline";
import { Button } from "@/components/ui/button";
import { FileText, ArrowUpRight, Loader2, Info } from "lucide-react";
import { LABS_REQUEST_OPTIONS, buildLabsRequestUrl, getLabsPilotUrl } from "@/lib/labsPilot";

const STEPS = [
  "Request received",
  "Clinical authorization, if needed",
  "Collection arranged",
  "Processing",
  "Results",
  "Vizzhy explains what they mean",
];

const LabsSection: React.FC = () => {
  const { uploads, observations, loading, observationsAsTimeline } = useLabUploads();
  const nav = useNavigation() as any;
  const pilotUrl = getLabsPilotUrl();
  const timeline = useMemo(() => observationsAsTimeline(), [observations]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PatientSectionLayout
      eyebrow="LABS"
      title="Your lab results, and new testing when you want it"
      intro="Everything you have already shared stays here. If you would like new testing, you can start a request with Vizzhy Labs."
    >
      <div className="space-y-8 max-w-2xl">
        <section className="space-y-3">
          <h3 className="font-sans text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Your original reports</h3>
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</p>
          ) : uploads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            <ul className="rounded-lg border border-border bg-card divide-y divide-border">
              {uploads.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-3 py-3 min-h-[44px]">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm break-words">{u.original_filename}</span>
                    <span className="block text-[11px] text-muted-foreground font-sans">
                      {u.collection_date ? new Date(u.collection_date).toLocaleDateString() : "Date not read"}
                      {u.source_lab ? ` · ${u.source_lab}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => nav?.onNavigate?.("records")}>
            Add or manage reports in Medical Records
          </Button>
        </section>

        <section className="space-y-3">
          <h3 className="font-sans text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Values read from your reports</h3>
          {timeline.length > 0
            ? <BiomarkerTimeline observations={timeline} />
            : !loading && <p className="text-sm text-muted-foreground">No values read yet.</p>}
        </section>

        <section className="space-y-3">
          <h3 className="font-serif text-lg">Request new testing</h3>
          <p className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Requesting testing is not yet an order. Availability and clinical authorization may be required, and how your testing is fulfilled is confirmed after your request.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {LABS_REQUEST_OPTIONS.map((o) => (
              <div key={o.kind} className="flex flex-col rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium">{o.title}</p>
                <p className="mt-1 flex-1 text-xs text-muted-foreground leading-relaxed">{o.description}</p>
                {pilotUrl ? (
                  <Button asChild size="sm" className="mt-3 min-h-[44px]">
                    <a href={buildLabsRequestUrl(pilotUrl, o.kind)} target="_blank" rel="noopener noreferrer">
                      Start request <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" className="mt-3 min-h-[44px]" disabled>Not yet available</Button>
                )}
              </div>
            ))}
          </div>
          {!pilotUrl && (
            <p className="text-xs text-muted-foreground">The pilot request route is being connected. Nothing has been requested.</p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="font-sans text-[11px] uppercase tracking-[0.08em] text-muted-foreground">What happens next</h3>
          <ol className="space-y-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className="h-6 w-6 shrink-0 rounded-full border border-border flex items-center justify-center text-[11px] font-sans text-muted-foreground">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-muted-foreground">This is the general path, not a live status for any request.</p>
        </section>
      </div>
    </PatientSectionLayout>
  );
};

export default LabsSection;
