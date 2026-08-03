import { describe, it, expect } from "vitest";
import {
  buildPersonalizationProfile,
  buildTagProfile,
  deriveDisordersFromModules,
  scoreModules,
  selectModules,
} from "../interventionRanking.js";
import { SUPPORT_MODULE_REGISTRY } from "../disorderFeatureRegistry.js";

describe("interventionRanking — Phase 6 behavior preservation", () => {
  it("scoreModules still defaults to the support module registry", () => {
    const scored = scoreModules({ distractibility: 1 });
    expect(scored).toHaveLength(SUPPORT_MODULE_REGISTRY.length);
    expect(scored.every((module) => typeof module.score === "number")).toBe(true);
    expect(scored.find((module) => module.id === "adhd").score).toBe(1);
  });

  it("scoreModules computes sums over declared tags without mutating input", () => {
    const modules = [
      { id: "m1", tags: ["a", "b"] },
      { id: "m2", tags: ["a"] },
    ];
    const snapshot = JSON.parse(JSON.stringify(modules));
    const scored = scoreModules({ a: 3, b: 1 }, modules);

    expect(scored.map((m) => [m.id, m.score])).toEqual([
      ["m1", 4],
      ["m2", 3],
    ]);
    expect(modules).toEqual(snapshot);
  });

  it("buildTagProfile accumulates challenge tags and weighted question tags", () => {
    const profile = buildTagProfile({
      selectedChallenges: ["ocd"],
      challengeOptions: [
        { id: "ocd", tags: ["avoidance"] },
        { id: "asd", tags: ["sensory_overload"] },
      ],
      questions: [
        { id: "q1", options: [{ id: "opt-a", tags: ["fear"], weight: 2 }, { id: "opt-b", tags: ["uncertainty"] }] },
      ],
      answersByQuestionId: { q1: "opt-a" },
    });

    expect(profile).toEqual({ avoidance: 1, fear: 2 });
  });

  it("selectModules filters by threshold and fills from top scorers when below minimum", () => {
    const modules = [
      { id: "m1", tags: ["a", "b"] },
      { id: "m2", tags: ["a"] },
      { id: "m3", tags: [] },
    ];

    expect(selectModules({ a: 3, b: 1 }, modules, 3, 1).map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(selectModules({}, modules, 2, 2).map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("buildPersonalizationProfile returns the documented shape", () => {
    const result = buildPersonalizationProfile({
      selectedChallenges: ["ocd"],
      challengeOptions: [{ id: "ocd", tags: ["avoidance"] }],
      questions: [],
      answersByQuestionId: {},
      modules: [{ id: "ocd", title: "Exposure Practice", tags: ["avoidance"], disorders: ["ocd"] }],
    });

    expect(result.tagProfile).toEqual({ avoidance: 1 });
    expect(result.enabledModules).toEqual(["ocd"]);
    expect(result.inferredDisorders).toEqual(["ocd"]);
    expect(result.selectedModules[0].id).toBe("ocd");
  });

  it("deriveDisordersFromModules deduplicates across modules", () => {
    expect(deriveDisordersFromModules([{ disorders: ["a", "b"] }, { disorders: ["b", "c"] }])).toEqual(["a", "b", "c"]);
  });
});
