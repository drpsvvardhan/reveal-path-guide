// src/lib/defineTermClient.ts
//
// Client-side resolver shim for the witness-bound `define-term` edge
// function. Owns:
//   - hot cache (in-memory, page-view session)
//   - session cache (sessionStorage, survives navigation but not tab
//     restart)
//   - patient_state_hash so cache invalidates naturally when the
//     DefinitionContext changes
//
// See docs/UCDE_DEFINITION_CONTEXT_MAPPING_v1.md → Phase B v2.

import { supabase } from "@/integrations/supabase/client";
import type { DefinitionContext } from "@/types/definitionContext";

export interface DefineTermResponse {
  definition: string;
  grounding: string | null;
  citations: Array<{ field: string; value: string }> | null;
  vizzhy_concept_mapped: boolean;
  cache_key: string;
  trace: {
    model: string;
    fields_consulted: string[];
    fallback_reason?: string;
    ontology_leakage_detected?: boolean;
    ontology_leakage_terms?: string[];
  };
}

const SESSION_PREFIX = "vizzhy:define-term:";
const hot = new Map<string, DefineTermResponse>();

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function patientStateHash(ctx: DefinitionContext | null | undefined): string {
  return fnv1a(JSON.stringify(ctx ?? {}));
}

export function buildKey(
  term: string,
  ctx: DefinitionContext | null | undefined,
  patientId: string | null
): string {
  return `${term.toLowerCase().trim()}:${patientId ?? "anon"}:${patientStateHash(ctx)}`;
}

function readSession(key: string): DefineTermResponse | null {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as DefineTermResponse;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: DefineTermResponse): void {
  try {
    sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota / disabled — ignore.
  }
}

export interface ResolveOpts {
  term: string;
  sentence?: string;
  sectionContext?: string;
  definitionContext: DefinitionContext | null;
  patientId: string | null;
  signal?: AbortSignal;
}

export async function resolveDefineTerm(
  opts: ResolveOpts
): Promise<DefineTermResponse> {
  const { term, sentence = "", sectionContext = "", definitionContext, patientId, signal } = opts;
  const key = buildKey(term, definitionContext, patientId);

  const hit = hot.get(key) ?? readSession(key);
  if (hit) {
    hot.set(key, hit);
    return hit;
  }

  const { data, error } = await supabase.functions.invoke("define-term", {
    body: {
      term,
      sentence,
      section_context: sectionContext,
      patient_id: patientId,
      definition_context: definitionContext,
    },
  });

  if (signal?.aborted) {
    throw new DOMException("aborted", "AbortError");
  }

  if (error || !data) {
    throw error ?? new Error("define-term: empty response");
  }

  const payload = data as DefineTermResponse;
  hot.set(key, payload);
  writeSession(key, payload);
  return payload;
}

/** Best-effort background prefetch. Silent on failure. Never throws. */
export async function prefetchDefineTerm(
  term: string,
  definitionContext: DefinitionContext | null,
  patientId: string | null
): Promise<void> {
  const key = buildKey(term, definitionContext, patientId);
  if (hot.has(key) || readSession(key)) return;
  try {
    await resolveDefineTerm({ term, definitionContext, patientId });
  } catch {
    // silent
  }
}