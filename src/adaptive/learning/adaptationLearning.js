/**
 * adaptationLearning.js — Adaptive feedback & learning loop (Task 4)
 *
 * Captures explicit outcomes of adaptive UI decisions and learns, per user,
 * which adaptations they tend to accept or reject. The learned preferences are
 * fed back into decide() as bounded *supporting evidence* (see
 * backend/adaptive/engine/learning.js) — never as commands, never over an
 * explicit user preference or a safety outcome, and never written back into
 * the user's explicit settings.
 *
 * Feedback model (one outcome per exposure — duplicates are ignored):
 *   accepted   — the user explicitly applied / started it           (+1 accept)
 *   rejected   — the user explicitly declined it                    (+1 reject)
 *   overridden — the user replaced it with an explicit preference   (+1 reject)
 *   dismissed  — "not now" on an offer (softer than a rejection)    (+0.5 reject)
 *   ignored    — shown for a while, then withdrawn with no response (+0.25 reject)
 * Silence is never feedback: an adaptation that was applied and simply left in
 * place records nothing, and "ignored" requires a visible, user-actionable
 * prompt that went unanswered (so only repetition carries weight).
 *
 * Learning (bounded, recency-aware, evidence-gated):
 *   - every event decays with a half-life (older behaviour fades out);
 *   - score = (accept + 1) / (accept + reject + 2)  (Laplace prior: 0.5);
 *   - a preference is usable only with enough decayed weight AND enough
 *     distinct events — a single interaction never moves a decision;
 *   - context-specific (same module) preferences take precedence over the
 *     user's general preference when they have sufficient evidence;
 *   - storage is bounded per user (oldest events dropped).
 *
 * Privacy: events hold only an adaptation key (target:ruleId), the outcome,
 * the module id, the decision id and a timestamp — no snapshot content, text
 * or user state. Nothing is interpreted as a diagnosis.
 *
 * Persistence: the existing Role 4 localStorage namespace
 * (`getRole4StorageKey(userId, "adaptation_feedback")`) with a safe in-memory
 * fallback when storage is unavailable or throws.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { getRole4StorageKey, ROLE4_COLLECTIONS } from "@/support/schemas/storageKeys";

export const FeedbackOutcome = Object.freeze({
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  DISMISSED: "dismissed",
  OVERRIDDEN: "overridden",
  IGNORED: "ignored",
});

const OUTCOME_WEIGHTS = Object.freeze({
  accepted: { accept: 1, reject: 0 },
  rejected: { accept: 0, reject: 1 },
  overridden: { accept: 0, reject: 1 },
  dismissed: { accept: 0, reject: 0.5 },
  ignored: { accept: 0, reject: 0.25 },
});

export const LEARNING_CONFIG = Object.freeze({
  /** Older behaviour halves in weight every 14 days. */
  halfLifeMs: 14 * 24 * 60 * 60 * 1000,
  /** Minimum decayed evidence weight before a preference is usable. */
  minEvidenceWeight: 2.5,
  /** Minimum number of distinct feedback events before it is usable. */
  minEvents: 3,
  /** Bounded history per user. */
  maxEventsPerUser: 300,
  /** Prior pseudo-count used for confidence (n / (n + prior)). */
  priorWeight: 2,
});

// ─────────────────────────────────────────────────────────────────
//  Storage abstraction (localStorage → in-memory fallback)
// ─────────────────────────────────────────────────────────────────

export function createMemoryStorage() {
  const map = new Map();
  return {
    kind: "memory",
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

const memoryFallback = createMemoryStorage();
let storageOverride = null;

function defaultStorage() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      return localStorage;
    }
  } catch {
    // Access to localStorage can throw (privacy modes, sandboxed frames).
  }
  return memoryFallback;
}

/** Inject a storage adapter (tests, alternative persistence). `null` resets. */
export function setLearningStorage(storage) {
  storageOverride = storage ?? null;
}

