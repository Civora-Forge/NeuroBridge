import { describe, it, expect, beforeEach } from "vitest";
import {
  recordWellbeingInteraction,
  generateAdaptiveMessage,
  WELLBEING_INTERACTION_TYPES,
} from "../services/wellbeingService";
import { getGardenState, resetGardenState } from "../stores/gardenStore";

describe("Centralized Wellbeing Interaction Service", () => {
  const TEST_USER = "wellbeing_test_user";

  beforeEach(() => {
    localStorage.clear();
    resetGardenState(TEST_USER);
  });

  it("records meaningful wellbeing interaction and advances growth on first interaction today", () => {
    const initial = getGardenState(TEST_USER);
    expect(initial.currentDayInSeason).toBe(1);

    const result = recordWellbeingInteraction({
      userId: TEST_USER,
      interactionType: WELLBEING_INTERACTION_TYPES.SUPPORT_MODULE_COMPLETED,
      source: "support.focus_session",
    });

    expect(result.success).toBe(true);
    expect(result.contributedToGrowth).toBe(true);

    const updated = getGardenState(TEST_USER);
    expect(updated.currentDayInSeason).toBe(1);
    expect(updated.lastEngagementDate).toBeDefined();
  });

  it("handles duplicate interactions on the same day without farming extra leaves or day increments", () => {
    // First interaction today (Day 1)
    const firstResult = recordWellbeingInteraction({
      userId: TEST_USER,
      interactionType: WELLBEING_INTERACTION_TYPES.MOOD_CHECKIN_COMPLETED,
      source: "adhd.emotion-coach",
    });
    expect(firstResult.contributedToGrowth).toBe(true);
    expect(getGardenState(TEST_USER).currentDayInSeason).toBe(1);

    // Second interaction today -> logged, but does NOT advance day in season
    const secondResult = recordWellbeingInteraction({
      userId: TEST_USER,
      interactionType: WELLBEING_INTERACTION_TYPES.FOCUS_SESSION_COMPLETED,
      source: "support.focus_session",
    });
    expect(secondResult.contributedToGrowth).toBe(false);
    expect(getGardenState(TEST_USER).currentDayInSeason).toBe(1);

    // Third interaction today -> logged, but does NOT advance day in season
    const thirdResult = recordWellbeingInteraction({
      userId: TEST_USER,
      interactionType: WELLBEING_INTERACTION_TYPES.EXPOSURE_SESSION_COMPLETED,
      source: "ocd.erp",
    });
    expect(thirdResult.contributedToGrowth).toBe(false);
    expect(getGardenState(TEST_USER).currentDayInSeason).toBe(1);
  });

  it("preserves growth and flowers on missed days without resetting tree or season", () => {
    // Advance to day 10 (10 engagement days, 1 flower)
    let gardenState;
    for (let i = 0; i < 9; i++) {
      const past = new Date();
      past.setDate(past.getDate() - (10 - i)); // Past days
      const pastState = getGardenState(TEST_USER);
      pastState.currentDayInSeason = i + 1;
      pastState.totalEngagementDays = i + 1;
      pastState.lastEngagementDate = past.toISOString().split("T")[0];
      localStorage.setItem(`nb_garden_state_${TEST_USER}`, JSON.stringify(pastState));
    }

    // Fast forward state to day 10
    const stateBeforeGap = getGardenState(TEST_USER);
    expect(stateBeforeGap.currentDayInSeason).toBe(9);
    expect(stateBeforeGap.flowers).toBe(1);

    // Simulate 7-day gap of inactivity by setting lastEngagementDate to 7 days ago
    const gapDate = new Date();
    gapDate.setDate(gapDate.getDate() - 7);
    stateBeforeGap.lastEngagementDate = gapDate.toISOString().split("T")[0];
    localStorage.setItem(`nb_garden_state_${TEST_USER}`, JSON.stringify(stateBeforeGap));

    // Return after gap
    const returned = recordWellbeingInteraction({
      userId: TEST_USER,
      interactionType: WELLBEING_INTERACTION_TYPES.SELF_CARE_ACTION,
      source: "manual_checkin",
    });

    expect(returned.contributedToGrowth).toBe(true);
    const stateAfterReturn = getGardenState(TEST_USER);
    expect(stateAfterReturn.currentDayInSeason).toBe(10);
    expect(stateAfterReturn.flowers).toBe(1);
    expect(stateAfterReturn.encouragingMessage).toBe("Welcome back. Your garden is still here.");
  });

  it("connects Context Engine recommendations to Garden growth and adaptive messaging", () => {
    const result = recordWellbeingInteraction({
      userId: TEST_USER,
      interactionType: WELLBEING_INTERACTION_TYPES.ADAPTIVE_RECOMMENDATION_COMPLETED,
      source: "context_engine",
      metadata: { planId: "plan_123", moduleId: "support.grounding" },
    });

    expect(result.success).toBe(true);
    expect(result.interaction.source).toBe("context_engine");
    expect(result.interaction.metadata.planId).toBe("plan_123");

    const state = getGardenState(TEST_USER);
    expect(state.encouragingMessage).toBe("Thank you for listening to your needs today.");
  });

  it("generates non-diagnostic, supportive messaging without exposing clinical diagnosis or guilt", () => {
    const returningMsg = generateAdaptiveMessage({
      isFirstInteractionToday: true,
      lastEngagementDate: "2026-01-01",
      interactionType: WELLBEING_INTERACTION_TYPES.SELF_CARE_ACTION,
      source: "test",
    });
    expect(returningMsg).toBe("Welcome back. Your garden is still here.");
    expect(returningMsg).not.toContain("anxious");
    expect(returningMsg).not.toContain("depressed");
    expect(returningMsg).not.toContain("streak");
  });
});
