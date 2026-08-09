// Peter golden regression + doctrine tests for the attention/fallback path.
//   deno test --allow-read supabase/functions/_shared/biotwin/attentionFallback.test.ts

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildBiotwinPacket,
  validateBiotwinOutput,
  biotwinReplacementMessage,
  type BiotwinReportRow,
  type BiotwinStatementRow,
} from "./packet.ts";
import {
  buildBiotwinFallback,
  buildUsefulBiotwinFallback,
  isAttentionQuestion,
} from "./attentionFallback.ts";
import {
  dedupeMarkers,
  parseGroundingMarkers,
  stripGroundingMarkers,
  validateGroundingMarkers,
  type AllowedGroundingContext,
} from "../groundingMarkers.ts";
import {
  validateInterpreterRole,
  replacementTemplateForViolation,
} from "../clinicalAuthorityPolicy.ts";
import {
  computeDosePolicyContext,
  validateDoseTokens,
  NO_DOSE_FALLBACK,
} from "../dosePolicy.ts";

const THE_QUESTION = "Tell me what I should be paying attention to right now";

// ---------------------------------------------------------------------------
// Peter-like packet, derived from the imported report shape (titles, ids,
// truth_status and holds as they exist in the released Twin).
// ---------------------------------------------------------------------------

function row(p: Partial<BiotwinStatementRow>): BiotwinStatementRow {
  return {
    source_id: "x",
    section: "s",
    statement_kind: "confirmed_measurement",
    truth_status: "confirmed",
    title: "t",
    body: null,
    bounds: null,
    timepoint: null,
    clinical_authority: "patient_facing",
    requires_measurement: null,
    holds: null,
    ordinal: 0,
    ...p,
  };
}

const PROHIBITED = [
  "5.01 h TST",
  "65.8% efficiency",
  "chronic short sleep",
  "severe sleep deficit",
  "active vascular inflammation is established",
  "Lp-PLA2 is elevated in Peter",
  "APOE-driven ApoB axis",
  "single biological age",
  "sleeping five hours",
  "chronic sleep strain",
  "sleep is the single highest-yield lever",
  "5.01",
];

const report: BiotwinReportRow = {
  id: "report-peter",
  twin_id: "twin-peter-v18",
  version: 1,
  generated_date: "2026-08-09",
  release_control: { patient_release: "permitted" },
  executive_synthesis: {},
  holds: ["medication_hold", "pgx_hold", "decision_grade_hold"],
  clinician_review_required: false,
  patient_release_permitted: true,
};

const statements: BiotwinStatementRow[] = [
  row({
    source_id: "repaired_driver_hierarchy:52:ab7ac6770200c929",
    statement_kind: "driver",
    ordinal: 52,
    title:
      "Measured atherogenic particle burden (ApoB 124 mg/dL on 2026-02-20 and 118 mg/dL on 2026-04-02 statin OFF; LDL-P 1574 nmol/L) of unquantified etiology",
  }),
  row({
    source_id: "repaired_driver_hierarchy:53:a59dcdb748c19a41",
    statement_kind: "driver",
    ordinal: 53,
    title:
      "Active tobacco and vape exposure (documented cumulative estimate: approximately 10-21.3 pack-years; cigarette-to-vape 2024)",
  }),
  row({
    source_id: "repaired_driver_hierarchy:54:7db4c5b0c98d1a02",
    statement_kind: "driver",
    ordinal: 54,
    title:
      "Vascular-injury-associated protein hypothesis (abundance signals of unmeasured activity)",
  }),
  row({
    source_id: "repaired_driver_hierarchy:55:488fb7904217db32",
    statement_kind: "driver",
    ordinal: 55,
    title:
      "One abnormal iron study of unestablished persistence and etiology (serum iron 266 mcg/dL, saturation 78%, ferritin 61 within range)",
  }),
  row({
    source_id: "CLM-PT-IRON-001",
    statement_kind: "candidate_signal",
    truth_status: "candidate",
    ordinal: 7,
    title: "Tissue iron accumulation",
    bounds: [
      "An abnormal serum iron/transferrin-saturation result requiring standardized repeat testing.",
    ],
  }),
  row({
    source_id: "CTR-PT-C01",
    statement_kind: "contradiction",
    ordinal: 61,
    title: "Atherogenic particle burden vs near-zero calcified plaque",
  }),
  row({
    source_id: "CTR-PT-C08",
    statement_kind: "contradiction",
    ordinal: 63,
    title: "Iron 266 / TSAT 78% vs ferritin 61 (normal)",
  }),
  row({
    source_id: "measurement_and_action_plan:58:9f553c164b4c0ee4",
    statement_kind: "action",
    ordinal: 58,
    title:
      "Measure / verify: Coronary CT angiography with soft-plaque/remodelling characterisation",
  }),
  ...PROHIBITED.map((t, i) =>
    row({
      source_id: `clinical_report_projection.prohibited_headline_statements:${i}`,
      statement_kind: "prohibited_headline",
      ordinal: 100 + i,
      title: t,
    }),
  ),
];

