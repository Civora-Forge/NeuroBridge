import { describe, expect, it } from "vitest";
import { buildFeedback } from "../services/feedbackGenerator";

const FORBIDDEN = /\b(wrong|bad|failed|failure|poor|stupid|sloppy|mistake)\b/i;

describe("buildFeedback", () => {
  it("produces readable sections with an encouragement summary", () => {
    const feedback = buildFeedback({
      overallScore: 82,
      stats: { wordCount: 40 },
      strengths: ["Your replies were clear."],
      improvements: ["Try adding a question."],
      alternatives: ["Could you tell me more?"],
    });
    expect(feedback.summary.length).toBeGreaterThan(0);
    expect(feedback.sections.some((s) => s.id === "what_worked")).toBe(true);
    expect(feedback.sections.some((s) => s.id === "could_improve")).toBe(true);
    expect(feedback.sections.some((s) => s.id === "alternatives")).toBe(true);
  });

  it("never contains shaming language", () => {
    const feedback = buildFeedback({
      overallScore: 45,
      stats: { wordCount: 5 },
      strengths: [],
      improvements: ["Keep replies short and kind."],
      alternatives: ["Hello, could you help me?"],
    });
    const allText = JSON.stringify(feedback);
    expect(allText).not.toMatch(FORBIDDEN);
  });

  it("always offers at least one improvement", () => {
    const feedback = buildFeedback({
      overallScore: 90,
      stats: { wordCount: 30 },
      strengths: [],
      improvements: [],
      alternatives: [],
    });
    const improvement = feedback.sections.find((s) => s.id === "could_improve");
    expect(improvement.items.length).toBeGreaterThan(0);
  });

  it("handles an empty evaluation gracefully", () => {
    const feedback = buildFeedback(null);
    expect(feedback.sections).toEqual([]);
    expect(feedback.summary).toBe("");
  });
});
