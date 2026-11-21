/**
 * behaviouralBaseline.js — Shared per-user behavioural baseline
 *
 * Learns what is NORMAL for this user, per activity type, so the
 * context-to-state inference layer can read "more corrections than usual for
 * you" instead of comparing everyone against one population threshold.
 *
 * What it stores (and what it never stores):
 *   - Only numeric interaction aggregates: running mean / variance / sample
 *     count of a closed list of metrics (correction rate, undo rate, response
 *     latency, inter-key gap, task completion time, window-interruption rate,
 *     navigation-switch rate), keyed by activity type (reading, structured
 *     task, …) — shared across all modules of that type.
 *   - Never a state, label, diagnosis, raw event, text or module history.
 *
 * Contamination guards:
 *   - An observation is REJECTED while any contextual state is present or
 *     emerging, or while the user has an active self-reported distress, so a
 *     temporary difficult period is never learned as the user's "normal".
 *   - Only the app-level runtime records observations (module-level decision
 *     paths never write here), and at most one observation per activity type
 *     per `minIntervalMs`.
 *   - After `maxEffectiveSamples` the mean moves as a slow exponential
 *     average, so no single session can redefine the baseline.
 *
 * Storage: the Role 4 localStorage namespace (wiped on sign-out with every
 * other `nb_*` key) with an in-memory fallback. Device-local; not synced.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { getRole4StorageKey, ROLE4_COLLECTIONS } from "@/support/schemas/storageKeys";

export const BASELINE_VERSION = 1;

/** Metrics the baseline may learn, with sanity bounds (out-of-range → dropped). */
export const BASELINE_METRICS = Object.freeze({
  correctionRate: { min: 0, max: 5 },
  undoRate: { min: 0, max: 5 },
  latencySeconds: { min: 0, max: 600 },
  typingGapMs: { min: 0, max: 5000 },
  taskCompletionMs: { min: 0, max: 4 * 60 * 60 * 1000 },
  focusInterruptRate: { min: 0, max: 60 },
  navigationSwitchRate: { min: 0, max: 60 },
});

export const BASELINE_CONFIG = Object.freeze({
  /** One observation per activity type at most this often. */
  minIntervalMs: 60 * 1000,
  /** Beyond this many samples, updates are an exponential average with alpha = 1/N. */
  maxEffectiveSamples: 50,
});

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

const memoryFallback = createMemoryStorage();
let storageOverride = null;

function storage() {
  if (storageOverride) return storageOverride;
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch {
    // Storage blocked: fall back to memory.
  }
  return memoryFallback;
}

/** Test / host injection point. `null` restores the default. */
export function setBaselineStorage(next) {
  storageOverride = next ?? null;
}

function keyFor(userId) {
  return getRole4StorageKey(userId, ROLE4_COLLECTIONS.BEHAVIOURAL_BASELINE);
}

