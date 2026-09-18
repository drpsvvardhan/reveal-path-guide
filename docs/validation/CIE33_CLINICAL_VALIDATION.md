# CIE 3.3 Foundation: clinical validation assessment and execution protocol

Version: 1.0 • Prepared 2026-09-18 • Status: desk assessment completed; prospective clinical validation not yet conducted.

## Decision and intended use

The deployed Vizzhy Foundation profile is a versioned, heterogeneous patient-history acquisition instrument. It records what a person reports, the question asked, the relevant time window, missing information and subsequent corrections. Its intended output is traceable subjective evidence for a clinician-reviewed BioTwin. It is not a diagnostic scale, an emergency screening service, a measure of treatment efficacy, or a single latent health score.

The reviewed baseline is commit `caaa15d5e458a95f611e0c0ef42024e18cf69a7e`, instrument `3.3.0`, profile `vizzhy-foundation@1.0.0`. The item snapshot and audit in this directory pin the exact question text and source hash. Clinical-release workflow changes must additionally be evaluated against the final deployed commit; successful software tests do not supply clinical-study results.

**Current verdict:** engineering and source-traceability evidence supports the implemented acquisition behavior. Clinical content validity, patient comprehension, completeness, diagnostic performance and health-outcome benefit are not established by the material reviewed. No patients or clinicians were recruited, interviewed or adjudicated for this assessment. The earlier two-account live exercise was synthetic software verification, not a clinical cohort. Existing production records have not been repurposed as research data.

## Evidence register

| Claim | Available evidence | Supported conclusion | Still required |
|---|---|---|---|
| Exact question/response binding | Reference kernel, server validation, hash and version tests | Tested software retains the acquisition contract | Patient interpretation of wording and time windows |
| Missingness is preserved | Distinct missingness choices and integration tests | Missing/declined answers are not converted to a negative response | Interviews about how patients distinguish these choices |
| Corrections preserve history | Append-only witness lineage and publication tests | Tested corrections retain previous entries | Whether patients can correct the intended answer without assistance |
| Safe access to records | RLS, authenticated endpoints and synthetic isolation checks | Tested access paths enforce their asserted controls | Continued operational monitoring; no claim of universal security |
| Safety handoff and clinician release | Sentinel routing; new workflow evaluated in rollout report | Only behavior actually exercised in the final tests is established | Human factors, staffing, credential review, response-time and clinical-procedure evaluation |
| Comprehensive clinical history | 37 available templates; 32 core, three conditional, two opt-in | Broad lived-experience coverage | Coverage assessment against the stated clinical use, including the gaps below |
| Accurate biological inference | Published testimony can be admitted to model context | Provenance can be checked | Independent adjudication of generated assertions and omissions |
| Better patient outcomes | No prospective outcome comparison supplied | No efficacy claim is supported | Separately designed, adequately powered clinical study |

Source inventory: `supabase/functions/_shared/cie33/foundation.ts`, reference `PROVENANCE.md`, engine/evidence code, `tests/cie33`, and `docs/CIE33_ROLLOUT.md`. The supplied canonical ZIP SHA-256 is `6b275091d05bac7decdef351d03234e3b46266bc1e1f5f0fae994492b83745da`; the original 44 reference tests address conformance, not patient outcomes. The clinician-release and PPE test results belong in the rollout report, with their actual run date and commit.

## Completed item-level desk assessment

The accompanying `CIE33_ITEM_REVIEW.csv` contains all 37 prompts, response types, time windows, branch/consent conditions and a review concern for each item. These are author desk-review observations, **not ratings from a clinician panel or patients**. No wording was silently changed by this assessment.

Specific findings requiring human review:

