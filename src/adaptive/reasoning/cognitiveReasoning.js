/**
 * cognitiveReasoning.js — Cognitive Reasoning Core
 *
 * Interprets the current `UserState` and determines what situation the user
 * is likely experiencing, what their primary need is, and what general
 * adaptation strategy should be considered.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     ARCHITECTURE POSITION                       │
 * │                                                                 │
 * │  UserState (from User State Model)                              │
 * │        │                                                        │
 * │        ▼                                                        │
 * │  ┌────────────────────────────┐                                 │
 * │  │  Cognitive Reasoning Core  │  ← THIS MODULE                 │
 * │  │  (this module)             │                                 │
 * │  │  • Situation detection     │                                 │
 * │  │  • Primary need id         │                                 │
 * │  │  • Strategy selection      │                                 │
 * │  │  • Priority resolution     │                                 │
 * │  │  • Confidence + reasoning  │                                 │
 * │  └────────────────────────────┘                                 │
 * │        │                                                        │
 * │        ▼                                                        │
 * │  ReasoningResult                                                │
 * │        │                                                        │
 * │        ▼                                                        │
 * │  Planner (future) → Intervention Ranking (future)               │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * DESIGN PRINCIPLES:
 *  1. Interpret only — this module answers "What is happening?" It does
 *     NOT generate intervention plans or rank interventions. Those belong
 *     to the Planner and Intervention Ranking components.
 *  2. Deterministic — the same UserState always yields the same result.
 *  3. Explainable — every conclusion carries per-factor reasoning.
 *  4. Confidence-aware — uncertainty in the underlying state is propagated.
 *  5. Graceful — missing/unknown state produces `insufficient_information`,
 *     never a fabricated situation.
 *  6. Serializable — the output is a plain object, safe for JSON transport.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { normalizeConfidence, isNonNullObject } from "../context/contextSnapshot.js";

// ─────────────────────────────────────────────────────────────────
//  ReasoningResult schema
// ─────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ReasoningFactor
 * @property {string} factor - The state dimension that informed the decision
 * @property {*} value - The dimension value
 * @property {"strong" | "moderate" | "weak" | "supporting" | "conflicting"} contribution -
 *   How strongly this factor influenced the conclusion
 */

/**
 * @typedef {object} ReasoningResult
 *
 * @description
 * The output of the Cognitive Reasoning Core. Describes the situation the
 * user is likely experiencing, the primary need implied, and the general
 * strategy to consider. It is intentionally free of concrete interventions —
 * the Planner consumes this and decides what to actually do.
 *
 * @property {string} situation - Detected situation id (see SITUATIONS)
 * @property {string} description - Human-readable description of the situation
 * @property {string} primaryNeed - The single most important need
 * @property {string[]} secondaryNeeds - Additional needs, in priority order
 * @property {string} strategy - High-level adaptation strategy
 * @property {ReasoningFactor[]} reasoning - Per-factor explanation of the decision
 * @property {string[]} summary - Human-readable summary lines
 * @property {number} confidence - Confidence in the result (0-1)
 * @property {string} timestamp - ISO timestamp of the reasoning computation
 * @property {string[]} sources - Input signals that informed the result
 */

/**
 * @typedef {"urgent_overload" | "emotional_distress" | "cognitive_overload" |
 *           "attention_fragmentation" | "low_energy" | "stable" |
 *           "insufficient_information"} SituationId
 */

// ─────────────────────────────────────────────────────────────────
//  Allowed value sets (exported for validation and documentation)
// ─────────────────────────────────────────────────────────────────

export const SITUATIONS = {
  urgent_overload: "urgent_overload",
  emotional_distress: "emotional_distress",
  cognitive_overload: "cognitive_overload",
  attention_fragmentation: "attention_fragmentation",
  low_energy: "low_energy",
  stable: "stable",
  insufficient_information: "insufficient_information",
};

export const PRIMARY_NEEDS = {
  immediate_task_simplification: "immediate_task_simplification",
  emotional_regulation: "emotional_regulation",
  task_simplification: "task_simplification",
  attention_support: "attention_support",
  low_effort_support: "low_effort_support",
  maintain_current_state: "maintain_current_state",
  gather_information: "gather_information",
};

export const STRATEGIES = {
  prioritize_and_reduce_complexity: "prioritize_and_reduce_complexity",
  reduce_stress_and_stabilize: "reduce_stress_and_stabilize",
  reduce_cognitive_complexity: "reduce_cognitive_complexity",
  reduce_distractions_and_focus: "reduce_distractions_and_focus",
  reduce_task_demand: "reduce_task_demand",
  normal_support: "normal_support",
  wait_and_observe: "wait_and_observe",
};

