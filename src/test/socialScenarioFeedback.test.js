import { describe, expect, it } from "vitest";
import {
  buildFeedbackReport,
  encouragementForScore,
  scorePlayerText,
  scoreTurn,
} from "@/support/modules/socialScenarioSimulator/feedbackService";
import { FEEDBACK_SUBSCOE, FEEDBACK_SUBSCOE_KEYS } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";

describe("feedback service", () => {
  it("scores a polite question favourably", () => {
    const subscores = scorePlayerText("Please could you help me?");
    expect(subscores[FEEDBACK_SUBSCOE.POLITENESS]).toBeGreaterThanOrEqual(80);
    expect(subscores[FEEDBACK_SUBSCOE.CLARITY]).toBeGreaterThanOrEqual(75);
    expect(subscores[FEEDBACK_SUBSCOE.COMPLETENESS]).toBeGreaterThanOrEqual(80);
  });

  it("penalises impolite wording", () => {
    const polite = scorePlayerText("Please help me.");
    const rude = scorePlayerText("Shut up.");
    expect(rude[FEEDBACK_SUBSCOE.POLITENESS]).toBeLessThan(polite[FEEDBACK_SUBSCOE.POLITENESS]);
  });

  it("lowers confidence for hedging", () => {
    const direct = scorePlayerText("I need this by Friday.");
    const hedged = scorePlayerText("Maybe I guess sort of not sure I don't know.");
    expect(hedged[FEEDBACK_SUBSCOE.CONFIDENCE]).toBeLessThan(direct[FEEDBACK_SUBSCOE.CONFIDENCE]);
  });

  it("penalises shouting", () => {
    const normal = scorePlayerText("I need this by Friday.");
    const shouting = scorePlayerText("I NEED THIS BY FRIDAY.");
    expect(shouting[FEEDBACK_SUBSCOE.EMOTIONAL_APPROPRIATENESS]).toBeLessThan(
      normal[FEEDBACK_SUBSCOE.EMOTIONAL_APPROPRIATENESS],
    );
  });

  it("penalises one-word replies on completeness", () => {
    const brief = scorePlayerText("ok");
    expect(brief[FEEDBACK_SUBSCOE.COMPLETENESS]).toBeLessThan(50);
  });

  it("keeps every subscore clamped to 0-100", () => {
    const subscores = scorePlayerText("Thank you so much, I really appreciate all of this, please forgive the inconvenience.");
    for (const key of FEEDBACK_SUBSCOE_KEYS) {
      expect(subscores[key]).toBeGreaterThanOrEqual(0);
      expect(subscores[key]).toBeLessThanOrEqual(100);
    }
  });

  it("blends quality with the wording heuristic", () => {
    const quality = {
      clarity: 100,
      politeness: 100,
      confidence: 100,
      emotionalAppropriateness: 100,
      completeness: 100,
    };
    const blended = scoreTurn("please help me, thank you", quality);
    const raw = scorePlayerText("please help me, thank you");
    expect(blended[FEEDBACK_SUBSCOE.CLARITY]).toBeGreaterThan(raw[FEEDBACK_SUBSCOE.CLARITY]);
    expect(blended[FEEDBACK_SUBSCOE.CLARITY]).toBeLessThanOrEqual(100);
  });

  it("falls back to the heuristic when no quality is given", () => {
    expect(scoreTurn("please help me")).toEqual(scorePlayerText("please help me"));
  });

  it("returns never-shaming encouragement for each band", () => {
    expect(encouragementForScore(90)).toContain("Outstanding");
    expect(encouragementForScore(75)).toContain("Really strong");
    expect(encouragementForScore(60)).toContain("Good progress");
    expect(encouragementForScore(30)).toContain("Great first step");
  });

  it("handles an empty session gracefully", () => {
    const report = buildFeedbackReport({ scenario: { title: "x", alternativePool: ["Try A."] }, session: null });
    expect(report.communicationScore).toBeNull();
    expect(report.perTurn).toEqual([]);
    expect(report.alternatives).toEqual(["Try A."]);
    expect(report.encouragement).toContain("Press start");
  });

  it("builds a full report for a completed session", () => {
    const scenario = {
      title: "Cafe Order",
      alternativePool: ["Try: 'I'd like a coffee, please.'"],
    };
    const session = {
      turns: [
        {
          id: "t1",
          playerText: "Please could you help me?",
          matched: true,
          cue: "You asked politely.",
          suggestion: "Try: 'I need to place an order.'",
          quality: { clarity: 90, politeness: 85, confidence: 80, emotionalAppropriateness: 85, completeness: 85 },
        },
        {
          id: "t2",
          playerText: "Uh maybe whatever",
          matched: false,
          cue: "",
          suggestion: "Say what you want clearly.",
          quality: { clarity: 40, politeness: 40, confidence: 30, emotionalAppropriateness: 40, completeness: 40 },
        },
      ],
    };
    const report = buildFeedbackReport({ scenario, session });
    expect(report.communicationScore).toBeGreaterThanOrEqual(0);
    expect(report.communicationScore).toBeLessThanOrEqual(100);
    expect(Object.keys(report.subscores)).toEqual(expect.arrayContaining(FEEDBACK_SUBSCOE_KEYS));
    expect(report.perTurn).toHaveLength(2);
    expect(report.alternatives.length).toBeGreaterThan(0);
    expect(report.summary).toContain("/100");
  });
});
