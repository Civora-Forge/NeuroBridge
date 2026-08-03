import { describe, it, expect, afterEach } from "vitest";
import { executeAdaptation } from "../executor.js";
import {
  configureAdaptiveFlags,
  resetAdaptiveFlags,
  isUIExecutionEnabled,
} from "../featureFlags.js";

// ─────────────────────────────────────────────────────────────────
//  Fixtures
// ─────────────────────────────────────────────────────────────────

function uiAction(actionId, mode = "focus", overrides = {}) {
  return {
    actionId,
    type: "MODIFY",
    target: "UI",
    parameters: { mode },
    tier: 8,
    confidence: 0.8,
    reversible: true,
    ...overrides,
  };
}

// Build a raw plan object. The executor intentionally tolerates a
// priorityOrder that references unknown action IDs, which is why the
// fixture must NOT be run through validateAdaptationPlan (that schema
// rejects such plans).
function makePlan(actions, priorityOrder = actions.map((a) => a.actionId)) {
  return {
    planId: "plan_test",
    timestamp: 1000,
    decisionTraceId: "trace_test",
    situation: "cognitive_overload",
    primaryNeed: "task_simplification",
    secondaryNeeds: [],
    reasoning: [],
    actions,
    overallConfidence: 0.8,
    sources: [],
    userStateReference: {},
    priorityOrder,
  };
}

const fixedClock = () => 5000;

afterEach(() => {
  resetAdaptiveFlags();
});

describe("executeAdaptation orchestration", () => {
  it("executes actions in priorityOrder", () => {
    configureAdaptiveFlags({ uiExecution: true });
    const plan = makePlan(
      [uiAction("a"), uiAction("b")],
      ["b", "a"],
    );
    const summary = executeAdaptation(plan, { moduleId: "focus" }, { now: fixedClock });

    expect(summary.results.map((r) => r.actionId)).toEqual(["b", "a"]);
    expect(summary.results.every((r) => r.applied === true)).toBe(true);
    expect(summary.moduleId).toBe("focus");
  });

  it("handles an unknown action ID safely without crashing the rest", () => {
    configureAdaptiveFlags({ uiExecution: true });
    const plan = makePlan([uiAction("a")], ["ghost", "a"]);
    const summary = executeAdaptation(plan, undefined, { now: fixedClock });

    expect(summary.results).toHaveLength(2);
    const unknown = summary.results.find((r) => r.actionId === "ghost");
    expect(unknown.ok).toBe(false);
    expect(unknown.error).toContain("unknown actionId");
    expect(summary.results.find((r) => r.actionId === "a").applied).toBe(true);
    expect(summary.summary.failed).toBe(1);
    expect(summary.ok).toBe(false);
  });

  it("reports unsupported dimensions as skipped without crashing", () => {
    const plan = makePlan([
      { ...uiAction("ui"), target: "CONTENT" },
    ]);
    const summary = executeAdaptation(plan, undefined, { now: fixedClock });

    expect(summary.results).toHaveLength(1);
    expect(summary.results[0].ok).toBe(true);
    expect(summary.results[0].applied).toBe(false);
    expect(summary.results[0].skipped).toContain("unsupported dimension");
    expect(summary.summary.skipped).toBe(1);
    expect(summary.ok).toBe(true);
  });

  it("does not let one failed action appear successful", () => {
    configureAdaptiveFlags({ uiExecution: true });
    const plan = makePlan([
      uiAction("bad", "simplified"),
      uiAction("good", "focus"),
    ]);
    const summary = executeAdaptation(plan, undefined, { now: fixedClock });

    expect(summary.results.find((r) => r.actionId === "bad").ok).toBe(false);
    expect(summary.results.find((r) => r.actionId === "bad").applied).toBe(false);
    expect(summary.results.find((r) => r.actionId === "good").applied).toBe(true);
    expect(summary.summary.failed).toBe(1);
    expect(summary.ok).toBe(false);
  });

  it("reflects success/failure/skipped accurately in the summary", () => {
    configureAdaptiveFlags({ uiExecution: true });
    const plan = makePlan([
      uiAction("applied", "focus"),
      uiAction("unsupported", "focus", { target: "TIMING" }),
      uiAction("broken", "simplified"),
    ]);
    const summary = executeAdaptation(plan, undefined, { now: fixedClock });

    expect(summary.summary).toEqual({ total: 3, applied: 1, skipped: 1, failed: 1 });
    expect(summary.ok).toBe(false);
  });

  it("executes an empty plan safely", () => {
    const plan = makePlan([]);
    const summary = executeAdaptation(plan, undefined, { now: fixedClock });
    expect(summary.summary).toEqual({ total: 0, applied: 0, skipped: 0, failed: 0 });
    expect(summary.ok).toBe(true);
    expect(summary.planId).toBe("plan_test");
  });

  it("survives a null plan", () => {
    const summary = executeAdaptation(null, undefined, { now: fixedClock });
    expect(summary.ok).toBe(true);
    expect(summary.summary.total).toBe(0);
  });
});

describe("UI execution feature flag gating", () => {
  it("keeps UI actions disabled by default", () => {
    expect(isUIExecutionEnabled()).toBe(false);
    const plan = makePlan([uiAction("a", "focus")]);
    const summary = executeAdaptation(plan, undefined, { now: fixedClock });

    expect(summary.results[0].ok).toBe(true);
    expect(summary.results[0].applied).toBe(false);
    expect(summary.results[0].skipped).toContain("feature flag");
    expect(summary.summary.applied).toBe(0);
    expect(summary.summary.skipped).toBe(1);
  });

  it("applies UI actions when the flag is enabled", () => {
    configureAdaptiveFlags({ uiExecution: true });
    const plan = makePlan([uiAction("a", "focus")]);
    const summary = executeAdaptation(plan, undefined, { now: fixedClock });

    expect(summary.results[0].applied).toBe(true);
    expect(summary.results[0].metadata.mode).toBe("focus");
    expect(summary.summary.applied).toBe(1);
  });
});

describe("no persistence", () => {
  it("returns a pure in-memory execution summary (no store/lifecycle handles)", () => {
    configureAdaptiveFlags({ uiExecution: true });
    const plan = makePlan([uiAction("a", "focus")]);
    const summary = executeAdaptation(plan, undefined, { now: fixedClock });

    const resultKeys = Object.keys(summary).sort();
    expect(resultKeys).toEqual(["decisionTraceId", "executedAt", "moduleId", "ok", "planId", "results", "summary"]);
    for (const result of summary.results) {
      expect(Object.keys(result).sort()).toEqual(["actionId", "applied", "appliedAt", "dimension", "metadata", "ok"]);
    }
  });
});
