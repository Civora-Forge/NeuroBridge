import { describe, it, expect, vi, beforeEach } from "vitest";
import { decide, adaptiveEngine } from "../adaptiveEngine.js";
import * as cognitiveReasoning from "../../reasoning/cognitiveReasoning.js";
import * as adaptationPolicyModule from "../../reasoning/adaptationPolicy.js";
import * as plannerModule from "../../reasoning/planner.js";
import {
  validateAdaptationPlan,
  validateAdaptiveEngineInput,
  AdaptationActionType,
  AdaptationDimension,
  PolicyScope,
  PriorityTier,
  SafetyLevel,
  TriggerCondition,
  TriggerGroupOperator,
} from "@/support/schemas/supportSchemas";

// ─────────────────────────────────────────────────────────────────
//  Fixtures
// ─────────────────────────────────────────────────────────────────

/** Snapshot that yields an overwhelming cognitive load + high urgency. */
function overloadSnapshot() {
  return {
    timestamp: "2026-08-01T00:00:00.000Z",
    mood: { primaryMood: "overwhelmed", confidence: 0.9 },
    behavior: { taskSwitchFrequency: 1.0 },
    conversation: { urgency: "high" },
  };
}

/** Snapshot that yields a focused attention state. */
function focusedSnapshot() {
  return {
    timestamp: "2026-08-01T00:00:00.000Z",
    behavior: { taskSwitchFrequency: 0.1 },
    activity: { activity: "reading" },
  };
}

/** A hand-built UserState that triggers no generic policy. */
function calmUserState() {
  return {
    emotionalState: "calm",
    cognitiveLoad: "low",
    energyLevel: "rested",
    attentionState: "unknown",
    stressLevel: "none",
    motivationLevel: "high",
    urgency: "low",
    taskComplexity: "simple",
    engagementLevel: "high",
  };
}

function modulePolicyFixture() {
  return {
    id: "module.high_engagement_focus",
    version: 1,
    scope: PolicyScope.MODULE,
    moduleId: "focus",
    tier: PriorityTier.CURRENT_STATE,
    priority: 5,
    active: true,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [{ dimension: "engagementLevel", condition: TriggerCondition.EQ, value: "high" }],
      },
    ],
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: { mode: "focus" },
    },
  };
}

function focusModuleContext() {
  return {
    moduleId: "focus",
    modulePolicies: [modulePolicyFixture()],
  };
}

// ─────────────────────────────────────────────────────────────────
//  1. Valid input → valid AdaptationPlan
// ─────────────────────────────────────────────────────────────────

