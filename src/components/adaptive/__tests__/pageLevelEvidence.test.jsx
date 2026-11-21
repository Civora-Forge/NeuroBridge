/**
 * pageLevelEvidence.test.jsx — page-level (module) decision paths receive
 * their module's interaction evidence through the real provider tree:
 * recorded once, attributed to the active route's module, filtered per
 * module, and decided in the module's own hysteresis scope.
 */

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";

const authState = vi.hoisted(() => ({ user: { id: "page-user" } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: authState.user }) }));
vi.mock("@/components/interventions/InterventionModal", () => ({ __esModule: true, default: () => null }));

import { ContextProvider } from "@/context/ContextProvider";
import { AdaptiveRuntimeProvider } from "../adaptiveRuntimeContext.jsx";
import AdaptiveUIRuntime from "../AdaptiveUIRuntime.jsx";
import { useModuleAdaptation, moduleStateScope } from "@/hooks/useModuleAdaptation";
import { configureAdaptiveFlags, resetAdaptiveFlags } from "@backend/adaptive/engine/featureFlags";
import { adaptationStateKey, readAdaptationState, resetAdaptiveHysteresis } from "@backend/adaptive/engine/hysteresis";
import { resetExecutionStore } from "@/adaptive/execution/uiExecution";
import { configurePersonalizationPersistence, createLocalProfileStorage, resetPersonalizationStore } from "@/adaptive/personalization/profileStore";
import { createMemoryStorage, setLearningStorage } from "@/adaptive/learning/adaptationLearning";
import { setBaselineStorage } from "@/adaptive/baseline/behaviouralBaseline";
import {
  clearInteractionEvidence,
  getInteractionEvidenceSnapshot,
  recordTaskEvent,
  TaskEventType,
} from "@/adaptive/context/interactionEvidence.js";
import { contextEngine } from "@/adaptive/context";
import { contextStore } from "@/adaptive/context/contextStore.js";
import { resetMoodAgent } from "@/adaptive/context/moodAgent.js";
import { resetInteractionTracker } from "@/adaptive/context/contextInteractionTracker.js";

const TASK = "support.task_breakdown";
const latest = { adaptation: null, navigate: null };

/** A page-level consumer with a MODULE-LOCAL snapshot (no evidence of its own). */
function TaskPage() {
  latest.navigate = useNavigate();
  const adaptation = useModuleAdaptation({
    moduleId: TASK,
    getSnapshot: () => ({ timestamp: "2026-11-21T10:00:00.000Z", activity: { activity: "task_breakdown" } }),
    userId: authState.user.id,
    enabled: true,
  });
  latest.adaptation = adaptation;
  return <input aria-label="step" />;
}

const tree = (start) => (
  <MemoryRouter initialEntries={[start]}>
    <ContextProvider>
      <AdaptiveRuntimeProvider>
        <AdaptiveUIRuntime><TaskPage /></AdaptiveUIRuntime>
      </AdaptiveRuntimeProvider>
    </ContextProvider>
  </MemoryRouter>
);
const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const ruleIds = (plan) => (plan?.actions ?? []).map((a) => (a.evidence.find((e) => e.startsWith("policy:")) ?? "").replace(/^policy:|@v\d+$/g, ""));

