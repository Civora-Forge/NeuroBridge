/**
 * anxietyPersonalization.js — State- and pattern-specific outcome learning and dismissal sensitivity store
 *
 * Responsibilities:
 *   - Stores outcome records per user.
 *   - Computes state-specific adaptive score bonuses and penalties for candidate ranking.
 *   - Tracks prompt dismissals to reduce prompt frequency when user prefers autonomy.
 *   - Strictly indexes learned effectiveness by (userId, interventionId, patternType).
 *   - Transparent, explainable scoring.
 */

const OUTCOMES_STORAGE_PREFIX = "nb_anxiety_outcomes_";
const DISMISSALS_STORAGE_PREFIX = "nb_anxiety_dismissals_";

const memoryStore = new Map();

function getStorageKey(prefix, userId = "anon") {
  return `${prefix}${userId}`;
}

export function loadUserOutcomes(userId = "anon") {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(getStorageKey(OUTCOMES_STORAGE_PREFIX, userId));
      return raw ? JSON.parse(raw) : [];
    }
  } catch {
    // fallback to memory
  }
  return memoryStore.get(getStorageKey(OUTCOMES_STORAGE_PREFIX, userId)) || [];
}

export function saveUserOutcomes(userId = "anon", outcomes = []) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(getStorageKey(OUTCOMES_STORAGE_PREFIX, userId), JSON.stringify(outcomes));
    }
  } catch {
    // fallback to memory
  }
  memoryStore.set(getStorageKey(OUTCOMES_STORAGE_PREFIX, userId), outcomes);
}

export function recordOutcome(outcomeRecord, userId = "anon") {
  if (!outcomeRecord) return loadUserOutcomes(userId);

  const existing = loadUserOutcomes(userId);
  const updated = [outcomeRecord, ...existing].slice(0, 100);
  saveUserOutcomes(userId, updated);
  return updated;
}

/**
 * Records a prompt dismissal (user tapped "Not now" / "Keep working")
 */
export function recordDismissal(userId = "anon", patternType = "GENERAL_ANXIETY") {
  const key = getStorageKey(DISMISSALS_STORAGE_PREFIX, userId);
  let dismissals = [];
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      dismissals = JSON.parse(window.localStorage.getItem(key) || "[]");
    } else {
      dismissals = memoryStore.get(key) || [];
    }
  } catch {
    dismissals = [];
  }

  const updated = [{ timestamp: new Date().toISOString(), patternType }, ...dismissals].slice(0, 20);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(updated));
    }
  } catch {}
  memoryStore.set(key, updated);
}

/**
 * Gets the recent dismissal count within the last 2 hours
 */
export function getRecentDismissalCount(userId = "anon") {
  const key = getStorageKey(DISMISSALS_STORAGE_PREFIX, userId);
  let dismissals = [];
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      dismissals = JSON.parse(window.localStorage.getItem(key) || "[]");
    } else {
      dismissals = memoryStore.get(key) || [];
    }
  } catch {
    dismissals = [];
  }

  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  return dismissals.filter((d) => new Date(d.timestamp).getTime() >= twoHoursAgo).length;
}

/**
 * Computes a state- and pattern-specific adaptive modifier for a candidate
 *
 * @param {string} interventionId
 * @param {string} patternType
 * @param {string} [userId="anon"]
 * @param {Array} [customHistory=null] Optional override of history array (e.g. for testing)
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
    rationale = `Previously produced positive relief (${avgReduction > 0 ? `+${avgReduction}` : avgReduction} reduction) across ${completed.length} similar ${patternType.toLowerCase().replace(/_/g, " ")} sessions (+${bonus} personalized weight).`;
  } else if (penalty > 0) {
    rationale = `Previous sessions for this pattern showed minimal relief or abandonment (-${penalty} personalized adjustment).`;
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

export function clearUserOutcomes(userId = "anon") {
  saveUserOutcomes(userId, []);
  memoryStore.delete(getStorageKey(OUTCOMES_STORAGE_PREFIX, userId));
  memoryStore.delete(getStorageKey(DISMISSALS_STORAGE_PREFIX, userId));
}
