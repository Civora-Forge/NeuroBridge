/**
 * userStateModel.js — Unified User State Model
 *
 * Transforms a ContextSnapshot into a structured, confidence-aware,
 * explainable representation of the user's current state.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     ARCHITECTURE POSITION                       │
 * │                                                                 │
 * │  ContextSnapshot (input)                                        │
 * │        │                                                        │
 * │        ▼                                                        │
 * │  ┌──────────────────────┐                                       │
 * │  │   UserStateModel     │  ← THIS MODULE                       │
 * │  │                      │                                       │
 * │  │  • Infers state      │                                       │
 * │  │  • Propagates        │                                       │
 * │  │    confidence        │                                       │
 * │  │  • Handles missing   │                                       │
 * │  │    data              │                                       │
 * │  │  • Explains reasoning│                                       │
 * │  └──────────────────────┘                                       │
 * │        │                                                        │
 * │        ▼                                                        │
 * │  UserState (output)                                             │
 * │        │                                                        │
 * │        ▼                                                        │
 * │  Cognitive Reasoning Core                                       │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * DESIGN PRINCIPLES:
 *  1. Deterministic — same input always produces the same output
 *  2. Explainable — every inferred dimension carries reasons
 *  3. Confidence-aware — uncertainty is propagated, not hidden
 *  4. Graceful — missing data produces "unknown", never fabricated values
 *  5. Serializable — output is a plain object, safe for JSON transport
 *  6. Single responsibility — only transforms context to state
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import {
  normalizeConfidence,
  isNonNullObject,
  safeGet,
} from "../context/contextSnapshot.js";

// ─────────────────────────────────────────────────────────────────
//  UserState schema
//
//  Each dimension has a controlled vocabulary. "unknown" is always
//  a valid value, representing insufficient data to infer otherwise.
// ─────────────────────────────────────────────────────────────────

/**
 * @typedef {"calm" | "content" | "neutral" | "anxious" | "overwhelmed" |
 *           "frustrated" | "sad" | "panicked" | "irritable" | "unknown"} EmotionalState
 */

/**
 * @typedef {"low" | "medium" | "high" | "overwhelming" | "unknown"} CognitiveLoad
 */

/**
 * @typedef {"rested" | "normal" | "tired" | "exhausted" | "unknown"} EnergyLevel
 */

/**
 * @typedef {"focused" | "scattered" | "fragmented" | "absent" | "unknown"} AttentionState
 */

/**
 * @typedef {"none" | "mild" | "moderate" | "high" | "acute" | "unknown"} StressLevel
 */

/**
 * @typedef {"high" | "moderate" | "low" | "unknown"} MotivationLevel
 */

/**
 * @typedef {"low" | "moderate" | "high" | "critical" | "unknown"} Urgency
 */

/**
 * @typedef {"simple" | "moderate" | "complex" | "unknown"} TaskComplexity
 */

/**
 * @typedef {"high" | "normal" | "low" | "disengaged" | "unknown"} EngagementLevel
 */

/**
 * @typedef {object} DimensionResult
 * @property {*} value - The inferred value for this dimension
 * @property {number} confidence - Confidence in this inference (0-1)
 * @property {string[]} reasons - Human-readable reasons for this inference
 * @property {string[]} sources - Which input signals contributed
 */

/**
 * @typedef {object} UserState
 *
 * @description
 * A structured representation of the user's current state, derived from
 * a ContextSnapshot. Every dimension is a DimensionResult containing
 * the inferred value, confidence, reasoning, and signal sources.
 *
 * For backward compatibility with downstream consumers, the raw values
 * are also exposed as top-level properties (e.g., userState.cognitiveLoad
 * returns the string value directly via a getter).
 *
 * @property {DimensionResult} emotionalState - Current emotional state
 * @property {DimensionResult} cognitiveLoad - Current cognitive load
 * @property {DimensionResult} energyLevel - Current energy level
 * @property {DimensionResult} attentionState - Current attention state
 * @property {DimensionResult} stressLevel - Current stress level
 * @property {DimensionResult} motivationLevel - Current motivation level
 * @property {DimensionResult} urgency - Task urgency
 * @property {DimensionResult} taskComplexity - Task complexity
 * @property {DimensionResult} engagementLevel - Engagement level
 * @property {number} overallConfidence - Aggregate confidence across all dimensions (0-1)
 * @property {string} timestamp - ISO timestamp of state computation
 * @property {string[]} sources - All input signals that contributed to this state
 */

