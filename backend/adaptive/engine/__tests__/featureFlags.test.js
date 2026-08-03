import { describe, it, expect, afterEach } from "vitest";
import {
  isAdaptiveRuntimeEnabled,
  isUIExecutionEnabled,
  configureAdaptiveFlags,
  resetAdaptiveFlags,
} from "../featureFlags.js";

afterEach(() => {
  resetAdaptiveFlags();
});

describe("feature flags", () => {
  it("defaults both switches OFF", () => {
    expect(isAdaptiveRuntimeEnabled()).toBe(false);
    expect(isUIExecutionEnabled()).toBe(false);
  });

  it("runtime can be enabled without enabling UI execution", () => {
    const previous = configureAdaptiveFlags({ runtime: true });
    expect(previous).toEqual({ runtime: false, uiExecution: false });
    expect(isAdaptiveRuntimeEnabled()).toBe(true);
    expect(isUIExecutionEnabled()).toBe(false);
  });

  it("UI execution can be enabled independently", () => {
    configureAdaptiveFlags({ uiExecution: true });
    expect(isUIExecutionEnabled()).toBe(true);
    expect(isAdaptiveRuntimeEnabled()).toBe(false);
  });

  it("configureAdaptiveFlags ignores non-boolean overrides", () => {
    configureAdaptiveFlags({ runtime: "yes", uiExecution: 1 });
    expect(isAdaptiveRuntimeEnabled()).toBe(false);
    expect(isUIExecutionEnabled()).toBe(false);
  });

  it("resetAdaptiveFlags restores both OFF", () => {
    configureAdaptiveFlags({ runtime: true, uiExecution: true });
    resetAdaptiveFlags();
    expect(isAdaptiveRuntimeEnabled()).toBe(false);
    expect(isUIExecutionEnabled()).toBe(false);
  });
});
