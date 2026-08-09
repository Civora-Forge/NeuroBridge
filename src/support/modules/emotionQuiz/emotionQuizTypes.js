/**
 * emotionQuizTypes.js — Shared constants and Zod schemas for the Emotion Quiz.
 *
 * The quiz is a shared practice capability that lives under the ASD surface but
 * is not ASD-exclusive. Questions rotate across three deterministic question
 * types so practice never becomes a single repetitive pattern:
 *
 *   - match_scenario  — read a situation and pick the emotion it most likely
 *                       describes.
 *   - identify_cue    — pick the cue that best suggests a named emotion.
 *   - reaction        — pick a helpful way to respond when you notice an
 *                       emotion.
 *
 * AI generation is optional; a deterministic fallback library always runs.
 */

import { z } from "zod";

export const EMOTION_QUIZ_MODULE_ID = "asd.emotion-quiz";

export const QUIZ_SOURCE = Object.freeze({
  AI: "ai",
  FALLBACK: "fallback",
});

export const QUIZ_QUESTION_TYPES = Object.freeze({
  MATCH_SCENARIO: "match_scenario",
  IDENTIFY_CUE: "identify_cue",
  REACTION: "reaction",
});

export const QUIZ_QUESTION_TYPE_IDS = Object.freeze(Object.values(QUIZ_QUESTION_TYPES));

export const QUIZ_DIFFICULTIES = Object.freeze([1, 2, 3]);
export const QUIZ_DEFAULT_DIFFICULTY = 1;

/** Validated shape of one quiz question. Options and correct id must agree. */
export const EmotionQuizQuestionSchema = z.object({
  id: z.string().trim().min(1).optional(),
  type: z.enum(QUIZ_QUESTION_TYPE_IDS),
  prompt: z.string().trim().min(1),
  scenario: z.string().trim().optional(),
  options: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
      }),
    )
    .min(2),
  correctOptionId: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});