// ─────────────────────────────────────────────────────────────────
//  Allowed value sets (for validation and documentation)
// ─────────────────────────────────────────────────────────────────

export const EMOTIONAL_STATES = [
  "calm", "content", "neutral", "anxious", "overwhelmed",
  "frustrated", "sad", "panicked", "irritable", "unknown",
];

export const COGNITIVE_LOADS = ["low", "medium", "high", "overwhelming", "unknown"];
export const ENERGY_LEVELS = ["rested", "normal", "tired", "exhausted", "unknown"];
export const ATTENTION_STATES = ["focused", "scattered", "fragmented", "absent", "unknown"];
export const STRESS_LEVELS = ["none", "mild", "moderate", "high", "acute", "unknown"];
export const MOTIVATION_LEVELS = ["high", "moderate", "low", "unknown"];
export const URGENCY_LEVELS = ["low", "moderate", "high", "critical", "unknown"];
export const TASK_COMPLEXITIES = ["simple", "moderate", "complex", "unknown"];
export const ENGAGEMENT_LEVELS = ["high", "normal", "low", "disengaged", "unknown"];

// ─────────────────────────────────────────────────────────────────
//  Emotion → stress mapping (deterministic)
// ─────────────────────────────────────────────────────────────────

const EMOTION_TO_STRESS = {
  panicked:   "acute",
  overwhelmed: "high",
  anxious:    "high",
  frustrated: "moderate",
  irritable:  "moderate",
  sad:        "mild",
  neutral:    "none",
  content:    "none",
  calm:       "none",
};

const HIGH_STRESS_EMOTIONS = new Set(["panicked", "overwhelmed", "anxious"]);
const ENERGY_DRAINING_EMOTIONS = new Set(["overwhelmed", "anxious", "panicked", "frustrated", "sad"]);

// ─────────────────────────────────────────────────────────────────
//  Helper: create a DimensionResult
// ─────────────────────────────────────────────────────────────────

/**
 * Create a DimensionResult with value, confidence, reasons, and sources.
 *
 * @param {*} value - The inferred value
 * @param {number} confidence - Confidence (0-1)
 * @param {string[]} reasons - Why this value was inferred
 * @param {string[]} sources - Which signals contributed
 * @returns {DimensionResult}
 */
function dim(value, confidence, reasons = [], sources = []) {
  return {
    value,
    confidence: normalizeConfidence(confidence),
    reasons: [...reasons],
    sources: [...sources],
  };
}

/**
 * Create an "unknown" dimension when no data is available.
 *
 * @param {string} reason - Why it's unknown
 * @returns {DimensionResult}
 */
function unknown(reason = "No input signals available") {
  return dim("unknown", 0, [reason], []);
}

// ─────────────────────────────────────────────────────────────────
//  Dimension inference functions
//
//  Each function takes the relevant signals from a ContextSnapshot
//  and returns a DimensionResult.
// ─────────────────────────────────────────────────────────────────

/**
 * Infer emotional state from emotion signals.
 *
 * @param {import("../context/contextSnapshot.js").ContextSnapshot} snapshot
 * @returns {DimensionResult}
 */
function inferEmotionalState(snapshot) {
  const emotion = snapshot?.emotion;

  if (!isNonNullObject(emotion) || !emotion.label) {
    return unknown("No emotion signal provided");
  }

  const label = String(emotion.label).toLowerCase().trim();
  const confidence = normalizeConfidence(emotion.confidence);

  // If confidence is very low, we still report the label but reduce confidence
  // We do NOT discard the signal — the downstream layer decides what to do with it
  const reasons = [`Emotion "${label}" inferred from ${emotion.source || "context"}`];
  const sources = ["emotion"];

  if (confidence < 0.3) {
    reasons.push("Low confidence in emotion detection — state may be inaccurate");
  }

  return dim(label, confidence, reasons, sources);
}

/**
 * Infer cognitive load from task switching, task complexity, and emotion.
 *
 * Rules (applied in order, first match wins for value):
 *   - overwhelming emotion → "overwhelming"
 *   - high task switching + high complexity → "high"
 *   - high task switching OR high complexity → "medium"
 *   - low task switching + low complexity → "low"
 *   - else → "unknown"
 *
 * @param {import("../context/contextSnapshot.js").ContextSnapshot} snapshot
 * @returns {DimensionResult}
 */