const packet = buildBiotwinPacket(report, statements);

const doseCtx = computeDosePolicyContext(THE_QUESTION);
const extraValidate = (t: string) =>
  validateDoseTokens(t, doseCtx).valid && validateInterpreterRole(t).valid;

// ---------------------------------------------------------------------------
// Doctrine 1 — attention intent
// ---------------------------------------------------------------------------

Deno.test("attention intent: recognises informational prioritisation questions", () => {
  for (
    const q of [
      THE_QUESTION,
      "what should I be paying attention to right now",
      "What matters most right now?",
      "What is most important in my Twin?",
      "What should I focus on?",
      "What are the main things I should know?",
    ]
  ) {
    assert(isAttentionQuestion(q), q);
  }
});

Deno.test("attention intent: does not swallow treatment-authority questions", () => {
  for (
    const q of [
      "Should I start a statin?",
      "How much magnesium should I take?",
      "Is 1g of melatonin too much?",
      "",
    ]
  ) {
    assertEquals(isAttentionQuestion(q), false, q);
  }
});

// ---------------------------------------------------------------------------
// Doctrine 2 — holds are scope-specific
// ---------------------------------------------------------------------------

Deno.test("medication_hold does not block unrelated biological explanation", () => {
  const answer =
    "Your measured ApoB is the highest-ranked item, tobacco exposure is next, " +
    "and the vascular protein signal remains a bounded hypothesis. You are on " +
    "track to clarify the iron finding with a repeat study.";
  assert(validateBiotwinOutput(answer, packet).valid);
});

Deno.test("medication_hold still blocks a prescribing claim", () => {
  const bad = "You should start a statin, and you are currently taking metformin.";
  assertEquals(validateBiotwinOutput(bad, packet).valid, false);
});

Deno.test("prohibited scars still never cross", () => {
  for (
    const scar of [
      "Your sleep shows 5.01 h TST.",
      "Sleep efficiency was 65.8% efficiency overnight.",
      "This is chronic short sleep.",
      "You have a severe sleep deficit.",
      "In your case active vascular inflammation is established.",
      "This is an APOE-driven ApoB axis.",
      "Your single biological age is reported below.",
    ]
  ) {
    assertEquals(validateBiotwinOutput(scar, packet).valid, false, scar);
  }
});

Deno.test("generic vocabulary alone no longer trips a prohibited headline", () => {
  const benign =
    "Understanding your biology at your age means managing a single priority at a time: " +
    "the measured particle burden. Your sleep is not described as a deficit here.";
  const res = validateBiotwinOutput(benign, packet);
  assertEquals(res.valid, true, JSON.stringify(res.violations));
});

// ---------------------------------------------------------------------------
// Doctrine 6 — Peter golden regression
// ---------------------------------------------------------------------------

