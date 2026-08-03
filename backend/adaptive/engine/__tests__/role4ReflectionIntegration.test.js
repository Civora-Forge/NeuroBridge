import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decide } from "../adaptiveEngine.js";
import { buildRole4Signals } from "../role4Signals.js";
import {
  reflectUserHistory,
  toStrategyEffectiveness,
  reflect,
} from "@/adaptive/reflection/reflectionEngine.js";
import * as reflectionEngine from "@/adaptive/reflection/reflectionEngine.js";
import { configureAdaptiveFlags, resetAdaptiveFlags } from "../featureFlags.js";
import {
  clearUserRole4Data,
  saveInterventionOutcome,
} from "@/support/persistence/role4Store";
import {
  AdaptationActionType,
  AdaptationDimension,
  InterventionStatus,
  ModuleCategory,
  PolicyScope,
  PriorityTier,
  TriggerCondition,
  TriggerGroupOperator,
} from "@/support/schemas/supportSchemas";

const USER = "phase5-int-user";
const OTHER_USER = "phase5-int-other";
const NOW = 1780000000000;
const STRATEGY = "focus:focus_session";
const LEARNED_DIMENSION = `strategyEffectiveness:${STRATEGY}`;

function baseOutcome(overrides = {}) {
  return {
    id: `o-${overrides.id ?? "x"}`,
    userId: USER,
    interventionId: "int-1",
    moduleId: "focus",
    interventionType: "focus_session",
    category: ModuleCategory.EXECUTIVE,
    status: InterventionStatus.COMPLETED,
    completed: true,
    rating: 5,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function seedOutcomes(userId, count, overrides = {}) {
  for (let i = 0; i < count; i += 1) {
    saveInterventionOutcome(
      userId,
      baseOutcome({
        id: `o-${userId}-${i}`,
        userId,
        rating: 5,
        createdAt: new Date(NOW - 60000 * (count - i)).toISOString(),
        ...overrides,
      }),
    );
  }
}

function learnedPolicyFixture() {
  return {
    id: "learned.recommend_focus",
    version: 1,
    scope: PolicyScope.MODULE,
    moduleId: "focus",
    tier: PriorityTier.LEARNED_PERSONALIZATION,
    priority: 10,
    active: true,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [{ dimension: LEARNED_DIMENSION, condition: TriggerCondition.GTE, value: 0.6 }],
      },
    ],
    action: {
      type: AdaptationActionType.RECOMMEND,
      target: AdaptationDimension.ASSISTANCE,
      parameters: { mode: "focus_session" },
    },
  };
}

