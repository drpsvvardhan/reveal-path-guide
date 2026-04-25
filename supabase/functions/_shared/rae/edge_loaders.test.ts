// ============================================================================
// edge_loaders.test.ts — covers loadEngineBinding contract + RegistryGap
// behavior + the closed-read-set static scan.
// ============================================================================

import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "jsr:@std/assert@1.0.0";
import {
  loadEngineBinding,
  type DbFilterChain,
  type DbResponse,
  type DbTable,
  type ReadOnlyDbClient,
} from "./edge_loaders.ts";
import { RegistryGapError } from "./orchestrator.ts";
import { SIGNAL_IDS } from "./types.ts";

// ---------------------------------------------------------------------------
// In-memory fake of the read-only DB client. Tracks call sites so tests can
// assert which tables were touched.
// ---------------------------------------------------------------------------

interface FakeStores {
  engine_versions: Array<Record<string, unknown>>;
  signal_config: Array<Record<string, unknown>>;
  concept_overrides: Array<Record<string, unknown>>;
}

interface FakeOptions {
  forceErrorOn?: "rae_engine_versions" | "rae_signal_config" | "rae_engine_concept_overrides";
}

interface CallLog {
  table: string;
  columns: string;
  filters: Array<{ kind: "eq" | "is"; column: string; value: unknown }>;
  terminal: "maybeSingle" | "resolve";
}

function makeFakeClient(
  stores: FakeStores,
  opts: FakeOptions = {},
): { client: ReadOnlyDbClient; calls: CallLog[] } {
  const calls: CallLog[] = [];

  const buildChain = (
    table: string,
    columns: string,
    rows: Array<Record<string, unknown>>,
  ): DbFilterChain<unknown> => {
    const log: CallLog = { table, columns, filters: [], terminal: "resolve" };
    let current = rows;

    const chain: DbFilterChain<unknown> = {
      eq(column, value) {
        log.filters.push({ kind: "eq", column, value });
        current = current.filter((r) => r[column] === value);
        return chain;
      },
      is(column, value) {
        log.filters.push({ kind: "is", column, value });
        current = current.filter((r) => r[column] === value);
        return chain;
      },
      async maybeSingle() {
        log.terminal = "maybeSingle";
        calls.push(log);
        if (opts.forceErrorOn === table) {
          return {
            data: null,
            error: { message: `forced ${table} failure`, code: "X" },
          } as DbResponse<unknown>;
        }
        if (current.length === 0) {
          return { data: null, error: null };
        }
        return { data: current[0] as unknown, error: null };
      },
      async resolve() {
        log.terminal = "resolve";
        calls.push(log);
        if (opts.forceErrorOn === table) {
          return {
            data: null,
            error: { message: `forced ${table} failure`, code: "X" },
          } as DbResponse<unknown[]>;
        }
        return { data: current as unknown[], error: null };
      },
    };
    return chain;
  };

  const client: ReadOnlyDbClient = {
    from(table) {
      const rows: Array<Record<string, unknown>> = (() => {
        if (table === "rae_engine_versions") return stores.engine_versions;
        if (table === "rae_signal_config") return stores.signal_config;
        if (table === "rae_engine_concept_overrides") return stores.concept_overrides;
        throw new Error(`fake client: unsupported table ${table}`);
      })();
      const t: DbTable = {
        select(columns) {
          return buildChain(table, columns, rows);
        },
      };
      return t;
    },
  };

  return { client, calls };
}

// ---------------------------------------------------------------------------
// Fixture builders.
// ---------------------------------------------------------------------------

const ENGINE_ID = "11111111-1111-1111-1111-111111111111";
const CONCEPT_ID = "concept_hba1c";

function engineVersionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ENGINE_ID,
    semver: "1.0.0",
    registry_seed_version: "rsv_2026_04",
    ontology_version: "ont_2026_04",
    threshold_admission: 0.7,
    threshold_rejection_floor: 0.3,
    calibration_mode: false,
    ...overrides,
  };
}

function fullSignalConfigRows(
  candidateConceptId: string = "*",
  weightOverride?: Partial<Record<string, number>>,
  parametersOverride?: Partial<Record<string, Record<string, unknown>>>,
) {
  return SIGNAL_IDS.map((id) => ({
    signal_id: id,
    candidate_concept_id: candidateConceptId,
    engine_version_id: ENGINE_ID,
    weight: weightOverride?.[id] ?? 1.0,
    parameters: parametersOverride?.[id] ?? {},
  }));
}