// ─────────────────────────────────────────────────────────────────
//  State dimensions used by the reasoning rules
// ─────────────────────────────────────────────────────────────────

const STATE_DIMENSIONS = [
  "emotionalState",
  "cognitiveLoad",
  "energyLevel",
  "attentionState",
  "stressLevel",
  "motivationLevel",
  "urgency",
  "taskComplexity",
  "engagementLevel",
];

const UNKNOWN = "unknown";

// ─────────────────────────────────────────────────────────────────
//  Situation registry
//
//  Each situation declares:
//    priority   — used to resolve competing conditions (higher wins)
//    conditions — ALL must be met for the situation to match
//    primaryNeed / strategy / description
//
//  PRIORITY HIERARCHY (documented, deterministic):
//    1. urgent_overload       — critical/high urgency + high load
//    2. emotional_distress    — high/acute stress + distress emotion
//    3. cognitive_overload    — high/overwhelming cognitive load
//    4. attention_fragmentation — fragmented/scattered/absent attention
//    5. low_energy            — tired/exhausted energy + low motivation
//    6. stable / insufficient_information — fallbacks, never outrank a real problem
//
//  Rationale: urgency demands immediate attention and shapes future planning;
//  acute emotional distress is a safety-relevant state; cognitive overload
//  degrades performance; attention fragmentation blocks progress; low energy
//  limits capacity. Stable and insufficient_information are never chosen when
//  a genuine difficulty is present.
// ─────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SituationDefinition
 * @property {SituationId} id - Unique situation id
 * @property {number} priority - Priority weight (higher = resolved first)
 * @property {Array<{ dimension: string, values: string[] }>} conditions -
 *   Conditions that must all match
 * @property {string} primaryNeed - Primary need implied by this situation
 * @property {string} strategy - High-level adaptation strategy
 * @property {string} description - Human-readable description
 */

/** @type {Record<string, SituationDefinition>} */
export const SITUATION_REGISTRY = {
  urgent_overload: {
    id: SITUATIONS.urgent_overload,
    priority: 100,
    conditions: [
      { dimension: "urgency", values: ["high", "critical"] },
      { dimension: "cognitiveLoad", values: ["high", "overwhelming"] },
    ],
    primaryNeed: PRIMARY_NEEDS.immediate_task_simplification,
    strategy: STRATEGIES.prioritize_and_reduce_complexity,
    description:
      "The user faces an urgent task while already cognitively overloaded. Urgency affects future planning, so this is treated distinctly from ordinary overload.",
  },
  emotional_distress: {
    id: SITUATIONS.emotional_distress,
    priority: 90,
    conditions: [
      { dimension: "stressLevel", values: ["high", "acute"] },
      { dimension: "emotionalState", values: ["anxious", "overwhelmed", "panicked"] },
    ],
    primaryNeed: PRIMARY_NEEDS.emotional_regulation,
    strategy: STRATEGIES.reduce_stress_and_stabilize,
    description: "The user is experiencing significant emotional distress.",
  },
  cognitive_overload: {
    id: SITUATIONS.cognitive_overload,
    priority: 80,
    conditions: [
      { dimension: "cognitiveLoad", values: ["high", "overwhelming"] },
    ],
    primaryNeed: PRIMARY_NEEDS.task_simplification,
    strategy: STRATEGIES.reduce_cognitive_complexity,
    description: "The user is cognitively overloaded and needs reduced complexity.",
  },
  attention_fragmentation: {
    id: SITUATIONS.attention_fragmentation,
    priority: 70,
    conditions: [
      { dimension: "attentionState", values: ["fragmented", "scattered", "absent"] },
    ],
    primaryNeed: PRIMARY_NEEDS.attention_support,
    strategy: STRATEGIES.reduce_distractions_and_focus,
    description: "The user's attention is fragmented, scattered, or absent.",
  },
  low_energy: {
    id: SITUATIONS.low_energy,
    priority: 60,
    conditions: [
      { dimension: "energyLevel", values: ["tired", "exhausted"] },
      { dimension: "motivationLevel", values: ["low"] },
    ],
    primaryNeed: PRIMARY_NEEDS.low_effort_support,
    strategy: STRATEGIES.reduce_task_demand,
    description: "The user has low energy and low motivation.",
  },
  stable: {
    id: SITUATIONS.stable,
    priority: 0,
    conditions: [],
    primaryNeed: PRIMARY_NEEDS.maintain_current_state,
    strategy: STRATEGIES.normal_support,
    description: "The user shows no significant difficulty.",
  },
  insufficient_information: {
    id: SITUATIONS.insufficient_information,
    priority: 0,
    conditions: [],
    primaryNeed: PRIMARY_NEEDS.gather_information,
    strategy: STRATEGIES.wait_and_observe,
    description:
      "Not enough of the user's state is known to draw a confident conclusion.",
  },
};

