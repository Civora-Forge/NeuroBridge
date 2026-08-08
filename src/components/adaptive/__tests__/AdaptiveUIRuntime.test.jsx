import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AdaptiveUIRuntime, {
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
    expect(resolveCanonicalModuleId("/dyslexia/adaptive-reading")).toBe("dyslexia.adaptive-reading");
    expect(resolveCanonicalModuleId("/dyscalculia/step-practice")).toBe("dyscalculia.step-practice");
    expect(resolveCanonicalModuleId("/dyscalculia/calm-mode")).toBe("dyscalculia.calm-mode");
    expect(resolveCanonicalModuleId("/asd/sensory")).toBe("asd.sensory");
    expect(resolveCanonicalModuleId("/asd/meltdown")).toBe("asd.meltdown");
  });

  it("handles queries, root, and unknown routes", () => {
    expect(resolveCanonicalModuleId("/adhd/focus?tab=blocks")).toBe("support.focus_session");
    expect(resolveCanonicalModuleId("/")).toBeNull();
    expect(resolveCanonicalModuleId(null)).toBeNull();
    expect(resolveCanonicalModuleId("/settings")).toBeNull();
  });
});

describe("AdaptiveUIRuntime", () => {
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

  it("end-to-end: registered module policies fire through the engine on a support module context", () => {
    const outcome = decide(
      {
        contextSnapshot: {
          timestamp: new Date().toISOString(),
          mood: { primaryMood: "anxious", confidence: 0.9 },
          behavior: { taskSwitchFrequency: 0.05 },
          activity: { activity: "social_scenario_practice" },
        },
        moduleContext: buildModuleContext("dyslexia.adaptive-reading"),
      },
      { now: () => 1750000000000 },
    );

    const moduleActions = outcome.plan.actions.filter(
      (action) => action.target !== AdaptationDimension.UI,
    );
    expect(moduleActions.length).toBeGreaterThan(0);

    const adjustments = deriveModuleAdjustments(outcome.plan);
    expect(adjustments.some((a) => a.label === "Simplified content")).toBe(true);
  });

  const inertValue = { plan: null, trace: null, enabled: false, active: false };

  it("renders children unchanged with no chip when there is no plan", () => {
    const { container } = render(<Harness runtimeValue={inertValue} />);
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(rootAttr(container).getAttribute("data-adaptive-mode")).toBe("normal");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("applies the derived mode to the wrapper and shows the status chip", () => {
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

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Adapted for you")).toBeInTheDocument();
    expect(screen.getByText(MODE_LABELS.low_stimulation)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revert/i })).toBeInTheDocument();
  });

  it("shows module adaptation tags even when the UI mode is normal", () => {
    const plan = planWith([
      {
        actionId: "a-content",
        type: AdaptationActionType.REDUCE,
        target: AdaptationDimension.CONTENT,
        parameters: { sentenceChunks: "short" },
        confidence: 0.8,
        reason: "Policy fired",
      },
    ]);
    const { container } = render(
      <Harness runtimeValue={{ plan, trace: null, enabled: true, active: true }} />,
    );

    expect(rootAttr(container).getAttribute("data-adaptive-mode")).toBe("normal");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Simplified content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revert/i })).toBeInTheDocument();
  });

  it("reverts to the default interface when the user dismisses the chip", () => {
    const plan = planWith([uiAction("a-guide", { mode: "guided" })]);
    const { container, rerender } = render(
      <Harness runtimeValue={{ plan, trace: null, enabled: true, active: true }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /revert/i }));

    expect(rootAttr(container).getAttribute("data-adaptive-mode")).toBe("normal");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // A different future decision re-applies adaptation.
    const escalated = planWith([uiAction("a-overwhelm", { mode: "overwhelm" })]);
    rerender(
      <Harness runtimeValue={{ plan: escalated, trace: null, enabled: true, active: true }} />,
    );
    expect(rootAttr(container).getAttribute("data-adaptive-mode")).toBe("overwhelm");
  });
});