// ---------------------------------------------------------------------------
// 1. Happy path: wildcard signal config only.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — happy path with wildcard signal config", async () => {
  const stores: FakeStores = {
    engine_versions: [engineVersionRow()],
    signal_config: fullSignalConfigRows("*"),
    concept_overrides: [],
  };
  const { client } = makeFakeClient(stores);
  const binding = await loadEngineBinding(client, {
    engine_version_id: ENGINE_ID,
    candidate_concept_id: CONCEPT_ID,
  });
  assertEquals(binding.engine_version.engine_version_id, ENGINE_ID);
  assertEquals(binding.engine_version.threshold_admission, 0.7);
  for (const id of SIGNAL_IDS) {
    assertEquals(
      (binding.signal_config as unknown as Record<string, { weight: number }>)[id].weight,
      1.0,
    );
  }
  assertEquals(binding.concept_override, null);
});

// ---------------------------------------------------------------------------
// 2. Concept-scoped rows override wildcard rows per signal_id.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — concept-scoped signal config overrides wildcard", async () => {
  const stores: FakeStores = {
    engine_versions: [engineVersionRow()],
    signal_config: [
      ...fullSignalConfigRows("*"),
      // Concept-scoped override for `lexical` only.
      {
        signal_id: "lexical",
        candidate_concept_id: CONCEPT_ID,
        engine_version_id: ENGINE_ID,
        weight: 2.5,
        parameters: { fuzzy_ceiling: 0.85 },
      },
    ],
    concept_overrides: [],
  };
  const { client } = makeFakeClient(stores);
  const binding = await loadEngineBinding(client, {
    engine_version_id: ENGINE_ID,
    candidate_concept_id: CONCEPT_ID,
  });
  const sc = binding.signal_config as unknown as Record<
    string,
    { weight: number; fuzzy_ceiling?: number }
  >;
  assertEquals(sc.lexical.weight, 2.5);
  assertEquals(sc.lexical.fuzzy_ceiling, 0.85);
  // Other signals fell back to wildcard.
  assertEquals(sc.unit.weight, 1.0);
});

// ---------------------------------------------------------------------------
// 3. Concept override row is returned when present + not lifted.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — returns concept_override when present and not lifted", async () => {
  const stores: FakeStores = {
    engine_versions: [engineVersionRow()],
    signal_config: fullSignalConfigRows("*"),
    concept_overrides: [
      {
        engine_version_id: ENGINE_ID,
        candidate_concept_id: CONCEPT_ID,
        lifted: false,
        reason: "calibration: route to review",
      },
    ],
  };
  const { client } = makeFakeClient(stores);
  const binding = await loadEngineBinding(client, {
    engine_version_id: ENGINE_ID,
    candidate_concept_id: CONCEPT_ID,
  });
  assert(binding.concept_override !== null);
  assertEquals(binding.concept_override?.reason, "calibration: route to review");
});

Deno.test("loadEngineBinding — lifted concept_override is filtered out", async () => {
  const stores: FakeStores = {
    engine_versions: [engineVersionRow()],
    signal_config: fullSignalConfigRows("*"),
    concept_overrides: [
      {
        engine_version_id: ENGINE_ID,
        candidate_concept_id: CONCEPT_ID,
        lifted: true,
        reason: "calibration: route to review",
      },
    ],
  };
  const { client } = makeFakeClient(stores);
  const binding = await loadEngineBinding(client, {
    engine_version_id: ENGINE_ID,
    candidate_concept_id: CONCEPT_ID,
  });
  assertEquals(binding.concept_override, null);
});

// ---------------------------------------------------------------------------
// 4. RegistryGapError when engine_version row missing.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — RegistryGapError when engine_version row missing", async () => {
  const { client } = makeFakeClient({
    engine_versions: [],
    signal_config: fullSignalConfigRows("*"),
    concept_overrides: [],
  });
  const err = await assertRejects(
    () => loadEngineBinding(client, { engine_version_id: ENGINE_ID }),
    RegistryGapError,
  );
  assertStringIncludes(err.message, "rae_engine_versions row missing");
});

// ---------------------------------------------------------------------------
// 5. RegistryGapError when threshold_admission is missing or non-finite.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — RegistryGapError when threshold_admission missing", async () => {
  const { client } = makeFakeClient({
    engine_versions: [engineVersionRow({ threshold_admission: null })],
    signal_config: fullSignalConfigRows("*"),
    concept_overrides: [],
  });
  await assertRejects(
    () => loadEngineBinding(client, { engine_version_id: ENGINE_ID }),
    RegistryGapError,
    "threshold_admission",
  );
});

// ---------------------------------------------------------------------------
// 6. RegistryGapError when any of the seven signal rows is missing.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — RegistryGapError when a signal_id row is missing", async () => {
  const rows = fullSignalConfigRows("*").filter((r) => r.signal_id !== "panel");
  const { client } = makeFakeClient({
    engine_versions: [engineVersionRow()],
    signal_config: rows,
    concept_overrides: [],
  });
  await assertRejects(
    () => loadEngineBinding(client, { engine_version_id: ENGINE_ID }),
    RegistryGapError,
    "signal_id=panel",
  );
});

