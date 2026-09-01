// BioTwin Release Compiler v1 — Subject-01 Golden Fixture
// Run with:
//   deno test --allow-read supabase/functions/_shared/biotwin/releaseCompiler.test.ts

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { compileRuntimeTwinV18, RELEASE_COMPILER_VERSION, type JsonObject } from "./releaseCompiler.ts";
import { detectBiotwinReport, validateBiotwinStructure, hasBlockingDiagnostic } from "./detect.ts";
import { adaptBiotwinReport } from "./adapter.ts";

const fullDecision = JSON.parse(
  await Deno.readTextFile(new URL("./__fixtures__/synthetic_v18_founder_release_decision.json", import.meta.url)),
) as Record<string, unknown>;

// Compact release-facing projection of the frozen Subject-01 v18 source. This is
// not a second Twin: every scientific assertion below is copied from the v18
// canonical claim layer. The compiler is forbidden from reading arbitrary
// legacy narrative roots.
const syntheticSource: JsonObject = {
  artifactType: "RUNTIME_TWIN_FINAL",
  subject: "VZSYN0001",
  generatedAt: "2026-08-07",
  twinVersion: "v18.1-final",
  observations: {
    canonicalClaims: {
      "CLM-PT-APOB-001": {
        claimId: "CLM-PT-APOB-001",
        currentState: "MEASURED",
        canonicalStatement: "Subject-01's atherogenic particle burden is measured clinically and corroborated by abundance signals on two proteomic technologies. Clinical ApoB 124 mg/dL (ref <90, HIGH; Quest/Function Health panel 2026-02-20) and ApoB 118 mg/dL (2026-04-02, statin OFF, PCP flowsheet) are BOTH retained as dated observations. Supporting particle measures: LDL-P 1574 nmol/L (ref <1138), LDL-C 163 mg/dL, non-HDL-C 188 mg/dL, LDL-small 242, LDL peak size 220.9 A (ref >222.9, LOW).",
        claimCeiling: { text: "A chronic, measured, ongoing atherogenic particle burden. The ETIOLOGIC DECOMPOSITION is not claimable: no fraction of the clinical ApoB may be attributed to APOE, polygenic burden, diet or smoking." },
        cannotProve: { text: "What fraction of the ApoB value is caused by APOE, polygenic burden, diet or smoking; that a low CAC offsets the particle burden." },
        evidenceRole: "SUSCEPTIBILITY_WITNESS",
        coverageBound: "PARTIAL",
        nextMeasurementThatCouldChangeThis: "Governed WGS with LDL-PRS plus LDLR/APOB/PCSK9 coverage; repeat ApoB on a standardized fasting draw with documented statin state.",
        evidenceIds: ["labs_apoB", "labs_LDLP"],
      },
      "CLM-PT-SLEEP-001": {
        claimId: "CLM-PT-SLEEP-001",
        currentState: "MEASURED",
        canonicalStatement: "Subject-01's measured sleep is ADEQUATE over the measured windows. The ONLY canonical aggregate is Oura device-exact: 14 included main-sleep nights, mean TST 9.06 h, mean efficiency 88.4%, mean HRV 47.8 ms, with 12 fragment records excluded via include_in_aggregate=False. The Fitbit OCR provisional tier is held SEPARATELY: 28 included nights, mean TST 7.11 h. The tiers have different provenance and are NEVER pooled.",
        claimCeiling: { text: "Adequate measured duration and efficiency over the measured Oura window. Sleep may NOT be described as a deficit or as short, may NOT be presented as a driver or explanation for cortisol, ED, vascular injury, biological aging or glycemic variability." },
        cannotProve: { text: "That sleep architecture is normal; that apnea, parasomnia or medication effects are excluded; any sleep-driven mechanism for cortisol, ED, vascular injury or aging." },
        evidenceRole: "RESPONSE_MARKER",
        coverageBound: "EXACT",
        nextMeasurementThatCouldChangeThis: "A symptom-driven, DE NOVO sleep hypothesis with a standardized instrument if symptoms warrant — never by reopening the invalidated deficit baseline.",
        evidenceIds: ["sensor_sleep"],
        prohibitedPhrasings: {
          retractedValues: { tst_hours: 5.01, efficiency_pct: 65.8, roundedFormsAlsoSeenLive: ["5.0 h", "5h", "66%", "5 h sleep"] },
          phrases: ["sleeping five hours", "chronic short sleep", "severe sleep deficit", "chronic sleep strain", "sleep/autonomic strain", "sleep is the single highest-yield lever", "CBT-I as a required intervention", "stimulant-sleep feedback loop premised on short sleep"],
        },
      },
      "CLM-PT-CLOCKDISC-001": {
        claimId: "CLM-PT-CLOCKDISC-001",
        currentState: "DERIVED_REPORTED_OUTPUT",
        canonicalStatement: "Subject-01's epigenetic clocks disagree, and the disagreement is INFORMATION rather than internal inconsistency, because each clock estimates a DIFFERENT trained construct. Horvath353 47.15 (~+3.15 y versus chronological 44); SkinBlood 41.95 (~-2.05 y); PhenoAge 34.09 (~-9.91 y); DunedinPACE 0.95; Hannum ABSTAINED because 7 of 71 required high-weight CpGs are absent on EPICv2.",
        claimCeiling: { text: "Clock-specific discordance, NOT one biological age. The clocks may NEVER be averaged into a single age. Hannum renders as unavailable, NEVER as zero. DunedinPACE from a single measurement is NOT Subject-01's directly observed aging trajectory." },
        cannotProve: { text: "A single biological age; a patient-local aging rate from one draw." },
        evidenceRole: "COMPATIBLE",
        coverageBound: "EXACT",
        nextMeasurementThatCouldChangeThis: "A second methylation timepoint enabling within-person clock deltas.",
        evidenceIds: [],
        prohibitedPhrasings: { phrases: ["favorable clocks are real", "aging slowly", "pace normal-to-slow", "genuine resilience", "the biology still responds"] },
      },
      "CLM-PT-IRON-001": {
        claimId: "CLM-PT-IRON-001",
        currentState: "HYPOTHESIS",
        canonicalStatement: "Subject-01 has an ABNORMAL single-timepoint iron study requiring standardized confirmation: serum iron 266 mcg/dL (ref 50-170, OUT), iron saturation 78% (ref 20-48, OUT), iron binding capacity 341 mcg/dL (ref 250-425), ferritin 61 ng/mL (ref 38-380, within range) — one study. A within-sample proteomic HAMP rank is not a clinical hepcidin concentration, and no clinical hepcidin assay has been performed.",
        claimCeiling: { text: "An abnormal serum iron/transferrin-saturation result requiring standardized repeat testing. PERSISTENCE, TISSUE IRON ACCUMULATION, hepatic injury from iron, and HFE/non-HFE etiology are NOT established. No treatment implication follows from the current data." },
        evidenceRole: "COMPATIBLE",
        coverageBound: "EXACT",
        nextMeasurementThatCouldChangeThis: "Standardized morning fasting iron, TIBC or transferrin, repeat TSAT and ferritin with contemporaneous clinical context and governed HFE calls.",
        evidenceIds: ["labs_iron"],
      },
      "CLM-PT-APOE-FH-WGS-001": {
        claimId: "CLM-PT-APOE-FH-WGS-001",
        currentState: "RAW_GAP",
        canonicalStatement: "Subject-01's genomic layer is ARRAY GENOTYPING plus PGx diplotypes only. WGS 30X is PENDING. APOE: rs429358 heterozygosity is supported; rs7412 is not present in the ALT-only variant call list, so reference is INFERRED and per-site depth is NOT confirmed — the diplotype call therefore remains depth-unresolved. Monogenic-FH evaluation is INCOMPLETE: LDLR, APOB and PCSK9 coverage plus relevant CNV/SV coverage have not been demonstrated.",
        claimCeiling: { text: "APOE may be named as a possible genetic contributor ONLY if the complete diplotype is source-verified. It is NOT a per-patient causal measurement. No APOE-attributable ApoB fraction may be quantified. A complete negative monogenic-FH evaluation may NOT be declared. Alzheimer's-risk disclosure remains governance-gated." },
        cannotProve: { text: "That APOE causes a quantified fraction of Subject-01's ApoB; that monogenic FH is excluded; that rs7412 is reference; any Alzheimer's risk statement." },
        evidenceRole: "SUSCEPTIBILITY_WITNESS",
        coverageBound: "ABSENT",
        nextMeasurementThatCouldChangeThis: "Complete governed WGS 30X with per-site depth/QC for rs429358 and rs7412, demonstrated LDLR/APOB/PCSK9 SNV and CNV/SV coverage, and a governed LDL-PRS.",
        evidenceIds: [],
        prohibitedPhrasings: { phrases: ["APOE e3/e4 exact", "e3/e4 exact", "genetic driver", "APOE-driven ApoB axis", "APOE attribution EXACT", "genotype supplies the constitutional why", "rs7412 reference therefore e3/e4"] },
      },
    },
    clinicalReveal: {
      coreThesis: "Subject-01 has a strong glycemic, body-composition and measured sleep phenotype alongside a persistent atherogenic-particle burden and several vascular-injury-associated protein signals. His low CAC and low hs-CRP do not erase that substrate, but the clinical activity and causal sources of the molecular signals remain incompletely typed.",
      whatIsMeasured: [
        { item: "Clinical lipid burden", claimId: "CLM-PT-APOB-001" },
        { item: "Corrected sleep metrics", claimId: "CLM-PT-SLEEP-001" },
        { item: "Current biological-clock outputs", claimId: "CLM-PT-CLOCKDISC-001" },
      ],
      whatIsInferred: [
        { item: "Possible genetic contribution", claimId: "CLM-PT-APOE-FH-WGS-001" },
      ],
      whatIsNotYetKnown: [
        { item: "Tissue iron accumulation", claimId: "CLM-PT-IRON-001" },
        { item: "Monogenic versus polygenic contribution", claimId: "CLM-PT-APOE-FH-WGS-001" },
      ],
    },
    driverHierarchy: [
      { rank: 1, driver: "Measured atherogenic particle burden of unquantified etiology", claimIds: ["CLM-PT-APOB-001"] },
      { rank: 5, driver: "One abnormal iron study of unestablished persistence and etiology", claimIds: ["CLM-PT-IRON-001"] },
      { rank: 6, driver: "Measured sleep strength", claimIds: ["CLM-PT-SLEEP-001"] },
    ],
    measurementPlan: { queue: [
      { rank: 1, id: "MP-01", measurement: "Delivery and governed ingestion of the pending WGS 30X export", measurement_class: "already commissioned, awaiting delivery", is_action: false },
      { rank: 3, id: "MP-03", measurement: "Repeat fasting iron panel plus a clinical-grade hepcidin immunoassay", measurement_class: "venous draw", is_action: false },
      { rank: 6, id: "MP-06", measurement: "Device-exact wearable sleep capture across a contiguous window", measurement_class: "sensor", is_action: false },
    ] },
    contradictions: [
      { id: "CTR-PT-C01", tension: "Atherogenic particle burden vs near-zero calcified plaque", state: "HELD", claimIds: ["CLM-PT-APOB-001"], omics_update: "ApoB is measured while CAC 1.5 quantifies calcified plaque only; both observations remain held without collapsing one into the other." },
      { id: "CTR-PT-C08", tension: "Iron 266 / TSAT 78% vs ferritin 61 (normal)", state: "HELD", claimIds: ["CLM-PT-IRON-001"], omics_update: "A standardized repeat fasting iron panel and governed HFE calls are the discriminating tests; tissue loading is not established." },
    ],
    releaseClass: { class: "R1_GOVERNED_RESEARCH_DRAFT", R2_clinician_review: "BLOCKED", R3_individual_reveal: "BLOCKED" },
  },
};

