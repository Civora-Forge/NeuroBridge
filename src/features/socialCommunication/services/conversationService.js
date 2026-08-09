/**
 * conversationService.js — Pure session state machine for the Social
 * Communication Simulator.
 *
 * The session lifecycle: not_started → active ⇄ paused → completed/abandoned.
 * A "turn" is one exchange: the user replies, the AI partner (or a
 * deterministic fallback) answers. The AI partner is injected through a
 * provider function so the state machine stays pure and unit-testable.
 * Success is never fabricated: if the provider returns nothing usable, the
 * deterministic fallback takes over.
 */

import {
  COMMUNICATION_MODULE_ID,
  NpcTurnSchema,
  RESPONSE_SOURCE,
  SCENARIO_SOURCE,
  SESSION_STATUS,
  SPEAKER,
  TURN_LIMIT_FOR,
} from "../types/communicationTypes";
import { generateNpcTurn } from "./aiService";

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession({ userId = null, scenario, difficulty, signals = {} } = {}) {
  const effectiveDifficulty =
    signals.simplify && difficulty > 1 ? difficulty - 1 : difficulty;

  return {
    id: makeId("session"),
    moduleId: COMMUNICATION_MODULE_ID,
    userId: userId ?? null,
    scenario,
    difficulty,
    effectiveDifficulty,
    turnLimit: TURN_LIMIT_FOR(effectiveDifficulty),
    hintsEnabled: signals.provideHints === true,
    status: SESSION_STATUS.NOT_STARTED,
    turns: [],
    turnCount: 0,
    hintsUsed: 0,
    startedAt: null,
    completedAt: null,
    evaluation: null,
    adaptation: signals.active ? { pacing: signals.slowPace ? "slow" : "normal", distractionFree: signals.reduceDistractions, provideHints: signals.provideHints } : null,
  };
}

export function beginSession(session) {
  if (!session) return session;
  if (session.status !== SESSION_STATUS.NOT_STARTED) return session;
  return {
    ...session,
    status: SESSION_STATUS.ACTIVE,
    startedAt: session.startedAt ?? new Date().toISOString(),
  };
}

function withTurn(session, turn) {
  return {
    ...session,
    turns: [...session.turns, turn],
    turnCount: session.turnCount + (turn.speaker === SPEAKER.USER ? 1 : 0),
    hintsUsed: session.hintsUsed + (turn.isHint ? 1 : 0),
  };
}

/**
 * Deterministic partner reply used whenever the AI provider is unavailable,
 * times out, or returns invalid data. Always produces a valid turn.
 */
export function fallbackNpcTurn(session) {
  const scenario = session?.scenario ?? {};
  const goal = scenario.goal ?? "have a short conversation";
  const npcName = scenario.npc?.name ?? "Alex";
  const isLast =
    session.turnCount + 1 >= session.turnLimit || !scenario.suggestedResponses?.length;

  if (isLast) {
    return {
      line: `Thanks for chatting with me, ${npcName} will see you around!`,
      followUp: "It was nice talking — see you next time!",
      emotion: "warm",
      done: true,
      hint: "",
    };
  }

  const followUps = [
    `I see. And how does that connect to your goal of ${goal}`,
    `Interesting. Could you tell me a bit more about that?`,
    `That makes sense. What would you do next in this situation?`,
    `Got it. Is there anything else you'd like to say about that?`,
    `Okay. And how are you feeling about it so far?`,
  ];
  const followUp = followUps[session.turnCount % followUps.length];

  return {
    line: "I see.",
    followUp,
    emotion: "friendly",
    done: false,
    hint: "",
  };
}

/** Build the AI provider using the feature's Gemini wrapper. */
export function getDefaultNpcProvider({ apiKey }) {
  return async (context) => {
    const result = await generateNpcTurn({
      scenario: context.scenario,
      userTurn: context.userTurn,
      turnIndex: context.turnIndex,
      totalTurns: context.totalTurns,
      apiKey,
    });
    if (!result) return null;
    const parsed = NpcTurnSchema.safeParse(result);
    return parsed.success ? parsed.data : null;
  };
}

