import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/socialCommunication/services/aiService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateEmotionDecoderScenario: vi.fn(),
  };
});

import { generateEmotionDecoderScenario } from "@/features/socialCommunication/services/aiService";
import { EmotionDecoderScenarioSchema } from "@/support/modules/emotionDecoder/emotionDecoderTypes";
import {
  buildDecoderConfig,
  buildDecoderPerformance,
  evaluateDecoderAnswer,
  generateDecoderScenario,
  getFallbackDecoderScenario,
  matchesInterpretation,
} from "@/support/modules/emotionDecoder/emotionDecoderService";

describe("emotion decoder service", () => {
  it("builds a config that respects signals and clamps difficulty", () => {
    expect(buildDecoderConfig({ difficulty: 3, signals: { simplify: true } })).toMatchObject({
      difficulty: 3,
      effectiveDifficulty: 2,
      hintsEnabled: false,
    });
    expect(buildDecoderConfig({ difficulty: 9 })).toMatchObject({ difficulty: 1 });
    expect(buildDecoderConfig({ activityType: "bogus" })).toMatchObject({ activityType: "daily_life" });
    expect(buildDecoderConfig({ difficulty: 1, signals: { provideHints: true } })).toMatchObject({
      hintsEnabled: true,
    });
  });

  it("returns the same fallback scenario for the same seed", () => {
    const first = getFallbackDecoderScenario({ effectiveDifficulty: 2, activityType: "friends", variantSeed: 3 });
    const second = getFallbackDecoderScenario({ effectiveDifficulty: 2, activityType: "friends", variantSeed: 3 });
    expect(first).toEqual(second);
    expect(first.id).toContain("fallback-decoder");
    expect(first.scenario).toBeTruthy();
    expect(first.expectedInterpretations.length).toBeGreaterThan(0);
  });

  it("uses AI output when it validates against the schema", async () => {
    generateEmotionDecoderScenario.mockResolvedValue({
      scenario: "A friend drops their phone in the hallway.",
      dialogue: "Oh no.",
      cues: ["a flat voice", "a quick sigh"],
      question: "What is this person most likely feeling?",
      expectedInterpretations: ["upset"],
      explanation: "A flat voice after a drop often means frustration.",
      difficulty: 2,
      activityType: "friends",
    });
    const outcome = await generateDecoderScenario(
      { difficulty: 2, activityType: "friends" },
      { apiKey: "test-key" },
    );
    expect(outcome.source).toBe("ai");
    expect(outcome.aiAvailable).toBe(true);
    expect(outcome.aiError).toBeNull();
    expect(EmotionDecoderScenarioSchema.safeParse(outcome.scenario).success).toBe(true);
  });

  it("degrades to the deterministic fallback when AI output is malformed", async () => {
    generateEmotionDecoderScenario.mockResolvedValue({ scenario: "missing everything" });
    const outcome = await generateDecoderScenario({ variantSeed: 1 }, { apiKey: "test-key" });
    expect(outcome.source).toBe("fallback");
    expect(outcome.aiAvailable).toBe(false);
    expect(outcome.scenario.expectedInterpretations.length).toBeGreaterThan(0);
  });

  it("never throws when the provider rejects", async () => {
    generateEmotionDecoderScenario.mockRejectedValue(new Error("provider down"));
    const outcome = await generateDecoderScenario({}, { apiKey: "test-key" });
    expect(outcome.source).toBe("fallback");
    expect(outcome.aiError).toContain("provider down");
  });

  it("grades free-text answers deterministically", () => {
    const scenario = {
      expectedInterpretations: ["upset", "embarrassed"],
      cues: ["a quiet voice"],
      explanation: "A quiet voice after dropping lunch usually means embarrassment.",
    };
    expect(evaluateDecoderAnswer({ scenario, answer: "upset" })).toMatchObject({
      answered: true,
      correct: true,
    });
    expect(evaluateDecoderAnswer({ scenario, answer: "I think they are embarrassed" })).toMatchObject({
      correct: true,
    });
    expect(evaluateDecoderAnswer({ scenario, answer: "hungry" })).toMatchObject({ correct: false });
    expect(evaluateDecoderAnswer({ scenario, answer: "" })).toMatchObject({ answered: false, correct: false });
  });

  it("matches single words as whole words only", () => {
    expect(matchesInterpretation("upsetting", "upset")).toBe(false);
    expect(matchesInterpretation("upset", "upset")).toBe(true);
  });

  it("builds a canonical performance signal", () => {
    const performance = buildDecoderPerformance({ attempts: 4, correct: 3, hintsUsed: 2, durationMs: 5000.6 });
    expect(performance).toMatchObject({
      completionStatus: "partially_completed",
      durationMs: 5000,
      metrics: { attempts: 4, correct: 3, accuracy: 0.75, hintsUsed: 2 },
    });
    expect(buildDecoderPerformance({})).toMatchObject({ completionStatus: "not_started" });
  });
});