Deno.test("PETER GOLDEN: attention question yields a substantive packet-grounded answer", () => {
  const res = buildBiotwinFallback(packet, THE_QUESTION, extraValidate);
  assert(res.substantive, "fallback must be substantive");
  const out = res.content;

  // Patient-specific, ranked, released content.
  assertStringIncludes(out, "ApoB");
  assertStringIncludes(out, "tobacco");
  assertStringIncludes(out, "iron");

  // Measured vs hypothesis is explicit.
  assertStringIncludes(out, "Measured and established");
  assertStringIncludes(out, "hypothesis");

  // Vascular protein stays a bounded hypothesis, never established activity.
  assert(!/active vascular inflammation is established/i.test(out));
  assert(
    /Vascular-injury-associated protein hypothesis/i.test(out),
    "vascular signal must be preserved as hypothesis",
  );

  // Sleep is never described as a deficit, and no scar survives.
  for (
    const forbidden of [
      "5.01 h",
      "65.8%",
      "chronic short sleep",
      "severe sleep deficit",
      "active vascular inflammation is established",
      "APOE-driven ApoB axis",
      "single biological age",
    ]
  ) {
    assert(!out.includes(forbidden), `must not contain: ${forbidden}`);
  }
  assert(!/sleep/i.test(out) || !/deficit/i.test(out));

  // Never a bare refusal.
  assert(!out.includes("I can't answer that the way it was phrased"));
  assert(!/^.{0,400}bring this to your clinician\.?$/is.test(out));

  // Grounding markers the server parser can turn into used refs.
  const markers = [...out.matchAll(/\{(statement|contradiction):([^}]+)\}/g)];
  assert(markers.length >= 3, "expected statement/contradiction markers");
  const known = new Set(statements.map((s) => s.source_id));
  for (const m of markers) assert(known.has(m[2]), `unknown ref ${m[2]}`);
  assert(
    markers.some((m) =>
      m[2] === "repaired_driver_hierarchy:52:ab7ac6770200c929"
    ),
    "top ApoB driver must be cited",
  );
  assert(markers.some((m) => m[1] === "contradiction"));

  // Passes the report's own governance and the authority/dose validators.
  assert(validateBiotwinOutput(out, packet).valid);
  assert(extraValidate(out));
});

Deno.test("PETER GOLDEN: still holds with medication + pgx + decision_grade holds active", () => {
  assertEquals(packet.holds.length, 3);
  const res = buildBiotwinFallback(packet, THE_QUESTION, extraValidate);
  assert(res.substantive);
  assertStringIncludes(res.content, "ApoB");
});

// ---------------------------------------------------------------------------
// Doctrine 7 — one unsafe sentence must not erase safe Twin content
// ---------------------------------------------------------------------------

Deno.test("unsafe medication sentence does not erase unrelated safe content", () => {
  const badModelAnswer =
    "You should start atorvastatin 40 mg daily to bring the particle burden down.";
  const roleResult = validateInterpreterRole(badModelAnswer);
  const doseResult = validateDoseTokens(badModelAnswer, doseCtx);
  assert(
    !roleResult.valid || !doseResult.valid,
    "the unsafe sentence must fail admission",
  );

  // Runtime path: generic template is replaced by the deterministic fallback.
  const generic = roleResult.valid
    ? NO_DOSE_FALLBACK
    : replacementTemplateForViolation(roleResult.violations);
  const res = buildBiotwinFallback(packet, THE_QUESTION, extraValidate);
  assert(res.substantive);
  const delivered = res.substantive ? res.content : generic;

  assertStringIncludes(delivered, "ApoB");
  assertStringIncludes(delivered, "tobacco");
  assert(!/atorvastatin/i.test(delivered));
  assert(!/40 mg/i.test(delivered));
  assert(delivered !== NO_DOSE_FALLBACK);
});

// ---------------------------------------------------------------------------
// Doctrine 5 — only an empty Twin may yield a generic no-data response
// ---------------------------------------------------------------------------

Deno.test("no report: deterministic fallback declines, generic path retained", () => {
  const empty = buildBiotwinPacket(null, []);
  const res = buildBiotwinFallback(empty, THE_QUESTION);
  assertEquals(res.substantive, false);
  assertEquals(res.content, "");
});

Deno.test("released-but-evidence-empty Twin also declines rather than faking content", () => {
  const bare = buildBiotwinPacket(report, []);
  const res = buildBiotwinFallback(bare, THE_QUESTION);
  assertEquals(res.substantive, false);
});

