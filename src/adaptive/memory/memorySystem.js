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

/**
 * Store a user preference.
 * @param {string} key - Preference key
 * @param {*} value - Preference value
 */
export function storePreference(key, value) {
  const preferences = load(MEMORY_KEYS.PREFERENCES, {});
  preferences[key] = {
    value,
    updatedAt: new Date().toISOString(),
  };
  save(MEMORY_KEYS.PREFERENCES, preferences);
}

/**
 * Retrieve a user preference.
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
export function getPreference(key, defaultValue = null) {
  const preferences = load(MEMORY_KEYS.PREFERENCES, {});
  return preferences[key]?.value ?? defaultValue;
}

/**
 * Record an intervention strategy outcome.
 * @param {string} interventionType
 * @param {boolean} successful
 * @param {object} [context] - Additional context
 */
export function recordStrategyOutcome(interventionType, successful, context = {}) {
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
 * @param {string} interventionType
 * @returns {{ effective: number, total: number, rate: number }}
 */
export function getStrategyEffectiveness(interventionType) {
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
 * @param {string} patternType
 * @param {object} pattern
 */
export function storePattern(patternType, pattern) {
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
 * @param {string} patternType
 * @returns {object[]}
 */
export function getPatterns(patternType) {
  const patterns = load(MEMORY_KEYS.PATTERNS, {});
  return patterns[patternType] || [];
}

/**
 * Clear all memory data.
 */
export function clearMemory() {
  Object.values(MEMORY_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

/**
 * Get a summary of all stored memory.
 * @returns {object}
 */
export function getMemorySummary() {
  return {
    preferences: Object.keys(load(MEMORY_KEYS.PREFERENCES, {})).length,
    strategies: load(MEMORY_KEYS.STRATEGIES, []).length,
    patternTypes: Object.keys(load(MEMORY_KEYS.PATTERNS, {})).length,
  };
}