function stateRuleFixture() {
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

describe("Phase 5 integration — Role 4 outcomes → reflection → Tier 9 decision", () => {
  beforeEach(() => {
    localStorage.clear();
    clearUserRole4Data(USER);
    clearUserRole4Data(OTHER_USER);
    configureAdaptiveFlags({ reflection: true });
  });

  afterEach(() => {
    resetAdaptiveFlags();
    vi.restoreAllMocks();
  });

  it("the full loop turns outcome evidence into a Tier 9 learned action", () => {
    seedOutcomes(USER, 5);

    const reflected = reflectUserHistory(USER, { now: NOW });
    const strategyEffectiveness = toStrategyEffectiveness(reflected.signals);
    expect(strategyEffectiveness[STRATEGY]).toBe(1);

    const outcome = decide({
      contextSnapshot: { timestamp: "2026-08-01T00:00:00.000Z" },
      userState: calmUserState(),
      moduleContext: { moduleId: "focus", modulePolicies: [learnedPolicyFixture()] },
      role4Signals: { ...buildRole4Signals(USER), strategyEffectiveness },
    });

    expect(outcome.plan.actions).toHaveLength(1);
    expect(outcome.plan.actions[0].tier).toBe(PriorityTier.LEARNED_PERSONALIZATION);
    expect(outcome.trace.sources).toContain("learned_personalization");
  });

  it("learned personalization is inert unless explicitly passed into decide()", () => {
    seedOutcomes(USER, 5);

    // buildRole4Signals never populates strategyEffectiveness itself.
    const role4Signals = buildRole4Signals(USER);
    expect(role4Signals.strategyEffectiveness).toBeUndefined();

    const outcome = decide({
      contextSnapshot: { timestamp: "2026-08-01T00:00:00.000Z" },
      userState: calmUserState(),
      moduleContext: { moduleId: "focus", modulePolicies: [learnedPolicyFixture()] },
      role4Signals,
    });

    expect(outcome.plan.actions).toEqual([]);
    expect(outcome.trace.sources).not.toContain("learned_personalization");
  });

  it("is fully inert while the reflection flag is OFF", () => {
    resetAdaptiveFlags();
    seedOutcomes(USER, 5);

    const reflected = reflectUserHistory(USER, { now: NOW });
    expect(reflected.signals).toEqual([]);
    expect(reflected.summary.disabled).toBe(true);
    expect(toStrategyEffectiveness(reflected.signals)).toEqual({});
  });

  it("decide() never invokes the reflection module (reflection is explicit only)", () => {
    const spy = vi.spyOn(reflectionEngine, "generateEffectivenessSignals");
    decide({
      contextSnapshot: { timestamp: "2026-08-01T00:00:00.000Z" },
      userState: calmUserState(),
      moduleContext: { moduleId: "focus", modulePolicies: [learnedPolicyFixture()] },
      role4Signals: { strategyEffectiveness: { [STRATEGY]: 0.8 } },
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("reflectUserHistory scopes evidence to the requested user", () => {
    seedOutcomes(USER, 5);
    seedOutcomes(OTHER_USER, 5);

    const forUser = reflectUserHistory(USER, { now: NOW });
    expect(forUser.signals).toHaveLength(1);
    expect(forUser.signals[0].userId).toBe(USER);
    expect(forUser.signals[0].evidenceCount).toBe(5);
  });

  it("reflect() output is signals + summary, never an AdaptationPlan", () => {
    const result = reflect({ outcomes: [baseOutcome({ id: "a" }), baseOutcome({ id: "b" })] }, { now: NOW });
    expect(result.signals).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.signals).not.toHaveProperty("actions");
    expect(result.signals).not.toHaveProperty("plan");
    expect(result.summary).not.toHaveProperty("actions");
  });

  it("keeps a higher-priority Tier 8 rule ahead of the learned rule in the same decision", () => {
    seedOutcomes(USER, 5);
    const strategyEffectiveness = toStrategyEffectiveness(reflectUserHistory(USER, { now: NOW }).signals);

    const outcome = decide({
      contextSnapshot: { timestamp: "2026-08-01T00:00:00.000Z" },
      userState: calmUserState(),
      moduleContext: {
        moduleId: "focus",
        modulePolicies: [stateRuleFixture(), learnedPolicyFixture()],
      },
      role4Signals: { ...buildRole4Signals(USER), strategyEffectiveness },
    });

    expect(outcome.plan.actions.map((action) => action.tier)).toEqual([
      PriorityTier.CURRENT_STATE,
      PriorityTier.LEARNED_PERSONALIZATION,
    ]);
    expect(outcome.plan.priorityOrder[0]).toBe(outcome.plan.actions[0].actionId);
  });

  it("remains deterministic across the full loop for identical evidence", () => {
    seedOutcomes(USER, 5);
    const first = runLearnedDecision(USER);
    const second = runLearnedDecision(USER);

    expect(second.trace.sources).toEqual(first.trace.sources);
    expect(second.plan.actions.map((action) => action.tier)).toEqual(first.plan.actions.map((action) => action.tier));
    expect(second.plan.actions[0].parameters).toEqual(first.plan.actions[0].parameters);
    expect(second.plan.actions[0].reason).toBe(first.plan.actions[0].reason);
  });

  it("never mutates the caller's UserState or Role 4 records", () => {
    seedOutcomes(USER, 5);
    const userState = calmUserState();
    const userStateSnapshot = JSON.parse(JSON.stringify(userState));
    const recordsBefore = buildRole4Signals(USER);

    const strategyEffectiveness = toStrategyEffectiveness(reflectUserHistory(USER, { now: NOW }).signals);
    decide({
      contextSnapshot: { timestamp: "2026-08-01T00:00:00.000Z" },
      userState,
      moduleContext: { moduleId: "focus", modulePolicies: [learnedPolicyFixture()] },
      role4Signals: { ...buildRole4Signals(USER), strategyEffectiveness },
    });

    expect(userState).toEqual(userStateSnapshot);
    expect(buildRole4Signals(USER)).toEqual(recordsBefore);
  });
});

function runLearnedDecision(userId) {
  const strategyEffectiveness = toStrategyEffectiveness(reflectUserHistory(userId, { now: NOW }).signals);
  return decide({
    contextSnapshot: { timestamp: "2026-08-01T00:00:00.000Z" },
    userState: calmUserState(),
    moduleContext: { moduleId: "focus", modulePolicies: [learnedPolicyFixture()] },
    role4Signals: { ...buildRole4Signals(userId), strategyEffectiveness },
  });
}
