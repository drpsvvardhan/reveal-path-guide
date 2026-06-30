import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import PMEBlock from "@/components/sections/PMEBlock";
import { admitPME, type PME } from "@shared/pme/pme";
import { PME_REGISTRY, PME_VARIANTS } from "@shared/pme/pmeRegistry";

// ─────────────────────────────────────────────────────────────
// Care Map v1 — Causal Spine
//
// Consumes PERSISTED AAE output from action_plans.today_actions (the same
// table ActionSection reads). Each action carries an `admission` block written
// by the AAE gate in generate-action-plan:
//     { verdict: "ADMIT" | "ADMIT_WITH_REVIEW" | "BLOCK", reasons, provenance }
// BLOCK edges are already withheld at persist time — they will not appear in
// today_actions. We still read the AAE ledger row to get the blocked COUNT for
// the patient "still learning" aggregate (count only, never edge names).
//
// DOCTRINE (CodexOS ruling):
//   Patient sees: ADMIT spines · ADMIT_WITH_REVIEW summarized · blocked COUNT only
//   Clinician sees: full Admission Ledger (blocked edges, reasons, what_would_resolve)
//   Blocked causal claims NEVER enter patient view.
//
// PROVISIONAL: patient-facing cause/intervention/effect language is mapped from
// existing fields (core_*, what, why_template) by `provisionalSpineLanguage()`.
// The authoritative source SHOULD be pre-authored fields on the intervention:
//   patient_cause_label, patient_intervention_label, patient_expected_effect_label,
//   clinician_causal_edge
// Until those exist, this adapter stands in and is marked PROVISIONAL.
// ─────────────────────────────────────────────────────────────

const COORD_LABELS: Record<string, string> = {
  E: "Energy", I: "Inflammation", V: "Vascular", R: "Regulation", "Σ": "Scar memory",
};

interface AdmissionBlock {
  verdict: "ADMIT" | "ADMIT_WITH_REVIEW" | "BLOCK";
  reasons?: string[];
  provenance?: string[];
}
interface ActionItem {
  id: string;
  what?: string;
  why?: string;
  core_title?: string;
  core_rationale?: string;
  core_observation?: string;
  coordinates?: string[];
  retest_weeks?: number;
  admission?: AdmissionBlock;
}
interface AaeLedger {
  selected_count?: number;
  dropped_upstream?: number;
  reached_aae?: number;
  blocked_by_aae?: number;
  admitted?: number;
  aae_emptiness_ratio?: number;
  total_attrition_ratio?: number;
  blocked_edges?: string[];
}

// ── PROVISIONAL language adapter ──
// Maps existing fields → spine slots. Replace when the four pre-authored
// patient_* / clinician_causal_edge fields exist on the intervention.
function provisionalSpineLanguage(a: ActionItem) {
  return {
    // patient_cause_label (provisional: derived from core_observation/core_rationale)
    cause_patient:
      a.core_rationale?.split(".")[0] ||
      "A signal in your biology supports this",
    // patient_intervention_label (provisional: core_title or what)
    intervention_patient: a.core_title || a.what || a.id,
    // patient_expected_effect_label (provisional: trimmed core_observation)
    effect_patient:
      a.core_observation ||
      "Expected to move your terrain in the right direction over the coming weeks",
    // clinician_causal_edge (provisional: composed from raw fields)
    clinician_edge: `${a.id}: ${a.what || "(no directive)"} — ${a.why || a.core_rationale || ""}`,
    _provisional: true,
  };
}

