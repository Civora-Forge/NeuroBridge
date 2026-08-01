import { beforeEach, describe, expect, it } from "vitest";
import {
  AdaptationActionType,
  AdaptationDimension,
  AdaptationOutcomeStatus,
  PolicyScope,
  PriorityTier,
  SafetyLevel,
  TriggerCondition,
  TriggerGroupOperator,
  validateAdaptationAction,
  validateAdaptationDecisionRecord,
  validateAdaptationOutcome,
  validateAdaptationPlan,
  validateDecisionTrace,
  validateIntervention,
  validatePolicyRule,
} from "@/support/schemas/supportSchemas";
import {
  getRole4StorageKey,
  ROLE4_COLLECTIONS,
} from "@/support/schemas/storageKeys";
import {
  clearUserRole4Data,
  listAdaptationDecisions,
  saveAdaptationDecision,
} from "@/support/persistence/role4Store";

const USER = "engine-schema-user";

function baseAction(overrides = {}) {
  return {
    actionId: "action-1",
    type: AdaptationActionType.SIMPLIFY,
    target: AdaptationDimension.CONTENT,
    parameters: { granularity: "high" },
    tier: PriorityTier.CURRENT_STATE,
    confidence: 0.8,
    reason: "Cognitive overload detected",
    reversible: true,
    ...overrides,
  };
}

function basePlan(overrides = {}) {
  return {
    planId: "plan-1",
    timestamp: 1720000000000,
    decisionTraceId: "trace-1",
    situation: "cognitive_overload",
    primaryNeed: "reduce_cognitive_load",
    secondaryNeeds: ["pacing", "focus"],
    reasoning: ["state indicates overload"],
    actions: [baseAction()],
    overallConfidence: 0.8,
    sources: ["contextSnapshot", "userState"],
    userStateReference: { cognitiveOverload: 0.9 },
    priorityOrder: ["action-1"],
    ...overrides,
  };
}

function basePolicyRule(overrides = {}) {
  return {
    id: "nb.rule.test",
    scope: PolicyScope.GENERIC,
    tier: PriorityTier.CURRENT_STATE,
    priority: 80,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [
          { dimension: "cognitiveOverload", condition: TriggerCondition.GTE, value: 0.7 },
        ],
      },
    ],
    action: { type: AdaptationActionType.SIMPLIFY, target: AdaptationDimension.CONTENT },
    ...overrides,
  };
}

function baseTrace(overrides = {}) {
  return {
    decisionId: "trace-1",
    timestamp: 1720000000000,
    userId: USER,
    moduleId: "module.reading",
    inputRef: { snapshotAt: 1719999999000, userStateRef: "us-1" },
    situation: "cognitive_overload",
    primaryNeed: "reduce_cognitive_load",
    reasoning: ["state indicates overload"],
    triggeredConditions: [
      {
        ruleId: "nb.rule.test",
        ruleVersion: 1,
        scope: PolicyScope.GENERIC,
        tier: PriorityTier.CURRENT_STATE,
        matchedTriggers: [
          { dimension: "cognitiveOverload", condition: TriggerCondition.GTE, value: 0.7 },
        ],
      },
    ],
    safetyResult: {
      level: SafetyLevel.STANDARD,
      disposition: "ALLOW",
      reasons: ["no safety concern"],
      guardrails: {},
    },
    confidence: 0.8,
    sources: ["contextSnapshot"],
    ...overrides,
  };
}

function baseOutcome(overrides = {}) {
  return {
    id: "outcome-1",
    userId: USER,
    decisionId: "trace-1",
    moduleId: "module.reading",
    adaptationActions: [baseAction()],
    outcomeMetrics: { completionRate: 0.8 },
    status: AdaptationOutcomeStatus.APPLIED,
    timestamp: 1720000000000,
    ...overrides,
  };
}

