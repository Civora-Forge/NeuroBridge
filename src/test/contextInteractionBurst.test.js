import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getInteractionSnapshot,
  resetInteractionTracker,
  startInteractionTracking,
  stopInteractionTracking,
} from "@/adaptive/context/contextInteractionTracker";
import { contextEventBus } from "@/adaptive/context/events/contextEventBus";
import { ContextEvents } from "@/adaptive/context/events/contextEvents";

function firePointerMove(x, y) {
  window.dispatchEvent(
    new MouseEvent("pointermove", { clientX: x, clientY: y }),
  );
}

// Rapid back-and-forth mouse shaking: two alternating samples per cycle.
function shakeMouse(startX, cycles) {
  for (let i = 0; i < cycles; i += 1) {
    firePointerMove(startX + 60, 400);
    vi.advanceTimersByTime(30);
    firePointerMove(startX, 400);
    vi.advanceTimersByTime(30);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  resetInteractionTracker();
  startInteractionTracking();
});

afterEach(() => {
  stopInteractionTracking();
  resetInteractionTracker();
  vi.useRealTimers();
});

describe("contextInteractionTracker movement burst", () => {
  it("reports a rapid pointer-movement burst as a behavior signal", () => {
    shakeMouse(120, 24);

    const snapshot = getInteractionSnapshot();
    const burst = snapshot.behavior.movementBurst;

    expect(burst).not.toBeNull();
    expect(burst.active).toBe(true);
    expect(burst.reversals).toBeGreaterThanOrEqual(4);
    expect(burst.distance).toBeGreaterThanOrEqual(420);
    expect(snapshot.behavior.movementIntensity).toBeGreaterThan(0);
    expect(snapshot.behavior.confidence).toBe(0.7);
  });

  it("does not flag calm mouse movement as a burst", () => {
    for (let i = 0; i < 30; i += 1) {
      firePointerMove(200 + i * 4, 400);
      vi.advanceTimersByTime(30);
    }

    const snapshot = getInteractionSnapshot();
    expect(snapshot.behavior.movementBurst?.active ?? false).toBe(false);
  });

  it("emits an INTERACTION_UPDATED event when a burst activates", () => {
    const emitted = [];
    const unsubscribe = contextEventBus.subscribe(
      ContextEvents.INTERACTION_UPDATED,
      (payload) => {
        emitted.push(payload.reason);
      },
    );

    try {
      shakeMouse(80, 24);
    } finally {
      unsubscribe();
    }

    expect(emitted).toContain("movement_burst");
  });
});