import React from "react";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
  CircleSlash,
  Ban,
  Dna,
  Pill,
  FlaskConical,
  GitCompare,
  ScrollText,
  ListChecks,
  MessageCircle,
} from "lucide-react";
import { useBioTwin } from "@/context/BioTwinContext";
import { useViewAs } from "@/context/ViewAsContext";
import { useNavigation } from "@/context/NavigationContext";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import BioTwinImportCard from "@/components/biotwin/BioTwinImportCard";
import {
  readString,
  statementsBy,
  TRUTH_LABEL,
  type BiotwinStatement,
} from "@/lib/biotwin/types";

/* ── primitives ─────────────────────────────────────────────────────────── */

const Panel: React.FC<{
  title: string;
  icon: React.ElementType;
  subtitle?: string | null;
  children: React.ReactNode;
}> = ({ title, icon: Icon, subtitle, children }) => (
  <section className="rounded-lg border border-border bg-card p-4 md:p-5 min-w-0">
    <div className="flex items-start gap-2.5 min-w-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <h3 className="font-serif text-base break-words">{title}</h3>
        {subtitle && (
          <p className="font-sans text-xs text-muted-foreground mt-0.5 break-words">{subtitle}</p>
        )}
      </div>
    </div>
    <div className="mt-4 space-y-3 min-w-0">{children}</div>
  </section>
);

