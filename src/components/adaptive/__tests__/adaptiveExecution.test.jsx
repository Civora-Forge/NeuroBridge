/**
 * adaptiveExecution.test.jsx — Task 3 regression tests
 *
 * Production adaptive UI execution: decide() → AdaptiveRuntimeContext →
 * AdaptiveUIRuntime (through resolvePlanExecution) → data-adaptive-* UI state.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import AdaptiveUIRuntime from "../AdaptiveUIRuntime.jsx";
import { AdaptiveRuntimeContext } from "../adaptiveRuntimeContext.jsx";
import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";
import {
  createExecutionLedger,
  PlanExecutionStatus,
  resetExecutionStore,
  resolvePlanExecution,
} from "@/adaptive/execution/uiExecution";
import { decide } from "@backend/adaptive/engine/adaptiveEngine";
import { resetAdaptiveHysteresis } from "@backend/adaptive/engine/hysteresis";
import { configureAdaptiveFlags, resetAdaptiveFlags } from "@backend/adaptive/engine/featureFlags";
import {
  AdaptationActionType,
  AdaptationDimension,
  PriorityTier,
  SafetyLevel,
} from "@/support/schemas/supportSchemas";

vi.mock("@/components/interventions/InterventionModal", () => ({
  __esModule: true,
  default: ({ isOpen, recommendationId }) =>
    isOpen ? <div data-testid="intervention-modal">{recommendationId}</div> : null,
}));

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
function planWith(actions, extra = {}) {
  seq += 1;
  return {
    planId: `plan_${seq}`,
    decisionTraceId: `trace_${seq}`,
    timestamp: 1785000000000 + seq,
    actions,
    priorityOrder: actions.map((a) => a.actionId),
    situation: "emotional_distress",
    primaryNeed: "regulation",
    overallConfidence: 0.8,
    ...extra,
  };
}
const lowStim = (extra) =>
  uiAction("low_stimulation", { mode: "low_stimulation", reduceAnimations: true, reduceColorIntensity: true }, extra);
const breathing = () => uiAction("module.breathing", { guidedBreathing: true });

function value(plan, extra = {}) {
  return { plan, trace: null, enabled: true, active: Boolean(plan), ...extra };
}
function Harness({ runtimeValue, onExecution }) {
  return (
    <AdaptiveRuntimeContext.Provider value={runtimeValue}>
      <AdaptiveUIRuntime onExecution={onExecution}>
        <div>content</div>
      </AdaptiveUIRuntime>
    </AdaptiveRuntimeContext.Provider>
  );
}
const root = (c) => c.querySelector('[data-adaptive-root="true"]');
const card = (c) => c.querySelector('[data-adaptive-support-card="true"]');
const consent = (c) => c.querySelector('[data-adaptive-consent="pending"]');
const mode = (c) => root(c).getAttribute("data-adaptive-mode");
const status = (c) => root(c).getAttribute("data-adaptive-execution");

beforeEach(() => {
  resetExecutionStore();
  resetAdaptiveHysteresis();
  resetAdaptiveFlags();
  configureAdaptiveFlags({ uiExecution: true });
});
afterEach(() => {
  resetAdaptiveFlags();
});

// ─────────────────────────────────────────────────────────────────

describe("valid plan execution", () => {
  it("applies a valid engine plan to the UI and records it", () => {
    const onExecution = vi.fn();
    const outcome = decide(
      { contextSnapshot: { mood: { primaryMood: "anxious", confidence: 0.95 } } },
      { now: 1785000000000, userId: "exec-valid" },
    );
    const { container } = render(<Harness runtimeValue={value(outcome.plan, { trace: outcome.trace })} onExecution={onExecution} />);

    expect(mode(container)).toBe("low_stimulation");
    expect(root(container).getAttribute("data-adaptive-reduce-motion")).toBe("true");
    expect(status(container)).toBe(PlanExecutionStatus.APPLIED);
    expect(onExecution).toHaveBeenCalledTimes(1);
    const entry = onExecution.mock.calls[0][0];
    expect(entry.status).toBe("applied");
    expect(entry.decisionId).toBe(outcome.plan.decisionTraceId);
    expect(entry.actions[0]).toMatchObject({ ruleId: "low_stimulation", status: "applied" });
  });
});

describe("rejected or disabled execution", () => {
  it("keeps the baseline UI and records why when the uiExecution flag is OFF", () => {
    configureAdaptiveFlags({ uiExecution: false });
    const onExecution = vi.fn();
    const { container } = render(<Harness runtimeValue={value(planWith([lowStim()]))} onExecution={onExecution} />);
    expect(mode(container)).toBe("normal");
    expect(status(container)).toBe(PlanExecutionStatus.REJECTED);
    expect(onExecution.mock.calls[0][0].reason).toMatch(/UI execution disabled/);
  });

  it("never applies a stale plan once the runtime is disabled", () => {
    const { container } = render(<Harness runtimeValue={value(planWith([lowStim()]), { enabled: false })} />);
    expect(mode(container)).toBe("normal");
    expect(root(container).getAttribute("data-adaptive-reduce-color")).toBe("false");
  });

  it("rejects an invalid UI mode instead of applying it", () => {
    const res = resolvePlanExecution(planWith([uiAction("bad", { mode: "party_mode" })]), { uiExecutionEnabled: true });
    expect(res.status).toBe(PlanExecutionStatus.REJECTED);
    expect(res.effectivePlan).toBeNull();
    expect(res.records[0].reason).toMatch(/unsupported UI mode/);
  });
});

describe("safety restrictions", () => {
  it("a BLOCK / ESCALATE safety outcome overrides ordinary adaptation and suppresses offers", () => {
    const plan = planWith([lowStim(), breathing()]);
    const trace = { safetyResult: { disposition: "ESCALATE", level: SafetyLevel.ESCALATE, reasons: ["crisis"] } };
    const { container } = render(<Harness runtimeValue={value(plan, { trace })} />);
    expect(mode(container)).toBe("normal");
    expect(card(container)).toBeNull();
    expect(status(container)).toBe(PlanExecutionStatus.REJECTED);
  });

  it("still applies a Tier 1 SAFETY adaptation under an escalation", () => {
    const safety = uiAction("module.safety_calm", { mode: "overwhelm" }, { tier: PriorityTier.SAFETY });
    const res = resolvePlanExecution(planWith([safety, lowStim()]), {
      uiExecutionEnabled: true,
      trace: { safetyResult: { disposition: "ESCALATE" } },
    });
    expect(res.effectivePlan.actions.map((a) => a.parameters.mode)).toEqual(["overwhelm"]);
    expect(res.records.find((r) => r.ruleId === "low_stimulation").status).toBe("rejected");
  });

  it("never applies an action the safety stage blocked", () => {
    const blocked = lowStim({ safety: { disposition: "BLOCK", level: "escalate", reasons: [] } });
    const res = resolvePlanExecution(planWith([blocked]), { uiExecutionEnabled: true });
    expect(res.effectivePlan).toBeNull();
    expect(res.records[0].reason).toMatch(/safety stage BLOCK/);
  });

  it("applies reducedIntensity as protective changes only (modified)", () => {
    const reduced = lowStim();
    reduced.parameters = { ...reduced.parameters, reducedIntensity: true };
    const { container } = render(<Harness runtimeValue={value(planWith([reduced]))} />);
    expect(mode(container)).toBe("normal"); // no layout-changing mode switch
    expect(root(container).getAttribute("data-adaptive-reduce-motion")).toBe("true");
    expect(root(container).getAttribute("data-adaptive-reduce-color")).toBe("true");
    expect(status(container)).toBe(PlanExecutionStatus.MODIFIED);
  });
});

describe("confirmation requirements", () => {
  function cautionPlan() {
    // Real engine: a CAUTION module makes the safety gate MODIFY every
    // candidate with { requireConfirmation, reducedIntensity }.
    return decide(
      {
        contextSnapshot: { mood: { primaryMood: "anxious", confidence: 0.95 } },
        moduleContext: { moduleId: "caution-module", safetyLevel: SafetyLevel.CAUTION },
      },
      { now: 1785000000000, userId: "exec-consent" },
    );
  }

  it("defers a requireConfirmation adaptation until the user accepts it", () => {
    const outcome = cautionPlan();
    expect(outcome.plan.actions[0].parameters.requireConfirmation).toBe(true);
    const { container } = render(<Harness runtimeValue={value(outcome.plan, { trace: outcome.trace })} />);

    expect(status(container)).toBe(PlanExecutionStatus.DEFERRED);
    expect(root(container).getAttribute("data-adaptive-reduce-motion")).toBe("false");
    expect(consent(container)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(consent(container)).toBeNull();
    expect(root(container).getAttribute("data-adaptive-reduce-motion")).toBe("true"); // reducedIntensity
    expect(status(container)).toBe(PlanExecutionStatus.MODIFIED);
  });

  it("honours a decline across later decisions of the same adaptation", () => {
    const first = cautionPlan();
    const { container, rerender } = render(<Harness runtimeValue={value(first.plan, { trace: first.trace })} />);
    fireEvent.click(screen.getByRole("button", { name: /keep current view/i }));
    expect(status(container)).toBe(PlanExecutionStatus.DISMISSED);

    // A fresh decision (new action ids) for the same adaptation stays declined.
    resetAdaptiveHysteresis();
    const second = cautionPlan();
    expect(second.plan.actions[0].actionId).not.toBe(first.plan.actions[0].actionId);
    rerender(<Harness runtimeValue={value(second.plan, { trace: second.trace })} />);
    expect(consent(container)).toBeNull();
    expect(root(container).getAttribute("data-adaptive-reduce-motion")).toBe("false");
  });
});

describe("stale asynchronous decisions", () => {
  it("an older, slower decision never overwrites a newer one", async () => {
    configureAdaptiveFlags({ runtime: true });
    const queue = [];
    const getSnapshot = () =>
      new Promise((resolve) => {
        queue.push(resolve);
      });
    const { result } = renderHook(() =>
      useAdaptiveBehavioralEngine({ getSnapshot, userId: "exec-stale" }),
    );
    await waitFor(() => expect(queue).toHaveLength(1));
    await act(async () => {
      queue[0]({}); // initial mount decision: neutral
    });

    let older;
    let newer;
    act(() => {
      older = result.current.refresh();
      newer = result.current.refresh();
    });
    await waitFor(() => expect(queue).toHaveLength(3));
    await act(async () => {
      queue[2]({ mood: { primaryMood: "overwhelmed", confidence: 0.95 } }); // newer first
      await newer;
      queue[1]({ mood: { primaryMood: "anxious", confidence: 0.95 } }); // older, late
      await older;
    });

    const modes = result.current.plan.actions.map((a) => a.parameters.mode);
    expect(modes).toEqual(["overwhelm"]);
    expect(await older).toBeNull();
  });

  it("falls back to the baseline when a decision fails", async () => {
    configureAdaptiveFlags({ runtime: true });
    let fail = false;
    const getSnapshot = () => {
      if (fail) throw new Error("snapshot unavailable");
      return { mood: { primaryMood: "anxious", confidence: 0.95 } };
    };
    const { result } = renderHook(() => useAdaptiveBehavioralEngine({ getSnapshot, userId: "exec-error" }));
    await waitFor(() => expect(result.current.plan?.actions.length).toBeGreaterThan(0));
    fail = true;
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.plan).toBeNull();
    expect(result.current.error).toMatch(/snapshot unavailable/);
  });
});

describe("duplicate execution", () => {
  it("the ledger records an unchanged resolution only once", () => {
    const ledger = createExecutionLedger();
    const plan = planWith([lowStim()]);
    const res = resolvePlanExecution(plan, { uiExecutionEnabled: true });
    expect(ledger.commit(res, plan).duplicate).toBe(false);
    expect(ledger.commit(res, plan).duplicate).toBe(true);
    // Equivalent plan from a new decision (new ids / timestamp) is a duplicate too.
    const again = planWith([lowStim()]);
    expect(ledger.commit(resolvePlanExecution(again, { uiExecutionEnabled: true }), again).duplicate).toBe(true);
    expect(ledger.entries()).toHaveLength(1);
  });

  it("re-rendering an equivalent plan does not re-execute or re-record", () => {
    const onExecution = vi.fn();
    const { container, rerender } = render(<Harness runtimeValue={value(planWith([lowStim()]))} onExecution={onExecution} />);
    rerender(<Harness runtimeValue={value(planWith([lowStim()]))} onExecution={onExecution} />);
    rerender(<Harness runtimeValue={value(planWith([lowStim()]))} onExecution={onExecution} />);
    expect(onExecution).toHaveBeenCalledTimes(1);
    expect(mode(container)).toBe("low_stimulation");
  });

  it("the hook keeps the same plan object for an unchanged decision and execute() is idempotent", async () => {
    configureAdaptiveFlags({ runtime: true });
    const snapshot = { mood: { primaryMood: "anxious", confidence: 0.95 } };
    const { result } = renderHook(() => useAdaptiveBehavioralEngine({ getSnapshot: () => snapshot, userId: "exec-dup" }));
    await waitFor(() => expect(result.current.plan).not.toBeNull());
    const firstPlan = result.current.plan;
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.plan).toBe(firstPlan); // no state update / re-render

    let a;
    let b;
    await act(async () => {
      a = await result.current.execute();
      b = await result.current.execute();
    });
    expect(a.duplicate).toBeUndefined();
    expect(b.duplicate).toBe(true);
    expect(b.planId).toBe(a.planId);
  });
});

describe("dismissal persistence", () => {
  it("a dismissed recommendation stays hidden through plan flicker and remounts", () => {
    const { container, rerender, unmount } = render(<Harness runtimeValue={value(planWith([breathing()]))} />);
    expect(card(container)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /dismiss support/i }));
    expect(card(container)).toBeNull();

    // Unrelated state changes: the plan clears, then re-decides the same offer.
    rerender(<Harness runtimeValue={value(planWith([]))} />);
    rerender(<Harness runtimeValue={value(planWith([breathing()]))} />);
    expect(card(container)).toBeNull();

    unmount();
    const remounted = render(<Harness runtimeValue={value(planWith([breathing()]))} />);
    expect(card(remounted.container)).toBeNull();

    // A genuinely different recommendation still appears.
    remounted.rerender(<Harness runtimeValue={value(planWith([lowStim()]))} />);
    expect(card(remounted.container)).not.toBeNull();
  });
});

describe("restoration to baseline UI", () => {
  it("a withdrawn adaptation restores every UI attribute and records the restoration", () => {
    const onExecution = vi.fn();
    const { container, rerender } = render(<Harness runtimeValue={value(planWith([lowStim()]))} onExecution={onExecution} />);
    expect(mode(container)).toBe("low_stimulation");

    rerender(<Harness runtimeValue={value(planWith([]))} onExecution={onExecution} />);
    const el = root(container);
    expect(el.getAttribute("data-adaptive-mode")).toBe("normal");
    for (const attr of ["reduce-motion", "reduce-color", "focus", "guide", "simplify-nav"]) {
      expect(el.getAttribute(`data-adaptive-${attr}`)).toBe("false");
    }
    const last = onExecution.mock.calls.at(-1)[0];
    expect(last.reason).toMatch(/baseline UI restored/);
  });

  it("an engine withdrawal (Task 2 recovery) flows through to the baseline UI", () => {
    const user = "exec-restore";
    const at = (ms) => 1785000000000 + ms;
    const entered = decide({ contextSnapshot: { mood: { primaryMood: "anxious", confidence: 0.95 } } }, { now: at(0), userId: user });
    const { container, rerender } = render(<Harness runtimeValue={value(entered.plan, { trace: entered.trace })} />);
    expect(mode(container)).toBe("low_stimulation");

    const recovered = decide({ contextSnapshot: { mood: { primaryMood: "calm", confidence: 0.9 } } }, { now: at(25000), userId: user });
    rerender(<Harness runtimeValue={value(recovered.plan, { trace: recovered.trace })} />);
    expect(mode(container)).toBe("normal");
  });
});
