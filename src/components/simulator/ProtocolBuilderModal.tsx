import React, { useMemo, useState } from "react";
import { X, Loader2, Info, ShieldAlert, CircleCheck } from "lucide-react";
import type { ServerAdmission, WhatIfCard } from "@/context/SimulatorContext";
import {
  findTemplate,
  optionLabel,
  draftFromTemplate,
  type ActionTemplate,
} from "@/lib/autonomy/templates";

const CATEGORIES = ["food", "sleep", "movement", "stress", "timing", "recovery"] as const;

type Direction = "increase" | "decrease" | "stabilize";
type Cadence = "daily" | "per_session" | "weekly";

interface DraftProtocol {
  template_id: string | null;
  hypothesis_question: string;
  perturbation_category: typeof CATEGORIES[number];
  lever: string;
  rationale: string;
  intervention: Record<string, string | number>;
  primary_outcome: {
    source: "manual" | "lab" | "inbody" | "fibroscan" | "cie";
    name: string;
    unit: string;
    direction: Direction;
    cadence: Cadence;
  };
  hold_stable: string;
  allowed_cointerventions: string;
  run_in_days: number;
  intervention_days: number;
  washout_days: number;
  min_observations_per_phase: number;
  min_adherence_pct: number;
  stop_criteria: string;
}

interface Props {
  open: boolean;
  /** A suggestion the patient is turning into a plan (free-form proposal). */
  card: WhatIfCard | null;
  /** A ready-made plan the patient chose from the catalogue. */
  template?: ActionTemplate | null;
  submitting: boolean;
  /** The server's decision, once it has answered. */
  admission?: ServerAdmission | null;
  onClose: () => void;
  onConfirm: (payload: any) => Promise<void>;
}

