import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getInteractionSnapshot,
  recordNavigationSignal,
  resetInteractionTracker,
} from "@/adaptive/context/contextInteractionTracker";

beforeEach(() => {
  resetInteractionTracker();
});

afterEach(() => {
  resetInteractionTracker();
});

describe("contextInteractionTracker task-switch accounting", () => {
  it("does not count the fresh-load landing page as a task switch", () => {
    recordNavigationSignal("/");

    expect(getInteractionSnapshot().behavior.taskSwitchFrequency).toBe(0);
  });

  it("counts a first real transition between distinct modules as switching", () => {
    recordNavigationSignal("/dashboard");
    recordNavigationSignal("/reader");

    expect(getInteractionSnapshot().behavior.taskSwitchFrequency).toBe(0.2);
  });

  it("counts a genuine return to the landing module as a transition", () => {
    recordNavigationSignal("/");
    recordNavigationSignal("/reader");
    console.log(
      "DEBUG after /,/reader:",
      JSON.stringify(getInteractionSnapshot().behavior),
    );
    recordNavigationSignal("/");
    console.log(
      "DEBUG after /,/reader,/:",
      JSON.stringify(getInteractionSnapshot().behavior),
    );

    expect(getInteractionSnapshot().behavior.taskSwitchFrequency).toBe(0.4);
  });

  it("never over-counts a window of landings that only repeat one module", () => {
    recordNavigationSignal("/reader");
    recordNavigationSignal("/reader");

    expect(getInteractionSnapshot().behavior.taskSwitchFrequency).toBe(0);
  });
});