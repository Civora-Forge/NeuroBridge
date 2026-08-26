/**
 * userStateModel.js — Unified User State Model
 *
 * Transforms a ContextSnapshot into a structured, confidence-aware,
 * explainable representation of the user's current state.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     ARCHITECTURE POSITION                       │
 * │                                                                 │
 * │  ContextSnapshot (from ContextSnapshotAdapter)                  │
 * │        │                                                        │
 * │        ▼                                                        │
 * │  ┌──────────────────────────┐                                   │
 * │  │   Snapshot Normalizer    │  → Normalized Signals            │
 * │  │  (snapshotNormalizer.js) │                                   │
 * │  └──────────────────────────┘                                   │
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
 * INPUT CONTRACT: This module consumes ONLY the public ContextSnapshot
 * produced by Role 1 (via getContextSnapshotAPI / CONTEXT_UPDATED /
 * ContextSnapshotAdapter) and the normalized signal object produced by
 * snapshotNormalizer.js. It does NOT read raw Unified Context Object
 * fields such as emotion.*, task.*, activity.*, or userInput.*.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import {
  normalizeConfidence,
  isNonNullObject,
} from "@/adaptive/context/contextSnapshot.js";
import { normalizeContextSnapshot } from "./snapshotNormalizer.js";

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
//  Normalized signal accessors
//
//  `signals` is the object returned by normalizeContextSnapshot().
//  Each signal is { value, confidence, source, contributors }.
// ─────────────────────────────────────────────────────────────────

/**
 * Read a categorical signal's value ("unknown" when unavailable).
 * @param {object} signals - Normalized signals
 * @param {string} key - Signal key
 * @returns {string}
 */
function signalValue(signals, key) {
  const signal = signals[key];
  if (!signal || signal.value === "unknown" || signal.value === null) return "unknown";
  return signal.value;
}

/**
 * Whether a signal carries real data (source != "unavailable").
 * @param {object} signals - Normalized signals
 * @param {string} key - Signal key
 * @returns {boolean}
 */
function signalAvailable(signals, key) {
  return signals[key]?.source !== "unavailable";
}

// ─────────────────────────────────────────────────────────────────
//  Dimension inference functions
//
//  Each function takes the normalized signal object and returns a
//  DimensionResult. All ContextSnapshot interpretation happens in
//  snapshotNormalizer.js — not here.
// ─────────────────────────────────────────────────────────────────

/**
 * Infer emotional state from the normalized emotion signal.
 *
 * @param {import("./snapshotNormalizer.js").NormalizedSignals} signals
 * @returns {DimensionResult}
 */
function inferEmotionalState(signals) {
  const emotion = signals.emotion;
  const label = signalValue(signals, "emotion");

  if (!signalAvailable(signals, "emotion") || label === "unknown") {
    return unknown("No emotion signal provided");
  }

  const confidence = normalizeConfidence(emotion.confidence);

  // If confidence is very low, we still report the label but reduce confidence
  // We do NOT discard the signal — the downstream layer decides what to do with it
  const reasons = [`Emotion "${label}" inferred from ${emotion.source || "context"}`];
  const sources = [emotion.source];

  if (confidence < 0.3) {
    reasons.push("Low confidence in emotion detection — state may be inaccurate");
  }

  return dim(label, confidence, reasons, sources);
}

/**
 * Infer cognitive load from task switch rate, task complexity, and emotion.
 *
 * Rules (applied in order, first match wins for value):
 *   - overwhelming emotion → "overwhelming"
 *   - high task switching + high complexity → "high"
 *   - high task switching OR high complexity → "high"
 *   - medium task switching OR medium complexity → "medium"
 *   - low task switching + low complexity → "low"
 *   - else → "unknown"
 *
 * @param {import("./snapshotNormalizer.js").NormalizedSignals} signals
 * @returns {DimensionResult}
 */
