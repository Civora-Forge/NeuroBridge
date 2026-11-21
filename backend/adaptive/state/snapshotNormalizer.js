/**
 * snapshotNormalizer.js — ContextSnapshot → Normalized Signals
 *
 * The single point of interpretation between the public ContextSnapshot
 * (owned by Role 1) and the User State Model (Role 2).
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     ARCHITECTURE POSITION                       │
 * │                                                                 │
 * │  ContextSnapshot (from ContextSnapshotAdapter)                  │
 * │        │                                                        │
 * │        ▼                                                        │
 * │  ┌──────────────────────────┐                                   │
 * │  │   Snapshot Normalizer    │  ← THIS MODULE                   │
 * │  │  • Maps fields           │                                   │
 * │  │  • Assigns confidence    │                                   │
 * │  │  • Records provenance    │                                   │
 * │  │  • Derives estimates     │                                   │
 * │  └──────────────────────────┘                                   │
 * │        │                                                        │
 * │        ▼                                                        │
 * │  Normalized Signals (consumed by userStateModel.js)             │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * DESIGN PRINCIPLES:
 *  1. Single source of truth — no other module reads snapshot fields
 *     directly for state inference.
 *  2. Honest — missing data yields `unknown`/`null` with confidence 0,
 *     never fabricated values.
 *  3. Provenance — every signal carries { value, confidence, source }.
 *     Derived signals set source = "derived:*" and list contributors.
 *  4. Resilient — Role 2 depends only on the stable public contract, so
 *     future internal changes inside Role 1 cannot break state inference.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import {
  normalizeConfidence,
  isNonNullObject,
} from "@/adaptive/context/contextSnapshot.js";
import { SIGNAL_TTL_SECONDS } from "@/adaptive/context/validation/signalValidator.js";

// ─────────────────────────────────────────────────────────────────
//  Controlled vocabularies (mirror userStateModel.js exports)
//
//  These strings ARE the public Role 2 vocabulary. They intentionally
//  stay in sync with the exported constant arrays in userStateModel.js.
// ─────────────────────────────────────────────────────────────────

/** @type {string[]} */
export const EMOTIONAL_STATES = [
  "calm", "content", "neutral", "anxious", "overwhelmed",
  "frustrated", "sad", "panicked", "irritable", "unknown",
];

/** @type {string[]} */
export const URGENCY_LEVELS = ["low", "moderate", "high", "critical", "unknown"];

/** @type {string[]} */
export const TASK_COMPLEXITIES = ["simple", "moderate", "complex", "unknown"];

/** @type {string[]} */
const TIME_OF_DAY_LEVELS = ["morning", "afternoon", "evening", "night"];

// ─────────────────────────────────────────────────────────────────
//  Mood → emotional state vocabulary mapping
//
//  Role 1's mood vocabulary is intentionally coarser than Role 2's
//  emotional state vocabulary. `positive` maps to `content`, `stressed`
//  maps to `anxious`. `tired` is NOT part of the Role 2 emotional state
//  vocabulary — fatigue is expressed through the energyLevel dimension,
//  so it maps to "unknown" here (migration note: emotional-vocab).
// ─────────────────────────────────────────────────────────────────

/**
 * Role 1 `mood.primaryMood` → Role 2 emotional state label.
 * Labels already present in Role 2's vocabulary pass through unchanged.
 * @type {Record<string, string>}
 */
export const MOOD_TO_EMOTION_MAP = {
  calm: "calm",
  content: "content",
  positive: "content",
  neutral: "neutral",
  anxious: "anxious",
  stressed: "anxious",
  overwhelmed: "overwhelmed",
  frustrated: "frustrated",
  sad: "sad",
  panicked: "panicked",
  irritable: "irritable",
  tired: "unknown",
  unknown: "unknown",
};

// ─────────────────────────────────────────────────────────────────
//  Derivation thresholds (documented, deterministic)
//
//  `behavior.taskSwitchFrequency` is a numeric rate: unique navigations
//  observed per 5-minute rolling window (emitted by the interaction
//  tracker). It is converted to the categorical low/medium/high used by
//  cognitive load and attention inference.
// ─────────────────────────────────────────────────────────────────

export const TASK_SWITCH_THRESHOLDS = {
  high: 0.6,
  medium: 0.2,
};

