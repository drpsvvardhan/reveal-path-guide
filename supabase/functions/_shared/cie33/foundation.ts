import type {
  ResponseDefinition,
  TemporalFrameKind,
  HumanEvidenceClass,
} from "./reference/types.ts";

export const PROFILE_VERSION = "vizzhy-foundation@1.0.0";
export const INSTRUMENT_VERSION = "3.3.0";
export interface FoundationQuestion {
  key: string;
  chapter: string;
  prompt: string;
  topic: string;
  frame: TemporalFrameKind;
  days?: number;
  code: string;
  response: ResponseDefinition;
  evidenceClass: HumanEvidenceClass;
  sentinelId?: string;
  condition?: string;
  sensitive?: boolean;
}
export const FOUNDATION: FoundationQuestion[] = [
  {
    key: "safety",
    chapter: "Safety",
    prompt:
      "Are you in immediate danger, or concerned you may harm yourself or someone else right now?",
    topic: "safety",
    frame: "now",
    code: "CIE.SAFETY.IMMEDIATE",
    response: {
      kind: "boolean",
    },
    evidenceClass: "safety_report",
    sentinelId: "SENTINEL-SAFETY-IMMEDIATE",
  },
  {
    key: "nicotine",
    chapter: "Exposures and treatments",
    prompt:
      "Have you ever used cigarettes, cigars, pipes, chewing tobacco, snuff, nicotine vapes, pouches, or other nicotine products?",
    topic: "substances",
    frame: "lifetime",
    code: "CIE.EXPOSURE.NICOTINE.LIFETIME",
    response: {
      kind: "boolean",
    },
    evidenceClass: "exposure",
    sentinelId: "SENTINEL-NICOTINE-LIFETIME",
  },
  {
    key: "alcohol",
    chapter: "Exposures and treatments",
    prompt:
      "During the past 30 days, have you had any drink containing alcohol?",
    topic: "substances",
    frame: "bounded_window",
    code: "CIE.EXPOSURE.ALCOHOL.CURRENT",
    response: {
      kind: "boolean",
    },
    evidenceClass: "exposure",
    days: 30,
    sentinelId: "SENTINEL-ALCOHOL-CURRENT",
  },
  {
    key: "medications",
    chapter: "Exposures and treatments",
    prompt:
      "Are you currently taking any prescribed, over-the-counter, injected, inhaled, or topical medicines?",
    topic: "medications",
    frame: "now",
    code: "CIE.INTERVENTION.MEDICATION.ACTIVE",
    response: {
      kind: "boolean",
    },
    evidenceClass: "exposure",
    sentinelId: "SENTINEL-ACTIVE-MEDICATIONS",
  },
  {
    key: "goals",
    chapter: "What matters to you",
    prompt: "What would you most like help with at this point in your life?",
    topic: "foundation",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.GOALS",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "tradeoffs",
    chapter: "What matters to you",
    prompt:
      "What would you be unwilling to give up while working toward that goal?",
    topic: "foundation",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.TRADEOFFS",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "baseline",
    chapter: "Your baseline",
    prompt:
      "Thinking about the past year, what has feeling well meant for you?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.BASELINE",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 365,
  },
  {
    key: "change",
    chapter: "Your baseline",
    prompt: "What has changed most in how you feel during the past 30 days?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.CHANGE",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 30,
  },
  {
    key: "function",
    chapter: "Your baseline",
    prompt:
      "During the past 30 days, how has your health affected the activities that matter to you?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.FUNCTION",
    response: {
      kind: "single_select",
      options: [
        {
          id: "none",
          label: "No difficulty",
          semanticValue: "none",
        },
        {
          id: "some",
          label: "Some difficulty",
          semanticValue: "some",
        },
        {
          id: "much",
          label: "A lot of difficulty",
          semanticValue: "much",
        },
        {
          id: "unable",
          label: "Unable to do them",
          semanticValue: "unable",
        },
      ],
    },
    evidenceClass: "lived_observation",
    days: 30,
  },
  {
    key: "sleep",
    chapter: "Daily experience",
    prompt:
      "During the past 7 days, how rested have you usually felt after your main sleep?",
    topic: "sleep",
    frame: "bounded_window",
    code: "CIE.SLEEP.RESTORATIVE",
    response: {
      kind: "single_select",
      options: [
        {
          id: "rested",
          label: "Rested",
          semanticValue: "rested",
        },
        {
          id: "mixed",
          label: "Sometimes rested",
          semanticValue: "mixed",
        },
        {
          id: "unrested",
          label: "Usually unrested",
          semanticValue: "unrested",
        },
      ],
    },
    evidenceClass: "lived_observation",
    days: 7,
  },
  {
    key: "energy",
    chapter: "Daily experience",
    prompt: "How has your energy felt during the past 7 days?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.ENERGY",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 7,
  },
  {
    key: "pain",
    chapter: "Daily experience",
    prompt:
      "What physical discomfort, if any, have you noticed during the past 30 days?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.PAIN",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 30,
  },
  {
    key: "mood",
    chapter: "Daily experience",
    prompt: "How has your mood felt during the past 14 days?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.MOOD",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 14,
  },
  {
    key: "thinking",
    chapter: "Daily experience",
    prompt:
      "What changes, if any, have you noticed in your thinking during the past 30 days?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.THINKING",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 30,
  },
  {
    key: "digestion",
    chapter: "Daily experience",
    prompt:
      "What digestive symptoms, if any, have you noticed during the past 30 days?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.DIGESTION",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 30,
  },
  {
    key: "breathing",
    chapter: "Daily experience",
    prompt:
      "What breathing difficulties, if any, have you noticed during the past 30 days?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.BREATHING",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 30,
  },
  {
    key: "heart-sensations",
    chapter: "Daily experience",
    prompt:
      "What unusual heart sensations, if any, have you noticed during the past 30 days?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.HEART.SENSATIONS",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 30,
  },
  {
    key: "cannabis",
    chapter: "Exposures and treatments",
    prompt:
      "What cannabis use, if any, would you report during the past 30 days?",
    topic: "substances",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.CANNABIS",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 30,
  },
  {
    key: "other-substances",
    chapter: "Exposures and treatments",
    prompt:
      "What other substances, including caffeine or nonmedical drugs, have you used during the past 30 days?",
    topic: "substances",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.OTHER.SUBSTANCES",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 30,
  },
  {
    key: "supplements",
    chapter: "Exposures and treatments",
    prompt:
      "What supplements or traditional preparations, if any, are you currently using?",
    topic: "foundation",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.SUPPLEMENTS",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "treatment-experience",
    chapter: "Exposures and treatments",
    prompt:
      "What stands out about your experience with a treatment or procedure at any time in your life?",
    topic: "foundation",
    frame: "lifetime",
    code: "VIZZHY.CIE.FOUNDATION.TREATMENT.EXPERIENCE",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "life-events",
    chapter: "Your history",
    prompt:
      "What event in your life, if any, marks an important turning point in your health?",
    topic: "foundation",
    frame: "lifetime",
    code: "VIZZHY.CIE.FOUNDATION.LIFE.EVENTS",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "family",
    chapter: "Your history",
    prompt: "What family health history would you like us to know about?",
    topic: "foundation",
    frame: "lifetime",
    code: "VIZZHY.CIE.FOUNDATION.FAMILY",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "environment",
    chapter: "Your circumstances",
    prompt:
      "What about your current living environment affects your wellbeing?",
    topic: "foundation",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.ENVIRONMENT",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "food-access",
    chapter: "Your circumstances",
    prompt:
      "During the past 30 days, what has made it difficult, if anything, to get the food you need?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.FOOD.ACCESS",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 30,
  },
  {
    key: "care-access",
    chapter: "Your circumstances",
    prompt: "What currently makes accessing care difficult, if anything?",
    topic: "foundation",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.CARE.ACCESS",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "support",
    chapter: "Your circumstances",
    prompt: "Who can you currently turn to for support, if anyone?",
    topic: "foundation",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.SUPPORT",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "work",
    chapter: "Your circumstances",
    prompt: "What is your usual work or caregiving schedule at present?",
    topic: "occupation",
    frame: "now",
    code: "CIE.EXPOSURE.WORK.SHIFT",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "movement",
    chapter: "Everyday habits",
    prompt:
      "What physical activity have you typically done during the past 7 days?",
    topic: "movement",
    frame: "bounded_window",
    code: "CIE.MOVEMENT.TRAINING.LOAD",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 7,
  },
  {
    key: "eating",
    chapter: "Everyday habits",
    prompt:
      "What has a typical day of eating looked like during the past 7 days?",
    topic: "foundation",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.EATING",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 7,
  },
  {
    key: "capacity",
    chapter: "Your next step",
    prompt: "What change feels manageable for you right now?",
    topic: "foundation",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.CAPACITY",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "uncertainty",
    chapter: "Your next step",
    prompt: "What would you like to clarify in today's account?",
    topic: "foundation",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.UNCERTAINTY",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
  },
  {
    key: "medication-details",
    chapter: "Exposures and treatments",
    prompt:
      "Please list the medicines you currently take, using the details available to you.",
    topic: "medications",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.MEDICATION.DETAILS",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    condition: "medications",
  },
  {
    key: "nicotine-details",
    chapter: "Exposures and treatments",
    prompt: "What is your nicotine use like at present?",
    topic: "substances",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.NICOTINE.DETAILS",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    condition: "nicotine",
  },
  {
    key: "alcohol-details",
    chapter: "Exposures and treatments",
    prompt: "What has your alcohol use looked like during the past 30 days?",
    topic: "substances",
    frame: "bounded_window",
    code: "VIZZHY.CIE.FOUNDATION.ALCOHOL.DETAILS",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    days: 30,
    condition: "alcohol",
  },
  {
    key: "reproductive",
    chapter: "Optional personal context",
    prompt:
      "What about your current reproductive or hormonal life stage would you like us to know?",
    topic: "reproductive",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.REPRODUCTIVE",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    sensitive: true,
  },
  {
    key: "sexual-health",
    chapter: "Optional personal context",
    prompt:
      "What sexual health concern, if any, would you like to discuss at present?",
    topic: "reproductive",
    frame: "now",
    code: "VIZZHY.CIE.FOUNDATION.SEXUAL.HEALTH",
    response: {
      kind: "short_text",
    },
    evidenceClass: "lived_observation",
    sensitive: true,
  },
];
