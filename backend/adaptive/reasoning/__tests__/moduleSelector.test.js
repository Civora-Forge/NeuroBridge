import { describe, it, expect } from "vitest";
import {
  buildTagScores,
  scoreModule,
  scoreModules,
  selectModulesForUser,
} from "../moduleSelector.js";

describe("moduleSelector — Phase 6 behavior preservation", () => {
  it("selectModulesForUser keeps the canonical ADHD onboarding recommendation", () => {
    const result = selectModulesForUser({ selectedChallenges: ["adhd"], answersByQuestionId: {} });

    expect(result.enabledModules).toEqual([
      "support.task_breakdown",
      "support.focus_session",
    ]);
    expect(result.enabledModules.every((moduleId) => moduleId.startsWith("support."))).toBe(true);
    expect(result.selectedModules.map((m) => m.id)).toEqual(result.enabledModules);
  });

  it("buildTagScores merges weighted tagScores from answered options", () => {
    const questions = [
      { id: "q1", options: [{ text: "Opt A", tagScores: { focus: 2, planning: 1 } }] },
      { id: "q2", options: [{ text: "Opt B", tagScores: { focus: 1, overwhelm: 3 } }] },
    ];

    expect(buildTagScores({ q1: "Opt A", q2: "Opt B" }, questions)).toEqual({
      focus: 3,
      planning: 1,
      overwhelm: 3,
    });
  });

  it("scoreModule and scoreModules preserve the pre-consolidation contract", () => {
    const module = { id: "m1", tags: ["a", "b"] };
    expect(scoreModule({ a: 2, b: 3 }, module)).toBe(5);

    const scored = scoreModules({ a: 2 }, [{ id: "m1", tags: ["a"] }, { id: "m2", tags: [] }]);
    expect(scored.map((m) => [m.id, m.score])).toEqual([
      ["m1", 2],
      ["m2", 0],
    ]);
  });

  it("guarantees at least one module per selected challenge area", () => {
    const result = selectModulesForUser({ selectedChallenges: ["adhd", "depression"], answersByQuestionId: {} });

    expect(result.enabledModules).toContain("support.task_breakdown");
    expect(result.enabledModules).toContain("support.gentle_activity");
  });

  it("keeps the legacy userTags alias and scoredModules output", () => {
    const result = selectModulesForUser({ selectedChallenges: ["adhd"], answersByQuestionId: {} });

    expect(result.userTags).toEqual(result.tagScores);
    expect(result.scoredModules.length).toBeGreaterThan(0);
    expect(result.scoredModules.every((m) => typeof m.score === "number")).toBe(true);
  });

  it("returns deterministic results for identical inputs", () => {
    const input = { selectedChallenges: ["adhd"], answersByQuestionId: {} };
    expect(selectModulesForUser(input)).toEqual(selectModulesForUser(input));
  });
});