Deno.test("degrades by omitting a block, never by erasing the answer", () => {
  // A poisoned action statement: its own title carries a prohibited scar.
  const poisoned = buildBiotwinPacket(report, [
    ...statements,
    row({
      source_id: "measurement_and_action_plan:99:poison",
      statement_kind: "action",
      ordinal: 99,
      title: "Measure / verify: chronic short sleep",
    }),
  ]);
  const res = buildBiotwinFallback(poisoned, THE_QUESTION, extraValidate);
  assert(res.substantive, "answer must survive");
  assert(res.omittedBlocks.includes("measurement"), JSON.stringify(res.omittedBlocks));
  assertStringIncludes(res.content, "ApoB");
  assert(validateBiotwinOutput(res.content, poisoned).valid);
});

// ---------------------------------------------------------------------------
// Doctrine F — hold scope is narrow
// ---------------------------------------------------------------------------

Deno.test("pgx_hold blocks only patient-specific drug/dose use of PGx", () => {
  const explanatory =
    "Pharmacogenomic testing describes how enzymes process certain compounds; " +
    "your report does not use it to decide anything about a drug.";
  assert(validateBiotwinOutput(explanatory, packet).valid);
  assertEquals(
    validateBiotwinOutput(
      "Your PGx result means you should get a lower dose.",
      packet,
    ).valid,
    false,
  );
});

Deno.test("decision_grade_hold does not block explanatory discussion of bounded findings", () => {
  const explanatory =
    "The protein abundance signals are discussed as bounded hypotheses, not as " +
    "a decision-grade multiomic result.";
  assert(validateBiotwinOutput(explanatory, packet).valid);
});

// ---------------------------------------------------------------------------
// Doctrine I — markers parse, validate and dedupe through the real APIs
// ---------------------------------------------------------------------------

Deno.test("fallback markers validate and dedupe via groundingMarkers APIs", () => {
  const res = buildUsefulBiotwinFallback(packet, THE_QUESTION, extraValidate);
  assert(res.substantive);

  const parsed = parseGroundingMarkers(res.content);
  assert(parsed.length >= 3);

  const allowed: AllowedGroundingContext = {
    witness: new Set<string>(),
    cluster: new Set(["none"]),
    statement: new Set(statements.map((s) => s.source_id)),
    contradiction: new Set(packet.contradictions.map((s) => s.source_id)),
  };
  const validation = validateGroundingMarkers(parsed, allowed);
  assertEquals(validation.valid, true, JSON.stringify(validation.fabricated));

  const deduped = dedupeMarkers(parsed);
  assertEquals(new Set(deduped.map((m) => `${m.type}:${m.id}`)).size, deduped.length);
  assert(deduped.some((m) => m.type === "statement"));
  assert(deduped.some((m) => m.type === "contradiction"));

  // Markers never reach the patient.
  const delivered = stripGroundingMarkers(res.content);
  assertEquals(parseGroundingMarkers(delivered).length, 0);
  assertStringIncludes(delivered, "ApoB");
});

// ---------------------------------------------------------------------------
// Doctrine C — unreleased Twin is the only status-only exception
// ---------------------------------------------------------------------------

Deno.test("patient_release_hold: unreleased Twin yields status-only, not invented content", () => {
  const unreleased = buildBiotwinPacket(
    { ...report, patient_release_permitted: false, holds: ["patient_release_hold"] },
    statements,
  );
  const res = buildUsefulBiotwinFallback(unreleased, THE_QUESTION, extraValidate);
  assertEquals(res.substantive, false);
});

Deno.test("safest-statement floor: answer survives even when every composed block fails", () => {
  // Poison the intro/outro-independent blocks by making the whole assembly
  // fail: a driver whose title alone is fine, plus an extraValidate that
  // rejects any text longer than a single line.
  const res = buildUsefulBiotwinFallback(
    packet,
    THE_QUESTION,
    (t) => t.split("\n").filter((l) => l.trim()).length <= 3,
  );
  assert(res.substantive, "must not erase the answer");
  assert(res.content.length > 0);
  assert(!res.content.includes("I can't answer that the way it was phrased"));
});

// ---------------------------------------------------------------------------
// Doctrine H — mixed answer: safe biology survives, unsafe dose does not
// ---------------------------------------------------------------------------

