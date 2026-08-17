import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/socialCommunication/services/aiService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateSocialScenario: vi.fn(),
  };
});

import { generateSocialScenario } from "@/features/socialCommunication/services/aiService";
import { SocialScenarioSchema } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";
import {
  buildScenarioConfig,
  generateScenario,
  getFallbackScenario,
  getScenarioAttemptStats,
  listScenarioAttempts,
  normalizeScenario,
  recordScenarioAttempt,
} from "@/support/modules/socialScenarioSimulator/scenarioService";

describe("social scenario service", () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("builds a config that normalizes inputs and respects signals", () => {
    expect(buildScenarioConfig({ category: "bogus", difficulty: "hard" })).toMatchObject({
      category: "daily_life",
      difficulty: "hard",
      hintsEnabled: false,
    });
    expect(
      buildScenarioConfig({
        category: "workplace",
        difficulty: "nope",
        signals: { provideHints: true, slowPace: true },
      }),
    ).toMatchObject({
      category: "workplace",
      difficulty: "easy",
      hintsEnabled: true,
      slowPace: true,
    });
  });

  it("returns the same fallback scenario for the same seed and rotates with it", () => {
    const first = getFallbackScenario({ category: "college", difficulty: "medium", variantSeed: 2 });
    const second = getFallbackScenario({ category: "college", difficulty: "medium", variantSeed: 2 });
    expect(first).toEqual(second);
    expect(first.category).toBe("college");
    expect(first.difficulty).toBe("medium");
    expect(first.question).toBeTruthy();
    expect(first.suggestedResponse).toBeTruthy();
    expect(first.source).toBe("fallback");

    const rotated = getFallbackScenario({ category: "college", difficulty: "medium", variantSeed: 3 });
    expect(rotated.id).not.toBe(first.id);
  });

  it("normalizes a valid AI scenario into the module contract", () => {
    const raw = {
      category: "workplace",
      title: "Asking for help",
      setting: "an office",
      situation: "You are stuck on a task.",
      role: "a colleague",
      question: "How is it going?",
      cues: ["the colleague is free", "you are stuck"],
      suggestedResponse: "Could you help me?",
      hint: "Be specific.",
    };
    const scenario = normalizeScenario(raw, { difficulty: "easy" });
    expect(SocialScenarioSchema.safeParse(scenario).success).toBe(true);
    expect(scenario.source).toBe("ai");
    expect(scenario.difficulty).toBe("easy");
  });

  it("returns null for an unusable AI scenario", () => {
    expect(normalizeScenario({ category: "workplace" }, {})).toBeNull();
    expect(normalizeScenario(null, {})).toBeNull();
    expect(normalizeScenario({ situation: "x", question: "y", suggestedResponse: "z", cues: [] }, {})).toBeNull();
  });

  it("uses AI output when it validates against the schema", async () => {
    generateSocialScenario.mockResolvedValue({
      category: "daily_life",
      title: "Queue",
      setting: "a shop",
      situation: "Someone jumps the line.",
      role: "a customer",
      question: "What do you say?",
      cues: ["the line is short"],
      suggestedResponse: "Excuse me, I was next.",
    });
    const outcome = await generateScenario(
      { category: "daily_life", difficulty: "easy" },
      { apiKey: "test-key" },
    );
    expect(outcome.source).toBe("ai");
    expect(outcome.aiAvailable).toBe(true);
    expect(SocialScenarioSchema.safeParse(outcome.scenario).success).toBe(true);
  });

  it("degrades to the deterministic fallback when AI output is malformed", async () => {
    generateSocialScenario.mockResolvedValue({ category: "daily_life" });
    const outcome = await generateScenario({ variantSeed: 1 }, { apiKey: "test-key" });
    expect(outcome.source).toBe("fallback");
    expect(outcome.aiAvailable).toBe(false);
    expect(outcome.scenario.question).toBeTruthy();
  });

  it("never throws when the provider rejects", async () => {
    generateSocialScenario.mockRejectedValue(new Error("provider down"));
    const outcome = await generateScenario({}, { apiKey: "test-key" });
    expect(outcome.source).toBe("fallback");
    expect(outcome.aiAvailable).toBe(false);
  });

  it("records and lists attempts with scores and titles only", () => {
    recordScenarioAttempt("u1", {
      scenario: { id: "college.group-work-disagree", title: "Disagreeing in Group Work", category: "college", difficulty: "hard" },
      evaluation: { score: 72, strengths: ["clear"], usedAi: true },
      response: "That makes sense, but could we also consider my idea?",
      voiceUsed: true,
      now: 1750000000000,
    });
    recordScenarioAttempt("u1", {
      scenario: { id: "workplace.asking-for-help", title: "Asking for Help", category: "workplace", difficulty: "easy" },
      evaluation: { score: 80, strengths: [] },
      response: "Could you help me?",
      now: 1750000100000,
    });

    const attempts = listScenarioAttempts("u1");
    expect(attempts).toHaveLength(2);
    expect(attempts[0].title).toBe("Asking for Help");
    expect(attempts[0].score).toBe(80);
    expect(attempts[0].voiceUsed).toBe(false);
    expect(attempts[0].response).toBeUndefined();
    expect(attempts[0].strengths).toEqual([]);

    expect(listScenarioAttempts("u1", { limit: 1 })).toHaveLength(1);
    expect(getScenarioAttemptStats("u1")).toEqual({ totalAttempts: 2, averageScore: 76 });
    expect(getScenarioAttemptStats("nobody")).toEqual({ totalAttempts: 0, averageScore: null });
  });

  it("is safe with a missing user id (guest)", () => {
    recordScenarioAttempt(null, {
      scenario: { id: "daily_life.line-jumper", title: "Someone Jumps the Queue" },
      evaluation: { score: 55 },
      response: "Excuse me.",
    });
    expect(listScenarioAttempts(null)).toHaveLength(1);
  });
});