async function typeWithCorrections(input, keys = 60, corrections = 20) {
  for (let i = 0; i < keys + corrections; i += 1) {
    await act(async () => {
      fireEvent.keyDown(input, { key: i % 4 === 3 && i / 4 < corrections ? "Backspace" : "a" });
      await vi.advanceTimersByTimeAsync(120);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.setSystemTime(Date.parse("2026-11-21T10:00:00.000Z"));
  contextEngine.stop();
  contextStore.reset();
  resetMoodAgent();
  resetInteractionTracker();
  clearInteractionEvidence();
  resetAdaptiveHysteresis();
  resetExecutionStore();
  resetPersonalizationStore();
  sessionStorage.clear();
  setLearningStorage(createMemoryStorage());
  setBaselineStorage(createMemoryStorage());
  configurePersonalizationPersistence({ local: createLocalProfileStorage(createMemoryStorage()), resolveRemote: async () => null, subscribeAuth: () => () => {} });
  configureAdaptiveFlags({ runtime: true, reflection: true, uiExecution: false });
});
afterEach(() => {
  resetAdaptiveFlags();
  setLearningStorage(null);
  setBaselineStorage(null);
  vi.useRealTimers();
});

describe("page-level evidence propagation", () => {
  it("evidence on a module route is attributed to that module and recorded once", async () => {
    const { container, unmount } = render(tree("/adhd/breakdown"));
    await tick(200);
    await act(async () => { fireEvent.keyDown(container.querySelector("input"), { key: "a" }); });
    const all = getInteractionEvidenceSnapshot();
    const scoped = getInteractionEvidenceSnapshot({ moduleId: TASK });
    const sum = (view) => view.buckets.reduce((s, b) => s + b.keystroke, 0);
    expect(sum(all)).toBe(1);
    expect(sum(scoped)).toBe(1);
    expect(sum(getInteractionEvidenceSnapshot({ moduleId: "support.focus_session" }))).toBe(0);
    unmount();
  });

  it("a page with a module-local snapshot decides on its module's evidence, in its own scope", async () => {
    const { container, unmount } = render(tree("/adhd/breakdown"));
    await tick(200);
    await typeWithCorrections(container.querySelector("input"));
    await act(async () => {
      recordTaskEvent({ type: TaskEventType.FAILED, moduleId: TASK });
      recordTaskEvent({ type: TaskEventType.STARTED, moduleId: TASK });
      recordTaskEvent({ type: TaskEventType.FAILED, moduleId: TASK });
    });
    await tick(300);
    // Pending in the module's own scope first (confirmation window)...
    const scopedUser = `page-user@${moduleStateScope(TASK)}`;
    expect(readAdaptationState(adaptationStateKey(scopedUser, TASK, "ASSISTANCE"))?.pendingRuleId).toBe("frustration_assistance");
    // ...then confirmed on fresh evidence after the window.
    await act(async () => { fireEvent.keyDown(container.querySelector("input"), { key: "a" }); });
    await tick(11000);
    await act(async () => { fireEvent.keyDown(container.querySelector("input"), { key: "Backspace" }); });
    await tick(300);
    expect(ruleIds(latest.adaptation.plan)).toContain("frustration_assistance");
    expect(latest.adaptation.moduleActions.some((a) => a.parameters.contextualAssistance === true)).toBe(true);
    expect(latest.adaptation.plan.userStateReference.contextual.moduleId).toBe(TASK);
    unmount();
  });

  it("evidence from another module never reaches this module's page-level inference", async () => {
    const { container, unmount } = render(tree("/adhd/focus"));
    await tick(200);
    // Heavy editing + failures while the FOCUS module is active.
    await typeWithCorrections(container.querySelector("input"));
    await act(async () => {
      recordTaskEvent({ type: TaskEventType.FAILED, moduleId: "support.focus_session" });
      recordTaskEvent({ type: TaskEventType.FAILED, moduleId: "support.focus_session" });
    });
    await act(async () => { latest.navigate("/adhd/breakdown"); });
    await tick(11500);
    await act(async () => { fireEvent.keyDown(container.querySelector("input"), { key: "a" }); });
    await tick(300);
    const view = getInteractionEvidenceSnapshot({ moduleId: TASK });
    expect(view.buckets.reduce((s, b) => s + b.correction, 0)).toBe(0);
    expect(view.taskEvents).toHaveLength(0);
    expect(ruleIds(latest.adaptation.plan)).not.toContain("frustration_assistance");
    expect(latest.adaptation.plan?.userStateReference?.frustrationState).not.toBe("present");
    unmount();
  });
});
