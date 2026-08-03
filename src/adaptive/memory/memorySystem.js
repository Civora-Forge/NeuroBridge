/**
 * memorySystem.js — Memory System
 *
 * Stores useful information that improves future personalization.
 *
 * Memory categories:
 * - User Preferences
 * - Successful Interventions
 * - Unsuccessful Interventions
 * - Preferred Session Length
 * - Accessibility Preferences
 * - Interaction Patterns
 * - Long-term Behavioral Patterns
 *
 * Principles:
 * - User-controlled
 * - Transparent
 * - Privacy-aware
 * - Deletable
 * - Minimally collected
 *
 * Current persistence: localStorage-first with optional Supabase sync.
 *
 * Ownership: Support & Learning Engineer
 */

import {
  listUserMemories,
  saveUserMemory,
  deleteRole4Record,
} from "@/support/persistence/role4Store";
import { runRole4LocalMigrations } from "@/support/persistence/role4Migrations";
import { ROLE4_COLLECTIONS } from "@/support/schemas/storageKeys";
import {
  ConfidenceLevel,
  MemoryType,
  OutcomeSource,
  PrivacyLevel,
} from "@/support/schemas/supportSchemas";

const MEMORY_KEYS = {
  PREFERENCES: "nb_memory_preferences",
  STRATEGIES: "nb_memory_strategies",
  PATTERNS: "nb_memory_patterns",
  INTERACTION_HISTORY: "nb_memory_interactions",
};

function load(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Phase 6: legacy global (non-user-scoped) helpers are deprecated in favor of
// the Role 4-backed, user-scoped flow. Warnings fire once per helper so legacy
// callers notice the migration path without spamming production logs.
const warnedDeprecations = new Set();

function warnLegacyHelper(name, replacement) {
  if (warnedDeprecations.has(name)) return;
  warnedDeprecations.add(name);
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(
      `[memorySystem] ${name}() is deprecated. ` +
        `Use the Role 4-backed, user-scoped flow instead: ${replacement}.`,
    );
  }
}

/**
 * Store a user preference.
 *
 * @deprecated Phase 6 — legacy global helper. Superseded by the Role 4-backed
 *   user-scoped flow, e.g. `storeUserMemory(userId, { type: MemoryType.PREFERENCE, key, value })`.
 * @param {string} key - Preference key
 * @param {*} value - Preference value
 */
export function storePreference(key, value) {
  warnLegacyHelper("storePreference", "storeUserMemory(userId, { type: MemoryType.PREFERENCE, ... })");
  const preferences = load(MEMORY_KEYS.PREFERENCES, {});
  preferences[key] = {
    value,
    updatedAt: new Date().toISOString(),
  };
  save(MEMORY_KEYS.PREFERENCES, preferences);
}

/**
 * Retrieve a user preference.
 *
 * @deprecated Phase 6 — legacy global helper. Superseded by the Role 4-backed
 *   user-scoped flow, e.g. `getUserMemory(userId, { type: MemoryType.PREFERENCE })`.
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
export function getPreference(key, defaultValue = null) {
  warnLegacyHelper("getPreference", "getUserMemory(userId)");
  const preferences = load(MEMORY_KEYS.PREFERENCES, {});
  return preferences[key]?.value ?? defaultValue;
}

/**
 * Record an intervention strategy outcome.
 *
 * @deprecated Phase 6 — legacy global helper. Superseded by
 *   `recordUserStrategyOutcome(userId, interventionType, successful, context)`,
 *   and by Phase 5 `reflectionEngine` effectiveness signals.
 * @param {string} interventionType
 * @param {boolean} successful
 * @param {object} [context] - Additional context
 */
export function recordStrategyOutcome(interventionType, successful, context = {}) {
  warnLegacyHelper("recordStrategyOutcome", "recordUserStrategyOutcome(userId, interventionType, successful, context)");
  const strategies = load(MEMORY_KEYS.STRATEGIES, []);
  strategies.push({
    interventionType,
    successful,
    context,
    timestamp: new Date().toISOString(),
  });
  // Keep last 200 entries
  if (strategies.length > 200) {
    strategies.splice(0, strategies.length - 200);
  }
  save(MEMORY_KEYS.STRATEGIES, strategies);
}

/**
 * Get effective strategies for a given intervention type.
 *
 * @deprecated Phase 6 — legacy global helper. Superseded by
 *   `getUserStrategyEffectiveness(userId, interventionType)`, and by Phase 5
 *   `reflectionEngine` effectiveness signals.
 * @param {string} interventionType
 * @returns {{ effective: number, total: number, rate: number }}
 */
export function getStrategyEffectiveness(interventionType) {
  warnLegacyHelper("getStrategyEffectiveness", "getUserStrategyEffectiveness(userId, interventionType)");
  const strategies = load(MEMORY_KEYS.STRATEGIES, []);
  const relevant = strategies.filter((s) => s.interventionType === interventionType);
  const effective = relevant.filter((s) => s.successful).length;
  const total = relevant.length;
  return {
    effective,
    total,
    rate: total > 0 ? effective / total : 0.5,
  };
}

/**
 * Store a detected behavioral pattern.
 *
 * @deprecated Phase 6 — legacy global helper. Superseded by the Role 4-backed
 *   user-scoped flow, e.g. `storeUserMemory(userId, { type: MemoryType.LEARNING_PATTERN, key: patternType, value: pattern })`.
 * @param {string} patternType
 * @param {object} pattern
 */