// ─────────────────────────────────────────────────────────────────
//  Per-dimension contribution scores (severity of a value)
//
//  Used to compute signal strength and per-factor contribution labels.
//  Values are deterministic constants, documented below.
// ─────────────────────────────────────────────────────────────────

const CONTRIBUTION_BY_VALUE = {
  cognitiveLoad: { overwhelming: 1.0, high: 0.8, medium: 0.5, low: 0.2 },
  urgency: { critical: 1.0, high: 0.8, moderate: 0.5, low: 0.2 },
  stressLevel: { acute: 1.0, high: 0.8, moderate: 0.55, mild: 0.3, none: 0.1 },
  attentionState: { absent: 1.0, fragmented: 0.85, scattered: 0.65, focused: 0.15 },
  energyLevel: { exhausted: 0.9, tired: 0.7, normal: 0.3, rested: 0.2 },
  motivationLevel: { low: 0.75, moderate: 0.4, high: 0.2 },
  emotionalState: {
    panicked: 1.0, overwhelmed: 0.9, anxious: 0.8, sad: 0.6,
    frustrated: 0.55, irritable: 0.5, neutral: 0.2, content: 0.2, calm: 0.15,
  },
  taskComplexity: { complex: 0.7, moderate: 0.4, simple: 0.15 },
  engagementLevel: { disengaged: 0.85, low: 0.7, normal: 0.35, high: 0.2 },
};

// ─────────────────────────────────────────────────────────────────
//  Conflicting-signal registry
//
//  When a KNOWN dimension value opposes the detected situation, it is
//  recorded as a conflicting factor and modestly lowers confidence.
//  This keeps the system honest when signals disagree.
// ─────────────────────────────────────────────────────────────────

const SITUATION_CONFLICTS = {
  urgent_overload: [{ dimension: "attentionState", values: ["focused"] }],
  cognitive_overload: [
    { dimension: "attentionState", values: ["focused"] },
    { dimension: "emotionalState", values: ["calm", "content"] },
    { dimension: "stressLevel", values: ["none"] },
  ],
  emotional_distress: [
    { dimension: "stressLevel", values: ["none", "mild"] },
    { dimension: "emotionalState", values: ["calm", "content", "neutral"] },
  ],
  attention_fragmentation: [{ dimension: "cognitiveLoad", values: ["low"] }],
  low_energy: [{ dimension: "energyLevel", values: ["rested"] }],
};

// ─────────────────────────────────────────────────────────────────
//  Need families
//
//  Related needs collapse into one so that subsumed situations (e.g.
//  cognitive_overload under urgent_overload) do not produce redundant
//  secondary needs.
// ─────────────────────────────────────────────────────────────────

const NEED_FAMILIES = {
  immediate_task_simplification: ["immediate_task_simplification", "task_simplification"],
  task_simplification: ["immediate_task_simplification", "task_simplification"],
  emotional_regulation: ["emotional_regulation"],
  low_effort_support: ["low_effort_support"],
  attention_support: ["attention_support"],
  maintain_current_state: ["maintain_current_state"],
  gather_information: ["gather_information"],
};

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────

