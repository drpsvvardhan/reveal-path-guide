// tests/witness-freshness.test.ts
//
// witnessFreshness.ts is THE single semantic source for "evidence available
// through" — shared by the server runtime (contextLoader → receipt
// latest_witness_as_of) and the patient UI (home freshness line). These
// tests pin the derivation rule both sides depend on.

import { describe, it, expect } from "vitest";
import {
  ACTIVE_REGISTRY_SEED_VERSION,
  deriveLatestBiologicalTimestamp,
} from "../supabase/functions/_shared/witnessFreshness.ts";

describe("deriveLatestBiologicalTimestamp", () => {
  it("returns the max short day across rows", () => {
    expect(
      deriveLatestBiologicalTimestamp([
        { biological_timestamp: "2026-08-02T10:00:00Z" },
        { biological_timestamp: "2026-08-07" },
        { biological_timestamp: "2025-12-31" },
      ])
    ).toBe("2026-08-07");
  });

  it("never fabricates freshness", () => {
    expect(deriveLatestBiologicalTimestamp([])).toBeNull();
    expect(
      deriveLatestBiologicalTimestamp([
        { biological_timestamp: null },
        { biological_timestamp: "garbage" },
      ])
    ).toBeNull();
  });
});

describe("ACTIVE_REGISTRY_SEED_VERSION", () => {
  it("is the P1a seed both runtime and UI filter on", () => {
    expect(ACTIVE_REGISTRY_SEED_VERSION).toBe("p1a_initial");
  });
});
