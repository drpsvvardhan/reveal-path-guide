// ============================================================================
// static_scan.test.ts — design §12.
// ----------------------------------------------------------------------------
// Source-text scans over every file in this directory (excluding tests).
// Asserts forbidden imports, forbidden DB access, and the RAE shared-import
// allow-list.
// ============================================================================

import { assert } from "jsr:@std/assert@1.0.0";

const DIR = new URL("./", import.meta.url).pathname;

async function listSourceFiles(): Promise<string[]> {
  const out: string[] = [];
  for await (const e of Deno.readDir(DIR)) {
    if (!e.isFile) continue;
    if (!e.name.endsWith(".ts")) continue;
    if (e.name.endsWith(".test.ts")) continue;
    out.push(e.name);
  }
  return out;
}

async function read(name: string): Promise<string> {
  return await Deno.readTextFile(`${DIR}${name}`);
}

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /witnessify_impl/,
  /_shared\/rae\/signals\//,
  /_shared\/witness\.ts/,
  // P1a reasoning surfaces.
  /generate-clusters/,
  /generate-narrative/,
  /generate-action-plan/,
  /generate-terrain-render/,
  /generate-ask-anything-context/,
  /patient-chat/,
  /\bcie_assessments\b/,
  /\bcie_gate_scores\b/,
  /\bderived_patterns\b/,
  /\bpatient_narratives\b/,
  /\bterrain_renders\b/,
  /\baction_plans\b/,
];

const FORBIDDEN_DB_PATTERNS: RegExp[] = [
  /\.from\s*\(/,
  /\.insert\s*\(/,
  /\.update\s*\(/,
  /\.delete\s*\(/,
  /\.upsert\s*\(/,
  /\.rpc\s*\(/,
  /\bselect\s+[\s\S]{0,80}?\bfrom\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\s+\w+\s+set\b/i,
  /\bdelete\s+from\b/i,
];

const ALLOWED_RAE_IMPORTS = new Set<string>([
  "../_shared/rae/edge_loaders.ts",
  "../_shared/rae/concept_binding_adapter.ts",
  "../_shared/rae/concept_binding.ts",
  "../_shared/rae/orchestrator.ts",
  "../_shared/rae/storage/admit.ts",
  "../_shared/rae/storage/gateway_rpc.ts",
  "../_shared/rae/types.ts",
]);

const IMPORT_RE = /^\s*import[^"']+["']([^"']+)["']/gm;

Deno.test("static_scan: no forbidden imports in source files", async () => {
  for (const f of await listSourceFiles()) {
    const src = await read(f);
    for (const pat of FORBIDDEN_IMPORT_PATTERNS) {
      assert(!pat.test(src), `${f} contains forbidden reference matching ${pat}`);
    }
  }
});

Deno.test("static_scan: no direct DB access or raw SQL in source files", async () => {
  for (const f of await listSourceFiles()) {
    const src = await read(f);
    for (const pat of FORBIDDEN_DB_PATTERNS) {
      assert(!pat.test(src), `${f} contains forbidden DB pattern ${pat}`);
    }
  }
});

Deno.test("static_scan: every RAE shared import is on the allow-list", async () => {
  for (const f of await listSourceFiles()) {
    const src = await read(f);
    const imports = [...src.matchAll(IMPORT_RE)].map((m) => m[1]);
    for (const spec of imports) {
      if (!spec.includes("_shared/rae/")) continue;
      assert(
        ALLOWED_RAE_IMPORTS.has(spec),
        `${f} imports non-allow-listed RAE module: ${spec}`,
      );
    }
  }
});

Deno.test("static_scan: source files do not import witnessify_impl directly or transitively by name", async () => {
  for (const f of await listSourceFiles()) {
    const src = await read(f);
    assert(!/witnessify_impl/.test(src), `${f} references witnessify_impl`);
  }
});

Deno.test("static_scan: index.ts not yet created (test-first phase)", async () => {
  let exists = true;
  try {
    await Deno.stat(`${DIR}index.ts`);
  } catch {
    exists = false;
  }
  assert(!exists, "index.ts should not exist yet — implementation prompt pending");
});