function inferCognitiveLoad(snapshot) {
  const activity = snapshot?.activity || {};
  const task = snapshot?.task || {};
  const emotion = snapshot?.emotion || {};

  const reasons = [];
  const sources = [];
  let confidence = 0;

  // Signal: emotion
  const emotionLabel = String(emotion.label || "").toLowerCase();
  const emotionConfidence = normalizeConfidence(emotion.confidence);
  if (emotionLabel) {
    sources.push("emotion");
    confidence = Math.max(confidence, emotionConfidence);
  }

  // Signal: task switching
  const taskSwitching = activity.taskSwitching;
  if (taskSwitching) {
    sources.push("activity.taskSwitching");
    confidence = Math.max(confidence, 0.7);
  }

  // Signal: task complexity
  const complexity = task.complexity;
  if (complexity) {
    sources.push("task.complexity");
    confidence = Math.max(confidence, 0.7);
  }

  if (sources.length === 0) {
    return unknown("No signals available for cognitive load inference");
  }

  // Inference rules
  if (emotionLabel === "overwhelmed" || emotionLabel === "panicked") {
    reasons.push(`Emotion is "${emotionLabel}" — indicates overwhelming cognitive load`);
    return dim("overwhelming", confidence * emotionConfidence, reasons, sources);
  }

  const highSwitching = taskSwitching === "high";
  const highComplexity = complexity === "complex";
  const mediumSwitching = taskSwitching === "medium";
  const mediumComplexity = complexity === "moderate";

  if (highSwitching && highComplexity) {
    reasons.push("High task switching combined with high task complexity");
    return dim("high", confidence, reasons, sources);
  }

  if (highSwitching) {
    reasons.push("High task switching frequency");
    return dim("high", confidence * 0.8, reasons, sources);
  }

  if (highComplexity) {
    reasons.push("High task complexity");
    return dim("high", confidence * 0.8, reasons, sources);
  }

  if (mediumSwitching || mediumComplexity) {
    reasons.push("Moderate task switching or complexity signals");
    return dim("medium", confidence * 0.7, reasons, sources);
  }

  if (taskSwitching === "low" && (!complexity || complexity === "simple")) {
    reasons.push("Low task switching and low/simple complexity");
    return dim("low", confidence * 0.6, reasons, sources);
  }

  // Fallback — we have some signals but can't determine load
  return dim("unknown", confidence * 0.3, ["Insufficient signals to determine cognitive load"], sources);
}

/**
 * Infer energy level from emotion, session duration, and time of day.
 *
 * @param {import("../context/contextSnapshot.js").ContextSnapshot} snapshot
 * @returns {DimensionResult}
 */
function inferEnergyLevel(snapshot) {
  const emotion = snapshot?.emotion || {};
  const activity = snapshot?.activity || {};
  const environment = snapshot?.environment || {};

  const reasons = [];
  const sources = [];
  let confidence = 0;

  // Signal: emotion
  const emotionLabel = String(emotion.label || "").toLowerCase();
  const emotionConfidence = normalizeConfidence(emotion.confidence);
  if (emotionLabel) {
    sources.push("emotion");
    confidence = Math.max(confidence, emotionConfidence);
  }

  // Signal: session duration
  const sessionMs = activity.sessionDurationMs;
  if (typeof sessionMs === "number" && sessionMs >= 0) {
    sources.push("activity.sessionDurationMs");
    confidence = Math.max(confidence, 0.6);
  }

  // Signal: time of day
  const timeOfDay = environment.timeOfDay;
  if (timeOfDay && timeOfDay !== "unknown") {
    sources.push("environment.timeOfDay");
    confidence = Math.max(confidence, 0.4);
  }

  if (sources.length === 0) {
    return unknown("No signals available for energy level inference");
  }

  // Exhausting emotions drain energy
  if (ENERGY_DRAINING_EMOTIONS.has(emotionLabel)) {
    reasons.push(`Emotion "${emotionLabel}" is associated with reduced energy`);
    const energyConfidence = confidence * emotionConfidence;
    if (emotionLabel === "overwhelmed" || emotionLabel === "panicked") {
      return dim("exhausted", energyConfidence, reasons, sources);
    }
    return dim("tired", energyConfidence, reasons, sources);
  }

  // Positive emotions suggest higher energy
  if (emotionLabel === "calm" || emotionLabel === "content") {
    reasons.push(`Emotion "${emotionLabel}" is associated with normal or higher energy`);
    return dim("normal", confidence * emotionConfidence, reasons, sources);
  }

  // Long sessions drain energy
  if (typeof sessionMs === "number") {
    const sessionMinutes = sessionMs / 60000;
    if (sessionMinutes > 120) {
      reasons.push(`Very long session (${Math.round(sessionMinutes)} minutes) suggests exhausted energy`);
      return dim("exhausted", confidence * 0.7, reasons, sources);
    }
    if (sessionMinutes > 60) {
      reasons.push(`Long session (${Math.round(sessionMinutes)} minutes) suggests reduced energy`);
      return dim("tired", confidence * 0.7, reasons, sources);
    }
  }

  // Late night reduces energy
  if (timeOfDay === "night") {
    reasons.push("Late night session suggests reduced energy");
    return dim("tired", confidence * 0.5, reasons, sources);
  }

  return dim("normal", confidence * 0.5, ["No strong energy signals — defaulting to normal"], sources);
}

