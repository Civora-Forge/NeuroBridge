import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AdaptiveUIRuntime, {
  deriveInterventionRecommendation,
  deriveModuleAdjustments,
  deriveUIModeFromPlan,
  MODE_LABELS,
} from "../AdaptiveUIRuntime.jsx";
import {
  AdaptiveRuntimeContext,
  resolveCanonicalModuleId,
} from "../adaptiveRuntimeContext.jsx";
import {
  AdaptationActionType,
  AdaptationDimension,
} from "@/support/schemas/supportSchemas";
import { buildModuleContext } from "@/support/framework/moduleContextAdapter";
import { decide } from "@backend/adaptive/engine/adaptiveEngine";

vi.mock("@/components/interventions/InterventionModal", () => ({
  __esModule: true,
  default: ({ isOpen, recommendationId, autoStart, onComplete, onClose }) =>
    isOpen ? (
      <div data-testid="intervention-modal" data-auto-start={String(Boolean(autoStart))}>
        {recommendationId}
      </div>
    ) : null,
}));

function planWith(actions, extra = {}) {
  return {
    planId: "plan-1",
    decisionTraceId: "trace-1",
    timestamp: "2026-08-01T00:00:00.000Z",
    actions,
    priorityOrder: actions.map((a) => a.actionId),
    situation: "test situation",
    primaryNeed: "test",
    overallConfidence: 0.7,
    ...extra,
  };
}

function uiAction(id, params, extra = {}) {
  return {
    actionId: id,
    type: AdaptationActionType.MODIFY,
    target: AdaptationDimension.UI,
    parameters: params,
    confidence: 0.8,
    reason: `Policy "${id}" (v1) matched: dimension == "value".`,
    ...extra,
  };
}

function Harness({ runtimeValue, children = <div>content</div> }) {
  return (
    <AdaptiveRuntimeContext.Provider value={runtimeValue}>
      <AdaptiveUIRuntime>{children}</AdaptiveUIRuntime>
    </AdaptiveRuntimeContext.Provider>
  );
}

function rootAttr(container) {
  return container.querySelector('[data-adaptive-root="true"]');
}

function card(container) {
  return container.querySelector('[data-adaptive-support-card="true"]');
}

const guidedBreathingPlan = () =>
  planWith([uiAction("a-breath", { guidedBreathing: true })]);
const sensoryResetPlan = () =>
  planWith([
    uiAction("a-stim", { mode: "overwhelm", reduceColorIntensity: true }),
  ]);

describe("deriveUIModeFromPlan", () => {
  it("returns an inactive normal state for a null / empty plan", () => {
    for (const plan of [null, undefined, {}, { actions: [] }]) {
      const state = deriveUIModeFromPlan(plan);
      expect(state.mode).toBe("normal");
      expect(state.active).toBe(false);
      expect(Object.values(state.flags).every((value) => value === false)).toBe(true);
    }
  });

  it("selects the first mode-carrying UI action in planner precedence order", () => {
    const plan = planWith([
      uiAction("a-scattered", { mode: "guided", showStepByStep: true }),
      uiAction("a-overwhelmed", { mode: "overwhelm", simplifyNavigation: true }),
    ]);
    const state = deriveUIModeFromPlan(plan);
    expect(state.mode).toBe("guided");
    expect(state.ruleLabel).toBe(MODE_LABELS.guided);
    expect(state.active).toBe(true);
    expect(state.reason).toContain("a-scattered");
  });

  it("merges granular flags across UI actions and ignores non-UI actions", () => {
    const plan = planWith([
      uiAction("a-pref", { reduceMotion: true, reduceColorIntensity: true }),
      {
        actionId: "a-task",
        type: AdaptationActionType.SIMPLIFY,
        target: AdaptationDimension.TASK,
        parameters: {},
      },
    ]);
    const state = deriveUIModeFromPlan(plan);
    expect(state.mode).toBe("normal");
    expect(state.flags.reduceMotion).toBe(true);
    expect(state.flags.reduceColor).toBe(true);
    expect(state.flags.focus).toBe(false);
    expect(state.active).toBe(true);
  });

  it("maps distraction/guidance parameters onto focus + guide flags", () => {
    const plan = planWith([
      uiAction("a-focus", {
        mode: "focus",
        reduceDistractions: true,
        highlightNextAction: true,
      }),
    ]);
    const state = deriveUIModeFromPlan(plan);
    expect(state.mode).toBe("focus");
    expect(state.flags.focus).toBe(true);
    expect(state.flags.guide).toBe(true);
  });
});

