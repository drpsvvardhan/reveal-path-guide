// ============================================================================
// supabase/functions/_shared/witnessifyDirectForUser.ts
// ----------------------------------------------------------------------------
// Per-user backfill of lab / inbody / fibroscan witnesses, scoped to a
// single user. Designed to be called lazily from edge functions that need
// witness coverage of a user's direct observations before reasoning
// (e.g. generate-terrain-render). Idempotent via Pattern Z upserts on
// (user_id, source_table, source_row_id, registry_seed_version).
// ============================================================================

import {
  witnessifyObservation,
  type DirectObservationInput,
  type WitnessifyOptions,
} from "./witnessify_impl.ts";
import { type WitnessObject } from "./witness.ts";
import { loadRegistryFromSupabase } from "./witnessRegistry.ts";

const DEFAULT_REGISTRY_SEED_VERSION = "p1a_initial";

type Win = "lab" | "inbody" | "fibroscan";

function classify(source: string | null): Win {
  if (source === null) return "lab";
  const s = source.toLowerCase();
  if (s === "inbody") return "inbody";
  if (s === "fibroscan") return "fibroscan";
  return "lab";
}

function toIso(d: string): string {
  return d.includes("T") ? d : `${d}T00:00:00.000Z`;
}

function buildTestimony(row: any, win: Win): string {
  const rawName = row.raw_name ?? row.canonical_name ?? row.canonical_concept_id ?? "unknown";
  const label = win === "inbody" ? "InBody composition"
    : win === "fibroscan" ? "FibroScan elastography"
    : "lab panel";
  const ref = row.ref_low != null && row.ref_high != null
    ? ` Reference range: ${row.ref_low}–${row.ref_high} ${row.unit}.` : "";
  const flag = row.flag ? ` Flagged as ${row.flag}.` : "";
  return `Observed value ${row.value} ${row.unit} for ${rawName} on ${row.collection_date}, captured via ${label}.${ref}${flag}`;
}

export interface DirectWitnessifyResult {
  scanned: number;
  produced: number;
  inserted: number;
  registry_misses: number;
  validation_failures: number;
}

/**
 * Witnessify every patient_lab_observations row for `userId` that isn't
 * already represented in witness_objects for the active registry seed.
 * Safe to call on every terrain-generation request: existing rows
 * conflict-skip on the unique index.
 */
export async function witnessifyDirectForUser(
  // deno-lint-ignore no-explicit-any
  sb: any,
  userId: string,
  registrySeedVersion: string = DEFAULT_REGISTRY_SEED_VERSION,
): Promise<DirectWitnessifyResult> {
  const result: DirectWitnessifyResult = {
    scanned: 0, produced: 0, inserted: 0,
    registry_misses: 0, validation_failures: 0,
  };

  const { data: existing } = await sb
    .from("witness_objects")
    .select("source_row_id")
    .eq("user_id", userId)
    .eq("source_table", "patient_lab_observations")
    .eq("registry_seed_version", registrySeedVersion);
  const seen = new Set<string>((existing ?? []).map((r: any) => r.source_row_id));

  const { data: rows, error } = await sb
    .from("patient_lab_observations")
    .select(
      "id, user_id, canonical_concept_id, canonical_name, value, unit, " +
      "collection_date, source, raw_name, display_name, ref_low, ref_high, flag"
    )
    .eq("user_id", userId);
  if (error) throw new Error(`witnessifyDirectForUser read: ${error.message}`);

  const todo = (rows ?? []).filter((r: any) => r.canonical_concept_id && !seen.has(r.id));
  result.scanned = todo.length;
  if (todo.length === 0) return result;

  const { accessor } = await loadRegistryFromSupabase(sb, registrySeedVersion);
  const opts: WitnessifyOptions = {
    onRegistryMiss: "skip_with_warning",
    throwOnCatastrophic: false,
  };

  const witnesses: WitnessObject[] = [];
  for (const row of todo) {
    const win = classify(row.source);
    const input: DirectObservationInput = {
      user_id: userId,
      source_window: win,
      signal: `${win}.${row.canonical_concept_id}`,
      observed_value: row.value,
      observed_unit: row.unit,
      biological_timestamp: toIso(row.collection_date),
      derived_from_packet_id: null,
      source_table: "patient_lab_observations",
      source_row_id: row.id,
      testimony: buildTestimony(row, win),
    };
    const out = witnessifyObservation(input, accessor, opts);
    result.registry_misses += out.registry_misses.length;
    result.validation_failures += out.validation_failures.length;
    if (out.witnesses) witnesses.push(out.witnesses);
  }
  result.produced = witnesses.length;
  if (witnesses.length === 0) return result;

  const BATCH = 200;
  for (let i = 0; i < witnesses.length; i += BATCH) {
    const batch = witnesses.slice(i, i + BATCH).map((w) => ({
      witness_id: w.witness_id,
      user_id: w.user_id,
      derived_from_packet_id: w.derived_from_packet_id,
      source_table: w.source_table,
      source_row_id: w.source_row_id,
      ancestry_witness_ids: w.ancestry_witness_ids,
      source_window: w.source_window,
      signal: w.signal,
      domain_of_access: w.domain_of_access,
      epistemic_role: w.epistemic_role,
      reliability_class: w.reliability_class,
      compression_depth: w.compression_depth,
      observed_value: w.observed_value,
      observed_unit: w.observed_unit,
      testimony: w.testimony,
      limitations: w.limitations,
      confidence_value: w.confidence_value,
      confidence_basis: w.confidence_basis,
      biological_timestamp: w.biological_timestamp,
      validity_window_seconds: w.validity_window_seconds,
      conflict_candidates: w.conflict_candidates,
      transformation_version: w.transformation_version,
      registry_seed_version: w.registry_seed_version,
    }));
    const { data, error: insErr } = await sb
      .from("witness_objects")
      .upsert(batch, {
        onConflict: "user_id,source_table,source_row_id,registry_seed_version",
        ignoreDuplicates: true,
      })
      .select("witness_id");
    if (insErr) throw new Error(`witnessifyDirectForUser insert: ${insErr.message}`);
    result.inserted += (data ?? []).length;
  }
  return result;
}