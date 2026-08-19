/**
 * anxietyOutcomeModel.js — Structured Intervention Outcome Quality Model
 *
 * Responsibilities:
 *   - Captures rich outcome metrics: pre/post severity, delta, completion, duration, and state snapshot.
 *   - Evaluates effectiveness tier (strong_response, moderate_response, no_response, adverse).
 *   - Provides pure, deterministic outcome evaluation.
 */

/**
 * Evaluates outcome response tier from pre/post ratings and completion status
 *
 * @param {number} delta (pre - post)
 * @param {boolean} completed
 * @param {boolean} abandoned
 * @returns {"strong_response" | "moderate_response" | "no_response" | "adverse"}
 */
export function evaluateEffectiveness(delta, completed, abandoned) {
  if (delta < 0) return "adverse";
  if (abandoned || !completed) {
    return delta >= 2 ? "moderate_response" : "no_response";
  }
  if (delta >= 3) return "strong_response";
  if (delta >= 1) return "moderate_response";
  return "no_response";
}

/**
 * Creates a structured Outcome Record from an intervention session
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.interventionId
 * @param {string} params.patternType
 * @param {number} params.preSeverity
 * @param {number} params.postSeverity
 * @param {boolean} [params.completed=true]
 * @param {boolean} [params.abandoned=false]
 * @param {number} [params.durationSeconds=0]
 * @param {object} [params.stateSnapshot={}]
 * @param {string} [params.timestamp]
 * @returns {object} OutcomeRecord
 */
export function createOutcomeRecord({
  userId = "anon",
  interventionId,
  patternType,
  preSeverity,
  postSeverity,
  completed = true,
  abandoned = false,
  durationSeconds = 0,
  stateSnapshot = {},
  timestamp = new Date().toISOString(),
}) {
  const pre = Math.max(0, Math.min(10, Number(preSeverity ?? 0)));
  const post = Math.max(0, Math.min(10, Number(postSeverity ?? pre)));
  const delta = pre - post;
  const isCompleted = completed && !abandoned;
  const isAbandoned = abandoned || !completed;

  const effectiveness = evaluateEffectiveness(delta, isCompleted, isAbandoned);

  return {
    id: `out-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    interventionId,
    patternType,
    preSeverity: pre,
    postSeverity: post,
    delta,
    completed: isCompleted,
    abandoned: isAbandoned,
    durationSeconds: Math.max(0, Number(durationSeconds ?? 0)),
    stateSnapshot,
    effectiveness,
    timestamp,
  };
}
