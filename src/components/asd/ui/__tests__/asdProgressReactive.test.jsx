import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useASDPracticeCounts } from "../useASDVisualStyle";
import { PROGRESS_EVENTS, readPracticeCounts } from "../asdProgressStore";
import useAsdPracticeStore from "@/stores/asdPracticeStore";

describe("ASD progress reactivity (hub sees feature completions without a refresh)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAsdPracticeStore.getState()._clear();
  });

  it("a completion recorded by a feature is seen immediately by the hub subscriber", () => {
    const feature = renderHook(() => useASDPracticeCounts("learner-a"));
    const hub = renderHook(() => useASDPracticeCounts("learner-a"));

    expect(hub.result.current.counts.stories_completed).toBe(0);

    act(() => {
      feature.result.current.recordEvent(PROGRESS_EVENTS.STORY_FINISHED);
    });

    expect(feature.result.current.counts.stories_completed).toBe(1);
    expect(hub.result.current.counts.stories_completed).toBe(1);
  });

  it("live state and persisted storage agree after recording", () => {
    const { result } = renderHook(() => useASDPracticeCounts("learner-a"));
    act(() => {
      result.current.recordEvent(PROGRESS_EVENTS.SCENARIO_PRACTISED);
    });
    expect(readPracticeCounts("learner-a").scenarios_practised).toBe(1);
    expect(result.current.counts.scenarios_practised).toBe(1);
  });

  it("does not leak completions across learners", () => {
    const featureA = renderHook(() => useASDPracticeCounts("learner-a"));
    const hubForB = renderHook(() => useASDPracticeCounts("learner-b"));

    act(() => {
      featureA.result.current.recordEvent(PROGRESS_EVENTS.EMOTION_SOLVED);
    });

    expect(featureA.result.current.counts.emotions_solved).toBe(1);
    expect(hubForB.result.current.counts.emotions_solved).toBe(0);
  });
});