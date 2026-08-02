import { describe, expect, it } from "vitest";
import {
  buildModuleContext,
  buildModuleContextFromDefinition,
  listModuleContexts,
} from "@/support/framework/moduleContextAdapter";
import {
  getSupportModuleById,
  getSupportModules,
} from "@/support/framework/supportModuleRegistry";
import {
  AdaptationActionType,
  AdaptationDimension,
  ModuleCategory,
  PolicyScope,
  PriorityTier,
  SafetyLevel,
  TriggerCondition,
  TriggerGroupOperator,
} from "@/support/schemas/supportSchemas";

describe("moduleContextAdapter", () => {
  it("normalizes a support module definition into the ModuleContext contract", () => {
    const context = buildModuleContext("ocd.exposure-session");
    const definition = getSupportModuleById("ocd.exposure-session");

    expect(context.moduleId).toBe(definition.id);
    expect(context.title).toBe(definition.title);
    expect(context.category).toBe(ModuleCategory.SPECIALIZED);
    expect(context.interventionTypes).toEqual(definition.interventionTypes);
    expect(context.route).toBe(definition.route);
    expect(context.tags).toEqual(definition.tags);
    expect(context.disorders).toEqual(definition.disorders);
    expect(context.expectedOutcomeMetrics).toEqual(definition.expectedOutcomeMetrics);
    expect(context.safetyLevel).toBe(SafetyLevel.CAUTION);
    expect(context.repetitionLimit).toBe(2);
    expect(context.supportedRoles).toEqual(["user"]);
    expect(context.coreFeatures).toEqual([]);
    expect(context.supportedAdaptationDimensions).toEqual([]);
    expect(context.restrictedDimensions).toEqual([]);
    expect(context.constraints).toEqual([]);
    expect(context.goals).toEqual([]);
    expect(context.modulePolicies).toEqual([]);
  });

  it("maps repetitionLimit maxCount into the numeric contract field", () => {
    const emotion = buildModuleContext("adhd.emotion-coach");
    const emotionDefinition = getSupportModuleById("adhd.emotion-coach");
    expect(emotion.repetitionLimit).toBe(emotionDefinition.repetitionLimit.maxCount);
    expect(emotion.repetitionLimit).toBe(4);
  });

  it("lists normalized contexts for every registered module", () => {
    const contexts = listModuleContexts();
    const definitions = getSupportModules();

    expect(contexts).toHaveLength(definitions.length);
    expect(contexts.map((context) => context.moduleId).sort()).toEqual(
      definitions.map((definition) => definition.id).sort(),
    );
    contexts.forEach((context) => {
      expect(context.moduleId).toBeTruthy();
      expect(context.title).toBeTruthy();
      expect(context.interventionTypes.length).toBeGreaterThan(0);
      expect(context.moduleId).toBe(context.moduleId);
    });
  });

  it("throws for an unknown module id", () => {
    expect(() => buildModuleContext("unknown.module")).toThrow(/No support module definition/);
  });

  it("injects runtime state and derived task/goal references", () => {
    const context = buildModuleContext("adhd.focus-sessions", {
      moduleState: { blocksRemaining: 2 },
      currentTask: {
        kind: "derived",
        source: "contextSnapshot",
        description: "staying on task",
      },
      currentGoal: {
        kind: "derived",
        source: "userState",
        description: "reduce interruptions",
      },
    });

    expect(context.moduleState).toEqual({ blocksRemaining: 2 });
    expect(context.currentTask.source).toBe("contextSnapshot");
    expect(context.currentGoal.kind).toBe("derived");
  });

  it("rejects task references that are not marked derived", () => {
    expect(() =>
      buildModuleContext("adhd.focus-sessions", { currentTask: { source: "fabricated" } }),
    ).toThrow();
  });
});

describe("ModuleContext additive definition fields", () => {
  it("accepts and preserves additive fields on a module definition", () => {
    const context = buildModuleContextFromDefinition({
      id: "test.module",
      title: "Test Module",
      description: "A test module",
      category: ModuleCategory.LEARNING,
      interventionTypes: ["reading_support"],
      route: "/test/module",
      coreFeatures: ["pacing", "tts"],
      supportedAdaptationDimensions: [
        AdaptationDimension.PACING,
        AdaptationDimension.CONTENT,
      ],
      restrictedDimensions: [AdaptationDimension.TIMING],
      constraints: [{ type: "timing", value: { windowHours: 24 } }],
      goals: [{ id: "goal-1", label: "Reduce reading fatigue", metric: "fatigue_index" }],
      modulePolicies: [
        {
          id: "test.module.policy",
          scope: PolicyScope.MODULE,
          tier: PriorityTier.CURRENT_STATE,
          priority: 50,
          triggerGroups: [
            {
              operator: TriggerGroupOperator.AND,
              triggers: [
                { dimension: "fatigue", condition: TriggerCondition.GTE, value: 0.8 },
              ],
            },
          ],
          action: { type: AdaptationActionType.SIMPLIFY, target: AdaptationDimension.CONTENT },
        },
      ],
    });

    expect(context.coreFeatures).toEqual(["pacing", "tts"]);
    expect(context.supportedAdaptationDimensions).toEqual([
      AdaptationDimension.PACING,
      AdaptationDimension.CONTENT,
    ]);
    expect(context.restrictedDimensions).toEqual([AdaptationDimension.TIMING]);
    expect(context.constraints).toEqual([{ type: "timing", value: { windowHours: 24 } }]);
    expect(context.goals[0].label).toBe("Reduce reading fatigue");
    expect(context.modulePolicies).toHaveLength(1);
  });

  it("injects moduleId into module-scoped policies", () => {
    const context = buildModuleContextFromDefinition({
      id: "test.module",
      title: "Test Module",
      description: "A test module",
      category: ModuleCategory.EMOTIONAL,
      interventionTypes: ["grounding"],
      route: "/test/module",
      modulePolicies: [
        {
          id: "test.module.policy",
          scope: PolicyScope.MODULE,
          tier: PriorityTier.CURRENT_STATE,
          triggerGroups: [
            {
              operator: TriggerGroupOperator.AND,
              triggers: [
                { dimension: "stress", condition: TriggerCondition.GTE, value: 0.9 },
              ],
            },
          ],
          action: { type: AdaptationActionType.GUIDE, target: AdaptationDimension.ASSISTANCE },
        },
      ],
    });

    expect(context.modulePolicies[0].moduleId).toBe("test.module");
  });

  it("preserves existing module definitions unchanged without additive fields", () => {
    const context = buildModuleContextFromDefinition({
      id: "legacy.module",
      title: "Legacy Module",
      description: "No additive fields",
      category: ModuleCategory.EXECUTIVE,
      interventionTypes: ["planning_support"],
      route: "/legacy",
    });

    expect(context.coreFeatures).toEqual([]);
    expect(context.supportedAdaptationDimensions).toEqual([]);
    expect(context.restrictedDimensions).toEqual([]);
    expect(context.constraints).toEqual([]);
    expect(context.goals).toEqual([]);
    expect(context.modulePolicies).toEqual([]);
    expect(context.supportedRoles).toEqual(["user"]);
    expect(context.repetitionLimit).toBe(2);
  });
});