function baseDecisionRecord(overrides = {}) {
  return {
    id: "trace-1",
    userId: USER,
    decisionId: "trace-1",
    moduleId: "module.reading",
    timestamp: 1720000000000,
    plan: basePlan(),
    trace: baseTrace(),
    ...overrides,
  };
}

describe("AdaptationActionSchema", () => {
  it("accepts a valid action", () => {
    const action = validateAdaptationAction(baseAction());
    expect(action.actionId).toBe("action-1");
    expect(action.parameters.granularity).toBe("high");
    expect(action.evidence).toEqual([]);
    expect(action.safety).toBeUndefined();
  });

  it("rejects an invalid action type", () => {
    expect(() => validateAdaptationAction(baseAction({ type: "SPEED_UP" }))).toThrow();
  });

  it("rejects an invalid target", () => {
    expect(() => validateAdaptationAction(baseAction({ target: "DIMENSION" }))).toThrow();
  });

  it("rejects invalid confidence values", () => {
    expect(() => validateAdaptationAction(baseAction({ confidence: 1.2 }))).toThrow();
    expect(() => validateAdaptationAction(baseAction({ confidence: -0.1 }))).toThrow();
  });

  it("rejects actions missing required fields", () => {
    expect(() => validateAdaptationAction({})).toThrow();
    expect(() => validateAdaptationAction(baseAction({ actionId: undefined }))).toThrow();
    expect(() => validateAdaptationAction(baseAction({ reversible: undefined }))).toThrow();
  });
});

describe("AdaptationPlanSchema", () => {
  it("accepts a valid plan", () => {
    const plan = validateAdaptationPlan(basePlan());
    expect(plan.planId).toBe("plan-1");
    expect(plan.actions).toHaveLength(1);
    expect(plan.sources).toEqual(["contextSnapshot", "userState"]);
  });

  it("rejects plans missing required fields", () => {
    expect(() => validateAdaptationPlan({})).toThrow();
    expect(() => validateAdaptationPlan(basePlan({ planId: undefined }))).toThrow();
  });

  it("rejects plans with an invalid action", () => {
    expect(() =>
      validateAdaptationPlan(basePlan({ actions: [{ actionId: "bad" }] })),
    ).toThrow();
  });

  it("does not expose uiMode as a top-level field", () => {
    const plan = validateAdaptationPlan(basePlan({ uiMode: "focused" }));
    expect(plan).not.toHaveProperty("uiMode");
  });

  it("accepts an empty action list when priorityOrder is also empty", () => {
    const plan = validateAdaptationPlan(basePlan({ actions: [], priorityOrder: [] }));
    expect(plan.actions).toEqual([]);
    expect(plan.priorityOrder).toEqual([]);
  });

  it("validates overallConfidence as 0..1", () => {
    expect(() => validateAdaptationPlan(basePlan({ overallConfidence: 1.5 }))).toThrow();
    expect(() => validateAdaptationPlan(basePlan({ overallConfidence: -0.5 }))).toThrow();
  });

  it("validates priorityOrder against action ids", () => {
    expect(() =>
      validateAdaptationPlan(basePlan({ priorityOrder: ["unknown-action"] })),
    ).toThrow(/unknown actionId/);
    expect(() =>
      validateAdaptationPlan(basePlan({ priorityOrder: ["action-1", "action-1"] })),
    ).toThrow(/duplicate actionId/);
    expect(() =>
      validateAdaptationPlan(basePlan({ actions: [], priorityOrder: ["action-1"] })),
    ).toThrow(/must be empty/);
  });
});