// ---------------------------------------------------------------------------
// 7. RegistryGapError when signal_config has no rows at all.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — RegistryGapError when signal_config is empty", async () => {
  const { client } = makeFakeClient({
    engine_versions: [engineVersionRow()],
    signal_config: [],
    concept_overrides: [],
  });
  await assertRejects(
    () => loadEngineBinding(client, { engine_version_id: ENGINE_ID }),
    RegistryGapError,
    "no rows",
  );
});

// ---------------------------------------------------------------------------
// 8. RegistryGapError when a weight is non-finite.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — RegistryGapError when weight is non-finite", async () => {
  const rows = fullSignalConfigRows("*");
  (rows[0] as Record<string, unknown>).weight = "not-a-number";
  const { client } = makeFakeClient({
    engine_versions: [engineVersionRow()],
    signal_config: rows,
    concept_overrides: [],
  });
  await assertRejects(
    () => loadEngineBinding(client, { engine_version_id: ENGINE_ID }),
    RegistryGapError,
    "weight",
  );
});

// ---------------------------------------------------------------------------
// 9. DB error on rae_engine_versions surfaces as RegistryGapError.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — DB error on engine_versions surfaces as RegistryGapError", async () => {
  const { client } = makeFakeClient(
    {
      engine_versions: [engineVersionRow()],
      signal_config: fullSignalConfigRows("*"),
      concept_overrides: [],
    },
    { forceErrorOn: "rae_engine_versions" },
  );
  await assertRejects(
    () => loadEngineBinding(client, { engine_version_id: ENGINE_ID }),
    RegistryGapError,
    "read failed",
  );
});

Deno.test("loadEngineBinding — DB error on signal_config surfaces as RegistryGapError", async () => {
  const { client } = makeFakeClient(
    {
      engine_versions: [engineVersionRow()],
      signal_config: fullSignalConfigRows("*"),
      concept_overrides: [],
    },
    { forceErrorOn: "rae_signal_config" },
  );
  await assertRejects(
    () => loadEngineBinding(client, { engine_version_id: ENGINE_ID }),
    RegistryGapError,
    "rae_signal_config read failed",
  );
});

Deno.test("loadEngineBinding — DB error on concept_overrides surfaces as RegistryGapError", async () => {
  const { client } = makeFakeClient(
    {
      engine_versions: [engineVersionRow()],
      signal_config: fullSignalConfigRows("*"),
      concept_overrides: [],
    },
    { forceErrorOn: "rae_engine_concept_overrides" },
  );
  await assertRejects(
    () => loadEngineBinding(client, {
      engine_version_id: ENGINE_ID,
      candidate_concept_id: CONCEPT_ID,
    }),
    RegistryGapError,
    "rae_engine_concept_overrides read failed",
  );
});

// ---------------------------------------------------------------------------
// 10. engine_version_id is required.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — empty engine_version_id rejected", async () => {
  const { client } = makeFakeClient({
    engine_versions: [],
    signal_config: [],
    concept_overrides: [],
  });
  await assertRejects(
    () => loadEngineBinding(client, { engine_version_id: "" }),
    RegistryGapError,
    "engine_version_id is required",
  );
});

// ---------------------------------------------------------------------------
// 11. concept_override loader is NOT called when candidate_concept_id absent.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — concept_override read is skipped without candidate_concept_id", async () => {
  const { client, calls } = makeFakeClient({
    engine_versions: [engineVersionRow()],
    signal_config: fullSignalConfigRows("*"),
    concept_overrides: [],
  });
  const binding = await loadEngineBinding(client, {
    engine_version_id: ENGINE_ID,
  });
  assertEquals(binding.concept_override, null);
  assert(
    !calls.some((c) => c.table === "rae_engine_concept_overrides"),
    "must not query rae_engine_concept_overrides without candidate_concept_id",
  );
});

// ---------------------------------------------------------------------------
// 12. Optional parameter lifting: only recognised keys are kept.
// ---------------------------------------------------------------------------
Deno.test("loadEngineBinding — optional signal parameters are lifted, unknown keys dropped", async () => {
  const stores: FakeStores = {
    engine_versions: [engineVersionRow()],
    signal_config: fullSignalConfigRows("*", undefined, {
      lexical: { fuzzy_ceiling: 0.9, unrelated: "drop me" },
      value: { edge_tolerance: 0.05 },
      ref_range: { tolerance: 0.1 },
      longitudinal: { min_history: 3 },
    }),
    concept_overrides: [],
  };
  const { client } = makeFakeClient(stores);
  const binding = await loadEngineBinding(client, {
    engine_version_id: ENGINE_ID,
  });
  const sc = binding.signal_config as unknown as Record<string, Record<string, unknown>>;
  assertEquals(sc.lexical.fuzzy_ceiling, 0.9);
  assertEquals(sc.lexical.unrelated, undefined);
  assertEquals(sc.value.edge_tolerance, 0.05);
  assertEquals(sc.ref_range.tolerance, 0.1);
  assertEquals(sc.longitudinal.min_history, 3);
});

