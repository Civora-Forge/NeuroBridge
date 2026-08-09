import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAdaptiveBehavioralEngine } from "../useAdaptiveBehavioralEngine.js";
import {
  configureAdaptiveFlags,
  resetAdaptiveFlags,
} from "@backend/adaptive/engine/featureFlags";

vi.mock("@backend/adaptive/engine/adaptiveEngine", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, decide: vi.fn(actual.decide) };
});

import { decide } from "@backend/adaptive/engine/adaptiveEngine";

const USER = "regression-loop-user";

function buildCommunicationSnapshot({ session, user }) {
  return {
    screen: "communication.simulator",
    session: session
      ? { domain: session.domain ?? null, difficulty: session.difficulty, status: session.status }
      : null,
    userProfile: {
      accessibility: user?.accessibility ?? null,
      disorders: Array.isArray(user?.disorders) ? user.disorders : [],
    },
  };
}

function useHarness({ user }) {
  return useAdaptiveBehavioralEngine({
    moduleId: "communication.simulator",
    getSnapshot: () => buildCommunicationSnapshot({ session: null, user }),
    userId: USER,
    userPreferences: user?.accessibility
      ? { accessibility: user.accessibility }
      : undefined,
  });
}

describe("regression: /communication freeze (unstable deps render storm)", () => {
  beforeEach(() => {
    resetAdaptiveFlags();
    configureAdaptiveFlags({ runtime: true });
    decide.mockClear();
  });

  afterEach(() => {
    resetAdaptiveFlags();
  });

  it(
    "decide() must not re-fire in an unbounded loop when userPreferences is an inline object and getSnapshot returns a fresh snapshot",
    async () => {
      const { result, rerender } = renderHook(
        ({ user }) => useHarness({ user }),
        { initialProps: { user: null } },
      );

      await waitFor(() => expect(decide).toHaveBeenCalled());
      const callsAfterFirstDecision = () => decide.mock.calls.length;

      const settled = async () => {
        for (let i = 0; i < 50; i += 1) {
          await act(async () => {
            await Promise.resolve();
          });
        }
      };

      const user = {
        id: USER,
        accessibility: { reduceMotion: false, screenReader: false },
        disorders: ["anxiety", "asd"],
      };

      await act(async () => {
        rerender({ user });
      });
      await settled();

      const extraCalls = callsAfterFirstDecision() - 1;
      expect(extraCalls).toBeLessThanOrEqual(5);
      expect(result.current.plan).not.toBeNull();
    },
    8000,
  );
});
