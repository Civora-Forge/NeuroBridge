import { beforeEach, describe, expect, it } from "vitest";
import {
  clearActiveSession,
  clearScenarioState,
  computeStreak,
  getAverageScore,
  getCompletedScenarioCount,
  getFavoriteScenarioIds,
  getPracticeStreak,
  getScenarioState,
  isFavoriteScenario,
  listCompletedSessions,
  loadActiveSession,
  recordCompletedSession,
  saveActiveSession,
  toggleFavoriteScenario,
} from "@/support/modules/socialScenarioSimulator/scenarioStore";

const SESSION = {
  id: "s-1",
  scenarioId: "daily_life.cafe-order",
  scenarioTitle: "Cafe Order",
  difficulty: "easy",
  turns: [{ id: "t1" }, { id: "t2" }],
};

const REPORT = {
  communicationScore: 82,
  subscores: { clarity: 80 },
  encouragement: "Nice work.",
  strengths: ["You asked clearly."],
  misunderstandings: [],
  alternatives: [],
};

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

beforeEach(() => {
  localStorage.clear();
});

describe("scenario store", () => {
  it("returns empty state for guests and never writes", () => {
    const state = getScenarioState(null);
    expect(state.sessions).toEqual([]);
    expect(state.favorites).toEqual([]);
    expect(state.streak.current).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it("records a completed session and persists it per user", () => {
    recordCompletedSession("user-1", {
      session: { ...SESSION, completedAt: isoDaysAgo(0) },
      report: REPORT,
    });
    const state = getScenarioState("user-1");
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].score).toBe(82);
    expect(state.sessions[0].title).toBe("Cafe Order");
    expect(state.sessions[0].turnCount).toBe(2);
    expect(getScenarioState("user-2").sessions).toHaveLength(0);
  });

  it("caps stored sessions at 60", () => {
    for (let i = 0; i < 65; i += 1) {
      recordCompletedSession("user-1", {
        session: { ...SESSION, id: `s-${i}`, completedAt: isoDaysAgo(i) },
        report: REPORT,
      });
    }
    expect(getScenarioState("user-1").sessions).toHaveLength(60);
  });

  it("computes a streak of consecutive practice days", () => {
    const sessions = [
      { completedAt: isoDaysAgo(2) },
      { completedAt: isoDaysAgo(1) },
      { completedAt: isoDaysAgo(0) },
    ];
    const streak = computeStreak(sessions);
    expect(streak.best).toBe(3);
    expect(streak.current).toBe(3);
  });

  it("breaks a streak on a gap", () => {
    const sessions = [
      { completedAt: isoDaysAgo(3) },
      { completedAt: isoDaysAgo(2) },
      { completedAt: isoDaysAgo(0) },
    ];
    const streak = computeStreak(sessions);
    expect(streak.best).toBe(2);
    expect(streak.current).toBe(1);
  });

  it("lists completed sessions newest first and respects limits", () => {
    recordCompletedSession("user-1", {
      session: { ...SESSION, id: "old", completedAt: isoDaysAgo(2) },
      report: REPORT,
    });
    recordCompletedSession("user-1", {
      session: { ...SESSION, id: "new", completedAt: isoDaysAgo(0) },
      report: REPORT,
    });
    const all = listCompletedSessions("user-1");
    expect(all[0].id).toBe("new");
    const limited = listCompletedSessions("user-1", { limit: 1 });
    expect(limited).toHaveLength(1);
  });

  it("tracks favorites per scenario", () => {
    expect(isFavoriteScenario("user-1", "daily_life.cafe-order")).toBe(false);
    const first = toggleFavoriteScenario("user-1", "daily_life.cafe-order");
    expect(first.added).toBe(true);
    expect(isFavoriteScenario("user-1", "daily_life.cafe-order")).toBe(true);
    const second = toggleFavoriteScenario("user-1", "daily_life.cafe-order");
    expect(second.added).toBe(false);
    expect(getFavoriteScenarioIds("user-1")).toEqual([]);
  });

  it("computes averages excluding abandoned sessions", () => {
    recordCompletedSession("user-1", {
      session: { ...SESSION, id: "a", completedAt: isoDaysAgo(1) },
      report: { ...REPORT, communicationScore: 80 },
    });
    recordCompletedSession("user-1", {
      session: { ...SESSION, id: "b", completedAt: isoDaysAgo(0) },
      report: { ...REPORT, communicationScore: 90 },
    });
    recordCompletedSession("user-1", {
      session: { ...SESSION, id: "c", completedAt: isoDaysAgo(0) },
      report: { ...REPORT, communicationScore: 10 },
      abandoned: true,
    });
    expect(getAverageScore("user-1")).toBe(85);
    expect(getCompletedScenarioCount("user-1")).toBe(2);
    expect(getPracticeStreak("user-1").current).toBeGreaterThanOrEqual(1);
  });

  it("persists, loads and clears the active session", () => {
    expect(loadActiveSession("user-1")).toBeNull();
    saveActiveSession("user-1", SESSION);
    expect(loadActiveSession("user-1").id).toBe("s-1");
    clearActiveSession("user-1");
    expect(loadActiveSession("user-1")).toBeNull();
  });

  it("records a completed session clears the active session", () => {
    saveActiveSession("user-1", SESSION);
    recordCompletedSession("user-1", {
      session: { ...SESSION, id: "s-2", completedAt: isoDaysAgo(0) },
      report: REPORT,
    });
    expect(loadActiveSession("user-1")).toBeNull();
  });

  it("clears the whole state for a user", () => {
    saveActiveSession("user-1", SESSION);
    toggleFavoriteScenario("user-1", "daily_life.cafe-order");
    clearScenarioState("user-1");
    const state = getScenarioState("user-1");
    expect(state.sessions).toEqual([]);
    expect(state.favorites).toEqual([]);
    expect(loadActiveSession("user-1")).toBeNull();
  });

  it("is safe against corrupt storage", () => {
    localStorage.setItem("nb_asd_social_scenarios_v1_user-1", "{not json");
    const state = getScenarioState("user-1");
    expect(state.sessions).toEqual([]);
  });
});