describe("deriveInterventionRecommendation", () => {
  it("yields null for a null / empty plan", () => {
    for (const plan of [null, undefined, {}, { actions: [], situation: "stable" }]) {
      expect(deriveInterventionRecommendation(plan)).toBeNull();
    }
  });

  it("returns guided_breathing when any action carries guidedBreathing", () => {
    const rec = deriveInterventionRecommendation(guidedBreathingPlan());
    expect(rec).not.toBeNull();
    expect(rec.id).toBe("guided_breathing");
  });

  it("falls back to the situation when no action parameters match", () => {
    const rec = deriveInterventionRecommendation(
      planWith([], { situation: "emotional_distress" }),
    );
    expect(rec.id).toBe("guided_breathing");
    expect(rec.title).toBe("Guided Breathing");
  });
});

describe("deriveModuleAdjustments", () => {
  it("returns [] for a null / empty plan", () => {
    for (const plan of [null, undefined, {}, { actions: [] }]) {
      expect(deriveModuleAdjustments(plan)).toEqual([]);
    }
  });

  it("collects non-UI actions and dedupes by target+type with labels", () => {
    const plan = planWith([
      uiAction("a-ui", { mode: "low_stimulation" }),
      {
        actionId: "a-content-1",
        type: AdaptationActionType.REDUCE,
        target: AdaptationDimension.CONTENT,
        parameters: { sentenceChunks: "short" },
      },
      {
        actionId: "a-content-2",
        type: AdaptationActionType.REDUCE,
        target: AdaptationDimension.CONTENT,
        parameters: { density: "low" },
      },
      {
        actionId: "a-task",
        type: AdaptationActionType.DECOMPOSE,
        target: AdaptationDimension.TASK,
        parameters: { stepSize: "small" },
      },
    ]);

    const adjustments = deriveModuleAdjustments(plan);
    expect(adjustments).toHaveLength(2);
    expect(adjustments.map((a) => a.label).sort()).toEqual([
      "Simplified content",
      "Smaller steps",
    ]);
  });

  it("labels module decisions with a human phrase", () => {
    const plan = planWith([
      {
        actionId: "a-pacing",
        type: AdaptationActionType.DECREASE,
        target: AdaptationDimension.PACING,
        parameters: { pace: "slow" },
      },
      {
        actionId: "a-assist",
        type: AdaptationActionType.GUIDE,
        target: AdaptationDimension.ASSISTANCE,
        parameters: { guidedBreathing: true },
      },
    ]);
    const adjustments = deriveModuleAdjustments(plan);
    expect(adjustments.map((a) => a.label)).toEqual([
      "Slower pacing",
      "More guidance",
    ]);
  });
});

