/**
 * signalValidator.js — Context Signal Validator & Quality Assurance
 *
 * Part of the Context & Perception Engine for NeuroBridge V2.
 *
 * RESPONSIBILITIES:
 * 1. Validate incoming context signals before fusion (schema, bounds, sanity).
 * 2. Deduplicate duplicate signals (suppress rapid repeated identical events).
 * 3. Evaluate signal freshness and TTL staleness; calculate confidence decay.
 * 4. Detect conflicts between signals (e.g., explicit check-in vs sentiment).
 * 5. Handle missing values & optional sources gracefully without failing the entire context.
 *
 * Ownership: Context & Perception Engineer
 */

import { createContextSignal } from "../types/contextTypes.js";

/** Default TTLs (in seconds) per signal category/source */
export const SIGNAL_TTL_SECONDS = {
  biometric: 15,
  activity: 30,
  mood: 90,
  conversation: 120,
  environment: 300,
  profile: 3600,
  session: 3600,
};

// Deduplication LRU Cache (stores signal IDs and payload hashes)
const DEDUP_CACHE_LIMIT = 100;
const _seenSignalCache = new Map(); // id/hash -> timestamp ms

/**
 * Generate a hash for payload deduplication checking.
 * @param {object} payload
 * @returns {string}
 */
function hashPayload(payload) {
  try {
    return JSON.stringify(payload || {});
  } catch (_e) {
    return String(payload);
  }
}

/**
 * Check if a signal is a duplicate within the deduplication window (default 5000ms).
 * @param {string} signalId
 * @param {object} payload
 * @param {number} [windowMs=5000]
 * @returns {boolean}
 */
export function isDuplicateSignal(signalId, payload, windowMs = 5000) {
  const now = Date.now();
  const payloadHash = hashPayload(payload);
  const cacheKey = `${signalId}_${payloadHash}`;

  if (_seenSignalCache.has(cacheKey)) {
    const prevTimestamp = _seenSignalCache.get(cacheKey);
    if (now - prevTimestamp < windowMs) {
      return true; // Duplicate detected
    }
  }

  // Add to cache & trim if cache size exceeds limit
  _seenSignalCache.set(cacheKey, now);
  if (_seenSignalCache.size > DEDUP_CACHE_LIMIT) {
    const oldestKey = _seenSignalCache.keys().next().value;
    _seenSignalCache.delete(oldestKey);
  }

  return false;
}

/**
 * Clear deduplication cache (useful for testing).
 */
export function clearDedupCache() {
  _seenSignalCache.clear();
}

/**
 * Evaluate signal freshness and compute effective confidence decay.
 * @param {string} timestamp - ISO 8601 creation time
 * @param {number} initialConfidence - 0.0 to 1.0
 * @param {number} ttlSeconds - Time-to-live in seconds
 * @returns {{ isStale: boolean, ageSeconds: number, effectiveConfidence: number }}
 */
export function evaluateSignalFreshness(timestamp, initialConfidence = 1.0, ttlSeconds = 60) {
  const nowMs = Date.now();
  const signalTimeMs = new Date(timestamp || nowMs).getTime();
  const ageSeconds = Math.max(0, (nowMs - signalTimeMs) / 1000);

  const isStale = ageSeconds > ttlSeconds;

  let effectiveConfidence = Math.max(0.0, Math.min(1.0, initialConfidence));

  if (isStale) {
    // Linear decay past TTL: drops to 0 at 2x TTL
    const decayFactor = Math.max(0.0, 1.0 - (ageSeconds - ttlSeconds) / ttlSeconds);
    effectiveConfidence = effectiveConfidence * decayFactor;
  }

  return {
    isStale,
    ageSeconds: +ageSeconds.toFixed(1),
    effectiveConfidence: +effectiveConfidence.toFixed(2),
  };
}

/**
 * Detect conflicts between incoming signal payload and current context state.
 * @param {string} category
 * @param {object} payload
 * @param {object} currentContext
 * @returns {Array<{ category: string, description: string, severity: "low"|"moderate"|"high" }>}
 */
