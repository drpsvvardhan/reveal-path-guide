import { createHash } from "node:crypto";
import type { Hash } from "./types.ts";

function canonicalValue(value: unknown): unknown {
  if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("Canonical JSON forbids non-finite numbers.");
  if (["bigint", "function", "symbol"].includes(typeof value)) throw new TypeError(`Canonical JSON forbids ${typeof value}.`);
  if (Array.isArray(value)) {
    if (value.some((entry) => entry === undefined)) throw new TypeError("Canonical JSON forbids undefined array entries.");
    return value.map(canonicalValue);
  }
  if (value && typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new TypeError("Canonical JSON accepts only plain objects and arrays.");
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, nested]) => [key, canonicalValue(nested)]),
    );
  }
  return value;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function contentHash(value: unknown): Hash {
  return `sha256:${createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}

export function withoutHash<T extends Record<string, unknown>>(value: T, key: keyof T): Omit<T, keyof T> & Record<string, unknown> {
  const clone = { ...value };
  delete clone[key];
  return clone as Omit<T, keyof T> & Record<string, unknown>;
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

export function assertHash(value: Record<string, unknown>, key: string, expected: Hash): boolean {
  const clone = { ...value };
  delete clone[key];
  return contentHash(clone) === expected;
}