function goldenDecision() {
  const d = structuredClone(fullDecision) as Record<string, unknown>;
  const ids = ["CLM-PT-APOB-001", "CLM-PT-SLEEP-001", "CLM-PT-CLOCKDISC-001", "CLM-PT-IRON-001", "CLM-PT-APOE-FH-WGS-001"];
  d.released_claim_ids = ids;
  d.critical_anchor_review = (d.critical_anchor_review as Array<Record<string, unknown>>).filter((r) => ids.includes(String(r.claim_id)));
  d.measurement_plan_ids = ["MP-01", "MP-03", "MP-06"];
  d.contradiction_ids = ["CTR-PT-C01", "CTR-PT-C08"];
  return d;
}

Deno.test("Subject-01 v18 Golden Fixture compiles deterministically", () => {
  const d = goldenDecision();
  // deno-lint-ignore no-explicit-any
  const a = compileRuntimeTwinV18(structuredClone(syntheticSource), d as any);
  // deno-lint-ignore no-explicit-any
  const b = compileRuntimeTwinV18(structuredClone(syntheticSource), structuredClone(d) as any);
  assert(a.ok && b.ok);
  assertEquals(a.report, b.report);
  assertEquals(a.stats.released_claims, 5);
  assertEquals(a.stats.confirmed, 3);
  assertEquals(a.stats.candidate, 1);
  assertEquals(a.stats.unknown, 1);
  assertEquals(a.stats.drivers, 3);
  assertEquals(a.stats.measurements, 3);
  assertEquals(a.stats.contradictions, 2);
});

