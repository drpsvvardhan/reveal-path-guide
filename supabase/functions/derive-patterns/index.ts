import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TYPE SHIMS (mirror the frontend types)
// ============================================================================

type PatternCategory = "trend" | "threshold" | "contradiction" | "correlation" | "watchlist";
type PatternSeverity = "critical" | "high" | "moderate" | "informational";

interface BiomarkerObservation {
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

interface VitalSignObservation {
  type: string;
  value: number;
  timestamp: string;
  source?: string;
}

interface SensorStreamDaily {
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

interface SymptomLogEntry {
  date: string;
  symptom: string;
  severity: number;
  notes?: string;
}

interface FoodLogDailySummary {
  date: string;
  total_calories?: number;
  sugar_grams?: number;
  protein_grams?: number;
  alcohol_drinks?: number;
  late_meal?: boolean;
  notable_foods?: string[];
}

interface RawDataLayer {
  biomarkerTimeline?: BiomarkerObservation[];
  vitalSigns?: VitalSignObservation[];
  sensorStreams?: SensorStreamDaily[];
  symptomsJournal?: SymptomLogEntry[];
  foodLogSummary?: FoodLogDailySummary[];
}

interface RuleDetection {
  rule_id: string;
  rule_version: number;
  category: PatternCategory;
  severity: PatternSeverity;
  title: string;
  summary: string;
  evidence: {
    source: string;
    description: string;
    values: any[];
  };
  suggested_question?: {
    question: string;
    rationale: string;
  };
}

// ============================================================================
// HELPER UTILITIES
// ============================================================================

function sortByDate<T extends { timestamp?: string; date?: string }>(items: T[], ascending = true): T[] {
  return [...items].sort((a, b) => {
    const aDate = (a.timestamp || a.date || "").toString();
    const bDate = (b.timestamp || b.date || "").toString();
    return ascending ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
  });
}

function filterByName(observations: BiomarkerObservation[], name: string): BiomarkerObservation[] {
  return observations.filter((o) => o.name.toLowerCase() === name.toLowerCase());
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

// ============================================================================
// RULE 1 — Biomarker trend detection
// Fires when a biomarker shows three or more consecutive measurements moving
// in the same direction (up or down) by a meaningful amount.
// ============================================================================

function ruleBiomarkerTrend(raw: RawDataLayer): RuleDetection[] {
  const results: RuleDetection[] = [];
  const timeline = raw.biomarkerTimeline || [];
  if (timeline.length < 3) return results;

  // Group by biomarker name
  const byName: Record<string, BiomarkerObservation[]> = {};
  for (const obs of timeline) {
    const key = obs.name;
    if (!byName[key]) byName[key] = [];
    byName[key].push(obs);
  }

  for (const [name, observations] of Object.entries(byName)) {
    if (observations.length < 3) continue;
    const sorted = sortByDate(observations, true); // oldest first
    const recent = sorted.slice(-3); // last three measurements

    // Check if monotonically increasing or decreasing
    const values = recent.map((o) => o.value);
    const isRising = values[0] < values[1] && values[1] < values[2];
    const isFalling = values[0] > values[1] && values[1] > values[2];

    if (!isRising && !isFalling) continue;

    // Check that the change is meaningful — more than 5% from first to last
    const pctChange = Math.abs((values[2] - values[0]) / values[0]);
    if (pctChange < 0.05) continue;

    const direction = isRising ? "rising" : "falling";
    const firstVal = values[0];
    const lastVal = values[2];
    const firstDate = recent[0].timestamp.slice(0, 10);
    const lastDate = recent[2].timestamp.slice(0, 10);
    const unit = recent[0].unit;

    // Determine severity based on whether values are crossing reference range
    const refHigh = recent[2].refHigh;
    const refLow = recent[2].refLow;
    let severity: PatternSeverity = "moderate";
    if (isRising && refHigh != null && lastVal > refHigh) {
      severity = lastVal > refHigh * 1.25 ? "high" : "moderate";
    } else if (isFalling && refLow != null && lastVal < refLow) {
      severity = lastVal < refLow * 0.75 ? "high" : "moderate";
    } else if (recent[2].flag === "normal") {
      severity = "informational";
    }

    results.push({
      rule_id: `biomarker_trend_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      rule_version: 1,
      category: "trend",
      severity,
      title: `${name} ${direction}`,
      summary: `Your ${name} has been ${direction} over the last three measurements — from ${firstVal} ${unit} on ${firstDate} to ${lastVal} ${unit} on ${lastDate}. ${direction === "rising" && refHigh != null && lastVal > refHigh ? "The most recent value is above the normal range." : direction === "falling" && refLow != null && lastVal < refLow ? "The most recent value is below the normal range." : "The values are still within normal range, but the direction is worth noting."}`,
      evidence: {
        source: "biomarker_timeline",
        description: `Three most recent ${name} measurements`,
        values: recent.map((o) => ({ value: o.value, unit: o.unit, date: o.timestamp.slice(0, 10), flag: o.flag })),
      },
      suggested_question:
        severity === "high" || severity === "moderate"
          ? {
              question: `My ${name} has been ${direction} across three measurements — from ${firstVal} to ${lastVal} ${unit}. What could be driving that, and what should we do?`,
              rationale: `This pattern spans several months of lab work and is the kind of directional change worth discussing before the next appointment.`,
            }
          : undefined,
    });
  }

  return results;
}

// ============================================================================
// RULE 2 — Biomarker threshold flag
// Fires when the most recent measurement of a key biomarker is outside its
// reference range and the crossing is meaningful.
// ============================================================================

function ruleBiomarkerThreshold(raw: RawDataLayer): RuleDetection[] {
  const results: RuleDetection[] = [];
  const timeline = raw.biomarkerTimeline || [];

  // Key biomarkers we flag — extend this list later as more rules come online
  const keyMarkers = ["LDL-C", "HbA1c", "CRP", "Vitamin D", "TSH", "ALT", "eGFR"];

  for (const markerName of keyMarkers) {
    const observations = filterByName(timeline, markerName);
    if (observations.length === 0) continue;

    const mostRecent = sortByDate(observations, false)[0]; // newest first
    const { value, unit, refLow, refHigh, flag, timestamp } = mostRecent;

    if (flag !== "high" && flag !== "low" && flag !== "critical") continue;

    let severity: PatternSeverity = "moderate";
    let direction = "";
    let crossingAmount = 0;

    if (flag === "critical") {
      severity = "critical";
    } else if (refHigh != null && value > refHigh) {
      direction = "above normal";
      crossingAmount = ((value - refHigh) / refHigh) * 100;
      if (crossingAmount > 50) severity = "high";
      else if (crossingAmount > 20) severity = "moderate";
      else severity = "informational";
    } else if (refLow != null && value < refLow) {
      direction = "below normal";
      crossingAmount = ((refLow - value) / refLow) * 100;
      if (crossingAmount > 30) severity = "high";
      else if (crossingAmount > 10) severity = "moderate";
      else severity = "informational";
    }

    results.push({
      rule_id: `biomarker_threshold_${markerName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      rule_version: 1,
      category: "threshold",
      severity,
      title: `${markerName} ${direction}`,
      summary: `Your most recent ${markerName} on ${timestamp.slice(0, 10)} was ${value} ${unit}, which is ${direction} (normal range ${refLow ?? "?"}–${refHigh ?? "?"} ${unit}). ${severity === "high" ? "This is a meaningful crossing that is worth focused attention." : severity === "moderate" ? "This is worth discussing with your doctor." : "The crossing is small but worth noting."}`,
      evidence: {
        source: "biomarker_timeline",
        description: `Most recent ${markerName} measurement`,
        values: [{ value, unit, date: timestamp.slice(0, 10), refLow, refHigh, flag }],
      },
      suggested_question:
        severity === "high" || severity === "critical" || severity === "moderate"
          ? {
              question: `My ${markerName} came back at ${value} ${unit} — what does that mean for me specifically, and what should my target be?`,
              rationale: `A specific target tells you whether future measurements are moving in the right direction.`,
            }
          : undefined,
    });
  }

  return results;
}

// ============================================================================
// RULE 3 — Self-report vs sensor contradiction
// Fires when self-reported sleep hours differ meaningfully from wearable data.
// ============================================================================

function ruleSleepContradiction(raw: RawDataLayer): RuleDetection[] {
  const results: RuleDetection[] = [];
  const sensors = raw.sensorStreams || [];
  const journal = raw.symptomsJournal || [];

  // Get self-reported sleep hours
  const selfReports = journal.filter((e) => e.symptom === "sleep_self_report_hours");
  if (selfReports.length < 3) return results;

  // For each self-report, find matching sensor data within ±1 day
  const comparisons: Array<{ date: string; selfHours: number; sensorHours: number; gap: number }> = [];

  for (const report of selfReports) {
    const selfHours = report.severity; // we store hours in the severity field for this symptom
    const match = sensors.find((s) => s.date === report.date && s.sleep_hours != null);
    if (match && match.sleep_hours != null) {
      comparisons.push({
        date: report.date,
        selfHours,
        sensorHours: match.sleep_hours,
        gap: Math.abs(selfHours - match.sleep_hours),
      });
    }
  }

  if (comparisons.length < 3) return results;

  const avgGap = mean(comparisons.map((c) => c.gap));
  if (avgGap < 1.5) return results; // less than 1.5 hours average gap isn't noteworthy

  const avgSelf = mean(comparisons.map((c) => c.selfHours));
  const avgSensor = mean(comparisons.map((c) => c.sensorHours));

  const severity: PatternSeverity = avgGap > 2.5 ? "high" : "moderate";

  results.push({
    rule_id: "sleep_self_report_vs_sensor_contradiction",
    rule_version: 1,
    category: "contradiction",
    severity,
    title: "Reported sleep is longer than what your wearable is measuring",
    summary: `You've been reporting about ${avgSelf.toFixed(1)} hours of sleep per night, but your wearable is recording an average of ${avgSensor.toFixed(1)} hours — a gap of about ${avgGap.toFixed(1)} hours. This kind of gap often happens when time in bed feels longer than actual sleep, which can be a sign of fragmented sleep or undiagnosed sleep disruption.`,
    evidence: {
      source: "sensor_streams + symptoms_journal",
      description: `${comparisons.length} days compared between self-report and wearable`,
      values: comparisons.map((c) => ({
        date: c.date,
        self_reported_hours: c.selfHours,
        wearable_hours: c.sensorHours,
        gap_hours: c.gap,
      })),
    },
    suggested_question: {
      question: `My wearable shows I'm actually only getting about ${avgSensor.toFixed(1)} hours of sleep even though I feel like I'm in bed for 8 — could that be contributing to how I feel, and is a sleep study worth considering?`,
      rationale: `Sleep quality gaps often drive fatigue and inflammation patterns that don't show up on routine labs. A sleep study can confirm whether there's a mechanical issue like sleep apnea.`,
    },
  });

  return results;
}

// ============================================================================
// RULE 4 — Behavioral correlation
// Fires when a behavior (late meals, alcohol, high sugar) correlates with a
// next-day physiological marker (HRV drop, resting HR increase).
// ============================================================================

function ruleLateFoodHrvCorrelation(raw: RawDataLayer): RuleDetection[] {
  const results: RuleDetection[] = [];
  const food = raw.foodLogSummary || [];
  const sensors = raw.sensorStreams || [];

  if (food.length < 5 || sensors.length < 5) return results;

  // For each food log day, find the sensor data for the NEXT day
  const paired: Array<{ date: string; lateMeal: boolean; nextDayHrv: number | null }> = [];

  for (const day of food) {
    const nextDate = new Date(day.date);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().slice(0, 10);
    const nextSensor = sensors.find((s) => s.date === nextDateStr);
    if (nextSensor && nextSensor.hrv_ms != null) {
      paired.push({
        date: day.date,
        lateMeal: !!day.late_meal,
        nextDayHrv: nextSensor.hrv_ms,
      });
    }
  }

  if (paired.length < 5) return results;

  const lateMealDays = paired.filter((p) => p.lateMeal);
  const noLateMealDays = paired.filter((p) => !p.lateMeal);

  if (lateMealDays.length < 2 || noLateMealDays.length < 2) return results;

  const avgHrvAfterLate = mean(lateMealDays.map((p) => p.nextDayHrv!));
  const avgHrvAfterNormal = mean(noLateMealDays.map((p) => p.nextDayHrv!));

  const hrvDrop = avgHrvAfterNormal - avgHrvAfterLate;
  if (hrvDrop < 3) return results; // less than 3ms isn't meaningful

  const severity: PatternSeverity = hrvDrop > 8 ? "high" : "moderate";

  results.push({
    rule_id: "late_meal_hrv_correlation",
    rule_version: 1,
    category: "correlation",
    severity,
    title: "Late meals and next-day recovery",
    summary: `On days after you ate a late meal, your morning HRV averaged ${avgHrvAfterLate.toFixed(0)} ms. On days after you didn't, it averaged ${avgHrvAfterNormal.toFixed(0)} ms — about ${hrvDrop.toFixed(0)} ms higher. HRV is one of the clearest signals of how well your body recovered overnight, and this pattern suggests late eating is costing you recovery.`,
    evidence: {
      source: "food_log + sensor_streams",
      description: `${paired.length} day pairs compared`,
      values: [{
        late_meal_days: lateMealDays.length,
        normal_days: noLateMealDays.length,
        avg_hrv_after_late: Math.round(avgHrvAfterLate),
        avg_hrv_after_normal: Math.round(avgHrvAfterNormal),
        gap_ms: Math.round(hrvDrop),
      }],
    },
    suggested_question: undefined, // correlation patterns don't always warrant a doctor question
  });

  return results;
}

// ============================================================================
// RULE 5 — Composite cardiovascular watchlist
// Fires when multiple cardiovascular risk factors appear together.
// ============================================================================

function ruleCardiovascularWatchlist(raw: RawDataLayer): RuleDetection[] {
  const results: RuleDetection[] = [];
  const timeline = raw.biomarkerTimeline || [];
  const vitals = raw.vitalSigns || [];

  const factors: string[] = [];
  const evidenceValues: any[] = [];

  // Factor 1: elevated BP
  const recentSystolic = sortByDate(vitals.filter((v) => v.type === "systolic_bp"), false);
  if (recentSystolic.length >= 2) {
    const avgSystolic = mean(recentSystolic.slice(0, 3).map((v) => v.value));
    if (avgSystolic >= 130) {
      factors.push(`average systolic blood pressure ${avgSystolic.toFixed(0)} mmHg`);
      evidenceValues.push({ metric: "avg_systolic_bp", value: Math.round(avgSystolic), threshold: 130 });
    }
  }

  // Factor 2: elevated LDL-C
  const ldl = sortByDate(filterByName(timeline, "LDL-C"), false)[0];
  if (ldl && ldl.value > 130) {
    factors.push(`LDL-C ${ldl.value} ${ldl.unit}`);
    evidenceValues.push({ metric: "ldl_c", value: ldl.value, unit: ldl.unit, threshold: 130 });
  }

  // Factor 3: rising HbA1c
  const hba1c = sortByDate(filterByName(timeline, "HbA1c"), true);
  if (hba1c.length >= 2) {
    const latest = hba1c[hba1c.length - 1];
    if (latest.value >= 5.7) {
      factors.push(`HbA1c ${latest.value}%`);
      evidenceValues.push({ metric: "hba1c", value: latest.value, threshold: 5.7 });
    }
  }

  // Factor 4: BMI
  const recentBmi = sortByDate(vitals.filter((v) => v.type === "bmi"), false)[0];
  if (recentBmi && recentBmi.value >= 27) {
    factors.push(`BMI ${recentBmi.value}`);
    evidenceValues.push({ metric: "bmi", value: recentBmi.value, threshold: 27 });
  }

  if (factors.length < 3) return results; // need at least three factors to fire

  const severity: PatternSeverity = factors.length >= 4 ? "high" : "moderate";

  results.push({
    rule_id: "cardiovascular_composite_watchlist",
    rule_version: 1,
    category: "watchlist",
    severity,
    title: "Multiple cardiovascular risk factors appearing together",
    summary: `You currently have ${factors.length} cardiovascular risk markers showing together: ${factors.join(", ")}. Individually, each of these is worth noting. Together, they add up to a picture that's worth focused attention — cardiovascular risk is multiplicative, not additive, which means addressing several factors at once produces disproportionately large benefits.`,
    evidence: {
      source: "biomarker_timeline + vital_signs",
      description: `${factors.length} cardiovascular risk factors detected`,
      values: evidenceValues,
    },
    suggested_question: {
      question: `Given that I have several cardiovascular risk factors showing up together — blood pressure, cholesterol, blood sugar trending, and weight — what's the single most important thing to address first, and what's a realistic timeline for seeing these numbers come down?`,
      rationale: `Asking about prioritization and timeline gives you a concrete plan instead of a diffuse list of things to worry about.`,
    },
  });

  return results;
}

// ============================================================================
// RULE ENGINE — runs all rules and collects detections
// ============================================================================

const ALL_RULES = [
  ruleBiomarkerTrend,
  ruleBiomarkerThreshold,
  ruleSleepContradiction,
  ruleLateFoodHrvCorrelation,
  ruleCardiovascularWatchlist,
];

function runAllRules(rawData: RawDataLayer): RuleDetection[] {
  const allDetections: RuleDetection[] = [];
  for (const rule of ALL_RULES) {
    try {
      const detections = rule(rawData);
      allDetections.push(...detections);
    } catch (e) {
      console.error(`Rule ${rule.name} failed:`, e);
    }
  }
  return allDetections;
}

// ============================================================================
// PERSISTENCE — upsert detections into derived_patterns table
// ============================================================================

async function persistDetections(
  supabase: any,
  userId: string,
  detections: RuleDetection[]
): Promise<{ inserted: number; updated: number; questionsQueued: number }> {
  let inserted = 0;
  let updated = 0;
  let questionsQueued = 0;

  for (const det of detections) {
    // Check if an active pattern already exists for this rule
    const { data: existing } = await supabase
      .from("derived_patterns")
      .select("id, first_detected_at")
      .eq("user_id", userId)
      .eq("rule_id", det.rule_id)
      .eq("status", "active")
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      // Update existing pattern — refresh last_confirmed_at and content
      await supabase
        .from("derived_patterns")
        .update({
          rule_version: det.rule_version,
          category: det.category,
          severity: det.severity,
          title: det.title,
          summary: det.summary,
          evidence: det.evidence,
          last_confirmed_at: now,
        })
        .eq("id", existing.id);
      updated++;
    } else {
      // Insert new pattern
      // If the rule suggests a question, create the queue entry first so we can link it
      let generatedQuestionId: string | null = null;
      if (det.suggested_question) {
        // Check if an identical question is already queued (avoid duplicates)
        const { data: existingQ } = await supabase
          .from("patient_question_queue")
          .select("id")
          .eq("user_id", userId)
          .eq("question", det.suggested_question.question)
          .eq("status", "queued")
          .maybeSingle();

        if (!existingQ) {
          // Get max priority
          const { data: maxPriRow } = await supabase
            .from("patient_question_queue")
            .select("priority")
            .eq("user_id", userId)
            .eq("status", "queued")
            .order("priority", { ascending: false })
            .limit(1);
          const priority = maxPriRow && maxPriRow.length > 0 ? maxPriRow[0].priority + 1 : 0;

          const { data: newQ, error: qErr } = await supabase
            .from("patient_question_queue")
            .insert({
              user_id: userId,
              question: det.suggested_question.question,
              rationale: det.suggested_question.rationale,
              source: "derived",
              status: "queued",
              priority,
            })
            .select("id")
            .single();
          if (!qErr && newQ) {
            generatedQuestionId = newQ.id;
            questionsQueued++;
          }
        } else {
          generatedQuestionId = existingQ.id;
        }
      }

      await supabase.from("derived_patterns").insert({
        user_id: userId,
        rule_id: det.rule_id,
        rule_version: det.rule_version,
        category: det.category,
        severity: det.severity,
        title: det.title,
        summary: det.summary,
        evidence: det.evidence,
        generated_question_id: generatedQuestionId,
        first_detected_at: now,
        last_confirmed_at: now,
        status: "active",
      });
      inserted++;
    }
  }

  return { inserted, updated, questionsQueued };
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { manifest, userId } = body;

    if (!manifest) {
      return new Response(JSON.stringify({ error: "No manifest provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "No userId provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawData: RawDataLayer = manifest.rawData || {};
    const detections = runAllRules(rawData);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const stats = await persistDetections(supabase, userId, detections);

    return new Response(
      JSON.stringify({
        success: true,
        detections_found: detections.length,
        inserted: stats.inserted,
        updated: stats.updated,
        questions_queued: stats.questionsQueued,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("derive-patterns error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
