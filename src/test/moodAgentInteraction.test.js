import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contextStore } from "@/adaptive/context/contextStore";
import {
  handleInteractionSignal,
  inferMood,
  resetMoodAgent,
} from "@/adaptive/context/moodAgent";

const burstSnapshot = {
  behavior: {
    movementBurst: {
      active: true,
      intensity: 1400,
      distance: 760,
      samples: 18,
      reversals: 9,
    },
  },
};

beforeEach(() => {
  contextStore.reset();
  resetMoodAgent();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("moodAgent interaction burst inference", () => {
  it("infers and persists a stressed mood while a rapid-movement burst is active", () => {
    const result = handleInteractionSignal(burstSnapshot);

    expect(result).not.toBeNull();
    expect(result.value).toBe("stressed");
    expect(result.confidence).toBe(0.55);
    expect(result.sources).toContain("interaction");

    const stored = contextStore.getContext().mood;
    expect(stored.primaryMood).toBe("stressed");
  });

  it("ignores snapshots without a movement-burst signal", () => {
    expect(handleInteractionSignal({ behavior: { movementBurst: null } })).toBeNull();
    expect(handleInteractionSignal(null)).toBeNull();
  });

  it("holds the stressed mood through the burst-easing grace period, then restores baseline", () => {
    vi.useFakeTimers();
    try {
      handleInteractionSignal(burstSnapshot);
      expect(contextStore.getContext().mood.primaryMood).toBe("stressed");

      // Burst ends: the signal must persist so the recommendation stays
      // actionable instead of evaporating within ~1s of the last move.
      expect(
        handleInteractionSignal({ behavior: { movementBurst: { active: false } } }),
      ).toBeNull();
      expect(contextStore.getContext().mood.primaryMood).toBe("stressed");

      // Once the grace cooldown expires, the pre-burst baseline is restored.
      vi.advanceTimersByTime(20_001);
      expect(contextStore.getContext().mood.primaryMood).toBe("neutral");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a new burst during the grace period cancels the pending restore and keeps the signal", () => {
    vi.useFakeTimers();
    try {
      handleInteractionSignal(burstSnapshot);
      handleInteractionSignal({ behavior: { movementBurst: { active: false } } });
      expect(contextStore.getContext().mood.primaryMood).toBe("stressed");

      // New burst re-activates inside the grace window.
      handleInteractionSignal(burstSnapshot);
      vi.advanceTimersByTime(30_000);
      expect(contextStore.getContext().mood.primaryMood).toBe("stressed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats the interaction signal via inferMood with the same priority", () => {
    const result = inferMood({ interaction: burstSnapshot });
    expect(result.value).toBe("stressed");
    expect(result.sources).toContain("interaction");
  });
});