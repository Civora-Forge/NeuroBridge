/**
 * contextualRuntime.test.jsx — the real provider tree (ContextProvider →
 * AdaptiveRuntimeProvider → AdaptiveUIRuntime) with the redesigned
 * context-to-state inference. Only auth and the intervention modal are mocked.
 */

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const authState = vi.hoisted(() => ({ user: { id: "runtime-user-a" } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: authState.user }) }));
vi.mock("@/components/interventions/InterventionModal", () => ({ __esModule: true, default: () => null }));

import { ContextProvider } from "@/context/ContextProvider";
import { AdaptiveRuntimeProvider } from "../adaptiveRuntimeContext.jsx";
import AdaptiveUIRuntime from "../AdaptiveUIRuntime.jsx";
import { configureAdaptiveFlags, resetAdaptiveFlags } from "@backend/adaptive/engine/featureFlags";
import { resetAdaptiveHysteresis } from "@backend/adaptive/engine/hysteresis";
import { resetExecutionStore } from "@/adaptive/execution/uiExecution";
import { configurePersonalizationPersistence, createLocalProfileStorage, resetPersonalizationStore } from "@/adaptive/personalization/profileStore";
import { createMemoryStorage, setLearningStorage } from "@/adaptive/learning/adaptationLearning";
import { getBehaviouralBaseline, setBaselineStorage } from "@/adaptive/baseline/behaviouralBaseline";
import { clearInteractionEvidence, getInteractionEvidenceSnapshot, recordSelfReport } from "@/adaptive/context/interactionEvidence.js";
import { contextEngine } from "@/adaptive/context";
import { contextStore } from "@/adaptive/context/contextStore.js";
import { resetMoodAgent } from "@/adaptive/context/moodAgent.js";
import { resetInteractionTracker } from "@/adaptive/context/contextInteractionTracker.js";

const tree = () => (
  <MemoryRouter initialEntries={["/"]}>
    <ContextProvider>
      <AdaptiveRuntimeProvider>
        <AdaptiveUIRuntime><input aria-label="field" /></AdaptiveUIRuntime>
      </AdaptiveRuntimeProvider>
    </ContextProvider>
  </MemoryRouter>
);
const card = (c) => c.querySelector('[data-adaptive-support-card="true"]');
const root = (c) => c.querySelector('[data-adaptive-root="true"]');
const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.setSystemTime(Date.parse("2026-11-21T10:00:00.000Z"));
  authState.user = { id: "runtime-user-a" };
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
  // Production flag set: runtime + reflection on, Stage C (uiExecution) off.
  configureAdaptiveFlags({ runtime: true, reflection: true, uiExecution: false });
});
afterEach(() => {
  resetAdaptiveFlags();
  setLearningStorage(null);
  setBaselineStorage(null);
  vi.useRealTimers();
});

describe("redesigned inference in the live runtime", () => {
  it("a pointer-movement burst alone no longer produces a support offer", async () => {
    const { container, unmount } = render(tree());
    await tick(200);
    let x = 0;
    let dir = 1;
    for (let t = 0, n = 0; t < 4000; t += 30, n += 1) {
      if (n % 3 === 0) dir *= -1;
      x += dir * 80;
      await act(async () => {
        fireEvent(window, new MouseEvent("pointermove", { clientX: 400 + x, clientY: 300 }));
        await vi.advanceTimersByTimeAsync(30);
      });
    }
    // The burst WAS perceived (the mood agent wrote a behaviour-based mood)...
    expect(contextStore.getContext().mood.basis).toBe("interaction");
    await tick(1000);
    // ...but behaviour alone is not distress: no offer.
    expect(card(container)).toBeNull();
    unmount();
  });

  it("an explicit self-report surfaces a user-controlled support offer; Stage C stays off", async () => {
    const { container, unmount } = render(tree());
    await tick(200);
    await act(async () => { recordSelfReport({ state: "overwhelmed", moduleId: "support.mood_checkin", source: "mood_checkin" }); });
    await tick(300);
    expect(card(container)).not.toBeNull();
    expect(card(container).textContent).toMatch(/Support options/);
    expect(root(container).getAttribute("data-adaptive-mode")).toBe("normal");
    unmount();
  });

  it("normal activity is learned into the shared baseline by the app-level runtime", async () => {
    const { container, unmount } = render(tree());
    await tick(200);
    const input = container.querySelector("input");
    // ~4 minutes of ordinary typing across several 30 s buckets (observations
    // are rate-limited to one per minute per activity type).
    for (let i = 0; i < 48; i += 1) {
      await act(async () => {
        fireEvent.keyDown(input, { key: "a" });
        await vi.advanceTimersByTimeAsync(5000);
      });
    }
    const general = getBehaviouralBaseline("runtime-user-a").activities.general;
    expect(general?.metrics?.correctionRate?.n).toBeGreaterThanOrEqual(1);
    expect(general?.metrics?.focusInterruptRate?.n).toBeGreaterThanOrEqual(2);
    unmount();
  });

  it("switching to another signed-in user drops the previous user's interaction evidence", async () => {
    const view = render(tree());
    await tick(200);
    await act(async () => { recordSelfReport({ state: "anxious" }); });
    expect(getInteractionEvidenceSnapshot().selfReports).toHaveLength(1);
    authState.user = { id: "runtime-user-b" };
    view.rerender(tree());
    await tick(200);
    expect(getInteractionEvidenceSnapshot().selfReports).toHaveLength(0);
    expect(card(view.container)).toBeNull();
    view.unmount();
  });
});
