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
 * The hook never executes actions automatically — it is decision-only. When
 * the engine is disabled or the module has no registered policies, it degrades
 * gracefully to an empty decision.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useCallback, useMemo } from "react";
import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";
import { deriveModuleAdjustments } from "@/components/adaptive/AdaptiveUIRuntime.jsx";
import { resolvePlanExecution } from "@/adaptive/execution/uiExecution";

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
 * @param {object} [options.role4Signals] - Explicit `role4Signals` override
 *   (e.g. the `{ strategyEffectiveness, supportEvidence }` fragment produced by
 *   `useReflectionSignals`). Takes precedence over the userId-driven read path;
 *   pass a stable reference (memoized value) to avoid identity churn.
 */
export function useModuleAdaptation({
  moduleId,
  getSnapshot,
  getAppSnapshot,
  userId,
  enabled: enabledOverride,
  userPreferences,
  role4Signals,
}) {
  const snapshotProducer =
    typeof getSnapshot === "function" ? getSnapshot : getAppSnapshot;

  const engine = useAdaptiveBehavioralEngine({
    moduleId,
    getSnapshot: snapshotProducer,
    userId,
    enabled: enabledOverride,
    userPreferences,
    role4Signals,
  });

  // Same execution guardrails as the app shell (Task 3): safety outcomes and
  // requireConfirmation consent apply to module-owned (non-UI) actions too.
  const execution = useMemo(() => {
    if (!engine.plan || !Array.isArray(engine.plan.actions)) return null;
    const targets = [...new Set(engine.plan.actions.map((a) => a?.target).filter((t) => t && t !== "UI"))];
    return resolvePlanExecution(engine.plan, { trace: engine.trace, targets });
  }, [engine.plan, engine.trace]);
  const effectivePlan = execution?.effectivePlan ?? null;

  const moduleActions = useMemo(() => {
    if (!effectivePlan || !Array.isArray(effectivePlan.actions)) {
      return [];
    }
    return effectivePlan.actions.filter(
      (action) => action && action.target !== "UI",
    );
  }, [effectivePlan]);

  const adjustments = useMemo(
    () => deriveModuleAdjustments(effectivePlan),
    [effectivePlan],
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
      execution,
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
      execution,
    ],
  );
}
