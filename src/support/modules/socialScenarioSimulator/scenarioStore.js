/**
 * scenarioStore.js — Local persistence for the Social Scenario Simulator.
 *
 * Stores per-user completed sessions (with scores + feedback), favorites,
 * recent sessions and the practice streak in localStorage, mirroring the
 * role4Store / wardTaskStore conventions. All functions are safe to call with
 * a missing user id (guests get empty state and no writes).
 */

import { SCENARIO_STATE_STORAGE_KEY } from "./socialScenarioTypes";

function normalizeUserId(userId) {
  return userId ? String(userId) : null;
}

function storageKey(userId) {
  return `${SCENARIO_STATE_STORAGE_KEY}_${userId}`;
}

function defaultState() {
  return {
    sessions: [],
    favorites: [],
    streak: { current: 0, best: 0, lastPracticedOn: null },
  };
}

function read(userId) {
  const id = normalizeUserId(userId);
  if (!id) return defaultState();
  try {
    const raw = localStorage.getItem(storageKey(id));
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...defaultState(),
      ...parsed,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    };
  } catch {
    return defaultState();
  }
}

function write(userId, state) {
  const id = normalizeUserId(userId);
  if (!id) return state;
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, quota) — state stays in memory.
  }
  return state;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function computeStreak(sessions) {
  const dates = [
    ...new Set(
      (Array.isArray(sessions) ? sessions : [])
        .filter((session) => session?.completedAt)
        .map((session) => toDateKey(session.completedAt))
        .filter(Boolean),
    ),
  ].sort();

  if (dates.length === 0) {
    return { current: 0, best: 0, lastPracticedOn: null };
  }

  const dayMs = 86400000;
  const timeOf = (key) => new Date(`${key}T00:00:00`).getTime();

  let best = 1;
  let run = 1;
  for (let index = 1; index < dates.length; index += 1) {
    const gap = (timeOf(dates[index]) - timeOf(dates[index - 1])) / dayMs;
    run = gap === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const today = toDateKey(new Date());
  const yesterday = toDateKey(new Date(Date.now() - dayMs));
  let lastPracticedOn = dates.includes(today) ? today : dates.includes(yesterday) ? yesterday : null;

  let current = 0;
  if (lastPracticedOn) {
    let index = dates.indexOf(lastPracticedOn);
    let streak = 1;
    while (index > 0) {
      const gap = (timeOf(dates[index]) - timeOf(dates[index - 1])) / dayMs;
      if (gap !== 1) break;
      streak += 1;
      index -= 1;
    }
    current = streak;
  }

  return { current, best, lastPracticedOn };
}

export function getScenarioState(userId) {
  return read(userId);
}

export function listCompletedSessions(userId, { limit } = {}) {
  const { sessions } = read(userId);
  const sorted = [...sessions].sort((a, b) =>
    String(b.completedAt ?? "").localeCompare(String(a.completedAt ?? "")),
  );
  return Number.isInteger(limit) && limit > 0 ? sorted.slice(0, limit) : sorted;
}

export const getRecentSessions = listCompletedSessions;

export function recordCompletedSession(
  userId,
  { session, report, scenarioId, difficulty, abandoned = false } = {},
) {
  if (!session) return getScenarioState(userId);
  const state = read(userId);
  const record = {
    id: session.id,
    scenarioId: scenarioId ?? session.scenarioId,
    title: session.scenarioTitle ?? "",
    difficulty: difficulty ?? session.difficulty,
    score: report?.communicationScore ?? null,
    subscores: report?.subscores ?? null,
    encouragement: report?.encouragement ?? "",
    strengths: report?.strengths ?? [],
    misunderstandings: report?.misunderstandings ?? [],
    alternatives: report?.alternatives ?? [],
    abandoned: Boolean(abandoned),
    durationMs: report?.durationMs ?? session.durationMs ?? 0,
    turnCount: Array.isArray(session.turns) ? session.turns.length : 0,
    completedAt: session.completedAt ?? new Date().toISOString(),
  };

  const sessions = [record, ...state.sessions].slice(0, 60);
  const next = { ...state, sessions, streak: computeStreak(sessions), activeSession: null };
  return write(userId, next);
}

export function getPracticeStreak(userId) {
  const { sessions, streak } = read(userId);
  return computeStreak(sessions) ?? streak;
}

export function getCompletedScenarioCount(userId) {
  return read(userId).sessions.filter((session) => !session.abandoned).length;
}

export function getAverageScore(userId) {
  const scores = read(userId)
    .sessions.filter((session) => !session.abandoned && Number.isFinite(session.score))
    .map((session) => session.score);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export function getFavoriteScenarioIds(userId) {
  return read(userId).favorites;
}

export function isFavoriteScenario(userId, scenarioId) {
  return read(userId).favorites.includes(scenarioId);
}

export function toggleFavoriteScenario(userId, scenarioId) {
  const state = read(userId);
  const alreadyFavorite = state.favorites.includes(scenarioId);
  const favorites = alreadyFavorite
    ? state.favorites.filter((id) => id !== scenarioId)
    : [...state.favorites, scenarioId];
  write(userId, { ...state, favorites });
  return { favorites, added: !alreadyFavorite };
}

export function clearScenarioState(userId) {
  const id = normalizeUserId(userId);
  if (!id) return defaultState();
  try {
    localStorage.removeItem(storageKey(id));
  } catch {
    // ignore
  }
  return defaultState();
}

/** Persist the in-progress session so the user can resume after a refresh. */
export function saveActiveSession(userId, session) {
  if (!session) return session;
  const state = read(userId);
  return write(userId, { ...state, activeSession: session });
}

export function loadActiveSession(userId) {
  return read(userId).activeSession ?? null;
}

export function clearActiveSession(userId) {
  const state = read(userId);
  return write(userId, { ...state, activeSession: null });
}