/**
 * Infer attention state from task switching and engagement.
 *
 * @param {import("../context/contextSnapshot.js").ContextSnapshot} snapshot
 * @returns {DimensionResult}
 */
function inferAttentionState(snapshot) {
  const activity = snapshot?.activity || {};
  const task = snapshot?.task || {};

  const reasons = [];
  const sources = [];
  let confidence = 0;

  const taskSwitching = activity.taskSwitching;
  const engagement = activity.engagement;
  const hasCurrentTask = Boolean(task.currentTask || (snapshot?.activity || {}).currentTask);

  if (taskSwitching) {
    sources.push("activity.taskSwitching");
    confidence = Math.max(confidence, 0.7);
  }
  if (engagement) {
    sources.push("activity.engagement");
    confidence = Math.max(confidence, 0.6);
  }
  if (hasCurrentTask) {
    sources.push("activity.currentTask");
    confidence = Math.max(confidence, 0.5);
  }

  if (sources.length === 0) {
    return unknown("No signals available for attention state inference");
  }

  // High task switching = fragmented attention
  if (taskSwitching === "high") {
    reasons.push("High task switching indicates fragmented attention");
    return dim("fragmented", confidence, reasons, sources);
  }

  // Disengaged = absent attention
  if (engagement === "disengaged") {
    reasons.push("Disengagement indicates absent attention");
    return dim("absent", confidence * 0.8, reasons, sources);
  }

  // Low engagement + no current task = scattered
  if (engagement === "low" && !hasCurrentTask) {
    reasons.push("Low engagement with no active task indicates scattered attention");
    return dim("scattered", confidence * 0.7, reasons, sources);
  }

  // Medium task switching = scattered
  if (taskSwitching === "medium") {
    reasons.push("Medium task switching indicates scattered attention");
    return dim("scattered", confidence * 0.8, reasons, sources);
  }

  // Low task switching + has task + high/normal engagement = focused
  if (taskSwitching === "low" && hasCurrentTask && engagement !== "low") {
    reasons.push("Low task switching with active task and adequate engagement");
    return dim("focused", confidence, reasons, sources);
  }

  // Low task switching without clear signals
  if (taskSwitching === "low") {
    reasons.push("Low task switching suggests focused or calm attention");
    return dim("focused", confidence * 0.6, reasons, sources);
  }

  return dim("unknown", confidence * 0.3, ["Insufficient signals to determine attention state"], sources);
}

/**
 * Infer stress level from emotion and biometrics.
 *
 * @param {import("../context/contextSnapshot.js").ContextSnapshot} snapshot
 * @returns {DimensionResult}
 */