export const IDLE_DISENGAGED_THRESHOLD_S = 300;
export const FOCUS_INTERRUPTION_THRESHOLD = 5;
export const LONG_SESSION_THRESHOLD_S = 3600;

/**
 * @typedef {object} NormalizedSignal
 * @property {*} value - The signal value. `"unknown"` (categorical) or
 *   `null` (numeric/object) when the signal is unavailable.
 * @property {number} confidence - Confidence in the signal (0-1). 0 when unavailable.
 * @property {string} source - Provenance. `"unavailable"` when missing, or a
 *   snapshot path, or `"derived:*"` plus `contributors` for estimates.
 * @property {string[]} [contributors] - Snapshot fields that support a derived signal.
 */

/**
 * @typedef {object} NormalizedSignals
 * @property {NormalizedSignal} emotion - Mapped emotional state label
 * @property {NormalizedSignal} emotionIntensity - 0-1 intensity (from mood.intensity or arousal)
 * @property {NormalizedSignal} urgency - Task urgency
 * @property {NormalizedSignal} complexity - Task complexity (derived)
 * @property {NormalizedSignal} taskSwitchRate - Numeric task-switch rate
 * @property {NormalizedSignal} readingSpeed - Estimated reading speed (wpm)
 * @property {NormalizedSignal} typingSpeed - Typing speed (chars/min)
 * @property {NormalizedSignal} correctionRate - Correction ratio (0-1)
 * @property {NormalizedSignal} focusInterruptions - Focus interruption count
 * @property {NormalizedSignal} interactionLatency - Nav→interaction latency (s)
 * @property {NormalizedSignal} sessionDuration - Session duration (s)
 * @property {NormalizedSignal} idleDuration - Idle time (s)
 * @property {NormalizedSignal} engagement - Derived engagement estimate
 * @property {NormalizedSignal} hasActiveTask - Whether an active task is present
 * @property {NormalizedSignal} explicitRequest - Latest explicit request
 * @property {NormalizedSignal} biometrics - Physiological signals (or null)
 * @property {NormalizedSignal} timeOfDay - Time-of-day classification
 * @property {NormalizedSignal} scrollBehavior - Scroll activity summary (or null)
 */

/** @type {string[]} */
export const NORMALIZED_SIGNALS = Object.freeze([
  "emotion",
  "emotionIntensity",
  "urgency",
  "complexity",
  "taskSwitchRate",
  "readingSpeed",
  "typingSpeed",
  "correctionRate",
  "focusInterruptions",
  "interactionLatency",
  "sessionDuration",
  "idleDuration",
  "engagement",
  "hasActiveTask",
  "explicitRequest",
  "biometrics",
  "timeOfDay",
  "scrollBehavior",
]);

// ─────────────────────────────────────────────────────────────────
//  Signal factories
// ─────────────────────────────────────────────────────────────────

function isPresentNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function makeSignal(value, confidence, source, contributors = []) {
  return {
    value,
    confidence: normalizeConfidence(confidence),
    source,
    contributors: [...contributors],
  };
}

function categoricalUnavailable() {
  return makeSignal("unknown", 0, "unavailable", []);
}

function numericUnavailable() {
  return makeSignal(null, 0, "unavailable", []);
}

function objectSnapshotField(snapshot, key) {
  const value = snapshot?.[key];
  return isNonNullObject(value) ? value : {};
}

// ─────────────────────────────────────────────────────────────────
//  Per-signal normalizers
// ─────────────────────────────────────────────────────────────────

/**
 * Mood bases that represent what the user SAID or wrote. Any other basis
 * (a pointer-movement burst, the page being visited, a carried-over previous
 * mood) is behaviour, not an emotion: it is withheld from emotional-state
 * inference and only corroborates the contextual inference layer.
 * Snapshots without a `basis` (older producers, fixtures) keep the previous
 * behaviour.
 */
export const EMOTIONAL_MOOD_BASES = Object.freeze(["explicit_checkin", "conversation"]);

function behaviouralMoodBasis(mood) {
  const basis = typeof mood.basis === "string" && mood.basis ? mood.basis : null;
  return basis !== null && !EMOTIONAL_MOOD_BASES.includes(basis) ? basis : null;
}

