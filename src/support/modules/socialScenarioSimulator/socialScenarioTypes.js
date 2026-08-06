/**
 * socialScenarioTypes.js — Shared constants for the Social Scenario Simulator.
 *
 * The simulator is an ASD support module: scripted conversations that let the
 * user practice safe social exchanges across difficulty levels. All engine,
 * feedback, adaptation and store logic stays deterministic and unit-testable.
 */

export const SOCIAL_SCENARIO_MODULE_ID = "asd.social-scenarios";

export const SCENARIO_CATEGORIES = Object.freeze([
  { id: "college", label: "College", description: "Classes, group work and campus life." },
  { id: "workplace", label: "Workplace", description: "Colleagues, managers and work tasks." },
  { id: "daily_life", label: "Daily Life", description: "Everyday errands and public spaces." },
  { id: "relationships", label: "Relationships", description: "Friends, family and close bonds." },
]);

export const SCENARIO_CATEGORY_IDS = Object.freeze(SCENARIO_CATEGORIES.map((category) => category.id));

/** Difficulty affects session length, free-text matching strictness and how
 *  many "unexpected" conversational turns the AI partner introduces. */
export const DIFFICULTY_LEVELS = Object.freeze({
  easy: {
    id: "easy",
    label: "Easy",
    freeTextThreshold: 1,
    maxMoments: 3,
    unexpectedEvery: 0,
  },
  medium: {
    id: "medium",
    label: "Medium",
    freeTextThreshold: 2,
    maxMoments: Infinity,
    unexpectedEvery: 4,
  },
  hard: {
    id: "hard",
    label: "Hard",
    freeTextThreshold: 3,
    maxMoments: Infinity,
    unexpectedEvery: 2,
  },
});

export const DIFFICULTY_IDS = Object.freeze(Object.keys(DIFFICULTY_LEVELS));

export const SESSION_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
});

export const FEEDBACK_SUBSCOE = Object.freeze({
  CLARITY: "clarity",
  POLITENESS: "politeness",
  CONFIDENCE: "confidence",
  EMOTIONAL_APPROPRIATENESS: "emotionalAppropriateness",
  COMPLETENESS: "completeness",
});

export const FEEDBACK_SUBSCOE_KEYS = Object.freeze([
  FEEDBACK_SUBSCOE.CLARITY,
  FEEDBACK_SUBSCOE.POLITENESS,
  FEEDBACK_SUBSCOE.CONFIDENCE,
  FEEDBACK_SUBSCOE.EMOTIONAL_APPROPRIATENESS,
  FEEDBACK_SUBSCOE.COMPLETENESS,
]);

export const FEEDBACK_SUBSCOE_LABELS = Object.freeze({
  [FEEDBACK_SUBSCOE.CLARITY]: "Clarity",
  [FEEDBACK_SUBSCOE.POLITENESS]: "Politeness",
  [FEEDBACK_SUBSCOE.CONFIDENCE]: "Confidence",
  [FEEDBACK_SUBSCOE.EMOTIONAL_APPROPRIATENESS]: "Emotional appropriateness",
  [FEEDBACK_SUBSCOE.COMPLETENESS]: "Completeness",
});

/** Adaptation signals the simulator understands. These are the only changes
 *  the module applies to itself in response to Adaptive Engine decisions. */
export const ADAPTATION_SIGNALS = Object.freeze({
  SIMPLIFY_SCENARIO: "simplifyScenario",
  SLOW_PACE: "slowPace",
  REDUCE_DISTRACTIONS: "reduceDistractions",
  RECOMMEND_EASIER_SCENARIO: "recommendEasierScenario",
});

export const DEFAULT_ADAPTATION_SIGNALS = Object.freeze({
  active: false,
  simplifyScenario: false,
  slowPace: false,
  reduceDistractions: false,
  recommendEasierScenario: false,
  decisionTraceId: null,
  sources: [],
  overallConfidence: null,
});

export const SCENARIO_STATE_STORAGE_KEY = "nb_asd_social_scenarios_v1";
export const SCENARIO_A11Y_STORAGE_KEY_PREFIX = "nb_asd_social_scenarios_a11y_";

export const DEFAULT_A11Y_SETTINGS = Object.freeze({
  largeText: false,
  reduceMotion: false,
  focusIndicators: true,
});

/** Deterministic base scores attached to each quick-reply option. The
 *  feedback service blends these with a text heuristic so scores reflect
 *  both the chosen approach and how the user actually phrased it. */
export const QUALITY_PRESETS = Object.freeze({
  strong: Object.freeze({
    [FEEDBACK_SUBSCOE.CLARITY]: 88,
    [FEEDBACK_SUBSCOE.POLITENESS]: 85,
    [FEEDBACK_SUBSCOE.CONFIDENCE]: 78,
    [FEEDBACK_SUBSCOE.EMOTIONAL_APPROPRIATENESS]: 88,
    [FEEDBACK_SUBSCOE.COMPLETENESS]: 82,
  }),
  good: Object.freeze({
    [FEEDBACK_SUBSCOE.CLARITY]: 78,
    [FEEDBACK_SUBSCOE.POLITENESS]: 82,
    [FEEDBACK_SUBSCOE.CONFIDENCE]: 70,
    [FEEDBACK_SUBSCOE.EMOTIONAL_APPROPRIATENESS]: 82,
    [FEEDBACK_SUBSCOE.COMPLETENESS]: 74,
  }),
  neutral: Object.freeze({
    [FEEDBACK_SUBSCOE.CLARITY]: 70,
    [FEEDBACK_SUBSCOE.POLITENESS]: 75,
    [FEEDBACK_SUBSCOE.CONFIDENCE]: 62,
    [FEEDBACK_SUBSCOE.EMOTIONAL_APPROPRIATENESS]: 75,
    [FEEDBACK_SUBSCOE.COMPLETENESS]: 68,
  }),
  fallback: Object.freeze({
    [FEEDBACK_SUBSCOE.CLARITY]: 60,
    [FEEDBACK_SUBSCOE.POLITENESS]: 70,
    [FEEDBACK_SUBSCOE.CONFIDENCE]: 55,
    [FEEDBACK_SUBSCOE.EMOTIONAL_APPROPRIATENESS]: 65,
    [FEEDBACK_SUBSCOE.COMPLETENESS]: 55,
  }),
});