const TruthChip: React.FC<{ status: BiotwinStatement["truth_status"] }> = ({ status }) => {
  const styles: Record<string, string> = {
    confirmed: "border-teal-200 bg-teal-50 text-teal-800",
    candidate: "border-amber-200 bg-amber-50 text-amber-800",
    unknown: "border-border bg-muted/40 text-muted-foreground",
    retired: "border-border bg-muted/30 text-muted-foreground line-through",
    prohibited: "border-destructive/30 bg-destructive/5 text-destructive",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide ${styles[status]}`}
    >
      {TRUTH_LABEL[status]}
    </span>
  );
};

const StatementCard: React.FC<{ s: BiotwinStatement; showChip?: boolean }> = ({
  s,
  showChip = true,
}) => (
  <article className="rounded-md border border-border/70 bg-background p-3 min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
      <h4 className="font-serif text-sm leading-snug break-words min-w-0">{s.title}</h4>
      {showChip && <TruthChip status={s.truth_status} />}
    </div>
    {s.body && (
      <p className="mt-1.5 font-sans text-xs leading-relaxed text-foreground/85 break-words">
        {s.body}
      </p>
    )}
    {s.measurements && s.measurements.length > 0 && (
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {s.measurements.map((m, i) => (
          <li
            key={`${m.name}-${i}`}
            className="rounded bg-muted/50 px-2 py-0.5 font-sans text-[11px] break-words"
          >
            {m.name}
            {m.value != null && ` ${m.value}`}
            {m.unit && ` ${m.unit}`}
            {m.timepoint && ` · ${m.timepoint}`}
          </li>
        ))}
      </ul>
    )}
    {s.bounds && s.bounds.length > 0 && (
      <div className="mt-2">
        <p className="font-sans text-[10px] uppercase tracking-wide text-muted-foreground">
          What this does not settle
        </p>
        <ul className="mt-1 space-y-0.5">
          {s.bounds.map((b, i) => (
            <li key={i} className="font-sans text-xs text-muted-foreground break-words">
              · {b}
            </li>
          ))}
        </ul>
      </div>
    )}
    {readString(s.requires_measurement as Record<string, unknown>, "next_truth_test") && (
      <p className="mt-2 font-sans text-xs break-words">
        <span className="text-muted-foreground">What would settle it: </span>
        {readString(s.requires_measurement as Record<string, unknown>, "next_truth_test")}
      </p>
    )}
  </article>
);

const Empty: React.FC<{ label: string }> = ({ label }) => (
  <p className="font-sans text-xs text-muted-foreground break-words">{label}</p>
);

/* ── section ────────────────────────────────────────────────────────────── */

const BioTwinSection: React.FC = () => {
  const { report, statements, loading } = useBioTwin();
  const { isAdmin, isViewingAs } = useViewAs();
  const { navigateTo } = useNavigation();
  const clinicianView = isAdmin || isViewingAs;

  if (loading) {
    return (
      <PatientSectionLayout title="Your BioTwin" intro="Reading your imported report.">
        <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
      </PatientSectionLayout>
    );
  }

  if (!report) {
    return (
      <PatientSectionLayout
        title="Your BioTwin"
        intro="No clinical evidence report has been imported yet."
      >
        <div className="space-y-4 min-w-0">
          <p className="font-sans text-sm text-muted-foreground max-w-prose break-words">
            When a final BioTwin clinical evidence report is imported, this page shows exactly
            what it establishes, what it does not, and what would change the answer. Nothing here
            is generated — it is read from the report.
          </p>
          <BioTwinImportCard />
        </div>
      </PatientSectionLayout>
    );
  }

  const synthesis = report.executive_synthesis ?? {};
  const release = report.release_control ?? {};

  const confirmed = statementsBy(
    statements,
    (s) => s.truth_status === "confirmed" && s.statement_kind === "confirmed_measurement",
  );
  const candidates = statementsBy(statements, (s) => s.truth_status === "candidate");
  const unknowns = statementsBy(statements, (s) => s.truth_status === "unknown");
  const retired = statementsBy(statements, (s) => s.truth_status === "retired");
  const prohibited = statementsBy(statements, (s) => s.truth_status === "prohibited");
  const drivers = statementsBy(statements, (s) => s.statement_kind === "driver");
  const actions = statementsBy(statements, (s) => s.statement_kind === "action");
  const medication = statementsBy(statements, (s) => s.statement_kind === "medication");
  const genomics = statementsBy(statements, (s) => s.statement_kind === "pgx_variant");
  const omics = statementsBy(statements, (s) => s.statement_kind === "omics_readiness");
  const contradictions = statementsBy(
    statements,
    (s) => s.statement_kind === "contradiction" || s.statement_kind === "semantic_repair",
  );
  const evidence = statementsBy(statements, (s) => s.statement_kind === "external_evidence");

  return (
    <PatientSectionLayout
      title="Your BioTwin"
      intro={`Imported report · version ${report.version}${
        report.generated_date ? ` · ${report.generated_date}` : ""
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5 min-w-0"
      >
        {/* Release control — the report's own governance, shown first. */}
        {(report.clinician_review_required || (report.holds ?? []).length > 0) && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50/60 p-4 min-w-0">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <p className="font-serif text-sm text-amber-900 break-words">
                This report is held for treating-clinician review.
              </p>
              <p className="mt-1 font-sans text-xs text-amber-800 break-words">
                Nothing here is a treatment instruction. Medication, pharmacogenomic and
                continuous-glucose conclusions stay on hold until your clinician signs off.
              </p>
              {(report.holds ?? []).length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {(report.holds ?? []).map((h) => (
                    <li
                      key={h}
                      className="rounded border border-amber-300 bg-background px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide text-amber-800 break-words"
                    >
                      {h.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Executive synthesis */}
        <Panel title="Where you stand" icon={CheckCircle2}>
          {readString(synthesis, "headline") ? (
            <p className="font-serif text-lg leading-snug break-words">
              {readString(synthesis, "headline")}
            </p>
          ) : (
            <Empty label="The report carries no executive headline." />
          )}
          <dl className="grid gap-3 sm:grid-cols-3 min-w-0">
            {[
              ["What is settled", readString(synthesis, "what_is_certain")],
              ["What is not settled", readString(synthesis, "what_is_not_certain")],
              ["What happens next", readString(synthesis, "what_happens_next")],
            ].map(([label, value]) =>
              value ? (
                <div key={label as string} className="min-w-0">
                  <dt className="font-sans text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-1 font-sans text-xs leading-relaxed break-words">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </Panel>

        {/* Truth state — four buckets, never merged */}
        <Panel
          title="What is established"
          icon={CheckCircle2}
          subtitle="Measured, bounded findings the report stands behind."
        >
          {confirmed.length ? (
            confirmed.map((s) => <StatementCard key={s.id} s={s} />)
          ) : (
            <Empty label="The report establishes no confirmed measurement." />
          )}
        </Panel>

        <Panel
          title="Possible, not yet established"
          icon={HelpCircle}
          subtitle="Signals that exist but do not yet carry a decision."
        >
          {candidates.length ? (
            candidates.map((s) => <StatementCard key={s.id} s={s} />)
          ) : (
            <Empty label="No candidate signals are open." />
          )}
        </Panel>

        <Panel title="Open questions" icon={HelpCircle}>
          {unknowns.length ? (
            unknowns.map((s) => <StatementCard key={s.id} s={s} />)
          ) : (
            <Empty label="No open screening findings." />
          )}
        </Panel>

        <Panel
          title="No longer supported"
          icon={CircleSlash}
          subtitle="Earlier labels this report retires, with what replaced them."
        >
          {retired.length ? (
            retired.map((s) => <StatementCard key={s.id} s={s} />)
          ) : (
            <Empty label="Nothing was retired." />
          )}
        </Panel>

        {/* Driver hierarchy */}
        <Panel title="What is driving this, in order" icon={ListChecks}>
          {drivers.length ? (
            <ol className="space-y-3">
              {drivers.map((s, i) => (
                <li key={s.id} className="flex gap-3 min-w-0">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border font-sans text-xs">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <StatementCard s={s} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty label="The report declares no driver hierarchy." />
          )}
        </Panel>

        {/* Measurement & action plan */}
        <Panel
          title="What to measure next"
          icon={ListChecks}
          subtitle="Each item exists to move something from unknown to known."
        >
          {actions.length ? (
            actions.map((s) => <StatementCard key={s.id} s={s} showChip={false} />)
          ) : (
            <Empty label="The report requests no further measurement." />
          )}
        </Panel>

        {/* Medication */}
        <Panel
          title="Medication status"
          icon={Pill}
          subtitle={readString(release, "medication_or_treatment_decision")?.replace(/_/g, " ")}
        >
          {medication.length ? (
            medication.map((s) => <StatementCard key={s.id} s={s} />)
          ) : (
            <Empty label="The report carries no medication statements." />
          )}
        </Panel>

        {/* Genomics / PGx */}
        <Panel
          title="Genomics and drug response"
          icon={Dna}
          subtitle={readString(release, "pharmacogenomic_action")?.replace(/_/g, " ")}
        >
          {genomics.length ? (
            genomics.map((s) => <StatementCard key={s.id} s={s} />)
          ) : (
            <Empty label="No pharmacogenomic statements are included." />
          )}
        </Panel>

        {/* Omics readiness */}
        <Panel title="What is not yet measurable" icon={FlaskConical}>
          {omics.length ? (
            omics.map((s) => <StatementCard key={s.id} s={s} showChip={false} />)
          ) : (
            <Empty label="No omics readiness statements." />
          )}
        </Panel>

        {/* Contradictions / repair ledger */}
        <Panel
          title="What we corrected"
          icon={GitCompare}
          subtitle="Contradictions the report resolved, and the language it repaired."
        >
          {contradictions.length ? (
            contradictions.map((s) => <StatementCard key={s.id} s={s} showChip={false} />)
          ) : (
            <Empty label="No contradictions were recorded." />
          )}
        </Panel>

        {/* Ask your twin */}
        <Panel
          title="Ask your twin"
          icon={MessageCircle}
          subtitle="Questions are answered from this report's own bounds, not from a general model."
        >
          <button
            type="button"
            onClick={() => navigateTo("ask")}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border px-4 font-sans text-sm hover:bg-muted/50"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            Ask about this report
          </button>
        </Panel>

        {/* Clinician-only surfaces */}
        {clinicianView && (
          <>
            <Panel
              title="Prohibited claims (clinician view)"
              icon={Ban}
              subtitle="Enforced on every generated answer for this person."
            >
              {prohibited.length ? (
                <ul className="space-y-1.5">
                  {prohibited.map((s) => (
                    <li
                      key={s.id}
                      className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 font-sans text-xs text-destructive break-words"
                    >
                      {s.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty label="The report declares no prohibited statements." />
              )}
            </Panel>

            <Panel
              title="Evidence and provenance (clinician view)"
              icon={ScrollText}
              subtitle={`Adapter ${report.adapter_version}${
                report.semantic_repair_version ? ` · repair ${report.semantic_repair_version}` : ""
              }`}
            >
              {evidence.length > 0 &&
                evidence.map((s) => <StatementCard key={s.id} s={s} showChip={false} />)}
              <div className="grid gap-2 sm:grid-cols-2 min-w-0">
                {Object.entries(release).map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <p className="font-sans text-[10px] uppercase tracking-wide text-muted-foreground break-words">
                      {k.replace(/_/g, " ")}
                    </p>
                    <p className="font-sans text-xs break-words">{String(v)}</p>
                  </div>
                ))}
              </div>
              <p className="font-sans text-xs text-muted-foreground break-words">
                {statements.length} governed statements ·{" "}
                {statements.filter((s) => s.witness_id).length} projected into the witness ledger.
                Signals that are not pre-registered stay evidence-only.
              </p>
            </Panel>

            <BioTwinImportCard />
          </>
        )}

        {!clinicianView && <BioTwinImportCard />}
      </motion.div>
    </PatientSectionLayout>
  );
};

export default BioTwinSection;