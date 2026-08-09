import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/socialCommunication/services/aiService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateSocialScenarioEvaluation: vi.fn(),
  };
});

import { generateSocialScenarioEvaluation } from "@/features/socialCommunication/services/aiService";
import {
  buildDeterministicEvaluation,
  computeOverallScore,
  evaluateResponse,
  mergeAiRefinement,
  scoreResponseHeuristic,
} from "@/support/modules/socialScenarioSimulator/evaluationService";

const scenario = {
  category: "workplace",
  title: "Asking for Help",
  setting: "a quiet office",
  situation: "You are stuck on a task and your colleague is free for a moment.",
  role: "a new colleague",
  question: "Your colleague smiles and asks, 'How is it going?' What do you say?",
  cues: ["Your colleague seems free", "You are stuck", "The task has a clear next step"],
  suggestedResponse: "I'm a bit stuck on this report — could you help me with the numbers part when you have a minute?",
  hint: "Say what you are stuck on.",
};

describe("social scenario evaluation", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("scores each dimension and the overall score inside 0-100", () => {
    const subscores = scoreResponseHeuristic("Could you please help me? I am stuck.", scenario);
    for (const value of Object.values(subscores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    const score = computeOverallScore(subscores);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("rewards a polite, clear response and detects cues", () => {
    const evaluation = buildDeterministicEvaluation({
      scenario,
      response:
        "I'm a bit stuck on this report — could you help me with the numbers part when you have a minute?",
    });
    expect(evaluation.score).toBeGreaterThanOrEqual(60);
    expect(evaluation.strengths.length).toBeGreaterThan(0);
    expect(evaluation.usedAi).toBe(false);
    expect(evaluation.detectedCues.some((cue) => /stuck/i.test(cue))).toBe(true);
  });

  it("treats a very short reply kindly but with a low score and suggestions", () => {
    const evaluation = buildDeterministicEvaluation({ scenario, response: "yes" });
    expect(evaluation.score).toBeLessThan(60);
    expect(evaluation.improvements.length).toBeGreaterThan(0);
    expect(evaluation.detectedCues).toEqual([]);
    expect(evaluation.reasoning).toBeTruthy();
  });

  it("returns null speech notes when no browser timing is available", () => {
    const evaluation = buildDeterministicEvaluation({
      scenario,
      response: "Could you please help me?",
      capture: null,
    });
    expect(evaluation.speechNotes).toBeNull();
  });

  it("describes pacing only from voice timing and never claims emotion", () => {
    const evaluation = buildDeterministicEvaluation({
      scenario,
      response: "please can you help me with this",
      capture: { transcript: "please can you help me with this", durationMs: 4000, latencyMs: 300 },
    });
    expect(evaluation.speechNotes).toBeTruthy();
    expect(evaluation.speechNotes.available).toBe(true);
    expect(evaluation.speechNotes.note).toMatch(/pacing/i);
    expect(evaluation.speechNotes.note).toMatch(/not emotion or confidence/i);
  });

  it("merges an AI refinement without moving the score", () => {
    const base = buildDeterministicEvaluation({ scenario, response: "Could you please help me? I am stuck." });
    const refined = {
      strengths: ["You asked for help clearly and politely."],
      improvements: ["Consider offering a specific next step."],
      detectedCues: ["You are stuck"],
      suggestedResponse: "Could you help me with the numbers part?",
      reasoning: "A clear, polite ask is a great way forward.",
      speechNotes: "",
    };
    const merged = mergeAiRefinement(base, refined);
    expect(merged.score).toBe(base.score);
    expect(merged.strengths[0]).toContain("asked for help");
    expect(merged.reasoning).toContain("clear, polite");
    expect(merged.usedAi).toBe(true);
  });

  it("uses AI refinement when available and falls back deterministically otherwise", async () => {
    generateSocialScenarioEvaluation.mockResolvedValue({
      strengths: ["You asked clearly."],
      improvements: [],
      detectedCues: [],
      suggestedResponse: "",
      reasoning: "A clear ask works well here.",
      speechNotes: "",
    });
    const withAi = await evaluateResponse({
      scenario,
      response: "Could you help me?",
      apiKey: "test-key",
    });
    expect(withAi.usedAi).toBe(true);
    expect(withAi.strengths).toContain("You asked clearly.");

    generateSocialScenarioEvaluation.mockRejectedValue(new Error("evaluator down"));
    const withoutAi = await evaluateResponse({
      scenario,
      response: "Could you help me?",
      apiKey: "test-key",
    });
    expect(withoutAi.usedAi).toBe(false);
    expect(withoutAi.score).toBeGreaterThanOrEqual(0);
  });

  it("skips AI entirely when no api key is available", async () => {
    const evaluation = await evaluateResponse({
      scenario,
      response: "Could you please help me?",
      apiKey: null,
    });
    expect(evaluation.usedAi).toBe(false);
    expect(generateSocialScenarioEvaluation).not.toHaveBeenCalled();
  });
});