describe("PolicyRuleSchema", () => {
  it("accepts all valid scopes", () => {
    Object.values(PolicyScope).forEach((scope) => {
      expect(() => validatePolicyRule(basePolicyRule({ scope }))).not.toThrow();
    });
  });

  it("rejects an invalid scope", () => {
    expect(() => validatePolicyRule(basePolicyRule({ scope: "team" }))).toThrow();
  });

  it("accepts the valid priority tier range", () => {
    expect(() => validatePolicyRule(basePolicyRule({ tier: PriorityTier.SAFETY }))).not.toThrow();
    expect(() =>
      validatePolicyRule(basePolicyRule({ tier: PriorityTier.CONVENIENCE })),
    ).not.toThrow();
  });

  it("rejects invalid priority tiers", () => {
    expect(() => validatePolicyRule(basePolicyRule({ tier: 0 }))).toThrow();
    expect(() => validatePolicyRule(basePolicyRule({ tier: 11 }))).toThrow();
  });

  it("accepts valid trigger groups with multiple triggers", () => {
    const rule = basePolicyRule({
      triggerGroups: [
        {
          operator: TriggerGroupOperator.AND,
          triggers: [
            { dimension: "cognitiveOverload", condition: TriggerCondition.GTE, value: 0.7 },
            { dimension: "situation", condition: TriggerCondition.IN, value: ["overload", "urgent"] },
          ],
        },
      ],
    });
    expect(() => validatePolicyRule(rule)).not.toThrow();
  });

  it("rejects invalid trigger conditions and mismatched values", () => {
    expect(() =>
      validatePolicyRule(
        basePolicyRule({
          triggerGroups: [
            { operator: "AND", triggers: [{ dimension: "load", condition: "gte", value: 0.7 }] },
          ],
        }),
      ),
    ).toThrow();
    expect(() =>
      validatePolicyRule(
        basePolicyRule({
          triggerGroups: [
            {
              operator: "AND",
              triggers: [{ dimension: "load", condition: TriggerCondition.IN, value: 0.7 }],
            },
          ],
        }),
      ),
    ).toThrow(/array value/);
    expect(() =>
      validatePolicyRule(
        basePolicyRule({
          triggerGroups: [
            {
              operator: "AND",
              triggers: [
                { dimension: "load", condition: TriggerCondition.GTE, value: ["a", "b"] },
              ],
            },
          ],
        }),
      ),
    ).toThrow(/scalar value/);
  });

  it("validates hysteresis bands", () => {
    expect(() =>
      validatePolicyRule(
        basePolicyRule({ hysteresis: { activationThreshold: 1.2, deactivationThreshold: 0.4, cooldownMs: 1000, minDurationMs: 100 } }),
      ),
    ).toThrow();
    expect(() =>
      validatePolicyRule(
        basePolicyRule({ hysteresis: { activationThreshold: 0.7, deactivationThreshold: 0.8, cooldownMs: 1000, minDurationMs: 100 } }),
      ),
    ).toThrow(/must not exceed/);
  });
});

describe("DecisionTraceSchema", () => {
  it("accepts a valid trace", () => {
    const trace = validateDecisionTrace(baseTrace());
    expect(trace.decisionId).toBe("trace-1");
    expect(trace.preferenceResult).toEqual({
      appliedRequests: [],
      honoredRestrictions: [],
      learnedSignalsUsed: [],
    });
  });

  it("accepts conflict records", () => {
    const trace = validateDecisionTrace(
      baseTrace({
        conflicts: [
          {
            target: AdaptationDimension.UI,
            winnerActionId: "action-1",
            loserActionIds: ["action-2"],
            reason: "opposing direction",
          },
        ],
      }),
    );
    expect(trace.conflicts[0].winnerActionId).toBe("action-1");
  });

  it("accepts rejected conditions", () => {
    const trace = validateDecisionTrace(
      baseTrace({
        rejectedConditions: [
          {
            ruleId: "nb.rule.rejected",
            ruleVersion: 1,
            scope: PolicyScope.MODULE,
            tier: PriorityTier.CURRENT_STATE,
          },
        ],
      }),
    );
    expect(trace.rejectedConditions).toHaveLength(1);
  });

  it("requires a safety result", () => {
    expect(() =>
      validateDecisionTrace(baseTrace({ safetyResult: undefined })),
    ).toThrow();
  });

  it("accepts preference overrides", () => {
    const trace = validateDecisionTrace(
      baseTrace({
        overrides: [
          { kind: "preference", actionId: "action-1", applied: true, detail: "user requested" },
        ],
        preferenceResult: {
          appliedRequests: ["action-1"],
          honoredRestrictions: [],
          learnedSignalsUsed: [],
        },
      }),
    );
    expect(trace.overrides[0].kind).toBe("preference");
    expect(trace.preferenceResult.appliedRequests).toEqual(["action-1"]);
  });
});

