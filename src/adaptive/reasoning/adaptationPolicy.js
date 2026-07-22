/**
 * adaptationPolicy.js — Adaptation Decision Engine
 *
 * Defines the policy rules that determine how NeuroBridge adapts
 * its behavior based on the current user state, context, and history.
 *
 * This module governs:
 * - When to trigger adaptation
 * - Which UI mode to activate
 * - How to adjust intervention parameters
 * - Threshold rules for state-driven adaptation
 * - Graceful fallback when state is uncertain
 *
 * The policy acts as the bridge between the Cognitive Reasoning Core
 * and the Adaptive Experience Layer (UI Adapter).
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { FEATURES, FEATURE_REGISTRY, resolveEnabledFeatures } from "@/lib/featureRegistry";
import { DISORDERS } from "@/lib/disorders";

/**
 * @typedef {object} AdaptationTrigger
 * @property {string} stateDimension - Which state dimension triggers adaptation
 * @property {string} condition - The condition to evaluate (e.g., "gte", "lte", "eq")
 * @property {*} threshold - The threshold value
 * @property {string} adaptationType - What type of adaptation to apply
 */

/**
 * @typedef {object} AdaptationRule
 * @property {string} id - Unique rule identifier
 * @property {string} description - Human-readable description
 * @property {AdaptationTrigger[]} triggers - Conditions that activate this rule
 * @property {string} uiMode - Target UI mode
 * @property {object} parameters - Adaptation parameters
 * @property {number} priority - Rule priority (higher = applied first)
 */

/**
 * Default adaptation rules for state-driven UI changes.
 * Rules are evaluated in priority order.
 */
export const ADAPTATION_RULES = [
  {
    id: "overwhelm_simplification",
    description: "Simplify UI when user is overwhelmed",
    triggers: [
      { stateDimension: "cognitiveLoad", condition: "eq", threshold: "overwhelming", adaptationType: "ui_simplification" },
    ],
    uiMode: "overwhelm",
    parameters: {
      maxVisibleModules: 1,
      showPrimaryAction: true,
      reduceAnimations: true,
      simplifyNavigation: true,
    },
    priority: 100,
  },
  {
    id: "high_load_minimal",
    description: "Reduce choices during high cognitive load",
    triggers: [
      { stateDimension: "cognitiveLoad", condition: "eq", threshold: "high", adaptationType: "ui_reduction" },
    ],
    uiMode: "minimal",
    parameters: {
      maxVisibleModules: 2,
      showPrimaryAction: true,
      reduceAnimations: true,
      simplifyNavigation: false,
    },
    priority: 80,
  },
  {
    id: "low_stimulation",
    description: "Activate low-stimulation mode for high arousal or anxiety",
    triggers: [
      { stateDimension: "mood", condition: "eq", threshold: "anxious", adaptationType: "sensory_reduction" },
      { stateDimension: "mood", condition: "eq", threshold: "panicked", adaptationType: "sensory_reduction" },
    ],
    uiMode: "low_stimulation",
    parameters: {
      maxVisibleModules: 3,
      reduceAnimations: true,
      reduceColorIntensity: true,
      showCalmingContent: true,
    },
    priority: 90,
  },
  {
    id: "focus_mode",
    description: "Activate focus mode for single-task attention",
    triggers: [
      { stateDimension: "attention", condition: "eq", threshold: "focused", adaptationType: "focus_enhancement" },
    ],
    uiMode: "focus",
    parameters: {
      maxVisibleModules: 1,
      showPrimaryAction: true,
      reduceDistractions: true,
    },
    priority: 60,
  },
  {
    id: "scattered_guidance",
    description: "Provide guided experience when attention is scattered",
    triggers: [
      { stateDimension: "attention", condition: "eq", threshold: "scattered", adaptationType: "guidance" },
    ],
    uiMode: "guided",
    parameters: {
      maxVisibleModules: 3,
      showStepByStep: true,
      highlightNextAction: true,
    },
    priority: 70,
  },
  {
    id: "critical_urgency",
    description: "Immediate support for critical urgency states",
    triggers: [
      { stateDimension: "urgency", condition: "eq", threshold: "critical", adaptationType: "immediate_support" },
    ],
    uiMode: "overwhelm",
    parameters: {
      maxVisibleModules: 1,
      showPrimaryAction: true,
      showEmergencySupport: true,
    },
    priority: 110,
  },
];

