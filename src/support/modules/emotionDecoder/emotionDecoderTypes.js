/**
 * emotionDecoderTypes.js — Shared constants and Zod schemas for the Emotion
 * Decoder.
 *
 * The Emotion Decoder is a shared capability that lives under the ASD surface
 * but is not ASD-exclusive: it presents a short real-world situation, the other
 * person's words or behaviour, and the observable cues, then asks the user to
 * read the emotion. AI generation is optional — a deterministic library always
 * runs the feature — and every AI response is Zod-validated before use.
 */

import { z } from "zod";

export const EMOTION_DECODER_MODULE_ID = "asd.emotion-decoder";

export const DECODER_SOURCE = Object.freeze({
  AI: "ai",
  FALLBACK: "fallback",
});

export const DECODER_DIFFICULTIES = Object.freeze([1, 2, 3]);
export const DECODER_DEFAULT_DIFFICULTY = 1;

export const DECODER_ACTIVITY_TYPES = Object.freeze([
  { id: "daily_life", label: "Daily life", description: "Everyday situations like shops, school or home." },
  { id: "friends", label: "With friends", description: "Situations with people you know well." },
  { id: "family", label: "With family", description: "Situations at home or with relatives." },
]);

export const DECODER_ACTIVITY_TYPE_IDS = Object.freeze(
  DECODER_ACTIVITY_TYPES.map((activityType) => activityType.id),
);

export function getDecoderActivityTypeById(activityTypeId) {
  return DECODER_ACTIVITY_TYPES.find((activityType) => activityType.id === activityTypeId) ?? null;
}

/**
 * Validated shape of a decoder scenario produced by the AI provider. Every
 * field must be present and non-empty so the UI never renders partial data.
 * Difficulty is restricted to 1–3 so the fallback and AI paths agree.
 */
export const EmotionDecoderScenarioSchema = z.object({
  id: z.string().trim().min(1).optional(),
  scenario: z.string().trim().min(1),
  dialogue: z.string().trim().min(1),
  cues: z.array(z.string().trim().min(1)).min(1),
  question: z.string().trim().min(1),
  expectedInterpretations: z.array(z.string().trim().min(1)).min(1),
  explanation: z.string().trim().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  activityType: z.string().trim().min(1).optional(),
});