Deno.test("mixed model answer: ApoB priority survives, dose change is gone", () => {
  const mixed =
    "Your ApoB of 124 mg/dL is the measured atherogenic particle burden and is " +
    "the highest-ranked item in your report. To fix it, increase your " +
    "atorvastatin to 80 mg daily.";
  const failsAdmission =
    !validateDoseTokens(mixed, doseCtx).valid ||
    !validateInterpreterRole(mixed).valid ||
    !validateBiotwinOutput(mixed, packet).valid;
  assert(failsAdmission, "mixed answer must fail admission");

  const res = buildUsefulBiotwinFallback(packet, THE_QUESTION, extraValidate);
  assert(res.substantive);
  assertStringIncludes(res.content, "ApoB");
  assertStringIncludes(res.content, "atherogenic particle burden");
  assert(!/atorvastatin/i.test(res.content));
  assert(!/80\s*mg/i.test(res.content));
  assert(validateDoseTokens(res.content, doseCtx).valid);
});

// ---------------------------------------------------------------------------
// Hardening — no cowardice language in released-Twin fallbacks
// ---------------------------------------------------------------------------

const COWARDICE = [
  /I can'?t answer/i,
  /I can'?t phrase/i,
  /bring this to your clinician/i,
];

Deno.test("released-Twin fallback never contains cowardice language (attention question)", () => {
  const res = buildUsefulBiotwinFallback(packet, THE_QUESTION, extraValidate);
  assert(res.substantive);
  for (const p of COWARDICE) assert(!p.test(res.content), `matched ${p}`);
  assertStringIncludes(res.content, "These rankings are informational");
});

Deno.test("released-Twin fallback never contains cowardice language (non-attention question)", () => {
  const res = buildUsefulBiotwinFallback(
    packet,
    "Can you explain my iron result?",
    extraValidate,
  );
  assert(res.substantive);
  for (const p of COWARDICE) assert(!p.test(res.content), `matched ${p}`);
  assertStringIncludes(
    res.content,
    "Here is the part of your released Twin I can state safely and directly",
  );
});

Deno.test("biotwinReplacementMessage carries no generic refusal phrasing", () => {
  const msg = biotwinReplacementMessage(packet);
  for (const p of COWARDICE) assert(!p.test(msg), `matched ${p}`);
  assertStringIncludes(msg, "does not currently contain a patient-released");
});

// ---------------------------------------------------------------------------
// Hardening — decision_grade_hold enforcement, narrowly
// ---------------------------------------------------------------------------

const dgPacket = { ...packet, holds: ["decision_grade_hold"] as typeof packet.holds };

for (const bad of [
  "Your multiomic result is decision-grade and can guide therapy.",
  "This is a decision-grade multiomic result.",
  "Your multiomics are decision grade.",
]) {
  Deno.test(`decision_grade_hold blocks positive claim: ${bad}`, () => {
    const v = validateBiotwinOutput(bad, dgPacket);
    assert(!v.valid, "must be rejected");
    assert(v.violations.some((x) => x.kind === "hold_violation"));
  });
}

for (const ok of [
  "This is not a decision-grade multiomic result.",
  "The multiomic layers are not decision grade.",
  "These protein abundance signals are bounded hypotheses, not decision-grade evidence.",
  "That decision belongs with your clinician, and your grade of exposure is unchanged.",
]) {
  Deno.test(`decision_grade_hold permits: ${ok}`, () => {
    const v = validateBiotwinOutput(ok, dgPacket);
    assert(
      !v.violations.some((x) => x.kind === "hold_violation"),
      `unexpected hold violation: ${JSON.stringify(v.violations)}`,
    );
  });
}

// ---------------------------------------------------------------------------
// Hardening — version stamps
// ---------------------------------------------------------------------------

Deno.test("version stamps are current", async () => {
  const { BIOTWIN_VALIDATOR_VERSION } = await import("./packet.ts");
  const { RUNTIME_VERSION, PROMPT_TEMPLATE_VERSION } = await import("../receipt.ts");
  assertEquals(BIOTWIN_VALIDATOR_VERSION, "1.1.1");
  assertEquals(RUNTIME_VERSION, "r0.1.1");
  assertEquals(PROMPT_TEMPLATE_VERSION, "pt-2026-08-09.1");
});

