/**
 * demoNavigationTrigger.test.jsx — DEMO-ONLY repeated-navigation popup in the
 * real provider tree (ContextProvider → AdaptiveRuntimeProvider →
 * AdaptiveUIRuntime), real routing and real card rendering. Only auth and the
 * intervention modal are mocked.
 */

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "demo-runtime-user" } }) }));
vi.mock("@/components/interventions/InterventionModal", () => ({ __esModule: true, default: () => null }));

import { ContextProvider } from "@/context/ContextProvider";
import { AdaptiveRuntimeProvider } from "../adaptiveRuntimeContext.jsx";
import AdaptiveUIRuntime from "../AdaptiveUIRuntime.jsx";
import { configureAdaptiveFlags, resetAdaptiveFlags } from "@backend/adaptive/engine/featureFlags";
import { resetAdaptiveHysteresis } from "@backend/adaptive/engine/hysteresis";
import { resetExecutionStore } from "@/adaptive/execution/uiExecution";
import { configurePersonalizationPersistence, createLocalProfileStorage, resetPersonalizationStore } from "@/adaptive/personalization/profileStore";
import { createMemoryStorage, setLearningStorage } from "@/adaptive/learning/adaptationLearning";
import { setBaselineStorage } from "@/adaptive/baseline/behaviouralBaseline";
import { clearInteractionEvidence, getInteractionEvidenceSnapshot } from "@/adaptive/context/interactionEvidence.js";
import { contextEngine } from "@/adaptive/context";
import { contextStore } from "@/adaptive/context/contextStore.js";
import { resetMoodAgent } from "@/adaptive/context/moodAgent.js";
import { resetInteractionTracker } from "@/adaptive/context/contextInteractionTracker.js";

let navigateRef;
function Page() {
  navigateRef = useNavigate();
  return <div>page</div>;
}
const tree = (start = "/") => (
  <MemoryRouter initialEntries={[start]}>
    <ContextProvider>
      <AdaptiveRuntimeProvider>
        <AdaptiveUIRuntime><Page /></AdaptiveUIRuntime>
      </AdaptiveRuntimeProvider>
    </ContextProvider>
  </MemoryRouter>
);
const card = (c) => c.querySelector('[data-adaptive-support-card="true"]');
const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
/**
 * Let real time pass with no user input. Stepped in separate act() calls so
 * React runs the effects that chain scheduled re-evaluations, as it would
 * in a browser (one long act() would stall that chain).
 */
async function idle(ms, stepMs = 5000) {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
    await tick(Math.min(stepMs, ms - elapsed));
  }
}
let page = 0;
/** Navigate to `n` distinct new pages, `gapMs` apart. */
async function switchPages(n, gapMs = 2000) {
  for (let i = 0; i < n; i += 1) {
    page += 1;
    await act(async () => { navigateRef(`/demo-page-${page}`); });
    await tick(gapMs);
  }
}

function setup({ demo }) {
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
  // Production flag set (Stage C OFF) plus the explicit demo switch.
  configureAdaptiveFlags({ runtime: true, reflection: true, uiExecution: false, demo });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.setSystemTime(Date.parse("2026-11-21T10:00:00.000Z"));
});
afterEach(() => {
  resetAdaptiveFlags();
  setLearningStorage(null);
  setBaselineStorage(null);
  vi.useRealTimers();
});

