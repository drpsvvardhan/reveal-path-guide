// ============================================================================
// supabase/functions/_shared/rae/spec_alignment.test.ts
// ----------------------------------------------------------------------------
// Cross-document guard. Asserts the RAE TS contracts stay aligned with:
//   - schema enum public.rae_admission_state (4 values, locked)
//   - design + plan: 7 signals, locked
//   - boundary: no imports from reasoning surfaces, no API/FHIR framing
//
// Plan §7.6.
// ============================================================================

import { assert, assertEquals } from "jsr:@std/assert@1.0.0";
import {
  ADMISSION_STATES,
  COHERENCE_SIGNAL_ID,
  IDENTITY_SIGNAL_IDS,
  SIGNAL_IDS,
} from "./types.ts";
import { FORBIDDEN_TRANSITIONS } from "./stateMachine.ts";

const RAE_DIR = new URL("./", import.meta.url).pathname;

async function readModule(rel: string): Promise<string> {
  return await Deno.readTextFile(new URL(rel, import.meta.url).pathname);
}

const TYPES_SRC = await readModule("./types.ts");
const STATE_SRC = await readModule("./stateMachine.ts");
const SCORING_SRC = await readModule("./scoring.ts");

// ---------------------------------------------------------------------------
// 1. Exactly four admission states.
// ---------------------------------------------------------------------------
Deno.test("spec-alignment: ADMISSION_STATES is exactly the locked four", () => {
  assertEquals(
    [...ADMISSION_STATES].sort(),
    ["auto_admitted", "human_confirmed", "needs_review", "rejected"],
  );
});

Deno.test("spec-alignment: no fifth-state literal anywhere in RAE module sources", () => {
  for (const [name, src] of [
    ["types.ts", TYPES_SRC],
    ["stateMachine.ts", STATE_SRC],
    ["scoring.ts", SCORING_SRC],
  ] as const) {
    assert(
      !src.includes("back_annotated_divergent"),
      `${name} must not reference forbidden fifth state "back_annotated_divergent"`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2. Exactly seven signal ids, in design order.
// ---------------------------------------------------------------------------
Deno.test("spec-alignment: SIGNAL_IDS is exactly the locked seven, in order", () => {
  assertEquals(
    [...SIGNAL_IDS],
    ["lexical", "unit", "value", "method", "ref_range", "panel", "longitudinal"],
  );
  assertEquals(SIGNAL_IDS.length, 7);
  assertEquals(IDENTITY_SIGNAL_IDS.length, 6);
  assertEquals(COHERENCE_SIGNAL_ID, "longitudinal");
});

// ---------------------------------------------------------------------------
// 3. Forbidden transitions cover the four named cases from plan §3.2.
// ---------------------------------------------------------------------------
Deno.test("spec-alignment: FORBIDDEN_TRANSITIONS is a superset of the named four", () => {
  const required: Array<{ from: string; to: string; actor: string }> = [
    { from: "auto_admitted", to: "rejected", actor: "engine" },
    { from: "human_confirmed", to: "auto_admitted", actor: "any" },
    { from: "human_confirmed", to: "rejected", actor: "engine" },
    // engine reopen is implied by spec; explicit guard.
    { from: "human_confirmed", to: "needs_review", actor: "engine" },
  ];
  for (const r of required) {
    const present = FORBIDDEN_TRANSITIONS.some(
      (f) => f.from === r.from && f.to === r.to && f.actor === r.actor,
    );
    assert(present, `forbidden transition missing: ${r.from} -> ${r.to} by ${r.actor}`);
  }
});

// ---------------------------------------------------------------------------
// 4. No imports from reasoning surfaces or product framing.
// ---------------------------------------------------------------------------
const FORBIDDEN_IMPORT_PATTERNS = [
  // Reasoning surfaces (Drift B mitigation, plan §7.5).
  /generate-clusters/,
  /generate-narrative/,
  /generate-action-plan/,
  /generate-terrain-render/,
  /generate-ask-anything-context/,
  /patient-chat/,
  // Reasoning tables.
  /\bcie_assessments\b/,
  /\bcie_gate_scores\b/,
  /\bcie_domain_scores\b/,
  /\bcie_responses\b/,
  /\bderived_patterns\b/,
  /\bpatient_narratives\b/,
  /\bterrain_renders\b/,
  /\baction_plans\b/,
  // External API framing — RAE is internal admission, not an API/FHIR surface.
  /\bFHIR\b/,
  /openapi/i,
  /swagger/i,
];

Deno.test("spec-alignment: no imports/references from reasoning surfaces or external API framing", async () => {
  for (const file of ["types.ts", "stateMachine.ts", "scoring.ts"]) {
    const src = await readModule(`./${file}`);
    for (const pat of FORBIDDEN_IMPORT_PATTERNS) {
      assert(
        !pat.test(src),
        `${file} contains forbidden reference matching ${pat}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 5. RAE module sources only import from inside ./rae/.
// ---------------------------------------------------------------------------
Deno.test("spec-alignment: RAE modules only import from ./types.ts (or std)", async () => {
  const importRe = /^\s*import[^"']+["']([^"']+)["']/gm;
  for (const file of ["stateMachine.ts", "scoring.ts"]) {
    const src = await readModule(`./${file}`);
    const matches = [...src.matchAll(importRe)].map((m) => m[1]);
    for (const spec of matches) {
      assert(
        spec === "./types.ts" || spec.startsWith("jsr:@std/") ||
          spec.startsWith("https://deno.land/std"),
        `${file} imports forbidden module: ${spec}`,
      );
    }
  }
  // types.ts must have no relative imports at all.
  const typesImports = [...TYPES_SRC.matchAll(importRe)].map((m) => m[1]);
  for (const spec of typesImports) {
    assert(
      !spec.startsWith("./") && !spec.startsWith("../"),
      `types.ts must not import other RAE modules; found: ${spec}`,
    );
  }
});

// ---------------------------------------------------------------------------
// 6. RAE directory shape (only the six allowed files in this scope).
// ---------------------------------------------------------------------------
Deno.test("spec-alignment: RAE shared dir contains only the contracted files", async () => {
  const allowed = new Set([
    "types.ts",
    "stateMachine.ts",
    "scoring.ts",
    "orchestrator.ts",
    "stateMachine.test.ts",
    "scoring.test.ts",
    "orchestrator.test.ts",
    "spec_alignment.test.ts",
  ]);
  for await (const entry of Deno.readDir(RAE_DIR)) {
    if (!entry.isFile) continue;
    assert(
      allowed.has(entry.name),
      `unexpected file in supabase/functions/_shared/rae/: ${entry.name}`,
    );
  }
});