function withheldBehavioural(signal, basis) {
  return { ...signal, withheld: "behavioural_basis", withheldSource: `mood.basis:${basis}` };
}

function normalizeEmotion(snapshot) {
  const mood = objectSnapshotField(snapshot, "mood");
  const raw = String(mood.primaryMood || "").toLowerCase().trim();

  if (!raw) {
    return categoricalUnavailable();
  }
  const behavioural = behaviouralMoodBasis(mood);
  if (behavioural) {
    return withheldBehavioural(categoricalUnavailable(), behavioural);
  }

  const mapped = MOOD_TO_EMOTION_MAP[raw];
  if (mapped !== undefined) {
    return makeSignal(mapped, mood.confidence, "mood.primaryMood", ["mood.primaryMood"]);
  }

  // Pass through labels that are already in the Role 2 vocabulary.
  if (EMOTIONAL_STATES.includes(raw)) {
    return makeSignal(raw, mood.confidence, "mood.primaryMood", ["mood.primaryMood"]);
  }

  // Unknown/out-of-vocabulary mood → cannot map to a controlled label.
  return makeSignal("unknown", 0, "mood.primaryMood", ["mood.primaryMood"]);
}

function normalizeEmotionIntensity(snapshot) {
  const mood = objectSnapshotField(snapshot, "mood");
  const behavioural = behaviouralMoodBasis(mood);
  if (behavioural) {
    return withheldBehavioural(numericUnavailable(), behavioural);
  }
  const baseConfidence = isPresentNumber(mood.confidence) ? mood.confidence : 0.5;

  if (isPresentNumber(mood.intensity)) {
    return makeSignal(normalizeConfidence(mood.intensity), baseConfidence, "mood.intensity", ["mood.intensity"]);
  }

  // `mood.intensity` is not part of the current MoodContext contract; derive
  // from arousal when present (0-1), with reduced confidence.
  if (isPresentNumber(mood.arousal)) {
    return makeSignal(normalizeConfidence(mood.arousal), baseConfidence * 0.8, "derived:mood.arousal", ["mood.arousal"]);
  }

  return numericUnavailable();
}

function normalizeUrgency(snapshot) {
  const conversation = objectSnapshotField(snapshot, "conversation");
  const raw = String(conversation.urgency || "").toLowerCase().trim();

  if (raw && raw !== "unknown" && URGENCY_LEVELS.includes(raw)) {
    // The urgency label is only as reliable as the analysis that produced it:
    // cap the historical 0.8 at the conversation analysis confidence when
    // Role 1 reports one (e.g. 0.3 for a heuristic no-keyword match).
    const analysisConfidence = conversation.analysis?.confidence;
    const confidence = isPresentNumber(analysisConfidence)
      ? Math.min(0.8, normalizeConfidence(analysisConfidence))
      : 0.8;
    return makeSignal(raw, confidence, "conversation.urgency", ["conversation.urgency"]);
  }

  // Secondary signal: Role 1 already maps intent + urgency to a priority.
  const priority = conversation.explicitRequest?.priority;
  if (priority && ["low", "moderate", "high"].includes(priority)) {
    return makeSignal(priority, 0.6, "conversation.explicitRequest.priority", [
      "conversation.explicitRequest.priority",
    ]);
  }

  return categoricalUnavailable();
}

function readTaskSwitchRate(snapshot) {
  const behavior = objectSnapshotField(snapshot, "behavior");
  if (!behaviorHasEvidence(snapshot)) {
    return null;
  }
  return isPresentNumber(behavior.taskSwitchFrequency) ? behavior.taskSwitchFrequency : null;
}

/**
 * Behavior-channel confidence. When Role 1 reports a confidence it is used
 * as-is — including 0, which the live interaction tracker reports when it
 * has observed no typing, scrolling or movement yet. Only a snapshot that
 * carries no confidence field at all (legacy / hand-built) falls back to the
 * historical 0.6 default.
 */
function behaviorConfidence(snapshot) {
  const behavior = objectSnapshotField(snapshot, "behavior");
  return isPresentNumber(behavior.confidence) ? normalizeConfidence(behavior.confidence) : 0.6;
}

