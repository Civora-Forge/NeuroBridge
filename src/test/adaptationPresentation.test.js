import { describe, expect, it } from "vitest";
import { buildAdaptationExplanation } from "@/adaptive/presentation/adaptationPresentation";

describe("adaptation presentation", () => {
  it("stays silent when anxiety recommendations keep the same order", () => {
    expect(buildAdaptationExplanation({
      feature: "anxiety",
      baseline: { recommendations: ["Grounding", "Guided Breathing"] },
      applied: { recommendations: ["Grounding", "Guided Breathing"] },
    })).toBeNull();
  });

  it("explains the recommendation that actually moved first", () => {
    const explanation = buildAdaptationExplanation({
      feature: "anxiety",
      baseline: { recommendations: ["Grounding", "Guided Breathing"] },
      applied: { recommendations: ["Guided Breathing", "Grounding"] },
    });
    expect(explanation.message).toContain("Guided Breathing");
    expect(explanation.appliedChanges).toEqual(["Recommended first: Guided Breathing"]);
  });

  it("only explains Gentle Activity when its displayed scope changes", () => {
    expect(buildAdaptationExplanation({
      feature: "gentleActivity", baseline: { stepCount: 5 }, applied: { stepCount: 5 },
    })).toBeNull();
    expect(buildAdaptationExplanation({
      feature: "gentleActivity", baseline: { stepCount: 5 }, applied: { stepCount: 3 },
    }).appliedChanges).toEqual(["Steps: 5 to 3"]);
  });

  it("only explains Grounding when the technique order or pace changes", () => {
    const baseline = { techniques: ["Grounding", "Breathing"], slowPacing: false };
    expect(buildAdaptationExplanation({ feature: "grounding", baseline, applied: baseline })).toBeNull();
    expect(buildAdaptationExplanation({
      feature: "grounding",
      baseline,
      applied: { techniques: ["Breathing", "Grounding"], slowPacing: false },
    }).message).toContain("Breathing");
  });

  it("explains Social Scenario difficulty and cues only when each is applied", () => {
    const baseline = { difficulty: "Moderate", supportiveCues: false };
    expect(buildAdaptationExplanation({ feature: "socialScenario", baseline, applied: baseline })).toBeNull();
    expect(buildAdaptationExplanation({
      feature: "socialScenario", baseline, applied: { difficulty: "Easy", supportiveCues: false },
    }).appliedChanges).toEqual(["Difficulty: Moderate to Easy"]);
    expect(buildAdaptationExplanation({
      feature: "socialScenario", baseline, applied: { difficulty: "Moderate", supportiveCues: true },
    }).appliedChanges).toEqual(["Supportive cues: On"]);
    expect(buildAdaptationExplanation({
      feature: "socialScenario", baseline, applied: { difficulty: "Easy", supportiveCues: true },
    }).appliedChanges).toEqual(["Difficulty: Moderate to Easy", "Supportive cues: On"]);
  });

  it("explains Conversation Practice support and progression from final session values", () => {
    const baseline = { difficulty: 3, hintsEnabled: false, pacing: "normal" };
    expect(buildAdaptationExplanation({ feature: "conversation", baseline, applied: baseline })).toBeNull();
    expect(buildAdaptationExplanation({
      feature: "conversation", baseline, applied: { difficulty: 2, hintsEnabled: true, pacing: "slow" },
    }).appliedChanges).toEqual(["Level: 3 to 2", "Hints: On", "Pace: Take your time"]);
    expect(buildAdaptationExplanation({
      feature: "conversation", baseline, applied: { difficulty: 4, hintsEnabled: false, pacing: "normal" },
    }).title).toBe("Ready for a little more?");
  });
});