function inferStressLevel(snapshot) {
  const emotion = snapshot?.emotion || {};
  const biometrics = snapshot?.biometrics || {};

  const reasons = [];
  const sources = [];
  let confidence = 0;

  // Signal: emotion
  const emotionLabel = String(emotion.label || "").toLowerCase();
  const emotionConfidence = normalizeConfidence(emotion.confidence);
  const stressFromEmotion = EMOTION_TO_STRESS[emotionLabel];

  if (stressFromEmotion) {
    sources.push("emotion");
    confidence = Math.max(confidence, emotionConfidence);
  }

  // Signal: biometrics (HRV)
  const hrv = biometrics.heartRateVariabilityMs;
  if (typeof hrv === "number") {
    sources.push("biometrics.hrv");
    confidence = Math.max(confidence, 0.8);
  }

  // Signal: biometrics (EDA)
  const eda = biometrics.electrodermalActivityMuS;
  if (typeof eda === "number") {
    sources.push("biometrics.eda");
    confidence = Math.max(confidence, 0.8);
  }

  if (sources.length === 0) {
    return unknown("No signals available for stress level inference");
  }

  // Start with emotion-derived stress
  let stressValue = stressFromEmotion || "unknown";
  let stressConfidence = confidence * (stressFromEmotion ? emotionConfidence : 0.3);

  const reasons_local = [...reasons];

  if (stressFromEmotion) {
    reasons_local.push(`Emotion "${emotionLabel}" maps to "${stressFromEmotion}" stress`);
  }

  // Refine with biometrics if available
  if (typeof hrv === "number") {
    if (hrv < 30) {
      reasons_local.push(`Very low HRV (${hrv}ms) indicates acute stress`);
      stressValue = "acute";
      stressConfidence = Math.max(stressConfidence, 0.85);
    } else if (hrv < 45) {
      reasons_local.push(`Low HRV (${hrv}ms) indicates elevated stress`);
      if (stressValue !== "acute") stressValue = "high";
      stressConfidence = Math.max(stressConfidence, 0.75);
    } else if (hrv >= 60) {
      reasons_local.push(`Healthy HRV (${hrv}ms) suggests low stress`);
      stressValue = stressFromEmotion === "none" ? "none" : "mild";
      stressConfidence = Math.max(stressConfidence, 0.7);
    }
  }

  if (typeof eda === "number") {
    if (eda > 5) {
      reasons_local.push(`High EDA (${eda}μS) indicates high physiological arousal`);
      if (stressValue !== "acute") stressValue = "high";
      stressConfidence = Math.max(stressConfidence, 0.8);
    } else if (eda > 3) {
      reasons_local.push(`Moderate EDA (${eda}μS) indicates mild to moderate arousal`);
      if (stressValue === "unknown") stressValue = "mild";
      stressConfidence = Math.max(stressConfidence, 0.65);
    } else if (eda < 1) {
      reasons_local.push(`Low EDA (${eda}μS) suggests calm state`);
      if (!HIGH_STRESS_EMOTIONS.has(emotionLabel)) {
        stressValue = "none";
      }
      stressConfidence = Math.max(stressConfidence, 0.6);
    }
  }

  if (stressValue === "unknown") {
    return dim("unknown", stressConfidence * 0.3, ["Insufficient signals to determine stress level"], sources);
  }

  return dim(stressValue, stressConfidence, reasons_local, sources);
}

/**
 * Infer motivation level from task completion, abandonment, and engagement.
 *
 * @param {import("../context/contextSnapshot.js").ContextSnapshot} snapshot
 * @returns {DimensionResult}
 */
function inferMotivationLevel(snapshot) {
  const activity = snapshot?.activity || {};

  const reasons = [];
  const sources = [];
  let confidence = 0;

  const completed = activity.taskCompletionCount;
  const abandoned = activity.taskAbandonCount;
  const engagement = activity.engagement;

  if (typeof completed === "number") {
    sources.push("activity.taskCompletionCount");
    confidence = Math.max(confidence, 0.7);
  }
  if (typeof abandoned === "number") {
    sources.push("activity.taskAbandonCount");
    confidence = Math.max(confidence, 0.7);
  }
  if (engagement) {
    sources.push("activity.engagement");
    confidence = Math.max(confidence, 0.5);
  }

  if (sources.length === 0) {
    return unknown("No signals available for motivation level inference");
  }

  // Completion vs abandonment ratio
  if (typeof completed === "number" && typeof abandoned === "number") {
    const total = completed + abandoned;
    if (total > 0) {
      const completionRate = completed / total;
      if (completionRate >= 0.7) {
        reasons.push(`High completion rate (${Math.round(completionRate * 100)}%) indicates strong motivation`);
        return dim("high", confidence, reasons, sources);
      }
      if (completionRate >= 0.4) {
        reasons.push(`Moderate completion rate (${Math.round(completionRate * 100)}%) indicates moderate motivation`);
        return dim("moderate", confidence, reasons, sources);
      }
      reasons.push(`Low completion rate (${Math.round(completionRate * 100)}%) indicates low motivation`);
      return dim("low", confidence * 0.8, reasons, sources);
    }
  }

  // Fall back to engagement
  if (engagement === "high") {
    reasons.push("High engagement suggests high motivation");
    return dim("high", confidence * 0.7, reasons, sources);
  }
  if (engagement === "normal") {
    reasons.push("Normal engagement suggests moderate motivation");
    return dim("moderate", confidence * 0.6, reasons, sources);
  }
  if (engagement === "low" || engagement === "disengaged") {
    reasons.push(`"${engagement}" engagement suggests low motivation`);
    return dim("low", confidence * 0.6, reasons, sources);
  }

  return dim("unknown", confidence * 0.3, ["Insufficient signals to determine motivation"], sources);
}

