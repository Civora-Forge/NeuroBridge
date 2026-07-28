/**
 * contextSnapshot.js — ContextSnapshot Contract
 *
 * Defines the input contract for data expected from the Context & Perception layer.
 * This is the boundary between the Context Engine and the Adaptive Intelligence layer.
 *
 * The ContextSnapshot is produced by the Context Fusion layer and consumed
 * by the User State Model. It is an intermediate representation that combines
 * raw signals from multiple sources into a single structured object.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     ARCHITECTURE POSITION                       │
 * │                                                                 │
 * │  Context Engine sources  →  Context Fusion  →  ContextSnapshot  │
 * │                                                                 │
 * │  conversationAgent.js         contextFusion.js                  │
 * │  moodAgent.js                     │                            │
 * │  activityTracker.js               ▼                            │
 * │  environmentContext.js       ContextSnapshot                    │
 * │                              (this module)                      │
 * │                                  │                              │
 * │                                  ▼                              │
 * │                           User State Model                      │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * DESIGN PRINCIPLES:
 *  1. Simple — flat, predictable structure with no nesting beyond one level
 *  2. Well documented — every field has a clear purpose
 *  3. Extensible — new signal types can be added without breaking existing code
 *  4. Provider-independent — no coupling to any specific AI/LLM/agent framework
 *  5. Optional — all fields are nullable; missing data is explicitly represented
 *
 * Ownership: Adaptive Intelligence Engineer
 * Contract owner: User State Model team
 * Producer: Context & Perception Engineer (Context Fusion)
 */

// ─────────────────────────────────────────────────────────────────
//  Allowed values for constrained dimensions
// ─────────────────────────────────────────────────────────────────

/**
 * Emotion labels that may appear in emotion signals.
 * The Context Engine may produce any label from this set (or others),
 * but the User State Model handles arbitrary strings gracefully.
 *
 * @typedef {string} EmotionLabel
 */

/**
 * Task switching frequency as reported by the activity tracker.
 * @typedef {"low" | "medium" | "high"} TaskSwitchingLevel
 */

/**
 * Engagement level observed from activity signals.
 * @typedef {"high" | "normal" | "low" | "disengaged"} EngagementLevel
 */

/**
 * Urgency level derived from task or conversation signals.
 * @typedef {"low" | "moderate" | "high" | "critical"} UrgencyLevel
 */

/**
 * Task complexity as reported by the task or conversation signals.
 * @typedef {"simple" | "moderate" | "complex"} TaskComplexityLevel
 */

/**
 * Time of day classification.
 * @typedef {"morning" | "afternoon" | "evening" | "night" | "unknown"} TimeOfDay
 */

// ─────────────────────────────────────────────────────────────────
//  ContextSnapshot schema (JSDoc typedef)
//
//  All properties are optional. The Context Fusion layer may supply
//  any subset. The User State Model treats missing properties as
//  absent signals, NOT as default values.
// ─────────────────────────────────────────────────────────────────

/**
 * @typedef {object} EmotionSignal
 * @property {string} label - Inferred emotion label (e.g., "overwhelmed", "calm", "anxious")
 * @property {number} confidence - Confidence in this inference (0-1)
 * @property {string} [source] - Optional: what produced this signal (e.g., "conversation", "biometrics")
 */

/**
 * @typedef {object} ActivitySignal
 * @property {TaskSwitchingLevel} [taskSwitching] - How frequently the user switches tasks
 * @property {string} [currentTask] - Description of the current task
 * @property {EngagementLevel} [engagement] - Observed engagement level
 * @property {number} [sessionDurationMs] - How long the current session has lasted (ms)
 * @property {number} [taskCompletionCount] - Number of tasks completed this session
 * @property {number} [taskAbandonCount] - Number of tasks abandoned this session
 */

/**
 * @typedef {object} EnvironmentSignal
 * @property {TimeOfDay} [timeOfDay] - Time of day
 * @property {string} [deviceType] - Device type (e.g., "desktop", "mobile", "tablet")
 * @property {boolean} [hasReducedMotion] - Whether the user prefers reduced motion
 * @property {object} [raw] - Optional raw environment data for future extension
 */

/**
 * @typedef {object} TaskSignal
 * @property {UrgencyLevel} [urgency] - How urgent the current task is
 * @property {TaskComplexityLevel} [complexity] - How complex the current task is
 * @property {string} [intent] - User's expressed intent (e.g., "complete_task", "get_help", "explore")
 */

/**
 * @typedef {object} UserInputSignal
 * @property {string} [intent] - Explicitly stated user intent
 * @property {string} [requestType] - Type of request (e.g., "task", "emotional_support", "information")
 */

/**
 * @typedef {object} BiometricSignal
 * @property {number} [heartRateVariabilityMs] - HRV in milliseconds (lower = more stress)
 * @property {number} [electrodermalActivityMuS] - EDA in microsiemens (higher = more arousal)
 * @property {number} [accelerometerMagnitudeG] - Accelerometer magnitude in g
 */

/**
 * @typedef {object} ContextSnapshot
 *
 * @description
 * A unified representation of the user's current context, produced by the
 * Context Fusion layer. All fields are optional — the User State Model
 * handles missing data gracefully by producing "unknown" states.
 *
 * @property {EmotionSignal} [emotion] - Inferred emotional state
 * @property {ActivitySignal} [activity] - User activity and engagement signals
 * @property {EnvironmentSignal} [environment] - Environmental context
 * @property {TaskSignal} [task] - Task-related signals
 * @property {UserInputSignal} [userInput] - Explicit user input signals
 * @property {BiometricSignal} [biometrics] - Optional physiological signals
 * @property {number} [overallConfidence] - Overall confidence in the snapshot (0-1)
 * @property {string} [timestamp] - ISO timestamp of when the snapshot was created
 */

// ─────────────────────────────────────────────────────────────────
//  Validation helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Clamp a number to [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalize a confidence value to the 0-1 range.
 * Returns 0 for non-finite or negative values, 1 for values > 1.
 *
 * @param {*} value
 * @returns {number}
 */
export function normalizeConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

/**
 * Check if a value is a non-null object (not an array, not null, not undefined).
 * @param {*} value
 * @returns {boolean}
 */
export function isNonNullObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Safely extract a nested property from an object.
 * Returns undefined if any part of the path is missing.
 *
 * @param {object} obj
 * @param  {...string} path
 * @returns {*}
 */
export function safeGet(obj, ...path) {
  let current = obj;
  for (const key of path) {
    if (!isNonNullObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Create a default ContextSnapshot with all fields absent.
 * Useful for testing and for cases where no context is available.
 *
 * @returns {ContextSnapshot}
 */
export function createEmptySnapshot() {
  return {
    timestamp: new Date().toISOString(),
    overallConfidence: 0,
  };
}