export default function ProtocolBuilderModal({
  open,
  card,
  template = null,
  submitting,
  admission = null,
  onClose,
  onConfirm,
}: Props) {
  const activeTemplate = template ?? findTemplate(card?.protocol_template?.template_id as string | undefined);

  const seed = useMemo<DraftProtocol>(() => {
    if (activeTemplate) {
      const d = draftFromTemplate(activeTemplate);
      return {
        ...d,
        template_id: activeTemplate.id,
        hold_stable: "",
        allowed_cointerventions: "",
        washout_days: 0,
        min_observations_per_phase: 3,
        min_adherence_pct: 0.6,
        stop_criteria: d.stop_criteria.join("\n"),
      };
    }
    const t = (card?.protocol_template ?? {}) as any;
    const po = (card?.primary_outcome ?? card?.predicted_deltas?.[0]) as any;
    return {
      template_id: null,
      hypothesis_question:
        t.hypothesis_question || (card ? `How does ${card.lever.toLowerCase()} land for me?` : ""),
      perturbation_category: (card?.perturbation_category as any) || t.perturbation_category || "movement",
      lever: card?.lever ?? "",
      rationale: card?.rationale ?? "",
      intervention: t.intervention || { dose: "", timing: "morning", duration_min: 30, frequency: "daily" },
      primary_outcome: {
        source: po?.source || "manual",
        name: po?.name || po?.biomarker || "",
        unit: po?.unit || "",
        direction: (po?.direction as Direction) || "decrease",
        cadence: (po?.cadence as Cadence) || "daily",
      },
      hold_stable: (t.hold_stable ?? []).join(", "),
      allowed_cointerventions: (t.allowed_cointerventions ?? []).join(", "),
      run_in_days: t.run_in_days ?? 0,
      intervention_days: t.intervention_days ?? 14,
      washout_days: t.washout_days ?? 0,
      min_observations_per_phase: t.min_observations_per_phase ?? 3,
      min_adherence_pct: t.min_adherence_pct ?? 0.6,
      stop_criteria: (t.stop_criteria ?? ["symptom worsens", "sleep drops >1h vs baseline"]).join("\n"),
    };
  }, [card, activeTemplate]);

  const [d, setD] = useState<DraftProtocol>(seed);

  React.useEffect(() => {
    if (open) setD(seed);
  }, [open, seed]);

  if (!open || (!card && !activeTemplate)) return null;

  const stopLines = d.stop_criteria.split("\n").map((s) => s.trim()).filter(Boolean);
  const watchLabel = d.primary_outcome.name || "how you feel and perform";
  const title = activeTemplate?.label ?? card?.lever ?? "";
  const why = activeTemplate?.summary ?? card?.rationale ?? "";

  const handleConfirm = async () => {
    if (submitting) return;
    await onConfirm({
      user_id: card?.user_id,
      source_card_id: card?.id ?? null,
      template_id: d.template_id,
      hypothesis_question: d.hypothesis_question,
      perturbation_category: d.perturbation_category,
      lever: d.lever || title,
      rationale: d.rationale || why,
      intervention: d.intervention,
      primary_outcome: d.primary_outcome,
      secondary_outcomes: [],
      hold_stable: d.hold_stable.split(",").map((s) => s.trim()).filter(Boolean),
      allowed_cointerventions: d.allowed_cointerventions.split(",").map((s) => s.trim()).filter(Boolean),
      run_in_days: d.run_in_days,
      intervention_days: d.intervention_days,
      washout_days: d.washout_days > 0 ? d.washout_days : null,
      min_observations_per_phase: d.min_observations_per_phase,
      min_adherence_pct: d.min_adherence_pct,
      stop_criteria: stopLines,
      contraindications: [],
      expected_direction: d.primary_outcome.direction,
      horizon_days: d.run_in_days + d.intervention_days + (d.washout_days || 0),
      predicted_deltas: card?.predicted_deltas ?? [],
      source_terrain_render_id: card?.source_terrain_render_id ?? null,
    });
  };

  const actionLabel = activeTemplate ? "Start this plan" : "Save as my proposal";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl">
        <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
              {activeTemplate ? "Ready-made plan" : "Your proposal"}
            </p>
            <h2 className="font-serif text-base text-foreground break-words">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 h-11 w-11 -mr-2 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 space-y-5 font-sans text-sm">
          <section className="space-y-1.5">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
              Why this
            </p>
            <p className="text-sm text-foreground leading-relaxed break-words">{why}</p>
          </section>

          <section className="space-y-2">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
              How to do it
            </p>
            {activeTemplate ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(activeTemplate.fields).map(([key, field]) => (
                  <label key={key} className="block space-y-1">
                    <span className="text-[11px] text-muted-foreground">{key.replace(/_/g, " ")}</span>
                    {field.choices ? (
                      <select
                        value={String(d.intervention[key] ?? field.choices[0])}
                        onChange={(e) =>
                          setD({ ...d, intervention: { ...d.intervention, [key]: e.target.value } })
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px]"
                      >
                        {field.choices.map((choice) => (
                          <option key={String(choice)} value={String(choice)}>
                            {optionLabel(choice)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        value={Number(d.intervention[key] ?? field.min ?? 0)}
                        onChange={(e) =>
                          setD({
                            ...d,
                            intervention: { ...d.intervention, [key]: parseInt(e.target.value || "0", 10) },
                          })
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px]"
                      />
                    )}
                    {!field.choices && (
                      <span className="text-[10px] text-muted-foreground">
                        between {field.min} and {field.max}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {["dose", "timing", "duration_min", "frequency"].map((key) => (
                  <label key={key} className="block space-y-1">
                    <span className="text-[11px] text-muted-foreground">{key.replace(/_/g, " ")}</span>
                    <input
                      value={String(d.intervention[key] ?? "")}
                      onChange={(e) =>
                        setD({ ...d, intervention: { ...d.intervention, [key]: e.target.value } })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px]"
                    />
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
              What we're watching
            </p>
            {activeTemplate && activeTemplate.allowedOutcomeSources.includes("manual") ? (
              <select
                value={d.primary_outcome.name}
                onChange={(e) =>
                  setD({ ...d, primary_outcome: { ...d.primary_outcome, source: "manual", name: e.target.value } })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px]"
              >
                {activeTemplate.manualOutcomes.map((name) => (
                  <option key={name} value={name}>
                    {optionLabel(name)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-foreground break-words">
                {watchLabel}
                {d.primary_outcome.unit ? ` (${d.primary_outcome.unit})` : ""} —{" "}
                {d.primary_outcome.cadence.replace("_", " ")}
              </p>
            )}
            <label className="block space-y-1">
              <span className="text-[11px] text-muted-foreground">How many days</span>
              <input
                type="number"
                min={activeTemplate?.minInterventionDays ?? 5}
                max={activeTemplate?.maxInterventionDays ?? 120}
                value={d.intervention_days}
                onChange={(e) => setD({ ...d, intervention_days: parseInt(e.target.value || "0", 10) })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
          </section>

          <section className="space-y-1.5">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
              What would make us change course
            </p>
            {stopLines.length > 0 ? (
              <ul className="text-sm text-foreground list-disc ml-5 space-y-0.5">
                {stopLines.map((s, i) => (
                  <li key={i} className="break-words">
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                We'll review this in about {Math.max(7, d.intervention_days)} days regardless.
              </p>
            )}
          </section>

          {!activeTemplate && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                This is your own idea, so it is saved as a proposal you can read, edit and ask
                questions about. Ready-made plans can be started straight away.
              </span>
            </div>
          )}

          {admission && (
            <div
              className={`rounded-lg border p-3 text-xs flex items-start gap-2 ${
                admission.activation_allowed
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800"
                  : admission.clinician_review_required
                    ? "border-amber-400/40 bg-amber-400/5 text-amber-800"
                    : "border-border bg-muted/20 text-muted-foreground"
              }`}
            >
              {admission.activation_allowed ? (
                <CircleCheck className="h-4 w-4 shrink-0 mt-0.5" />
              ) : admission.clinician_review_required ? (
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 min-w-0">
                <p className="break-words">{admission.patient_message}</p>
                {admission.next_steps?.length > 0 && (
                  <ul className="list-disc ml-4 space-y-0.5">
                    {admission.next_steps.map((s, i) => (
                      <li key={i} className="break-words">
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
                {!admission.activation_allowed && admission.still_available?.length > 0 && (
                  <p className="break-words">
                    Still yours either way: {admission.still_available.join(", ")}.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border px-5 py-3 flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm font-sans text-muted-foreground min-h-[44px] px-3">
            Not now
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-signature text-signature-foreground px-4 py-2 text-sm font-sans min-h-[44px] disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {actionLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