describe("demo repeated-navigation popup", () => {
  it("demo mode: 3 switches in 60 s → no popup (initial page mount not counted)", async () => {
    setup({ demo: true });
    const { container, unmount } = render(tree("/"));
    await tick(200);
    await switchPages(3);
    expect(getInteractionEvidenceSnapshot().recentNavigationSwitches.count).toBe(3);
    expect(card(container)).toBeNull();
    unmount();
  });

  it("demo mode: 4 switches in 60 s → contextual-help popup; Stage C stays off", async () => {
    setup({ demo: true });
    const { container, unmount } = render(tree("/"));
    await tick(200);
    await switchPages(4);
    expect(card(container)).not.toBeNull();
    expect(card(container).textContent).toMatch(/Lost your place\?/);
    expect(container.querySelector('[data-adaptive-root="true"]').getAttribute("data-adaptive-mode")).toBe("normal");
    unmount();
  });

  it("demo OFF: 4 switches in 60 s → no navigation-only popup", async () => {
    setup({ demo: false });
    const { container, unmount } = render(tree("/"));
    await tick(200);
    await switchPages(6);
    await tick(12000); // past any confirmation window
    expect(card(container)).toBeNull();
    unmount();
  });

  it("switches spread over more than 60 s do not count as a burst", async () => {
    setup({ demo: true });
    const { container, unmount } = render(tree("/"));
    await tick(200);
    await switchPages(4, 21000);
    expect(getInteractionEvidenceSnapshot().recentNavigationSwitches.count).toBeLessThan(4);
    expect(card(container)).toBeNull();
    unmount();
  });

  it("dismissal hides the popup, and further navigation does not bring it back (cooldown)", async () => {
    setup({ demo: true });
    const { container, unmount } = render(tree("/"));
    await tick(200);
    await switchPages(4);
    expect(card(container)).not.toBeNull();
    await act(async () => { fireEvent.click(container.querySelector('[aria-label="Dismiss support suggestion"]')); });
    expect(card(container)).toBeNull();
    // Keep navigating rapidly, then again after the burst has aged out.
    await switchPages(4);
    expect(card(container)).toBeNull();
    await tick(70000);
    await switchPages(5);
    expect(card(container)).toBeNull();
    unmount();
  });

  it("only a switch count is exposed — no page paths or timestamps leave the evidence log", async () => {
    setup({ demo: true });
    const { unmount } = render(tree("/"));
    await tick(200);
    await switchPages(2);
    const serialized = JSON.stringify(getInteractionEvidenceSnapshot());
    expect(serialized).not.toMatch(/demo-page/);
    expect(getInteractionEvidenceSnapshot().recentNavigationSwitches).toEqual({ windowMs: 60000, count: 2 });
    unmount();
  });
});

describe("demo popup lifecycle: cooldown and re-trigger", () => {
  const cards = (c) => c.querySelectorAll('[data-adaptive-support-card="true"]').length;

  it("5+ switches during an active offer or its cooldown never duplicate it; 4 new switches after the cooldown show it again", async () => {
    setup({ demo: true });
    const { container, unmount } = render(tree("/"));
    await tick(200);

    await switchPages(4);
    expect(cards(container)).toBe(1);

    // More rapid switching while the offer is active: still exactly one card.
    await switchPages(5, 1000);
    expect(cards(container)).toBe(1);

    // The burst ages out of the 60 s window → the offer is withdrawn at the
    // next scheduled re-evaluation (no further input needed).
    await idle(90000);
    expect(cards(container)).toBe(0);

    // Five switches during the 5-minute cooldown: no popup.
    await switchPages(5, 1000);
    expect(cards(container)).toBe(0);

    // After the cooldown has passed (and the burst aged out), 4 new switches
    // show the offer again.
    await idle(5 * 60 * 1000 + 30000);
    await switchPages(4);
    expect(cards(container)).toBe(1);
    expect(card(container).textContent).toMatch(/Lost your place\?/);
    unmount();
  });

  it("the initial page load and ordinary re-renders are not navigation events", async () => {
    setup({ demo: true });
    const view = render(tree("/landing-page"));
    await tick(200);
    expect(getInteractionEvidenceSnapshot().recentNavigationSwitches.count).toBe(0);
    for (let i = 0; i < 10; i += 1) {
      view.rerender(tree("/landing-page"));
      await tick(100);
    }
    expect(getInteractionEvidenceSnapshot().recentNavigationSwitches.count).toBe(0);
    expect(card(view.container)).toBeNull();
    view.unmount();
  });
});
