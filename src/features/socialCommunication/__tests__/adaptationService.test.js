import { describe, expect, it } from "vitest";
import {
  applyAdaptationSignals,
  consumeEngineOutput,
  parseEnginePlan,
} from "../services/adaptationService";
import { AdaptationActionType, AdaptationDimension } from "@/support/schemas/supportSchemas";
import { DEFAULT_ADAPTATION_SIGNALS } from "../types/communicationTypes";

describe("consumeEngineOutput", () => {
  it("degrades gracefully when the engine is disabled", () => {
    const result = consumeEngineOutput({ enabled: false, plan: null, trace: null, error: null });
    expect(result.available).toBe(false);
    expect(result.degraded.reason).toBe("engine_unavailable");
    expect(result.signals).toEqual({ ...DEFAULT_ADAPTATION_SIGNALS });
  });

  it("degrades gracefully on engine errors", () => {
    const result = consumeEngineOutput({ enabled: true, plan: null, trace: null, error: new Error("boom") });
    expect(result.available).toBe(false);
    expect(result.degraded.reason).toBe("engine_error");
  });

  it("degrades gracefully when no plan exists", () => {
    const result = consumeEngineOutput({ enabled: true, plan: null });
    expect(result.available).toBe(false);
    expect(result.degraded.reason).toBe("no_plan");
  });

  it("never throws on malformed input", () => {
    expect(() => consumeEngineOutput({ plan: { actions: "oops" } })).not.toThrow();
    expect(() => consumeEngineOutput({ plan: 42 })).not.toThrow();
  });
});

describe("parseEnginePlan", () => {
  it("maps a simplify action to the simplify signal", () => {
    const signals = parseEnginePlan({
      actions: [{ target: AdaptationDimension.CONTENT, type: AdaptationActionType.SIMPLIFY }],
    });
    expect(signals.simplify).toBe(true);
    expect(signals.active).toBe(true);
  });

  it("maps pacing + assistance actions", () => {
    const signals = parseEnginePlan({
      actions: [
        { target: AdaptationDimension.PACING, type: AdaptationActionType.DECREASE },
        { target: AdaptationDimension.ASSISTANCE, type: AdaptationActionType.GUIDE },
      ],
    });
    expect(signals.slowPace).toBe(true);
    expect(signals.provideHints).toBe(true);
  });

  it("maps recommend to recommendEasier", () => {
    const signals = parseEnginePlan({
      actions: [{ target: AdaptationDimension.TASK, type: AdaptationActionType.RECOMMEND }],
    });
    expect(signals.recommendEasier).toBe(true);
  });

  it("stays inactive for an empty plan", () => {
    const signals = parseEnginePlan({ actions: [] });
    expect(signals.active).toBe(false);
  });
});

describe("applyAdaptationSignals", () => {
  const session = { difficulty: 4, effectiveDifficulty: 4, turns: [] };

  it("returns the same reference when nothing is active", () => {
    expect(applyAdaptationSignals(session, { ...DEFAULT_ADAPTATION_SIGNALS })).toBe(session);
    expect(applyAdaptationSignals(session, null)).toBe(session);
  });

  it("is non-mutating", () => {
    const before = JSON.stringify(session);
    const adapted = applyAdaptationSignals(session, {
      ...DEFAULT_ADAPTATION_SIGNALS,
      active: true,
      slowPace: true,
    });
    expect(JSON.stringify(session)).toBe(before);
    expect(adapted.adaptation.pacing).toBe("slow");
  });

  it("lowers effective difficulty when simplify is signalled", () => {
    const adapted = applyAdaptationSignals(session, {
      ...DEFAULT_ADAPTATION_SIGNALS,
      active: true,
      simplify: true,
    });
    expect(adapted.adaptation.effectiveDifficulty).toBe(3);
  });
});
