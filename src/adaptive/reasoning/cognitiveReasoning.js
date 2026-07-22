/**
 * cognitiveReasoning.js — Cognitive Reasoning Core
 *
 * The central decision-making layer of NeuroBridge.
 * Interprets the current user state and determines the most
 * appropriate strategy for support.
 *
 * Responsibilities:
 * - State interpretation
 * - Planning
 * - Intervention ranking
 * - Adaptation decisions
 * - Personalization logic
 *
 * Ownership: Adaptive Intelligence Engineer
 */

/**
 * @typedef {object} AdaptationPlan
 * @property {string[]} primaryInterventions - Ranked list of recommended interventions
 * @property {string} uiMode - Recommended UI adaptation mode
 * @property {object} parameters - Intervention-specific parameters
 * @property {string} rationale - Explanation for the plan
 * @property {number} confidence - Confidence in the plan (0-1)
 */

/**
 * Interpret the current user state and generate an adaptation plan.
 * @param {import("../state/userStateModel.js").UserState} userState
 * @param {object} [options] - Additional context (available modules, user preferences, memory)
 * @returns {AdaptationPlan}
 */
export function reason(userState, options = {}) {
  // TODO: Implement reasoning logic
  // - Map state to intervention categories
  // - Consider user preferences and history
  // - Apply minimal effective intervention principle
  // - Determine UI adaptation needs

  const interventions = [];
  let uiMode = "normal";

  // Example reasoning rules:
  if (userState.cognitiveLoad === "high" || userState.cognitiveLoad === "overwhelming") {
    interventions.push("task_breakdown");
    uiMode = "minimal";
  }

  if (userState.urgency === "high" || userState.urgency === "critical") {
    interventions.push("grounding");
  }

  if (userState.mood === "anxious" || userState.mood === "panicked") {
    interventions.push("calming");
    uiMode = "low_stimulation";
  }

  if (interventions.length === 0) {
    interventions.push("explore_modules");
    uiMode = "normal";
  }

  return {
    primaryInterventions: interventions,
    uiMode,
    parameters: {},
    rationale: `State: mood=${userState.mood}, load=${userState.cognitiveLoad}, urgency=${userState.urgency}`,
    confidence: userState.confidence || 0.5,
  };
}

/**
 * Re-evaluate an adaptation plan when the user state changes.
 * @param {AdaptationPlan} currentPlan
 * @param {import("../state/userStateModel.js").UserState} newState
 * @returns {AdaptationPlan}
 */
export function reevaluate(currentPlan, newState) {
  // TODO: Incrementally update plan rather than recomputing from scratch
  return reason(newState);
}