function inferCognitiveLoad(signals) {
  const reasons = [];
  const sources = [];
  let confidence = 0;

  // Signal: emotion
  const emotionLabel = signalValue(signals, "emotion");
  const emotionConfidence = signals.emotion.confidence;
  if (emotionLabel !== "unknown") {
    sources.push(signals.emotion.source);
    confidence = Math.max(confidence, emotionConfidence);
  }

  // Signal: task switch rate (numeric, converted to levels)
  const taskSwitchRate = signals.taskSwitchRate.value;
  const hasRate = taskSwitchRate != null;
  if (hasRate) {
    sources.push(signals.taskSwitchRate.source);
    confidence = Math.max(confidence, signals.taskSwitchRate.confidence);
  }

  // Signal: task complexity (derived)
  const complexity = signalValue(signals, "complexity");
  const hasComplexity = complexity !== "unknown";
  if (hasComplexity) {
    sources.push(signals.complexity.source);
    confidence = Math.max(confidence, signals.complexity.confidence);
  }

  if (sources.length === 0) {
    return unknown("No signals available for cognitive load inference");
  }

  const highSwitching = hasRate && taskSwitchRate >= 0.6;
  const mediumSwitching = hasRate && taskSwitchRate >= 0.2 && taskSwitchRate < 0.6;
  const lowSwitching = hasRate && taskSwitchRate < 0.2;
  const highComplexity = complexity === "complex";
  const mediumComplexity = complexity === "moderate";

  if (emotionLabel === "overwhelmed" || emotionLabel === "panicked") {
    reasons.push(`Emotion is "${emotionLabel}" — indicates overwhelming cognitive load`);
    return dim("overwhelming", confidence * emotionConfidence, reasons, sources);
  }

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

  if (lowSwitching && (!hasComplexity || complexity === "simple")) {
    reasons.push("Low task switching and low/simple complexity");
    return dim("low", confidence * 0.6, reasons, sources);
  }

  // Fallback — we have some signals but can't determine load
  return dim("unknown", confidence * 0.3, ["Insufficient signals to determine cognitive load"], sources);
}

/**
 * Infer energy level from emotion, session duration, and time of day.
 *
 * @param {import("./snapshotNormalizer.js").NormalizedSignals} signals
 * @returns {DimensionResult}
 */
