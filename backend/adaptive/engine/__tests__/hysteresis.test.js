import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decide } from "../adaptiveEngine.js";
import {
  resetAdaptiveHysteresis,
  adaptationStateCount,
  readAdaptationState,
  adaptationStateKey,
} from "../hysteresis.js";
import {
  AdaptationActionType,
  AdaptationDimension,
  PolicyScope,
  PriorityTier,
  TriggerCondition,
  TriggerGroupOperator,
} from "@/support/schemas/supportSchemas";

const USER = "hyst-user";
const MODULE = "hyst-module";
const T0 = 1785000000000;
const RULE_ID = "hyst.focus_state";

function hasRule(outcome, ruleId) {
  return outcome.plan.actions.some((action) =>
    action.evidence.some((entry) => entry === `policy:${ruleId}@v1`),
  );
}

function hystRuleFixture(overrides = {}) {
  return {
    id: RULE_ID,
    version: 1,
    scope: PolicyScope.MODULE,
    moduleId: MODULE,
    tier: PriorityTier.CURRENT_STATE,
    priority: 10,
    active: true,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [{ dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" }],
      },
    ],
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: { mode: "overwhelm" },
    },
    hysteresis: {
      activationThreshold: 0.7,
      deactivationThreshold: 0.3,
      cooldownMs: 60000,
      minDurationMs: 30000,
    },
    ...overrides,
  };
}

function runDecision({ now, urgency = "critical", confidence, extraPolicies = [], ruleOverrides = {} }) {
  const rule = hystRuleFixture(ruleOverrides);
  if (confidence !== undefined) {
    rule.confidence = confidence;
  }
  const policies = [rule, ...extraPolicies];
  const userState = {
    emotionalState: "calm",
    cognitiveLoad: "low",
    energyLevel: "rested",
    attentionState: "unknown",
    stressLevel: "none",
    motivationLevel: "high",
    urgency,
    taskComplexity: "simple",
    engagementLevel: "high",
  };
  return decide(
    {
      contextSnapshot: { timestamp: "2026-08-01T00:00:00.000Z" },
      userState,
      moduleContext: { moduleId: MODULE, modulePolicies: policies },
    },
    { now, userId: USER },
  );
}

function hysteresisOverride(outcome) {
  return outcome.trace.overrides.find((o) => o.kind === "hysteresis");
}

beforeEach(() => {
  resetAdaptiveHysteresis();
});

afterEach(() => {
  resetAdaptiveHysteresis();
});

