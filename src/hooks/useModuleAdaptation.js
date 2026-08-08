/**
 * useModuleAdaptation.js — Generic Adaptive Engine consumer for support
 * modules.
 *
 * Mounts the documented `useAdaptiveBehavioralEngine` hook with a canonical
 * support module id and a module-supplied ContextSnapshot fragment, then
 * exposes the engine's module-scoped decisions (non-UI actions) in a stable,
 * labelled shape. Any feature page whose module is registered in
 * `supportModuleRegistry` (with `modulePolicies`) can adopt this to genuinely
 * adapt its content/pacing/task flow to the current user state.
 *
 * The hook never executes actions automatically — it is decision-only, mirror
 * of `useScenarioAdaptation` for the general case. When the engine is
 * disabled or the module has no registered policies, it degrades gracefully
 * to an empty decision.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useCallback, useMemo } from "react";
import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";
import { deriveModuleAdjustments } from "@/components/adaptive/AdaptiveUIRuntime.jsx";

/**
 * @param {object} options
 * @param {string} options.moduleId - Canonical registered support module id
 *   (e.g. "support.focus_session"). `buildModuleContext` throws for unknown
 *   ids; pass only registered ids.
 * @param {() => object|null} [options.getSnapshot] - Module-local
 *   ContextSnapshot producer. Defaults to the app-level context snapshot when
 *   omitted.
 * @param {() => object|null} [options.getAppSnapshot] - App-level
 *   ContextSnapshot producer used when `getSnapshot` is omitted.
 * @param {string} [options.userId]
 * @param {boolean} [options.enabled] - Override for the runtime flag.
 * @param {object} [options.userPreferences]
 */
export function useModuleAdaptation({
  moduleId,
  getSnapshot,
  getAppSnapshot,
  userId,
  enabled: enabledOverride,
  userPreferences,
}) {
  const snapshotProducer =
    typeof getSnapshot === "function" ? getSnapshot : getAppSnapshot;

  const engine = useAdaptiveBehavioralEngine({
    moduleId,
    getSnapshot: snapshotProducer,
    userId,
    enabled: enabledOverride,
    userPreferences,
  });

  const moduleActions = useMemo(() => {
    if (!engine.plan || !Array.isArray(engine.plan.actions)) {
      return [];
    }
    return engine.plan.actions.filter(
      (action) => action && action.target !== "UI",
    );
  }, [engine.plan]);

  const adjustments = useMemo(
    () => deriveModuleAdjustments(engine.plan),
    [engine.plan],
  );

  return useMemo(
    () => ({
      enabled: engine.enabled,
      available: engine.enabled && adjustments.length > 0,
      active: adjustments.length > 0,
      plan: engine.plan,
      trace: engine.trace,
      error: engine.error,
      moduleActions,
      adjustments,
      decisionTraceId: engine.decisionId,
      lastDecisionAt: engine.lastDecisionAt,
      refresh: engine.refresh,
    }),
    [
      engine.enabled,
      engine.plan,
      engine.trace,
      engine.error,
      engine.decisionId,
      engine.lastDecisionAt,
      engine.refresh,
      moduleActions,
      adjustments,
    ],
  );
}
