// ============================================================================
// src/lib/manifestDiff.ts
// ----------------------------------------------------------------------------
// Minimal recursive diff between two JSON-serializable manifest objects.
// Used by the /manifest-preview "Diff vs sample" panel. No external deps.
// ============================================================================

export type DiffKind = "added" | "removed" | "changed";

export interface DiffEntry {
  path: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function shortVal(v: unknown): string {
  if (v === undefined) return "undefined";
  try {
    const s = JSON.stringify(v);
    if (s.length > 80) return s.slice(0, 77) + "…";
    return s;
  } catch {
    return String(v);
  }
}

/**
 * Stable JSON stringify with sorted object keys. Used to compare values
 * (notably arrays of objects) without being fooled by key-ordering
 * differences introduced by parsers like Zod, which re-emits object keys
 * in schema-declaration order.
 */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) {
    return "[" + v.map(stableStringify).join(",") + "]";
  }
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

/**
 * Compute a flat list of diffs from `before` to `after`.
 * - Object children are diffed recursively.
 * - Arrays are compared as opaque values (changed if not deep-equal).
 * - Primitives are compared with strict equality.
 */
export function diffManifests(
  before: unknown,
  after: unknown,
  basePath = "",
): DiffEntry[] {
  if (before === after) return [];

  // Both objects → recurse.
  if (isObject(before) && isObject(after)) {
    const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
    const out: DiffEntry[] = [];
    for (const k of Array.from(keys).sort()) {
      const path = basePath ? `${basePath}.${k}` : k;
      const a = before[k];
      const b = after[k];
      if (a === undefined && b !== undefined) {
        out.push({ path, kind: "added", after: b });
      } else if (a !== undefined && b === undefined) {
        out.push({ path, kind: "removed", before: a });
      } else {
        out.push(...diffManifests(a, b, path));
      }
    }
    return out;
  }

  // Fallback: deep-equal via stable JSON; otherwise mark as changed.
  let equal = false;
  try {
    equal = stableStringify(before) === stableStringify(after);
  } catch {
    equal = false;
  }
  if (equal) return [];
  return [{ path: basePath || "(root)", kind: "changed", before, after }];
}

export const formatDiffValue = shortVal;