/**
 * Evaluate a single condition against a state value.
 * @param {*} stateValue - Current state value
 * @param {string} condition - Comparison operator
 * @param {*} threshold - Threshold to compare against
 * @returns {boolean}
 */
function evaluateCondition(stateValue, condition, threshold) {
  switch (condition) {
    case "eq": return stateValue === threshold;
    case "neq": return stateValue !== threshold;
    case "gte": return stateValue >= threshold;
    case "lte": return stateValue <= threshold;
    case "gt": return stateValue > threshold;
    case "lt": return stateValue < threshold;
    case "includes": return Array.isArray(stateValue) && stateValue.includes(threshold);
    default: return false;
  }
}

/**
 * Evaluate a single adaptation rule against the current user state.
 * @param {AdaptationRule} rule
 * @param {import("../state/userStateModel.js").UserState} userState
 * @returns {boolean}
 */
function evaluateRule(rule, userState) {
  return rule.triggers.some((trigger) => {
    const stateValue = userState[trigger.stateDimension];
    return evaluateCondition(stateValue, trigger.condition, trigger.threshold);
  });
}

/**
 * Determine the appropriate adaptation based on the current user state.
 *
 * @param {import("../state/userStateModel.js").UserState} userState - Current user state
 * @param {object} [options] - Additional context
 * @param {string[]} [options.enabledFeatures] - Currently enabled features
 * @param {string[]} [options.userDisorders] - User's disorder list
 * @returns {{ uiMode: string, parameters: object, activeRules: string[], rationale: string }}
 */
export function determineAdaptation(userState, options = {}) {
  // Sort rules by priority (descending)
  const sortedRules = [...ADAPTATION_RULES].sort((a, b) => b.priority - a.priority);

  // Find all matching rules
  const activeRules = sortedRules.filter((rule) => evaluateRule(rule, userState));

  if (activeRules.length === 0) {
    return {
      uiMode: "normal",
      parameters: {},
      activeRules: [],
      rationale: "No adaptation rules matched; using default UI.",
    };
  }

  // Use the highest-priority matching rule as the primary adaptation
  const primary = activeRules[0];

  // Merge parameters from all matching rules (later rules override earlier ones)
  const mergedParameters = activeRules.reduce(
    (acc, rule) => ({ ...acc, ...rule.parameters }),
    {},
  );

  return {
    uiMode: primary.uiMode,
    parameters: mergedParameters,
    activeRules: activeRules.map((r) => r.id),
    rationale: `Rule "${primary.id}" activated: ${primary.description}.`,
  };
}

/**
 * Get the feature set available for a given user profile.
 * Combines disorder-based features with explicit module selections.
 *
 * @param {object} profile - User profile
 * @param {string[]} [profile.disorders] - User's disorders
 * @param {string[]} [profile.enabledModules] - Explicitly enabled modules
 * @returns {Set<string>}
 */
export function getAvailableFeatures(profile = {}) {
  return resolveEnabledFeatures({
    disorders: profile.disorders || [],
    enabledModules: profile.enabledModules || [],
  });
}

/**
 * Check if a specific adaptation is recommended given the current state.
 * Useful for components that need to know if they should adapt.
 *
 * @param {import("../state/userStateModel.js").UserState} userState
 * @param {string} adaptationType - The type of adaptation to check
 * @returns {{ recommended: boolean, priority: string }}
 */
export function checkAdaptationRecommendation(userState, adaptationType) {
  const sortedRules = [...ADAPTATION_RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (!evaluateRule(rule, userState)) continue;

    const hasMatchingType = rule.triggers.some(
      (t) => t.adaptationType === adaptationType,
    );

    if (hasMatchingType) {
      return {
        recommended: true,
        priority: rule.priority >= 90 ? "critical" : rule.priority >= 70 ? "high" : "normal",
      };
    }
  }

  return { recommended: false, priority: "none" };
}
