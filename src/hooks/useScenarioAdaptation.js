/**
 * useScenarioAdaptation.js — Consumes the Adaptive Engine's public outputs for
 * the Social Scenario Simulator.
 *
 * Mounts the documented `useAdaptiveBehavioralEngine` hook (never touching the
 * engine itself), feeds it a simulator-specific snapshot, and translates the
 * resulting plan into the module's four safe adaptation signals. When the
 * engine is disabled or produces nothing, the module degrades gracefully.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";
import {
  applyAdaptationSignals,
  consumeEngineOutput,
} from "@/support/modules/socialScenarioSimulator/adaptationService";
import { DEFAULT_ADAPTATION_SIGNALS, SOCIAL_SCENARIO_MODULE_ID } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";

/** Build the ContextSnapshot fragment the simulator exposes to the engine. */
export function buildSimulatorSnapshot({ session, user }) {
  return {
    screen: "asd.social-scenarios",
    session: session
      ? {
          scenarioId: session.scenarioId,
          difficulty: session.difficulty,
          status: session.status,
          turnCount: Array.isArray(session.turns) ? session.turns.length : 0,
          unexpectedPending: Boolean(session.pendingUnexpected),
        }
      : null,
    userProfile: {
      accessibility: user?.accessibility ?? null,
      disorders: Array.isArray(user?.disorders) ? user.disorders : [],
    },
  };
}

export function useScenarioAdaptation({
  userId,
  user,
  session,
  enabled: enabledOverride,
  userPreferences,
}) {
  const getSnapshot = useCallback(
    () => buildSimulatorSnapshot({ session, user }),
    [session, user],
  );

  const engine = useAdaptiveBehavioralEngine({
    moduleId: SOCIAL_SCENARIO_MODULE_ID,
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
