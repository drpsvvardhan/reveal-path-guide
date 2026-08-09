// Governed entry-gate regressions for BioTwin Release Compiler v1.
// Run with:
//   deno test supabase/functions/_shared/biotwin/releaseCompilerGuard.test.ts

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { compileRuntimeTwinV18Governed } from "./releaseCompilerGuard.ts";
import type { JsonObject } from "./releaseCompiler.ts";

function claim(id: string, statement: string): JsonObject {
  return {
    claimId: id,
    currentState: "MEASURED",
    canonicalStatement: statement,
    evidenceRole: "COMPATIBLE",
    coverageBound: "EXACT",
    evidenceIds: [],
  };
}

function runtime(): JsonObject {
  return {
    artifactType: "RUNTIME_TWIN_FINAL",
    subject: "VZ-GOLDEN",
    generatedAt: "2026-08-09",
    twinVersion: "v18.0-final",
    observations: {
      canonicalClaims: {
        "CLM-REL-001": claim("CLM-REL-001", "Released canonical finding."),
        "CLM-UNREL-001": claim("CLM-UNREL-001", "Unreleased canonical finding."),
      },
      clinicalReveal: {
        coreThesis: "UNRELEASED SECRET CLAIM FROM FREE-FORM SYNTHESIS",
        whatIsMeasured: [
          { claimId: "CLM-REL-001", item: "Released finding" },
          { claimId: "CLM-UNREL-001", item: "Unreleased finding" },
        ],
        whatIsInferred: [],
        whatIsNotYetKnown: [],
      },
      driverHierarchy: [
        { rank: 1, driver: "Released driver", claimIds: ["CLM-REL-001"] },
        { rank: 2, driver: "Mixed driver must not cross", claimIds: ["CLM-REL-001", "CLM-UNREL-001"] },
      ],
      measurementPlan: { queue: [] },
      contradictions: [
        { id: "CTR-PURE", tension: "Released contradiction", state: "HELD", claimIds: ["CLM-REL-001"] },
        { id: "CTR-MIXED", tension: "Mixed contradiction must not cross", state: "HELD", claimIds: ["CLM-REL-001", "CLM-UNREL-001"] },
      ],
      releaseClass: {
        class: "R1_GOVERNED_RESEARCH_DRAFT",
        R3_individual_reveal: "BLOCKED",
      },
    },
  };
}

function decision(): JsonObject {
  return {
    schema: { name: "Vizzhy Founding Cohort Release Decision", version: "1.0" },
    subject: {
      twin_id: "VZ-GOLDEN",
      source_twin_version: "v18.0-final",
      source_twin_sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    release: {
      class: "FOUNDING_COHORT",
      status: "RELEASED_WITH_BOUNDS",
      patient_facing: true,
      decision_grade_multiomic_use: false,
      autonomous_medication_action: false,
      pgx_dose_action: false,
    },
    released_claim_ids: ["CLM-REL-001"],
    critical_anchor_review: [
      { claim_id: "CLM-REL-001", status: "ACCEPT_WITH_PROVENANCE_DEBT", basis: "Founding Cohort bounded release." },
    ],
    contradiction_ids: ["CTR-PURE", "CTR-MIXED"],
    explicit_prohibitions: ["5.01 h TST"],
    provenance_debt: [],
    review: { reviewer_role: "Vizzhy clinical governance", released_at: "2026-08-09T00:00:00Z" },
  };
}

Deno.test("malformed release decision returns a governed failure instead of throwing", () => {
  const res = compileRuntimeTwinV18Governed(runtime(), { schema: {} });
  assertEquals(res.ok, false);
  assert(res.diagnostics.some((d) => d.code === "release_decision_malformed"));
});

Deno.test("clinicalReveal coreThesis cannot widen the released claim set", () => {
  const res = compileRuntimeTwinV18Governed(runtime(), decision());
  assert(res.ok && res.report);
  const serialized = JSON.stringify(res.report);
  assertEquals(serialized.includes("UNRELEASED SECRET CLAIM"), false);
  const synthesis = res.report.executive_synthesis as JsonObject;
  assertEquals(synthesis.headline, "Released driver");
});

Deno.test("mixed-claim drivers and contradictions are suppressed unless every linked claim is released", () => {
  const res = compileRuntimeTwinV18Governed(runtime(), decision());
  assert(res.ok && res.report);
  const drivers = res.report.repaired_driver_hierarchy as Array<JsonObject>;
  assertEquals(drivers.length, 1);
  assertEquals(drivers[0].driver, "Released driver");
  const contradictions = res.report.contradiction_reclassification as Array<JsonObject>;
  assertEquals(contradictions.length, 1);
  assertEquals(contradictions[0].source_id, "CTR-PURE");
});

Deno.test("source R3 block is preserved as an explicit Founding Cohort override warning", () => {
  const res = compileRuntimeTwinV18Governed(runtime(), decision());
  assert(res.ok);
  assert(res.diagnostics.some((d) => d.code === "source_r3_block_superseded_by_founding_cohort_decision"));
  assertEquals(
    ((res.report!.provenance as JsonObject).source_R3_individual_reveal),
    "BLOCKED",
  );
});
