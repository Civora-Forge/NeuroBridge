import { describe, expect, it } from "vitest";
import {
  abandonSession,
  beginSession,
  completeSession,
  createSession,
  fallbackNpcTurn,
  pauseSession,
  resumeSession,
  retryLastUserTurn,
  submitUserTurn,
} from "../services/conversationService";
import { getFallbackScenario } from "../services/scenarioGenerator";
import { SESSION_STATUS, RESPONSE_SOURCE, SPEAKER } from "../types/communicationTypes";

function buildSession(overrides = {}) {
  const scenario = getFallbackScenario({ domain: "requesting_help", effectiveDifficulty: 3 });
  return createSession({ userId: "user-1", scenario, difficulty: 3, ...overrides });
}

describe("createSession", () => {
  it("creates an inactive session with a turn limit", () => {
    const session = buildSession();
    expect(session.status).toBe(SESSION_STATUS.NOT_STARTED);
    expect(session.turnLimit).toBe(8);
    expect(session.moduleId).toBe("communication.simulator");
  });

  it("applies a simplify signal to effective difficulty", () => {
    const session = buildSession({ difficulty: 4, signals: { simplify: true } });
    expect(session.effectiveDifficulty).toBe(3);
  });
});

describe("beginSession", () => {
  it("activates a session exactly once", () => {
    const first = beginSession(buildSession());
    expect(first.status).toBe(SESSION_STATUS.ACTIVE);
    expect(first.startedAt).toBeTruthy();
    const second = beginSession(first);
    expect(second.startedAt).toBe(first.startedAt);
  });
});

describe("submitUserTurn", () => {
  it("rejects an empty reply without advancing", async () => {
    const session = beginSession(buildSession());
    const { error, session: next } = await submitUserTurn(session, { text: "   " }, { npcProvider: async () => null });
    expect(error).toBe("empty_reply");
    expect(next.turnCount).toBe(0);
  });

  it("rejects turns when the session is not active", async () => {
    const { error } = await submitUserTurn(buildSession(), { text: "hi" }, { npcProvider: async () => null });
    expect(error).toBe("session_not_active");
  });

  it("adds a user turn and a deterministic partner reply", async () => {
    const session = beginSession(buildSession());
    const { session: next, npcTurn } = await submitUserTurn(session, { text: "Can you help me find a book?" }, { npcProvider: async () => null });
    expect(npcTurn).not.toBeNull();
    expect(npcTurn.line.length).toBeGreaterThan(0);
    expect(next.turnCount).toBe(1);
    expect(next.turns).toHaveLength(2);
    expect(next.turns[0].speaker).toBe(SPEAKER.USER);
    expect(next.turns[1].speaker).toBe(SPEAKER.NPC);
    expect(next.status).toBe(SESSION_STATUS.ACTIVE);
  });

  it("uses the AI provider when it returns a valid turn", async () => {
    const session = beginSession(buildSession());
    const { session: next, npcTurn } = await submitUserTurn(session, { text: "hello" }, {
      npcProvider: async () => ({ line: "Hi there!", followUp: "What brings you here?", emotion: "friendly", done: false }),
    });
    expect(npcTurn.line).toBe("Hi there!");
    expect(next.turns[1].text).toContain("Hi there!");
    expect(next.turns[1].text).toContain("What brings you here?");
  });

  it("falls back to deterministic replies when the AI returns invalid data", async () => {
    const session = beginSession(buildSession());
    const { session: next } = await submitUserTurn(session, { text: "hello" }, {
      npcProvider: async () => ({ bogus: true }),
    });
    expect(next.turns[1].speaker).toBe(SPEAKER.NPC);
    expect(next.turns[1].text.length).toBeGreaterThan(0);
  });

  it("falls back when the AI provider throws", async () => {
    const session = beginSession(buildSession());
    const { session: next, error } = await submitUserTurn(session, { text: "hello" }, {
      npcProvider: async () => {
        throw new Error("boom");
      },
    });
    expect(error).toBeNull();
    expect(next.turns[1].speaker).toBe(SPEAKER.NPC);
  });

  it("marks the session complete when the turn limit is reached", async () => {
    const scenario = getFallbackScenario({ domain: "small_talk", effectiveDifficulty: 3 });
    const session = beginSession(
      createSession({ userId: "u", scenario, difficulty: 3, signals: {} }),
    );
    let current = session;
    while (current.status === SESSION_STATUS.ACTIVE) {
      const result = await submitUserTurn(current, { text: "a short reply here" }, { npcProvider: async () => ({ line: "ok", followUp: "and?", done: false }) });
      current = result.session;
      if (current.turnCount >= current.turnLimit) break;
    }
    expect(current.status).toBe(SESSION_STATUS.COMPLETED);
    expect(current.completedAt).toBeTruthy();
  });

  it("completes early when the provider signals done", async () => {
    const session = beginSession(buildSession());
    const { session: next } = await submitUserTurn(session, { text: "bye" }, {
      npcProvider: async () => ({ line: "ok", followUp: "see you", done: true }),
    });
    expect(next.status).toBe(SESSION_STATUS.COMPLETED);
  });
});

