// tests/identity-scoping.test.ts
//
// Pre-beta hotfix regressions — two identity bugs that would have shipped:
//
// 1. The cohort flag lives on profiles.user_id (the auth UUID), while
//    profiles.id is an independent gen_random_uuid() primary key. A lookup
//    filtering on id fails closed for every enabled patient.
// 2. Admins hold a read-all policy on witness_objects, so the home
//    freshness query must scope to the effective user explicitly — in
//    view-as, an unscoped "newest witness" can surface ANOTHER patient's
//    date and corrupt the freshness claim.
//
// Both tests run against a fake client that actually filters rows, with
// fixtures designed so the buggy identifier/scoping produces the wrong
// answer.

import { describe, it, expect } from "vitest";
import { fetchAskMyTwinFlag } from "../src/hooks/useAskMyTwinFlag";
import { fetchLatestEvidenceDate } from "../src/lib/evidenceFreshness";
import { ACTIVE_REGISTRY_SEED_VERSION } from "../supabase/functions/_shared/witnessFreshness";

// ── Fake Supabase query client ──────────────────────────────────────────────
// Applies .eq filters against plain row objects; no RLS — which is exactly
// the admin view-as situation the freshness test must survive.

type Row = Record<string, unknown>;

function fakeClient(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = tables[table] ?? [];
      const builder = {
        select(_cols: string) {
          return builder;
        },
        eq(col: string, val: unknown) {
          rows = rows.filter((r) => r[col] === val);
          return builder;
        },
        order(col: string, opts: { ascending: boolean }) {
          rows = [...rows].sort((a, b) => {
            const av = String(a[col] ?? "");
            const bv = String(b[col] ?? "");
            return opts.ascending ? av.localeCompare(bv) : bv.localeCompare(av);
          });
          return builder;
        },
        limit(n: number) {
          return Promise.resolve({ data: rows.slice(0, n), error: null });
        },
        maybeSingle() {
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
      };
      return builder;
    },
  };
}

// ── 1. Cohort flag identifier ───────────────────────────────────────────────

describe("fetchAskMyTwinFlag — profiles.id vs profiles.user_id", () => {
  // The regression fixture: id and user_id deliberately differ, and a row
  // exists whose *id* equals the auth UUID but belongs to a DIFFERENT,
  // non-enabled person. Filtering on the wrong column finds the wrong row.
  const AUTH_A = "auth-user-a";
  const tables = {
    profiles: [
      {
        id: "profile-row-random-uuid",
        user_id: AUTH_A,
        ask_my_twin_release0_enabled: true,
      },
      {
        id: AUTH_A, // trap: someone else's profile PK collides with A's auth id
        user_id: "auth-user-b",
        ask_my_twin_release0_enabled: false,
      },
    ],
  };

  it("resolves the flag by auth user id even when profiles.id differs", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await fetchAskMyTwinFlag(fakeClient(tables) as any, AUTH_A)).toBe(
      true
    );
  });

  it("stays closed for a user whose flag is off", async () => {
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await fetchAskMyTwinFlag(fakeClient(tables) as any, "auth-user-b")
    ).toBe(false);
  });

  it("stays closed for a user with no profile row", async () => {
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await fetchAskMyTwinFlag(fakeClient(tables) as any, "auth-user-c")
    ).toBe(false);
  });
});

// ── 2. View-as freshness isolation ──────────────────────────────────────────

describe("fetchLatestEvidenceDate — view-as isolation", () => {
  // Patient A's latest witness: Aug 2. Patient B's: Aug 8. The fake client
  // has no RLS (like an admin session). Viewing A must say Aug 2 — never
  // B's Aug 8.
  const tables = {
    witness_objects: [
      {
        user_id: "patient-a",
        registry_seed_version: ACTIVE_REGISTRY_SEED_VERSION,
        biological_timestamp: "2026-08-02T09:00:00Z",
      },
      {
        user_id: "patient-a",
        registry_seed_version: ACTIVE_REGISTRY_SEED_VERSION,
        biological_timestamp: "2026-07-15T09:00:00Z",
      },
      {
        user_id: "patient-b",
        registry_seed_version: ACTIVE_REGISTRY_SEED_VERSION,
        biological_timestamp: "2026-08-08T09:00:00Z",
      },
      {
        // stale-seed row for A, newer date: must also be excluded
        user_id: "patient-a",
        registry_seed_version: "some_future_seed",
        biological_timestamp: "2026-08-09T09:00:00Z",
      },
    ],
  };

  it("admin viewing Patient A sees Aug 2, never Patient B's Aug 8", async () => {
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await fetchLatestEvidenceDate(fakeClient(tables) as any, "patient-a")
    ).toBe("2026-08-02");
  });

  it("Patient B sees their own Aug 8", async () => {
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await fetchLatestEvidenceDate(fakeClient(tables) as any, "patient-b")
    ).toBe("2026-08-08");
  });

  it("only the active registry seed counts", async () => {
    // Patient A's newest row overall is Aug 9 under a non-active seed;
    // the governed clock must ignore it.
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await fetchLatestEvidenceDate(fakeClient(tables) as any, "patient-a")
    ).not.toBe("2026-08-09");
  });

  it("no witnesses → null, never fabricated", async () => {
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await fetchLatestEvidenceDate(fakeClient(tables) as any, "patient-z")
    ).toBeNull();
  });
});
