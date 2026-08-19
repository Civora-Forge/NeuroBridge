/**
 * anxietyPersonalization.js — State- and pattern-specific outcome learning store
 *
 * Responsibilities:
 *   - Stores outcome records per user.
 *   - Computes state-specific adaptive score bonuses and penalties for candidate ranking.
 *   - Strictly indexes learned effectiveness by (userId, interventionId, patternType).
 *   - Transparent, explainable scoring (no black-box machine learning).
 */

const OUTCOMES_STORAGE_PREFIX = "nb_anxiety_outcomes_";

// In-memory fallback for testing environments without persistent window.localStorage
const memoryStore = new Map();

function getStorageKey(userId = "anon") {
  return `${OUTCOMES_STORAGE_PREFIX}${userId}`;
}

export function loadUserOutcomes(userId = "anon") {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(getStorageKey(userId));
      return raw ? JSON.parse(raw) : [];
    }
  } catch {
    // fallback to memory
  }
  return memoryStore.get(getStorageKey(userId)) || [];
}

export function saveUserOutcomes(userId = "anon", outcomes = []) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(getStorageKey(userId), JSON.stringify(outcomes));
    }
  } catch {
    // fallback to memory
  }
  memoryStore.set(getStorageKey(userId), outcomes);
}

/**
 * Records an outcome into the user's personalization history
 *
 * @param {object} outcomeRecord
 * @param {string} [userId]
 * @returns {object[]} Updated outcome history
 */
export function recordOutcome(outcomeRecord, userId = "anon") {
  if (!outcomeRecord) return loadUserOutcomes(userId);

  const existing = loadUserOutcomes(userId);
  const updated = [outcomeRecord, ...existing].slice(0, 100);
  saveUserOutcomes(userId, updated);
  return updated;
}

/**
 * Computes a state- and pattern-specific adaptive modifier for a candidate
 *
 * @param {string} interventionId
 * @param {string} patternType
 * @param {string} [userId]
 * @param {Array} [customHistory] Optional override of history array (e.g. for testing)
 * @returns {{ bonus: number, penalty: number, netModifier: number, count: number, avgReduction: number, rationale: string|null }}
 */
export function getPersonalizedModifier(interventionId, patternType, userId = "anon", customHistory = null) {
  const history = Array.isArray(customHistory) ? customHistory : loadUserOutcomes(userId);

  // Strictly filter for matching interventionId AND matching patternType
  const matching = history.filter(
    (record) => record.interventionId === interventionId && record.patternType === patternType
  );

  if (matching.length === 0) {
    return {
      bonus: 0,
      penalty: 0,
      netModifier: 0,
      count: 0,
      avgReduction: 0,
      rationale: null,
    };
  }

  const completed = matching.filter((r) => r.completed && !r.abandoned);
  const abandoned = matching.filter((r) => r.abandoned);
  const totalDeltas = completed.reduce((sum, r) => sum + Number(r.delta || 0), 0);
  const avgReduction = completed.length > 0 ? Number((totalDeltas / completed.length).toFixed(2)) : 0;
  const completionRate = matching.length > 0 ? completed.length / matching.length : 0;

  let bonus = 0;
  let penalty = 0;

  // Positive reinforcement: high average severity reduction + good completion
  if (avgReduction >= 1.5 && completed.length >= 1) {
    // Scales between 0.05 and 0.25
    bonus = Math.min(0.25, Number((avgReduction * 0.06 * completionRate).toFixed(2)));
  }

  // Negative penalty: repeated abandonment or zero/negative reduction
  if (abandoned.length >= 2 || (matching.length >= 2 && avgReduction <= 0.3)) {
    const failureCount = abandoned.length + matching.filter((r) => r.delta <= 0).length;
    penalty = Math.min(0.25, Number((failureCount * 0.08).toFixed(2)));
  }

  const netModifier = Number((bonus - penalty).toFixed(2));

  let rationale = null;
  if (bonus > 0 && penalty === 0) {
    rationale = `Previously produced an average reduction of ${avgReduction} points across ${completed.length} similar ${patternType.toLowerCase().replace(/_/g, " ")} episodes (+${bonus} personalized weight).`;
  } else if (penalty > 0) {
    rationale = `Previous sessions for this pattern showed low completion or minimal relief (-${penalty} personalized adjustment).`;
  }

  return {
    bonus,
    penalty,
    netModifier,
    count: matching.length,
    avgReduction,
    rationale,
  };
}

/**
 * Clears personalization history for a given user
 */
export function clearUserOutcomes(userId = "anon") {
  saveUserOutcomes(userId, []);
  memoryStore.delete(getStorageKey(userId));
}