describe("fallbackNpcTurn", () => {
  it("always produces a complete turn", () => {
    const turn = fallbackNpcTurn(buildSession());
    expect(turn.line.length).toBeGreaterThan(0);
    expect(turn.followUp.length).toBeGreaterThan(0);
    expect(typeof turn.done).toBe("boolean");
  });

  it("produces a closing line on the final turn", () => {
    const session = { ...buildSession(), turnCount: 7, turnLimit: 8 };
    const turn = fallbackNpcTurn(session);
    expect(turn.done).toBe(true);
  });
});

describe("retryLastUserTurn", () => {
  it("removes the last exchange so the user can reply again", async () => {
    let session = beginSession(buildSession());
    session = (await submitUserTurn(session, { text: "first reply" }, { npcProvider: async () => ({ line: "ok", followUp: "and?", done: false }) })).session;
    session = (await submitUserTurn(session, { text: "second reply" }, { npcProvider: async () => ({ line: "ok", followUp: "and?", done: false }) })).session;
    expect(session.turnCount).toBe(2);

    const retried = retryLastUserTurn(session);
    expect(retried.turnCount).toBe(1);
    expect(retried.turns).toHaveLength(2);
    expect(retried.status).toBe(SESSION_STATUS.ACTIVE);
  });
});

describe("pause/resume/abandon/complete", () => {
  it("pauses and resumes an active session", () => {
    const session = beginSession(buildSession());
    const paused = pauseSession(session);
    expect(paused.status).toBe(SESSION_STATUS.PAUSED);
    expect(resumeSession(paused).status).toBe(SESSION_STATUS.ACTIVE);
  });

  it("abandons a session with a completedAt timestamp", () => {
    const abandoned = abandonSession(buildSession());
    expect(abandoned.status).toBe(SESSION_STATUS.ABANDONED);
    expect(abandoned.completedAt).toBeTruthy();
  });

  it("attaches an evaluation on completion", () => {
    const session = beginSession(buildSession());
    const done = completeSession(session, { overallScore: 70 });
    expect(done.status).toBe(SESSION_STATUS.COMPLETED);
    expect(done.evaluation.overallScore).toBe(70);
  });
});

describe("response source propagation", () => {
  it("records voice replies with their source", async () => {
    const session = beginSession(buildSession());
    const { session: next } = await submitUserTurn(
      session,
      { text: "spoken reply", source: RESPONSE_SOURCE.VOICE, speech: { wpm: 140, wordCount: 2, fillerCount: 0, estimatedSilenceMs: 100, latencyMs: 900, durationMs: 1200, transcript: "spoken reply" } },
      { npcProvider: async () => null },
    );
    expect(next.turns[0].source).toBe(RESPONSE_SOURCE.VOICE);
    expect(next.turns[0].speech.wpm).toBe(140);
  });
});