// ---------------------------------------------------------------------------
// 13. Static source scan: closed read set + no writes + no forbidden imports.
// ---------------------------------------------------------------------------
Deno.test("edge_loaders.ts — closed read set + no writes (static scan)", async () => {
  const src = await Deno.readTextFile(
    new URL("./edge_loaders.ts", import.meta.url).pathname,
  );
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  // (a) No write or rpc calls.
  const forbiddenClientCalls = [
    /\.from\(['"][^'"]+['"]\)\s*\.\s*(insert|update|delete|upsert)\b/,
    /\.rpc\s*\(/,
    /\.storage\b/,
    /\.auth\b/,
    /\.channel\(/,
  ];
  for (const pat of forbiddenClientCalls) {
    assert(
      !pat.test(stripped),
      `edge_loaders.ts must not contain client call matching ${pat}`,
    );
  }

  // (b) No raw SQL strings.
  const forbiddenSqlKeywords = [
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+\w+\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bUPSERT\s+INTO\b/i,
    /\bSELECT\s+\w+\s+FROM\b/i,
    /\bTRUNCATE\b/i,
    /\bDROP\s+TABLE\b/i,
    /\bALTER\s+TABLE\b/i,
    /\bCREATE\s+TABLE\b/i,
  ];
  for (const pat of forbiddenSqlKeywords) {
    assert(
      !pat.test(stripped),
      `edge_loaders.ts must not contain raw SQL matching ${pat}`,
    );
  }

  // (c) Reads are restricted to the three allowed tables. Find every
  // .from("...") string literal and verify the table name is in the
  // allowlist.
  const allowedTables = new Set([
    "rae_engine_versions",
    "rae_signal_config",
    "rae_engine_concept_overrides",
  ]);
  const fromCalls = [...src.matchAll(/\.from\s*\(\s*["']([^"']+)["']\s*\)/g)];
  assert(fromCalls.length > 0, "edge_loaders.ts must call .from(...) at least once");
  for (const m of fromCalls) {
    assert(
      allowedTables.has(m[1]),
      `edge_loaders.ts may only read from ${[...allowedTables].join(", ")}; got "${m[1]}"`,
    );
  }

  // (d) No reference to forbidden tables anywhere (in code OR comments).
  const forbiddenTables = [
    "concept_assignment_witnesses",
    "rae_state_transitions",
    "witness_objects",
    "observation_review_queue",
    "ontology_concept_proposals",
    "review_queue_audit_log",
    "clusters",
    "cluster_evidence",
    "derived_patterns",
    "patient_narratives",
    "action_plans",
    "terrain_renders",
    "observation_packets",
    "patient_lab_observations",
    "patient_lab_uploads",
    "profiles",
    "user_roles",
    "cie_assessments",
    "cie_responses",
    "cie_gate_scores",
    "cie_domain_scores",
    "food_logs",
  ];
  for (const tbl of forbiddenTables) {
    const pat = new RegExp(`["'\\b]${tbl}["'\\b]`);
    assert(
      !pat.test(stripped),
      `edge_loaders.ts must not reference forbidden table "${tbl}"`,
    );
  }

  // (e) Imports are restricted: only ./types.ts and ./orchestrator.ts (and
  // std). No reasoning surfaces, no witnessify_impl, no admit/gateway
  // (loaders should not depend on storage).
  const importRe = /^\s*import[^"']+["']([^"']+)["']/gm;
  const imports = [...src.matchAll(importRe)].map((m) => m[1]);
  for (const spec of imports) {
    assert(
      spec.startsWith("./") || spec.startsWith("../") ||
        spec.startsWith("jsr:@std/") ||
        spec.startsWith("https://deno.land/std"),
      `edge_loaders.ts: unexpected import shape: ${spec}`,
    );
    assert(
      !spec.includes("witnessify_impl"),
      "edge_loaders.ts must not import witnessify_impl",
    );
    for (const forbidden of [
      "generate-clusters",
      "generate-narrative",
      "generate-action-plan",
      "generate-terrain-render",
      "patient-chat",
      "witnessify-observations",
      "./storage/",
    ]) {
      assert(
        !spec.includes(forbidden),
        `edge_loaders.ts must not import surface ${forbidden}`,
      );
    }
  }
});
