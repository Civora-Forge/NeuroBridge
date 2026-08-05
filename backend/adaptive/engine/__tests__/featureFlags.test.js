import { describe, it, expect, afterEach } from "vitest";
import {
  isAdaptiveRuntimeEnabled,
  isUIExecutionEnabled,
  isReflectionEnabled,
  configureAdaptiveFlags,
  resetAdaptiveFlags,
  resolveDefaultFlags,
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

describe("env-driven defaults (resolveDefaultFlags)", () => {
  it("defaults every switch OFF when no env flags are set", () => {
    expect(resolveDefaultFlags({})).toEqual({
      runtime: false,
      uiExecution: false,
      reflection: false,
    });
    expect(resolveDefaultFlags(undefined)).toEqual({
      runtime: false,
      uiExecution: false,
      reflection: false,
    });
    expect(resolveDefaultFlags(null)).toEqual({
      runtime: false,
      uiExecution: false,
      reflection: false,
    });
  });

  it("honors the runtime env flag only when truthy", () => {
    expect(resolveDefaultFlags({ VITE_NEUROBRIDGE_ADAPTIVE_RUNTIME: "true" }).runtime).toBe(true);
    expect(resolveDefaultFlags({ VITE_NEUROBRIDGE_ADAPTIVE_RUNTIME: "1" }).runtime).toBe(true);
    expect(resolveDefaultFlags({ VITE_NEUROBRIDGE_ADAPTIVE_RUNTIME: true }).runtime).toBe(true);
    expect(resolveDefaultFlags({ VITE_NEUROBRIDGE_ADAPTIVE_RUNTIME: "false" }).runtime).toBe(false);
    expect(resolveDefaultFlags({ VITE_NEUROBRIDGE_ADAPTIVE_RUNTIME: "" }).runtime).toBe(false);
    expect(resolveDefaultFlags({ VITE_NEUROBRIDGE_ADAPTIVE_RUNTIME: 0 }).runtime).toBe(false);
  });

  it("keeps uiExecution and reflection OFF unless their env flags are set", () => {
    const flags = resolveDefaultFlags({ VITE_NEUROBRIDGE_ADAPTIVE_UI_EXECUTION: "true" });
    expect(flags.uiExecution).toBe(true);
    expect(flags.reflection).toBe(false);
    expect(flags.runtime).toBe(false);
  });

  it("reads each switch independently", () => {
    const flags = resolveDefaultFlags({
      VITE_NEUROBRIDGE_ADAPTIVE_RUNTIME: "true",
      VITE_NEUROBRIDGE_ADAPTIVE_REFLECTION: "true",
    });
    expect(flags).toEqual({ runtime: true, uiExecution: false, reflection: true });
  });
});
