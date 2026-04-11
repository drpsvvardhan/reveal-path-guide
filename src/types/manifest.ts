export interface PatientInfo {
  id: string;
  firstName: string;
  age: number;
  sex: string;
}

export interface StudyLayer {
  id: string;
  icon: string;
  title: string;
  description: string;
  status: "complete" | "pending" | "in-progress";
}

export interface StudyOverview {
  summary: string;
  statLine: string;
  layers: StudyLayer[];
}

export interface PatientThesis {
  title: string;
  body: string;
}

export interface HelpingFeedingItem {
  label: string;
  mechanism: string;
}

export interface HelpingVsFeeding {
  helping: HelpingFeedingItem[];
  feeding: HelpingFeedingItem[];
}

export interface Reversibility {
  weeks: string[];
  months: string[];
  slow: string[];
  permanent: string[];
  closingLine?: string;
}

export interface Action {
  title: string;
  description: string;
  details?: string;
  whyFirst?: string;
  whatItAffects?: string;
  whatToNotice?: string;
}

export interface ActionWithReason extends Action {
  why: string;
  unlockedWhen: string;
  unlockedBy: string;
}

export interface SequencedActions {
  startHere: Action;
  thenAdd: Action[];
  notYet: ActionWithReason[];
}

export interface DoctorQuestion {
  question: string;
  rationale: string;
}

export interface MonitoringItem {
  name: string;
  explanation: string;
  nextCheck: string;
}

export interface ExpectedProgress {
  weeks2: string;
  months3: string;
  months6: string;
  months12: string;
}

export interface ConfidenceBreakdown {
  confident: string[];
  investigating: string[];
  retest: string[];
}

export interface MedicationCard {
  name: string;
  purpose: string;
  dose?: string;
  notes?: string;
}

export interface Checkpoint {
  label: string;
  date: string;
  description: string;
  owner?: string;
  checking?: string;
  whyItMatters?: string;
}

export interface Responsibility {
  who: string;
  tasks: string[];
}

export interface CareMap {
  medications: MedicationCard[];
  checkpoints: Checkpoint[];
  responsibilities: Responsibility[];
}

export interface TeamMember {
  name: string;
  role: string;
  specialty?: string;
  contact?: string;
  watching?: string;
}

export interface Appointment {
  type: string;
  date: string;
  provider: string;
  notes?: string;
}

export interface CareTeam {
  physician: TeamMember;
  coach: TeamMember;
  appointments: Appointment[];
}

export interface Coach {
  starterQuestions: string[];
}

export interface TodayBar {
  focus: string;
  keyAction: string;
  nextCheckpoint: string;
  statusNote: string;
  lastUpdated?: string;
}

export interface WeeklySnapshot {
  keyImprovement: string;
  fragileArea: string;
  keepDoing: string;
  periodLabel?: string;
}

// ============================================================================
// RAW DATA TYPES — inputs to the derivation pipeline
// ============================================================================

export interface BiomarkerObservation {
  name: string;
  displayName?: string;
  value: number;
  unit: string;
  timestamp: string;
  refLow?: number;
  refHigh?: number;
  flag?: "low" | "normal" | "high" | "critical";
  source?: string;
}

export interface VitalSignObservation {
  type: "systolic_bp" | "diastolic_bp" | "heart_rate" | "weight_kg" | "bmi" | "waist_cm" | "spo2";
  value: number;
  timestamp: string;
  source?: string;
}

export interface SensorStreamDaily {
  date: string;
  sleep_hours?: number;
  deep_sleep_hours?: number;
  hrv_ms?: number;
  resting_hr?: number;
  steps?: number;
  active_minutes?: number;
  spo2_mean?: number;
  source?: string;
}

export interface SymptomLogEntry {
  date: string;
  symptom: string;
  severity: number;
  notes?: string;
}

export interface FoodLogDailySummary {
  date: string;
  total_calories?: number;
  sugar_grams?: number;
  protein_grams?: number;
  alcohol_drinks?: number;
  late_meal?: boolean;
  notable_foods?: string[];
}

export interface RawDataLayer {
  biomarkerTimeline?: BiomarkerObservation[];
  vitalSigns?: VitalSignObservation[];
  sensorStreams?: SensorStreamDaily[];
  symptomsJournal?: SymptomLogEntry[];
  foodLogSummary?: FoodLogDailySummary[];
}

// ============================================================================
// DERIVED PATTERN TYPES — outputs of the derivation pipeline
// ============================================================================

export type PatternCategory = "trend" | "threshold" | "contradiction" | "correlation" | "watchlist";
export type PatternSeverity = "critical" | "high" | "moderate" | "informational";
export type PatternStatus = "active" | "resolved" | "dismissed";

export interface PatternEvidence {
  source: string;
  description: string;
  values: any[];
}

export interface DerivedPattern {
  id: string;
  user_id: string;
  rule_id: string;
  rule_version: number;
  category: PatternCategory;
  severity: PatternSeverity;
  title: string;
  summary: string;
  evidence: PatternEvidence;
  generated_question_id: string | null;
  first_detected_at: string;
  last_confirmed_at: string;
  status: PatternStatus;
  dismissed_at: string | null;
}

