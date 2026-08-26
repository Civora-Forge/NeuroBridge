import { describe, expect, it } from "vitest";
import { clampDifficulty, computeNextDifficulty } from "../services/difficultyController";

describe("computeNextDifficulty", () => {
  it("does not change without enough data", () => {
    expect(computeNextDifficulty({ current: 3, scores: [85] }).difficulty).toBe(3);
    expect(computeNextDifficulty({ current: 3, scores: [] }).changed).toBe(false);
  });

  it("increases after two strong consecutive scores", () => {
    const result = computeNextDifficulty({ current: 3, scores: [84, 88] });
    expect(result.difficulty).toBe(4);
    expect(result.changed).toBe(true);
  });

  it("decreases after two weak consecutive scores", () => {
    const result = computeNextDifficulty({ current: 4, scores: [50, 44] });
    expect(result.difficulty).toBe(3);
    expect(result.changed).toBe(true);
  });

  it("stays stable on mixed scores (no oscillation)", () => {
    expect(computeNextDifficulty({ current: 3, scores: [90, 40, 88] }).changed).toBe(false);
    expect(computeNextDifficulty({ current: 3, scores: [40, 90, 45] }).changed).toBe(false);
  });

  it("never exceeds the upper bound", () => {
    const result = computeNextDifficulty({ current: 5, scores: [95, 96] });
    expect(result.difficulty).toBe(5);
  });

  it("never drops below the lower bound", () => {
    const result = computeNextDifficulty({ current: 1, scores: [30, 20] });
    expect(result.difficulty).toBe(1);
  });

  it("honours the engine recommendEasier signal within bounds", () => {
    const result = computeNextDifficulty({ current: 3, scores: [90, 92], recommendEasier: true });
    expect(result.difficulty).toBe(2);
    expect(result.reason).toBe("engine_recommendation");

    const floored = computeNextDifficulty({ current: 1, scores: [], recommendEasier: true });
    expect(floored.difficulty).toBe(1);
  });
});

describe("clampDifficulty", () => {
  it("clamps out-of-range values", () => {
    expect(clampDifficulty(0)).toBe(1);
    expect(clampDifficulty(9)).toBe(5);
    expect(clampDifficulty(3)).toBe(3);
    expect(clampDifficulty("3")).toBe(3);
  });
});
