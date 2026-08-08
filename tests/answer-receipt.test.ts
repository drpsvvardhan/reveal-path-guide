// tests/answer-receipt.test.ts
//
// Answer Receipt v1 — canonical hashing, freshness clocks, token
// estimation. These are the pure primitives patient-chat uses to build the
// receipt; the doctrine they enforce lives in
// docs/ASK_MY_TWIN_CONSTITUTION.md:
//
//   - Hashes bind to what the model actually saw: canonical serialization
//     (stable key order) before hashing.
//   - Two freshness clocks, never one ambiguous cutoff; latest_witness_as_of
//     never fabricates a date when none is witnessed.

import { describe, it, expect } from "vitest";
import {
  canonicalStringify,
  sha256Hex,
  estimateTokens,
  latestWitnessDate,
  RUNTIME_VERSION,
  PROMPT_TEMPLATE_VERSION,
} from "../supabase/functions/_shared/receipt.ts";
import { AUTHORITY_POLICY_VERSION } from "../supabase/functions/_shared/clinicalAuthorityPolicy.ts";
import { DOSE_POLICY_VERSION } from "../supabase/functions/_shared/dosePolicy.ts";
import { BIOTWIN_VALIDATOR_VERSION } from "../supabase/functions/_shared/biotwin/packet.ts";

describe("canonicalStringify", () => {
  it("is stable under key-order permutation", () => {
    const a = { b: 1, a: { z: [3, 2], y: "x" }, c: null };
    const b = { c: null, a: { y: "x", z: [3, 2] }, b: 1 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("does not reorder arrays (order is meaning)", () => {
    expect(canonicalStringify([2, 1])).not.toBe(canonicalStringify([1, 2]));
  });

  it("sorts nested object keys recursively", () => {
    expect(canonicalStringify({ b: { d: 1, c: 2 }, a: 3 })).toBe(
      '{"a":3,"b":{"c":2,"d":1}}'
    );
  });
});

describe("sha256Hex", () => {
  it("matches the known SHA-256 vector for 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("differs when canonical input differs", async () => {
    const h1 = await sha256Hex(canonicalStringify({ a: 1 }));
    const h2 = await sha256Hex(canonicalStringify({ a: 2 }));
    expect(h1).not.toBe(h2);
  });

  it("is identical for permuted objects after canonicalization", async () => {
    const h1 = await sha256Hex(canonicalStringify({ a: 1, b: 2 }));
    const h2 = await sha256Hex(canonicalStringify({ b: 2, a: 1 }));
    expect(h1).toBe(h2);
  });
});

describe("latestWitnessDate", () => {
  it("returns the max ISO day across observations", () => {
    expect(
      latestWitnessDate(["2025-11-20", "2020-05-27", "2024-09-17"])
    ).toBe("2025-11-20");
  });

  it("truncates datetime strings to the day", () => {
    expect(latestWitnessDate(["2026-08-02T09:15:00Z"])).toBe("2026-08-02");
  });

  it("never fabricates freshness: null when nothing is dated", () => {
    expect(latestWitnessDate([])).toBeNull();
    expect(latestWitnessDate([null, undefined, "not-a-date"])).toBeNull();
  });

  it("skips malformed dates but keeps valid ones", () => {
    expect(latestWitnessDate(["garbage", "2024-01-05"])).toBe("2024-01-05");
  });
});

describe("estimateTokens", () => {
  it("rounds up chars/4", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });
});

describe("receipt version constants", () => {
  // Every receipt must stamp the exact policy versions that admitted the
  // answer. These constants existing (and being semver-shaped) is part of
  // the receipt contract.
  it("are present and semver-like", () => {
    for (const v of [
      AUTHORITY_POLICY_VERSION,
      DOSE_POLICY_VERSION,
      BIOTWIN_VALIDATOR_VERSION,
    ]) {
      expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(RUNTIME_VERSION).toMatch(/^r\d+\.\d+\.\d+$/);
    expect(PROMPT_TEMPLATE_VERSION).toMatch(/^pt-\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});