// ---------------------------------------------------------------------------
// Classification regression (found by read-only Peter production replay):
// "Measured atherogenic particle burden (...) of unquantified etiology" is a
// MEASUREMENT. Only the etiology is unquantified.
// ---------------------------------------------------------------------------

const PETER_APOB_TITLE =
  "Measured atherogenic particle burden (ApoB 124 mg/dL on 2026-02-20 and 118 mg/dL on 2026-04-02 statin OFF; LDL-P 1574 nmol/L) of unquantified etiology";
const PETER_TOBACCO_TITLE =
  "Active tobacco and vape exposure (documented cumulative estimate: approximately 10-21.3 pack-years; 21.3 represents the current upper-bound reconstruction; cigarette-to-vape 2024)";
const PETER_VASCULAR_TITLE =
  "Vascular-injury-associated protein hypothesis (abundance signals of unmeasured activity)";
const PETER_IRON_TITLE =
  "One abnormal iron study of unestablished persistence and etiology (serum iron 266 mcg/dL, saturation 78%, ferritin 61 within range)";

function peterDriverPacket() {
  return buildBiotwinPacket(report, [
    row({ source_id: "drv-apob", statement_kind: "driver", truth_status: "confirmed", title: PETER_APOB_TITLE, ordinal: 1 }),
    row({ source_id: "drv-tobacco", statement_kind: "driver", truth_status: "confirmed", title: PETER_TOBACCO_TITLE, ordinal: 2 }),
    row({ source_id: "drv-vascular", statement_kind: "driver", truth_status: "confirmed", title: PETER_VASCULAR_TITLE, ordinal: 3 }),
    row({ source_id: "drv-iron", statement_kind: "driver", truth_status: "confirmed", title: PETER_IRON_TITLE, ordinal: 4 }),
  ]);
}

function sectionOf(text: string, heading: string): string {
  const start = text.indexOf(heading);
  if (start < 0) return "";
  const rest = text.slice(start + heading.length);
  const next = rest.search(/\n\*\*/);
  return next < 0 ? rest : rest.slice(0, next);
}

Deno.test("Peter ApoB driver renders as measured, ranked first", () => {
  const res = buildUsefulBiotwinFallback(peterDriverPacket(), THE_QUESTION);
  assert(res.substantive);
  const measured = sectionOf(res.content, "**Measured and established, in rank order:**");
  assertStringIncludes(measured, "Measured atherogenic particle burden");
  assert(/^\s*1\.\s+Measured atherogenic particle burden/m.test(measured));
});

Deno.test("Peter tobacco driver renders as measured", () => {
  const res = buildUsefulBiotwinFallback(peterDriverPacket(), THE_QUESTION);
  const measured = sectionOf(res.content, "**Measured and established, in rank order:**");
  assertStringIncludes(measured, "Active tobacco and vape exposure");
});

Deno.test("Peter vascular hypothesis and unestablished iron stay hypothesis", () => {
  const res = buildUsefulBiotwinFallback(peterDriverPacket(), THE_QUESTION);
  const hyp = sectionOf(res.content, "**Held as hypothesis, not established:**");
  assertStringIncludes(hyp, "Vascular-injury-associated protein hypothesis");
  assertStringIncludes(hyp, "One abnormal iron study of unestablished persistence");
  const measured = sectionOf(res.content, "**Measured and established, in rank order:**");
  assert(!measured.includes("Vascular-injury-associated protein hypothesis"));
  assert(!measured.includes("One abnormal iron study"));
});

Deno.test("non-confirmed truth_status is always hypothesis", () => {
  const p = buildBiotwinPacket(report, [
    row({ source_id: "drv-c", statement_kind: "driver", truth_status: "candidate", title: "Measured something firm", ordinal: 1 }),
    row({ source_id: "drv-m", statement_kind: "driver", truth_status: "confirmed", title: PETER_TOBACCO_TITLE, ordinal: 2 }),
  ]);
  const res = buildUsefulBiotwinFallback(p, THE_QUESTION);
  const hyp = sectionOf(res.content, "**Held as hypothesis, not established:**");
  assertStringIncludes(hyp, "Measured something firm");
});