export function detectSignalConflicts(category, payload, currentContext) {
  const conflicts = [];

  if (!payload || !currentContext) return conflicts;

  // Conflict 1: Explicit mood check-in vs conversation text sentiment
  const moodValue = payload.value || payload.primaryMood;
  if (category === "mood" && moodValue && currentContext.conversation) {
    const explicitVal = String(moodValue).toLowerCase();
    const sentimentScore = currentContext.conversation.sentimentScore;

    if ((explicitVal === "calm" || explicitVal === "positive") && sentimentScore !== null && sentimentScore < -0.5) {
      conflicts.push({
        category: "mood",
        description: `Explicit check-in mood '${explicitVal}' conflicts with negative text sentiment (${sentimentScore})`,
        severity: "moderate",
      });
    } else if ((explicitVal === "stressed" || explicitVal === "overwhelmed") && sentimentScore !== null && sentimentScore > 0.6) {
      conflicts.push({
        category: "mood",
        description: `Explicit check-in mood '${explicitVal}' conflicts with positive text sentiment (${sentimentScore})`,
        severity: "low",
      });
    }
  }

  // Conflict 2: Conversation calm sentiment vs high activity velocity / task switching
  if (category === "conversation" && payload.sentimentScore > 0.5 && currentContext.activity) {
    const recentEvents = currentContext.activity.recentEvents || [];
    if (recentEvents.length >= 6) {
      conflicts.push({
        category: "activity_conversation",
        description: `Positive conversation sentiment conflicts with high task switching activity (${recentEvents.length} recent events)`,
        severity: "moderate",
      });
    }
  }

  return conflicts;
}

/**
 * Validate and sanitize an incoming ContextSignal.
 * Fills safe default fallbacks for missing values and handles optional source unavailability gracefully.
 *
 * @param {import("../types/contextTypes.js").ContextSignal | object} rawSignal
 * @param {object} [currentContext]
 * @param {object} [options]
 * @param {boolean} [options.allowDuplicates=false]
 * @returns {{
 *   isValid: boolean,
 *   isDuplicate: boolean,
 *   isStale: boolean,
 *   effectiveConfidence: number,
 *   sanitizedSignal: import("../types/contextTypes.js").ContextSignal,
 *   conflicts: Array<{ category: string, description: string, severity: string }>,
 *   errors: string[]
 * }}
 */
export function validateContextSignal(rawSignal, currentContext = {}, options = {}) {
  const errors = [];

  if (!rawSignal || typeof rawSignal !== "object") {
    return {
      isValid: false,
      isDuplicate: false,
      isStale: true,
      effectiveConfidence: 0.0,
      sanitizedSignal: createContextSignal({ source: "fallback", type: "INVALID_SIGNAL", payload: {} }),
      conflicts: [],
      errors: ["Signal must be a non-null object"],
    };
  }

  const signal = rawSignal.id ? rawSignal : createContextSignal(rawSignal);

  const source = signal.source || "unknown";
  const type = signal.type || "GENERIC_SIGNAL";
  const payload = signal.payload && typeof signal.payload === "object" ? signal.payload : {};
  const rawConfidence = typeof signal.confidence === "number" ? signal.confidence : 1.0;
  const clampedConfidence = Math.max(0.0, Math.min(1.0, rawConfidence));

  // Determine TTL seconds
  const categoryKey = source.replace(/Collector|Agent|Context|Tracker/g, "").toLowerCase();
  const ttlSeconds = signal.ttlSeconds || SIGNAL_TTL_SECONDS[categoryKey] || 60;

  // 1. Check for duplicates
  const allowDuplicates = options.allowDuplicates === true;
  const isDuplicate = !allowDuplicates && isDuplicateSignal(signal.id, payload);
  if (isDuplicate) {
    errors.push("Duplicate signal detected within deduplication window");
  }

  // 2. Check freshness and evaluate confidence decay
  const freshness = evaluateSignalFreshness(signal.timestamp, clampedConfidence, ttlSeconds);

  // 3. Detect conflicts
  const conflicts = detectSignalConflicts(categoryKey, payload, currentContext);

  // 4. Construct sanitized signal
  const sanitizedSignal = {
    ...signal,
    source,
    type,
    payload,
    confidence: freshness.effectiveConfidence,
    timestamp: signal.timestamp || new Date().toISOString(),
    ttlSeconds,
  };

  const isValid = errors.length === 0 || isDuplicate; // Mark valid for ingestion even if duplicate is suppressed

  return {
    isValid,
    isDuplicate,
    isStale: freshness.isStale,
    effectiveConfidence: freshness.effectiveConfidence,
    sanitizedSignal,
    conflicts,
    errors,
  };
}