/**
 * False when Role 1 explicitly reports zero behavioral evidence. In that case
 * zero-valued counters (e.g. `taskSwitchFrequency: 0`) describe an absence of
 * observation, not "no task switching", and must not become positive signals.
 */
function behaviorHasEvidence(snapshot) {
  return behaviorConfidence(snapshot) > 0;
}

function normalizeTaskSwitchRate(snapshot) {
  const rate = readTaskSwitchRate(snapshot);
  if (rate === null) {
    return numericUnavailable();
  }
  return makeSignal(rate, behaviorConfidence(snapshot), "behavior.taskSwitchFrequency", [
    "behavior.taskSwitchFrequency",
  ]);
}

function normalizeComplexity(snapshot) {
  // No first-class complexity signal exists in the ContextSnapshot contract.
  // Derive an estimate from the observed task-switch rate (see thresholds).
  const rate = readTaskSwitchRate(snapshot);
  if (rate === null) {
    return categoricalUnavailable();
  }
  if (rate >= TASK_SWITCH_THRESHOLDS.high) {
    return makeSignal("complex", 0.5, "derived:taskSwitchFrequency", ["behavior.taskSwitchFrequency"]);
  }
  if (rate < TASK_SWITCH_THRESHOLDS.medium) {
    return makeSignal("simple", 0.3, "derived:taskSwitchFrequency", ["behavior.taskSwitchFrequency"]);
  }
  return makeSignal("moderate", 0.4, "derived:taskSwitchFrequency", ["behavior.taskSwitchFrequency"]);
}

function normalizeNumericBehaviorField(snapshot, field) {
  const behavior = objectSnapshotField(snapshot, "behavior");
  if (!behaviorHasEvidence(snapshot) || !isPresentNumber(behavior[field])) {
    return numericUnavailable();
  }
  return makeSignal(behavior[field], behaviorConfidence(snapshot), `behavior.${field}`, [`behavior.${field}`]);
}

function normalizeFocusInterruptions(snapshot) {
  const deviceInteraction = objectSnapshotField(snapshot, "deviceInteraction");
  if (!isPresentNumber(deviceInteraction.focusSessionInterruptions)) {
    return numericUnavailable();
  }
  const confidence = isPresentNumber(deviceInteraction.confidence) ? deviceInteraction.confidence : 0.6;
  return makeSignal(deviceInteraction.focusSessionInterruptions, confidence, "deviceInteraction.focusSessionInterruptions", [
    "deviceInteraction.focusSessionInterruptions",
  ]);
}

function normalizeSessionDuration(snapshot) {
  const deviceInteraction = objectSnapshotField(snapshot, "deviceInteraction");
  if (isPresentNumber(deviceInteraction.currentSessionDuration)) {
    const confidence = isPresentNumber(deviceInteraction.confidence) ? deviceInteraction.confidence : 0.6;
    return makeSignal(deviceInteraction.currentSessionDuration, confidence, "deviceInteraction.currentSessionDuration", [
      "deviceInteraction.currentSessionDuration",
    ]);
  }

  // Fallback: session store tracks the same duration.
  const session = objectSnapshotField(snapshot, "session");
  if (isPresentNumber(session.durationSeconds)) {
    return makeSignal(session.durationSeconds, 0.6, "session.durationSeconds", ["session.durationSeconds"]);
  }

  return numericUnavailable();
}

function normalizeIdleDuration(snapshot) {
  const behavior = objectSnapshotField(snapshot, "behavior");
  if (behaviorHasEvidence(snapshot) && isPresentNumber(behavior.idleDuration)) {
    return makeSignal(behavior.idleDuration, behaviorConfidence(snapshot), "behavior.idleDuration", [
      "behavior.idleDuration",
    ]);
  }

  const deviceInteraction = objectSnapshotField(snapshot, "deviceInteraction");
  if (isPresentNumber(deviceInteraction.timeSinceLastInteraction)) {
    const confidence = isPresentNumber(deviceInteraction.confidence) ? deviceInteraction.confidence : 0.6;
    return makeSignal(deviceInteraction.timeSinceLastInteraction, confidence, "deviceInteraction.timeSinceLastInteraction", [
      "deviceInteraction.timeSinceLastInteraction",
    ]);
  }

  return numericUnavailable();
}

