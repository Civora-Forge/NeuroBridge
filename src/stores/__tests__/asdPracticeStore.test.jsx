import { describe, expect, it, beforeEach } from "vitest";
import useAsdPracticeStore from "@/stores/asdPracticeStore";
import {
  PROGRESS_EVENTS,
  readPracticeCounts,
} from "@/components/asd/ui/asdProgressStore";

describe("asdPracticeStore — live progress layer over the existing store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAsdPracticeStore.getState()._clear();
  });

  it("records optimistically and reconciles with persisted storage", () => {
    useAsdPracticeStore.getState().recordEvent("learner-a", PROGRESS_EVENTS.STORY_FINISHED);
    expect(useAsdPracticeStore.getState().countsByLearner["learner-a"].stories_completed).toBe(1);
    expect(readPracticeCounts("learner-a").stories_completed).toBe(1);
  });

  it("increments the matching dimension per event", () => {
    const { recordEvent } = useAsdPracticeStore.getState();
    recordEvent("learner-a", PROGRESS_EVENTS.STORY_FINISHED);
    recordEvent("learner-a", PROGRESS_EVENTS.STORY_FINISHED);
    recordEvent("learner-a", PROGRESS_EVENTS.EMOTION_SOLVED);
    const counts = useAsdPracticeStore.getState().countsByLearner["learner-a"];
    expect(counts.stories_completed).toBe(2);
    expect(counts.emotions_solved).toBe(1);
    expect(counts.scenarios_practised).toBe(0);
  });

  it("keeps learners separate in live state", () => {
    const { recordEvent } = useAsdPracticeStore.getState();
    recordEvent("learner-a", PROGRESS_EVENTS.STORY_FINISHED);
    recordEvent("learner-b", PROGRESS_EVENTS.CONVERSATION_FINISHED);
    const a = useAsdPracticeStore.getState().countsByLearner["learner-a"];
    const b = useAsdPracticeStore.getState().countsByLearner["learner-b"];
    expect(a.stories_completed).toBe(1);
    expect(a.conversations_completed).toBe(0);
    expect(b.conversations_completed).toBe(1);
  });

  it("ignores unknown events", () => {
    useAsdPracticeStore.getState().recordEvent("learner-a", "something_fake");
    expect(useAsdPracticeStore.getState().countsByLearner["learner-a"].stories_completed).toBe(0);
    expect(readPracticeCounts("learner-a").stories_completed).toBe(0);
  });

  it("reset clears both reactive and persisted counts", () => {
    useAsdPracticeStore.getState().recordEvent("learner-a", PROGRESS_EVENTS.STORY_FINISHED);
    useAsdPracticeStore.getState().reset("learner-a");
    expect(useAsdPracticeStore.getState().countsByLearner["learner-a"].stories_completed).toBe(0);
    expect(readPracticeCounts("learner-a").stories_completed).toBe(0);
  });
});