/**
 * useCommunicationAdaptation.js — Consumes the Adaptive Engine's PUBLIC outputs
 * for the Social Communication Simulator.
 *
 * Mounts the documented `useAdaptiveBehavioralEngine` hook (never touching the
 * engine), feeds it a feature-specific snapshot, and translates the plan into
 * the simulator's safe signals. When the engine is disabled or yields nothing,
 * the feature degrades gracefully to its default experience.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";
import {
  applyAdaptationSignals,
  consumeEngineOutput,
} from "../services/adaptationService";
import { COMMUNICATION_MODULE_ID, DEFAULT_ADAPTATION_SIGNALS } from "../types/communicationTypes";

export function buildCommunicationSnapshot({ session, user }) {
  return {
    screen: "communication.simulator",
    session: session
      ? {
          domain: session.scenario?.domain ?? null,
          difficulty: session.effectiveDifficulty ?? session.difficulty,
          status: session.status,
          turnCount: session.turnCount ?? 0,
          hintsUsed: session.hintsUsed ?? 0,
        }
      : null,
    userProfile: {
      accessibility: user?.accessibility ?? null,
      disorders: Array.isArray(user?.disorders) ? user.disorders : [],
    },
  };
}

export function useCommunicationAdaptation({
  userId,
  user,
  session,
  enabled: enabledOverride,
  userPreferences,
}) {
  const getSnapshot = useCallback(
    () => buildCommunicationSnapshot({ session, user }),
    [session, user],
  );

  const engine = useAdaptiveBehavioralEngine({
    moduleId: COMMUNICATION_MODULE_ID,
    getSnapshot,
    userId,
    enabled: enabledOverride,
    userPreferences,
  });

  const [adaptations, setAdaptations] = useState(null);

  useEffect(() => {
    setAdaptations(
      consumeEngineOutput({
        plan: engine.plan,
        trace: engine.trace,
        enabled: engine.enabled,
        error: engine.error,
      }),
    );
  }, [engine.plan, engine.trace, engine.enabled, engine.error]);

  const signals = adaptations?.signals ?? DEFAULT_ADAPTATION_SIGNALS;
  const adaptedSession = useMemo(
    () => applyAdaptationSignals(session, signals),
    [session, signals],
  );

  return {
    available: adaptations?.available ?? false,
    active: signals.active,
    signals,
    degraded: adaptations?.degraded ?? null,
    decisionTraceId: adaptations?.decisionTraceId ?? null,
    sources: adaptations?.sources ?? [],
    adaptedSession,
    refresh: engine.refresh,
  };
}
