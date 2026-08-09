/**
 * useSocialCommunication.js — Orchestrates the Social Communication Simulator.
 *
 * Owns the flow state machine (launch → brief → conversation → feedback →
 * summary, plus history), the active session, scenario generation, evaluation,
 * persistence and difficulty progression. It delegates to the pure services
 * and the Adaptive Engine's public hook. AI is optional everywhere: any failure
 * degrades to deterministic behaviour.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { SESSION_STATUS, COMMUNICATION_STORAGE_PREFIX } from "../types/communicationTypes";
import { getGeminiApiKey } from "../services/aiService";
import { buildScenarioConfig, generateScenario } from "../services/scenarioGenerator";
import {
  beginSession,
  completeSession,
  createSession,
  getDefaultNpcProvider,
  retryLastUserTurn,
  submitUserTurn,
} from "../services/conversationService";
import { evaluateSession, refineEvaluationWithAI } from "../services/evaluationService";
import { computeNextDifficulty } from "../services/difficultyController";
import {
  clearActiveSession,
  getSessionHistoryStats,
  listSessionOutcomes,
  loadActiveSession,
  saveActiveSession,
  saveSessionOutcome,
} from "../services/sessionHistory";
import { useCommunicationAdaptation } from "./useCommunicationAdaptation";

export const COMMUNICATION_VIEWS = Object.freeze({
  LAUNCH: "launch",
  BRIEF: "brief",
  CONVERSATION: "conversation",
  FEEDBACK: "feedback",
  SUMMARY: "summary",
  HISTORY: "history",
});

const A11Y_STORAGE_KEY = `${COMMUNICATION_STORAGE_PREFIX}_a11y`;

function loadA11y() {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { largeText: false, reduceMotion: false };
  } catch {
    return { largeText: false, reduceMotion: false };
  }
}

export function useSocialCommunication() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [view, setView] = useState(COMMUNICATION_VIEWS.LAUNCH);
  const [session, setSession] = useState(null);
  const [difficulty, setDifficulty] = useState(3);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyStats, setHistoryStats] = useState(null);
  const [a11y, setA11y] = useState(loadA11y);

  const adaptation = useCommunicationAdaptation({
    userId,
    user,
    session,
    userPreferences: user?.accessibility ? { accessibility: user.accessibility } : undefined,
  });

  const apiKey = getGeminiApiKey();

  const displaySession = adaptation.active && adaptation.adaptedSession
    ? adaptation.adaptedSession
    : session;

  const refreshHistory = useCallback(() => {
    if (!userId) {
      setHistory([]);
      setHistoryStats(null);
      return;
    }
    setHistory(listSessionOutcomes(userId));
    setHistoryStats(getSessionHistoryStats(userId));
  }, [userId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Restore an in-progress session on mount so a refresh can resume.
  useEffect(() => {
    if (userId && !session) {
      const active = loadActiveSession(userId);
      if (active) {
        setSession(active);
        setView(
          active.status === SESSION_STATUS.NOT_STARTED
            ? COMMUNICATION_VIEWS.BRIEF
            : COMMUNICATION_VIEWS.CONVERSATION,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const startActivity = useCallback(
    async ({ domain = "small_talk", difficultyOverride } = {}) => {
      setBusy(true);
      try {
        const config = buildScenarioConfig({
          difficulty: difficultyOverride ?? difficulty,
          domain,
          signals: adaptation.signals,
          variantSeed: Math.floor(Math.random() * 1000000),
        });
        const { scenario, aiAvailable } = await generateScenario(config, { apiKey });
        const next = createSession({
          userId,
          scenario,
          difficulty: scenario.difficulty,
          signals: { ...adaptation.signals, simplify: false },
        });
        setSession(next);
        setAiUnavailable(!aiAvailable);
        setView(COMMUNICATION_VIEWS.BRIEF);
      } finally {
        setBusy(false);
      }
    },
    [userId, apiKey, difficulty, adaptation.signals],
  );

  const reshuffle = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      const config = buildScenarioConfig({
        difficulty: session.difficulty,
        domain: session.scenario?.domain,
        signals: adaptation.signals,
        variantSeed: Math.floor(Math.random() * 1000000),
      });
      const { scenario, aiAvailable } = await generateScenario(config, { apiKey });
      const next = { ...session, scenario };
      setSession(next);
      setAiUnavailable(!aiAvailable);
    } finally {
      setBusy(false);
    }
  }, [session, apiKey, adaptation.signals]);

  const begin = useCallback(() => {
    setSession((current) => {
      const next = beginSession(current ?? displaySession);
      if (next && userId) saveActiveSession(userId, next);
      return next;
    });
    setView(COMMUNICATION_VIEWS.CONVERSATION);
  }, [displaySession, userId]);

  const showFeedback = useCallback(
    async (finished) => {
      let evaluation = evaluateSession(finished);
      if (apiKey) {
        const refined = await refineEvaluationWithAI(evaluation, {
          session: finished,
          apiKey,
        });
        if (refined) evaluation = refined;
      }
      const completed = completeSession(finished, evaluation);
      setSession(completed);
      if (userId) {
        await saveSessionOutcome({ userId, session: completed });
        clearActiveSession(userId);
        refreshHistory();
      }
      setView(COMMUNICATION_VIEWS.FEEDBACK);
    },
    [apiKey, userId, refreshHistory],
  );

  const submitReply = useCallback(
    async (text, { source = "text", speech = null } = {}) => {
      if (!displaySession || displaySession.status !== SESSION_STATUS.ACTIVE) {
        return { error: "session_not_active" };
      }
      setBusy(true);
      try {
        const { session: next, error } = await submitUserTurn(
          displaySession,
          { text, source, speech },
          { npcProvider: getDefaultNpcProvider({ apiKey }) },
        );
        if (error) return { error };
        setSession(next);
        if (userId) saveActiveSession(userId, next);
        if (next.status === SESSION_STATUS.COMPLETED) {
          await showFeedback(next);
        }
        return { session: next };
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displaySession, apiKey, userId],
  );

  const retry = useCallback(() => {
    setSession((current) => {
      const next = retryLastUserTurn(current ?? displaySession);
      if (next && userId) saveActiveSession(userId, next);
      return next;
    });
  }, [displaySession, userId]);

  const pause = useCallback(() => {
    setSession((current) => {
      const next = { ...(current ?? displaySession), status: SESSION_STATUS.PAUSED };
      if (userId) saveActiveSession(userId, next);
      return next;
    });
  }, [displaySession, userId]);

  const resume = useCallback(() => {
    setSession((current) => {
      const next = { ...(current ?? displaySession), status: SESSION_STATUS.ACTIVE };
      if (userId) saveActiveSession(userId, next);
      return next;
    });
  }, [displaySession, userId]);

  const endEarly = useCallback(async () => {
    if (!displaySession) return;
    const finished = completeSession(displaySession, null);
    await showFeedback(finished);
  }, [displaySession, showFeedback]);

  const finishActivity = useCallback(async () => {
    const scores = (history ?? [])
      .map((outcome) => outcome?.metrics?.communicationScore)
      .filter((score) => Number.isFinite(score));
    const next = computeNextDifficulty({
      current: session?.difficulty ?? difficulty,
      scores,
      recommendEasier: adaptation.signals.recommendEasier,
    });
    setDifficulty(next.difficulty);
    setView(COMMUNICATION_VIEWS.SUMMARY);
  }, [history, session, difficulty, adaptation.signals]);

  const startNew = useCallback(() => {
    setSession(null);
    setView(COMMUNICATION_VIEWS.LAUNCH);
  }, []);

  const openHistory = useCallback(() => {
    refreshHistory();
    setView(COMMUNICATION_VIEWS.HISTORY);
  }, [refreshHistory]);

  const updateA11y = useCallback((next) => {
    setA11y((current) => {
      const merged = { ...current, ...next };
      try {
        localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
      return merged;
    });
  }, []);

  return useMemo(
    () => ({
      view,
      session: displaySession,
      baseSession: session,
      difficulty,
      aiUnavailable,
      busy,
      history,
      historyStats,
      a11y,
      adaptation,
      isConversationComplete: displaySession?.status === SESSION_STATUS.COMPLETED,
      startActivity,
      reshuffle,
      begin,
      submitReply,
      retry,
      pause,
      resume,
      endEarly,
      finishActivity,
      startNew,
      openHistory,
      updateA11y,
    }),
    [
      view,
      displaySession,
      session,
      difficulty,
      aiUnavailable,
      busy,
      history,
      historyStats,
      a11y,
      adaptation,
      startActivity,
      reshuffle,
      begin,
      submitReply,
      retry,
      pause,
      resume,
      endEarly,
      finishActivity,
      startNew,
      openHistory,
      updateA11y,
    ],
  );
}
