import { describe, expect, it, afterEach } from "vitest";
import {
  configureAdaptiveFlags,
  resetAdaptiveFlags,
} from "@backend/adaptive/engine/featureFlags";
import { decide } from "@backend/adaptive/engine/adaptiveEngine";
import { buildModuleContext } from "@/support/framework/moduleContextAdapter";
import { deriveModuleAdjustments } from "@/components/adaptive/AdaptiveUIRuntime.jsx";
import {
  deriveFeatureSignals,
  buildAnxietyConfig,
  buildGroundingConfig,
  buildGentleActivityConfig,
} from "@/adaptive/featureConfiguration";
import {
  mapSubjectiveOutcomeToRating,
  ratingFromConversationScore,
  resolveOutcomeRating,
} from "@/adaptive/reflection/outcomeRatings";
import {
  generateEffectivenessSignals,
  toStrategyEffectiveness,
} from "@/adaptive/reflection/reflectionEngine";
import { buildGentleActivityOutcome } from "@/support/modules/gentleActivity/gentleActivityService";
import { buildGroundingOutcome } from "@/support/modules/grounding/groundingService";
import {
  SOCIAL_SCENARIO_MODULE_ID,
  SOCIAL_SCENARIO_STRATEGY_ID,
  buildScenarioConfig,
} from "@/support/modules/socialScenarioSimulator/scenarioService";
import { parseEnginePlan } from "@/features/socialCommunication/services/adaptationService";
import { computeNextDifficulty } from "@/features/socialCommunication/services/difficultyController";

afterEach(() => {
  resetAdaptiveFlags();
});

describe("outcomeRatings shared helper", () => {
  it("maps qualitative tokens to the canonical 1-3-5 scale", () => {
    expect(mapSubjectiveOutcomeToRating("better")).toBe(5);
    expect(mapSubjectiveOutcomeToRating("same")).toBe(3);
    expect(mapSubjectiveOutcomeToRating("worse")).toBe(1);
    expect(mapSubjectiveOutcomeToRating("Improved")).toBe(5);
    expect(mapSubjectiveOutcomeToRating("unchanged")).toBe(3);
    expect(mapSubjectiveOutcomeToRating("declined")).toBe(1);
    expect(mapSubjectiveOutcomeToRating("nonsense")).toBeNull();
  });

  it("reads the qualitative token from outcome field variants", () => {
    expect(mapSubjectiveOutcomeToRating({ subjective: "better" })).toBe(5);
    expect(mapSubjectiveOutcomeToRating({ userFeedback: "worse" })).toBe(1);
    expect(mapSubjectiveOutcomeToRating({ completionStatus: "same" })).toBe(3);
  });

  it("maps conversation scores to the 1-3-5 scale", () => {
    expect(ratingFromConversationScore(85)).toBe(5);
    expect(ratingFromConversationScore(80)).toBe(5);
    expect(ratingFromConversationScore(60)).toBe(3);
    expect(ratingFromConversationScore(55)).toBe(3);
    expect(ratingFromConversationScore(40)).toBe(1);
    expect(ratingFromConversationScore("n/a")).toBeNull();
    expect(ratingFromConversationScore(NaN)).toBeNull();
  });

  it("resolveOutcomeRating prefers explicit rating, then qualitative, then score", () => {
    expect(resolveOutcomeRating({ rating: 4 })).toBe(4);
    expect(resolveOutcomeRating({ subjective: "better" })).toBe(5);
    expect(resolveOutcomeRating({ score: 70 })).toBe(3);
    expect(resolveOutcomeRating({})).toBeNull();
  });
});