1. The locked immediate-safety sentinel combines immediate danger, self-harm and harm to others in one Boolean response. A positive answer cannot identify which component applies. A negative answer is not a clinical risk exclusion. Preserve the locked text while evaluating the separate clinician follow-up procedure.
2. The Foundation profile has no explicit structured allergy question or dedicated comprehensive diagnosis/surgical-history inventory. The treatment, life-event and family prompts can elicit relevant history, but do not establish completeness. Do not infer absence of allergies or disease from silence. Evaluate these gaps before claiming the questionnaire alone supplies a comprehensive medical history; uploaded/EMR evidence remains a distinct source.
3. Medication detail is optional free text after an affirmative current-use sentinel. It does not guarantee drug identity, strength, route, frequency, actual adherence or discontinued exposure. Medication reconciliation must retain unknown fields and use its own corroborating workflow.
4. Lifetime nicotine exposure and current-use detail measure different periods. Neither automatically supplies pack-years or a cessation date. Alcohol detail does not enforce a standard unit. Do not derive quantitative exposure without the required information.
5. Free-text mood, cognition, breathing and heart-sensation questions are not validated disease screens. Symptoms described there are not guaranteed to activate the locked safety branch. Study this limitation explicitly; do not advertise automated triage from these questions.
6. Function and sleep each use categorical options. Their categories must not be converted into an invented interval score or summed with narrative items. Their clinical measurement properties have not been established here.
7. Sensitive reproductive/sexual questions require opt-in. A skipped sensitive branch means no acquired account, not an absent concern. Evaluate the consent explanation and privacy on shared devices.
8. Negative-capability confirmation and the five patient-facing missingness choices may add cognitive burden. Test comprehension rather than assuming the extra interaction produces accurate evidence.
9. The “past year” baseline uses a 365-day implementation window. Ask participants whether the displayed period matches their interpretation. Capture timezone and local-date misunderstandings for all bounded windows.

## Methodological basis and limits

FDA's October 2025 fit-for-purpose COA guidance emphasizes a defined intended concept and context, and evidence supporting the proposed interpretation. Its cognitive-interview discussion is useful for evaluating how patients understand an item and choose a response. We use that methodology by analogy for an acquisition instrument; this is not FDA qualification, clearance or a declaration that CIE is a regulatory endpoint. [FDA guidance](https://www.fda.gov/media/159500/download).

