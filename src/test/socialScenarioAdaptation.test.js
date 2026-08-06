import { describe, expect, it } from "vitest";
import {
  applyAdaptationSignals,
  consumeEngineOutput,
  getNextEasierDifficulty,
  parseEnginePlan,
  recommendEasierScenario,
} from "@/support/modules/socialScenarioSimulator/adaptationService";
import {
  ADAPTATION_SIGNALS,
  DEFAULT_ADAPTATION_SIGNALS,
} from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";
import { AdaptationActionType, AdaptationDimension } from "@/support/schemas/supportSchemas";

describe("adaptation service", () => {
  it("parses a null plan into the inactive defaults", () => {
    const parsed = parseEnginePlan(null);
    expect(parsed.active).toBe(false);
    expect(parsed.simplifyScenario).toBe(false);
    expect(parsed.slowPace).toBe(false);
    expect(parsed.reduceDistractions).toBe(false);
    expect(parsed.recommendEasierScenario).toBe(false);
  });

  it("maps a UI/REDUCE action to reduceDistractions", () => {
    const parsed = parseEnginePlan({
      actions: [
        { type: AdaptationActionType.REDUCE, target: AdaptationDimension.UI },
      ],
    });
    expect(parsed.active).toBe(true);
    expect(parsed.reduceDistractions).toBe(true);
  });

  it("maps a CONTENT/SIMPLIFY action to simplifyScenario", () => {
    const parsed = parseEnginePlan({
      actions: [
        { type: AdaptationActionType.SIMPLIFY, target: AdaptationDimension.CONTENT },
      ],
    });
    expect(parsed.simplifyScenario).toBe(true);
  });

  it("maps a PACING/DECREASE action to slowPace", () => {
    const parsed = parseEnginePlan({
      actions: [
        { type: AdaptationActionType.DECREASE, target: AdaptationDimension.PACING },
      ],
    });
    expect(parsed.slowPace).toBe(true);
  });

  it("maps a RECOMMEND action to recommendEasierScenario", () => {
    const parsed = parseEnginePlan({
      actions: [{ type: AdaptationActionType.RECOMMEND }],
    });
    expect(parsed.recommendEasierScenario).toBe(true);
  });

  it("ignores unrelated actions", () => {
    const parsed = parseEnginePlan({
      actions: [
        { type: AdaptationActionType.INCREASE, target: AdaptationDimension.NOTIFICATIONS },
      ],
    });
    expect(parsed.active).toBe(false);
  });

  it("degrades gracefully when the engine is disabled", () => {
    const result = consumeEngineOutput({ plan: null, enabled: false });
    expect(result.available).toBe(false);
    expect(result.degraded.reason).toBe("engine_unavailable");
    expect(result.signals).toEqual(DEFAULT_ADAPTATION_SIGNALS);
  });

  it("degrades gracefully when the engine errors", () => {
    const result = consumeEngineOutput({ plan: null, enabled: true, error: new Error("boom") });
    expect(result.available).toBe(false);
    expect(result.degraded.reason).toBe("engine_error");
  });

  it("degrades gracefully when no plan is produced", () => {
    const result = consumeEngineOutput({ plan: null, enabled: true });
    expect(result.available).toBe(false);
    expect(result.degraded.reason).toBe("no_plan");
  });

  it("activates when a valid plan is produced", () => {
    const result = consumeEngineOutput({
      enabled: true,
      trace: { decisionTraceId: "trace-1", sources: ["preferences"] },
      plan: {
        decisionTraceId: "plan-1",
        actions: [
          { type: AdaptationActionType.SIMPLIFY, target: AdaptationDimension.CONTENT },
        ],
      },
    });
    expect(result.available).toBe(true);
    expect(result.signals.active).toBe(true);
    expect(result.signals.simplifyScenario).toBe(true);
    expect(result.decisionTraceId).toBe("plan-1");
  });

  it("never throws on malformed plans", () => {
    expect(() => consumeEngineOutput({ plan: { actions: "nope" }, enabled: true })).not.toThrow();
    const result = consumeEngineOutput({ plan: { actions: "nope" }, enabled: true });
    expect(result.available).toBe(true);
    expect(result.signals.active).toBe(false);
  });

  it("steps difficulty down one level at a time", () => {
    expect(getNextEasierDifficulty("hard")).toBe("medium");
    expect(getNextEasierDifficulty("medium")).toBe("easy");
    expect(getNextEasierDifficulty("easy")).toBe("easy");
    expect(getNextEasierDifficulty("unknown")).toBe("easy");
  });

  it("recommends the easiest uncompleted scenario in the category", () => {
    const scenario = { id: "daily_life.neighbor-noise", category: "daily_life" };
    const first = recommendEasierScenario(scenario, []);
    expect(first.difficulty).toBe("easy");
    expect(first.id).toBe("daily_life.cafe-order");
    const second = recommendEasierScenario(scenario, ["daily_life.cafe-order"]);
    expect(second.id).toBe("daily_life.returning-item");
  });

  it("returns null when no scenario is given", () => {
    expect(recommendEasierScenario(null)).toBeNull();
  });

  it("applies signals immutably to a session", () => {
    const session = { difficulty: "medium", adaptation: {} };
    const adapted = applyAdaptationSignals(session, {
      ...DEFAULT_ADAPTATION_SIGNALS,
      active: true,
      simplifyScenario: true,
      slowPace: true,
      reduceDistractions: true,
    });
    expect(adapted).not.toBe(session);
    expect(session.adaptation).toEqual({});
    expect(adapted.adaptation.effectiveDifficulty).toBe("easy");
    expect(adapted.adaptation.pacing).toBe("slow");
    expect(adapted.adaptation.distractionFree).toBe(true);
  });

  it("returns the same session when signals are inactive", () => {
    const session = { difficulty: "medium", adaptation: {} };
    expect(applyAdaptationSignals(session, { ...DEFAULT_ADAPTATION_SIGNALS, active: false })).toBe(session);
    expect(applyAdaptationSignals(session, null)).toBe(session);
  });

  it("exposes the four signal keys on the defaults", () => {
    const keys = Object.keys(DEFAULT_ADAPTATION_SIGNALS);
    expect(keys).toEqual(
      expect.arrayContaining([
        "active",
        ADAPTATION_SIGNALS.SIMPLIFY_SCENARIO,
        ADAPTATION_SIGNALS.SLOW_PACE,
        ADAPTATION_SIGNALS.REDUCE_DISTRACTIONS,
        ADAPTATION_SIGNALS.RECOMMEND_EASIER_SCENARIO,
      ]),
    );
  });
});
