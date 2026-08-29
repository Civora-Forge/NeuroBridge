/**
 * asdProgressStore.js — lightweight, honest practice tracking for the ASD hub.
 *
 * Records only real "practice events" that already happen in the features (a
 * story finished, an emotion solved, a scenario practised, a conversation
 * completed). It never fabricates progress — if a user has not done something,
 * nothing is counted. The hub uses these counts to show non-competitive,
 * encouraging progress on feature cards.
 *
 * Storage is per learner (ward) id and local to the device, matching the
 * existing persistence model used by the ASD features.
 *
 * Ownership: ASD Experience Engineer
 */

const STORAGE_PREFIX = "nb_asd_progress_v1_";

export const PROGRESS_EVENTS = Object.freeze({
  STORY_FINISHED: "story_finished",
  EMOTION_SOLVED: "emotion_solved",
  SCENARIO_PRACTISED: "scenario_practised",
  CONVERSATION_FINISHED: "conversation_finished",
});

export const STORAGE_KEYS = Object.freeze({
  story: "stories_completed",
  emotion: "emotions_solved",
  scenario: "scenarios_practised",
  conversation: "conversations_completed",
});

function storageKey(learnerId) {
  return `${STORAGE_PREFIX}${learnerId ?? "anon"}`;
}

function readCounts(learnerId) {
  try {
    const raw = window.localStorage.getItem(storageKey(learnerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCounts(learnerId, counts) {
  try {
    window.localStorage.setItem(storageKey(learnerId), JSON.stringify(counts));
  } catch {
    // ignore storage failures — progress still works for the session
  }
}

function bump(learnerId, counts, dimension) {
  const base = readCounts(learnerId) ?? {};
  const value = Number.isFinite(base[dimension]) ? base[dimension] : 0;
  writeCounts(learnerId, { ...base, [dimension]: value + 1 });
  if (counts) counts[dimension] = value + 1;
}

/**
 * Record one practice event. Use the PROGRESS_EVENTS constants.
 * @returns {void}
 */
export function recordPracticeEvent(learnerId, event) {
  switch (event) {
    case PROGRESS_EVENTS.STORY_FINISHED:
      bump(learnerId, null, STORAGE_KEYS.story);
      break;
    case PROGRESS_EVENTS.EMOTION_SOLVED:
      bump(learnerId, null, STORAGE_KEYS.emotion);
      break;
    case PROGRESS_EVENTS.SCENARIO_PRACTISED:
      bump(learnerId, null, STORAGE_KEYS.scenario);
      break;
    case PROGRESS_EVENTS.CONVERSATION_FINISHED:
      bump(learnerId, null, STORAGE_KEYS.conversation);
      break;
    default:
      // unknown events are ignored
      break;
  }
}

/**
 * Read the practice counts for a learner.
 * @returns {{ stories_completed: number, emotions_solved: number,
 *   scenarios_practised: number, conversations_completed: number }}
 */
export function readPracticeCounts(learnerId) {
  const base = readCounts(learnerId) ?? {};
  return {
    [STORAGE_KEYS.story]: Number.isFinite(base[STORAGE_KEYS.story]) ? base[STORAGE_KEYS.story] : 0,
    [STORAGE_KEYS.emotion]: Number.isFinite(base[STORAGE_KEYS.emotion]) ? base[STORAGE_KEYS.emotion] : 0,
    [STORAGE_KEYS.scenario]: Number.isFinite(base[STORAGE_KEYS.scenario]) ? base[STORAGE_KEYS.scenario] : 0,
    [STORAGE_KEYS.conversation]: Number.isFinite(base[STORAGE_KEYS.conversation]) ? base[STORAGE_KEYS.conversation] : 0,
  };
}

/** Reset a learner's ASD practice counts (mainly for tests/guardian reset). */
export function resetPracticeCounts(learnerId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(learnerId));
  } catch {
    // ignore
  }
}

/** Exposed for tests — the exact storage key for a learner. */
export function countStorageKey(learnerId) {
  return storageKey(learnerId);
}