function emptyBaseline() {
  return { version: BASELINE_VERSION, updatedAt: null, activities: {} };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Keep only well-formed metric stats for known metrics. */
function sanitize(raw) {
  if (!isRecord(raw) || raw.version !== BASELINE_VERSION || !isRecord(raw.activities)) {
    return emptyBaseline();
  }
  // Stored shape: { [activityType]: { metrics: { [metric]: {n, mean, m2} }, lastObservedAt } }
  const activities = {};
  for (const [activityType, activity] of Object.entries(raw.activities)) {
    if (typeof activityType !== "string" || !isRecord(activity) || !isRecord(activity.metrics)) continue;
    activities[activityType] = sanitizeActivity(activity);
  }
  return {
    version: BASELINE_VERSION,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : null,
    activities,
  };
}

function sanitizeActivity(activity) {
  const metrics = {};
  for (const [metric, stat] of Object.entries(activity.metrics ?? {})) {
    if (!Object.prototype.hasOwnProperty.call(BASELINE_METRICS, metric) || !isRecord(stat)) continue;
    const { n, mean, m2 } = stat;
    if (![n, mean, m2].every((v) => typeof v === "number" && Number.isFinite(v)) || n < 1 || m2 < 0) continue;
    metrics[metric] = { n: Math.trunc(n), mean, m2 };
  }
  return {
    metrics,
    lastObservedAt: Number.isFinite(activity.lastObservedAt) ? activity.lastObservedAt : null,
  };
}

/**
 * Read the user's baseline (empty when none / unreadable / no user).
 * @param {string|null|undefined} userId
 */
export function getBehaviouralBaseline(userId) {
  if (!userId) return emptyBaseline();
  try {
    const raw = storage().getItem(keyFor(userId));
    return raw ? sanitize(JSON.parse(raw)) : emptyBaseline();
  } catch {
    return emptyBaseline();
  }
}

function write(userId, baseline) {
  try {
    storage().setItem(keyFor(userId), JSON.stringify(baseline));
    return true;
  } catch {
    try {
      memoryFallback.setItem(keyFor(userId), JSON.stringify(baseline));
    } catch {
      // ignore
    }
    return false;
  }
}

function updateStat(stat, value, config) {
  if (!stat) return { n: 1, mean: value, m2: 0 };
  const n = stat.n + 1;
  if (stat.n < config.maxEffectiveSamples) {
    // Welford
    const delta = value - stat.mean;
    const mean = stat.mean + delta / n;
    const m2 = stat.m2 + delta * (value - mean);
    return { n, mean, m2 };
  }
  // Slow exponential average once enough samples exist: variance tracked
  // as an exponentially weighted m2 scaled to the effective sample count.
  const alpha = 1 / config.maxEffectiveSamples;
  const delta = value - stat.mean;
  const mean = stat.mean + alpha * delta;
  const variance = stat.m2 / Math.max(1, stat.n - 1);
  const nextVariance = (1 - alpha) * (variance + alpha * delta * delta);
  return { n, mean, m2: nextVariance * (n - 1) };
}

/**
 * Record one observation of normal behaviour.
 *
 * @param {string} userId
 * @param {{ activityType: string, metrics: Record<string, number>,
 *   contaminated?: boolean, at?: number }} observation
 *   `contaminated` must be true while any contextual state or self-reported
 *   distress is active; such observations are rejected.
 * @returns {{ recorded: boolean, reason?: string, metrics?: string[] }}
 */
export function recordBaselineObservation(userId, observation = {}, config = BASELINE_CONFIG) {
  if (!userId) return { recorded: false, reason: "no_user" };
  const { activityType, metrics, contaminated } = observation;
  if (typeof activityType !== "string" || !activityType) return { recorded: false, reason: "no_activity" };
  if (contaminated === true) return { recorded: false, reason: "state_active" };
  if (!isRecord(metrics)) return { recorded: false, reason: "no_metrics" };
  const at = Number.isFinite(observation.at) ? observation.at : Date.now();

  const accepted = {};
  for (const [metric, value] of Object.entries(metrics)) {
    const bounds = BASELINE_METRICS[metric];
    if (!bounds || typeof value !== "number" || !Number.isFinite(value)) continue;
    if (value < bounds.min || value > bounds.max) continue;
    accepted[metric] = value;
  }
  if (Object.keys(accepted).length === 0) return { recorded: false, reason: "no_valid_metrics" };

  const baseline = getBehaviouralBaseline(userId);
  const activity = baseline.activities[activityType] ?? { metrics: {}, lastObservedAt: null };
  if (activity.lastObservedAt !== null && at - activity.lastObservedAt < config.minIntervalMs) {
    return { recorded: false, reason: "rate_limited" };
  }
  const nextMetrics = { ...activity.metrics };
  for (const [metric, value] of Object.entries(accepted)) {
    nextMetrics[metric] = updateStat(nextMetrics[metric], value, config);
  }
  baseline.activities[activityType] = { metrics: nextMetrics, lastObservedAt: at };
  baseline.updatedAt = at;
  write(userId, baseline);
  return { recorded: true, metrics: Object.keys(accepted) };
}

/** Remove the user's baseline (privacy reset / deletion / sign-out). */
export function clearBehaviouralBaseline(userId) {
  if (!userId) return;
  for (const target of [storageOverride, (() => { try { return localStorage; } catch { return null; } })(), memoryFallback]) {
    try {
      target?.removeItem(keyFor(userId));
    } catch {
      // ignore
    }
  }
}

/** Contextual dimension values that mean a temporary state is (or was just) active. */
const ACTIVE_STATE_VALUES = new Set(["present", "emerging", "recovering"]);
const CONTEXTUAL_STATE_DIMENSIONS = Object.freeze([
  "cognitiveOverloadState",
  "frustrationState",
  "attentionFragmentationState",
  "cognitiveFatigueState",
]);

/**
 * Derive a baseline observation from a decision's UserState. `contaminated`
 * is true while any contextual state is present / emerging / recovering or
 * the user has reported distress, so such periods are never learned as the
 * user's normal. Returns null when the state carries no contextual metrics.
 *
 * @param {object|null|undefined} userState - UserState (e.g. plan.userStateReference)
 * @returns {{ activityType: string, metrics: Record<string, number>, contaminated: boolean, at?: number }|null}
 */
export function baselineObservationFromUserState(userState) {
  const contextual = userState?.contextual;
  if (!isRecord(contextual) || contextual.available !== true || !isRecord(contextual.metrics)) return null;
  if (Object.keys(contextual.metrics).length === 0) return null;
  const contaminated =
    CONTEXTUAL_STATE_DIMENSIONS.some((dimension) => ACTIVE_STATE_VALUES.has(userState[dimension])) ||
    userState.selfReportedDistress === "present";
  const observation = { activityType: contextual.activityType, metrics: { ...contextual.metrics }, contaminated };
  if (Number.isFinite(contextual.observedAt)) observation.at = contextual.observedAt;
  return observation;
}
