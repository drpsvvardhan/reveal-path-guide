// ============================================================================
// supabase/functions/_shared/biotwin/allowlist.ts
// ----------------------------------------------------------------------------
// CONSTITUTIONAL RULE: a patient JSON may never mint its own trust registry.
//
// Only signals declared here (and seeded into witness_signal_registry under
// registry_seed_version = 'biotwin_v1' by migration) may be projected into
// witness_objects. Every other confirmed measurement stays a governed
// biotwin_statements row and produces a "skipped witness" diagnostic.
//
// Adding a signal requires BOTH an entry here AND a registry seed row in a
// migration. Nothing about this list is derived from an uploaded file.
// ============================================================================

export interface BiotwinAllowlistEntry {
  /** Registry signal key (must exist in witness_signal_registry, seed biotwin_v1). */
  signal: string;
  /** Canonical unit. A measurement in any other unit is NOT projected. */
  unit: string;
  domain_of_access: string;
  reliability_class: string;
  /** Accepted raw names, normalized (lowercase, non-alphanumerics stripped). */
  aliases: string[];
}

export const BIOTWIN_WITNESS_ALLOWLIST: readonly BiotwinAllowlistEntry[] = [
  {
    signal: "biotwin_ldl_c",
    unit: "mg/dL",
    domain_of_access: "lipid_composition",
    reliability_class: "high",
    aliases: ["ldlc", "ldlcholesterol", "ldl"],
  },
  {
    signal: "biotwin_non_hdl_c",
    unit: "mg/dL",
    domain_of_access: "lipid_composition",
    reliability_class: "high",
    aliases: ["nonhdlc", "nonhdlcholesterol"],
  },
  {
    signal: "biotwin_apob",
    unit: "mg/dL",
    domain_of_access: "lipid_composition",
    reliability_class: "high",
    aliases: ["apob", "apolipoproteinb"],
  },
  {
    signal: "biotwin_ldl_p",
    unit: "nmol/L",
    domain_of_access: "lipid_composition",
    reliability_class: "medium",
    aliases: ["ldlp", "ldlparticlenumber"],
  },
  {
    signal: "biotwin_small_ldl_p",
    unit: "nmol/L",
    domain_of_access: "lipid_composition",
    reliability_class: "medium",
    aliases: ["smallldlp", "smallldlparticlenumber"],
  },
  {
    signal: "biotwin_lp_a",
    unit: "nmol/L",
    domain_of_access: "lipid_composition",
    reliability_class: "high",
    aliases: ["lpa", "lipoproteina"],
  },
  {
    signal: "biotwin_hs_crp",
    unit: "mg/L",
    domain_of_access: "biochemical_state_snapshot",
    reliability_class: "medium",
    aliases: ["hscrp", "highsensitivitycrp"],
  },
  {
    signal: "biotwin_hba1c",
    unit: "%",
    domain_of_access: "biochemical_state_snapshot",
    reliability_class: "high",
    aliases: ["hba1c", "a1c", "glycatedhaemoglobin", "glycatedhemoglobin"],
  },
  {
    signal: "biotwin_tsh",
    unit: "uIU/mL",
    domain_of_access: "biochemical_state_snapshot",
    reliability_class: "high",
    aliases: ["tsh", "thyroidstimulatinghormone"],
  },
  {
    signal: "biotwin_fasting_glucose",
    unit: "mg/dL",
    domain_of_access: "biochemical_state_snapshot",
    reliability_class: "high",
    aliases: ["fastingglucose", "glucosefasting"],
  },
];

export function normalizeSignalName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function lookupAllowlist(rawName: string): BiotwinAllowlistEntry | null {
  const n = normalizeSignalName(rawName);
  for (const entry of BIOTWIN_WITNESS_ALLOWLIST) {
    if (entry.aliases.includes(n)) return entry;
  }
  return null;
}

export function unitsMatch(entry: BiotwinAllowlistEntry, unit: string | null): boolean {
  if (!unit) return false;
  return normalizeSignalName(entry.unit) === normalizeSignalName(unit);
}