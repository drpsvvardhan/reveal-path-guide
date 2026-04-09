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
}

// ============================================================================
// QUESTION QUEUE TYPES
// ============================================================================

export interface QueuedQuestion {
  id: string;
  user_id: string;
  question: string;
  rationale: string | null;
  source: "auto" | "manual";
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
