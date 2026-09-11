/**
 * outcomeRatings.js — Shared subjective-outcome → Role 4 rating mapping
 *
 * Single source of truth for turning the qualitative readings produced by the
 * five feature flows (Adaptive Anxiety Engine, Gentle Activity, Grounding,
 * Social Scenario Simulator, Conversation Practice) into the numeric `rating`
 * (1–5) persisted on Role 4 `InterventionOutcome` records.
 *
 * Determinism: identical input produces an identical rating. Every entry point
 * returns `null` for input that carries no evaluable signal, so callers can
 * detect "no rating" and skip persistence rather than fabricating one.
 *
 * Whatever a feature previously recorded in its own feature-local store must
 * pass through these helpers too, so that historical evidence is scored
 * exactly like new evidence (never through a parallel formula).
 *
 * Ownership: Support & Learning Engineer
 */

/**
 * Ratings normalized to the lower surface area of the subjective outcome
 * space. Neutral (rating 3) is the honest middle: it is persisted and
 * evaluable as neutral, never coerced toward either pole.
 */
const RATING_BETTER = 5;
const RATING_SAME = 3;
const RATING_WORSE = 1;

/** Conversation score band in the feature's native 0–100 scale. */
const CONVERSATION_HIGH_BAND = 80;
const CONVERSATION_MEDIUM_BAND = 55;

/** Accepted lexical forms for each qualitative outcome. */
const BETTER_TOKENS = new Set(["better", "improved", "positive", "good", "well"]);
const WORSE_TOKENS = new Set(["worse", "declined", "negative", "poor"]);
const SAME_TOKENS = new Set(["same", "unchanged", "neutral", "ok"]);

/**
 * Map a qualitative user-reported outcome to a Role 4 rating (1–5).
 *
 * @param {unknown} value - Either a raw string token ("better" / "same" /
 *   "worse") or an object carrying one in a documented field (e.g.
 *   `outcome.completionStatus`, `outcome.userFeedback`, `outcome.subjective`).
 * @returns {number|null} `5` for better, `3` for same, `1` for worse, or
 *   `null` when the input carries no recognizable subjective signal.
 */
export function mapSubjectiveOutcomeToRating(value) {
  const raw =
    typeof value === "string" ? value : value?.subjective ?? value?.userFeedback ?? value?.completionStatus;
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (BETTER_TOKENS.has(normalized)) {
    return RATING_BETTER;
  }
  if (SAME_TOKENS.has(normalized)) {
    return RATING_SAME;
  }
  if (WORSE_TOKENS.has(normalized)) {
    return RATING_WORSE;
  }
  return null;
}

/**
 * Map a conversation/evaluation score (0–100) to a Role 4 rating (1–5).
 *
 * Documented bands mirror the feature's existing `SCORE_BANDS` without
 * shaming language: high ≥ 80 → 5, medium ≥ 55 → 3, below → 1.
 *
 * @param {unknown} score - Numeric score in [0, 100].
 * @returns {number|null} `5`, `3`, or `1`, or `null` when the value is not a
 *   finite number that can be scored.
 */
export function ratingFromConversationScore(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }
  if (score >= CONVERSATION_HIGH_BAND) {
    return RATING_BETTER;
  }
  if (score >= CONVERSATION_MEDIUM_BAND) {
    return RATING_SAME;
  }
  return RATING_WORSE;
}

/**
 * Resolve the rating to persist for an outcome that may carry either a
 * subjective reading or a scored band. Explicit rating always wins (the most
 * direct signal); otherwise the qualitative reading is mapped. Returns `null`
 * only when nothing evaluable is present.
 *
 * @param {object} [outcome] - Outcome fragment.
 * @param {number} [outcome.rating] - Optional explicit 1–5 rating.
 * @param {string} [outcome.subjective] - Qualitative reading ("better" etc.).
 * @param {number} [outcome.score] - Optional banded 0–100 score.
 * @returns {number|null}
 */
export function resolveOutcomeRating(outcome = {}) {
  if (outcome && typeof outcome.rating === "number" && Number.isFinite(outcome.rating)) {
    return Math.min(5, Math.max(1, Math.round(outcome.rating)));
  }
  const fromSubjective = mapSubjectiveOutcomeToRating(outcome);
  if (fromSubjective !== null) {
    return fromSubjective;
  }
  return ratingFromConversationScore(outcome?.score);
}