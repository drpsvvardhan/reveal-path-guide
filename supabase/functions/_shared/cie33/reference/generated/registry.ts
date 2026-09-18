// Derived from the supplied CIE 3.3 registry. See ../PROVENANCE.md.
export const canonicalRegistry = {
  "registryId": "CIE3-CANONICAL-REGISTRY",
  "version": "3.3.0-vizzhy-foundation.1",
  "generatedContract": "CIE33-REG",
  "operations": [
    "establish_status",
    "identify",
    "locate_onset",
    "locate_offset",
    "quantify_amount",
    "quantify_frequency",
    "quantify_duration",
    "characterize_intensity",
    "characterize_variability",
    "compare_personal_baseline",
    "locate_context",
    "identify_preceding_event",
    "characterize_trajectory",
    "characterize_response",
    "characterize_recovery",
    "characterize_recurrence",
    "characterize_function",
    "capture_self_attribution",
    "confirm",
    "reconcile",
    "revise"
  ],
  "temporalFrames": [
    "now",
    "bounded_window",
    "lifetime",
    "event_relative",
    "specimen_relative",
    "since_prior"
  ],
  "responseKinds": [
    "boolean",
    "single_select",
    "multi_select",
    "integer",
    "decimal",
    "quantity",
    "frequency",
    "date_or_approximate",
    "duration",
    "time_of_day",
    "0_to_10",
    "body_map",
    "relationship",
    "short_text",
    "event_builder",
    "structured_loop",
    "grid"
  ],
  "missingness": {
    "personFacing": [
      "unknown",
      "not_recalled",
      "declined",
      "not_applicable",
      "temporarily_unable"
    ],
    "acquisitionOnly": [
      "not_asked",
      "source_unavailable"
    ]
  },
  "qualityStates": [
    "high",
    "moderate",
    "low",
    "unknown"
  ],
  "interactionModes": [
    "setup",
    "safety",
    "instinct",
    "recall",
    "quantify",
    "timeline",
    "event",
    "loop",
    "grid",
    "narrative",
    "confirmation",
    "revisit"
  ],
  "predicateOps": [
    "eq",
    "neq",
    "in",
    "not_in",
    "exists",
    "not_exists",
    "gt",
    "gte",
    "lt",
    "lte",
    "missing",
    "changed_since",
    "contradicts",
    "any_event",
    "all",
    "any",
    "not"
  ],
  "predicatePaths": [
    "need.safetyPriority",
    "need.observableClass",
    "debt.disposition",
    "debt.decisionImpact",
    "coverage.status",
    "answer.missingness.kind",
    "contradiction.status",
    "event.type",
    "witness.createdAt"
  ],
  "routerTiers": [
    {
      "tier": 0,
      "name": "safety"
    },
    {
      "tier": 1,
      "name": "minimum_safe_biography"
    },
    {
      "tier": 2,
      "name": "contradiction"
    },
    {
      "tier": 3,
      "name": "observation_debt"
    },
    {
      "tier": 4,
      "name": "longitudinal_value"
    },
    {
      "tier": 5,
      "name": "enrichment"
    }
  ],
  "products": [
    "foundation",
    "adaptive_resolution",
    "event_capture",
    "sample_context_capsule",
    "longitudinal_sensing"
  ],
  "evidenceActionKinds": [
    "ask_human",
    "query_ehr",
    "query_wearable",
    "inspect_existing_omic",
    "request_lab",
    "retrieve_imaging",
    "clinician_exam",
    "wait_observe"
  ],
  "observationNeedKinds": [
    "safety_obligation",
    "minimum_biography",
    "material_contradiction",
    "decision_linked_uncertainty",
    "event_resolution",
    "specimen_context",
    "longitudinal_change",
    "enrichment"
  ],
  "humanEvidenceClasses": [
    "lived_observation",
    "exposure",
    "historical_event",
    "intervention_experience",
    "function",
    "goal_or_preference",
    "constraint_or_capacity",
    "self_attribution",
    "safety_report",
    "missingness"
  ],
  "cognitiveActCounts": [
    1,
    2,
    3
  ],
  "questionClasses": [
    "protocol_locked",
    "template_locked",
    "novel_candidate"
  ],
  "questionDeploymentStates": [
    "draft",
    "shadow",
    "research_only",
    "authorized_production",
    "suspended",
    "retired"
  ],
  "semanticActions": [
    "select_option",
    "submit_value",
    "submit_missingness",
    "confirm",
    "edit",
    "add_item",
    "remove_item",
    "pause"
  ],
  "acquisitionRequirementStates": [
    "witnessed_positive",
    "witnessed_negative_with_capability",
    "explicit_missingness_permitted",
    "not_applicable_permitted",
    "temporarily_deferred",
    "waived",
    "stale",
    "contradiction_open",
    "not_observed"
  ],
  "coverageStates": [
    "not_started",
    "partial",
    "sufficient_for_intake",
    "deferred",
    "declined"
  ],
  "safetyEvaluationStates": [
    "not_evaluated",
    "insufficient_coverage",
    "evaluated"
  ],
  "safetyRiskDispositions": [
    "no_active_cie_safety_signal_detected",
    "routine_review",
    "prompt_review",
    "urgent"
  ],
  "safetyProtocolActionStates": [
    "no_active_protocol",
    "active",
    "handoff_required",
    "handoff_offered",
    "handoff_initiated",
    "handoff_acknowledged",
    "person_exited_before_resolution",
    "completed_by_approved_transition"
  ],
  "witnessSubstrates": [
    "questionnaire_cie",
    "laboratory",
    "genomics",
    "transcriptomics",
    "proteomics",
    "metabolomics",
    "lipidomics",
    "methylation",
    "cfdna",
    "wearable",
    "imaging",
    "clinical_record"
  ],
  "witnessKinds": [
    "lived_signal",
    "historical_event",
    "exposure_status",
    "exposure_episode",
    "intervention_trial",
    "family_history_claim",
    "goal_constraint",
    "safety_signal",
    "diagnosis_test_history",
    "self_attribution",
    "functional_impact",
    "sample_context_capsule",
    "movement_exposure_episode",
    "movement_injury_episode",
    "unmapped_narrative",
    "legacy_question_response"
  ],
  "sourceKinds": [
    "patient_self_report",
    "caregiver_report",
    "clinician_report",
    "document_extract",
    "device",
    "laboratory",
    "genomic_assay",
    "imaging_study",
    "clinical_record",
    "derived_projection"
  ],
  "sentinels": [
    {
      "id": "SENTINEL-SAFETY-IMMEDIATE",
      "tier": 0,
      "conceptCode": "CIE.SAFETY.IMMEDIATE",
      "templateId": "TPL-SAFETY-IMMEDIATE@1.0.0",
      "exactPrompt": "Are you in immediate danger, or concerned you may harm yourself or someone else right now?",
      "responseKind": "boolean",
      "window": "now",
      "mandatory": true
    },
    {
      "id": "SENTINEL-NICOTINE-LIFETIME",
      "tier": 1,
      "conceptCode": "CIE.EXPOSURE.NICOTINE.LIFETIME",
      "templateId": "TPL-NICOTINE-LIFETIME@1.0.0",
      "exactPrompt": "Have you ever used cigarettes, cigars, pipes, chewing tobacco, snuff, nicotine vapes, pouches, or other nicotine products?",
      "responseKind": "boolean",
      "window": "lifetime",
      "mandatory": true
    },
    {
      "id": "SENTINEL-ALCOHOL-CURRENT",
      "tier": 1,
      "conceptCode": "CIE.EXPOSURE.ALCOHOL.CURRENT",
      "templateId": "TPL-ALCOHOL-CURRENT@1.0.0",
      "exactPrompt": "During the past 30 days, have you had any drink containing alcohol?",
      "responseKind": "boolean",
      "window": "bounded_window",
      "mandatory": true
    },
    {
      "id": "SENTINEL-ACTIVE-MEDICATIONS",
      "tier": 1,
      "conceptCode": "CIE.INTERVENTION.MEDICATION.ACTIVE",
      "templateId": "TPL-ACTIVE-MEDICATIONS@1.0.0",
      "exactPrompt": "Are you currently taking any prescribed, over-the-counter, injected, inhaled, or topical medicines?",
      "responseKind": "boolean",
      "window": "now",
      "mandatory": true
    }
  ],
  "questionValidationRules": [
    "CIE33-QV-001-NEED-BINDING",
    "CIE33-QV-002-HUMAN-OBSERVABLE",
    "CIE33-QV-003-ONE-COGNITIVE-ACT",
    "CIE33-QV-004-ONE-PRIMARY-OPERATION",
    "CIE33-QV-005-EXPLICIT-TEMPORAL-FRAME",
    "CIE33-QV-006-RESPONSE-COMPATIBILITY",
    "CIE33-QV-007-NON-COERCIVE-LANGUAGE",
    "CIE33-QV-008-CONSENT-COVERAGE",
    "CIE33-QV-009-NEGATIVE-CAPABILITY-DECLARED",
    "CIE33-QV-010-LOCKED-SENTINEL-EXACT",
    "CIE33-QV-011-NO-DIAGNOSTIC-ASSERTION",
    "CIE33-QV-012-NO-CAUSAL-CONVERSION",
    "CIE33-QV-013-SESSION-LOCAL-RESTRICTIONS",
    "CIE33-QV-014-BURDEN-BUDGET",
    "CIE33-QV-015-SOURCE-AVAILABLE",
    "CIE33-QV-016-GOVERNANCE-PURPOSE",
    "CIE33-QV-017-NO-HIDDEN-DEFAULT",
    "CIE33-QV-018-QUANTITY-UNIT",
    "CIE33-QV-019-STABLE-IDENTIFIERS",
    "CIE33-QV-020-VERSION-PINS",
    "CIE33-QV-021-VALIDATION-COMPLETE"
  ],
  "registeredConcepts": [
    {
      "code": "CIE.SAFETY.IMMEDIATE",
      "sourceClass": "human_observable",
      "topic": "safety"
    },
    {
      "code": "CIE.EXPOSURE.NICOTINE.LIFETIME",
      "sourceClass": "human_observable",
      "topic": "substances"
    },
    {
      "code": "CIE.EXPOSURE.ALCOHOL.CURRENT",
      "sourceClass": "human_observable",
      "topic": "substances"
    },
    {
      "code": "CIE.INTERVENTION.MEDICATION.ACTIVE",
      "sourceClass": "human_observable",
      "topic": "medications"
    },
    {
      "code": "CIE.SLEEP.RESTORATIVE",
      "sourceClass": "human_observable",
      "topic": "sleep"
    },
    {
      "code": "CIE.SLEEP.FRAGMENTATION.DEVICE",
      "sourceClass": "device_observable",
      "topic": "sleep"
    },
    {
      "code": "CIE.EXPOSURE.WORK.SHIFT",
      "sourceClass": "human_observable",
      "topic": "occupation"
    },
    {
      "code": "CIE.MOVEMENT.TRAINING.LOAD",
      "sourceClass": "human_observable",
      "topic": "movement"
    },
    {
      "code": "CIE.EXPOSURE.TRADITIONAL_PREPARATION",
      "sourceClass": "human_observable",
      "topic": "open_testimony"
    },
    {
      "code": "BIO.LAB.LDL.PARTICLE_NUMBER",
      "sourceClass": "instrument_only",
      "topic": "laboratory"
    },
    {
      "code": "BIO.OMICS.TRANSCRIPT.EXPRESSION",
      "sourceClass": "instrument_only",
      "topic": "omics"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.GOALS",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.TRADEOFFS",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.BASELINE",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.CHANGE",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.FUNCTION",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.ENERGY",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.PAIN",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.MOOD",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.THINKING",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.DIGESTION",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.BREATHING",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.HEART.SENSATIONS",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.CANNABIS",
      "sourceClass": "human_observable",
      "topic": "substances"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.OTHER.SUBSTANCES",
      "sourceClass": "human_observable",
      "topic": "substances"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.SUPPLEMENTS",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.TREATMENT.EXPERIENCE",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.LIFE.EVENTS",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.FAMILY",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.ENVIRONMENT",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.FOOD.ACCESS",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.CARE.ACCESS",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.SUPPORT",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.EATING",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.CAPACITY",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.UNCERTAINTY",
      "sourceClass": "human_observable",
      "topic": "foundation"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.MEDICATION.DETAILS",
      "sourceClass": "human_observable",
      "topic": "medications"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.NICOTINE.DETAILS",
      "sourceClass": "human_observable",
      "topic": "substances"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.ALCOHOL.DETAILS",
      "sourceClass": "human_observable",
      "topic": "substances"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.REPRODUCTIVE",
      "sourceClass": "human_observable",
      "topic": "reproductive"
    },
    {
      "code": "VIZZHY.CIE.FOUNDATION.SEXUAL.HEALTH",
      "sourceClass": "human_observable",
      "topic": "reproductive"
    }
  ]
} as const;
