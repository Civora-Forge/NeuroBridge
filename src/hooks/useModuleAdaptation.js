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

import { useMemo, useSyncExternalStore } from "react";
import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";
import { deriveModuleAdjustments } from "@/components/adaptive/AdaptiveUIRuntime.jsx";
import {
  getExecutionStoreVersion,
  resolvePlanExecution,
  subscribeExecutionStore,
} from "@/adaptive/execution/uiExecution";
import { usePersonalizationProfile } from "@/adaptive/personalization/usePersonalizationProfile";
import { getInteractionEvidenceSnapshot } from "@/adaptive/context/interactionEvidence.js";
import { useContextStateOptional } from "@/context/ContextProvider";

/**
 * Hysteresis namespace for module-level decisions. The app-level runtime
 * (AdaptiveRuntimeProvider) runs its own decide() path for the same user,
 * often on a different (app-level vs module-local) snapshot; a separate
 * scope keeps the two paths from advancing or resetting each other's
 * temporal state.
 */
export function moduleStateScope(moduleId) {
  return `module:${typeof moduleId === "string" && moduleId ? moduleId : "generic"}`;
}

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
  const baseProducer =
    typeof getSnapshot === "function" ? getSnapshot : getAppSnapshot;

  // Module-scoped interaction evidence. Both module-local snapshots (which
  // carry none) and the app-level snapshot (which carries the all-module
  // view) get THIS module's view of the single evidence log — never a copy,
  // never re-ingested — so another activity's evidence cannot shape this
  // module's inference. The app-level context value changes on every
  // recorded interaction; depending on it keeps the page-level decision
  // fresh even when the module-local producer is stable.
  const appContext = useContextStateOptional()?.context ?? null;
  // One evidence view per app-context change (not per render), so unrelated
  // re-renders produce identical snapshot content and are de-duplicated.
  const moduleEvidence = useMemo(
    () => getInteractionEvidenceSnapshot({ moduleId }),
    // appContext: refresh on new app-level evidence (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moduleId, appContext],
  );
  const snapshotProducer = useMemo(() => {
    if (typeof baseProducer !== "function") return undefined;
    return async () => {
      const snapshot = await baseProducer();
      if (!snapshot || typeof snapshot !== "object") return snapshot;
      return { ...snapshot, interactionEvidence: moduleEvidence };
    };
  }, [baseProducer, moduleEvidence]);

  // The user's persistent personalization profile applies to module-level
  // decisions exactly as it does at the app level (explicit avoided modes are
  // constraints, presentation is calmer-only). The store is shared, so this
  // reuses the provider's loaded copy rather than fetching again.
  const personalizationStore = usePersonalizationProfile(userId ?? null);

  const engine = useAdaptiveBehavioralEngine({
    moduleId,
    getSnapshot: snapshotProducer,
    userId,
    enabled: enabledOverride,
    userPreferences,
    role4Signals,
    personalizationProfile: personalizationStore.profile ?? null,
    temporaryPreferences: personalizationStore.temporary ?? null,
    stateScope: moduleStateScope(moduleId),
  });

  // Consent decisions are made in the app-level prompt; re-resolve when the
  // shared execution store changes so a grant / decline applies immediately
  // rather than on this path's next plan change.
  const storeVersion = useSyncExternalStore(
    subscribeExecutionStore,
    getExecutionStoreVersion,
    getExecutionStoreVersion,
  );

  // Same execution guardrails as the app shell (Task 3): safety outcomes and
  // requireConfirmation consent apply to module-owned (non-UI) actions too.
  const execution = useMemo(() => {
    if (!engine.plan || !Array.isArray(engine.plan.actions)) return null;
    const targets = [...new Set(engine.plan.actions.map((a) => a?.target).filter((t) => t && t !== "UI"))];
    return resolvePlanExecution(engine.plan, { trace: engine.trace, targets });
    // storeVersion: consent decisions change the resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.plan, engine.trace, storeVersion]);
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
