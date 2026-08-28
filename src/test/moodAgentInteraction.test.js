import { beforeEach, describe, expect, it } from "vitest";
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

  it("restores the pre-burst mood once the burst ends", () => {
    handleInteractionSignal(burstSnapshot);
    expect(contextStore.getContext().mood.primaryMood).toBe("stressed");

    const restored = handleInteractionSignal({
      behavior: { movementBurst: { active: false } },
    });
    expect(restored).not.toBeNull();
    expect(restored.value).toBe("neutral");
    expect(contextStore.getContext().mood.primaryMood).toBe("neutral");
  });

  it("treats the interaction signal via inferMood with the same priority", () => {
    const result = inferMood({ interaction: burstSnapshot });
    expect(result.value).toBe("stressed");
    expect(result.sources).toContain("interaction");
  });
});