function storageKey(userId) {
  return getRole4StorageKey(userId, ROLE4_COLLECTIONS.ADAPTATION_FEEDBACK);
}

function readEvents(userId) {
  const key = storageKey(userId);
  const storage = storageOverride ?? defaultStorage();
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidEvent) : [];
  } catch {
    // Unreadable primary storage: use whatever the fallback holds.
    try {
      const raw = memoryFallback.getItem(key);
      return raw ? JSON.parse(raw).filter(isValidEvent) : [];
    } catch {
      return [];
    }
  }
}

function writeEvents(userId, events) {
  const key = storageKey(userId);
  const payload = JSON.stringify(events);
  const storage = storageOverride ?? defaultStorage();
  try {
    storage.setItem(key, payload);
    return storage === memoryFallback ? "memory" : storage.kind ?? "localStorage";
  } catch {
    // Quota / access failure: keep learning for this session in memory.
    memoryFallback.setItem(key, payload);
    return "memory";
  }
}

/** Remove a user's learning history (privacy reset / sign-out). */
export function clearAdaptationLearning(userId) {
  if (!userId) return;
  const key = storageKey(userId);
  for (const storage of [storageOverride, defaultStorage(), memoryFallback]) {
    try {
      storage?.removeItem(key);
    } catch {
      // ignore
    }
  }
}

// ─────────────────────────────────────────────────────────────────
//  Keys & events
// ─────────────────────────────────────────────────────────────────

function ruleIdOf(action) {
  const evidence = Array.isArray(action?.evidence) ? action.evidence : [];
  const policy = evidence.find((entry) => typeof entry === "string" && entry.startsWith("policy:"));
  if (policy) return policy.slice("policy:".length).replace(/@v\d+$/, "");
  const match = typeof action?.reason === "string" ? action.reason.match(/Policy "([^"]+)"/) : null;
  return match ? match[1] : action?.ruleId ?? null;
}

/**
 * Preference identity of an adaptation: target + governing rule. Shared by
 * UI feedback capture and the engine learning stage.
 */
export function preferenceKey(actionOrEntry) {
  const target = actionOrEntry?.action?.target ?? actionOrEntry?.target;
  const ruleId = actionOrEntry?.ruleId && actionOrEntry?.action ? actionOrEntry.ruleId : ruleIdOf(actionOrEntry);
  if (!target || !ruleId) return null;
  return `${target}:${ruleId}`;
}

/** Preference identity of a support-card recommendation (an offer). */
export function recommendationPreferenceKey(recommendationId) {
  return recommendationId ? `RECOMMENDATION:${recommendationId}` : null;
}

function isValidEvent(event) {
  return (
    event &&
    typeof event.id === "string" &&
    typeof event.key === "string" &&
    Object.prototype.hasOwnProperty.call(OUTCOME_WEIGHTS, event.outcome) &&
    typeof event.at === "number"
  );
}

/**
 * Record one explicit feedback outcome.
 *
 * @param {object} feedback
 * @param {string} feedback.userId
 * @param {string} feedback.key - preferenceKey(...) / recommendationPreferenceKey(...)
 * @param {string} feedback.outcome - FeedbackOutcome
 * @param {string} feedback.exposureId - Stable id of the exposure (one shown
 *   prompt / applied adaptation). One outcome per exposure: duplicates are
 *   ignored.
 * @param {string} [feedback.moduleId] - Context the adaptation appeared in
 * @param {string} [feedback.decisionId] - DecisionTrace id that produced it
 * @param {number} [feedback.at]
 * @returns {{ recorded: boolean, duplicate: boolean, storage?: string, reason?: string }}
 */