Deno.test("compiled Subject-01 report is accepted by the existing Release-0 importer contract", () => {
  // deno-lint-ignore no-explicit-any
  const res = compileRuntimeTwinV18(structuredClone(syntheticSource), goldenDecision() as any);
  assert(res.ok && res.report);
  assert(detectBiotwinReport(res.report).accepted);
  const structural = validateBiotwinStructure(res.report);
  assertEquals(hasBlockingDiagnostic(structural), false);
  const adapted = adaptBiotwinReport(res.report);
  assertEquals(adapted.report.patient_release_permitted, true);
  assertEquals(adapted.report.clinician_review_required, false);
  assert(adapted.report.holds.includes("medication_hold"));
  assert(adapted.report.holds.includes("pgx_hold"));
  assert(adapted.report.holds.includes("decision_grade_hold"));
  assertEquals(adapted.report.holds.includes("patient_release_hold"), false);
});

Deno.test("canonical truth outranks clinicalReveal: clocks stay DERIVED_REPORTED_OUTPUT", () => {
  // deno-lint-ignore no-explicit-any
  const res = compileRuntimeTwinV18(structuredClone(syntheticSource), goldenDecision() as any);
  assert(res.ok && res.report);
  const cs = res.report.clinical_state as Record<string, unknown>;
  const rows = cs.confirmed_measurements_and_bounded_findings as Array<Record<string, unknown>>;
  const clock = rows.find((r) => r.finding_id === "CLM-PT-CLOCKDISC-001");
  assert(clock);
  assertEquals(clock.status, "DERIVED_REPORTED_OUTPUT");
  assertEquals(clock.source_truth_class, "DERIVED_REPORTED_OUTPUT");
  assert((clock.important_bounds as string[]).some((b) => b.includes("not a direct measurement")));
});

