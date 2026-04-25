import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  HeartPulse,
  Map as MapIcon,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Pill,
  Calendar,
  Users,
  Route,
} from "lucide-react";
import type { ManifestPreview } from "@/lib/manifestSchema";
import { EmptyHint } from "./EmptyHint";

// ---------------------------------------------------------------------------
// Patient summary
// ---------------------------------------------------------------------------
function PatientSummary({ m }: { m: ManifestPreview }) {
  const p = m.patient;
  const initials = p.firstName.slice(0, 1).toUpperCase();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-semibold text-primary">
            {initials}
          </div>
          <div className="flex-1">
            <CardTitle className="text-2xl">{p.firstName}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Age {p.age} · {p.sex}
              {p.id ? ` · ID ${p.id}` : ""}
            </p>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Manifest preview
          </Badge>
        </div>
      </CardHeader>
      {(m.todayBar || m.weeklySnapshot) && (
        <CardContent className="grid gap-4 md:grid-cols-2">
          {m.todayBar ? (
            <Card className="bg-muted/30 border-none">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" />
                  Today
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {m.todayBar.focus && <p className="font-medium">{m.todayBar.focus}</p>}
                {m.todayBar.keyAction && <p className="text-muted-foreground">{m.todayBar.keyAction}</p>}
                {m.todayBar.nextCheckpoint && (
                  <p className="text-xs text-muted-foreground/80 pt-1">
                    Next: {m.todayBar.nextCheckpoint}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <EmptyHint label="Today" field="todayBar" />
          )}
          {m.weeklySnapshot ? (
            <Card className="bg-muted/30 border-none">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  This week
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {m.weeklySnapshot.keyImprovement && (
                  <p>↑ {m.weeklySnapshot.keyImprovement}</p>
                )}
                {m.weeklySnapshot.fragileArea && (
                  <p className="text-muted-foreground">
                    ⚠ {m.weeklySnapshot.fragileArea}
                  </p>
                )}
                {m.weeklySnapshot.keepDoing && (
                  <p className="text-muted-foreground">→ {m.weeklySnapshot.keepDoing}</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <EmptyHint label="This week" field="weeklySnapshot" />
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Thesis
// ---------------------------------------------------------------------------
function ThesisSection({ m }: { m: ManifestPreview }) {
  const t = m.patientThesis;
  if (!t || (!t.title && !t.body)) return <EmptyHint label="Patient thesis" field="patientThesis" />;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Thesis
        </div>
        {t.title && <CardTitle className="text-xl leading-snug">{t.title}</CardTitle>}
      </CardHeader>
      {t.body && (
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.body}</p>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Study overview
// ---------------------------------------------------------------------------
function StudyOverviewSection({ m }: { m: ManifestPreview }) {
  const s = m.studyOverview;
  if (!s) return <EmptyHint label="Study overview" field="studyOverview" />;
  const layers = s.layers ?? [];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          Study overview
        </div>
        {s.summary && <CardTitle className="text-base font-medium leading-snug">{s.summary}</CardTitle>}
        {s.statLine && (
          <p className="text-xs text-muted-foreground">{s.statLine}</p>
        )}
      </CardHeader>
      {layers.length > 0 ? (
        <CardContent className="grid gap-3 md:grid-cols-2">
          {layers.map((l) => (
            <div key={l.id} className="rounded-lg border p-3 bg-muted/20">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {l.icon && <span aria-hidden>{l.icon}</span>}
                  <p className="font-medium text-sm">{l.title}</p>
                </div>
                {l.status && (
                  <Badge
                    variant={l.status === "complete" ? "default" : "secondary"}
                    className="text-[10px] capitalize"
                  >
                    {l.status.replace("-", " ")}
                  </Badge>
                )}
              </div>
              {l.description && (
                <p className="text-xs text-muted-foreground mt-1.5">{l.description}</p>
              )}
            </div>
          ))}
        </CardContent>
      ) : (
        <CardContent>
          <EmptyHint label="Study layers" field="studyOverview.layers" />
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Layer findings
// ---------------------------------------------------------------------------
function LayerFindingsSection({ m }: { m: ManifestPreview }) {
  const lf = m.layerFindings ?? {};
  const entries = Object.entries(lf);
  if (entries.length === 0) return <EmptyHint label="Layer findings" field="layerFindings" />;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Stethoscope className="h-3.5 w-3.5" />
          Layer findings
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([k, v]) => (
          <div key={k} className="border-l-2 border-primary/40 pl-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {k}
            </p>
            <p className="text-sm mt-0.5">{v}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helping vs feeding
// ---------------------------------------------------------------------------
function HelpingFeedingSection({ m }: { m: ManifestPreview }) {
  const hf = m.helpingVsFeeding;
  if (!hf || ((hf.helping ?? []).length === 0 && (hf.feeding ?? []).length === 0)) {
    return <EmptyHint label="Helping vs feeding" field="helpingVsFeeding" />;
  }
  const Col = ({
    title,
    items,
    tone,
  }: {
    title: string;
    items: Array<{ label?: string; mechanism?: string } & Record<string, unknown>>;
    tone: "ok" | "warn";
  }) => (
    <div>
      <p className={`text-xs uppercase tracking-wide font-medium ${tone === "ok" ? "text-emerald-600" : "text-amber-600"}`}>
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-2">None listed.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium">{it.label}</span>
              {it.mechanism && (
                <span className="text-muted-foreground"> — {it.mechanism}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <HeartPulse className="h-3.5 w-3.5" />
          Helping vs feeding
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <Col title="Helping" items={hf.helping ?? []} tone="ok" />
        <Col title="Feeding" items={hf.feeding ?? []} tone="warn" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Confidence breakdown — visualization
// ---------------------------------------------------------------------------
function ConfidenceSection({ m }: { m: ManifestPreview }) {
  const c = m.confidenceBreakdown;
  if (!c) return <EmptyHint label="Confidence breakdown" field="confidenceBreakdown" />;
  const confident = c.confident ?? [];
  const investigating = c.investigating ?? [];
  const retest = c.retest ?? [];
  const total = confident.length + investigating.length + retest.length;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  const rows: { label: string; items: string[]; pct: number; tone: string }[] = [
    { label: "Confident", items: confident, pct: pct(confident.length), tone: "bg-emerald-500" },
    { label: "Investigating", items: investigating, pct: pct(investigating.length), tone: "bg-amber-500" },
    { label: "Retest", items: retest, pct: pct(retest.length), tone: "bg-sky-500" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Confidence breakdown
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="text-xs text-muted-foreground">No confidence items provided.</p>
        ) : (
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {rows.map((r) =>
              r.pct > 0 ? (
                <div key={r.label} className={r.tone} style={{ width: `${r.pct}%` }} title={`${r.label}: ${r.pct}%`} />
              ) : null,
            )}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          {rows.map((r) => (
            <div key={r.label} className="rounded-md border p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide font-medium">{r.label}</p>
                <span className="text-xs text-muted-foreground">{r.items.length}</span>
              </div>
              {r.items.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-2">None</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {r.items.slice(0, 5).map((it, i) => (
                    <li key={i}>• {it}</li>
                  ))}
                  {r.items.length > 5 && (
                    <li className="text-muted-foreground/70">+{r.items.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Reversibility
// ---------------------------------------------------------------------------
function ReversibilitySection({ m }: { m: ManifestPreview }) {
  const r = m.reversibility;
  if (!r) return <EmptyHint label="Reversibility" field="reversibility" />;
  const buckets: { label: string; items: string[]; weight: number }[] = [
    { label: "Weeks", items: r.weeks ?? [], weight: 100 },
    { label: "Months", items: r.months ?? [], weight: 75 },
    { label: "Slow", items: r.slow ?? [], weight: 40 },
    { label: "Permanent", items: r.permanent ?? [], weight: 10 },
  ];
  const hasAny = buckets.some((b) => b.items.length > 0);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          Reversibility
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAny ? (
          <p className="text-xs text-muted-foreground">No reversibility items provided.</p>
        ) : (
          buckets.map((b) => (
            <div key={b.label}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium">{b.label}</p>
                <span className="text-xs text-muted-foreground">{b.items.length}</span>
              </div>
              <Progress value={b.items.length === 0 ? 0 : b.weight} className="h-1.5" />
              {b.items.length > 0 && (
                <ul className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
                  {b.items.map((it, i) => (
                    <li key={i}>• {it}</li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
        {r.closingLine && (
          <p className="text-xs text-muted-foreground italic pt-2 border-t">
            {r.closingLine}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Care map
// ---------------------------------------------------------------------------
function CareMapSection({ m }: { m: ManifestPreview }) {
  const cm = m.careMap;
  if (!cm) return <EmptyHint label="Care map" field="careMap" />;
  const meds = cm.medications ?? [];
  const checkpoints = cm.checkpoints ?? [];
  const resp = cm.responsibilities ?? [];
  if (meds.length === 0 && checkpoints.length === 0 && resp.length === 0) {
    return <EmptyHint label="Care map" field="careMap" />;
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <MapIcon className="h-3.5 w-3.5" />
          Care map
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Pill className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs uppercase tracking-wide font-medium">Medications</p>
          </div>
          {meds.length === 0 ? (
            <p className="text-xs text-muted-foreground">None listed.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {meds.map((med, i) => (
                <div key={i} className="rounded-md border p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{med.name}</p>
                    {med.dose && <span className="text-xs text-muted-foreground">{med.dose}</span>}
                  </div>
                  {med.purpose && <p className="text-xs text-muted-foreground mt-0.5">{med.purpose}</p>}
                  {med.notes && <p className="text-xs text-muted-foreground/80 mt-1 italic">{med.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs uppercase tracking-wide font-medium">Checkpoints</p>
          </div>
          {checkpoints.length === 0 ? (
            <p className="text-xs text-muted-foreground">None listed.</p>
          ) : (
            <ol className="space-y-2">
              {checkpoints.map((cp, i) => (
                <li key={i} className="border-l-2 border-primary/40 pl-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium">{cp.label}</p>
                    {cp.date && <span className="text-xs text-muted-foreground">{cp.date}</span>}
                  </div>
                  {cp.description && <p className="text-xs text-muted-foreground mt-0.5">{cp.description}</p>}
                  {(cp.owner || cp.checking) && (
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                      {cp.owner && <span>Owner: {cp.owner}</span>}
                      {cp.owner && cp.checking && " · "}
                      {cp.checking && <span>Checking: {cp.checking}</span>}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs uppercase tracking-wide font-medium">Responsibilities</p>
          </div>
          {resp.length === 0 ? (
            <p className="text-xs text-muted-foreground">None listed.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {resp.map((r, i) => (
                <div key={i} className="rounded-md border p-2.5 bg-muted/20">
                  <p className="text-sm font-medium">{r.who}</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {(r.tasks ?? []).map((t, j) => (
                      <li key={j}>• {t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Symptom bridges
// ---------------------------------------------------------------------------
function SymptomBridgesSection({ m }: { m: ManifestPreview }) {
  const sb = m.symptomBridges ?? [];
  if (sb.length === 0) return <EmptyHint label="Symptom bridges" field="symptomBridges" />;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          Symptom bridges
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {sb.map((s, i) => (
            <li key={i} className="text-muted-foreground">→ {s}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Patient journey — vertical timeline
// ---------------------------------------------------------------------------
function PatientJourneySection({ m }: { m: ManifestPreview }) {
  const j = m.patientJourney;
  if (!j || ((j.timeline ?? []).length === 0 && !j.currentPhase && !j.nextStep)) {
    return <EmptyHint label="Patient journey" field="patientJourney" />;
  }
  const events = j.timeline ?? [];
  const toneFor = (status?: string) => {
    if (status === "complete") return { dot: "bg-emerald-500", ring: "ring-emerald-500/20", label: "Complete", labelClass: "text-emerald-600" };
    if (status === "current") return { dot: "bg-primary", ring: "ring-primary/20", label: "Current", labelClass: "text-primary" };
    if (status === "upcoming") return { dot: "bg-muted-foreground/40", ring: "ring-muted-foreground/10", label: "Upcoming", labelClass: "text-muted-foreground" };
    return { dot: "bg-muted-foreground/40", ring: "ring-muted-foreground/10", label: "", labelClass: "text-muted-foreground" };
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Route className="h-3.5 w-3.5" />
          Patient journey
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(j.currentPhase || j.nextStep) && (
          <div className="grid gap-3 md:grid-cols-2">
            {j.currentPhase && (
              <div className="rounded-md border bg-primary/5 p-3">
                <p className="text-[10px] uppercase tracking-wide font-medium text-primary">
                  Current phase
                </p>
                <p className="text-sm mt-1">{j.currentPhase}</p>
              </div>
            )}
            {j.nextStep && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
                  Next step
                </p>
                <p className="text-sm mt-1">{j.nextStep}</p>
              </div>
            )}
          </div>
        )}
        {events.length > 0 && !j.currentPhase && !j.nextStep && (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              Phase not provided — add{" "}
              <code className="font-mono text-[10px]">patientJourney.currentPhase</code>{" "}
              or{" "}
              <code className="font-mono text-[10px]">patientJourney.nextStep</code>{" "}
              to highlight where the patient is now.
            </p>
          </div>
        )}
        {events.length > 0 && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Complete
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Current
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              Upcoming
            </span>
          </div>
        )}
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No timeline events listed.</p>
        ) : (
          <ol className="relative border-l-2 border-muted ml-2 space-y-4">
            {events.map((e, i) => {
              const tone = toneFor(e.status);
              return (
                <li key={i} className="pl-4 relative">
                  <span
                    className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ring-4 ${tone.dot} ${tone.ring}`}
                    aria-hidden
                  />
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {e.icon && <span aria-hidden>{e.icon}</span>}
                      {e.title}
                    </p>
                    <span className="text-xs text-muted-foreground font-mono">{e.dateLabel}</span>
                  </div>
                  {e.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>
                  )}
                  {tone.label && (
                    <p className={`text-[10px] uppercase tracking-wide font-medium mt-1 ${tone.labelClass}`}>
                      {tone.label}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section map (data-driven)
// ---------------------------------------------------------------------------
export const sectionRenderers: Record<string, (m: ManifestPreview) => JSX.Element> = {
  patient: (m) => <PatientSummary m={m} />,
  patientThesis: (m) => <ThesisSection m={m} />,
  studyOverview: (m) => <StudyOverviewSection m={m} />,
  layerFindings: (m) => <LayerFindingsSection m={m} />,
  helpingVsFeeding: (m) => <HelpingFeedingSection m={m} />,
  symptomBridges: (m) => <SymptomBridgesSection m={m} />,
  reversibility: (m) => <ReversibilitySection m={m} />,
  confidenceBreakdown: (m) => <ConfidenceSection m={m} />,
  careMap: (m) => <CareMapSection m={m} />,
  patientJourney: (m) => <PatientJourneySection m={m} />,
};

export interface SectionMeta {
  key: keyof typeof sectionRenderers;
  label: string;
}

export const sectionMeta: SectionMeta[] = [
  { key: "patient", label: "Patient" },
  { key: "patientThesis", label: "Thesis" },
  { key: "studyOverview", label: "Study overview" },
  { key: "layerFindings", label: "Layer findings" },
  { key: "helpingVsFeeding", label: "Helping vs feeding" },
  { key: "symptomBridges", label: "Symptom bridges" },
  { key: "reversibility", label: "Reversibility" },
  { key: "confidenceBreakdown", label: "Confidence" },
  { key: "careMap", label: "Care map" },
  { key: "patientJourney", label: "Patient journey" },
];

export const sectionOrder = sectionMeta.map((s) => s.key);

/** Stable DOM id used by the sticky section nav. */
export const sectionAnchorId = (key: string) => `manifest-section-${key}`;

export function RenderManifest({ m }: { m: ManifestPreview }) {
  return (
    <div className="space-y-5">
      {sectionMeta.map(({ key }) => (
        <div key={key} id={sectionAnchorId(key)} className="scroll-mt-24">
          {sectionRenderers[key](m)}
        </div>
      ))}
    </div>
  );
}