function normalizeExplicitRequest(snapshot) {
  const explicit = objectSnapshotField(snapshot, "explicitRequests");
  const hasContent = explicit.requestType != null || explicit.inputMode != null;
  if (!hasContent) {
    return numericUnavailable();
  }
  return makeSignal(explicit, explicit.confidence, "explicitRequests", [
    "explicitRequests.requestType",
    "explicitRequests.inputMode",
  ]);
}

function normalizeBiometrics(snapshot) {
  const biometrics = snapshot?.biometrics;
  if (isNonNullObject(biometrics) && Object.keys(biometrics).length > 0) {
    return makeSignal(biometrics, 0.8, "biometrics", ["biometrics"]);
  }
  return numericUnavailable();
}

function normalizeHasActiveTask(snapshot) {
  const activity = objectSnapshotField(snapshot, "activity");
  const name = String(activity.activity || "").toLowerCase().trim();
  if (name && name !== "idle") {
    return makeSignal(true, 0.6, "activity.activity", ["activity.activity"]);
  }
  return makeSignal(false, 0, "unavailable", []);
}

function normalizeTimeOfDay(snapshot) {
  const environment = objectSnapshotField(snapshot, "environment");
  const raw = String(environment.timeOfDay || "").toLowerCase().trim();
  if (TIME_OF_DAY_LEVELS.includes(raw)) {
    return makeSignal(raw, 0.5, "environment.timeOfDay", ["environment.timeOfDay"]);
  }
  return categoricalUnavailable();
}

function normalizeScrollBehavior(snapshot) {
  const behavior = objectSnapshotField(snapshot, "behavior");
  if (behaviorHasEvidence(snapshot) && isNonNullObject(behavior.scrollBehavior)) {
    return makeSignal(behavior.scrollBehavior, behaviorConfidence(snapshot), "behavior.scrollBehavior", [
      "behavior.scrollBehavior",
    ]);
  }
  return numericUnavailable();
}

// ─────────────────────────────────────────────────────────────────
//  Derived engagement estimate
//
//  The ContextSnapshot exposes no first-class engagement signal. Role 2
//  derives an estimate from multiple observable signals. Every result is
//  marked source = "derived:*" with the contributing snapshot fields.
// ─────────────────────────────────────────────────────────────────

function deriveEngagement(inputs) {
  const {
    idleDuration,
    focusInterruptions,
    sessionDuration,
    taskSwitchRate,
    readingSpeed,
    hasActiveTask,
  } = inputs;

  if (idleDuration != null && idleDuration >= IDLE_DISENGAGED_THRESHOLD_S) {
    return makeSignal("disengaged", 0.45, "derived:idleDuration", ["behavior.idleDuration"]);
  }

  if (focusInterruptions != null && focusInterruptions >= FOCUS_INTERRUPTION_THRESHOLD) {
    return makeSignal("low", 0.4, "derived:focusInterruptions", [
      "deviceInteraction.focusSessionInterruptions",
    ]);
  }

  if (
    sessionDuration != null &&
    sessionDuration >= LONG_SESSION_THRESHOLD_S &&
    taskSwitchRate != null &&
    taskSwitchRate >= TASK_SWITCH_THRESHOLDS.high
  ) {
    return makeSignal("disengaged", 0.4, "derived:sessionAndSwitch", [
      "deviceInteraction.currentSessionDuration",
      "behavior.taskSwitchFrequency",
    ]);
  }

  if (readingSpeed != null && readingSpeed > 0) {
    return makeSignal("high", 0.4, "derived:readingSpeed", ["behavior.readingSpeed"]);
  }

  if (taskSwitchRate != null && taskSwitchRate < TASK_SWITCH_THRESHOLDS.medium && hasActiveTask) {
    return makeSignal("normal", 0.35, "derived:lowSwitchAndTask", [
      "behavior.taskSwitchFrequency",
      "activity.activity",
    ]);
  }

  return categoricalUnavailable();
}

// ─────────────────────────────────────────────────────────────────
//  Main entry point
// ─────────────────────────────────────────────────────────────────

/**
 * Normalize a ContextSnapshot into the Role 2 normalized signal object.
 *
 * This is the ONLY module allowed to interpret snapshot fields for state
 * inference. Missing data produces `unknown`/`null` signals with
 * confidence 0 and source "unavailable" — never fabricated values.
 *
 * @param {import("@/adaptive/context/contextSnapshot.js").ContextSnapshot} [snapshot] - Public context snapshot
 * @returns {NormalizedSignals}
 */