describe("resolveCanonicalModuleId", () => {
  it("resolves registered support module routes to canonical ids", () => {
    expect(resolveCanonicalModuleId("/adhd/focus")).toBe("support.focus_session");
    expect(resolveCanonicalModuleId("/adhd/breakdown")).toBe("support.task_breakdown");
    expect(resolveCanonicalModuleId("/adhd/timeline")).toBe("support.visual_timeline");
    expect(resolveCanonicalModuleId("/adhd/emotion-coach")).toBe("support.mood_checkin");
    expect(resolveCanonicalModuleId("/depression/anxietydissolver")).toBe("support.grounding");
    expect(resolveCanonicalModuleId("/depression/mvh")).toBe("support.gentle_activity");
    expect(resolveCanonicalModuleId("/depression/reality")).toBe("support.cognitive_reframing");
    expect(resolveCanonicalModuleId("/depression/social")).toBe("support.social_connection");
    expect(resolveCanonicalModuleId("/depression/evidence")).toBe("support.evidence_journal");
    expect(resolveCanonicalModuleId("/dyslexia/adaptive-reading")).toBe("dyslexia.adaptive-reading-module");

    expect(resolveCanonicalModuleId("/asd/emotion")).toBe("asd.emotion-decoder");
    expect(resolveCanonicalModuleId("/asd/social-scenarios")).toBe("asd.social-scenarios");
    expect(resolveCanonicalModuleId("/asd/sensory")).toBeNull();
    expect(resolveCanonicalModuleId("/asd/meltdown")).toBeNull();
  });

  it("resolves the anxiety hub route to the anxiety.hub module", () => {
    expect(resolveCanonicalModuleId("/anxiety")).toBe("anxiety.hub");
    expect(resolveCanonicalModuleId("/anxiety?tab=breathing")).toBe("anxiety.hub");
  });

  it("handles queries, root, and unknown routes", () => {
    expect(resolveCanonicalModuleId("/adhd/focus?tab=blocks")).toBe("support.focus_session");
    expect(resolveCanonicalModuleId("/")).toBeNull();
    expect(resolveCanonicalModuleId(null)).toBeNull();
    expect(resolveCanonicalModuleId("/settings")).toBeNull();
  });
});

