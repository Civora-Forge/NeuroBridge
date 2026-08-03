import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAdaptiveBehavioralEngine } from "../useAdaptiveBehavioralEngine.js";
import {
  clearUserRole4Data,
  saveUserMemory,
} from "@/support/persistence/role4Store";
import { MemoryType } from "@/support/schemas/supportSchemas";
import {
  configureAdaptiveFlags,
  resetAdaptiveFlags,
} from "@backend/adaptive/engine/featureFlags";

const USER = "hook-user-a";

const SNAPSHOT = {
  timestamp: "2026-08-01T00:00:00.000Z",
  mood: { primaryMood: "overwhelmed", confidence: 0.9 },
  behavior: { taskSwitchFrequency: 1.0 },
  conversation: { urgency: "high" },
};

const USER_PREFERENCES = {
  accessibility: { reduceMotion: true },
  requested: [],
  restricted: [],
};

describe("useAdaptiveBehavioralEngine (Phase 4 live wiring)", () => {
  beforeEach(() => {
    resetAdaptiveFlags();
    localStorage.clear();
    clearUserRole4Data(USER);
  });

  afterEach(() => {
    resetAdaptiveFlags();
  });

  it("is inert when the runtime flag is OFF", async () => {
    const { result } = renderHook(() =>
      useAdaptiveBehavioralEngine({ getSnapshot: () => SNAPSHOT, userId: USER }),
    );

    await waitFor(() => expect(result.current.enabled).toBe(false));
    expect(result.current.active).toBe(false);
    expect(result.current.plan).toBeNull();
    expect(result.current.trace).toBeNull();
    expect(result.current.execution).toBeNull();
  });

  it("runs decide() with the live snapshot and Role 4 signals when enabled", async () => {
    saveUserMemory(USER, {
      id: "mem-1",
      userId: USER,
      type: MemoryType.SUPPORT_BOUNDARY,
      key: "ui.mode",
      value: "no_auto_theme",
    });
    configureAdaptiveFlags({ runtime: true });

    const { result } = renderHook(() =>
      useAdaptiveBehavioralEngine({ getSnapshot: () => SNAPSHOT, userId: USER }),
    );

    await waitFor(() => expect(result.current.plan).not.toBeNull());

    expect(result.current.enabled).toBe(true);
    expect(result.current.active).toBe(true);
    expect(result.current.trace).toBeDefined();
    expect(result.current.trace.sources).toContain("role4_signals");
    expect(result.current.decisionId).toBe(result.current.plan.decisionTraceId);
    expect(result.current.lastDecisionAt).toBe(result.current.plan.timestamp);
    // Decision never auto-executes.
    expect(result.current.execution).toBeNull();
  });

  it("traces userPreferences when provided alongside the Role 4 read path", async () => {
    saveUserMemory(USER, {
      id: "mem-1",
      userId: USER,
      type: MemoryType.SUPPORT_BOUNDARY,
      key: "ui.mode",
      value: "no_auto_theme",
    });
    configureAdaptiveFlags({ runtime: true });

    const { result } = renderHook(() =>
      useAdaptiveBehavioralEngine({
        getSnapshot: () => SNAPSHOT,
        userId: USER,
        userPreferences: USER_PREFERENCES,
      }),
    );

    await waitFor(() => expect(result.current.plan).not.toBeNull());
    expect(result.current.trace.sources).toContain("role4_signals");
    expect(result.current.trace.sources).toContain("user_preferences");
  });

  it("keeps execution a separate explicit step", async () => {
    configureAdaptiveFlags({ runtime: true });

    const { result } = renderHook(() =>
      useAdaptiveBehavioralEngine({ getSnapshot: () => SNAPSHOT, userId: USER }),
    );

    await waitFor(() => expect(result.current.plan).not.toBeNull());

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.execution).not.toBeNull();
    expect(result.current.execution.summary).toBeDefined();
    expect(result.current.execution.summary.total).toBe(result.current.plan.actions.length);
  });

  it("records a readable error when the snapshot producer throws", async () => {
    configureAdaptiveFlags({ runtime: true });
    const boom = () => Promise.reject(new Error("snapshot failed"));

    const { result } = renderHook(() =>
      useAdaptiveBehavioralEngine({ getSnapshot: boom, userId: USER }),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain("snapshot failed");
    expect(result.current.plan).toBeNull();
  });

  it("does not auto-decide without a snapshot producer, but execute() still works", async () => {
    configureAdaptiveFlags({ runtime: true });

    const { result } = renderHook(() =>
      useAdaptiveBehavioralEngine({ userId: USER }),
    );

    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(result.current.plan).toBeNull();

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.execution).not.toBeNull();
  });
});
