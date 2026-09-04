/**
 * useFeatureAdaptation.js — Role 2 common adaptive consumer for feature pages.
 *
 * Thin wrapper over `useModuleAdaptation` that adds the typed, module-specific
 * `configuration` object produced by `buildFeatureConfiguration`. Any feature
 * page whose module is registered in `moduleAdaptationSets` (with
 * `modulePolicies`) gains a stable adaptive surface:
 *
 *   const { enabled, active, mode, configuration, adjustments, reason } =
 *     useFeatureAdaptation(moduleId, { getSnapshot, userId, builder });
 *
 * The mapped `configuration` is frozen per-decision so consumer effects depend
 * only on the decision — never on identity churn.
 *
 * This hook NEVER executes actions; it is decision-only and degrades gracefully
 * when the engine is disabled or the module is not registered.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useMemo } from "react";
import { useModuleAdaptation } from "@/hooks/useModuleAdaptation";
import {
  deriveFeatureSignals,
  getFeatureConfigBuilder,
} from "@/adaptive/featureConfiguration";

/**
 * @param {string} moduleId - Canonical registered support module id.
 * @param {object} [options]
 * @param {() => object|null} [options.getSnapshot] - Module-local
 *   ContextSnapshot producer.
 * @param {() => object|null} [options.getAppSnapshot] - App-level
 *   ContextSnapshot producer used when `getSnapshot` is omitted.
 * @param {string} [options.userId]
 * @param {boolean} [options.enabled] - Override for the runtime flag.
 * @param {object} [options.userPreferences]
 * @param {(signals, moduleAdapterState) => object} [options.builder] - Optional
 *   config builder override. Defaults to the registered builder for `moduleId`.
 * @param {object} [options.moduleAdapterState] - Static values the builder
 *   needs from the consuming feature (e.g. current focusMinutes).
 */
export function useFeatureAdaptation(
  moduleId,
  {
    getSnapshot,
    getAppSnapshot,
    userId,
    enabled,
    userPreferences,
    builder,
    moduleAdapterState,
  } = {},
) {
  const adaptation = useModuleAdaptation({
    moduleId,
    getSnapshot,
    getAppSnapshot,
    userId,
    enabled,
    userPreferences,
  });

  const effectiveBuilder =
    builder ?? getFeatureConfigBuilder(moduleId) ?? null;

  const resolved = useMemo(() => {
    if (!effectiveBuilder) {
      return {
        active: false,
        mode: "normal",
        configuration: null,
        signals: { active: false },
      };
    }
    const signals = deriveFeatureSignals(adaptation.adjustments);
    const configuration = effectiveBuilder({
      signals,
      ...(moduleAdapterState ?? {}),
    });
    return { signals, configuration };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBuilder, adaptation.adjustments, JSON.stringify(moduleAdapterState ?? null)]);

  return useMemo(
    () => ({
      enabled: adaptation.enabled,
      available: adaptation.available,
      active: resolved.configuration?.active ?? false,
      mode: resolved.configuration?.mode ?? "normal",
      plan: adaptation.plan,
      trace: adaptation.trace,
      error: adaptation.error,
      moduleActions: adaptation.moduleActions,
      adjustments: adaptation.adjustments,
      signals: resolved.signals,
      configuration: resolved.configuration,
      reason: adaptation.adjustments?.[0]?.reason ?? null,
      decisionTraceId: adaptation.decisionTraceId,
      lastDecisionAt: adaptation.lastDecisionAt,
      refresh: adaptation.refresh,
    }),
    [
      adaptation.enabled,
      adaptation.available,
      adaptation.plan,
      adaptation.trace,
      adaptation.error,
      adaptation.moduleActions,
      adaptation.adjustments,
      adaptation.decisionTraceId,
      adaptation.lastDecisionAt,
      adaptation.refresh,
      resolved,
    ],
  );
}