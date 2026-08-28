import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import AdaptiveUIRuntime from "../AdaptiveUIRuntime.jsx";
import { AdaptiveRuntimeContext } from "../adaptiveRuntimeContext.jsx";
import { buildModuleContext } from "@/support/framework/moduleContextAdapter";
import { decide } from "@backend/adaptive/engine/adaptiveEngine";

function Harness({ runtimeValue, children = <div>content</div> }) {
  return (
    <AdaptiveRuntimeContext.Provider value={runtimeValue}>
      <AdaptiveUIRuntime>{children}</AdaptiveUIRuntime>
    </AdaptiveRuntimeContext.Provider>
  );
}

describe("AdaptiveUIRuntime Start Support (real InterventionModal)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the real modal and the Guided Breathing countdown genuinely starts", () => {
    vi.useFakeTimers();

    const outcome = decide(
      {
        contextSnapshot: {
          timestamp: new Date().toISOString(),
          mood: { primaryMood: "anxious", confidence: 0.9 },
          behavior: { taskSwitchFrequency: 0.05 },
          activity: { activity: "breathing_practice" },
        },
        moduleContext: buildModuleContext("anxiety.hub"),
      },
      { now: () => 1750000000000 },
    );

    render(
      <Harness
        runtimeValue={{
          plan: outcome.plan,
          trace: null,
          enabled: true,
          active: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /start support/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Guided Breathing" })).toBeInTheDocument();

    // autoStart has set running=true: orb shows the phase, not "Ready"
    expect(screen.getByText("Inhale")).toBeInTheDocument();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();

    // Breaths advance over real time
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText("2s")).toBeInTheDocument();
  });
});