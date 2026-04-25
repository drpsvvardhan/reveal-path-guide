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
    equal = JSON.stringify(before) === JSON.stringify(after);
  } catch {
    equal = false;
  }
  if (equal) return [];
  return [{ path: basePath || "(root)", kind: "changed", before, after }];
}

export const formatDiffValue = shortVal;