const CareMapSection: React.FC = () => {
  const { user } = useAuth();
  // Matches ActionSection: effective user respects admin view-as.
  const { isAdmin, effectiveUserId } = useViewAs();
  const userId = effectiveUserId || user?.id;

  // HONEST NOTE: the patient-reveal app has NO true clinician/patient role system.
  // The only available seam is admin view-as (useViewAs). We gate the clinician
  // ledger behind isAdmin as a PROVISIONAL stand-in. A real clinician role
  // (Entra role per the Implementation Contracts §9) must replace this before
  // the clinician ledger is exposed to actual clinicians rather than admins.
  const viewerRole: "patient" | "clinician" = isAdmin ? "clinician" : "patient";

  const [actions, setActions] = useState<ActionItem[]>([]);
  const [ledger, setLedger] = useState<AaeLedger | null>(null);
  const [loading, setLoading] = useState(true);
  // Set of normalized marker identifiers admitted for THIS patient.
  // Built from lab observation names + CIE gate ids. Used to evaluate each
  // PME's data_binding at runtime instead of trusting the registry's
  // authored placeholder (always false until clinical confirmation).
  const [admittedMarkers, setAdmittedMarkers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      // 1. newest active action plan (same pattern as ActionSection)
      const { data: plan } = await supabase
        .from("action_plans")
        .select("today_actions, created_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. newest AAE ledger row (for the blocked COUNT + clinician ledger)
      const { data: aaeRow } = await supabase
        .from("patient_chat_validation_log")
        .select("original_output, created_at")
        .eq("user_id", userId)
        .eq("message_role", "aae_admission")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3. patient marker presence — lab observations + CIE gates.
      const [{ data: obsRows }, { data: gateRows }] = await Promise.all([
        supabase
          .from("patient_lab_observations")
          .select("raw_name, canonical_name, canonical_concept_id, biomarker_class")
          .eq("user_id", userId),
        supabase
          .from("cie_gate_scores")
          .select("gate_id, gate_name")
          .eq("user_id", userId),
      ]);
      const markers = new Set<string>();
      const norm = (s: string | null | undefined) =>
        (s || "").toString().trim().toLowerCase().replace(/[\s\-/]+/g, "_");
      (obsRows || []).forEach((o: any) => {
        [o.raw_name, o.canonical_name, o.canonical_concept_id, o.biomarker_class].forEach((v) => {
          const n = norm(v);
          if (n) markers.add(n);
        });
      });
      (gateRows || []).forEach((g: any) => {
        const id = norm(g.gate_id);
        if (id) markers.add(id);
        const name = norm(g.gate_name);
        if (name) markers.add(name);
      });

      if (cancelled) return;
      setActions(((plan?.today_actions as any[]) || []) as ActionItem[]);
      setAdmittedMarkers(markers);
      // original_output may be JSONB (already an object) or a JSON string,
      // depending on column type — handle both.
      const raw = (aaeRow as any)?.original_output;
      try {
        setLedger(typeof raw === "string" ? JSON.parse(raw) : (raw ?? null));
      } catch {
        setLedger(null);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) return null;

  // Partition by admission verdict. BLOCK edges are already absent from
  // today_actions (withheld at persist), but we filter defensively.
  const admitted = actions.filter((a) => a.admission?.verdict === "ADMIT");
  const underReview = actions.filter((a) => a.admission?.verdict === "ADMIT_WITH_REVIEW");
  const blockedCount = ledger?.blocked_by_aae ?? 0;

  return (
    <PatientSectionLayout
      eyebrow="CARE MAP"
      title="The moves your biology earns"
      intro="Each link below connects a signal in your data to a move it permits and the outcome we expect. We only show what we can stand behind today."
      aside={null /* hardcoded 82% adherence ring removed — it was not connected to any data */}
    >
      {/* SECTION 1 — What we can act on now (ADMIT spines) */}
      <div className="mb-8">
        <h3 className="font-serif text-lg text-foreground mb-3">What we can act on now</h3>
        {admitted.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Nothing has cleared admission for action yet. As your data deepens, moves will appear here.
          </div>
        ) : (
          admitted.map((a) => (
            <SpineCard key={a.id} action={a} mode={viewerRole} admittedMarkers={admittedMarkers} />
          ))
        )}
      </div>

      {/* SECTION 2 — What your clinician is reviewing (summary for patient) */}
      <div className="mb-8">
        <h3 className="font-serif text-lg text-foreground mb-3">What your clinician is reviewing</h3>
        {viewerRole === "patient" ? (
          underReview.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">
              {underReview.length} additional {underReview.length === 1 ? "move is" : "moves are"} being
              reviewed by your clinician before becoming part of your plan.
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Nothing under clinician review right now.
            </div>
          )
        ) : underReview.length > 0 ? (
          underReview.map((a) => (
            <SpineCard key={a.id} action={a} mode="clinician" admittedMarkers={admittedMarkers} />
          ))
        ) : (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No ADMIT_WITH_REVIEW edges for this twin.
          </div>
        )}
      </div>

      {/* SECTION 3 — patient: still-learning COUNT only · clinician: Admission Ledger */}
      <div>
        <h3 className="font-serif text-lg text-foreground mb-3">
          {viewerRole === "patient" ? "What we are still learning" : "Admission Ledger"}
        </h3>

        {viewerRole === "patient" ? (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="font-serif text-3xl text-foreground leading-none">{blockedCount}</div>
            <p className="text-sm text-muted-foreground mt-2 max-w-lg break-words">
              possible care links were withheld because they don't yet have enough evidence for you
              specifically. As your data deepens and the evidence base grows, some may become moves we can
              act on. We only show you what we can stand behind today.
            </p>
          </div>
        ) : (
          <ClinicianLedger ledger={ledger} />
        )}
      </div>

      <p className="mt-8 text-[11px] text-muted-foreground text-center">
        {viewerRole === "patient"
          ? "You see what we can stand behind. The full evidence ledger is visible to your clinician."
          : "Clinician view · full AAE ledger · blocked causal claims are never exposed to the patient."}
      </p>
    </PatientSectionLayout>
  );
};

