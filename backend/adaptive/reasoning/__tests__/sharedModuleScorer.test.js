import { describe, it, expect } from "vitest";
import { scoreModule, scoreModules } from "../sharedModuleScorer.js";

describe("sharedModuleScorer — reusable scoring mathematics (Phase 6)", () => {
  it("scores a module as the sum of its declared tag scores", () => {
    const module = { id: "m1", tags: ["a", "b", "c"] };
    expect(scoreModule({ a: 3, b: 1, c: 0 }, module)).toBe(4);
    expect(scoreModule({ a: 2 }, module)).toBe(2);
  });

  it("returns annotated copies sorted descending without mutating inputs", () => {
    const modules = [
      { id: "m1", tags: ["a"] },
      { id: "m2", tags: ["a", "b"] },
    ];
    const snapshot = JSON.parse(JSON.stringify(modules));

    const scored = scoreModules({ a: 3, b: 1 }, modules);

    expect(scored.map((m) => [m.id, m.score])).toEqual([
      ["m2", 4],
      ["m1", 3],
    ]);
    expect(modules).toEqual(snapshot);
    expect(modules[0]).not.toHaveProperty("score");
  });

  it("produces deterministic results for identical inputs", () => {
    const modules = [
      { id: "m1", tags: ["a"] },
      { id: "m2", tags: ["b"] },
    ];
    const tagScores = { a: 5, b: 2 };
    expect(scoreModules(tagScores, modules)).toEqual(scoreModules(tagScores, modules));
  });

  it("keeps tie-breaking stable (equal scores preserve input order)", () => {
    const modules = [
      { id: "first", tags: ["x"] },
      { id: "second", tags: ["x"] },
      { id: "third", tags: ["x"] },
    ];
    const scored = scoreModules({ x: 1 }, modules);
    expect(scored.map((m) => m.id)).toEqual(["first", "second", "third"]);
    expect(scored.every((m) => m.score === 1)).toBe(true);
  });

  it("respects caller-supplied weighted tag scores (domain-specific weighting)", () => {
    const modules = [
      { id: "low", tags: ["focus"] },
      { id: "high", tags: ["focus"] },
    ];
    const scored = scoreModules({ focus: 3 }, modules);
    expect(scored[0].id).toBe("low");
    expect(scored[0].score).toBe(3);
    expect(scored[1].score).toBe(3);

    // Weighting is entirely a property of the tagScores input, not the scorer.
    expect(scoreModule({ focus: 1 }, modules[0])).toBe(1);
    expect(scoreModule({ focus: 9 }, modules[0])).toBe(9);
  });

  it("handles an empty module list safely", () => {
    expect(scoreModules({ a: 1 }, [])).toEqual([]);
  });

  it("handles modules without tags and missing tag-scores safely", () => {
    expect(scoreModule({ a: 5 }, { id: "untagged" })).toBe(0);
    expect(scoreModule(undefined, { id: "m", tags: ["a"] })).toBe(0);
    expect(scoreModules(undefined, [{ id: "m", tags: ["a"] }])[0].score).toBe(0);
  });
});