/**
 * Infer urgency from task signals and user input.
 *
 * @param {import("../context/contextSnapshot.js").ContextSnapshot} snapshot
 * @returns {DimensionResult}
 */
function inferUrgency(snapshot) {
  const task = snapshot?.task || {};
  const userInput = snapshot?.userInput || {};

  const reasons = [];
  const sources = [];

  // Primary: task urgency
  if (task.urgency) {
    sources.push("task.urgency");
    reasons.push(`Task urgency reported as "${task.urgency}"`);
    const confidence = 0.8;
    return dim(task.urgency, confidence, reasons, sources);
  }

  // Secondary: user intent signals urgency
  const intent = userInput.intent || task.intent;
  if (intent) {
    sources.push(userInput.intent ? "userInput.intent" : "task.intent");
    // Certain intents imply higher urgency
    const highUrgencyIntents = ["get_help", "emergency", "crisis"];
    const moderateUrgencyIntents = ["complete_task", "need_support"];

    if (highUrgencyIntents.includes(intent)) {
      reasons.push(`User intent "${intent}" implies high urgency`);
      return dim("high", 0.7, reasons, sources);
    }
    if (moderateUrgencyIntents.includes(intent)) {
      reasons.push(`User intent "${intent}" implies moderate urgency`);
      return dim("moderate", 0.6, reasons, sources);
    }
    reasons.push(`User intent "${intent}" — urgency unclear, defaulting to low`);
    return dim("low", 0.4, reasons, sources);
  }

  return unknown("No urgency signals available");
}

/**
 * Infer task complexity from task signals.
 *
 * @param {import("../context/contextSnapshot.js").ContextSnapshot} snapshot
 * @returns {DimensionResult}
 */
function inferTaskComplexity(snapshot) {
  const task = snapshot?.task || {};

  if (task.complexity) {
    return dim(
      task.complexity,
      0.8,
      [`Task complexity reported as "${task.complexity}"`],
      ["task.complexity"],
    );
  }

  // Infer from activity signals
  const activity = snapshot?.activity || {};
  if (activity.taskSwitching === "high") {
    return dim(
      "complex",
      0.5,
      ["High task switching suggests complex task demands"],
      ["activity.taskSwitching"],
    );
  }

  return unknown("No task complexity signals available");
}

/**
 * Infer engagement level from activity signals.
 *
 * @param {import("../context/contextSnapshot.js").ContextSnapshot} snapshot
 * @returns {DimensionResult}
 */
function inferEngagementLevel(snapshot) {
  const activity = snapshot?.activity || {};

  if (activity.engagement) {
    return dim(
      activity.engagement,
      0.7,
      [`Engagement reported as "${activity.engagement}"`],
      ["activity.engagement"],
    );
  }

  // Infer from other activity signals
  const reasons = [];
  const sources = [];
  let confidence = 0;

  if (activity.taskSwitching) {
    sources.push("activity.taskSwitching");
    confidence = Math.max(confidence, 0.5);
  }
  if (typeof activity.sessionDurationMs === "number") {
    sources.push("activity.sessionDurationMs");
    confidence = Math.max(confidence, 0.4);
  }
  if (typeof activity.taskCompletionCount === "number") {
    sources.push("activity.taskCompletionCount");
    confidence = Math.max(confidence, 0.5);
  }

  if (sources.length === 0) {
    return unknown("No signals available for engagement inference");
  }

  // Long session + task switching = potentially disengaged
  if (activity.taskSwitching === "high" && typeof activity.sessionDurationMs === "number" && activity.sessionDurationMs > 3600000) {
    reasons.push("High task switching in long session suggests disengagement");
    return dim("disengaged", confidence * 0.7, reasons, sources);
  }

  // Task completions suggest engagement
  if (typeof activity.taskCompletionCount === "number" && activity.taskCompletionCount > 0) {
    reasons.push(`Task completions (${activity.taskCompletionCount}) suggest engagement`);
    return dim("normal", confidence * 0.6, reasons, sources);
  }

  // Low task switching suggests focus
  if (activity.taskSwitching === "low") {
    reasons.push("Low task switching suggests focused engagement");
    return dim("normal", confidence * 0.5, reasons, sources);
  }

  return dim("unknown", confidence * 0.3, ["Insufficient signals to determine engagement"], sources);
}

