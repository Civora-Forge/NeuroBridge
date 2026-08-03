import { describe, it, expect, afterEach } from "vitest";
import {
  isAdaptiveRuntimeEnabled,
  isUIExecutionEnabled,
  isReflectionEnabled,
  configureAdaptiveFlags,
  resetAdaptiveFlags,
} from "../featureFlags.js";

afterEach(() => {
  resetAdaptiveFlags();
});

describe("feature flags", () => {
  it("defaults all switches OFF", () => {
    expect(isAdaptiveRuntimeEnabled()).toBe(false);
    expect(isUIExecutionEnabled()).toBe(false);
    expect(isReflectionEnabled()).toBe(false);
  });

  it("runtime can be enabled without enabling UI execution", () => {
    const previous = configureAdaptiveFlags({ runtime: true });
    expect(previous).toEqual({ runtime: false, uiExecution: false, reflection: false });
    expect(isAdaptiveRuntimeEnabled()).toBe(true);
    expect(isUIExecutionEnabled()).toBe(false);
  });

  it("UI execution can be enabled independently", () => {
    configureAdaptiveFlags({ uiExecution: true });
    expect(isUIExecutionEnabled()).toBe(true);
    expect(isAdaptiveRuntimeEnabled()).toBe(false);
  });

  it("reflection can be enabled independently and defaults OFF", () => {
    expect(isReflectionEnabled()).toBe(false);
    configureAdaptiveFlags({ reflection: true });
    expect(isReflectionEnabled()).toBe(true);
    expect(isAdaptiveRuntimeEnabled()).toBe(false);
    expect(isUIExecutionEnabled()).toBe(false);
  });

  it("configureAdaptiveFlags ignores non-boolean overrides", () => {
    configureAdaptiveFlags({ runtime: "yes", uiExecution: 1, reflection: "yes" });
    expect(isAdaptiveRuntimeEnabled()).toBe(false);
    expect(isUIExecutionEnabled()).toBe(false);
    expect(isReflectionEnabled()).toBe(false);
  });

  it("resetAdaptiveFlags restores all OFF", () => {
    configureAdaptiveFlags({ runtime: true, uiExecution: true, reflection: true });
    resetAdaptiveFlags();
    expect(isAdaptiveRuntimeEnabled()).toBe(false);
    expect(isUIExecutionEnabled()).toBe(false);
    expect(isReflectionEnabled()).toBe(false);
  });
});
