import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/socialCommunication/services/aiService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateEmotionQuizQuestion: vi.fn(),
  };
});

import { generateEmotionQuizQuestion } from "@/features/socialCommunication/services/aiService";
import {
  EmotionQuizQuestionSchema,
  QUIZ_QUESTION_TYPES,
} from "@/support/modules/emotionQuiz/emotionQuizTypes";
import {
  buildQuizConfig,
  buildQuizPerformance,
  generateQuizQuestion,
  getFallbackQuizQuestion,
  gradeQuizAnswer,
} from "@/support/modules/emotionQuiz/emotionQuizService";

describe("emotion quiz service", () => {
  it("builds a config that lowers difficulty when simplify is signalled", () => {
    expect(buildQuizConfig({ difficulty: 3, signals: { simplify: true } })).toMatchObject({
      effectiveDifficulty: 2,
      hintsEnabled: false,
    });
    expect(buildQuizConfig({ difficulty: 1, signals: { simplify: true } })).toMatchObject({
      effectiveDifficulty: 1,
      hintsEnabled: true,
    });
    expect(buildQuizConfig({ questionType: "bogus" })).toMatchObject({
      questionType: QUIZ_QUESTION_TYPES.MATCH_SCENARIO,
    });
  });

  it("returns the same fallback question for the same seed", () => {
    const first = getFallbackQuizQuestion({
      effectiveDifficulty: 1,
      questionType: QUIZ_QUESTION_TYPES.IDENTIFY_CUE,
      variantSeed: 4,
    });
    const second = getFallbackQuizQuestion({
      effectiveDifficulty: 1,
      questionType: QUIZ_QUESTION_TYPES.IDENTIFY_CUE,
      variantSeed: 4,
    });
    expect(first).toEqual(second);
    expect(first.source).toBe("fallback");
  });

  it("fallback questions always validate and carry a real correct option", () => {
    for (const type of Object.values(QUIZ_QUESTION_TYPES)) {
      for (let seed = 0; seed < 20; seed += 1) {
        const question = getFallbackQuizQuestion({
          effectiveDifficulty: 1,
          questionType: type,
          variantSeed: seed,
        });
        expect(EmotionQuizQuestionSchema.safeParse(question).success).toBe(true);
        const correct = question.options.find((option) => option.id === question.correctOptionId);
        expect(correct).toBeTruthy();
      }
    }
  });

  it("uses AI output when it validates against the schema", async () => {
    generateEmotionQuizQuestion.mockResolvedValue({
      type: QUIZ_QUESTION_TYPES.MATCH_SCENARIO,
      prompt: "Which feeling fits best?",
      options: [
        { id: "a", label: "Happy" },
        { id: "b", label: "Angry" },
      ],
      correctOptionId: "a",
      explanation: "A big smile usually means happy.",
      difficulty: 2,
    });
    const outcome = await generateQuizQuestion({}, { apiKey: "test-key" });
    expect(outcome.source).toBe("ai");
    expect(outcome.aiAvailable).toBe(true);
    expect(EmotionQuizQuestionSchema.safeParse(outcome.question).success).toBe(true);
  });

  it("degrades to the deterministic fallback on malformed AI output", async () => {
    generateEmotionQuizQuestion.mockResolvedValue({ nope: true });
    const outcome = await generateQuizQuestion({ variantSeed: 2 }, { apiKey: "test-key" });
    expect(outcome.source).toBe("fallback");
    expect(outcome.question.options.length).toBeGreaterThanOrEqual(2);
  });

  it("never throws when the provider rejects", async () => {
    generateEmotionQuizQuestion.mockRejectedValue(new Error("quiz provider down"));
    const outcome = await generateQuizQuestion({}, { apiKey: "test-key" });
    expect(outcome.source).toBe("fallback");
    expect(outcome.aiError).toContain("quiz provider down");
  });

  it("grades exactly against the correct option id", () => {
    const question = {
      options: [
        { id: "a", label: "Worried" },
        { id: "b", label: "Excited" },
      ],
      correctOptionId: "b",
      explanation: "A bright voice usually means excitement.",
    };
    expect(gradeQuizAnswer(question, "b")).toMatchObject({
      answered: true,
      correct: true,
      selectedLabel: "Excited",
      correctLabel: "Excited",
    });
    expect(gradeQuizAnswer(question, "a")).toMatchObject({ answered: true, correct: false });
    expect(gradeQuizAnswer(question, "zz")).toMatchObject({ answered: false, correct: false });
    expect(gradeQuizAnswer(null, "a")).toMatchObject({ answered: false, correct: false });
  });

  it("builds a canonical performance signal", () => {
    const performance = buildQuizPerformance({ total: 5, correct: 3, attempts: 5, streak: 2, durationMs: 1234.9 });
    expect(performance).toMatchObject({
      completionStatus: "partially_completed",
      durationMs: 1234,
      metrics: { total: 5, correct: 3, accuracy: 0.6, attempts: 5, streak: 2 },
    });
    expect(buildQuizPerformance({ total: 3, correct: 3 })).toMatchObject({ completionStatus: "completed" });
  });
});
