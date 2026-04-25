// ============================================================================
// supabase/functions/rae-admit-observation/request_schema.ts
// ----------------------------------------------------------------------------
// Zod request schema for the RAE admit-observation edge function.
// Source of truth: docs/RAE_ADMIT_OBSERVATION_EDGE_DESIGN_v1.md §5.1.
//
// Discipline:
//   - Pure schema declarations. No I/O. No DB access. No raw SQL.
//   - `.strict()` everywhere — unknown keys are rejected at the boundary.
//   - Field-for-field aligned with `_shared/rae/orchestrator.ts`
//     `CandidateConcept` (C7). Drift here is a release blocker.
// ============================================================================

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ---------------------------------------------------------------------------
// Sub-schemas mirrored from orchestrator.ts.
// ---------------------------------------------------------------------------

export const UnitConversionSchema = z.object({
  to_canonical_factor: z.number().finite(),
  offset: z.number().finite().optional(),
}).strict();

export const RangePairSchema = z.object({
  low: z.number().finite().nullable(),
  high: z.number().finite().nullable(),
}).strict();

export const CandidateConceptSchema = z.object({
  // D-10: ontology / RAE concept identity strings are not row UUIDs.
  // They are stable identity tokens (e.g. "HbA1c", "concept_hba1c") and
  // must accept any non-empty string. True row IDs (source_row_id,
  // user_id, engine_version_id, back_annotation_witness_id, request_id)
  // remain uuid-validated below.
  concept_id: z.string().min(1),
  canonical_name: z.string().min(1),
  synonyms: z.array(z.string()).optional(),
  ambiguous_alternatives: z.array(z.string()).optional(),
  canonical_unit: z.string().min(1),
  unit_conversions: z.record(UnitConversionSchema).optional(),
  plausibility_band: RangePairSchema.nullable(),
  known_assays: z.array(z.string()).optional(),
  method_optional: z.boolean().optional(),
  canonical_reference_range: RangePairSchema.nullable(),
  // D-10: panel members are concept identity strings, not row UUIDs.
  expected_panel_concept_ids: z.array(z.string().min(1)).optional(),
  panel_id: z.string().nullable().optional(),
  dynamics_rule_id: z.string().nullable(),
  delta_ceiling: z.number().finite().nullable(),
}).strict();

export const RawObservationClaimSchema = z.object({
  source_table: z.string().min(1),
  source_row_id: z.string().uuid(),
  user_id: z.string().uuid(),
  raw_name: z.string().min(1),
  raw_unit: z.string().nullable(),
  raw_value: z.number().finite().nullable(),
  raw_method: z.string().nullable(),
  raw_reference_low: z.number().finite().nullable(),
  raw_reference_high: z.number().finite().nullable(),
  observed_at: z.string().datetime({ offset: true }),
  panel_grouping_key: z.string().nullable(),
  // Optional ontology concept id for THIS row. Currently consumed only
  // for `siblings[]` to project into PanelSibling; ignored elsewhere.
  // Sibling rows that omit this field are dropped at the wiring boundary
  // and counted in `diagnostics.dropped_siblings` of the success response.
  // Not split into a separate schema for now (single-shape policy).
  // D-10: concept identity string, not a row UUID.
  concept_id: z.string().min(1).optional(),
}).strict();

export const PolicyOverrideSchema = z.enum([
  "default",
  "calibration_all_routes_to_review",
  "back_annotation",
]);

export const RequestSchema = z.object({
  engine_version_id: z.string().uuid(),
  claim: RawObservationClaimSchema,
  candidate_concept: CandidateConceptSchema,
  siblings: z.array(RawObservationClaimSchema).max(64).default([]),
  prior_observations: z.array(RawObservationClaimSchema).max(256).default([]),
  policy_override: PolicyOverrideSchema.optional(),
  // Required iff policy_at_decision will be 'back_annotation'. The edge
  // function never invents a witness id; storage layer enforces presence.
  back_annotation_witness_id: z.string().uuid().optional(),
  // Caller correlation hint. Log-only (see design §10).
  request_id: z.string().uuid().optional(),
}).strict();

export type AdmitObservationRequest = z.infer<typeof RequestSchema>;
export type AdmitObservationCandidateConcept = z.infer<typeof CandidateConceptSchema>;
export type AdmitObservationClaim = z.infer<typeof RawObservationClaimSchema>;
export type PolicyOverrideValue = z.infer<typeof PolicyOverrideSchema>;