export function normalizeContextSnapshot(snapshot = null) {
  const source = isNonNullObject(snapshot) ? snapshot : {};
  const signals = normalizeFreshSignals(source);

  // Freshness (Task 1): point-in-time inferences that Role 1 has flagged as
  // stale are withdrawn from inference. They become unavailable (so they can
  // neither drive an adaptation nor be read as a positive signal) and carry
  // `stale: true` + `staleSource` for explainability.
  for (const [key, category] of Object.entries(STALENESS_CATEGORY_BY_SIGNAL)) {
    if (isCategoryStale(source, category)) {
      signals[key] = withdrawStale(signals[key]);
    }
  }
  if (isExplicitRequestStale(source)) {
    signals.explicitRequest = withdrawStale(signals.explicitRequest);
  }

  return signals;
}

/**
 * Signals whose evidence is a point-in-time Role 1 inference, mapped to the
 * ContextSnapshot category whose `metadata.stalenessFlags` entry governs it.
 * Live behavior/device counters are recomputed on every snapshot and carry
 * their own confidence, so they are not subject to category staleness.
 */
export const STALENESS_CATEGORY_BY_SIGNAL = Object.freeze({
  emotion: "mood",
  emotionIntensity: "mood",
  urgency: "conversation",
});

function isCategoryStale(snapshot, category) {
  const flags = snapshot?.metadata?.stalenessFlags;
  return isNonNullObject(flags) && flags[category] === true;
}

function parseEpoch(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * The live tracker keeps the last explicit request for the whole session.
 * Relative to the snapshot's own timestamp (deterministic — no wall clock),
 * a request older than the conversation TTL no longer reflects the user's
 * current state.
 */
function isExplicitRequestStale(snapshot) {
  const explicit = objectSnapshotField(snapshot, "explicitRequests");
  const requestedAt = parseEpoch(explicit.timestamp);
  const observedAt = parseEpoch(snapshot?.timestamp);
  if (requestedAt === null || observedAt === null) return false;
  return observedAt - requestedAt > SIGNAL_TTL_SECONDS.conversation * 1000;
}

function withdrawStale(signal) {
  if (!signal || signal.source === "unavailable") {
    return signal;
  }
  const base = typeof signal.value === "string" ? categoricalUnavailable() : numericUnavailable();
  return { ...base, stale: true, staleSource: signal.source };
}

function normalizeFreshSignals(source) {

  const taskSwitchRate = normalizeTaskSwitchRate(source);
  const readingSpeed = normalizeNumericBehaviorField(source, "readingSpeed");
  const typingSpeed = normalizeNumericBehaviorField(source, "typingSpeed");
  const correctionRate = normalizeNumericBehaviorField(source, "correctionRate");
  const interactionLatency = normalizeNumericBehaviorField(source, "interactionLatency");
  const focusInterruptions = normalizeFocusInterruptions(source);
  const sessionDuration = normalizeSessionDuration(source);
  const idleDuration = normalizeIdleDuration(source);
  const hasActiveTask = normalizeHasActiveTask(source);

  const engagement = deriveEngagement({
    idleDuration: idleDuration.value,
    focusInterruptions: focusInterruptions.value,
    sessionDuration: sessionDuration.value,
    taskSwitchRate: taskSwitchRate.value,
    readingSpeed: readingSpeed.value,
    hasActiveTask: hasActiveTask.value === true,
  });

  return {
    emotion: normalizeEmotion(source),
    emotionIntensity: normalizeEmotionIntensity(source),
    urgency: normalizeUrgency(source),
    complexity: normalizeComplexity(source),
    taskSwitchRate,
    readingSpeed,
    typingSpeed,
    correctionRate,
    focusInterruptions,
    interactionLatency,
    sessionDuration,
    idleDuration,
    engagement,
    hasActiveTask,
    explicitRequest: normalizeExplicitRequest(source),
    biometrics: normalizeBiometrics(source),
    timeOfDay: normalizeTimeOfDay(source),
    scrollBehavior: normalizeScrollBehavior(source),
  };
}
