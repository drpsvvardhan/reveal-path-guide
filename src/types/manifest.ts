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
