// Test-only in-memory stand-in for the service client used by the autonomy
// edge handlers. It records every table touched and every write, so a test can
// assert not only what happened but what did NOT happen (no governed report
// writes, no witness projection, no forged column values).
//
// Deliberately strict: a query for a table that was never declared returns an
// error, exactly as a wrong table/column would in the real database. A mock
// that silently accepts anything proves nothing.
import { vi } from "vitest";

export type Row = Record<string, any>;

export interface Recorded {
  table: string;
  kind: "select" | "insert" | "update" | "delete";
  payload?: Row;
}

export interface FakeDb {
  tables: Record<string, Row[]>;
  log: Recorded[];
  /** Tables whose reads must fail, to prove a failed read is not clearance. */
  failReads: Set<string>;
  from: (table: string) => any;
  rpc: ReturnType<typeof vi.fn>;
  writesTo: (table: string) => Recorded[];
}

export function createFakeDb(
  tables: Record<string, Row[]>,
  rpcImpl?: (name: string, args: Row) => Promise<{ data: unknown; error: Row | null }>,
): FakeDb {
  const log: Recorded[] = [];
  const failReads = new Set<string>();

  const db: FakeDb = {
    tables,
    log,
    failReads,
    rpc: vi.fn(
      rpcImpl ??
        (async () => ({ data: { ok: true }, error: null })),
    ) as any,
    writesTo: (table) => log.filter((e) => e.table === table && e.kind !== "select"),
    from: (table: string) => {
      const predicates: ((row: Row) => boolean)[] = [];
      let columns = "*";
      let countMode = false;
      let headMode = false;
      let limit = Infinity;

      const rows = () => {
        if (!(table in tables)) {
          return { error: { message: `relation "${table}" does not exist` }, data: null };
        }
        if (failReads.has(table)) {
          return { error: { message: `${table} unreadable: injected failure` }, data: null };
        }
        return {
          error: null,
          data: tables[table].filter((r) => predicates.every((p) => p(r))).slice(0, limit),
        };
      };

      const project = (row: Row) => {
        if (columns.trim() === "*") return row;
        const keys = columns.split(",").map((k) => k.trim()).filter(Boolean);
        const out: Row = {};
        for (const key of keys) {
          if (!(key in row)) {
            throw new Error(`column "${table}.${key}" does not exist`);
          }
          out[key] = row[key];
        }
        return out;
      };

      const settle = (single: boolean) => {
        log.push({ table, kind: "select" });
        const res = rows();
        if (res.error) return { data: null, error: res.error, count: null };
        if (countMode) return { data: headMode ? null : res.data, error: null, count: res.data!.length };
        const projected = res.data!.map(project);
        return { data: single ? projected[0] ?? null : projected, error: null, count: null };
      };

      const builder: any = {
        select(cols?: string, opts?: { count?: string; head?: boolean }) {
          if (cols) columns = cols;
          if (opts?.count) countMode = true;
          if (opts?.head) headMode = true;
          return builder;
        },
        eq(key: string, value: unknown) {
          predicates.push((r) => r[key] === value);
          return builder;
        },
        neq(key: string, value: unknown) {
          predicates.push((r) => r[key] !== value);
          return builder;
        },
        is(key: string, value: unknown) {
          predicates.push((r) => r[key] === value);
          return builder;
        },
        in(key: string, values: unknown[]) {
          predicates.push((r) => values.includes(r[key]));
          return builder;
        },
        order() {
          return builder;
        },
        limit(n: number) {
          limit = n;
          return builder;
        },
        maybeSingle: () => Promise.resolve(settle(true)),
        single: () => Promise.resolve(settle(true)),
        insert(payload: Row | Row[]) {
          const list = Array.isArray(payload) ? payload : [payload];
          if (!(table in tables)) {
            const failure = { data: null, error: { message: `relation "${table}" does not exist` } };
            const failed: any = {
              select: () => failed,
              single: () => Promise.resolve(failure),
              maybeSingle: () => Promise.resolve(failure),
              then: (r: any) => Promise.resolve(failure).then(r),
            };
            return failed;
          }
          const stored = list.map((row) => ({
            id: row.id ?? `row-${table}-${tables[table].length + 1}`,
            version: row.version ?? 1,
            review_state: row.review_state ?? "received",
            ...row,
          }));
          tables[table].push(...stored);
          stored.forEach((row) => log.push({ table, kind: "insert", payload: row }));
          const done = { data: stored.length === 1 ? stored[0] : stored, error: null };
          const chain: any = {
            select: () => chain,
            single: () => Promise.resolve({ data: stored[0], error: null }),
            maybeSingle: () => Promise.resolve({ data: stored[0], error: null }),
            then: (resolve: any, reject: any) => Promise.resolve(done).then(resolve, reject),
          };
          return chain;
        },
        update(payload: Row) {
          const chain: any = {
            eq(key: string, value: unknown) {
              predicates.push((r) => r[key] === value);
              return chain;
            },
            then(resolve: any, reject: any) {
              const target = (tables[table] ?? []).filter((r) => predicates.every((p) => p(r)));
              target.forEach((row) => Object.assign(row, payload));
              log.push({ table, kind: "update", payload });
              return Promise.resolve({ data: target, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        then(resolve: any, reject: any) {
          return Promise.resolve(settle(false)).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return db;
}

/** A request the way the edge handlers receive it. */
export function postRequest(url: string, payload: unknown, token = "Bearer synthetic-test-token") {
  return new Request(url, {
    method: "POST",
    headers: { authorization: token, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Stub the Deno global the handlers rely on and capture the handler they
 * register. The caller performs the static `import()` of the function module.
 */
export function stubDenoServe(): { current: ((req: Request) => Promise<Response>) | null } {
  const holder: { current: ((req: Request) => Promise<Response>) | null } = { current: null };
  vi.stubGlobal("Deno", {
    serve: (cb: (req: Request) => Promise<Response>) => {
      holder.current = cb;
    },
    env: {
      get: (key: string) => (key === "SUPABASE_URL" ? "https://test.invalid" : "test-key"),
    },
  });
  return holder;
}