describe("AdaptationOutcomeSchema", () => {
  it("accepts a valid outcome", () => {
    const outcome = validateAdaptationOutcome(baseOutcome());
    expect(outcome.status).toBe(AdaptationOutcomeStatus.APPLIED);
    expect(outcome.decisionId).toBe("trace-1");
  });

  it("accepts optional before/after fields and user feedback", () => {
    const outcome = validateAdaptationOutcome(
      baseOutcome({
        beforeContextSnapshot: { mood: "anxious" },
        afterContextSnapshot: { mood: "calm" },
        beforeUserState: { cognitiveOverload: 0.9 },
        afterUserState: { cognitiveOverload: 0.4 },
        userFeedback: "helped",
      }),
    );
    expect(outcome.afterUserState.cognitiveOverload).toBe(0.4);
    expect(outcome.beforeContextSnapshot.mood).toBe("anxious");
    expect(outcome.beforeUserState.cognitiveOverload).toBe(0.9);
  });

  it("requires effectiveness to be correlational", () => {
    const valid = validateAdaptationOutcome(
      baseOutcome({ effectiveness: { observed: 0.7, confidence: 0.6, correlational: true } }),
    );
    expect(valid.effectiveness.correlational).toBe(true);
    expect(() =>
      validateAdaptationOutcome(
        baseOutcome({ effectiveness: { observed: 0.7, correlational: false } }),
      ),
    ).toThrow();
    expect(() =>
      validateAdaptationOutcome(
        baseOutcome({ effectiveness: { observed: 0.7 } }),
      ),
    ).toThrow();
  });
});

describe("Role 4 adaptation_decisions collection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists a decision record through the Role 4 store", () => {
    const saved = saveAdaptationDecision(USER, baseDecisionRecord());
    expect(saved.id).toBe("trace-1");
    expect(saved.decisionId).toBe("trace-1");

    const records = listAdaptationDecisions(USER);
    expect(records).toHaveLength(1);
    expect(records[0].plan.planId).toBe("plan-1");
    expect(records[0].trace.decisionId).toBe("trace-1");
  });

  it("rejects records whose trace decisionId does not match", () => {
    expect(() =>
      validateAdaptationDecisionRecord(
        baseDecisionRecord({ trace: baseTrace({ decisionId: "other-trace" }) }),
      ),
    ).toThrow(/must match/);
  });

  it("exposes the persistence key for the collection", () => {
    const key = getRole4StorageKey(USER, ROLE4_COLLECTIONS.ADAPTATION_DECISIONS);
    expect(key).toContain("adaptation_decisions");
    expect(getRole4StorageKey(USER, "adaptation_decisions")).toBe(key);
  });

  it("clears decision records with user Role 4 data", () => {
    saveAdaptationDecision(USER, baseDecisionRecord());
    clearUserRole4Data(USER);
    expect(listAdaptationDecisions(USER)).toEqual([]);
  });

  it("leaves existing Role 4 collection schemas unchanged and validating", () => {
    const intervention = validateIntervention({
      id: "int-1",
      userId: USER,
      moduleId: "ocd.erp-tracker",
      interventionType: "erp_exposure",
      category: "specialized",
      title: "ERP exposure practice",
    });
    expect(intervention.id).toBe("int-1");
    expect(intervention.status).toBe("recommended");
  });
});
