/**
 * scenarioEngineService.js — Deterministic conversation engine for the Social
 * Scenario Simulator.
 *
 * Pure functions over scenario data + session state. No React, no storage, no
 * Date-dependent logic beyond a `now` parameter (injectable for tests).
 *
 * Session state machine:
 *   not_started → active → paused ⇄ active → completed
 *                     └────────→ completed (via beat or explicit finish)
 *
 * Difficulty changes session length (maxMoments), how strictly free text is
 * matched (freeTextThreshold) and how often the AI partner adds an
 * "unexpected" conversational beat (unexpectedEvery).
 */

import {
  DIFFICULTY_LEVELS,
  DIFFICULTY_IDS,
  SESSION_STATUS,
  QUALITY_PRESETS,
} from "./socialScenarioTypes";

function defaultIdFactory(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createId(prefix, idFactory) {
  return (idFactory ?? defaultIdFactory)(prefix);
}

/** Generic warm acknowledgement used when the user handles an unexpected beat. */
export const UNEXPECTED_ACKNOWLEDGEMENT =
  "Ah, good question — thank you for rolling with that. I'll keep that in mind.";

/** Normalize a difficulty id; falls back to "easy" for unknown values. */
export function normalizeDifficulty(difficulty) {
  return DIFFICULTY_IDS.includes(difficulty) ? difficulty : "easy";
}

export function getDifficultyConfig(difficulty) {
  return DIFFICULTY_LEVELS[normalizeDifficulty(difficulty)];
}

/** Keyword match count for a player message against an option's keywords. */
export function matchOptionKeywords(text, keywords) {
  const lower = String(text ?? "").toLowerCase();
  if (!keywords || keywords.length === 0) return 0;
  return keywords.reduce(
    (score, keyword) => score + (lower.includes(String(keyword).toLowerCase()) ? 1 : 0),
    0,
  );
}

/** Pick the best-matching option for a message at a given difficulty.
 *  Returns null when no option clears the difficulty's threshold.
 *  Scripted quick replies (exact text) always match, so clicking a suggested
 *  reply never fails — the freeTextThreshold only applies to typed replies. */
export function pickOption(moment, text, difficulty) {
  if (!moment || !Array.isArray(moment.options)) return null;
  const normalizedText = String(text ?? "").trim().toLowerCase();
  const exact = moment.options.find(
    (option) => String(option.text ?? "").trim().toLowerCase() === normalizedText,
  );
  if (exact) return exact;
  const threshold = getDifficultyConfig(difficulty).freeTextThreshold;
  let best = null;
  let bestScore = 0;
  for (const option of moment.options) {
    const score = matchOptionKeywords(text, option.keywords);
    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  }
  return bestScore >= threshold ? best : null;
}

export function getEffectiveMoments(scenario, difficulty) {
  const maxMoments = getDifficultyConfig(difficulty).maxMoments;
  return Array.isArray(scenario?.moments) ? scenario.moments.slice(0, maxMoments) : [];
}

/**
 * Create a fresh session for a scenario.
 *
 * @param {{ scenario: object, userId?: string, difficulty?: string,
 *           now?: number, idFactory?: Function,
 *           openingPrompt?: string, unexpectedPrompt?: string }} options
 */
export function createScenarioSession({
  scenario,
  userId,
  difficulty = "easy",
  now = Date.now(),
  idFactory,
  openingPrompt,
  unexpectedPrompt,
}) {
  if (!scenario) {
    throw new Error("A scenario is required to create a session");
  }
  const normalized = normalizeDifficulty(difficulty);
  const moments = getEffectiveMoments(scenario, normalized);
  return {
    id: createId("session", idFactory),
    userId: userId ?? null,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    difficulty: normalized,
    momentCount: moments.length,
    openingPrompt: openingPrompt ?? moments[0]?.prompt ?? null,
    unexpectedPrompt: unexpectedPrompt ?? scenario.unexpectedPrompt ?? null,
    status: SESSION_STATUS.NOT_STARTED,
    momentIndex: 0,
    messages: [],
    turns: [],
    pendingUnexpected: null,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    startedAt: null,
    completedAt: null,
  };
}

export function beginScenarioSession(session, { now = Date.now(), idFactory } = {}) {
  if (!session || session.status === SESSION_STATUS.ACTIVE || session.status === SESSION_STATUS.COMPLETED) {
    return session;
  }
  const messages = session.openingPrompt
    ? [{ id: createId("msg", idFactory), role: "npc", text: session.openingPrompt, kind: "chat", ts: new Date(now).toISOString() }]
    : [];
  return {
    ...session,
    status: SESSION_STATUS.ACTIVE,
    messages,
    startedAt: session.startedAt ?? new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}

export function getCurrentMoment(scenario, session) {
  const moments = getEffectiveMoments(scenario, session?.difficulty);
  return moments[session?.momentIndex ?? 0] ?? null;
}

export function getQuickReplies(scenario, session) {
  if (!session || session.status === SESSION_STATUS.COMPLETED) return [];
  const moment = getCurrentMoment(scenario, session);
  if (!moment) return [];
  return moment.options.map((option) => option.text);
}

function appendMessage(session, role, text, kind, now, idFactory) {
  return [
    ...session.messages,
    { id: createId("msg", idFactory), role, text, kind, ts: new Date(now).toISOString() },
  ];
}

function appendTurn(session, turn, now) {
  return [...session.turns, { ...turn, ts: new Date(now).toISOString() }];
}

/** Resolve an unexpected beat: grade the reply heuristically and acknowledge
 *  it warmly, without advancing the moment index. */
function consumeUnexpectedBeat(session, text, now, idFactory) {
  const playerMessageId = createId("msg", idFactory);
  const messages = [
    ...appendMessage(session, "player", text, "chat", now, idFactory),
    {
      id: createId("msg", idFactory),
      role: "npc",
      text: UNEXPECTED_ACKNOWLEDGEMENT,
      kind: "chat",
      ts: new Date(now).toISOString(),
    },
  ];
  const turn = {
    id: createId("turn", idFactory),
    playerMessageId,
    npcMessageId: messages[messages.length - 1].id,
    matched: true,
    unexpected: true,
    playerText: text,
    cue: "You stayed calm when the conversation took an unexpected turn.",
    suggestion: "Handling surprises with a short, clear reply keeps any conversation moving.",
    quality: QUALITY_PRESETS.good,
  };
  const finished = session.momentIndex >= session.momentCount;
  const next = {
    ...session,
    messages,
    turns: appendTurn(session, turn, now),
    pendingUnexpected: null,
    status: finished ? SESSION_STATUS.COMPLETED : SESSION_STATUS.ACTIVE,
    completedAt: finished ? new Date(now).toISOString() : null,
    updatedAt: new Date(now).toISOString(),
  };
  return { session: next, turn, completed: finished };
}

function shouldInsertUnexpectedBeat(session, difficulty) {
  const config = getDifficultyConfig(difficulty);
  if (!session.unexpectedPrompt || config.unexpectedEvery <= 0) return false;
  return session.momentIndex > 0 && session.momentIndex % config.unexpectedEvery === 0;
}

export function submitPlayerMessage(session, text, { scenario, now = Date.now(), idFactory } = {}) {
  if (!session || session.status !== SESSION_STATUS.ACTIVE) {
    return { session, error: "session_not_active" };
  }
  const cleanText = String(text ?? "").trim();
  if (!cleanText) {
    return { session, error: "empty_message" };
  }
  if (session.pendingUnexpected) {
    return consumeUnexpectedBeat(session, cleanText, now, idFactory);
  }

  const moment = getCurrentMoment(scenario, session);
  if (!moment) {
    return { session, error: "no_moment" };
  }

  const matched = pickOption(moment, cleanText, session.difficulty);
  const choice = matched ?? moment.fallback ?? null;

  const playerMessageId = createId("msg", idFactory);
  const messages = [
    ...appendMessage(session, "player", cleanText, "chat", now, idFactory),
    {
      id: createId("msg", idFactory),
      role: "npc",
      text: choice?.reply ?? "",
      kind: "chat",
      ts: new Date(now).toISOString(),
    },
  ];

  const turn = {
    id: createId("turn", idFactory),
    playerMessageId,
    npcMessageId: messages[messages.length - 1].id,
    matched: Boolean(matched),
    unexpected: false,
    playerText: cleanText,
    cue: choice?.cue ?? "",
    suggestion: choice?.suggestion ?? "",
    quality: choice?.quality ?? null,
  };

  let momentIndex = session.momentIndex;
  if (matched) {
    momentIndex += 1;
  }

  let next = {
    ...session,
    messages,
    turns: appendTurn(session, turn, now),
    momentIndex,
    updatedAt: new Date(now).toISOString(),
  };

  const beyondLast = momentIndex >= session.momentCount;
  const insertBeat = matched && shouldInsertUnexpectedBeat(next, session.difficulty);

  if (insertBeat) {
    next = { ...next, pendingUnexpected: session.unexpectedPrompt };
  } else if (beyondLast) {
    next = {
      ...next,
      status: SESSION_STATUS.COMPLETED,
      completedAt: new Date(now).toISOString(),
    };
  }

  return { session: next, turn, completed: next.status === SESSION_STATUS.COMPLETED };
}

export function pauseScenarioSession(session, { now = Date.now() } = {}) {
  if (!session || session.status !== SESSION_STATUS.ACTIVE) return session;
  return { ...session, status: SESSION_STATUS.PAUSED, updatedAt: new Date(now).toISOString() };
}

export function resumeScenarioSession(session, { now = Date.now() } = {}) {
  if (!session || session.status !== SESSION_STATUS.PAUSED) return session;
  return { ...session, status: SESSION_STATUS.ACTIVE, updatedAt: new Date(now).toISOString() };
}

export function completeScenarioSession(session, { now = Date.now() } = {}) {
  if (!session || session.status === SESSION_STATUS.COMPLETED) return session;
  return {
    ...session,
    status: SESSION_STATUS.COMPLETED,
    pendingUnexpected: null,
    completedAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}

export function abandonScenarioSession(session, { now = Date.now() } = {}) {
  if (!session || session.status === SESSION_STATUS.COMPLETED) return session;
  return {
    ...session,
    status: SESSION_STATUS.COMPLETED,
    abandoned: true,
    completedAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}

export function restartScenarioSession(session, { now = Date.now(), idFactory } = {}) {
  if (!session) return session;
  const fresh = createScenarioSession({
    scenario: { id: session.scenarioId, title: session.scenarioTitle, moments: [] },
    userId: session.userId,
    difficulty: session.difficulty,
    now,
    idFactory,
    openingPrompt: session.openingPrompt,
    unexpectedPrompt: session.unexpectedPrompt,
  });
  return { ...fresh, momentCount: session.momentCount };
}

export function getScenarioProgress(scenario, session) {
  if (!session) return { current: 0, total: 0, percent: 0 };
  const total = Math.max(1, getEffectiveMoments(scenario, session.difficulty).length);
  const current = Math.min(session.momentIndex + (session.status === SESSION_STATUS.COMPLETED ? 0 : 1), total);
  return {
    current,
    total,
    percent: Math.round((current / total) * 100),
  };
}

export function getScenarioDurationMs(session) {
  if (!session?.startedAt) return 0;
  const end = session.completedAt ?? Date.now();
  return Math.max(0, new Date(end).getTime() - new Date(session.startedAt).getTime());
}