function inferEnergyLevel(signals) {
  const reasons = [];
  const sources = [];
  let confidence = 0;

  // Signal: emotion
  const emotionLabel = signalValue(signals, "emotion");
  const emotionConfidence = signals.emotion.confidence;
  if (emotionLabel !== "unknown") {
    sources.push(signals.emotion.source);
    confidence = Math.max(confidence, emotionConfidence);
  }

  // Signal: session duration (seconds)
  const sessionSeconds = signals.sessionDuration.value;
  if (sessionSeconds != null) {
    sources.push(signals.sessionDuration.source);
    confidence = Math.max(confidence, signals.sessionDuration.confidence);
  }

  // Signal: time of day
  const timeOfDay = signalValue(signals, "timeOfDay");
  if (timeOfDay !== "unknown") {
    sources.push(signals.timeOfDay.source);
    confidence = Math.max(confidence, signals.timeOfDay.confidence);
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
  if (sessionSeconds != null) {
    const sessionMinutes = sessionSeconds / 60;
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
 * Infer attention state from task switch rate, derived engagement, and
 * the presence of an active task.
 *
 * @param {import("./snapshotNormalizer.js").NormalizedSignals} signals
 * @returns {DimensionResult}
 */
function inferAttentionState(signals) {
  const reasons = [];
  const sources = [];
  let confidence = 0;

  const taskSwitchRate = signals.taskSwitchRate.value;
  const hasRate = taskSwitchRate != null;
  if (hasRate) {
    sources.push(signals.taskSwitchRate.source);
    confidence = Math.max(confidence, signals.taskSwitchRate.confidence);
  }

  const engagement = signalValue(signals, "engagement");
  if (signalAvailable(signals, "engagement")) {
    sources.push(signals.engagement.source);
    confidence = Math.max(confidence, signals.engagement.confidence);
  }

  const hasActiveTask = signals.hasActiveTask.value === true;
  if (hasActiveTask) {
    sources.push(signals.hasActiveTask.source);
    confidence = Math.max(confidence, signals.hasActiveTask.confidence);
  }

  if (sources.length === 0) {
    return unknown("No signals available for attention state inference");
  }

  // High task switching = fragmented attention
  if (hasRate && taskSwitchRate >= 0.6) {
    reasons.push("High task switching indicates fragmented attention");
    return dim("fragmented", confidence, reasons, sources);
  }

  // Disengaged = absent attention
  if (engagement === "disengaged") {
    reasons.push("Disengagement indicates absent attention");
    return dim("absent", confidence * 0.8, reasons, sources);
  }

  // Low engagement + no current task = scattered
  if (engagement === "low" && !hasActiveTask) {
    reasons.push("Low engagement with no active task indicates scattered attention");
    return dim("scattered", confidence * 0.7, reasons, sources);
  }

  // Medium task switching = scattered
  if (hasRate && taskSwitchRate >= 0.2 && taskSwitchRate < 0.6) {
    reasons.push("Medium task switching indicates scattered attention");
    return dim("scattered", confidence * 0.8, reasons, sources);
  }

  // Low task switching + has task + high/normal engagement = focused
  if (hasRate && taskSwitchRate < 0.2 && hasActiveTask && engagement !== "low") {
    reasons.push("Low task switching with active task and adequate engagement");
    return dim("focused", confidence, reasons, sources);
  }

  // Low task switching without clear signals
  if (hasRate && taskSwitchRate < 0.2) {
    reasons.push("Low task switching suggests focused or calm attention");
    return dim("focused", confidence * 0.6, reasons, sources);
  }

  return dim("unknown", confidence * 0.3, ["Insufficient signals to determine attention state"], sources);
}

/**
 * Infer stress level from emotion and biometrics.
 *
 * @param {import("./snapshotNormalizer.js").NormalizedSignals} signals
 * @returns {DimensionResult}
 */
function inferStressLevel(signals) {
  const reasons = [];
  const sources = [];
  let confidence = 0;

  // Signal: emotion
  const emotionLabel = signalValue(signals, "emotion");
  const emotionConfidence = signals.emotion.confidence;
  const stressFromEmotion = EMOTION_TO_STRESS[emotionLabel];

  if (stressFromEmotion) {
    sources.push(signals.emotion.source);
    confidence = Math.max(confidence, emotionConfidence);
  }

  // Signal: biometrics (HRV / EDA)
  const biometrics = signals.biometrics.value;
  const hrv = biometrics?.heartRateVariabilityMs;
  const eda = biometrics?.electrodermalActivityMuS;

  if (typeof hrv === "number") {
    sources.push("biometrics.hrv");
    confidence = Math.max(confidence, 0.8);
  }
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
 * Infer motivation level from the derived engagement signal.
 *
 * Note: the ContextSnapshot does not expose task completion/abandonment
 * counts, so motivation now relies on engagement (derived from idle time,
 * focus interruptions, session length, and reading activity). This is a
 * documented contract gap — see MIGRATION_NOTES.md.
 *
 * @param {import("./snapshotNormalizer.js").NormalizedSignals} signals
 * @returns {DimensionResult}
 */
function inferMotivationLevel(signals) {
  const reasons = [];
  const sources = [];
  let confidence = 0;

  const engagement = signalValue(signals, "engagement");
  if (signalAvailable(signals, "engagement")) {
    sources.push(signals.engagement.source);
    confidence = Math.max(confidence, signals.engagement.confidence);
  }

  if (sources.length === 0) {
    return unknown("No signals available for motivation level inference");
  }

  if (engagement === "high") {
    reasons.push("High engagement suggests high motivation");
    return dim("high", confidence, reasons, sources);
  }
  if (engagement === "normal") {
    reasons.push("Normal engagement suggests moderate motivation");
    return dim("moderate", confidence * 0.8, reasons, sources);
  }
  if (engagement === "low" || engagement === "disengaged") {
    reasons.push(`"${engagement}" engagement suggests low motivation`);
    return dim("low", confidence * 0.9, reasons, sources);
  }

  return dim("unknown", confidence * 0.3, ["Insufficient signals to determine motivation"], sources);
}

/**
 * Infer urgency from conversation urgency and explicit requests.
 *
 * @param {import("./snapshotNormalizer.js").NormalizedSignals} signals
 * @returns {DimensionResult}
 */
function inferUrgency(signals) {
  const reasons = [];
  const sources = [];

  // Primary: conversation urgency
  const urgency = signalValue(signals, "urgency");
  if (signalAvailable(signals, "urgency") && urgency !== "unknown") {
    sources.push(signals.urgency.source);
    reasons.push(`Task urgency reported as "${urgency}"`);
    return dim(urgency, signals.urgency.confidence, reasons, sources);
  }

  // Secondary: explicit request type signals urgency
  const explicitRequest = signals.explicitRequest.value;
  if (explicitRequest?.requestType) {
    sources.push(signals.explicitRequest.source);
    const requestType = explicitRequest.requestType;
    const highUrgencyRequests = ["explicit_help_request"];
    const moderateUrgencyRequests = ["explicit_state_report"];

    if (highUrgencyRequests.includes(requestType)) {
      reasons.push(`Explicit request "${requestType}" implies high urgency`);
      return dim("high", 0.7, reasons, sources);
    }
    if (moderateUrgencyRequests.includes(requestType)) {
      reasons.push(`Explicit request "${requestType}" implies moderate urgency`);
      return dim("moderate", 0.6, reasons, sources);
    }
    reasons.push(`Explicit request "${requestType}" — urgency unclear, defaulting to low`);
    return dim("low", 0.4, reasons, sources);
  }

  return unknown("No urgency signals available");
}

/**
 * Infer task complexity from the derived complexity signal.
 *
 * Note: the ContextSnapshot exposes no first-class complexity field.
 * Complexity is derived from the task-switch rate (source "derived:*").
 * See MIGRATION_NOTES.md.
 *
 * @param {import("./snapshotNormalizer.js").NormalizedSignals} signals
 * @returns {DimensionResult}
 */
function inferTaskComplexity(signals) {
  const complexity = signalValue(signals, "complexity");

  if (signalAvailable(signals, "complexity") && complexity !== "unknown") {
    const contributors = signals.complexity.contributors.join(", ");
    return dim(complexity, signals.complexity.confidence, [
      `Task complexity "${complexity}" derived from ${contributors}`,
    ], [signals.complexity.source]);
  }

  return unknown("No task complexity signals available");
}

/**
 * Infer engagement level from the derived engagement signal.
 *
 * @param {import("./snapshotNormalizer.js").NormalizedSignals} signals
 * @returns {DimensionResult}
 */
function inferEngagementLevel(signals) {
  const engagement = signalValue(signals, "engagement");

  if (signalAvailable(signals, "engagement") && engagement !== "unknown") {
    const contributors = signals.engagement.contributors.join(", ");
    return dim(engagement, signals.engagement.confidence, [
      `Engagement "${engagement}" derived from ${contributors}`,
    ], [signals.engagement.source]);
  }

  return unknown("No signals available for engagement inference");
}

// ─────────────────────────────────────────────────────────────────
//  Main entry point
// ─────────────────────────────────────────────────────────────────

/**
 * Build a UserState from a ContextSnapshot.
 *
 * This is the primary API of the User State Model. It takes a
 * ContextSnapshot (produced by the Context Fusion layer and adapted into
 * the public contract) and returns a structured UserState with inferred
 * dimensions, confidence scores, and explainability metadata.
 *
 * All snapshot interpretation is delegated to snapshotNormalizer.js.
 *
 * @param {import("@/adaptive/context/contextSnapshot.js").ContextSnapshot} [snapshot] - The context snapshot
 * @returns {UserState}
 *
 * @example
 * // Full context
 * const state = buildUserState({
 *   mood: { primaryMood: "overwhelmed", confidence: 0.86 },
 *   behavior: { taskSwitchFrequency: 1.0 },
 *   conversation: { urgency: "high" },
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
  const safe = isNonNullObject(snapshot) ? snapshot : {};
  const signals = normalizeContextSnapshot(safe);

  // Infer each dimension
  const emotionalState = inferEmotionalState(signals);
  const cognitiveLoad = inferCognitiveLoad(signals);
  const energyLevel = inferEnergyLevel(signals);
  const attentionState = inferAttentionState(signals);
  const stressLevel = inferStressLevel(signals);
  const motivationLevel = inferMotivationLevel(signals);
  const urgency = inferUrgency(signals);
  const taskComplexity = inferTaskComplexity(signals);
  const engagementLevel = inferEngagementLevel(signals);

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