describe("AdaptiveUIRuntime card behavior", () => {
  it("end-to-end: decide() on an anxious state yields a UI action the shell applies", () => {
    const outcome = decide(
      {
        contextSnapshot: {
          timestamp: new Date().toISOString(),
          mood: { primaryMood: "anxious", confidence: 0.9 },
          behavior: { taskSwitchFrequency: 0.05 },
          activity: { activity: "social_scenario_practice" },
        },
      },
      { now: () => 1750000000000 },
    );

    const uiActions = outcome.plan.actions.filter(
      (action) =>
        action.target === AdaptationDimension.UI &&
        action.type === AdaptationActionType.MODIFY,
    );
    expect(uiActions.length).toBeGreaterThan(0);

    const state = deriveUIModeFromPlan(outcome.plan);
    expect(state.mode).toBe("low_stimulation");
    expect(state.active).toBe(true);
    expect(state.reason).toMatch(/low_stimulation/);
  });

  it("end-to-end: the anxiety.hub module policy surfaces a guided breathing recommendation", () => {
    const outcome = decide(
      {
        contextSnapshot: {
          timestamp: new Date().toISOString(),
          mood: { primaryMood: "anxious", confidence: 0.9 },
          behavior: { taskSwitchFrequency: 0.05 },
          activity: { activity: "breathing_practice" },
        },
        moduleContext: buildModuleContext("anxiety.hub"),
      },
      { now: () => 1750000000000 },
    );

    const adjustment = deriveInterventionRecommendation(outcome.plan);
    expect(adjustment).not.toBeNull();
    expect(adjustment.id).toBe("guided_breathing");
  });

  it("end-to-end: registered module policies fire through the engine on a support module context", () => {
    const outcome = decide(
      {
        contextSnapshot: {
          timestamp: new Date().toISOString(),
          mood: { primaryMood: "anxious", confidence: 0.9 },
          behavior: { taskSwitchFrequency: 0.05 },
          activity: { activity: "regulation_practice" },
        },
        moduleContext: buildModuleContext("support.grounding"),
      },
      { now: () => 1750000000000 },
    );

    const moduleActions = outcome.plan.actions.filter(
      (action) => action.target !== AdaptationDimension.UI,
    );
    expect(moduleActions.length).toBeGreaterThan(0);

    const adjustment = deriveInterventionRecommendation(outcome.plan);
    // low_stimulation (UI, priority 90) sorts ahead of the grounding GUIDE
    // action (priority 50), so a sensory reset recommendation surfaces here.
    expect(adjustment.id).toBe("sensory_reset");
  });

  const inertValue = { plan: null, trace: null, enabled: false, active: false };

  it("renders children unchanged with no card when the runtime is disabled", () => {
    const { container } = render(<Harness runtimeValue={inertValue} />);
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(rootAttr(container).getAttribute("data-adaptive-mode")).toBe("normal");
    expect(card(container)).toBeNull();
  });

  it("persists a neutral support card when enabled without a recommendation", () => {
    const { container } = render(
      <Harness runtimeValue={{ plan: planWith([]), trace: null, enabled: true, active: false }} />,
    );

    expect(card(container).getAttribute("data-adaptive-card-state")).toBe("neutral");
    expect(screen.getByText("Adaptive Support")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start support/i })).not.toBeInTheDocument();
  });

  it("shows the recommendation state with a headline, meta and Start Support", () => {
    const { container } = render(
      <Harness runtimeValue={{ plan: guidedBreathingPlan(), trace: null, enabled: true, active: true }} />,
    );

    expect(card(container).getAttribute("data-adaptive-card-state")).toBe("recommendation");
    expect(screen.getByText("Personalized Support")).toBeInTheDocument();
    expect(screen.getByText(/A short pause might help/)).toBeInTheDocument();
    expect(screen.getByText(/Guided Breathing/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start support/i })).toBeInTheDocument();
  });

  it("still applies the derived UI mode to the wrapper alongside the card", () => {
    const plan = planWith([
      uiAction("a-anxious", {
        mode: "low_stimulation",
        reduceAnimations: true,
        reduceColorIntensity: true,
      }),
    ]);
    const { container } = render(
      <Harness runtimeValue={{ plan, trace: null, enabled: true, active: true }} />,
    );

    expect(rootAttr(container).getAttribute("data-adaptive-mode")).toBe("low_stimulation");
    expect(rootAttr(container).getAttribute("data-adaptive-reduce-motion")).toBe("true");
    expect(rootAttr(container).getAttribute("data-adaptive-reduce-color")).toBe("true");

    expect(card(container).getAttribute("data-adaptive-card-state")).toBe("recommendation");
  });

  it("opens the intervention modal on Start Support and returns the card to neutral", () => {
    const { container } = render(
      <Harness runtimeValue={{ plan: guidedBreathingPlan(), trace: null, enabled: true, active: true }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /start support/i }));

    const modal = screen.getByTestId("intervention-modal");
    expect(modal).toBeInTheDocument();
    expect(modal.getAttribute("data-auto-start")).toBe("true");
    expect(card(container).getAttribute("data-adaptive-card-state")).toBe("neutral");
  });

  it("dismissing a recommendation keeps the card visible in its neutral state", () => {
    const { container } = render(
      <Harness runtimeValue={{ plan: guidedBreathingPlan(), trace: null, enabled: true, active: true }} />,
    );
    expect(card(container).getAttribute("data-adaptive-card-state")).toBe("recommendation");

    fireEvent.click(screen.getByRole("button", { name: /dismiss support/i }));

    expect(card(container).getAttribute("data-adaptive-card-state")).toBe("neutral");
    expect(screen.queryByRole("button", { name: /start support/i })).not.toBeInTheDocument();
    expect(screen.getByText("Adaptive Support")).toBeInTheDocument();
  });

  it("a genuinely different recommendation reappears after dismissing the previous one", () => {
    const { container, rerender } = render(
      <Harness runtimeValue={{ plan: guidedBreathingPlan(), trace: null, enabled: true, active: true }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /dismiss support/i }));
    expect(card(container).getAttribute("data-adaptive-card-state")).toBe("neutral");

    rerender(
      <Harness runtimeValue={{ plan: sensoryResetPlan(), trace: null, enabled: true, active: true }} />,
    );

    expect(card(container).getAttribute("data-adaptive-card-state")).toBe("recommendation");
    expect(screen.getByText(/Sensory Reset/)).toBeInTheDocument();
  });
});