/**
 * useReflectionSignals.js — Reflection → Role 4 Signal Bridge (Tier 9 input)
 *
 * React integration boundary for the Reflection Engine. Wraps the explicit,
 * flag-aware `reflectUserHistory(userId)` call and converts its effectiveness
 * signals into the `role4Signals.strategyEffectiveness` fragment consumed by
 * future decision cycles.
 *
 * The hook is decision-input only: it produces learned personalization
 * signals, never actions. When reflection is disabled (flag OFF) or the user
 * has no evaluable history, the hook returns an empty signal set so no
 * unearned learned value reaches the engine.
 *
 * Consumers pass the returned (stable) object as the `role4Signals` override
 * to `useModuleAdaptation` / `useFeatureAdaptation` /
 * `useCommunicationAdaptation`. `refresh()` forces a re-run so that new
 * persisted outcomes in future session history change the NEXT decision.
 *
 * Ownership: Support & Learning Engineer
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  reflectUserHistory,
  toStrategyEffectiveness,
} from "@/adaptive/reflection/reflectionEngine";

export const EMPTY_REFLECTION_SIGNALS = Object.freeze({
  strategyEffectiveness: Object.freeze({}),
  supportEvidence: Object.freeze([]),
  reflectedAt: null,
});

/**
 * @param {string} [userId] - Normalized Role 4 userId. When absent, no
 *   reflection runs and the returned signals are empty.
 * @returns {{
 *   enabled: boolean,
 *   signals: { strategyEffectiveness: Record<string, number>, supportEvidence: array, reflectedAt: number|null },
 *   summary: object|null,
 *   refresh: () => void,
 * }}
 */
export function useReflectionSignals(userId) {
  const [version, setVersion] = useState(0);
  const [reflection, setReflection] = useState(null);

  const normalizedUserId =
    typeof userId === "string" && userId.trim().length > 0 ? userId.trim() : null;

  const refresh = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!normalizedUserId) {
      setReflection(null);
      return undefined;
    }
    let cancelled = false;
    const outcome = reflectUserHistory(normalizedUserId);
    if (!cancelled) {
      setReflection(outcome);
    }
    return () => {
      cancelled = true;
    };
    // `refresh()` bumps version to re-run reflection without identity churn;
    // the dependency list is intentionally scoped to id + version.
  }, [normalizedUserId, version]);

  return useMemo(() => {
    const disabled = Boolean(reflection?.summary?.disabled);
    if (!normalizedUserId || !reflection || disabled) {
      return {
        enabled: normalizedUserId ? !disabled : false,
        signals: EMPTY_REFLECTION_SIGNALS,
        summary: reflection?.summary ?? null,
        refresh,
      };
    }
    return {
      enabled: true,
      signals: {
        strategyEffectiveness: toStrategyEffectiveness(reflection.signals),
        supportEvidence: EMPTY_REFLECTION_SIGNALS.supportEvidence,
        reflectedAt: reflection.summary?.generatedAt ?? null,
      },
      summary: reflection.summary,
      refresh,
    };
  }, [normalizedUserId, reflection, refresh]);
}