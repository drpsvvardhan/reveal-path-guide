// ============================================================================
// src/lib/manifestSchema.ts
// ----------------------------------------------------------------------------
// Zod schema for the patient manifest paste/upload preview UI.
// Mirrors the shape of `PatientRevealManifest` in src/types/manifest.ts.
//
// Discipline:
//   - Required fields: patient.firstName, patient.age, patient.sex.
//     Everything else is optional so the previewer renders graceful
//     fallbacks for missing-field cases.
//   - No I/O. No backend calls.
// ============================================================================

import { z } from "zod";

const PatientSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    firstName: z
      .string({ required_error: "patient.firstName is required" })
      .trim()
      .min(1, { message: "patient.firstName cannot be empty" })
      .max(100, { message: "patient.firstName must be ≤100 chars" }),
    age: z
      .number({ required_error: "patient.age is required" })
      .int({ message: "patient.age must be an integer" })
      .min(0, { message: "patient.age must be ≥0" })
      .max(130, { message: "patient.age must be ≤130" }),
    sex: z
      .string({ required_error: "patient.sex is required" })
      .trim()
      .min(1, { message: "patient.sex cannot be empty" }),
  })
  .passthrough();

const StudyLayerSchema = z
  .object({
    id: z.string(),
    icon: z.string().optional().default(""),
    title: z.string(),
    description: z.string().optional().default(""),
    status: z.enum(["complete", "pending", "in-progress"]).optional(),
  })
  .passthrough();

const StudyOverviewSchema = z
  .object({
    summary: z.string().optional(),
    statLine: z.string().optional(),
    layers: z.array(StudyLayerSchema).optional().default([]),
  })
  .passthrough();

const ThesisSchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
  })
  .passthrough();

const HFItemSchema = z
  .object({ label: z.string(), mechanism: z.string().optional().default("") })
  .passthrough();

const HelpingFeedingSchema = z
  .object({
    helping: z.array(HFItemSchema).optional().default([]),
    feeding: z.array(HFItemSchema).optional().default([]),
  })
  .passthrough();

const ReversibilitySchema = z
  .object({
    weeks: z.array(z.string()).optional().default([]),
    months: z.array(z.string()).optional().default([]),
    slow: z.array(z.string()).optional().default([]),
    permanent: z.array(z.string()).optional().default([]),
    closingLine: z.string().optional(),
  })
  .passthrough();

const ConfidenceSchema = z
  .object({
    confident: z.array(z.string()).optional().default([]),
    investigating: z.array(z.string()).optional().default([]),
    retest: z.array(z.string()).optional().default([]),
  })
  .passthrough();

const MedicationCardSchema = z
  .object({
    name: z.string(),
    purpose: z.string().optional().default(""),
    dose: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

const CheckpointSchema = z
  .object({
    label: z.string(),
    date: z.string().optional().default(""),
    description: z.string().optional().default(""),
    owner: z.string().optional(),
    checking: z.string().optional(),
    whyItMatters: z.string().optional(),
  })
  .passthrough();

const ResponsibilitySchema = z
  .object({
    who: z.string(),
    tasks: z.array(z.string()).optional().default([]),
  })
  .passthrough();

const CareMapSchema = z
  .object({
    medications: z.array(MedicationCardSchema).optional().default([]),
    checkpoints: z.array(CheckpointSchema).optional().default([]),
    responsibilities: z.array(ResponsibilitySchema).optional().default([]),
  })
  .passthrough();

const TodayBarSchema = z
  .object({
    focus: z.string().optional().default(""),
    keyAction: z.string().optional().default(""),
    nextCheckpoint: z.string().optional().default(""),
    statusNote: z.string().optional().default(""),
    lastUpdated: z.string().optional(),
  })
  .passthrough();

const WeeklySnapshotSchema = z
  .object({
    keyImprovement: z.string().optional().default(""),
    fragileArea: z.string().optional().default(""),
    keepDoing: z.string().optional().default(""),
    periodLabel: z.string().optional(),
  })
  .passthrough();

const JourneyEventSchema = z
  .object({
    dateLabel: z.string(),
    title: z.string(),
    description: z.string().optional().default(""),
    status: z.enum(["complete", "current", "upcoming"]).optional(),
    icon: z
      .string()
      .max(8, { message: "patientJourney.timeline[].icon must be ≤8 chars" })
      .optional(),
  })
  .passthrough();

const PatientJourneySchema = z
  .object({
    timeline: z.array(JourneyEventSchema).optional().default([]),
    currentPhase: z.string().optional(),
    nextStep: z.string().optional(),
  })
  .passthrough();

export const ManifestPreviewSchema = z
  .object({
    schema_version: z
      .string()
      .trim()
      .regex(/^\d+\.\d+\.\d+$/, {
        message: "schema_version must look like '1.0.0'",
      })
      .optional(),
    patient: PatientSchema,
    todayBar: TodayBarSchema.optional(),
    weeklySnapshot: WeeklySnapshotSchema.optional(),
    studyOverview: StudyOverviewSchema.optional(),
    patientThesis: ThesisSchema.optional(),
    layerFindings: z.record(z.string()).optional(),
    helpingVsFeeding: HelpingFeedingSchema.optional(),
    symptomBridges: z.array(z.string()).optional(),
    reversibility: ReversibilitySchema.optional(),
    confidenceBreakdown: ConfidenceSchema.optional(),
    careMap: CareMapSchema.optional(),
    patientJourney: PatientJourneySchema.optional(),
  })
  .passthrough();

export type ManifestPreview = z.infer<typeof ManifestPreviewSchema>;

export interface FriendlyIssue {
  path: string;
  message: string;
}

/** Convert a ZodError into compact, human-readable issues. */
export function toFriendlyIssues(error: z.ZodError): FriendlyIssue[] {
  return error.issues.map((iss) => ({
    path: iss.path.length ? iss.path.join(".") : "(root)",
    message: iss.message,
  }));
}

export interface ParseResult {
  ok: boolean;
  data?: ManifestPreview;
  issues?: FriendlyIssue[];
  parseError?: string;
}

/** Parse raw JSON text and validate against the manifest schema. */
export function parseManifestJson(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, parseError: "Input is empty." };
  }
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch (e) {
    return {
      ok: false,
      parseError: e instanceof Error ? e.message : "Invalid JSON",
    };
  }
  const result = ManifestPreviewSchema.safeParse(json);
  if (!result.success) {
    return { ok: false, issues: toFriendlyIssues(result.error) };
  }
  return { ok: true, data: result.data };
}