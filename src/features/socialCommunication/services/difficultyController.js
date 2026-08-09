/**
 * difficultyController.js — Adaptive difficulty for the Social Communication
 * Simulator.
 *
 * Difficulty is a bounded 1-5 scale. It changes only between sessions, from
 * structured evaluation scores (never from an LLM), with hysteresis so it
 * cannot oscillate: a step requires at least two consecutive evaluations
 * agreeing on the direction. `recommendEasier` from the Adaptive Engine
 * overrides towards easier within the same bounds.
 */

import { DEFAULT_DIFFICULTY, MAX_DIFFICULTY, MIN_DIFFICULTY } from "../types/communicationTypes";

const RAISE_THRESHOLD = 80;
const LOWER_THRESHOLD = 55;
const MIN_EVALUATIONS_TO_ADJUST = 2;

function asScore(value) {
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {{ current?: number, scores?: number[], recommendEasier?: boolean }} input
 * @returns {{ difficulty: number, reason: string, changed: boolean }}
 */
export function computeNextDifficulty({
  current = DEFAULT_DIFFICULTY,
  scores = [],
  recommendEasier = false,
} = {}) {
  const base = Number.isInteger(current) && current >= MIN_DIFFICULTY && current <= MAX_DIFFICULTY
    ? current
    : DEFAULT_DIFFICULTY;

  const recent = (Array.isArray(scores) ? scores : []).map(asScore).filter((score) => score !== null);

  if (recommendEasier && base > MIN_DIFFICULTY) {
    return { difficulty: base - 1, reason: "engine_recommendation", changed: true };
  }

  if (recent.length < MIN_EVALUATIONS_TO_ADJUST) {
    return { difficulty: base, reason: "not_enough_data", changed: false };
  }

  const lastTwo = recent.slice(-2);
  const allAbove = lastTwo.every((score) => score >= RAISE_THRESHOLD);
  const allBelow = lastTwo.every((score) => score <= LOWER_THRESHOLD);

  if (allAbove && base < MAX_DIFFICULTY) {
    return { difficulty: base + 1, reason: "strong_recent_performance", changed: true };
  }
  if (allBelow && base > MIN_DIFFICULTY) {
    return { difficulty: base - 1, reason: "needs_more_support", changed: true };
  }

  return { difficulty: base, reason: "stable", changed: false };
}

/** Clamp any candidate difficulty into the valid bounded range. */
export function clampDifficulty(value) {
  if (!Number.isInteger(value)) return DEFAULT_DIFFICULTY;
  return Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, value));
}