Deno.test("old Subject-01 sleep scar is prohibition-only, never a renderable assertion", () => {
  // deno-lint-ignore no-explicit-any
  const res = compileRuntimeTwinV18(structuredClone(syntheticSource), goldenDecision() as any);
  assert(res.ok && res.report);
  const s = JSON.stringify(res.report);
  const projection = res.report.clinical_report_projection as Record<string, unknown>;
  const prohibited = projection.prohibited_headline_statements as string[];
  assert(prohibited.includes("5.01 h TST"));
  assert(prohibited.includes("65.8% efficiency"));
  const cs = res.report.clinical_state as Record<string, unknown>;
  const rendered = JSON.stringify({
    executive_synthesis: res.report.executive_synthesis,
    confirmed: cs.confirmed_measurements_and_bounded_findings,
    candidate: cs.candidate_or_unverified_signals,
    unknown: cs.open_screening_findings,
    drivers: res.report.repaired_driver_hierarchy,
  }).toLowerCase();
  assertEquals(rendered.includes("5.01 h tst"), false);
  assertEquals(rendered.includes("65.8% efficiency"), false);
  assert(s.includes("5.01 h TST")); // present only as an explicit prohibition/repair guard
});

Deno.test("identity mismatch is a hard failure", () => {
  const d = goldenDecision();
  (d.subject as Record<string, unknown>).twin_id = "VZ-WRONG";
  // deno-lint-ignore no-explicit-any
  const res = compileRuntimeTwinV18(structuredClone(syntheticSource), d as any);
  assertEquals(res.ok, false);
  assert(res.diagnostics.some((x) => x.code === "identity_mismatch"));
});

