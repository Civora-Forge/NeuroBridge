/**
 * adaptiveFeedback.test.jsx — Task 4 regression tests (UI feedback capture)
 *
 * Feedback from UI execution reaches the learning layer exactly once per
 * exposure, silence is never feedback, and learned preferences flow back
 * into the live decision path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import AdaptiveUIRuntime, { IGNORED_AFTER_MS } from "../AdaptiveUIRuntime.jsx";
import { AdaptiveRuntimeContext } from "../adaptiveRuntimeContext.jsx";
import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";
import { resetExecutionStore } from "@/adaptive/execution/uiExecution";
import {
  createMemoryStorage,
  getAdaptationFeedback,
  recordAdaptationFeedback,
  setLearningStorage,
} from "@/adaptive/learning/adaptationLearning";
import { decide } from "@backend/adaptive/engine/adaptiveEngine";
import { resetAdaptiveHysteresis } from "@backend/adaptive/engine/hysteresis";
import { configureAdaptiveFlags, resetAdaptiveFlags } from "@backend/adaptive/engine/featureFlags";
import { AdaptationActionType, AdaptationDimension, PriorityTier, SafetyLevel } from "@/support/schemas/supportSchemas";

vi.mock("@/components/interventions/InterventionModal", () => ({
  __esModule: true,
  default: ({ isOpen, recommendationId }) =>
    isOpen ? <div data-testid="intervention-modal">{recommendationId}</div> : null,
}));

const USER = "feedback-user";
const T0 = Date.parse("2026-11-20T12:00:00.000Z");
let seq = 0;

function uiAction(rule, parameters, extra = {}) {
  seq += 1;
  return {
    actionId: `action_${seq}`,
    type: AdaptationActionType.MODIFY,
    target: AdaptationDimension.UI,
    parameters,
    tier: PriorityTier.CURRENT_STATE,
    confidence: 0.8,
    reason: `Policy "${rule}" (v1) matched: mood == "anxious".`,
    evidence: [`policy:${rule}@v1`],
    ...extra,
  };
}
function planWith(actions) {
  seq += 1;
  return { planId: `plan_${seq}`, decisionTraceId: `trace_${seq}`, timestamp: T0, actions, priorityOrder: actions.map((a) => a.actionId), situation: "emotional_distress", primaryNeed: "regulation", overallConfidence: 0.8 };
}
const lowStim = () => uiAction("low_stimulation", { mode: "low_stimulation", reduceAnimations: true });
const breathing = () => uiAction("module.breathing", { guidedBreathing: true });
const explicitQuiet = () =>
  uiAction("pref.ui_quiet", { mode: "focus" }, { tier: PriorityTier.EXPLICIT_USER_REQUEST, evidence: ["policy:pref.ui_quiet@v1"] });

function value(plan, extra = {}) {
  return { plan, trace: null, enabled: true, active: Boolean(plan), userId: USER, moduleId: "reader", ...extra };
}
function Harness({ runtimeValue }) {
  return (
    <AdaptiveRuntimeContext.Provider value={runtimeValue}>
      <AdaptiveUIRuntime>
        <div>content</div>
      </AdaptiveUIRuntime>
    </AdaptiveRuntimeContext.Provider>
  );
}
function cautionDecision() {
  return decide(
    {
      contextSnapshot: { mood: { primaryMood: "anxious", confidence: 0.95 } },
      moduleContext: { moduleId: "caution-module", safetyLevel: SafetyLevel.CAUTION },
    },
    { now: T0, userId: USER },
  );
}
const events = () => getAdaptationFeedback(USER);
const card = (c) => c.querySelector('[data-adaptive-support-card="true"]');

beforeEach(() => {
  setLearningStorage(createMemoryStorage());
  resetExecutionStore();
  resetAdaptiveHysteresis();
  resetAdaptiveFlags();
  configureAdaptiveFlags({ uiExecution: true });
});
afterEach(() => {
  vi.useRealTimers();
  resetAdaptiveFlags();
  setLearningStorage(null);
});

describe("feedback capture from UI execution", () => {
  it("records acceptance of a confirmation prompt once, with decision metadata", () => {
    const outcome = cautionDecision();
    render(<Harness runtimeValue={value(outcome.plan, { trace: outcome.trace })} />);
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(events()).toEqual([
      expect.objectContaining({ key: "UI:low_stimulation", outcome: "accepted", moduleId: "reader", decisionId: outcome.plan.decisionTraceId }),
    ]);
  });

  it("records an explicit decline as a rejection", () => {
    const outcome = cautionDecision();
    render(<Harness runtimeValue={value(outcome.plan, { trace: outcome.trace })} />);
    fireEvent.click(screen.getByRole("button", { name: /keep current view/i }));
    expect(events().map((e) => e.outcome)).toEqual(["rejected"]);
  });

  it("records support-card acceptance and dismissal against the offer", () => {
    const { container, rerender } = render(<Harness runtimeValue={value(planWith([breathing()]))} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss support/i }));
    expect(card(container)).toBeNull();
    rerender(<Harness runtimeValue={value(planWith([lowStim()]))} />);
    fireEvent.click(screen.getByRole("button", { name: /start support/i }));
    expect(events().map((e) => [e.key, e.outcome])).toEqual([
      ["RECOMMENDATION:guided_breathing", "dismissed"],
      ["RECOMMENDATION:sensory_reset", "accepted"],
    ]);
  });

  it("records an explicit override of an applied adaptation exactly once", () => {
    const { rerender } = render(<Harness runtimeValue={value(planWith([lowStim()]))} />);
    rerender(<Harness runtimeValue={value(planWith([explicitQuiet()]))} />);
    rerender(<Harness runtimeValue={value(planWith([explicitQuiet()]))} />);
    expect(events().filter((e) => e.outcome === "overridden")).toEqual([
      expect.objectContaining({ key: "UI:low_stimulation" }),
    ]);
  });

  it("does not interpret silence as rejection", () => {
    // An applied adaptation that is simply left in place and later withdrawn.
    const { rerender } = render(<Harness runtimeValue={value(planWith([lowStim()]))} />);
    rerender(<Harness runtimeValue={value(planWith([]))} />);
    // A prompt that flickers briefly and disappears.
    const outcome = cautionDecision();
    rerender(<Harness runtimeValue={value(outcome.plan, { trace: outcome.trace })} />);
    rerender(<Harness runtimeValue={value(planWith([]))} />);
    expect(events()).toEqual([]);
  });

  it("records a prompt left unanswered for a sustained period as ignored (weak signal)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const outcome = cautionDecision();
    const { rerender } = render(<Harness runtimeValue={value(outcome.plan, { trace: outcome.trace })} />);
    vi.setSystemTime(T0 + IGNORED_AFTER_MS + 1000);
    rerender(<Harness runtimeValue={value(planWith([]))} />);
    // Two distinct unanswered exposures: the consent prompt and its offer card.
    expect(events().map((e) => [e.key, e.outcome])).toEqual([
      ["UI:low_stimulation", "ignored"],
      ["RECOMMENDATION:sensory_reset", "ignored"],
    ]);
  });

  it("never records feedback for an anonymous session", () => {
    const outcome = cautionDecision();
    render(<Harness runtimeValue={value(outcome.plan, { trace: outcome.trace, userId: null })} />);
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(events()).toEqual([]);
  });
});

describe("learned preferences in the live loop", () => {
  it("an offer the user keeps dismissing in this context stops resurfacing", () => {
    configureAdaptiveFlags({ uiExecution: true, reflection: true });
    for (let i = 0; i < 5; i += 1) {
      recordAdaptationFeedback({ userId: USER, key: "RECOMMENDATION:guided_breathing", outcome: "dismissed", exposureId: `x${i}`, moduleId: "reader" });
    }
    const { container } = render(<Harness runtimeValue={value(planWith([breathing()]))} />);
    expect(card(container)).toBeNull();
    // Elsewhere, the same history counts as the user's general preference.
    const other = render(<Harness runtimeValue={value(planWith([breathing()]), { moduleId: "planner" })} />);
    expect(card(other.container)).toBeNull();
  });

  it("learned preferences reach decide() through the hook and appear in the trace", async () => {
    configureAdaptiveFlags({ runtime: true, reflection: true });
    for (let i = 0; i < 4; i += 1) {
      recordAdaptationFeedback({ userId: USER, key: "UI:low_stimulation", outcome: "rejected", exposureId: `r${i}`, moduleId: "generic" });
    }
    const snapshot = { mood: { primaryMood: "anxious", confidence: 0.95 } };
    const { result } = renderHook(() => useAdaptiveBehavioralEngine({ getSnapshot: () => snapshot, userId: USER }));
    await waitFor(() => expect(result.current.trace).not.toBeNull());
    expect(result.current.trace.learning[0]).toMatchObject({ key: "UI:low_stimulation", effect: "changed", evidenceCount: 4 });
  });

  it("learning stays off when the reflection flag is off", async () => {
    configureAdaptiveFlags({ runtime: true, reflection: false });
    for (let i = 0; i < 4; i += 1) {
      recordAdaptationFeedback({ userId: USER, key: "UI:low_stimulation", outcome: "rejected", exposureId: `r${i}` });
    }
    const snapshot = { mood: { primaryMood: "anxious", confidence: 0.95 } };
    const { result } = renderHook(() => useAdaptiveBehavioralEngine({ getSnapshot: () => snapshot, userId: USER }));
    await waitFor(() => expect(result.current.trace).not.toBeNull());
    expect(result.current.trace.learning).toEqual([]);
    await act(async () => {});
  });
});
