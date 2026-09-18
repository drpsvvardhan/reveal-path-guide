// Source-only inventory. This does not assess clinical validity or read patient data.
// Run: node --experimental-strip-types scripts/cie33-validation-inventory.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FOUNDATION, PROFILE_VERSION, INSTRUMENT_VERSION } from '../supabase/functions/_shared/cie33/foundation.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = `${root}docs/validation`;
mkdirSync(out, { recursive: true });
const source = readFileSync(`${root}supabase/functions/_shared/cie33/foundation.ts`);
const concerns = {
  safety: 'Compound immediate-danger/self-harm/other-harm question; positive subtype is not identified and negative is not clinical clearance.',
  nicotine: 'Lifetime presence does not establish current use, product dose, pack-years or cessation date.',
  alcohol: 'Presence during 30 days does not quantify amount, frequency or standard units.',
  medications: 'Broad current-use screen; test understanding of all routes and current versus prescribed but not taken.',
  goals: 'Check that the person can express their own priority without assuming an intervention is required.',
  tradeoffs: 'Depends on preceding goal; test comprehension and whether multiple goals create ambiguity.',
  baseline: 'Past-year wording is implemented as 365 days; check recalled baseline versus current state.',
  change: 'Most-changed framing may omit concurrent important changes; retain uncertainty and timing.',
  function: 'Ordinal options are not an interval score; specify how participants handle different activities.',
  sleep: 'Rested/mixed/unrested categories may overlap in interpretation; not a validated sleep-disorder scale.',
  energy: 'Free-text energy can mix physical fatigue, motivation and sleepiness; assess intended interpretation.',
  pain: 'Physical discomfort is broader than pain; no guaranteed severity/location or urgent-symptom triage.',
  mood: 'Narrative experience, not a depression diagnosis or validated symptom score.',
  thinking: 'Changes may mix attention, memory and cognition; no objective cognitive-performance inference.',
  digestion: 'Open symptom question does not establish absence of unmentioned gastrointestinal features.',
  breathing: 'Thirty-day account may contain acute concerns; free text is not guaranteed emergency detection.',
  'heart-sensations': 'Vague sensations may be interpreted differently; not a cardiac risk or chest-pain rule-out.',
  cannabis: 'No enforced route, dose or frequency; cannot derive quantitative exposure automatically.',
  'other-substances': 'Very broad category; test disclosure comfort and distinction from preceding questions.',
  supplements: 'Names alone may not identify ingredients/dose; no automatic interaction-safety claim.',
  'treatment-experience': 'One standout experience is not a comprehensive medical or surgical history.',
  'life-events': 'A salient turning point is not an exhaustive diagnosis/onset inventory.',
  family: 'May omit relationship, age at diagnosis or unaffected relatives; not a structured pedigree.',
  environment: 'Broad wellbeing concept; may omit occupational or housing exposures without prompts.',
  'food-access': 'Access barriers are not dietary intake or nutrition adequacy.',
  'care-access': 'Different barriers may be underreported; preserve unknown and declined responses.',
  support: 'Reported availability is not consent to contact a named person or proof of reliable support.',
  work: 'Usual work/caregiving schedule is not a quantified occupational exposure or shift diagnosis.',
  movement: 'Narrative activity does not guarantee frequency/intensity/duration or measured fitness.',
  eating: 'A typical day is not a complete dietary record or validated nutrient estimate.',
  capacity: 'Perceived manageable change is not treatment readiness, adherence evidence or clinical permission.',
  uncertainty: 'Clarification opportunity is not proof that all other responses are understood or complete.',
  'medication-details': 'Conditional free text may omit drug strength, route, frequency and actual exposure; reconcile separately.',
  'nicotine-details': 'Current-use follow-up after lifetime-positive answer must allow former users to report no current use.',
  'alcohol-details': 'No specified standard drink; do not infer quantity from an ambiguous narrative.',
  reproductive: 'Opt-in life-stage question can overlap treatment/hormone history; do not infer sex, pregnancy or fertility.',
  'sexual-health': 'Opt-in concern disclosure; skipped/declined is not absence of concern or consent to share.',
};
const columns = ['question_key','chapter','exact_prompt','response_kind','response_options','time_frame','days','branch_condition','sensitive_opt_in','locked_sentinel','desk_review_concern','human_reviewer_code','human_relevance_1_to_4','human_clarity_1_to_4','human_adequacy_1_to_4','human_rationale','proposed_change','human_review_date'];
const quote = value => `"${String(value ?? '').replaceAll('"','""')}"`;
const rows = FOUNDATION.map(q => [q.key,q.chapter,q.prompt,q.response.kind,JSON.stringify(q.response.options ?? []),q.frame,q.days ?? '',q.condition ? `${q.condition}=true` : '',q.sensitive === true,q.sentinelId ?? '',concerns[q.key] ?? 'Requires human review.','','','','','','','']);
writeFileSync(`${out}/CIE33_ITEM_REVIEW.csv`, [columns,...rows].map(row=>row.map(quote).join(',')).join('\n')+'\n');
const keys = new Set(FOUNDATION.map(q=>q.key));
const audit = {
  assessment_type: 'source_inventory_not_clinical_study',
  clinical_validation_status: 'NOT_ESTABLISHED',
  human_participants_evaluated_in_this_assessment: 0,
  independent_clinician_reviews_completed_in_this_assessment: 0,
  source: 'supabase/functions/_shared/cie33/foundation.ts',
  source_sha256: createHash('sha256').update(source).digest('hex'),
  instrument_version: INSTRUMENT_VERSION,
  profile_version: PROFILE_VERSION,
  total_templates: FOUNDATION.length,
  core_templates: FOUNDATION.filter(q=>!q.condition && !q.sensitive).length,
  conditional_templates: FOUNDATION.filter(q=>q.condition).length,
  opt_in_templates: FOUNDATION.filter(q=>q.sensitive).length,
  locked_sentinels: FOUNDATION.filter(q=>q.sentinelId).length,
  response_types: Object.fromEntries([...new Set(FOUNDATION.map(q=>q.response.kind))].map(k=>[k,FOUNDATION.filter(q=>q.response.kind===k).length])),
  checks: {
    unique_keys: keys.size===FOUNDATION.length,
    unique_concept_codes: new Set(FOUNDATION.map(q=>q.code)).size===FOUNDATION.length,
    nonempty_prompts: FOUNDATION.every(q=>q.prompt.trim().length>0),
    valid_bounded_windows: FOUNDATION.every(q=>q.frame!=='bounded_window'||Number.isInteger(q.days)&&q.days>0),
    condition_targets_exist_and_are_boolean: FOUNDATION.every(q=>!q.condition||FOUNDATION.some(p=>p.key===q.condition&&p.response.kind==='boolean')),
    single_select_options_have_unique_ids: FOUNDATION.every(q=>q.response.kind!=='single_select'||q.response.options?.length>1&&new Set(q.response.options.map(o=>o.id)).size===q.response.options.length),
    all_items_have_desk_review_notes: FOUNDATION.every(q=>Object.hasOwn(concerns,q.key)),
  },
  note: 'Passing these checks verifies structural properties only. Blank human review fields intentionally contain no simulated ratings.',
};
writeFileSync(`${out}/CIE33_SOURCE_AUDIT.json`, JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
if(Object.values(audit.checks).some(passed=>passed!==true)) process.exitCode=1;
