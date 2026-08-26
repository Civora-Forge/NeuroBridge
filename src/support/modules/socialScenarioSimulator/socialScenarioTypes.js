/**
 * socialScenarioTypes.js — Shared constants and Zod schemas for the Social
 * Scenario Simulator.
 *
 * The simulator is an ASD support module for ACTIVE practice of a SINGLE
 * social scenario: the user is shown one defined situation and a role, speaks
 * or types one response, and receives structured feedback. It is deliberately
 * distinct from Conversation Practice (multi-turn conversation) and from
 * Social Stories (passive learning). All generation, evaluation and store
 * logic stays deterministic and unit-testable.
 */

import { z } from "zod";

export const SOCIAL_SCENARIO_MODULE_ID = "asd.social-scenarios";

export const SCENARIO_CATEGORIES = Object.freeze([
  { id: "college", label: "College", description: "Classes, group work and campus life." },
  { id: "workplace", label: "Workplace", description: "Colleagues, managers and work tasks." },
  { id: "daily_life", label: "Daily Life", description: "Everyday errands and public spaces." },
  { id: "relationships", label: "Relationships", description: "Friends, family and close bonds." },
]);

export const SCENARIO_CATEGORY_IDS = Object.freeze(SCENARIO_CATEGORIES.map((category) => category.id));

export function getScenarioCategoryById(categoryId) {
  return SCENARIO_CATEGORIES.find((category) => category.id === categoryId) ?? null;
}

/** Difficulty shapes how subtle the cues are and how strict the wording
 *  heuristic is. A single-response exercise, so no turn counts here. */
export const SCENARIO_DIFFICULTIES = Object.freeze([
  { id: "easy", label: "Easy", description: "A clear situation with obvious cues." },
  { id: "medium", label: "Medium", description: "A realistic situation with a few subtle cues." },
  { id: "hard", label: "Hard", description: "A trickier situation with mixed or competing cues." },
]);

export const SCENARIO_DIFFICULTY_IDS = Object.freeze(SCENARIO_DIFFICULTIES.map((level) => level.id));

export function getScenarioDifficultyById(difficultyId) {
  return SCENARIO_DIFFICULTIES.find((level) => level.id === difficultyId) ?? null;
}

export const SESSION_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
});

/** Adaptation signals the simulator understands. These are the only changes
 *  the module applies to itself in response to Adaptive Engine decisions. */
export const ADAPTATION_SIGNALS = Object.freeze({
  SIMPLIFY: "simplify",
  PROVIDE_HINTS: "provideHints",
  SLOW_PACE: "slowPace",
  REDUCE_DISTRACTIONS: "reduceDistractions",
});

export const DEFAULT_ADAPTATION_SIGNALS = Object.freeze({
  active: false,
  simplify: false,
  provideHints: false,
  slowPace: false,
  reduceDistractions: false,
  decisionTraceId: null,
  sources: [],
  overallConfidence: null,
});

export const SCENARIO_STATE_STORAGE_KEY = "nb_asd_social_scenarios_v1";
export const SCENARIO_A11Y_STORAGE_KEY_PREFIX = "nb_asd_social_scenarios_a11y_";
export const SCENARIO_ATTEMPTS_STORAGE_KEY = "nb_asd_social_scenarios_attempts_v1";

export const DEFAULT_A11Y_SETTINGS = Object.freeze({
  largeText: false,
  reduceMotion: false,
  focusIndicators: true,
});

// ─────────────────────────────────────────────
//  Structured evaluation dimensions
// ─────────────────────────────────────────────
export const EVALUATION_DIMENSIONS = Object.freeze([
  { id: "politeness", label: "Politeness and respect", weight: 0.25 },
  { id: "clarity", label: "Clarity", weight: 0.2 },
  { id: "relevance", label: "Relevance to the situation", weight: 0.2 },
  { id: "addressing", label: "Addressing what was said", weight: 0.15 },
  { id: "cueRecognition", label: "Social cue recognition", weight: 0.1 },
  { id: "appropriateness", label: "Social appropriateness", weight: 0.1 },
]);

export const EVALUATION_DIMENSION_IDS = Object.freeze(
  EVALUATION_DIMENSIONS.map((dimension) => dimension.id),
);

// ─────────────────────────────────────────────
//  AI output schemas (validated before use)
// ─────────────────────────────────────────────
export const SocialScenarioSchema = z.object({
  category: z.string().trim().min(1),
  title: z.string().trim().min(1),
  setting: z.string().trim().min(1),
  situation: z.string().trim().min(1),
  role: z.string().trim().min(1),
  question: z.string().trim().min(1),
  cues: z.array(z.string().trim().min(1)).min(1).max(4),
  suggestedResponse: z.string().trim().min(1),
  hint: z.string().trim().nullish(),
});

/** The AI refinement of the qualitative feedback only. The score is always
 *  computed deterministically by the evaluation service so behaviour stays
 *  stable; the model may adjust the wording, suggestions and reasoning. */
export const SocialScenarioEvaluationSchema = z.object({
  strengths: z.array(z.string().trim().min(1)).max(4).default([]),
  improvements: z.array(z.string().trim().min(1)).max(4).default([]),
  detectedCues: z.array(z.string().trim().min(1)).max(4).default([]),
  suggestedResponse: z.string().trim().nullish(),
  reasoning: z.string().trim().nullish(),
  speechNotes: z.string().trim().nullish(),
});