Deno.test("a rejected released claim cannot cross", () => {
  const d = goldenDecision();
  const reviews = d.critical_anchor_review as Array<Record<string, unknown>>;
  reviews.find((r) => r.claim_id === "CLM-PT-APOB-001")!.status = "REJECT";
  // deno-lint-ignore no-explicit-any
  const res = compileRuntimeTwinV18(structuredClone(syntheticSource), d as any);
  assertEquals(res.ok, false);
  assert(res.diagnostics.some((x) => x.code === "critical_anchor_not_released"));
});

Deno.test("Founding Cohort decision cannot elevate clinical authority", () => {
  for (const key of ["decision_grade_multiomic_use", "autonomous_medication_action", "pgx_dose_action"]) {
    const d = goldenDecision();
    (d.release as Record<string, unknown>)[key] = true;
    // deno-lint-ignore no-explicit-any
    const res = compileRuntimeTwinV18(structuredClone(syntheticSource), d as any);
    assertEquals(res.ok, false);
    assert(res.diagnostics.some((x) => x.code === "authority_violation"));
  }
});

Deno.test("injected retired sleep prose is blocked from release", () => {
  const src = structuredClone(syntheticSource);
  const obs = src.observations as Record<string, unknown>;
  const claims = obs.canonicalClaims as Record<string, Record<string, unknown>>;
  claims["CLM-PT-SLEEP-001"].canonicalStatement = "Subject-01 has chronic short sleep.";
  // deno-lint-ignore no-explicit-any
  const res = compileRuntimeTwinV18(src, goldenDecision() as any);
  assertEquals(res.ok, false);
  assert(res.diagnostics.some((x) => x.code === "prohibited_text_leak"));
});

Deno.test("measurement plan is recommendation-only", () => {
  const src = structuredClone(syntheticSource);
  const obs = src.observations as Record<string, unknown>;
  const plan = obs.measurementPlan as Record<string, unknown>;
  (plan.queue as Array<Record<string, unknown>>)[0].is_action = true;
  // deno-lint-ignore no-explicit-any
  const res = compileRuntimeTwinV18(src, goldenDecision() as any);
  assertEquals(res.ok, false);
  assert(res.diagnostics.some((x) => x.code === "measurement_plan_action_violation"));
});

Deno.test("compiler version is frozen", () => {
  assertEquals(RELEASE_COMPILER_VERSION, "biotwin_release_compiler_v1");
});