COSMIN distinguishes relevance, comprehensiveness and comprehensibility in content evaluation. Its study-design checklist addresses the target population and patient/professional input. Structural validity and internal consistency apply to reflective measurement models; we therefore do not propose a whole-instrument Cronbach alpha for this mixed history collection. These principles inform the study below without claiming formal COSMIN certification. [COSMIN content-validity manual](https://www.cosmin.nl/wp-content/uploads/COSMIN-methodology-for-content-validity-user-manual-v1.pdf), [COSMIN study-design checklist](https://www.cosmin.nl/wp-content/uploads/COSMIN-study-designing-checklist_final.pdf).

The numbers, operational targets and stages below are **proposed Vizzhy study-design choices**, not thresholds mandated by these sources. They must be frozen before data collection and revised through an explicit protocol amendment, not adjusted after seeing results.

## Prospective execution protocol

### Population and accountability

Initial scope: consenting adults able to self-report in English, using the intended Patient Reveal device and setting. Purposively include varied ages, reading/digital fluency, chronic-disease burden and accessibility needs. Children, translated instruments, proxy answers and people unable to provide study consent require separate protocols. Urgent clinical needs take priority over research tasks; the study must not delay care or experimentally provoke distress.

Before recruitment, name a principal investigator, clinical safety lead, qualitative interviewer, two independent evidence raters and a study/data coordinator. Document the applicable institutional ethics/research determination and consent process with the responsible organization; this document supplies no such determination. Participation, recording consent and withdrawal must be distinct from ordinary product access. Do not contact or enroll existing patients automatically.

### Stage 1 — clinical content review

Proposed panel: 8 reviewers spanning primary care/internal medicine, mental-health safety, medication reconciliation, patient communication/accessibility and relevant specialty practice. Record expertise and conflicts. Include patient partners in deciding whether important lived-experience topics are missing.

Each reviewer independently examines every prompt, response option, recall window, missingness choice and branch. Record relevance, clarity and adequacy as 1–4 ordinal judgments, a concrete reason and proposed revision; do not fill these ratings using AI. Then reconcile disagreements in a documented meeting. Retain minority concerns. Any safety-critical ambiguity remains open until its disposition is explicit; averaging ratings does not close it.

Output: completed item review, coverage map, revision log and frozen candidate version. Wording changes to locked sentinels require a separately versioned adaptation and conformance assessment. Changes to any question require rechecking the affected branches and downstream evidence interpretation.

### Stage 2 — cognitive interviews and usability

Proposed initial recruitment: 20 adults in two iterative rounds of 10, with additional interviews if new substantive misunderstandings continue. This is a planning allowance, not proof of saturation or a power calculation. Assign item blocks so every core item is examined by at least 8 participants; evaluate each conditional and sensitive item with consenting participants for whom its branch is relevant. Record actual item exposure rather than quoting the total sample for every item.

Interview guide:

- “What does this question mean in your own words?”
- “What period of your life were you thinking about?”
- “How did you choose this response? Was an answer you needed missing?”
- “What is the difference between not knowing, not recalling and choosing not to answer?”
- “What do you think the app will do after this answer?”
- “Show how you would pause, resume and correct something you said.”
- “What important part of your experience have we not asked about?”

For safety behavior, use clearly identified fictional scenarios and a facilitator; never ask a participant to give a false personal safety answer in their production record. Assess whether they understand immediate help instructions, the absence of automatic emergency contact, clinician review, and that permission to resume an intake is not a declaration of medical safety.

Record misunderstandings by item and severity; code interviews independently with adjudication. Report completion time, assistance, abandonment and reasons. Proposed progression criterion: no unresolved safety-critical misunderstanding, and at least 90% correct interpretation among the last-round participants exposed to each item. Show denominators and uncertainty; small groups cannot establish a population rate. Failure triggers revision and another round, not removal of inconvenient participants.

### Stage 3 — paired clinical-information pilot

Proposed initial sample: 50 consenting adults after stages 1–2, with a separately monitored subgroup of approximately 20 clinically stable participants for short-interval repeat administration. These are feasibility targets. A statistician must size any later confirmatory study for its chosen endpoint, desired precision, clustering and attrition.

For each participant, obtain an independent structured clinical interview using a prespecified topic guide. Counterbalance administration order where practicable and record interval, assistance and changes in circumstances. The interviewer should not see the CIE output before conducting the reference interview. The reference is an additional account, not an infallible substitute for the person's lived experience. Resolve disagreements with the person and source records where appropriate; do not overwrite either account.

Two blinded raters evaluate de-identified CIE-derived summaries against the exact captured testimony and, separately, the clinical interview. Randomize source order for usability review where feasible. Classify assertions as supported, unsupported, materially distorted, temporally wrong or unresolved. Record important omissions, including which topic was not elicited versus elicited but lost by summarization. Separate acquisition errors from model-reasoning errors.

The repeat-administration subgroup assesses stable historical items separately from changing symptoms. Different 7-day/30-day windows and actual clinical change must not be mislabeled measurement error. Free text requires semantic coding; literal string identity is not an adequate reliability measure.

### Stage 4 — clinical utility or outcome claims

Only after earlier stages, design a separate controlled study for a specific claim: for example clinician information-reconciliation time or patient understanding. Prespecify comparator, primary endpoint, allocation, blinding where possible, missing-data rules and sample-size calculation. A short usability pilot does not establish fewer adverse events, better diagnosis, longevity benefit or treatment efficacy. No such study has been performed as part of this engineering task.

## Analysis and proposed acceptance criteria

| Endpoint | Definition and reporting | Proposed progression rule |
|---|---|---|
| Traceability | Fraction of sampled generated assertions with a resolvable source, correct person and correct temporal attribution; retain all failures | 100% for safety-critical assertions; investigate every failure |
| Semantic fidelity | Supported assertions / assessable assertions; unsupported and distorted content reported separately | Target ≥95% overall with confidence interval; zero unresolved safety-critical distortions |
| Clinically important capture | Prespecified interview topics captured in CIE / relevant topics elicited in the independent interview | Report by topic; each high-consequence omission requires an explicit source/workflow remedy |
| Patient comprehension | Correct paraphrase and response selection / participants exposed to that item | Proposed ≥90% in final cognitive round, with denominators; no unresolved critical misunderstanding |
| Correction behavior | Intended correction saved, prior evidence retained, published-state transition correct | All predefined critical scenarios must pass |
| Clinician release | Only currently authorized, non-self reviewer can record an attributed decision; new patient safety check follows release | All predefined access/state scenarios must pass; humans must understand the action's limits |
| Burden and feasibility | Median/IQR and 90th percentile duration, help rate, dropout, branch exposure, missingness by reason | Descriptive initially; patient partners and investigators set an acceptable burden before confirmatory work |

These proposed thresholds do not establish clinical validity by themselves. Report patient-level outcomes and account for multiple assertions/items within a person. Use participant-level bootstrap intervals for assertion-based summaries; do not treat 1,000 sentences from ten people as 1,000 independent patients. Use exact/binomial intervals only where their independence assumptions are appropriate. Report categorical agreement and its uncertainty; account for prevalence when interpreting chance-corrected agreement. Do not calculate sensitivity/specificity without an appropriate, prospectively defined reference assessment and adequate positive/negative cases.

For zero observed critical failures in n independent participants, the exact one-sided 95% upper bound is `1 - 0.05^(1/n)`: about 9.5% at n=30, 3.0% at n=100 and 1.0% at n=300. These are illustrative uncertainty calculations, not CIE results. Zero failures in a small synthetic or clinical sample cannot establish zero risk.

Keep unknown, not recalled, declined, not applicable and temporarily unable separate. Report their denominators by eligible item/branch. Do not impute a missing answer as “No”, remove safety holds from feasibility denominators, or silently exclude people who needed help. Present subgroup findings descriptively until adequately powered; each language or administration mode needs its own evidence.

## Safety, data handling and monitoring

The clinical safety lead defines coverage hours, queue ownership, backup reviewer, contact route and escalation procedure before a monitored clinical pilot. The app must continue to state accurately whether anybody has been contacted. A held record alone is not proof that a staffed team is watching it. Record response times and missed handoffs; critical workflow failures pause the pilot for investigation.

Keep consent, contact identifiers and the analysis dataset separate with restricted access. Store study data only in the approved private study environment. This repository contains protocols, blank forms and source-derived item metadata only; never commit patient answers, recordings, reviewer credentials or completed case forms. Use a participant code with a separate controlled linkage key. Preserve disagreements and original records; corrections are versioned.

Freeze instrument/profile, question-source hash, application commit, model/provider version, prompt version, routing policy and clinical-release policy per study phase. Record deviations and harms. Do not pool different question or model versions without a prespecified justification and sensitivity analysis.

## Deliverables and current completion state

Completed now: source-based item inventory, desk assessment, evidence register, study protocol, interview guide, proposed analysis/acceptance criteria and blank collection forms. Engineering execution results and security findings are maintained in `../CIE33_ROLLOUT.md`.

Not yet performed: named independent clinical panel review, participant recruitment/consent, cognitive interviews, paired pilot, clinical adjudication and outcome study. These require actual people and records gathered under the approved study process. They must remain marked pending until evidence exists. The release workflow implementation does not fill these evidence gaps.

Blank forms in `CIE33_STUDY_FORMS.csv` cover the minimum fields. The item-review CSV intentionally leaves human ratings and sign-off empty. The automated audit JSON records only checks that a machine can verify from source. No fake study results, clinician signatures or patient outcomes are included.
