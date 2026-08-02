/**
 * adaptationPolicy.js — Policy evaluation for the Adaptive Engine (Role 2).
 *
 * Defines the policy rules that determine how NeuroBridge adapts its
 * behavior based on the current user state.
 *
 * Model:
 *   - Policies are expressed as PolicyRule objects (see supportSchemas).
 *   - triggerGroups are OR-ed: a rule fires when ANY trigger group is
 *     fully satisfied.
 *   - Each trigger group is AND-ed: it fires only when ALL of its triggers
 *     are satisfied.
 *   - Precedence is categorical: a lower numeric tier number wins regardless
 *     of numeric priority. Numeric priority resolves ties only within the
 *     same tier. Parameters from higher-precedence rules win.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { resolveEnabledFeatures } from "@/lib/featureRegistry";
import {
  AdaptationActionType,
  AdaptationDimension,
  PolicyScope,
  PriorityTier,
  TriggerCondition,
  TriggerGroupOperator,
  validatePolicyRule,
} from "@/support/schemas/supportSchemas";

/**
 * @typedef {object} AdaptationTrigger
 * @property {string} stateDimension - Which state dimension triggers adaptation
 * @property {string} condition - The condition to evaluate (e.g., "eq")
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
 * Legacy adaptation rules, retained unchanged for backward compatibility.
 * The canonical ruleset is ADAPTATION_POLICIES (PolicyRule contract).
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
 * Canonical adaptation policies (PolicyRule contract), migrated from the
 * legacy ADAPTATION_RULES. IDs and numeric priorities are preserved; the
 * numeric priorities act only as within-tier tie-breakers at Tier 8
 * (CURRENT COGNITIVE/EMOTIONAL STATE).
 */
const rawPolicies = [
  {
    id: "critical_urgency",
    scope: PolicyScope.GENERIC,
    tier: PriorityTier.CURRENT_STATE,
    priority: 110,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [{ dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" }],
      },
    ],
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: {
        mode: "overwhelm",
        adaptationType: "immediate_support",
        maxVisibleModules: 1,
        showPrimaryAction: true,
        showEmergencySupport: true,
      },
    },
  },
  {
    id: "overwhelm_simplification",
    scope: PolicyScope.GENERIC,
    tier: PriorityTier.CURRENT_STATE,
    priority: 100,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [
          { dimension: "cognitiveLoad", condition: TriggerCondition.EQ, value: "overwhelming" },
        ],
      },
    ],
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: {
        mode: "overwhelm",
        adaptationType: "ui_simplification",
        maxVisibleModules: 1,
        showPrimaryAction: true,
        reduceAnimations: true,
        simplifyNavigation: true,
      },
    },
  },
  {
    id: "low_stimulation",
    scope: PolicyScope.GENERIC,
    tier: PriorityTier.CURRENT_STATE,
    priority: 90,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [{ dimension: "mood", condition: TriggerCondition.EQ, value: "anxious" }],
      },
      {
        operator: TriggerGroupOperator.AND,
        triggers: [{ dimension: "mood", condition: TriggerCondition.EQ, value: "panicked" }],
      },
    ],
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: {
        mode: "low_stimulation",
        adaptationType: "sensory_reduction",
        maxVisibleModules: 3,
        reduceAnimations: true,
        reduceColorIntensity: true,
        showCalmingContent: true,
      },
    },
  },
  {
    id: "high_load_minimal",
    scope: PolicyScope.GENERIC,
    tier: PriorityTier.CURRENT_STATE,
    priority: 80,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [{ dimension: "cognitiveLoad", condition: TriggerCondition.EQ, value: "high" }],
      },
    ],
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: {
        mode: "minimal",
        adaptationType: "ui_reduction",
        maxVisibleModules: 2,
        showPrimaryAction: true,
        reduceAnimations: true,
        simplifyNavigation: false,
      },
    },
  },
  {
    id: "scattered_guidance",
    scope: PolicyScope.GENERIC,
    tier: PriorityTier.CURRENT_STATE,
    priority: 70,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [{ dimension: "attention", condition: TriggerCondition.EQ, value: "scattered" }],
      },
    ],
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: {
        mode: "guided",
        adaptationType: "guidance",
        maxVisibleModules: 3,
        showStepByStep: true,
        highlightNextAction: true,
      },
    },
  },
  {
    id: "focus_mode",
    scope: PolicyScope.GENERIC,
    tier: PriorityTier.CURRENT_STATE,
    priority: 60,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [{ dimension: "attention", condition: TriggerCondition.EQ, value: "focused" }],
      },
    ],
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: {
        mode: "focus",
        adaptationType: "focus_enhancement",
        maxVisibleModules: 1,
        showPrimaryAction: true,
        reduceDistractions: true,
      },
    },
  },
];

export const ADAPTATION_POLICIES = rawPolicies.map((policy) => validatePolicyRule(policy));

/**
 * Compare two triggered-policy entries by precedence.
 * Lower tier number wins; within a tier, higher numeric priority wins.
 */
function comparePrecedence(left, right) {
  if (left.tier !== right.tier) {
    return left.tier - right.tier;
  }
  return right.priority - left.priority;
}

