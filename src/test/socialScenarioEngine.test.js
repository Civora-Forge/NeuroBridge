import { describe, expect, it } from "vitest";
import {
  abandonScenarioSession,
  beginScenarioSession,
  completeScenarioSession,
  createScenarioSession,
  getEffectiveMoments,
  getScenarioProgress,
  getScenarioDurationMs,
  matchOptionKeywords,
  normalizeDifficulty,
  pauseScenarioSession,
  pickOption,
  resumeScenarioSession,
  restartScenarioSession,
  submitPlayerMessage,
} from "@/support/modules/socialScenarioSimulator/scenarioEngineService";
import { SESSION_STATUS } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";

const FIXTURE = {
  id: "test.scenario",
  title: "Test Scenario",
  difficulty: "easy",
  unexpectedPrompt: "Wait — did you mean tomorrow or next week?",
  moments: [
    {
      prompt: "Hello! How can I help you today?",
      options: [
        {
          text: "I'd like to ask a question.",
          keywords: ["question", "ask"],
          reply: "Of course — go ahead.",
          cue: "You signalled you wanted to speak.",
          suggestion: "Starting with a clear request works well.",
          quality: { clarity: 90, politeness: 80, confidence: 70, emotionalAppropriateness: 80, completeness: 80 },
        },
        {
          text: "I'm fine, thanks.",
          keywords: ["fine", "thanks"],
          reply: "No problem at all.",
          cue: "You declined politely.",
          suggestion: "Adding thanks keeps it warm.",
          quality: { clarity: 70, politeness: 90, confidence: 60, emotionalAppropriateness: 80, completeness: 70 },
        },
      ],
      fallback: {
        reply: "Take your time.",
        cue: "The other person stayed patient.",
        suggestion: "A short clear reply helps.",
        quality: { clarity: 60, politeness: 70, confidence: 55, emotionalAppropriateness: 65, completeness: 55 },
      },
    },
    {
      prompt: "Great — what else can I do for you?",
      options: [
        {
          text: "That's all, thank you.",
          keywords: ["all", "thank"],
          reply: "Perfect, have a nice day!",
          cue: "You closed the exchange warmly.",
          suggestion: "A clear thank-you ends well.",
          quality: { clarity: 88, politeness: 85, confidence: 78, emotionalAppropriateness: 88, completeness: 82 },
        },
      ],
      fallback: {
        reply: "No worries at all.",
        cue: "The close was easy.",
        suggestion: "A short thanks completes it.",
        quality: { clarity: 60, politeness: 70, confidence: 55, emotionalAppropriateness: 65, completeness: 55 },
      },
    },
    {
      prompt: "Anything else before I go?",
      options: [
        {
          text: "No, thank you, goodbye.",
          keywords: ["goodbye", "thank"],
          reply: "Goodbye!",
          cue: "You said goodbye clearly.",
          suggestion: "A goodbye closes the loop.",
          quality: { clarity: 90, politeness: 90, confidence: 80, emotionalAppropriateness: 90, completeness: 85 },
        },
      ],
      fallback: {
        reply: "Okay, take care.",
        cue: "The close still worked.",
        suggestion: "Try a final thank-you.",
        quality: { clarity: 60, politeness: 70, confidence: 55, emotionalAppropriateness: 65, completeness: 55 },
      },
    },
  ],
};