export interface RuleDetection {
  rule_id: string;
  rule_version: number;
  category: PatternCategory;
  severity: PatternSeverity;
  title: string;
  summary: string;
  evidence: PatternEvidence;
  suggested_question?: {
    question: string;
    rationale: string;
  };
}

// ============================================================================
// MANIFEST
// ============================================================================

export interface PatientRevealManifest {
  patient: PatientInfo;
  studyOverview: StudyOverview;
  patientThesis: PatientThesis;
  layerFindings: Record<string, string>;
  helpingVsFeeding: HelpingVsFeeding;
  symptomBridges: string[];
  reversibility: Reversibility;
  sequencedActions: SequencedActions;
  doctorQuestions: DoctorQuestion[];
  monitoringPlan: MonitoringItem[];
  expectedProgress: ExpectedProgress;
  confidenceBreakdown: ConfidenceBreakdown;
  careMap: CareMap;
  careTeam: CareTeam;
  coach: Coach;
  todayBar?: TodayBar;
  weeklySnapshot?: WeeklySnapshot;
  rawData?: RawDataLayer;
}

// ============================================================================
// QUESTION QUEUE TYPES
// ============================================================================

export interface QueuedQuestion {
  id: string;
  user_id: string;
  question: string;
  rationale: string | null;
  source: "auto" | "manual" | "derived";
  status: "queued" | "archived";
  priority: number;
  source_user_message: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface QueueShareInfo {
  shareToken: string | null;
  shareUrl: string | null;
}

// ============================================================================
// GENERATED NARRATIVE TYPES
// ============================================================================

/**
 * The shape of a generated narrative as produced by the LLM pipeline.
 * This is a subset of PatientRevealManifest — only the fields that are
 * narrative prose. Structural fields (patient, careMap, careTeam, studyOverview)
 * are not generated because they come from other sources.
 */
export interface GeneratedNarrativeFields {
  patientThesis: PatientThesis;
  layerFindings: Record<string, string>;
  helpingVsFeeding: HelpingVsFeeding;
  symptomBridges: string[];
  reversibility: Reversibility;
  sequencedActions: SequencedActions;
  expectedProgress: ExpectedProgress;
  confidenceBreakdown: ConfidenceBreakdown;
}

export type NarrativeStatus = "active" | "superseded" | "failed";

export interface PatientNarrativeVersion {
  id: string;
  user_id: string;
  version: number;
  narrative: GeneratedNarrativeFields;
  model_used: string;
  generation_ms: number | null;
  input_pattern_count: number | null;
  input_biomarker_count: number | null;
  status: NarrativeStatus;
  validation_error: string | null;
  retry_count: number;
  created_at: string;
}

export interface NarrativeGenerationResult {
  success: boolean;
  version?: number;
  generation_ms?: number;
  retry_count?: number;
  error?: string;
  validation_error?: string;
}

// ============================================================================
// LAB UPLOAD TYPES — Phase 5
// ============================================================================

export type LabUploadStatus = "uploaded" | "processing" | "complete" | "failed";

export interface LabUpload {
  id: string;
  user_id: string;
  original_filename: string;
  storage_path: string;
  file_size_bytes: number | null;
  source_lab: string | null;
  collection_date: string | null;
  ordering_provider: string | null;
  status: LabUploadStatus;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  observations_extracted: number | null;
  observations_inserted: number | null;
  observations_duplicates: number | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface LabObservationRow {
  id: string;
  user_id: string;
  upload_id: string;
  raw_name: string;
  canonical_name: string;
  display_name: string | null;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  flag: "low" | "normal" | "high" | "critical" | null;
  collection_date: string;
  source: string | null;
  corrected: boolean;
  original_value: number | null;
  corrected_at: string | null;
  created_at: string;
}

export interface LabUploadProcessResult {
  success: boolean;
  observations_extracted?: number;
  observations_inserted?: number;
  observations_duplicates?: number;
  source_lab?: string | null;
  collection_date?: string | null;
  error?: string;
}

// ============================================================================
// ONBOARDING TYPES — Phase 7
// ============================================================================

export type OnboardingStep = "welcome" | "profile" | "intake" | "upload" | "processing" | "complete" | "done";

export interface PatientProfile {
  user_id: string;
  first_name: string | null;
  age: number | null;
  sex: "female" | "male" | "other" | "prefer_not_to_say" | null;
  signature_color: string | null;
  study_summary: string | null;
  onboarding_step: OnboardingStep;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;
  first_time_banner_dismissed_at: string | null;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingFormState {
  first_name: string;
  age: string;
  sex: PatientProfile["sex"];
}

export interface OnboardingProcessingState {
  pdf_uploaded: boolean;
  observations_extracted: number;
  intake_scored: boolean;
  derivation_complete: boolean;
  patterns_detected: number;
  narrative_complete: boolean;
  current_status: string;
  error: string | null;
}