export function storePattern(patternType, pattern) {
  warnLegacyHelper("storePattern", "storeUserMemory(userId, { type: MemoryType.LEARNING_PATTERN, ... })");
  const patterns = load(MEMORY_KEYS.PATTERNS, {});
  if (!patterns[patternType]) {
    patterns[patternType] = [];
  }
  patterns[patternType].push({
    ...pattern,
    timestamp: new Date().toISOString(),
  });
  // Keep last 50 entries per pattern type
  if (patterns[patternType].length > 50) {
    patterns[patternType] = patterns[patternType].slice(-50);
  }
  save(MEMORY_KEYS.PATTERNS, patterns);
}

/**
 * Get stored patterns of a given type.
 *
 * @deprecated Phase 6 — legacy global helper. Superseded by the Role 4-backed
 *   user-scoped flow, e.g. `getUserMemory(userId)`.
 * @param {string} patternType
 * @returns {object[]}
 */
export function getPatterns(patternType) {
  warnLegacyHelper("getPatterns", "getUserMemory(userId)");
  const patterns = load(MEMORY_KEYS.PATTERNS, {});
  return patterns[patternType] || [];
}

/**
 * Clear all legacy global memory data.
 *
 * @deprecated Phase 6 — legacy global helper. Superseded by the Role 4-backed
 *   user-scoped flow, e.g. `clearUserRole4Data(userId)` from `@/support/persistence/role4Store`.
 */
export function clearMemory() {
  warnLegacyHelper("clearMemory", "clearUserRole4Data(userId)");
  Object.values(MEMORY_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

/**
 * Get a summary of all stored legacy global memory.
 *
 * @deprecated Phase 6 — legacy global helper. Superseded by the Role 4-backed
 *   user-scoped flow, e.g. `getUserMemorySummary(userId)`.
 * @returns {object}
 */
export function getMemorySummary() {
  warnLegacyHelper("getMemorySummary", "getUserMemorySummary(userId)");
  return {
    preferences: Object.keys(load(MEMORY_KEYS.PREFERENCES, {})).length,
    strategies: load(MEMORY_KEYS.STRATEGIES, []).length,
    patternTypes: Object.keys(load(MEMORY_KEYS.PATTERNS, {})).length,
  };
}

/**
 * Store a user-scoped memory record using the Role 4 canonical schema.
 * Existing global memory helpers above are retained for backward compatibility.
 *
 * @param {string} userId
 * @param {object} memory
 * @returns {object}
 */
export function storeUserMemory(userId, memory) {
  return saveUserMemory(userId, {
    confidence: ConfidenceLevel.MODERATE,
    privacy: PrivacyLevel.PRIVATE,
    source: OutcomeSource.SYSTEM_INFERENCE,
    ...memory,
    userId,
  });
}

/**
 * List user-scoped Role 4 memory records.
 * @param {string} userId
 * @param {{ type?: string, includeArchived?: boolean }} [filters]
 * @returns {object[]}
 */
export function getUserMemory(userId, filters = {}) {
  const records = listUserMemories(userId);
  return records.filter((record) => {
    if (!filters.includeArchived && record.archivedAt) return false;
    if (filters.type && record.type !== filters.type) return false;
    return true;
  });
}

/**
 * Archive a user-scoped memory record without deleting the underlying evidence.
 * @param {string} userId
 * @param {string} memoryId
 * @returns {object | null}
 */
export function archiveUserMemory(userId, memoryId) {
  const existing = listUserMemories(userId).find((record) => record.id === memoryId);
  if (!existing) return null;
  return saveUserMemory(userId, {
    ...existing,
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Permanently delete a user-scoped memory record.
 * @param {string} userId
 * @param {string} memoryId
 * @returns {boolean}
 */
export function deleteUserMemory(userId, memoryId) {
  return deleteRole4Record(userId, ROLE4_COLLECTIONS.MEMORIES, memoryId);
}

/**
 * Summarize user-scoped memory records.
 * @param {string} userId
 * @returns {object}
 */
export function getUserMemorySummary(userId) {
  const records = listUserMemories(userId);
  const activeRecords = records.filter((record) => !record.archivedAt);
  const byType = activeRecords.reduce((acc, record) => {
    acc[record.type] = (acc[record.type] || 0) + 1;
    return acc;
  }, {});

  return {
    total: records.length,
    active: activeRecords.length,
    archived: records.length - activeRecords.length,
    byType,
  };
}

/**
 * Record a user-scoped strategy outcome in canonical memory form.
 * @param {string} userId
 * @param {string} interventionType
 * @param {boolean} successful
 * @param {object} [context]
 * @returns {object}
 */
export function recordUserStrategyOutcome(userId, interventionType, successful, context = {}) {
  return storeUserMemory(userId, {
    id: `strategy-${interventionType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: successful ? MemoryType.SUCCESSFUL_STRATEGY : MemoryType.INEFFECTIVE_STRATEGY,
    key: interventionType,
    value: {
      interventionType,
      successful,
      context,
    },
    source: OutcomeSource.MODULE_EVENT,
  });
}

/**
 * Get user-scoped strategy effectiveness.
 * Falls back to neutral effectiveness when there is no user-specific history.
 * @param {string} userId
 * @param {string} interventionType
 * @returns {{ effective: number, total: number, rate: number }}
 */
export function getUserStrategyEffectiveness(userId, interventionType) {
  const records = getUserMemory(userId).filter(
    (record) =>
      record.key === interventionType &&
      [MemoryType.SUCCESSFUL_STRATEGY, MemoryType.INEFFECTIVE_STRATEGY].includes(record.type),
  );
  const effective = records.filter((record) => record.type === MemoryType.SUCCESSFUL_STRATEGY).length;
  const total = records.length;
  return {
    effective,
    total,
    rate: total > 0 ? effective / total : 0.5,
  };
}

export function migrateLegacyMemory(userId) {
  return runRole4LocalMigrations({ userId });
}
