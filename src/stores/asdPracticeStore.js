/**
 * asdPracticeStore.js — live in-memory progress layer over the existing
 * practice store (@/components/asd/ui/asdProgressStore), which stays the
 * durable localStorage source of truth.
 *
 * This gives the ASD hub and every feature a shared, reactive progress state:
 * a completion recorded by one component is seen immediately by every other
 * component reading the same learner — no refresh, no remount, no polling.
 *
 * Write path on a completion event:
 *   1. optimistic — update the in-memory counts first (instant UI),
 *   2. persist    — write through the existing recordPracticeEvent,
 *   3. reconcile  — re-read the persisted value so memory always matches disk.
 *
 * Ownership: ASD Experience Engineer
 */

import { create } from "zustand";
import {
  PROGRESS_EVENTS,
  STORAGE_KEYS,
  readPracticeCounts,
  recordPracticeEvent,
  resetPracticeCounts,
} from "@/components/asd/ui/asdProgressStore";

const PROGRESS_STORAGE_PREFIX = "nb_asd_progress_v1_";

const EVENT_DIMENSION = {
  [PROGRESS_EVENTS.STORY_FINISHED]: STORAGE_KEYS.story,
  [PROGRESS_EVENTS.EMOTION_SOLVED]: STORAGE_KEYS.emotion,
  [PROGRESS_EVENTS.SCENARIO_PRACTISED]: STORAGE_KEYS.scenario,
  [PROGRESS_EVENTS.CONVERSATION_FINISHED]: STORAGE_KEYS.conversation,
};

function bumpCounts(counts, event) {
  const dimension = EVENT_DIMENSION[event];
  if (!dimension) return counts;
  return { ...counts, [dimension]: (counts[dimension] ?? 0) + 1 };
}

export const useAsdPracticeStore = create((set, get) => ({
  countsByLearner: {},

  ensure: (learnerId) => {
    if (!learnerId) return;
    const { countsByLearner } = get();
    if (countsByLearner[learnerId]) return;
    set({ countsByLearner: { ...countsByLearner, [learnerId]: readPracticeCounts(learnerId) } });
  },

  recordEvent: (learnerId, event) => {
    if (!learnerId) return;
    get().ensure(learnerId);
    const current = get().countsByLearner[learnerId];
    const optimistic = bumpCounts(current, event);
    set({ countsByLearner: { ...get().countsByLearner, [learnerId]: optimistic } });
    recordPracticeEvent(learnerId, event);
    set({ countsByLearner: { ...get().countsByLearner, [learnerId]: readPracticeCounts(learnerId) } });
  },

  reset: (learnerId) => {
    if (!learnerId) return;
    resetPracticeCounts(learnerId);
    set({ countsByLearner: { ...get().countsByLearner, [learnerId]: readPracticeCounts(learnerId) } });
  },

  resync: (learnerId) => {
    if (!learnerId) return;
    set({ countsByLearner: { ...get().countsByLearner, [learnerId]: readPracticeCounts(learnerId) } });
  },

  _clear: () => set({ countsByLearner: {} }),
}));

/** Keep in-memory state in sync when another tab updates progress storage. */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(PROGRESS_STORAGE_PREFIX)) return;
    const learnerId = event.key.slice(PROGRESS_STORAGE_PREFIX.length);
    useAsdPracticeStore.getState().resync(learnerId);
  });
}

export default useAsdPracticeStore;