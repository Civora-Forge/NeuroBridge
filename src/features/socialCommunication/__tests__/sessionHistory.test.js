import { beforeEach, describe, expect, it } from "vitest";
import {
  clearActiveSession,
  getSessionHistoryStats,
  listSessionOutcomes,
  loadActiveSession,
  saveActiveSession,
  saveSessionOutcome,
} from "../services/sessionHistory";
import { beginSession, createSession, submitUserTurn } from "../services/conversationService";
import { getFallbackScenario } from "../services/scenarioGenerator";
import { evaluateSession } from "../services/evaluationService";
import { SESSION_STATUS } from "../types/communicationTypes";

async function makeCompletedSession() {
  const scenario = getFallbackScenario({ domain: "small_talk", effectiveDifficulty: 3 });
  let session = beginSession(createSession({ userId: "user-1", scenario, difficulty: 3 }));
  session = (await submitUserTurn(session, { text: "Hi, how are you today?" }, { npcProvider: async () => null })).session;
  session = (await submitUserTurn(session, { text: "That sounds good, what about you?" }, { npcProvider: async () => null })).session;
  const evaluation = evaluateSession(session);
  return { ...session, status: SESSION_STATUS.COMPLETED, evaluation };
}

beforeEach(() => {
  localStorage.clear();
});

describe("saveSessionOutcome + listSessionOutcomes", () => {
  it("persists a completed session as a Role 4 outcome (metrics only)", async () => {
    const session = await makeCompletedSession();
    const saved = await saveSessionOutcome({ userId: "user-1", session });

    expect(saved).not.toBeNull();
    expect(saved.moduleId).toBe("communication.simulator");
    expect(saved.status).toBe("completed");
    expect(saved.metrics.communicationScore).toBe(session.evaluation.overallScore);
    expect(saved.metrics.domain).toBe("small_talk");
    expect(JSON.stringify(saved).includes("Hi, how are you today?")).toBe(false);
  });

  it("returns null without a user or session id", async () => {
    expect(await saveSessionOutcome({ userId: null, session: {} })).toBeNull();
    expect(await saveSessionOutcome({ userId: "u", session: {} })).toBeNull();
  });

  it("lists only this module's outcomes", async () => {
    const session = await makeCompletedSession();
    await saveSessionOutcome({ userId: "user-1", session });
    const outcomes = listSessionOutcomes("user-1");
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].moduleId).toBe("communication.simulator");
    expect(listSessionOutcomes("other-user")).toHaveLength(0);
  });

  it("computes history stats", async () => {
    const session = await makeCompletedSession();
    await saveSessionOutcome({ userId: "user-1", session });
    const stats = getSessionHistoryStats("user-1");
    expect(stats.completedSessions).toBe(1);
    expect(stats.averageScore).toBe(session.evaluation.overallScore);
    expect(stats.streak.current).toBe(1);
  });
});

describe("active session resume", () => {
  it("saves, loads and clears an active session", () => {
    const active = { id: "session-x", status: "active", turns: [{ id: "t1", text: "hi" }] };
    saveActiveSession("user-1", active);
    const loaded = loadActiveSession("user-1");
    expect(loaded.id).toBe("session-x");
    clearActiveSession("user-1");
    expect(loadActiveSession("user-1")).toBeNull();
  });

  it("caps persisted turn history for privacy", () => {
    const manyTurns = Array.from({ length: 60 }, (_, index) => ({ id: `t${index}`, text: `turn ${index}` }));
    saveActiveSession("user-1", { id: "session-x", status: "active", turns: manyTurns });
    const loaded = loadActiveSession("user-1");
    expect(loaded.turns.length).toBeLessThanOrEqual(40);
  });
});
