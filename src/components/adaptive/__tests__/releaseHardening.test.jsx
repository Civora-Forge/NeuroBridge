/**
 * releaseHardening.test.jsx — Task 6 runtime hardening: user isolation,
 * bounded scheduling, storage corruption, auth expiry, sign-out reset,
 * duplicate execution, disabled-flag behaviour.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import AdaptiveUIRuntime, { IGNORED_AFTER_MS } from "../AdaptiveUIRuntime.jsx";
import { AdaptiveRuntimeContext } from "../adaptiveRuntimeContext.jsx";
import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";
import { createReEvaluationScheduler, RE_EVALUATION_LIMITS } from "@/adaptive/execution/reEvaluationScheduler";
import {
  MAX_STORED_DECISIONS,
  bindExecutionStoreToUser,
  createExecutionLedger,
  dismissRecommendation,
  getConsentDecision,
  getExecutionStoreOwner,
  grantConsent,
  isRecommendationDismissed,
  resetExecutionStore,
  resolvePlanExecution,
} from "@/adaptive/execution/uiExecution";
import {
  configurePersonalizationPersistence,
  createLocalProfileStorage,
  getProfileSnapshot,
  loadProfile,
  resetPersonalizationStore,
  setExplicitPreference,
  watchAuthForSync,
} from "@/adaptive/personalization/profileStore";
import {
  createMemoryStorage,
  getAdaptationFeedback,
  recordAdaptationFeedback,
  setLearningStorage,
} from "@/adaptive/learning/adaptationLearning";
import { resetAdaptiveSession } from "@/adaptive/session/adaptiveSession";
import { decide } from "@backend/adaptive/engine/adaptiveEngine";
import { adaptationStateCount, resetAdaptiveHysteresis } from "@backend/adaptive/engine/hysteresis";
import { configureAdaptiveFlags, resetAdaptiveFlags } from "@backend/adaptive/engine/featureFlags";
import { SafetyLevel } from "@/support/schemas/supportSchemas";

vi.mock("@/components/interventions/InterventionModal", () => ({ __esModule: true, default: () => null }));

const T0 = Date.parse("2026-11-20T12:00:00.000Z");
const A = "user-a";
const B = "user-b";

beforeEach(() => {
  setLearningStorage(createMemoryStorage());
  resetExecutionStore();
  resetAdaptiveHysteresis();
  resetAdaptiveFlags();
  resetPersonalizationStore();
  configurePersonalizationPersistence({ local: createLocalProfileStorage(createMemoryStorage()), resolveRemote: async () => null, subscribeAuth: () => () => {} });
});
afterEach(() => {
  vi.useRealTimers();
  resetAdaptiveFlags();
  setLearningStorage(null);
  resetPersonalizationStore();
  sessionStorage.clear();
});

describe("scheduled re-evaluation cannot run away", () => {
  it("caps refreshes for an always-due re-evaluation, then resumes after the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    let refreshes = 0;
    const scheduler = createReEvaluationScheduler({ refresh: () => (refreshes += 1) });
    // Worst case: every decision asks to re-evaluate "now" again.
    const loop = () => scheduler.schedule(Date.now() - 1000);
    scheduler.schedule(Date.now());
    for (let i = 0; i < 200; i += 1) {
      vi.advanceTimersByTime(RE_EVALUATION_LIMITS.minDelayMs);
      loop();
    }
    expect(refreshes).toBeLessThanOrEqual(RE_EVALUATION_LIMITS.maxRefreshesPerWindow * 4); // 200s → ≤ 4 windows
    expect(refreshes).toBeGreaterThan(0);
    scheduler.reset();
    expect(scheduler.pending()).toBe(false);
  });

  it("keeps a single pending timer and clamps delays", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    let refreshes = 0;
    const scheduler = createReEvaluationScheduler({ refresh: () => (refreshes += 1) });
    for (let i = 0; i < 10; i += 1) scheduler.schedule(T0 + 5000);
    vi.advanceTimersByTime(5000);
    expect(refreshes).toBe(1);
    expect(scheduler.schedule(T0 + 365 * 24 * 3600 * 1000)).toBe(true);
    vi.advanceTimersByTime(RE_EVALUATION_LIMITS.maxDelayMs);
    expect(refreshes).toBe(2);
    expect(scheduler.schedule(undefined)).toBe(false);
    expect(scheduler.schedule(NaN)).toBe(false);
  });
});

describe("user switching cannot leak state", () => {
  it("consent granted by one user never applies for another", () => {
    bindExecutionStoreToUser(A);
    grantConsent("UI:low_stimulation:{}");
    dismissRecommendation("guided_breathing");
    expect(getConsentDecision("UI:low_stimulation:{}")).toBe("granted");
    bindExecutionStoreToUser(B);
    expect(getExecutionStoreOwner()).toBe(B);
    expect(getConsentDecision("UI:low_stimulation:{}")).toBeNull();
    expect(isRecommendationDismissed("guided_breathing")).toBe(false);
    expect(bindExecutionStoreToUser(B)).toBe(false); // idempotent
  });

  it("the previous user's unanswered prompt is not recorded as the next user's feedback", () => {
    configureAdaptiveFlags({ uiExecution: true });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const outcome = decide(
      { contextSnapshot: { mood: { primaryMood: "anxious", confidence: 0.95 } }, moduleContext: { moduleId: "caution-module", safetyLevel: SafetyLevel.CAUTION } },
      { now: T0, userId: A },
    );
    const view = (userId, plan, trace) => (
      <AdaptiveRuntimeContext.Provider value={{ plan, trace, enabled: true, active: Boolean(plan), userId, moduleId: "reader" }}>
        <AdaptiveUIRuntime><div>content</div></AdaptiveUIRuntime>
      </AdaptiveRuntimeContext.Provider>
    );
    const { rerender } = render(view(A, outcome.plan, outcome.trace));
    expect(screen.getByRole("region", { name: /suggested adaptation/i })).toBeTruthy();
    vi.setSystemTime(T0 + IGNORED_AFTER_MS + 1000);
    rerender(view(B, null, null));
    expect(getAdaptationFeedback(B)).toEqual([]);
    expect(getAdaptationFeedback(A)).toEqual([]);
  });

  it("the engine hook drops the previous user's decision on switch", async () => {
    configureAdaptiveFlags({ runtime: true });
    const snapshot = { mood: { primaryMood: "anxious", confidence: 0.95 } };
    const getSnapshot = () => snapshot;
    const { result, rerender } = renderHook((props) => useAdaptiveBehavioralEngine(props), {
      initialProps: { userId: A, getSnapshot },
    });
    await waitFor(() => expect(result.current.plan).not.toBeNull());
    expect(result.current.trace.userId).toBe(A);
    rerender({ userId: B, getSnapshot: undefined });
    await waitFor(() => expect(result.current.plan).toBeNull());
    expect(result.current.trace).toBeNull();
    await act(async () => {});
  });
});

describe("storage corruption and failure", () => {
  it("corrupt or hostile session data for the execution store is discarded", async () => {
    sessionStorage.setItem("neurobridge.adaptive.execution.v1", JSON.stringify({ consent: [1, 2], dismissed: { x: { at: "soon" } }, owner: 5 }));
    vi.resetModules();
    const fresh = await import("@/adaptive/execution/uiExecution");
    expect(fresh.getConsentDecision("x")).toBeNull();
    expect(fresh.isRecommendationDismissed("x")).toBe(false);
    expect(fresh.getExecutionStoreOwner()).toBeNull();
  });

  it("stored decisions are bounded and expired ones pruned", () => {
    bindExecutionStoreToUser(A);
    for (let i = 0; i < MAX_STORED_DECISIONS + 50; i += 1) dismissRecommendation(`rec-${i}`, Date.now() - i);
    const stored = JSON.parse(sessionStorage.getItem("neurobridge.adaptive.execution.v1"));
    expect(Object.keys(stored.dismissed)).toHaveLength(MAX_STORED_DECISIONS);
    dismissRecommendation("old", Date.now() - 24 * 3600 * 1000);
    const after = JSON.parse(sessionStorage.getItem("neurobridge.adaptive.execution.v1"));
    expect(after.dismissed.old).toBeUndefined();
  });

  it("a throwing sessionStorage never breaks execution", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => grantConsent("k")).not.toThrow();
    expect(getConsentDecision("k")).toBe("granted");
    spy.mockRestore();
  });
});

describe("authentication expiry and offline recovery of the profile", () => {
  it("changes made without a session stay pending and are pushed when the session returns", async () => {
    let session = null;
    const saved = [];
    let authCallback = () => {};
    const remote = {
      fetch: async () => null,
      save: async (profile) => {
        saved.push(profile);
        return { conflict: false };
      },
      remove: async () => {},
    };
    configurePersonalizationPersistence({
      resolveRemote: async (userId) => (session === userId ? remote : null),
      subscribeAuth: (callback) => {
        authCallback = callback;
        return () => {};
      },
    });
    await setExplicitPreference(A, "guidancePace", "slow");
    expect(getProfileSnapshot(A)).toMatchObject({ status: "local_only", pending: true });
    const stop = watchAuthForSync(A);
    session = A;
    authCallback(A);
    await waitFor(() => expect(getProfileSnapshot(A)).toMatchObject({ status: "synced", pending: false }));
    expect(saved.at(-1).explicit.global.guidancePace.value).toBe("slow");
    stop();
  });

  it("concurrent loads (several mounted consumers) share one remote fetch", async () => {
    let fetches = 0;
    const remote = { fetch: async () => { fetches += 1; return null; }, save: async () => ({ conflict: false }), remove: async () => {} };
    configurePersonalizationPersistence({ resolveRemote: async () => remote });
    await Promise.all([loadProfile(A), loadProfile(A), loadProfile(A)]);
    expect(fetches).toBe(1);
  });
});

describe("sign-out / privacy reset", () => {
  it("clears consents, hysteresis, learning and the profile cache", async () => {
    bindExecutionStoreToUser(A);
    grantConsent("k");
    decide({ contextSnapshot: { mood: { primaryMood: "anxious", confidence: 0.95 } } }, { now: T0, userId: A });
    expect(adaptationStateCount()).toBeGreaterThan(0);
    recordAdaptationFeedback({ userId: A, key: "UI:low_stimulation", outcome: "accepted", exposureId: "e", at: T0 });
    await setExplicitPreference(A, "guidancePace", "slow");

    resetAdaptiveSession(A);
    expect(getConsentDecision("k")).toBeNull();
    expect(adaptationStateCount()).toBe(0);
    expect(getAdaptationFeedback(A)).toEqual([]);
    expect(getProfileSnapshot(A).profile).toBeNull();
  });
});

describe("duplicate and delayed execution", () => {
  it("re-deciding identical input never re-executes the UI", () => {
    configureAdaptiveFlags({ uiExecution: true });
    const snapshot = { mood: { primaryMood: "anxious", confidence: 0.95 } };
    const ledger = createExecutionLedger();
    const first = decide({ contextSnapshot: snapshot }, { now: T0, userId: A });
    const second = decide({ contextSnapshot: snapshot }, { now: T0 + 500, userId: A });
    expect(ledger.commit(resolvePlanExecution(first.plan, { trace: first.trace }), first.plan).duplicate).toBe(false);
    expect(ledger.commit(resolvePlanExecution(second.plan, { trace: second.trace }), second.plan).duplicate).toBe(true);
    expect(ledger.entries()).toHaveLength(1);
  });

  it("with the UI execution flag off, nothing is applied and no consent is requested", () => {
    configureAdaptiveFlags({ uiExecution: false });
    const outcome = decide(
      { contextSnapshot: { mood: { primaryMood: "anxious", confidence: 0.95 } }, moduleContext: { moduleId: "caution-module", safetyLevel: SafetyLevel.CAUTION } },
      { now: T0, userId: A },
    );
    const resolution = resolvePlanExecution(outcome.plan, { trace: outcome.trace });
    expect(resolution.effectivePlan).toBeNull();
    expect(resolution.pendingConsent).toEqual([]);
    expect(resolution.records.every((r) => r.status === "rejected")).toBe(true);
  });

  it("with the flag on, an ordinary adaptation is actually applied", () => {
    configureAdaptiveFlags({ uiExecution: true });
    const outcome = decide({ contextSnapshot: { mood: { primaryMood: "anxious", confidence: 0.95 } } }, { now: T0, userId: A });
    const resolution = resolvePlanExecution(outcome.plan, { trace: outcome.trace });
    expect(resolution.status).toBe("applied");
    expect(resolution.effectivePlan.actions[0].parameters.mode).toBe("low_stimulation");
  });
});
