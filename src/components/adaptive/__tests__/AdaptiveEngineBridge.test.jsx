import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import AdaptiveEngineBridge from "../AdaptiveEngineBridge.jsx";
import {
  configureAdaptiveFlags,
  resetAdaptiveFlags,
} from "@backend/adaptive/engine/featureFlags";

const { decideMock, buildRole4SignalsMock } = vi.hoisted(() => ({
  decideMock: vi.fn(),
  buildRole4SignalsMock: vi.fn(),
}));

vi.mock("@backend/adaptive/engine/adaptiveEngine", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, decide: decideMock };
});

vi.mock("@backend/adaptive/engine/role4Signals", () => ({
  buildRole4Signals: buildRole4SignalsMock,
}));

const USER = "bridge-user-a";

const SNAPSHOT = {
  timestamp: "2026-08-01T00:00:00.000Z",
  mood: { primaryMood: "overwhelmed", confidence: 0.9 },
  behavior: { taskSwitchFrequency: 1.0 },
  conversation: { urgency: "high" },
};

describe("AdaptiveEngineBridge (Phase 4 in-app wiring)", () => {
  beforeEach(() => {
    resetAdaptiveFlags();
    decideMock.mockClear();
    buildRole4SignalsMock.mockClear();
    decideMock.mockImplementation(() => ({
      plan: {
        decisionTraceId: "trace-bridge-1",
        timestamp: 1,
        situation: "test",
        primaryNeed: "test",
        reasoning: [],
        actions: [],
        priorityOrder: [],
        overallConfidence: 0.5,
        sources: [],
      },
      trace: { decisionId: "trace-bridge-1" },
    }));
    buildRole4SignalsMock.mockReturnValue({ interventions: [], outcomes: [], memories: [] });
  });

  afterEach(() => {
    resetAdaptiveFlags();
  });

  it("renders nothing and stays inert while the runtime flag is OFF", () => {
    const { container } = render(
      <AdaptiveEngineBridge moduleId="focus" getSnapshot={() => SNAPSHOT} userId={USER} />,
    );

    expect(container.childElementCount).toBe(0);
    expect(decideMock).not.toHaveBeenCalled();
    expect(buildRole4SignalsMock).not.toHaveBeenCalled();
  });

  it("runs decide() in-app when the runtime flag is ON, with the live snapshot and Role 4 signals", async () => {
    buildRole4SignalsMock.mockReturnValue({
      interventions: [{ id: "int-live" }],
      outcomes: [],
      memories: [],
    });
    configureAdaptiveFlags({ runtime: true });

    const { container } = render(
      <AdaptiveEngineBridge
        moduleId="support.focus_session"
        getSnapshot={() => SNAPSHOT}
        userId={USER}
      />,
    );

    await waitFor(() => expect(decideMock).toHaveBeenCalled());
    expect(container.childElementCount).toBe(0);

    const input = decideMock.mock.calls[0][0];
    expect(input.contextSnapshot).toBe(SNAPSHOT);
    expect(input.role4Signals).toEqual({
      interventions: [{ id: "int-live" }],
      outcomes: [],
      memories: [],
    });
    expect(input.moduleContext?.moduleId).toBe("support.focus_session");
    expect(buildRole4SignalsMock).toHaveBeenCalledWith(USER);
  });

  it("honors an explicit `enabled` override from the bridge", async () => {
    configureAdaptiveFlags({ runtime: true });

    render(
      <AdaptiveEngineBridge
        moduleId="focus"
        getSnapshot={() => SNAPSHOT}
        userId={USER}
        enabled={false}
      />,
    );
    expect(decideMock).not.toHaveBeenCalled();

    resetAdaptiveFlags();
    decideMock.mockClear();

    render(
      <AdaptiveEngineBridge
        moduleId="focus"
        getSnapshot={() => SNAPSHOT}
        userId={USER}
        enabled={true}
      />,
    );
    await waitFor(() => expect(decideMock).toHaveBeenCalled());
  });
});
