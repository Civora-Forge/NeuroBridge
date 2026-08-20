/**
 * anxietyOutcomeModel.js — Structured Intervention Outcome Quality Model with 1-tap feedback support
 *
 * Responsibilities:
 *   - Captures lightweight 1-tap subjective outcome ("better" | "same" | "worse") as well as detailed numeric ratings.
 *   - Evaluates response tier (strong_response, moderate_response, no_response, adverse).
 *   - Pure, deterministic outcome evaluation.
 */

/**
 * Maps subjective 1-tap response to numerical delta and effectiveness tier
 *
 * @param {"better"|"same"|"worse"} subjectiveOutcome
 * @returns {{ delta: number, effectiveness: string }}
 */
export function evaluateSubjectiveResponse(subjectiveOutcome) {
  switch (subjectiveOutcome) {
    case "better":
      return { delta: 3, effectiveness: "strong_response" };
    case "same":
      return { delta: 0, effectiveness: "no_response" };
    case "worse":
      return { delta: -2, effectiveness: "adverse" };
    default:
      return { delta: 1, effectiveness: "moderate_response" };
  }
}

/**
 * Creates a structured Outcome Record from an intervention session
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.interventionId
 * @param {string} params.patternType
 * @param {"better"|"same"|"worse"|null} [params.subjectiveOutcome] 1-tap outcome feedback
 * @param {number|null} [params.preSeverity]
 * @param {number|null} [params.postSeverity]
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
  subjectiveOutcome = null,
  preSeverity = null,
  postSeverity = null,
  completed = true,
  abandoned = false,
  durationSeconds = 0,
  stateSnapshot = {},
  timestamp = new Date().toISOString(),
}) {
  let delta = 0;
  let effectiveness = "moderate_response";

  if (subjectiveOutcome) {
    const sub = evaluateSubjectiveResponse(subjectiveOutcome);
    delta = sub.delta;
    effectiveness = sub.effectiveness;
  } else if (preSeverity != null && postSeverity != null) {
    delta = Number(preSeverity) - Number(postSeverity);
    if (delta >= 3) effectiveness = "strong_response";
    else if (delta >= 1) effectiveness = "moderate_response";
    else if (delta === 0) effectiveness = "no_response";
    else effectiveness = "adverse";
  }

  if (abandoned) {
    effectiveness = delta > 0 ? "moderate_response" : "no_response";
  }

  return {
    id: `out-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    interventionId,
    patternType,
    subjectiveOutcome,
    preSeverity: preSeverity != null ? Number(preSeverity) : null,
    postSeverity: postSeverity != null ? Number(postSeverity) : null,
    delta,
    completed: completed && !abandoned,
    abandoned: Boolean(abandoned),
    durationSeconds: Math.max(0, Number(durationSeconds ?? 0)),
    stateSnapshot,
    effectiveness,
    timestamp,
  };
}