describe("hysteresis stage (D6)", () => {
  it("activates only when signal ≥ activationThreshold", () => {
    const below = runDecision({ now: T0, confidence: 0.5 });
    expect(hasRule(below, RULE_ID)).toBe(false);
    expect(below.trace.rejectedConditions.map((r) => r.ruleId)).toContain(RULE_ID);
    expect(hysteresisOverride(below).applied).toBe(false);
    expect(hysteresisOverride(below).detail).toMatch(/activationThreshold/);
    expect(below.plan.reEvaluateAt).toBeUndefined();

    const above = runDecision({ now: T0 + 1000, confidence: 0.8 });
    expect(hasRule(above, RULE_ID)).toBe(true);
    const action = above.plan.actions.find((a) =>
      a.evidence.some((entry) => entry === `policy:${RULE_ID}@v1`),
    );
    expect(action.tier).toBe(PriorityTier.CURRENT_STATE);
    expect(hysteresisOverride(above).applied).toBe(true);
    expect(hysteresisOverride(above).detail).toMatch(/activated/);
    expect(above.plan.reEvaluateAt).toBe(T0 + 1000 + 30000);
  });

  it("sustains within the band and does not oscillate between thresholds", () => {
    runDecision({ now: T0, confidence: 0.8 });

    const sustained = runDecision({ now: T0 + 5000, confidence: 0.5 });
    expect(hasRule(sustained, RULE_ID)).toBe(true);
    expect(hysteresisOverride(sustained).applied).toBe(true);
    expect(hysteresisOverride(sustained).detail).toMatch(/sustained/);

    const repeated = runDecision({ now: T0 + 6000, confidence: 0.5 });
    expect(hasRule(repeated, RULE_ID)).toBe(true);
  });

  it("deactivates only at ≤ deactivationThreshold AFTER minDurationMs", () => {
    runDecision({ now: T0, confidence: 0.8 });

    const premature = runDecision({ now: T0 + 5000, confidence: 0.2 });
    expect(hasRule(premature, RULE_ID)).toBe(true);

    const deactivated = runDecision({ now: T0 + 31000, confidence: 0.2 });
    expect(hasRule(deactivated, RULE_ID)).toBe(false);
    expect(hysteresisOverride(deactivated).applied).toBe(false);
    expect(hysteresisOverride(deactivated).detail).toMatch(/deactivated|reverted/i);
    expect(deactivated.trace.rejectedConditions.map((r) => r.ruleId)).toContain(RULE_ID);
  });

  it("blocks re-activation during cooldown, then re-activates after it", () => {
    runDecision({ now: T0, confidence: 0.8 });
    runDecision({ now: T0 + 31000, confidence: 0.2 }); // deactivate

    const cooldown = runDecision({ now: T0 + 40000, confidence: 0.9 });
    expect(hasRule(cooldown, RULE_ID)).toBe(false);
    expect(cooldown.plan.reEvaluateAt).toBe(T0 + 31000 + 60000);
    expect(hysteresisOverride(cooldown).detail).toMatch(/cooldown/);

    const reactivated = runDecision({ now: T0 + 31000 + 61000, confidence: 0.9 });
    expect(hasRule(reactivated, RULE_ID)).toBe(true);
    expect(hysteresisOverride(reactivated).detail).toMatch(/activated/);
  });

  it("treats a reversible action that expired as deactivated (reversal intent)", () => {
    const rule = hystRuleFixture({ durationMs: 20000 });
    const first = runDecision({ now: T0, confidence: 0.9, ruleOverrides: { durationMs: 20000 } });
    expect(hasRule(first, RULE_ID)).toBe(true);

    const afterExpiry = runDecision({ now: T0 + 30000, confidence: 0.9 });
    expect(hasRule(afterExpiry, RULE_ID)).toBe(false);
    expect(hysteresisOverride(afterExpiry).detail).toMatch(/reverted/);
  });

  it("keeps state isolated per user/module/target", () => {
    runDecision({ now: T0, confidence: 0.8 });

    const stateA = readAdaptationState(adaptationStateKey(USER, MODULE, AdaptationDimension.UI));
    expect(stateA).toBeDefined();
    expect(stateA.activeSince).toBe(T0);
    expect(stateA.governingRuleId).toBe(RULE_ID);

    expect(readAdaptationState(adaptationStateKey("other-user", MODULE, AdaptationDimension.UI))).toBeUndefined();
    expect(adaptationStateCount()).toBe(1);
  });

  it("never gates a Tier 1 safety action", () => {
    const safetyRule = {
      id: "hyst.safety_suppress",
      version: 1,
      scope: PolicyScope.MODULE,
      moduleId: MODULE,
      tier: PriorityTier.SAFETY,
      priority: 1,
      active: true,
      triggerGroups: [
        {
          operator: TriggerGroupOperator.AND,
          triggers: [{ dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" }],
        },
      ],
      action: {
        type: AdaptationActionType.SUPPRESS,
        target: AdaptationDimension.ASSISTANCE,
        parameters: { mode: "crisis" },
      },
      hysteresis: {
        activationThreshold: 0.7,
        deactivationThreshold: 0.3,
        cooldownMs: 60000,
        minDurationMs: 30000,
      },
    };
    const outcome = runDecision({ now: T0, confidence: 0.2, extraPolicies: [safetyRule] });
    const safetyAction = outcome.plan.actions.find((a) => a.tier === PriorityTier.SAFETY);
    expect(safetyAction).toBeDefined();
    expect(hasRule(outcome, RULE_ID)).toBe(false);
  });

  it("is a no-op when no policy declares hysteresis (shipped policies unchanged)", () => {
    resetAdaptiveHysteresis();
    const outcome = decide(
      {
        contextSnapshot: {
          timestamp: "2026-08-01T00:00:00.000Z",
          mood: { primaryMood: "overwhelmed", confidence: 0.9 },
          conversation: { urgency: "high" },
        },
      },
      { now: T0, userId: USER },
    );
    expect(outcome.plan.actions.length).toBeGreaterThan(0);
    expect(outcome.trace.overrides.filter((o) => o.kind === "hysteresis")).toEqual([]);
    expect(adaptationStateCount()).toBe(0);
  });

  it("is deterministic under an injected clock", () => {
    resetAdaptiveHysteresis();
    const first = runDecision({ now: T0, confidence: 0.8 });
    resetAdaptiveHysteresis();
    const second = runDecision({ now: T0, confidence: 0.8 });

    expect(first.plan.actions.map((a) => a.tier)).toEqual(second.plan.actions.map((a) => a.tier));
    expect(first.plan.actions[0].parameters).toEqual(second.plan.actions[0].parameters);
    expect(first.plan.reEvaluateAt).toBe(second.plan.reEvaluateAt);
  });
});