/**
 * Read a state dimension value. UserState exposes dimension values as
 * strings via property access; raw DimensionResult objects are unwrapped.
 */
function readDimension(resolvedState, dimension) {
  const value = resolvedState?.[dimension];
  if (value && typeof value === "object" && "value" in value) {
    return value.value;
  }
  return value;
}

/**
 * Evaluate a single trigger against a resolved state.
 * @param {import("../../../support/schemas/supportSchemas").TriggerSchema} trigger
 * @param {object} resolvedState
 * @returns {boolean}
 */
function evaluateTrigger(trigger, resolvedState) {
  const actual = readDimension(resolvedState, trigger.dimension);
  switch (trigger.condition) {
    case TriggerCondition.GTE:
      return actual >= trigger.value;
    case TriggerCondition.LTE:
      return actual <= trigger.value;
    case TriggerCondition.EQ:
      return actual === trigger.value;
    case TriggerCondition.IN:
      return Array.isArray(trigger.value) && trigger.value.includes(actual);
    case TriggerCondition.NOT_IN:
      return Array.isArray(trigger.value) && !trigger.value.includes(actual);
    default:
      return false;
  }
}

/**
 * Evaluate policies against a resolved state.
 *
 * @param {Array<import("../../../support/schemas/supportSchemas").PolicyRuleSchema>} rules
 * @param {object} resolvedState - UserState (dimensions readable by name)
 * @returns {{ triggered: Array<object> }}
 */
export function evaluatePolicies(rules, resolvedState) {
  const triggered = [];

  for (const rule of rules) {
    if (!rule || rule.active === false) {
      continue;
    }
    if (!Array.isArray(rule.triggerGroups) || rule.triggerGroups.length === 0) {
      continue;
    }

    const matchedGroups = [];
    rule.triggerGroups.forEach((group, groupIndex) => {
      if (!group || !Array.isArray(group.triggers) || group.triggers.length === 0) {
        return;
      }
      const matchedTriggers = group.triggers.filter((trigger) => evaluateTrigger(trigger, resolvedState));
      if (matchedTriggers.length === group.triggers.length) {
        matchedGroups.push({ groupIndex, matchedTriggers });
      }
    });

    if (matchedGroups.length === 0) {
      continue;
    }

    triggered.push({
      ruleId: rule.id,
      version: rule.version ?? 1,
      tier: rule.tier,
      priority: rule.priority ?? 0,
      scope: rule.scope,
      action: rule.action,
      matchedGroups,
      matchedTriggers: matchedGroups.flatMap((group) => group.matchedTriggers),
    });
  }

  triggered.sort(comparePrecedence);

  return { triggered };
}

/**
 * Compatibility wrapper: select triggered policies for a resolved state.
 * @param {object} userState
 * @param {object} [options]
 * @param {Array<object>} [options.rules]
 * @returns {Array<object>} Triggered policies ordered by precedence
 */
export function selectRules(userState, options = {}) {
  return evaluatePolicies(options.rules ?? ADAPTATION_POLICIES, userState).triggered;
}

/**
 * Compatibility surface exposing the canonical policies and evaluator.
 */
export const adaptationPolicy = {
  rules: ADAPTATION_POLICIES,
  evaluate: evaluatePolicies,
};

/**
 * Merge adaptation parameters with fixed precedence: higher-precedence rules
 * win, lower-precedence rules cannot overwrite already-selected parameters.
 * The engine-facing mode and adaptationType metadata are excluded.
 */
function mergeParameters(triggered) {
  const merged = {};
  for (const entry of triggered) {
    const parameters = entry.action?.parameters ?? {};
    const { mode, adaptationType, ...tuning } = parameters;
    for (const [key, value] of Object.entries(tuning)) {
      if (!(key in merged)) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

/**
 * Determine the appropriate adaptation based on the current user state.
 *
 * @param {import("../state/userStateModel.js").UserState} userState - Current user state
 * @param {object} [options] - Additional context
 * @returns {{ uiMode: string, parameters: object, activeRules: string[], rationale: string }}
 */
export function determineAdaptation(userState, options = {}) {
  const { triggered } = evaluatePolicies(ADAPTATION_POLICIES, userState);

  if (triggered.length === 0) {
    return {
      uiMode: "normal",
      parameters: {},
      activeRules: [],
      rationale: "No adaptation rules matched; using default UI.",
    };
  }

  const primary = triggered[0];

  return {
    uiMode: primary.action?.parameters?.mode ?? "normal",
    parameters: mergeParameters(triggered),
    activeRules: triggered.map((entry) => entry.ruleId),
    rationale: `Rule "${primary.ruleId}" activated (${primary.matchedGroups.length} trigger group(s) matched).`,
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
  const { triggered } = evaluatePolicies(ADAPTATION_POLICIES, userState);

  for (const entry of triggered) {
    if (entry.action?.parameters?.adaptationType === adaptationType) {
      return {
        recommended: true,
        priority: entry.priority >= 90 ? "critical" : entry.priority >= 70 ? "high" : "normal",
      };
    }
  }

  return { recommended: false, priority: "none" };
}
