import { describe, expect, it, beforeEach } from "vitest";
import {
  PROGRESS_EVENTS,
  STORAGE_KEYS,
  countStorageKey,
  readPracticeCounts,
  recordPracticeEvent,
  resetPracticeCounts,
} from "../asdProgressStore";

describe("asdProgressStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("records real events only and never fabricates counts", () => {
    expect(readPracticeCounts("learner-a")).toEqual({
      [STORAGE_KEYS.story]: 0,
      [STORAGE_KEYS.emotion]: 0,
      [STORAGE_KEYS.scenario]: 0,
      [STORAGE_KEYS.conversation]: 0,
    });
  });

  it("increments the matching dimension per event", () => {
    recordPracticeEvent("learner-a", PROGRESS_EVENTS.STORY_FINISHED);
    recordPracticeEvent("learner-a", PROGRESS_EVENTS.STORY_FINISHED);
    recordPracticeEvent("learner-a", PROGRESS_EVENTS.EMOTION_SOLVED);
    recordPracticeEvent("learner-a", PROGRESS_EVENTS.SCENARIO_PRACTISED);
    recordPracticeEvent("learner-a", PROGRESS_EVENTS.CONVERSATION_FINISHED);
    const counts = readPracticeCounts("learner-a");
    expect(counts.stories_completed).toBe(2);
    expect(counts.emotions_solved).toBe(1);
    expect(counts.scenarios_practised).toBe(1);
    expect(counts.conversations_completed).toBe(1);
  });

  it("ignores unknown events", () => {
    recordPracticeEvent("learner-a", "something_fake");
    expect(readPracticeCounts("learner-a").stories_completed).toBe(0);
  });

  it("keeps learners separate", () => {
    recordPracticeEvent("learner-a", PROGRESS_EVENTS.STORY_FINISHED);
    recordPracticeEvent("learner-b", PROGRESS_EVENTS.CONVERSATION_FINISHED);
    expect(readPracticeCounts("learner-a").stories_completed).toBe(1);
    expect(readPracticeCounts("learner-a").conversations_completed).toBe(0);
    expect(readPracticeCounts("learner-b").conversations_completed).toBe(1);
  });

  it("uses the learner-scoped storage key", () => {
    expect(countStorageKey("learner-a")).toBe("nb_asd_progress_v1_learner-a");
  });

  it("resets cleanly", () => {
    recordPracticeEvent("learner-a", PROGRESS_EVENTS.STORY_FINISHED);
    resetPracticeCounts("learner-a");
    expect(readPracticeCounts("learner-a").stories_completed).toBe(0);
  });
});