describe("Tier 9 learned personalization closed loop", () => {
  it("generates a CONTENT REORDER prefer action when a strategy scores ≥ 0.6", () => {
    configureAdaptiveFlags({ runtime: true, reflection: true });
    const context = buildModuleContext("anxiety.hub");
    const { plan } = decide(
      {
        contextSnapshot: {},
        moduleContext: context,
        role4Signals: {
          strategyEffectiveness: {
            "anxiety.hub:guided_breathing": 0.8,
          },
        },
      },
      { decisionTraceId: "tier9-prefer-test", now: 1000 },
    );

    const adjustments = deriveModuleAdjustments(plan);
    const preferAdjustment = adjustments.find(
      (adj) => adj.type === "REORDER" && adj.target === "CONTENT",
    );
    expect(preferAdjustment).toBeDefined();
    expect(preferAdjustment.parameters.strategyId).toBe(
      "anxiety.hub:guided_breathing",
    );
    expect(preferAdjustment.parameters.preference).toBe("prefer");

    const signals = deriveFeatureSignals(adjustments);
    expect(signals.preferredStrategyId).toBe("anxiety.hub:guided_breathing");
    expect(signals.deprioritizedStrategyId).toBeNull();

    const cfg = buildAnxietyConfig({ signals });
    expect(cfg.active).toBe(true);
  });

  it("generates a CONTENT REDUCE deprioritize action when a strategy scores ≤ 0.4", () => {
    configureAdaptiveFlags({ runtime: true, reflection: true });
    const context = buildModuleContext("anxiety.hub");
    const { plan } = decide(
      {
        contextSnapshot: {},
        moduleContext: context,
        role4Signals: {
          strategyEffectiveness: {
            "anxiety.hub:grounding_exercise": 0.2,
          },
        },
      },
      { decisionTraceId: "tier9-deprioritize-test", now: 2000 },
    );

    const adjustments = deriveModuleAdjustments(plan);
    const deprioritize = adjustments.find(
      (adj) => adj.type === "REDUCE" && adj.target === "CONTENT",
    );
    expect(deprioritize).toBeDefined();
    expect(deprioritize.parameters.strategyId).toBe(
      "anxiety.hub:grounding_exercise",
    );
    expect(deprioritize.parameters.preference).toBe("deprioritize");

    const signals = deriveFeatureSignals(adjustments);
    expect(signals.deprioritizedStrategyId).toBe(
      "anxiety.hub:grounding_exercise",
    );
    expect(signals.preferredStrategyId).toBeNull();
  });

  it("resolveConflicts picks the highest-priority prefer when multiple strategies cross threshold", () => {
    configureAdaptiveFlags({ runtime: true, reflection: true });
    const context = buildModuleContext("anxiety.hub");
    const { plan } = decide(
      {
        contextSnapshot: {},
        moduleContext: context,
        role4Signals: {
          strategyEffectiveness: {
            "anxiety.hub:grounding_exercise": 0.9,
            "anxiety.hub:guided_breathing": 0.85,
          },
        },
      },
      { decisionTraceId: "tier9-conflict-test", now: 3000 },
    );

    const adjustments = deriveModuleAdjustments(plan);
    const prefer = adjustments.find(
      (adj) => adj.type === "REORDER" && adj.target === "CONTENT",
    );
    // guided_breathing has preferPriority 95 > grounding_exercise 93,
    // so it wins the per-target CONTENT conflict.
    expect(prefer.parameters.strategyId).toBe("anxiety.hub:guided_breathing");
  });

  it("generates no Tier 9 actions without role4Signals", () => {
    configureAdaptiveFlags({ runtime: true, reflection: true });
    const context = buildModuleContext("anxiety.hub");
    const { plan } = decide(
      { contextSnapshot: {}, moduleContext: context },
      { decisionTraceId: "tier9-no-signals-test", now: 4000 },
    );

    const adjustments = deriveModuleAdjustments(plan);
    const tier9 = adjustments.filter(
      (adj) =>
        adj.type === "REORDER" || adj.type === "REDUCE",
    );
    expect(tier9.length).toBe(0);
  });

  it("grounding Tier 9 rules fire for support.grounding:grounding strategy", () => {
    configureAdaptiveFlags({ runtime: true, reflection: true });
    const context = buildModuleContext("support.grounding");
    const { plan } = decide(
      {
        contextSnapshot: {},
        moduleContext: context,
        role4Signals: {
          strategyEffectiveness: {
            "support.grounding:grounding": 0.7,
          },
        },
      },
      { decisionTraceId: "tier9-grounding-test", now: 5000 },
    );

    const adjustments = deriveModuleAdjustments(plan);
    const prefer = adjustments.find(
      (adj) => adj.type === "REORDER" && adj.target === "CONTENT",
    );
    expect(prefer).toBeDefined();
    expect(prefer.parameters.strategyId).toBe("support.grounding:grounding");
    expect(prefer.parameters.preference).toBe("prefer");
  });

  it("gentle activity and grounding outcomes surface userRating for reflection", () => {
    expect(
      buildGentleActivityOutcome({ configuration: {}, completedSteps: 5, subjective: "better" }).userRating,
    ).toBe(5);
    expect(
      buildGentleActivityOutcome({ configuration: {}, completedSteps: 2, rating: 2 }).userRating,
    ).toBe(2);
    expect(
      buildGroundingOutcome({ configuration: {}, completedSteps: 1, subjective: "worse" }).userRating,
    ).toBe(1);
    expect(buildGroundingOutcome({ configuration: {}, completedSteps: 1 })).not.toHaveProperty("userRating");
    expect(buildGentleActivityOutcome({ configuration: {}, completedSteps: 1 })).not.toHaveProperty("userRating");
  });

  it("rated gentle-activity outcomes reflect into support.gentle_activity:behavioral_activation effectiveness", () => {
    const outcomes = [5, 5, 5].map((rating, index) => ({
      moduleId: "support.gentle_activity",
      interventionType: "behavioral_activation",
      rating,
      completed: true,
      status: "completed",
      createdAt: new Date(10 + index).toISOString(),
    }));
    const signals = generateEffectivenessSignals({ outcomes });
    const byStrategy = toStrategyEffectiveness(signals);
    expect(byStrategy["support.gentle_activity:behavioral_activation"]).toBe(1);
  });

  it("grounding learned preference surfaces endorsedByHistory in the feature config", () => {
    configureAdaptiveFlags({ runtime: true, reflection: true });
    const context = buildModuleContext("support.grounding");
    const { plan } = decide(
      {
        contextSnapshot: {},
        moduleContext: context,
        role4Signals: {
          strategyEffectiveness: { "support.grounding:grounding": 0.7 },
        },
      },
      { decisionTraceId: "tier9-grounding-config-test", now: 6000 },
    );
    const signals = deriveFeatureSignals(deriveModuleAdjustments(plan));
    const cfg = buildGroundingConfig({ signals });
    expect(cfg.mode).toBe("history_preferred");
    expect(cfg.endorsedByHistory).toBe(true);
  });

  it("gentle activity deprioritization surfaces discouragedByHistory in the feature config", () => {
    configureAdaptiveFlags({ runtime: true, reflection: true });
    const context = buildModuleContext("support.gentle_activity");
    const { plan } = decide(
      {
        contextSnapshot: {},
        moduleContext: context,
        role4Signals: {
          strategyEffectiveness: {
            "support.gentle_activity:behavioral_activation": 0.2,
          },
        },
      },
      { decisionTraceId: "tier9-gentle-config-test", now: 7000 },
    );
    const signals = deriveFeatureSignals(deriveModuleAdjustments(plan));
    const cfg = buildGentleActivityConfig({ signals });
    expect(cfg.mode).toBe("history_deprioritized");
    expect(cfg.discouragedByHistory).toBe(true);
  });

  it("social scenario Tier 9 rules fire for asd.social-scenarios:social_scenario_simulation", () => {
    configureAdaptiveFlags({ runtime: true, reflection: true });
    const context = buildModuleContext("asd.social-scenarios");
    const { plan } = decide(
      {
        contextSnapshot: {},
        moduleContext: context,
        role4Signals: {
          strategyEffectiveness: {
            "asd.social-scenarios:social_scenario_simulation": 0.75,
          },
        },
      },
      { decisionTraceId: "tier9-scenario-prefer-test", now: 8000 },
    );

    const adjustments = deriveModuleAdjustments(plan);
    const prefer = adjustments.find(
      (adj) => adj.type === "REORDER" && adj.target === "CONTENT",
    );
    expect(prefer).toBeDefined();
    expect(prefer.parameters.strategyId).toBe(
      "asd.social-scenarios:social_scenario_simulation",
    );
    expect(prefer.parameters.preference).toBe("prefer");
  });

  it("social scenario history preference biases delivery difficulty and cues", () => {
    expect(
      buildScenarioConfig({
        category: "workplace",
        difficulty: "easy",
        signals: { preferredStrategyId: SOCIAL_SCENARIO_STRATEGY_ID },
      }),
    ).toMatchObject({
      preferredByHistory: true,
      deprioritizedByHistory: false,
      difficultyPreference: "next_level",
    });

    expect(
      buildScenarioConfig({
        category: "workplace",
        difficulty: "hard",
        signals: { deprioritizedStrategyId: SOCIAL_SCENARIO_STRATEGY_ID },
      }),
    ).toMatchObject({
      preferredByHistory: false,
      deprioritizedByHistory: true,
      difficultyPreference: "ease_down",
    });
  });

  it("scored scenario outcomes reflect into the strategy effectiveness signal", () => {
    const outcomes = [82, 90, 95].map((score, index) => ({
      moduleId: SOCIAL_SCENARIO_MODULE_ID,
      interventionType: "social_scenario_simulation",
      rating: resolveOutcomeRating({ score }),
      completed: true,
      status: "completed",
      createdAt: new Date(10 + index).toISOString(),
    }));

    const byStrategy = toStrategyEffectiveness(
      generateEffectivenessSignals({ outcomes }),
    );
    expect(
      byStrategy["asd.social-scenarios:social_scenario_simulation"],
    ).toBeGreaterThanOrEqual(0.6);
  });

  it("communication Tier 9 prefer drives recommendProgress toward a higher difficulty", () => {
    configureAdaptiveFlags({ runtime: true, reflection: true });
    const context = buildModuleContext("communication.simulator");
    const { plan } = decide(
      {
        contextSnapshot: {},
        moduleContext: context,
        role4Signals: {
          strategyEffectiveness: {
            "communication.simulator:communication_simulation": 0.85,
          },
        },
      },
      { decisionTraceId: "tier9-comm-prefer-test", now: 9000 },
    );

    const signals = parseEnginePlan(plan);
    expect(signals.recommendProgress).toBe(true);
    expect(signals.recommendEasier).toBe(false);
    expect(signals.preferredStrategyId).toBe(
      "communication.simulator:communication_simulation",
    );

    const next = computeNextDifficulty({
      current: 3,
      scores: [],
      recommendProgress: signals.recommendProgress,
      preferredStrategyId: signals.preferredStrategyId,
    });
    expect(next.difficulty).toBe(4);
    expect(next.reason).toBe("engine_progression");
  });

  it("communication Tier 9 deprioritize drives recommendEasier toward an easier difficulty", () => {
    configureAdaptiveFlags({ runtime: true, reflection: true });
    const context = buildModuleContext("communication.simulator");
    const { plan } = decide(
      {
        contextSnapshot: {},
        moduleContext: context,
        role4Signals: {
          strategyEffectiveness: {
            "communication.simulator:communication_simulation": 0.2,
          },
        },
      },
      { decisionTraceId: "tier9-comm-deprioritize-test", now: 10000 },
    );

    const signals = parseEnginePlan(plan);
    expect(signals.recommendEasier).toBe(true);
    expect(signals.recommendProgress).toBe(false);
    expect(signals.deprioritizedStrategyId).toBe(
      "communication.simulator:communication_simulation",
    );

    const next = computeNextDifficulty({
      current: 3,
      scores: [],
      recommendEasier: signals.recommendEasier,
      deprioritizedStrategyId: signals.deprioritizedStrategyId,
    });
    expect(next.difficulty).toBe(2);
    expect(next.reason).toBe("engine_recommendation");
  });
});