describe("decide basics", () => {
  it("turns a valid input into a validated AdaptationPlan", () => {
    const outcome = decide({ contextSnapshot: overloadSnapshot() });

    expect(outcome.plan).toBeDefined();
    expect(outcome.plan.actions.length).toBeGreaterThan(0);
    expect(outcome.plan.situation).toBe("urgent_overload");
    expect(() => validateAdaptationPlan(outcome.plan)).not.toThrow();
  });

  it("works with a provided UserState instead of deriving one", () => {
    const userState = calmUserState();
    const outcome = decide({
      contextSnapshot: { timestamp: "2026-08-01T00:00:00.000Z" },
      userState,
    });
    expect(outcome.plan).toBeDefined();
    expect(() => validateAdaptationPlan(outcome.plan)).not.toThrow();
  });

  it("exposes the engine surface under adaptiveEngine.decide", () => {
    expect(typeof adaptiveEngine.decide).toBe("function");
    const outcome = adaptiveEngine.decide({ contextSnapshot: overloadSnapshot() });
    expect(outcome.plan).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────
//  2–5. Uses existing pipeline components; no duplicate logic
// ─────────────────────────────────────────────────────────────────

describe("pipeline composition", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the existing reasoning pipeline", () => {
    const spy = vi.spyOn(cognitiveReasoning, "reasonAboutUserState");
    const userState = calmUserState();
    decide({ contextSnapshot: {}, userState });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(userState);
  });

  it("uses the Phase 1 policy evaluator exactly once (no duplicate logic)", () => {
    const spy = vi.spyOn(adaptationPolicyModule, "evaluatePolicies");
    decide({ contextSnapshot: overloadSnapshot() });
    expect(spy).toHaveBeenCalledTimes(1);
    const [rules] = spy.mock.calls[0];
    expect(Array.isArray(rules)).toBe(true);
    expect(rules).toContain(adaptationPolicyModule.ADAPTATION_POLICIES[0]);
  });

  it("uses the Phase 2 planner", () => {
    const spy = vi.spyOn(plannerModule, "buildAdaptationPlan");
    decide({ contextSnapshot: overloadSnapshot() });
    expect(spy).toHaveBeenCalledTimes(1);
    const [input] = spy.mock.calls[0];
    expect(Array.isArray(input.triggeredRules)).toBe(true);
    expect(input.reasoning).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────
//  6. UserState is not mutated
// ─────────────────────────────────────────────────────────────────

describe("UserState ownership", () => {
  it("does not mutate a provided UserState", () => {
    const userState = calmUserState();
    const snapshot = JSON.parse(JSON.stringify(userState));
    decide({ contextSnapshot: {}, userState });
    expect(userState).toEqual(snapshot);
  });

  it("does not mutate the input ContextSnapshot", () => {
    const snapshot = overloadSnapshot();
    const copy = JSON.parse(JSON.stringify(snapshot));
    decide({ contextSnapshot: snapshot });
    expect(snapshot).toEqual(copy);
  });

  it("still works when UserState is deep-frozen", () => {
    const userState = Object.freeze(calmUserState());
    const outcome = decide({ contextSnapshot: {}, userState });
    expect(outcome.plan).toBeDefined();
    expect(() => validateAdaptationPlan(outcome.plan)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────
//  7. ModuleContext is consumed correctly
// ─────────────────────────────────────────────────────────────────

describe("ModuleContext consumption", () => {
  it("evaluates module-scoped policies from moduleContext", () => {
    const outcome = decide({
      contextSnapshot: {},
      userState: calmUserState(),
      moduleContext: focusModuleContext(),
    });

    expect(outcome.plan.actions).toHaveLength(1);
    expect(outcome.plan.actions[0].evidence).toContain("policy:module.high_engagement_focus@v1");
    expect(outcome.plan.actions[0].evidence).toContain("module:focus");
    expect(outcome.trace.moduleId).toBe("focus");
  });

  it("records restricted dimensions as rejected and never adapts them", () => {
    const moduleContext = { moduleId: "focus", restrictedDimensions: [AdaptationDimension.UI] };
    const outcome = decide({ contextSnapshot: overloadSnapshot(), moduleContext });

    expect(outcome.plan.actions).toEqual([]);
    const rejectedIds = outcome.trace.rejectedConditions.map((entry) => entry.ruleId);
    expect(rejectedIds).toContain("overwhelm_simplification");
    expect(() => validateAdaptationPlan(outcome.plan)).not.toThrow();
  });

  it("falls back to a generic module context when none is provided", () => {
    const outcome = decide({ contextSnapshot: overloadSnapshot() });
    expect(outcome.trace.moduleId).toBe("generic");
    expect(outcome.plan.actions.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────
//  8–10. Missing optional inputs degrade gracefully
// ─────────────────────────────────────────────────────────────────

describe("input honesty", () => {
  it("does not crash when role4Signals is absent", () => {
    const outcome = decide({ contextSnapshot: overloadSnapshot() });
    expect(() => validateAdaptationPlan(outcome.plan)).not.toThrow();
  });

  it("accepts sparse role4Signals without crashing", () => {
    const outcome = decide({
      contextSnapshot: overloadSnapshot(),
      role4Signals: { interventions: [], outcomes: [] },
    });
    expect(outcome.plan).toBeDefined();
  });

  it("does not crash when userPreferences is absent or empty", () => {
    const without = decide({ contextSnapshot: overloadSnapshot() });
    const withEmpty = decide({
      contextSnapshot: overloadSnapshot(),
      userPreferences: { accessibility: {}, requested: [], restricted: [] },
    });
    const stripIds = (actions) => actions.map(({ actionId, ...rest }) => rest);
    expect(stripIds(without.plan.actions)).toEqual(stripIds(withEmpty.plan.actions));
  });

  it("accepts derived task/goal references without fabricating intent", () => {
    const outcome = decide({
      contextSnapshot: overloadSnapshot(),
      currentTask: { kind: "derived", source: "contextSnapshot.activity.activity", description: "current module" },
      currentGoal: { kind: "derived", source: "contextSnapshot.explicitRequests", description: "latest request" },
    });
    expect(outcome.plan).toBeDefined();
    expect(outcome.plan).not.toHaveProperty("currentTask");
    expect(outcome.plan).not.toHaveProperty("currentGoal");
    expect(() => validateAdaptiveEngineInput({
      contextSnapshot: overloadSnapshot(),
      userState: outcome.plan.userStateReference,
      moduleContext: { moduleId: "generic" },
      currentTask: { kind: "derived", source: "contextSnapshot.activity.activity" },
      currentGoal: { kind: "derived", source: "contextSnapshot.explicitRequests" },
    })).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────
//  11–12. Empty policy result + decisionTraceId
// ─────────────────────────────────────────────────────────────────

describe("empty plan and trace linkage", () => {
  it("produces a valid empty plan when no policy triggers", () => {
    const outcome = decide({ contextSnapshot: {} });
    expect(outcome.plan.actions).toEqual([]);
    expect(outcome.plan.priorityOrder).toEqual([]);
    expect(outcome.plan.situation).toBe("insufficient_information");
    expect(outcome.trace.triggeredConditions).toEqual([]);
    expect(() => validateAdaptationPlan(outcome.plan)).not.toThrow();
  });

  it("always carries a decisionTraceId", () => {
    const generated = decide({ contextSnapshot: overloadSnapshot() });
    expect(typeof generated.plan.decisionTraceId).toBe("string");
    expect(generated.plan.decisionTraceId.length).toBeGreaterThan(0);
    expect(generated.trace.decisionId).toBe(generated.plan.decisionTraceId);
  });

  it("honors a provided decisionTraceId", () => {
    const outcome = decide({ contextSnapshot: overloadSnapshot() }, { decisionTraceId: "trace_abc123" });
    expect(outcome.plan.decisionTraceId).toBe("trace_abc123");
    expect(outcome.trace.decisionId).toBe("trace_abc123");
  });
});

// ─────────────────────────────────────────────────────────────────
//  13. Determinism
// ─────────────────────────────────────────────────────────────────

describe("determinism", () => {
  it("identical inputs produce identical decisions except generated ids/timestamps", () => {
    const input = { contextSnapshot: overloadSnapshot() };
    const first = decide(input);
    const second = decide(input);

    expect(first.plan.situation).toBe(second.plan.situation);
    expect(first.plan.primaryNeed).toBe(second.plan.primaryNeed);
    expect(first.plan.actions).toHaveLength(second.plan.actions.length);
    expect(first.plan.actions[0].parameters).toEqual(second.plan.actions[0].parameters);
    expect(first.plan.actions[0].confidence).toBe(second.plan.actions[0].confidence);
    expect(first.plan.actions[0].reason).toBe(second.plan.actions[0].reason);
    expect(first.plan.actions[0].actionId).not.toBe(second.plan.actions[0].actionId);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Extension points: safety / preference / trace persistence
// ─────────────────────────────────────────────────────────────────

describe("safety extension point", () => {
  it("defaults every action to ALLOW and reports it in the trace", () => {
    const outcome = decide({ contextSnapshot: overloadSnapshot() });
    expect(outcome.plan.actions[0].safety.disposition).toBe("ALLOW");
    expect(outcome.plan.actions[0].safety.level).toBe(SafetyLevel.STANDARD);
    expect(outcome.trace.safetyResult.disposition).toBe("ALLOW");
    expect(outcome.trace.safetyResult.level).toBe(SafetyLevel.STANDARD);
    expect(outcome.trace.overrides).toEqual([]);
  });

  it("blocks actions when the extension returns BLOCK", () => {
    const outcome = decide(
      { contextSnapshot: overloadSnapshot() },
      {
        safety: () => ({
          level: SafetyLevel.ESCALATE,
          disposition: "BLOCK",
          reasons: ["test block"],
          guardrails: {},
        }),
      },
    );
    expect(outcome.plan.actions).toEqual([]);
    expect(outcome.trace.safetyResult.disposition).toBe("BLOCK");
    expect(outcome.trace.overrides.some((o) => o.kind === "safety" && o.applied === false)).toBe(true);
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain("overwhelm_simplification");
  });

  it("modifies actions when the extension returns MODIFY with guardrails", () => {
    const outcome = decide(
      { contextSnapshot: overloadSnapshot() },
      {
        safety: () => ({
          level: SafetyLevel.CAUTION,
          disposition: "MODIFY",
          reasons: ["reduce intensity"],
          guardrails: { reducedIntensity: true },
        }),
      },
    );
    const action = outcome.plan.actions[0];
    expect(action.safety.disposition).toBe("MODIFY");
    expect(action.parameters.reducedIntensity).toBe(true);
    expect(outcome.trace.safetyResult.disposition).toBe("MODIFY");
    expect(() => validateAdaptationPlan(outcome.plan)).not.toThrow();
  });
});

describe("preference extension point", () => {
  it("records preference overrides and result without persistence", () => {
    const outcome = decide(
      { contextSnapshot: overloadSnapshot() },
      {
        preference: (entries) => ({
          actions: entries,
          result: { appliedRequests: ["pref.reduced_motion"], honoredRestrictions: [], learnedSignalsUsed: [] },
          overrides: [{ kind: "preference", actionId: entries[0]?.ruleId, applied: true, detail: "honored" }],
        }),
      },
    );
    expect(outcome.trace.preferenceResult.appliedRequests).toEqual(["pref.reduced_motion"]);
    expect(outcome.trace.overrides.some((o) => o.kind === "preference" && o.applied === true)).toBe(true);
  });

  it("drops actions the preference stage removes", () => {
    const outcome = decide(
      { contextSnapshot: overloadSnapshot() },
      { preference: () => ({ actions: [] }) },
    );
    expect(outcome.plan.actions).toEqual([]);
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain("overwhelm_simplification");
  });
});

describe("trace persistence hook", () => {
  it("invokes persistTrace with the structural trace and never awaits it", () => {
    const seen = [];
    const outcome = decide(
      { contextSnapshot: overloadSnapshot() },
      {
        persistTrace: (trace) => {
          seen.push(trace);
          return Promise.resolve();
        },
      },
    );
    expect(seen).toHaveLength(1);
    expect(seen[0].decisionId).toBe(outcome.plan.decisionTraceId);
    expect(seen[0].situation).toBe(outcome.plan.situation);
  });
});