// ─────────────────────────────────────────────────────────────────
//  Main entry point
// ─────────────────────────────────────────────────────────────────

/**
 * Build a UserState from a ContextSnapshot.
 *
 * This is the primary API of the User State Model. It takes a
 * ContextSnapshot (produced by the Context Fusion layer) and
 * returns a structured UserState with inferred dimensions,
 * confidence scores, and explainability metadata.
 *
 * @param {import("../context/contextSnapshot.js").ContextSnapshot} [snapshot] - The context snapshot
 * @returns {UserState}
 *
 * @example
 * // Full context
 * const state = buildUserState({
 *   emotion: { label: "overwhelmed", confidence: 0.86 },
 *   activity: { taskSwitching: "high" },
 *   task: { urgency: "high", complexity: "complex" },
 * });
 * // state.cognitiveLoad.value === "overwhelming"
 * // state.stressLevel.value === "high"
 *
 * @example
 * // Empty context — all dimensions return "unknown"
 * const state = buildUserState();
 * // state.overallConfidence === 0
 */
export function buildUserState(snapshot = null) {
  const safe = snapshot || {};

  // Infer each dimension
  const emotionalState = inferEmotionalState(safe);
  const cognitiveLoad = inferCognitiveLoad(safe);
  const energyLevel = inferEnergyLevel(safe);
  const attentionState = inferAttentionState(safe);
  const stressLevel = inferStressLevel(safe);
  const motivationLevel = inferMotivationLevel(safe);
  const urgency = inferUrgency(safe);
  const taskComplexity = inferTaskComplexity(safe);
  const engagementLevel = inferEngagementLevel(safe);

  // Collect all dimensions for aggregate computation
  const dimensions = [
    emotionalState,
    cognitiveLoad,
    energyLevel,
    attentionState,
    stressLevel,
    motivationLevel,
    urgency,
    taskComplexity,
    engagementLevel,
  ];

  // Compute overall confidence as the mean of all dimension confidences
  const totalConfidence = dimensions.reduce((sum, d) => sum + d.confidence, 0);
  const overallConfidence = dimensions.length > 0
    ? Math.round((totalConfidence / dimensions.length) * 100) / 100
    : 0;

  // Collect all unique sources
  const allSources = [...new Set(dimensions.flatMap((d) => d.sources))];

  // Build the UserState with both DimensionResult objects and convenience getters
  const state = {
    emotionalState,
    cognitiveLoad,
    energyLevel,
    attentionState,
    stressLevel,
    motivationLevel,
    urgency,
    taskComplexity,
    engagementLevel,
    overallConfidence,
    timestamp: safe.timestamp || new Date().toISOString(),
    sources: allSources,
  };

  // Backward-compatible convenience accessors
  // Allows downstream code to do `state.cognitiveLoad` and get the string value,
  // while `state.cognitiveLoad` is actually a DimensionResult object.
  // We achieve this via Object.defineProperties on a proxy-free wrapper.
  return createUserStateProxy(state);
}

// ─────────────────────────────────────────────────────────────────
//  Backward-compatible proxy
//
//  Allows:
//    state.cognitiveLoad         → returns the DimensionResult object
//    state.cognitiveLoad.value   → returns "high" (explicit)
//    state.mood                  → alias for state.emotionalState
//    state.attention             → alias for state.attentionState
//    state.energy                → alias for state.energyLevel
//    state.engagement            → alias for state.engagementLevel
//
//  This ensures that existing code in adaptationPolicy.js and
//  cognitiveReasoning.js continues to work with the string-comparison
//  patterns like:
//    userState.cognitiveLoad === "high"
// ─────────────────────────────────────────────────────────────────

/**
 * Create a UserState that supports both object access and string comparison.
 *
 * When accessed via a property name that matches a dimension (e.g., `state.cognitiveLoad`),
 * it returns the DimensionResult object. But for backward compatibility, string comparison
 * works because we override valueOf/toString on the dimension results.
 *
 * Actually, a simpler approach: we expose the raw string values as the top-level properties
 * and the full DimensionResult objects under a `_dimensions` namespace.
 *
 * @param {object} state
 * @returns {UserState}
 */
