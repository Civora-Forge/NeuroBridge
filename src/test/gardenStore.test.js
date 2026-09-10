import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getGardenState,
  fetchGardenStateAsync,
  saveGardenStateAsync,
  archiveGardenSeasonAsync,
  logGardenEngagement,
  advanceGardenDays,
  resetGardenState,
  calculateTreeMetrics,
  getGrowthStageTitle,
} from "../stores/gardenStore";

describe("Adaptive Wellbeing Garden Store & Persistence", () => {
  const TEST_USER = "test_garden_user";

  beforeEach(() => {
    localStorage.clear();
    resetGardenState(TEST_USER);
  });

  it("initializes with Day 1, 1 leaf, 0 flowers, and Season 1", () => {
    const state = getGardenState(TEST_USER);
    expect(state.season).toBe(1);
    expect(state.currentDayInSeason).toBe(1);
    expect(state.leaves).toBe(1);
    expect(state.flowers).toBe(0);
    expect(state.history).toEqual([]);
  });

  it("gradually develops leaves from Day 1 to Day 6", () => {
    for (let day = 1; day <= 6; day++) {
      const metrics = calculateTreeMetrics(day, day);
      expect(metrics.leaves).toBe(day);
    }
  });

  it("blooms 1 flower every 7 days of engagement", () => {
    const day7Metrics = calculateTreeMetrics(7, 7);
    expect(day7Metrics.flowers).toBe(1);

    const day14Metrics = calculateTreeMetrics(14, 14);
    expect(day14Metrics.flowers).toBe(2);

    const day21Metrics = calculateTreeMetrics(21, 21);
    expect(day21Metrics.flowers).toBe(3);

    const day28Metrics = calculateTreeMetrics(28, 28);
    expect(day28Metrics.flowers).toBe(4);
  });

  it("does NOT reset progress on missing days (non-punitive mechanics)", () => {
    // Advance to day 10 (10 total days, 1 flower)
    advanceGardenDays(TEST_USER, 9);
    const beforeBreak = getGardenState(TEST_USER);
    expect(beforeBreak.currentDayInSeason).toBe(10);
    expect(beforeBreak.flowers).toBe(1);

    // Simulate 5 days gap by changing lastEngagementDate to 5 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    beforeBreak.lastEngagementDate = pastDate.toISOString().split("T")[0];
    localStorage.setItem(`nb_garden_state_${TEST_USER}`, JSON.stringify(beforeBreak));

    // Log new engagement after break
    const resumed = logGardenEngagement(TEST_USER);
    expect(resumed.currentDayInSeason).toBe(11);
    expect(resumed.totalEngagementDays).toBe(11);
    expect(resumed.flowers).toBe(1);
    expect(resumed.encouragingMessage).toBeDefined();
  });

  it("completes 30-day season cycle and archives tree to history", () => {
    // Advance to day 30
    advanceGardenDays(TEST_USER, 29);
    const day30State = getGardenState(TEST_USER);
    expect(day30State.currentDayInSeason).toBe(30);

    // Next engagement triggers season completion
    const seasonCompleteState = logGardenEngagement(TEST_USER, { forceNextDay: true });
    expect(seasonCompleteState.season).toBe(2);
    expect(seasonCompleteState.currentDayInSeason).toBe(1);
    expect(seasonCompleteState.history.length).toBe(1);
    expect(seasonCompleteState.history[0].season).toBe(1);
    expect(seasonCompleteState.history[0].totalFlowers).toBe(4);
  });

  it("returns appropriate growth stage titles", () => {
    expect(getGrowthStageTitle(1, 0)).toBe("Fresh Sprout");
    expect(getGrowthStageTitle(7, 1)).toBe("Budding Branches");
    expect(getGrowthStageTitle(14, 2)).toBe("Flowering Canopy");
    expect(getGrowthStageTitle(30, 4)).toBe("Mature Season Harvest");
  });

  it("handles offline and fallback states gracefully in async persistence", async () => {
    const loaded = await fetchGardenStateAsync(TEST_USER);
    expect(loaded).toBeDefined();
    expect(loaded.season).toBe(1);

    const saved = await saveGardenStateAsync(TEST_USER, loaded);
    expect(saved).toEqual(loaded);

    await expect(archiveGardenSeasonAsync(TEST_USER, { season: 1, totalEngagementDays: 30 })).resolves.not.toThrow();
  });
});