/**
 * Submit a user reply and advance the conversation.
 * @param {object} session
 * @param {{ text: string, source: string, speech?: object }} input
 * @param {{ npcProvider?: Function }} options
 * @returns {Promise<{ session: object, npcTurn: object|null, error: string|null }>}
 */
export async function submitUserTurn(session, input = {}, options = {}) {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!session || session.status !== SESSION_STATUS.ACTIVE) {
    return { session, npcTurn: null, error: "session_not_active" };
  }
  if (!text) {
    return { session, npcTurn: null, error: "empty_reply" };
  }

  const userTurn = {
    id: makeId("turn"),
    speaker: SPEAKER.USER,
    text,
    source: input.source === RESPONSE_SOURCE.VOICE ? RESPONSE_SOURCE.VOICE : RESPONSE_SOURCE.TEXT,
    speech: input.speech ?? null,
    timestamp: new Date().toISOString(),
  };

  const withUserTurn = withTurn(session, userTurn);

  const provider =
    typeof options.npcProvider === "function" ? options.npcProvider : getDefaultNpcProvider({ apiKey: options.apiKey });

  let npcTurn = null;
  try {
    npcTurn = await provider({
      scenario: withUserTurn.scenario,
      userTurn: text,
      turnIndex: withUserTurn.turnCount,
      totalTurns: withUserTurn.turnLimit,
      session: withUserTurn,
    });
  } catch {
    npcTurn = null;
  }

  const validatedNpc = npcTurn ? NpcTurnSchema.safeParse(npcTurn) : { success: false };
  const finalNpc = validatedNpc.success ? validatedNpc.data : fallbackNpcTurn(withUserTurn);

  const npcText = [finalNpc.line, finalNpc.followUp].filter(Boolean).join(" ");
  const npcTurnRecord = {
    id: makeId("turn"),
    speaker: SPEAKER.NPC,
    text: npcText,
    source: SCENARIO_SOURCE.FALLBACK,
    timestamp: new Date().toISOString(),
  };

  const completed = Boolean(finalNpc.done) || withUserTurn.turnCount >= withUserTurn.turnLimit;
  const next = withTurn(withUserTurn, npcTurnRecord);
  next.status = completed ? SESSION_STATUS.COMPLETED : next.status;
  if (completed && !next.completedAt) {
    next.completedAt = new Date().toISOString();
  }

  return { session: next, npcTurn: finalNpc, error: null };
}

/**
 * Remove the last user turn + its partner reply so the user can try again.
 * The partner's most recent message stays as the prompt.
 */
export function retryLastUserTurn(session) {
  if (!session || session.status !== SESSION_STATUS.ACTIVE) return session;
  if (session.turns.length < 2) return session;

  const turns = [...session.turns];
  const last = turns[turns.length - 1];
  if (last.speaker === SPEAKER.USER) {
    turns.pop();
  } else if (turns.length >= 2 && turns[turns.length - 2].speaker === SPEAKER.USER) {
    turns.pop();
    turns.pop();
  }

  const userTurns = turns.filter((turn) => turn.speaker === SPEAKER.USER);
  const next = {
    ...session,
    turns,
    turnCount: userTurns.length,
    completedAt: null,
  };
  next.status = SESSION_STATUS.ACTIVE;
  return next;
}

export function pauseSession(session) {
  if (!session || session.status !== SESSION_STATUS.ACTIVE) return session;
  return { ...session, status: SESSION_STATUS.PAUSED };
}

export function resumeSession(session) {
  if (!session || session.status !== SESSION_STATUS.PAUSED) return session;
  return { ...session, status: SESSION_STATUS.ACTIVE };
}

export function abandonSession(session) {
  if (!session) return session;
  return {
    ...session,
    status: SESSION_STATUS.ABANDONED,
    completedAt: session.completedAt ?? new Date().toISOString(),
  };
}

export function completeSession(session, evaluation) {
  if (!session) return session;
  return {
    ...session,
    status: SESSION_STATUS.COMPLETED,
    completedAt: session.completedAt ?? new Date().toISOString(),
    evaluation,
  };
}
