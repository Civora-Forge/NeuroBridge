import { describe, expect, it, vi } from "vitest";
import * as aiService from "../services/aiService";
import { evaluateSession, refineEvaluationWithAI } from "../services/evaluationService";
import { EVALUATION_DIMENSION_IDS, EVALUATION_VERSION } from "../types/communicationTypes";

function buildSession({ turns = [], scenario = { goal: "ask for help finding a book", domain: "requesting_help" } } = {}) {
  return {
    id: "session-1",
    scenario,
    turns: turns.map((text, index) => ({
      id: `turn-${index}`,
      speaker: "user",
      text,
      source: index % 2 === 0 ? "voice" : "text",
      speech: { wpm: 140, wordCount: text.split(" ").length, fillerCount: 0, estimatedSilenceMs: 200, latencyMs: 800, durationMs: 2000, transcript: text },
      timestamp: new Date().toISOString(),
    })),
  };
}

const GOOD_TURNS = [
  "Hi, could you help me find a book for my project?",
  "Yes please, I need help finding the section.",
  "Great, thank you so much! What time should we meet?",
  "That works for me, thanks again.",
];

describe("evaluateSession", () => {
  it("returns the 7 structured dimensions in range", () => {
    const evaluation = evaluateSession(buildSession({ turns: GOOD_TURNS }));
    expect(evaluation.version).toBe(EVALUATION_VERSION);
    expect(evaluation.dimensions).toHaveLength(7);
    expect(evaluation.dimensions.map((d) => d.id)).toEqual(EVALUATION_DIMENSION_IDS);
    evaluation.dimensions.forEach((dimension) => {
      expect(dimension.score).toBeGreaterThanOrEqual(0);
      expect(dimension.score).toBeLessThanOrEqual(100);
    });
    expect(evaluation.overallScore).toBeGreaterThanOrEqual(0);
    expect(evaluation.overallScore).toBeLessThanOrEqual(100);
  });

  it("never fabricates success for an empty transcript", () => {
    const evaluation = evaluateSession(buildSession({ turns: [] }));
    expect(evaluation.overallScore).toBeLessThan(35);
    expect(evaluation.strengths).toHaveLength(0);
    expect(evaluation.improvements.length).toBeGreaterThan(0);
  });

  it("scores engaged turns higher than one-word replies", () => {
    const engaged = evaluateSession(buildSession({ turns: GOOD_TURNS })).overallScore;
    const brief = evaluateSession(buildSession({ turns: ["ok", "fine", "yes", "no"] })).overallScore;
    expect(engaged).toBeGreaterThan(brief);
  });

  it("gives strengths and alternatives for a decent session", () => {
    const evaluation = evaluateSession(buildSession({ turns: GOOD_TURNS }));
    expect(Array.isArray(evaluation.strengths)).toBe(true);
    expect(evaluation.alternatives.length).toBeGreaterThan(0);
    expect(evaluation.overallComment.length).toBeGreaterThan(0);
  });

  it("does not penalise based on transcript length alone", () => {
    const short = evaluateSession(buildSession({ turns: ["Can you help me please?"] }));
    expect(short.dimensionScores.tone).toBeGreaterThanOrEqual(70);
  });

  it("keeps speech features optional and safe", () => {
    const evaluation = evaluateSession(buildSession({ turns: GOOD_TURNS }));
    expect(evaluation.stats.voiceTurns).toBe(2);
    expect(evaluation.stats.textTurns).toBe(2);
  });
});

describe("refineEvaluationWithAI", () => {
  it("replaces only qualitative fields and preserves numeric scores", async () => {
    const session = buildSession({ turns: GOOD_TURNS });
    const evaluation = evaluateSession(session);
    const spy = vi.spyOn(aiService, "generateEvaluationInsights").mockResolvedValue({
      strengths: ["Great clarity."],
      improvements: ["Try adding a follow-up."],
      alternatives: ["Could you explain that again?"],
      overallComment: "Nice work today.",
    });

    const refined = await refineEvaluationWithAI(evaluation, { session, apiKey: "key" });
    expect(refined.strengths[0]).toBe("Great clarity.");
    expect(refined.overallScore).toBe(evaluation.overallScore);
    expect(refined.dimensionScores).toEqual(evaluation.dimensionScores);
    expect(refined.refinedByAI).toBe(true);
    spy.mockRestore();
  });

  it("returns the deterministic evaluation unchanged when AI fails", async () => {
    const session = buildSession({ turns: GOOD_TURNS });
    const evaluation = evaluateSession(session);
    const refined = await refineEvaluationWithAI(evaluation, { session, apiKey: "key" });
    expect(refined).toBe(evaluation);
  });

  it("returns the evaluation unchanged without an api key", async () => {
    const evaluation = evaluateSession(buildSession({ turns: GOOD_TURNS }));
    expect(await refineEvaluationWithAI(evaluation, { session: {}, apiKey: "" })).toBe(evaluation);
  });
});