export function recordAdaptationFeedback(feedback = {}) {
  const { userId, key, outcome, exposureId } = feedback;
  if (!userId || typeof userId !== "string") return { recorded: false, duplicate: false, reason: "no_user" };
  if (!key || typeof key !== "string") return { recorded: false, duplicate: false, reason: "no_key" };
  if (!Object.prototype.hasOwnProperty.call(OUTCOME_WEIGHTS, outcome)) {
    return { recorded: false, duplicate: false, reason: "unknown_outcome" };
  }
  if (!exposureId || typeof exposureId !== "string") {
    return { recorded: false, duplicate: false, reason: "no_exposure" };
  }

  const events = readEvents(userId);
  const id = `${key}|${exposureId}`;
  if (events.some((event) => event.id === id)) {
    return { recorded: false, duplicate: true };
  }
  events.push({
    id,
    key,
    outcome,
    moduleId: typeof feedback.moduleId === "string" ? feedback.moduleId : "generic",
    decisionId: typeof feedback.decisionId === "string" ? feedback.decisionId : null,
    at: typeof feedback.at === "number" && Number.isFinite(feedback.at) ? feedback.at : Date.now(),
  });
  const bounded = events.slice(-LEARNING_CONFIG.maxEventsPerUser);
  const storage = writeEvents(userId, bounded);
  return { recorded: true, duplicate: false, storage };
}

export function getAdaptationFeedback(userId) {
  return userId ? readEvents(userId) : [];
}

// ─────────────────────────────────────────────────────────────────
//  Learning
// ─────────────────────────────────────────────────────────────────

function decayWeight(at, now, halfLifeMs) {
  const age = Math.max(0, now - at);
  return Math.pow(0.5, age / halfLifeMs);
}

function summarize(events, now, config) {
  let accept = 0;
  let reject = 0;
  let ignored = 0;
  for (const event of events) {
    const weight = decayWeight(event.at, now, config.halfLifeMs);
    const outcome = OUTCOME_WEIGHTS[event.outcome];
    accept += outcome.accept * weight;
    reject += outcome.reject * weight;
    if (event.outcome === FeedbackOutcome.IGNORED) ignored += 1;
  }
  const weight = accept + reject;
  const score = (accept + 1) / (weight + 2);
  return {
    score: round(score),
    confidence: round(weight / (weight + config.priorWeight)),
    evidenceWeight: round(weight),
    evidenceCount: events.length,
    ignoredCount: ignored,
    // Compared at the reported precision so the decision matches the trace.
    sufficient: round(weight) >= config.minEvidenceWeight && events.length >= config.minEvents,
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * Summarize a user's learned preference for one adaptation key. Context
 * (same module) evidence wins when sufficient; otherwise the general
 * preference is used; otherwise the preference is insufficient (no effect).
 */
export function summarizePreference(events, key, { moduleId, now = Date.now(), config = LEARNING_CONFIG } = {}) {
  const forKey = events.filter((event) => event.key === key);
  const context = moduleId ? forKey.filter((event) => event.moduleId === moduleId) : [];
  const contextSummary = summarize(context, now, config);
  const globalSummary = summarize(forKey, now, config);
  if (moduleId && contextSummary.sufficient) {
    return { key, scope: "context", ...contextSummary, global: globalSummary };
  }
  return { key, scope: "global", ...globalSummary };
}

/**
 * Learned preferences for every adaptation the user has given feedback on,
 * keyed by preference key. Insufficient entries are included (marked
 * `sufficient: false`) so callers can explain why nothing changed.
 */
export function getLearnedPreferences(userId, { moduleId, now = Date.now(), config = LEARNING_CONFIG, since } = {}) {
  // Task 5: `since` ignores feedback recorded before a learned-personalization
  // reset (possibly made on another device).
  const all = getAdaptationFeedback(userId);
  const events = typeof since === "number" && since > 0 ? all.filter((event) => event.at > since) : all;
  const keys = [...new Set(events.map((event) => event.key))];
  const out = {};
  for (const key of keys) {
    out[key] = summarizePreference(events, key, { moduleId, now, config });
  }
  return out;
}
