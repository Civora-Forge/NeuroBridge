import { describe, expect, it, vi } from "vitest";
import * as aiService from "../services/aiService";
import {
  buildScenarioConfig,
  generateScenario,
  getFallbackScenario,
} from "../services/scenarioGenerator";
import { SCENARIO_SOURCE } from "../types/communicationTypes";

describe("buildScenarioConfig", () => {
  it("defaults out-of-range difficulty to the default level", () => {
    expect(buildScenarioConfig({ difficulty: 99 }).difficulty).toBe(3);
    expect(buildScenarioConfig({ difficulty: -3 }).difficulty).toBe(3);
  });

  it("applies the simplify signal to the effective difficulty", () => {
    const config = buildScenarioConfig({ difficulty: 4, signals: { simplify: true } });
    expect(config.effectiveDifficulty).toBe(3);
  });

  it("defaults an unknown domain to small talk", () => {
    const config = buildScenarioConfig({ domain: "nope" });
    expect(config.domain).toBe("small_talk");
  });
});

describe("getFallbackScenario", () => {
  it("produces a complete, validated-shaped scenario deterministically", () => {
    const first = getFallbackScenario({ domain: "requesting_help", effectiveDifficulty: 2, variantSeed: 7 });
    const second = getFallbackScenario({ domain: "requesting_help", effectiveDifficulty: 2, variantSeed: 7 });
    expect(first).toEqual(second);
    expect(first.id).toContain("fallback");
    expect(first.goal.length).toBeGreaterThan(0);
    expect(first.npc.name).toBeTruthy();
    expect(first.openingLine.length).toBeGreaterThan(0);
    expect(first.suggestedResponses.length).toBeGreaterThanOrEqual(1);
  });

  it("varies by variant seed so scenarios are not a fixed list", () => {
    const a = getFallbackScenario({ domain: "initiating", effectiveDifficulty: 3, variantSeed: 0 });
    const b = getFallbackScenario({ domain: "initiating", effectiveDifficulty: 3, variantSeed: 1 });
    expect(a.openingLine).not.toBe(b.openingLine);
  });

  it("omits the hint when hints are disabled", () => {
    const scenario = getFallbackScenario({ domain: "saying_no", effectiveDifficulty: 5, hintsEnabled: false });
    expect(scenario.hint).toBe("");
  });
});

describe("generateScenario", () => {
  it("uses the AI provider when available", async () => {
    const spy = vi.spyOn(aiService, "generateScenarioContent").mockResolvedValue({
      domain: "small_talk",
      title: "AI scenario",
      setting: "a park",
      goal: "chat",
      context: "c",
      npc: { name: "A", role: "r", personality: "p" },
      openingLine: "Hi",
      suggestedResponses: ["a", "b", "c"],
      hint: "",
    });

    const { scenario, source, aiAvailable } = await generateScenario(
      { domain: "small_talk", difficulty: 3 },
      { apiKey: "key" },
    );
    expect(source).toBe(SCENARIO_SOURCE.AI);
    expect(aiAvailable).toBe(true);
    expect(scenario.title).toBe("AI scenario");
    spy.mockRestore();
  });

  it("degrades to the deterministic fallback when AI fails", async () => {
    const spy = vi.spyOn(aiService, "generateScenarioContent").mockResolvedValue(null);

    const { scenario, source, aiAvailable } = await generateScenario(
      { domain: "saying_no", difficulty: 3 },
      { apiKey: "key" },
    );
    expect(source).toBe(SCENARIO_SOURCE.FALLBACK);
    expect(aiAvailable).toBe(false);
    expect(scenario.id).toContain("fallback");
    spy.mockRestore();
  });

  it("works without an api key at all (offline mode)", async () => {
    const { scenario, source } = await generateScenario({ domain: "clarifying", difficulty: 1 });
    expect(source).toBe(SCENARIO_SOURCE.FALLBACK);
    expect(scenario.suggestedResponses.length).toBeGreaterThan(0);
  });
});
