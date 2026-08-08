/**
 * sessionHistory.js — Persistence for the Social Communication Simulator.
 *
 * Completed sessions are persisted through the existing Role 4 OUTCOMES
 * contract (saveInterventionOutcome) so history is queryable and consistent
 * with every other module — no new database architecture. An in-progress
 * session is additionally mirrored to the user's own localStorage for resume
 * after a refresh, matching the scenarioStore convention.
 *
 * Privacy: transcripts are never written to Role 4. Metrics only.
 */

import {
  COMMUNICATION_MODULE_ID,
  COMMUNICATION_STORAGE_PREFIX,
  SESSION_STATUS,
} from "../types/communicationTypes";
import { computeStreak } from "@/support/modules/socialScenarioSimulator/scenarioStore";
import { listInterventionOutcomes, saveInterventionOutcome } from "@/support/persistence/role4Store";
import {
  InterventionStatus,
  ModuleCategory,
  OutcomeSource,
  PrivacyLevel,
} from "@/support/schemas/supportSchemas";

function normalizeUserId(userId) {
  return userId ? String(userId) : null;
}

function storageKey(userId) {
  return `${COMMUNICATION_STORAGE_PREFIX}_active_${userId}`;
}

function elapsedMs(session) {
  if (!session?.startedAt || !session?.completedAt) return 0;
  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return end - start;
}

function toOutcomeStatus(session) {
  return session?.status === SESSION_STATUS.ABANDONED
    ? InterventionStatus.ABANDONED
    : InterventionStatus.COMPLETED;
}

/**
 * Persist a finished session as a Role 4 intervention outcome.
 * @returns {Promise<object|null>} the saved record, or null when unavailable.
 */
export async function saveSessionOutcome({ userId, session }) {
  const id = normalizeUserId(userId);
  if (!id || !session?.id) return null;

  const evaluation = session.evaluation ?? null;
  const metrics = {
    communicationScore: evaluation?.overallScore ?? null,
    dimensions: evaluation?.dimensionScores ?? {},
    difficulty: session.effectiveDifficulty ?? session.difficulty,
    domain: session.scenario?.domain ?? "small_talk",
    turnCount: session.turnCount ?? 0,
    hintsUsed: session.hintsUsed ?? 0,
    voiceTurns: evaluation?.stats?.voiceTurns ?? 0,
    textTurns: evaluation?.stats?.textTurns ?? 0,
    scenarioId: session.scenario?.id ?? null,
    aiScenario: session.scenario?.source === "ai",
    usedFallback: evaluation?.stats?.usedFallback ?? false,
  };

  try {
    return await saveInterventionOutcome(id, {
      id: session.id,
      interventionId: session.id,
      moduleId: COMMUNICATION_MODULE_ID,
      interventionType: "communication_simulation",
      category: ModuleCategory.SPECIALIZED,
      status: toOutcomeStatus(session),
      source: OutcomeSource.MODULE_EVENT,
      privacy: PrivacyLevel.PRIVATE,
      completed: session.status === SESSION_STATUS.COMPLETED,
      durationMs: elapsedMs(session),
      metrics,
    });
  } catch {
    return null;
  }
}

export function listSessionOutcomes(userId) {
  const id = normalizeUserId(userId);
  if (!id) return [];
  try {
    return listInterventionOutcomes(id).filter(
      (outcome) => outcome?.moduleId === COMMUNICATION_MODULE_ID,
    );
  } catch {
    return [];
  }
}

export function getSessionHistoryStats(userId) {
  const outcomes = listSessionOutcomes(userId);
  const completed = outcomes.filter((outcome) => outcome?.status === InterventionStatus.COMPLETED);

  const scores = completed
    .map((outcome) => outcome?.metrics?.communicationScore)
    .filter((score) => Number.isFinite(score));

  const streak = computeStreak(
    completed.map((outcome) => ({ completedAt: outcome.createdAt })),
  );

  return {
    totalSessions: outcomes.length,
    completedSessions: completed.length,
    averageScore: scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    streak,
  };
}

// ─────────────────────────────────────────────
//  Active-session resume (local-only mirror)
// ─────────────────────────────────────────────
function compactSession(session) {
  if (!session) return null;
  const cap = 40;
  return {
    ...session,
    turns: Array.isArray(session.turns) ? session.turns.slice(-cap) : [],
  };
}

export function saveActiveSession(userId, session) {
  const id = normalizeUserId(userId);
  if (!id || !session) return session;
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(compactSession(session)));
  } catch {
    // private mode / quota — resume simply won't persist.
  }
  return session;
}

export function loadActiveSession(userId) {
  const id = normalizeUserId(userId);
  if (!id) return null;
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearActiveSession(userId) {
  const id = normalizeUserId(userId);
  if (!id) return;
  try {
    localStorage.removeItem(storageKey(id));
  } catch {
    // ignore
  }
}
