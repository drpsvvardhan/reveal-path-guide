// tests/constitutional-singularity.test.ts
//
// Constitutional invariant: same patient, same evidence, same terrain — no
// matter which surface reads it. The three substrate families below MUST
// have a single canonical home in supabase/functions/_shared/. The client
// mirrors are transparent re-export shims via the @shared path alias.
//
// This scan is deliberately narrow. It only guards the three named modules.
// Generic *_LIBRARY / *_MAP constants elsewhere in the repo are unrelated.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..");
const SUBSTRATE_MODULES = [
  "clusterConfidence",
  "inbodyToTerrainMap",
  "interventionLibrary",
] as const;

const FORBIDDEN_INLINE_PATTERNS: Array<{ pattern: RegExp; symbol: string }> = [
  { pattern: /\bconst\s+INBODY_TERRAIN_MAP\b/, symbol: "INBODY_TERRAIN_MAP" },
  { pattern: /\bconst\s+INTERVENTION_LIBRARY\b/, symbol: "INTERVENTION_LIBRARY" },
  { pattern: /\bfunction\s+deriveClusterConfidence\b/, symbol: "deriveClusterConfidence" },
];

function stripCommentsAndBlanks(source: string): string[] {
  // Remove block comments first.
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"));
}

describe("constitutional singularity: src/lib substrate shims", () => {
  for (const name of SUBSTRATE_MODULES) {
    it(`src/lib/${name}.ts is a transparent re-export shim`, () => {
      const path = join(REPO_ROOT, "src", "lib", `${name}.ts`);
      const source = readFileSync(path, "utf8");
      const codeLines = stripCommentsAndBlanks(source);

      const expected = `export * from "@shared/${name}";`;
      const allowed = new Set([expected, expected.replace(/"/g, "'")]);

      const violations = codeLines.filter((l) => !allowed.has(l.replace(/;?$/, ";")));
      expect(
        violations,
        `Constitutional-singularity violation: src/lib/${name}.ts must be a transparent re-export shim. Canonical source lives at supabase/functions/_shared/${name}.ts.`,
      ).toEqual([]);
    });
  }
});

describe("constitutional singularity: edge functions do not inline substrate", () => {
  const fnRoot = join(REPO_ROOT, "supabase", "functions");
  const entries = readdirSync(fnRoot).filter((d) => {
    if (d.startsWith("_")) return false;
    const full = join(fnRoot, d);
    try {
      return statSync(full).isDirectory();
    } catch {
      return false;
    }
  });

  for (const dir of entries) {
    const indexPath = join(fnRoot, dir, "index.ts");
    let source: string | null = null;
    try {
      source = readFileSync(indexPath, "utf8");
    } catch {
      continue;
    }

    it(`supabase/functions/${dir}/index.ts contains no inline substrate definitions`, () => {
      for (const { pattern, symbol } of FORBIDDEN_INLINE_PATTERNS) {
        expect(
          pattern.test(source!),
          `Constitutional-singularity violation: supabase/functions/${dir}/index.ts defines an inline copy of substrate symbol \`${symbol}\`. Import from ../_shared/ instead.`,
        ).toBe(false);
      }
    });
  }
});