// ── Causal Spine card ──
const SpineCard: React.FC<{
  action: ActionItem;
  mode: "patient" | "clinician";
  admittedMarkers: Set<string>;
}> = ({ action, mode, admittedMarkers }) => {
  const lang = provisionalSpineLanguage(action);
  const strongest = (action.admission?.provenance || []).some((p) =>
    ["literature_witness", "mechanistic_inference", "population_evidence", "twin_evidence", "provider_judgment"].includes(p),
  );
  const linkDash = strongest ? "none" : "6 4"; // visual weight only; no patient label

  // ── PME lookup & runtime data binding ──
  // Edge id without an authored PME → nothing teaches; spine stands alone.
  const authored: PME | undefined = PME_REGISTRY[action.id];
  let pmeRenderable = false;
  let pmeVerdict: "ADMIT" | "ADMIT_WITH_REVIEW" | "BLOCK" = "BLOCK";
  let pmeRegisterText: string | undefined;
  let pmeProvisional = false;
  let pmeReviewFlags: string[] = [];

  if (authored) {
    const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-/]+/g, "_");
    const required = authored.data_binding.required_markers.map(norm);
    const allRequiredPresent =
      required.length > 0 && required.every((m) => admittedMarkers.has(m));

    // Optional "cycle" markers — gate which register variant to use for the
    // muscle PME (full cycle vs maintenance-only). Absence is not a block;
    // it only narrows the teaching.
    const cycleMarkers = ["glucose", "homa_ir", "body_fat_pct", "visceral_fat"];
    const cyclePresent = cycleMarkers.some((m) => admittedMarkers.has(m));

    // Compute admitted_required from real data, ignoring the authored placeholder.
    const runtimePme: PME = {
      ...authored,
      data_binding: { ...authored.data_binding, admitted_required: allRequiredPresent },
    };
    const admission = admitPME(runtimePme);

    // Clinician/admin review surface: admission ignoring the data-binding gate,
    // so the unsigned teaching can be seen and signed even before the patient's
    // markers have been RAE-admitted under the exact required ids. Only the
    // teaching components (causal_model, analogy, register) need to clear BLOCK.
    const clinicianRenderable =
      admission.component_verdicts.causal_model !== "BLOCK" &&
      admission.component_verdicts.analogy !== "BLOCK" &&
      admission.component_verdicts.register !== "BLOCK";

    pmeVerdict = admission.verdict;
    pmeProvisional = runtimePme.provisional;
    const reviewFromVerdicts = Object.entries(admission.component_verdicts)
      .filter(([k, v]) => v === "ADMIT_WITH_REVIEW" && k !== "data_binding")
      .map(([k]) => k);
    pmeReviewFlags = reviewFromVerdicts.slice();
    if (mode === "clinician" && !allRequiredPresent) {
      const missing = required.filter((m) => !admittedMarkers.has(m));
      pmeReviewFlags.push(
        `data_binding pending (missing: ${missing.join(", ") || "—"})`,
      );
    }

    // Pick the register text: full cycle vs maintenance-only variant.
    if (action.id === "resistance_training_sarcopenia" && !cyclePresent) {
      pmeRegisterText =
        PME_VARIANTS.resistance_training_sarcopenia_muscle_only.register_text;
    } else {
      pmeRegisterText = runtimePme.register.text;
    }

    // Patient-facing safety policy: a provisional PME whose analogy is not
    // clinically signed off does NOT render in patient view. Clinicians always
    // see it (this is the review surface where sign-off happens).
    if (mode === "clinician") {
      pmeRenderable = clinicianRenderable;
      // Force verdict away from BLOCK in clinician preview so PMEBlock renders
      // the prose; data_binding pending is surfaced via reviewFlags.
      if (pmeVerdict === "BLOCK") pmeVerdict = "ADMIT_WITH_REVIEW";
    } else {
      const patientUnsafe =
        runtimePme.provisional || !runtimePme.analogy.signed_off_by;
      pmeRenderable = admission.renderable && !patientUnsafe;
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-4 min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Signal in your biology</div>
          <div className="text-sm text-foreground break-words">{lang.cause_patient}</div>
        </div>
        <Arrow dash={linkDash} />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Permits this move</div>
          <div className="text-sm font-semibold text-foreground break-words">{lang.intervention_patient}</div>
        </div>
        <Arrow dash="none" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Because this is expected</div>
          <div className="text-sm text-foreground break-words">{lang.effect_patient}</div>
        </div>
      </div>
      {/* PME teaching block — renders only when authored PME admits AND data
          binding is satisfied AND, in patient view, the analogy is signed off. */}
      <PMEBlock
        renderable={pmeRenderable}
        verdict={pmeVerdict}
        registerText={pmeRegisterText}
        provisional={pmeProvisional}
        reviewFlags={pmeReviewFlags}
        mode={mode === "clinician" ? "clinician" : "patient"}
      />
      <div className="mt-4 pt-3 border-t border-dashed border-border flex gap-3 flex-wrap items-center">
        {action.coordinates?.length ? (
          <span className="text-[11px] text-muted-foreground border border-border rounded-full px-2.5 py-0.5">
            {action.coordinates.map((c) => COORD_LABELS[c] || c).join(" · ")}
          </span>
        ) : null}
        {action.retest_weeks ? (
          <span className="text-[11px] text-muted-foreground border border-border rounded-full px-2.5 py-0.5">
            Check at week {action.retest_weeks}
          </span>
        ) : null}
        {mode === "clinician" && (
          <>
            <span className="text-[11px] text-emerald-700 border border-emerald-600/40 rounded-full px-2.5 py-0.5">
              {action.admission?.verdict} · {(action.admission?.provenance || []).join(", ") || "no provenance"}
            </span>
            {lang._provisional && (
              <span className="text-[10px] text-amber-700 italic">provisional language adapter</span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Arrow: React.FC<{ dash: string }> = ({ dash }) => (
  <svg width="40" height="18" viewBox="0 0 40 18" aria-hidden className="mx-auto rotate-90 sm:rotate-0">
    <line x1="2" y1="9" x2="32" y2="9" stroke="currentColor" strokeWidth="2" strokeDasharray={dash} className="text-muted-foreground/60" />
    <polygon points="28,4 36,9 28,14" fill="currentColor" className="text-muted-foreground/60" />
  </svg>
);

// ── Clinician Admission Ledger (full audit, clinician-only) ──
const ClinicianLedger: React.FC<{ ledger: AaeLedger | null }> = ({ ledger }) => {
  if (!ledger) return <div className="text-sm text-muted-foreground">No AAE ledger row for this twin.</div>;
  const cells: Array<{ label: string; n?: number; sub?: string; tone?: string }> = [
    { label: "Selected", n: ledger.selected_count },
    { label: "Dropped upstream", n: ledger.dropped_upstream, sub: "dose backstop" },
    { label: "Reached AAE", n: ledger.reached_aae },
    { label: "Blocked", n: ledger.blocked_by_aae, tone: "text-[#b06a4f]" },
    { label: "Admitted", n: ledger.admitted, tone: "text-emerald-700" },
  ];
  return (
    <>
      <div className="flex gap-2 flex-wrap rounded-lg border border-border bg-card p-4 mb-2">
        {cells.map((c) => (
          <div key={c.label} className="text-center flex-1 min-w-[88px]">
            <div className={`font-serif text-2xl ${c.tone || "text-foreground"}`}>{c.n ?? "—"}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
            {c.sub && <div className="text-[9px] italic text-muted-foreground">{c.sub}</div>}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Total attrition {Math.round((ledger.total_attrition_ratio ?? 0) * 100)}% (selected → plan) · AAE
        emptiness {Math.round((ledger.aae_emptiness_ratio ?? 0) * 100)}% (over edges AAE saw).
      </p>
      {(ledger.blocked_edges || []).length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Blocked edges (withheld from patient)</div>
          {(ledger.blocked_edges || []).map((id) => (
            <div key={id} className="rounded-lg border border-border border-l-[3px] border-l-[#b06a4f] bg-card p-3">
              <div className="font-mono text-[13px] text-foreground">{id}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Human-authored only, no independent evidence class — withheld (anti-RAE-theater).
              </div>
              <div className="text-xs text-emerald-700 mt-1">
                → Add a literature / mechanistic / population / twin / provider provenance record to admit.
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default CareMapSection;