function createUserStateProxy(state) {
  // For backward compatibility, the top-level properties ARE the DimensionResult objects.
  // Downstream code doing `userState.cognitiveLoad === "high"` will compare an object
  // to a string, which is always false. To fix this, we make the state object
  // have string-valued properties that also carry metadata.
  //
  // Solution: use a property accessor pattern where the property returns a string
  // when used in value context, but also carries metadata via a special method.

  // Actually, the cleanest solution for backward compatibility is to make
  // the UserState a plain object where dimension properties are strings,
  // and expose the full DimensionResults under a `_dimensions` property.
  // This way:
  //   state.cognitiveLoad === "high"  (works!)
  //   state._dimensions.cognitiveLoad.confidence === 0.8  (works!)
  //   state._dimensions.cognitiveLoad.reasons === [...]  (works!)

  const emotionalStateDim = state.emotionalState;
  const cognitiveLoadDim = state.cognitiveLoad;
  const energyLevelDim = state.energyLevel;
  const attentionStateDim = state.attentionState;
  const stressLevelDim = state.stressLevel;
  const motivationLevelDim = state.motivationLevel;
  const urgencyDim = state.urgency;
  const taskComplexityDim = state.taskComplexity;
  const engagementLevelDim = state.engagementLevel;

  return {
    emotionalState: emotionalStateDim.value,
    cognitiveLoad: cognitiveLoadDim.value,
    energyLevel: energyLevelDim.value,
    attentionState: attentionStateDim.value,
    stressLevel: stressLevelDim.value,
    motivationLevel: motivationLevelDim.value,
    urgency: urgencyDim.value,
    taskComplexity: taskComplexityDim.value,
    engagementLevel: engagementLevelDim.value,

    mood: emotionalStateDim.value,
    attention: attentionStateDim.value,
    energy: energyLevelDim.value,
    engagement: engagementLevelDim.value,

    overallConfidence: state.overallConfidence,
    timestamp: state.timestamp,
    sources: state.sources,

    _dimensions: {
      emotionalState: emotionalStateDim,
      cognitiveLoad: cognitiveLoadDim,
      energyLevel: energyLevelDim,
      attentionState: attentionStateDim,
      stressLevel: stressLevelDim,
      motivationLevel: motivationLevelDim,
      urgency: urgencyDim,
      taskComplexity: taskComplexityDim,
      engagementLevel: engagementLevelDim,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
//  State transition detection
// ─────────────────────────────────────────────────────────────────

/**
 * Detect significant state transitions between two UserState objects.
 *
 * A transition is considered significant when:
 * - A dimension changes value
 * - The change crosses a meaningful boundary (e.g., low → high)
 *
 * @param {UserState} previousState
 * @param {UserState} currentState
 * @returns {{ transitioned: boolean, changes: Array<{ dimension: string, from: string, to: string, significant: boolean }> }}
 */
export function detectStateTransition(previousState, currentState) {
  const dimensions = [
    "emotionalState", "cognitiveLoad", "energyLevel", "attentionState",
    "stressLevel", "motivationLevel", "urgency", "taskComplexity", "engagementLevel",
  ];

  const changes = [];

  for (const dim of dimensions) {
    const prev = previousState?.[dim];
    const curr = currentState?.[dim];

    if (prev !== curr) {
      // Determine if this is a significant change
      const significant = isSignificantChange(dim, prev, curr);
      changes.push({
        dimension: dim,
        from: prev || "unknown",
        to: curr || "unknown",
        significant,
      });
    }
  }

  return {
    transitioned: changes.some((c) => c.significant),
    changes,
  };
}

// ─────────────────────────────────────────────────────────────────
//  Significance thresholds
// ─────────────────────────────────────────────────────────────────

const COGNITIVE_LOAD_ORDER = ["low", "medium", "high", "overwhelming"];
const STRESS_ORDER = ["none", "mild", "moderate", "high", "acute"];
const ENERGY_ORDER = ["rested", "normal", "tired", "exhausted"];
const URGENCY_ORDER = ["low", "moderate", "high", "critical"];

/**
 * Determine if a change in a dimension is significant.
 *
 * @param {string} dimension
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function isSignificantChange(dimension, from, to) {
  if (from === "unknown" || to === "unknown") return true;

  const orderMap = {
    cognitiveLoad: COGNITIVE_LOAD_ORDER,
    stressLevel: STRESS_ORDER,
    energyLevel: ENERGY_ORDER,
    urgency: URGENCY_ORDER,
  };

  const order = orderMap[dimension];
  if (order) {
    const fromIdx = order.indexOf(from);
    const toIdx = order.indexOf(to);
    if (fromIdx >= 0 && toIdx >= 0) {
      return Math.abs(toIdx - fromIdx) >= 2;
    }
  }

  // For non-ordinal dimensions, any change is significant
  return from !== to;
}