function round2(value) {
  return Math.round(value * 100) / 100;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function contributionLabel(score) {
  if (score >= 0.8) return "strong";
  if (score >= 0.5) return "moderate";
  return "weak";
}

function humanize(dimension) {
  const map = {
    emotionalState: "Emotional state",
    cognitiveLoad: "Cognitive load",
    energyLevel: "Energy level",
    attentionState: "Attention state",
    stressLevel: "Stress level",
    motivationLevel: "Motivation level",
    urgency: "Task urgency",
    taskComplexity: "Task complexity",
    engagementLevel: "Engagement level",
  };
  return map[dimension] || dimension;
}

function dimensionValue(state, dimension) {
  const value = state?.[dimension];
  return value === null || value === undefined ? UNKNOWN : value;
}

/**
 * Count how many of the state dimensions carry a known (non-"unknown") value.
 * @param {object} state
 * @returns {number}
 */
function knownDimensionCount(state) {
  return STATE_DIMENSIONS.filter((d) => dimensionValue(state, d) !== UNKNOWN).length;
}

/**
 * Coverage = fraction of state dimensions that are known (0-1).
 * Low coverage means the underlying UserState is uncertain.
 * @param {object} state
 * @returns {number}
 */
function dimensionCoverage(state) {
  return STATE_DIMENSIONS.length > 0
    ? knownDimensionCount(state) / STATE_DIMENSIONS.length
    : 0;
}

/**
 * Average contribution score for a situation's matched conditions.
 * @param {object} state
 * @param {SituationDefinition} situation
 * @returns {number}
 */
function computeSignalStrength(state, situation) {
  if (!situation.conditions.length) return 0.5;
  const scores = situation.conditions.map(({ dimension, values }) => {
    const value = dimensionValue(state, dimension);
    return CONTRIBUTION_BY_VALUE[dimension]?.[value] ?? 0.5;
  });
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * Find known values that conflict with the detected situation.
 * @param {object} state
 * @param {SituationId} situationId
 * @returns {ReasoningFactor[]}
 */
function findConflicts(state, situationId) {
  const defs = SITUATION_CONFLICTS[situationId] || [];
  return defs
    .filter(({ dimension, values }) => {
      const value = dimensionValue(state, dimension);
      return value !== UNKNOWN && values.includes(value);
    })
    .map(({ dimension, values }) => ({
      factor: dimension,
      value: dimensionValue(state, dimension),
      contribution: "conflicting",
    }));
}

/**
 * Build per-factor reasoning for the primary situation.
 * @param {object} state
 * @param {SituationDefinition} situation
 * @param {ReasoningFactor[]} conflicts
 * @returns {ReasoningFactor[]}
 */
function buildReasoningFactors(state, situation, conflicts) {
  const factors = situation.conditions.map(({ dimension }) => {
    const value = dimensionValue(state, dimension);
    const score = CONTRIBUTION_BY_VALUE[dimension]?.[value] ?? 0.5;
    return { factor: dimension, value, contribution: contributionLabel(score) };
  });

  // For "stable", surface the benign dimensions that support the conclusion.
  if (situation.id === SITUATIONS.stable) {
    const benign = STATE_DIMENSIONS.filter((d) => {
      const value = dimensionValue(state, d);
      const score = CONTRIBUTION_BY_VALUE[d]?.[value];
      return value !== UNKNOWN && score !== undefined && score < 0.5;
    });
    for (const d of benign) {
      factors.push({ factor: d, value: dimensionValue(state, d), contribution: "supporting" });
    }
  }

  return [...factors, ...conflicts];
}

/**
 * Build human-readable summary lines for the primary situation.
 * @param {object} state
 * @param {SituationDefinition} situation
 * @returns {string[]}
 */
function buildSummary(state, situation) {
  if (situation.id === SITUATIONS.stable) {
    return ["No significant difficulties detected; state appears stable."];
  }
  if (situation.id === SITUATIONS.insufficient_information) {
    return ["Too few known state dimensions to identify a situation confidently."];
  }
  return situation.conditions.map(({ dimension }) => {
    const value = dimensionValue(state, dimension);
    const score = CONTRIBUTION_BY_VALUE[dimension]?.[value] ?? 0.5;
    return `${humanize(dimension)} is "${value}" (${contributionLabel(score)} signal)`;
  });
}

/**
 * Compute confidence for the detected situation.
 *
 * Confidence blends:
 *   - the underlying UserState's overallConfidence (state quality)
 *   - the signal strength of the matched conditions (evidence strength)
 *   - the dimension coverage (how much of the state is known)
 *   - a small penalty per conflicting signal (signal disagreement)
 *
 * @param {object} state
 * @param {SituationId} situationId
 * @param {number} signalStrength
 * @param {number} coverage
 * @param {number} conflictCount
 * @returns {number}
 */
function computeConfidence(state, situationId, signalStrength, coverage, conflictCount) {
  const overall = normalizeConfidence(state?.overallConfidence ?? state?.confidence);

  if (situationId === SITUATIONS.stable) {
    // Stability requires a fairly complete picture to assert confidently.
    return round2(clamp01(0.3 * overall + 0.7 * coverage));
  }

  if (situationId === SITUATIONS.insufficient_information) {
    // Always low: we are admitting we do not know enough.
    return round2(clamp01(0.15 + 0.25 * coverage));
  }

  const base = 0.4 * overall + 0.4 * signalStrength + 0.2 * coverage;
  return round2(clamp01(base - 0.06 * conflictCount));
}

/**
 * Detect all situations that match the current state, sorted by priority.
 * @param {object} state
 * @returns {Array<{ id: SituationId, def: SituationDefinition }>}
 */
function detectSituations(state) {
  return Object.values(SITUATION_REGISTRY)
    // Fallback situations (stable, insufficient_information) are resolved
    // explicitly in reasonAboutUserState, never auto-detected. Requiring at
    // least one condition excludes them here.
    .filter((def) => def.conditions.length > 0)
    .filter((def) =>
      def.conditions.every(({ dimension, values }) =>
        values.includes(dimensionValue(state, dimension)),
      ),
    )
    .sort((a, b) => b.priority - a.priority)
    .map((def) => ({ id: def.id, def }));
}

/**
 * Resolve secondary needs from all matched situations, excluding needs that
 * belong to the primary situation's need family (to avoid redundancy).
 *
 * @param {SituationId} primaryId
 * @param {Array<{ id: SituationId, def: SituationDefinition }>} matched
 * @returns {string[]}
 */
function buildSecondaryNeeds(primaryId, matched) {
  const primaryDef = SITUATION_REGISTRY[primaryId];
  const family = NEED_FAMILIES[primaryDef.primaryNeed] || [primaryDef.primaryNeed];
  const seen = new Set(family);
  const secondary = [];

  for (const { id, def } of matched) {
    if (id === primaryId) continue;
    if (seen.has(def.primaryNeed)) continue;
    seen.add(def.primaryNeed);
    secondary.push(def.primaryNeed);
  }

  return secondary;
}

// ─────────────────────────────────────────────────────────────────
//  Main entry point
// ─────────────────────────────────────────────────────────────────

/**
 * Reason about the current user state.
 *
 * This is the primary API of the Cognitive Reasoning Core. It consumes a
 * UserState produced by the User State Model and returns a ReasoningResult
 * describing the situation, primary need, strategy, confidence, and the
 * reasoning behind the conclusion.
 *
 * The output is intentionally free of concrete interventions. Feed it to
 * the future Planner:
 *
 *   const userState = buildUserState(contextSnapshot);
 *   const reasoningResult = reasonAboutUserState(userState);
 *   const plan = generatePlan(reasoningResult); // Future component
 *
 * @param {import("../state/userStateModel.js").UserState} [userState] - The current user state
 * @returns {ReasoningResult}
 *
 * @example
 * // Cognitive overload
 * const result = reasonAboutUserState(buildUserState({
 *   activity: { taskSwitching: "high" },
 *   task: { complexity: "complex" },
 * }));
 * // result.situation === "cognitive_overload"
 * // result.primaryNeed === "task_simplification"
 *
 * @example
 * // Empty state — no invented situation
 * const result = reasonAboutUserState(buildUserState());
 * // result.situation === "insufficient_information"
 * // result.confidence < 0.4
 */
export function reasonAboutUserState(userState = null) {
  const state = isNonNullObject(userState) ? userState : {};

  const coverage = dimensionCoverage(state);
  const matched = detectSituations(state);

  let situation;
  let primaryDef;
  let signalStrength;
  let conflicts;

  if (matched.length > 0) {
    situation = matched[0].id;
    primaryDef = matched[0].def;
    signalStrength = computeSignalStrength(state, primaryDef);
    conflicts = findConflicts(state, situation);
  } else if (knownDimensionCount(state) < 3) {
    situation = SITUATIONS.insufficient_information;
    primaryDef = SITUATION_REGISTRY[situation];
    signalStrength = 0;
    conflicts = [];
  } else {
    situation = SITUATIONS.stable;
    primaryDef = SITUATION_REGISTRY[situation];
    signalStrength = computeSignalStrength(state, primaryDef);
    conflicts = [];
  }

  const secondaryNeeds =
    situation === SITUATIONS.stable || situation === SITUATIONS.insufficient_information
      ? []
      : buildSecondaryNeeds(situation, matched);

  const confidence = computeConfidence(
    state,
    situation,
    signalStrength,
    coverage,
    conflicts.length,
  );

  return {
    situation,
    description: primaryDef.description,
    primaryNeed: primaryDef.primaryNeed,
    secondaryNeeds,
    strategy: primaryDef.strategy,
    reasoning: buildReasoningFactors(state, primaryDef, conflicts),
    summary: buildSummary(state, primaryDef),
    confidence,
    timestamp: state.timestamp || new Date().toISOString(),
    sources: state.sources || [],
  };
}
