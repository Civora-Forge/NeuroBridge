/**
 * useScenarioPractice.js — React adapter that wires the scenario engine,
 * feedback service and scenario store into a practice session.
 *
 * Owns the active session lifecycle (start / send / pause / resume / restart /
 * finish / exit early), integrates the Role 4 intervention lifecycle for the
 * module, and persists progress so a refresh does not lose a conversation.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInterventionLifecycle } from "@/support/execution";
import { SESSION_STATUS, SOCIAL_SCENARIO_MODULE_ID } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";
import {
  abandonScenarioSession,
  beginScenarioSession,
  completeScenarioSession,
  createScenarioSession,
  getQuickReplies,
  getScenarioDurationMs,
  getScenarioProgress,
  pauseScenarioSession,
  restartScenarioSession,
  resumeScenarioSession,
  submitPlayerMessage,
} from "@/support/modules/socialScenarioSimulator/scenarioEngineService";
import { buildFeedbackReport } from "@/support/modules/socialScenarioSimulator/feedbackService";
import {
  clearActiveSession,
  loadActiveSession,
  recordCompletedSession,
  saveActiveSession,
} from "@/support/modules/socialScenarioSimulator/scenarioStore";

const TYPING_DELAY_MS = 550;

export function useScenarioPractice({
  userId,
  scenario,
  difficulty = "easy",
  signals = null,
}) {
  const [session, setSession] = useState(null);
  const [report, setReport] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const [savedSession, setSavedSession] = useState(null);

  const lifecycle = useInterventionLifecycle({
    userId: userId ?? null,
    moduleId: SOCIAL_SCENARIO_MODULE_ID,
    configuration: {
      scenarioId: scenario?.id ?? null,
      difficulty: signals?.simplifyScenario ? undefined : difficulty,
      adaptedByEngine: Boolean(signals?.active),
    },
  });

  const scenarioId = scenario?.id;

  useEffect(() => {
    if (!userId || !scenarioId) {
      setSavedSession(null);
      return undefined;
    }
    const existing = loadActiveSession(userId);
    const relevant = existing && existing.scenarioId === scenarioId ? existing : null;
    setSavedSession(relevant);
  }, [userId, scenarioId]);

  const effectiveDifficulty = useMemo(() => {
    if (signals?.simplifyScenario && signals?.active) {
      return difficulty === "hard" ? "medium" : "easy";
    }
    return difficulty;
  }, [signals, difficulty]);

  const start = useCallback(async () => {
    if (!scenario) return;
    setError(null);
    setReport(null);
    const created = createScenarioSession({
      scenario,
      userId,
      difficulty: effectiveDifficulty,
    });
    const begun = beginScenarioSession(created);
    setSession(begun);
    if (userId && !lifecycle.hasStarted) {
      try {
        await lifecycle.start({ scenarioId: scenario.id });
      } catch {
        // Lifecycle failures never block practice.
      }
    }
  }, [scenario, userId, effectiveDifficulty, lifecycle]);

  const finishSession = useCallback(
    async (completed) => {
      const finalReport = buildFeedbackReport({ scenario, session: completed });
      setReport(finalReport);
      setSession(completed);
      setIsTyping(false);
      if (userId) {
        recordCompletedSession(userId, {
          session: completed,
          report: finalReport,
          scenarioId: scenario?.id,
          difficulty: completed.difficulty,
          abandoned: Boolean(completed.abandoned),
        });
        clearActiveSession(userId);
        if (!completed.abandoned && lifecycle.hasStarted && !lifecycle.isTerminal) {
          try {
            await lifecycle.complete({
              communicationScore: finalReport.communicationScore,
              subscores: finalReport.subscores,
            });
          } catch {
            // ignore
          }
        }
      }
    },
    [userId, scenario, lifecycle],
  );

  const sendMessage = useCallback(
    async (text) => {
      if (!session || session.status !== SESSION_STATUS.ACTIVE) return;
      const { session: next, error: submitError } = submitPlayerMessage(session, text, {
        scenario,
      });
      if (submitError) {
        setError(submitError);
        return;
      }
      setIsTyping(true);
      setSession(next);
      if (userId) {
        saveActiveSession(userId, next);
      }
      if (next.status === SESSION_STATUS.COMPLETED) {
        window.setTimeout(() => {
          finishSession(next);
        }, TYPING_DELAY_MS);
      } else {
        window.setTimeout(() => setIsTyping(false), TYPING_DELAY_MS);
      }
    },
    [session, scenario, userId, finishSession],
  );

  const chooseOption = useCallback(
    (text) => sendMessage(text),
    [sendMessage],
  );

  const pause = useCallback(async () => {
    if (!session || session.status !== SESSION_STATUS.ACTIVE) return;
    const paused = pauseScenarioSession(session);
    setSession(paused);
    if (userId) {
      saveActiveSession(userId, paused);
      if (lifecycle.hasStarted && !lifecycle.isTerminal) {
        try {
          await lifecycle.pause({ reason: "user_paused" });
        } catch {
          // ignore
        }
      }
    }
  }, [session, userId, lifecycle]);

  const resume = useCallback(async () => {
    if (!session || session.status !== SESSION_STATUS.PAUSED) return;
    const resumed = resumeScenarioSession(session);
    setSession(resumed);
    if (userId) {
      saveActiveSession(userId, resumed);
      if (lifecycle.hasStarted && !lifecycle.isTerminal) {
        try {
          await lifecycle.resume();
        } catch {
          // ignore
        }
      }
    }
  }, [session, userId, lifecycle]);

  const restart = useCallback(async () => {
    if (userId) {
      clearActiveSession(userId);
    }
    setReport(null);
    setError(null);
    if (session && lifecycle.hasStarted && !lifecycle.isTerminal) {
      try {
        await lifecycle.abandon("user_restart");
      } catch {
        // ignore
      }
      lifecycle.reset();
    }
    const fresh = restartScenarioSession(session);
    setSession(beginScenarioSession(fresh));
    if (userId && !lifecycle.hasStarted) {
      try {
        await lifecycle.start({ scenarioId: scenario?.id });
      } catch {
        // ignore
      }
    }
  }, [session, userId, lifecycle, scenario?.id]);

  const finishEarly = useCallback(async () => {
    if (!session || session.status === SESSION_STATUS.COMPLETED) return;
    const completed = completeScenarioSession(session);
    await finishSession(completed);
  }, [session, finishSession]);

  const exitEarly = useCallback(async () => {
    if (!session || session.status === SESSION_STATUS.COMPLETED) return;
    const abandoned = abandonScenarioSession(session);
    await finishSession(abandoned);
  }, [session, finishSession]);

  const restoreSaved = useCallback(() => {
    if (!savedSession) return;
    const restored =
      savedSession.status === SESSION_STATUS.PAUSED
        ? resumeScenarioSession(savedSession)
        : savedSession;
    setSession(restored);
    setError(null);
    setReport(null);
  }, [savedSession]);

  const reset = useCallback(() => {
    setSession(null);
    setReport(null);
    setError(null);
    setSavedSession(null);
  }, []);

  const progress = getScenarioProgress(scenario, session);
  const quickReplies = session?.pendingUnexpected
    ? []
    : getQuickReplies(scenario, session);

  return {
    session,
    report,
    isTyping,
    error,
    savedSession,
    progress,
    quickReplies,
    durationMs: getScenarioDurationMs(session),
    hasStarted: Boolean(session?.startedAt),
    isActive: session?.status === SESSION_STATUS.ACTIVE,
    isPaused: session?.status === SESSION_STATUS.PAUSED,
    isCompleted: session?.status === SESSION_STATUS.COMPLETED,
    lifecycle,
    start,
    sendMessage,
    chooseOption,
    pause,
    resume,
    restart,
    finishEarly,
    exitEarly,
    restoreSaved,
    reset,
  };
}