describe("scenario engine", () => {
  it("normalizes unknown difficulty to easy", () => {
    expect(normalizeDifficulty("extreme")).toBe("easy");
    expect(normalizeDifficulty("hard")).toBe("hard");
  });

  it("caps effective moments for easy difficulty", () => {
    expect(getEffectiveMoments(FIXTURE, "easy")).toHaveLength(3);
  });

  it("keeps full length for medium/hard difficulty", () => {
    expect(getEffectiveMoments(FIXTURE, "medium")).toHaveLength(3);
    expect(getEffectiveMoments(FIXTURE, "hard")).toHaveLength(3);
  });

  it("creates a not-started session with deterministic defaults", () => {
    const session = createScenarioSession({
      scenario: FIXTURE,
      userId: "user-1",
      difficulty: "easy",
      now: 1000,
    });
    expect(session.status).toBe(SESSION_STATUS.NOT_STARTED);
    expect(session.scenarioId).toBe("test.scenario");
    expect(session.momentCount).toBe(3);
    expect(session.messages).toEqual([]);
    expect(session.startedAt).toBeNull();
    expect(session.openingPrompt).toBe("Hello! How can I help you today?");
  });

  it("begins a session by seeding the opening NPC message", () => {
    const session = createScenarioSession({ scenario: FIXTURE, difficulty: "easy" });
    const begun = beginScenarioSession(session);
    expect(begun.status).toBe(SESSION_STATUS.ACTIVE);
    expect(begun.messages).toHaveLength(1);
    expect(begun.messages[0].role).toBe("npc");
    expect(begun.messages[0].text).toBe("Hello! How can I help you today?");
  });

  it("counts keyword matches case-insensitively", () => {
    expect(matchOptionKeywords("I have a Question about the reading", ["question", "reading"])).toBe(2);
    expect(matchOptionKeywords("nothing relevant", ["question"])).toBe(0);
  });

  it("picks the best matching option above the threshold", () => {
    const moment = FIXTURE.moments[0];
    expect(pickOption(moment, "I have a question", "easy")?.text).toBe("I'd like to ask a question.");
    expect(pickOption(moment, "I'm fine thanks", "easy")?.text).toBe("I'm fine, thanks.");
  });

  it("uses the fallback when no option clears the threshold", () => {
    const moment = FIXTURE.moments[0];
    expect(pickOption(moment, "asdfgh", "easy")).toBeNull();
    const session = createScenarioSession({ scenario: FIXTURE, difficulty: "easy" });
    const begun = beginScenarioSession(session);
    const { session: next, turn } = submitPlayerMessage(begun, "asdfgh", { scenario: FIXTURE });
    expect(turn.matched).toBe(false);
    expect(next.momentIndex).toBe(0);
  });

  it("requires more keyword hits at higher difficulty for free text", () => {
    const moment = FIXTURE.moments[0];
    expect(pickOption(moment, "I have a question to ask", "easy")).not.toBeNull();
    expect(pickOption(moment, "I have a question to ask", "medium")).not.toBeNull();
    expect(pickOption(moment, "I have a question to ask", "hard")).toBeNull();
  });

  it("advances through the conversation and completes", () => {
    let session = createScenarioSession({ scenario: FIXTURE, difficulty: "easy" });
    session = beginScenarioSession(session);
    let result = submitPlayerMessage(session, "I'd like to ask a question", { scenario: FIXTURE });
    session = result.session;
    expect(result.completed).toBe(false);
    result = submitPlayerMessage(session, "That's all, thank you", { scenario: FIXTURE });
    session = result.session;
    result = submitPlayerMessage(session, "No, thank you, goodbye", { scenario: FIXTURE });
    expect(result.completed).toBe(true);
    expect(result.session.status).toBe(SESSION_STATUS.COMPLETED);
    expect(result.session.completedAt).not.toBeNull();
    expect(result.session.turns).toHaveLength(3);
  });

  it("always matches a scripted quick reply even at high difficulty", () => {
    const moment = FIXTURE.moments[0];
    expect(pickOption(moment, "I'd like to ask a question.", "hard")).not.toBeNull();
  });

  it("inserts an unexpected beat mid-conversation at hard difficulty and resolves it", () => {
    let session = createScenarioSession({ scenario: FIXTURE, difficulty: "hard" });
    session = beginScenarioSession(session);
    // moment 0 -> index 1
    session = submitPlayerMessage(session, "I'd like to ask a question.", { scenario: FIXTURE }).session;
    // moment 1 -> index 2, 2 % 2 === 0 => beat pending
    session = submitPlayerMessage(session, "That's all, thank you.", { scenario: FIXTURE }).session;
    expect(session.pendingUnexpected).toBe("Wait — did you mean tomorrow or next week?");
    // consume the beat (no advance)
    const beat = submitPlayerMessage(session, "I meant next week, thank you", { scenario: FIXTURE });
    expect(beat.turn.unexpected).toBe(true);
    expect(beat.session.pendingUnexpected).toBeNull();
    expect(beat.session.momentIndex).toBe(2);
    // moment 2 -> index 3, completes
    const final = submitPlayerMessage(beat.session, "No, thank you, goodbye.", { scenario: FIXTURE });
    expect(final.completed).toBe(true);
  });

  it("does not insert a beat at easy difficulty", () => {
    let session = createScenarioSession({ scenario: FIXTURE, difficulty: "easy" });
    session = beginScenarioSession(session);
    session = submitPlayerMessage(session, "I'd like to ask a question.", { scenario: FIXTURE }).session;
    session = submitPlayerMessage(session, "That's all, thank you.", { scenario: FIXTURE }).session;
    expect(session.pendingUnexpected).toBeNull();
    expect(session.status).toBe(SESSION_STATUS.ACTIVE);
  });

  it("does not advance on a fallback reply", () => {
    const session = createScenarioSession({ scenario: FIXTURE, difficulty: "easy" });
    const begun = beginScenarioSession(session);
    const { session: next } = submitPlayerMessage(begun, "zzzz", { scenario: FIXTURE });
    expect(next.momentIndex).toBe(0);
  });

  it("rejects messages when the session is not active", () => {
    const session = createScenarioSession({ scenario: FIXTURE, difficulty: "easy" });
    const result = submitPlayerMessage(session, "hello", { scenario: FIXTURE });
    expect(result.error).toBe("session_not_active");
  });

  it("pauses, resumes and restarts sessions", () => {
    let session = beginScenarioSession(createScenarioSession({ scenario: FIXTURE, difficulty: "easy" }));
    const paused = pauseScenarioSession(session);
    expect(paused.status).toBe(SESSION_STATUS.PAUSED);
    const resumed = resumeScenarioSession(paused);
    expect(resumed.status).toBe(SESSION_STATUS.ACTIVE);
    const restarted = restartScenarioSession(resumed);
    expect(restarted.status).toBe(SESSION_STATUS.NOT_STARTED);
    expect(restarted.scenarioId).toBe("test.scenario");
    expect(restarted.momentCount).toBe(3);
    expect(restarted.openingPrompt).toBe("Hello! How can I help you today?");
  });

  it("completes and abandons sessions explicitly", () => {
    let session = beginScenarioSession(createScenarioSession({ scenario: FIXTURE, difficulty: "easy" }));
    const completed = completeScenarioSession(session);
    expect(completed.status).toBe(SESSION_STATUS.COMPLETED);
    session = beginScenarioSession(createScenarioSession({ scenario: FIXTURE, difficulty: "easy" }));
    const abandoned = abandonScenarioSession(session);
    expect(abandoned.status).toBe(SESSION_STATUS.COMPLETED);
    expect(abandoned.abandoned).toBe(true);
  });

  it("reports progress and duration for a completed session", () => {
    let session = beginScenarioSession(
      createScenarioSession({ scenario: FIXTURE, difficulty: "easy", now: 1000 }),
      { now: 1000 },
    );
    const early = getScenarioProgress(FIXTURE, session);
    expect(early.percent).toBeGreaterThan(0);
    session = submitPlayerMessage(session, "I'd like to ask a question", { scenario: FIXTURE, now: 2000 }).session;
    expect(getScenarioProgress(FIXTURE, session).current).toBe(2);
    session = submitPlayerMessage(session, "That's all, thank you", { scenario: FIXTURE, now: 3000 }).session;
    session = submitPlayerMessage(session, "No, thank you, goodbye", { scenario: FIXTURE, now: 4000 }).session;
    expect(session.status).toBe(SESSION_STATUS.COMPLETED);
    expect(getScenarioDurationMs(session)).toBe(3000);
  });
});
