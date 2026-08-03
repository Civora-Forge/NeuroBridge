/**
 * useAdaptiveBehavioralEngine.js — Adaptive Engine React integration boundary
 * (Phase 3)
 *
 * A feature-flagged hook that bridges Role 1 ContextSnapshot data into the
 * Adaptive Engine runtime without making Role 1 responsible for adaptation
 * decisions.
 *
 * Responsibilities:
 *   - Consume a ContextSnapshot (via an injected `getSnapshot` function).
 *   - Build the ModuleContext through the Phase 0B adapter when a module ID
 *     is provided.
 *   - Invoke `decide()` and expose the resulting AdaptationPlan + trace.
 *
 * This hook NEVER executes actions automatically. Execution is only possible
 * through the explicit `execute()` call, and the executor itself keeps UI
 * application gated behind the `uiExecution` feature flag. When the runtime
 * flag is OFF the hook is inert: no decide, no state, no behavior change.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAdaptiveRuntimeEnabled } from "@backend/adaptive/engine/featureFlags";
import { decide } from "@backend/adaptive/engine/adaptiveEngine";
import { executeAdaptation } from "@backend/adaptive/engine/executor";
import { buildModuleContext } from "@/support/framework/moduleContextAdapter";

const IDLE_DECISION = {
  plan: null,
  trace: null,
  error: null,
  decisionId: null,
  lastDecisionAt: null,
};

/**
 * @param {object} [options]
 * @param {string} [options.moduleId] - Canonical FEATURES module id; the
 *   ModuleContext is built via buildModuleContext when provided.
 * @param {() => (object|null)|Promise<object|null>} [options.getSnapshot] -
 *   Async/sync ContextSnapshot producer. When omitted, only `execute()` is
 *   meaningful (decide runs on whatever snapshot is supplied).
 * @param {boolean} [options.enabled] - Override for the runtime feature flag.
 */
export function useAdaptiveBehavioralEngine(options = {}) {
  const { moduleId, getSnapshot, enabled: enabledOverride } = options;
  const enabled = enabledOverride !== undefined ? enabledOverride : isAdaptiveRuntimeEnabled();
  const hasSnapshot = typeof getSnapshot === "function";

  const [decision, setDecision] = useState(IDLE_DECISION);
  const [execution, setExecution] = useState(null);

  const runDecision = useCallback(async () => {
    if (!enabled) {
      return null;
    }
    try {
      const snapshot = typeof getSnapshot === "function" ? await getSnapshot() : null;
      const input = { contextSnapshot: snapshot ?? {} };
      if (moduleId) {
        try {
          input.moduleContext = buildModuleContext(moduleId);
        } catch {
          // Unknown module → generic engine fallback; the snapshot still flows.
        }
      }
      const outcome = decide(input);
      setDecision({
        plan: outcome.plan,
        trace: outcome.trace,
        error: null,
        decisionId: outcome.plan.decisionTraceId,
        lastDecisionAt: outcome.plan.timestamp,
      });
      return outcome;
    } catch (error) {
      setDecision((current) => ({
        ...current,
        error: error?.message ?? String(error),
      }));
      return null;
    }
  }, [enabled, moduleId, getSnapshot]);

  useEffect(() => {
    if (enabled && hasSnapshot) {
      void runDecision();
    }
  }, [enabled, hasSnapshot, runDecision]);

  const execute = useCallback(async () => {
    if (!enabled) {
      return null;
    }
    let plan = decision.plan;
    if (!plan) {
      const outcome = await runDecision();
      if (!outcome) {
        return null;
      }
      plan = outcome.plan;
    }
    const summary = executeAdaptation(plan);
    setExecution(summary);
    return summary;
  }, [enabled, decision.plan, runDecision]);

  return useMemo(
    () => ({
      enabled,
      active: enabled && decision.plan !== null,
      plan: decision.plan,
      trace: decision.trace,
      error: decision.error,
      execution,
      decisionId: decision.decisionId,
      lastDecisionAt: decision.lastDecisionAt,
      refresh: runDecision,
      execute,
    }),
    [enabled, decision, execution, runDecision, execute]
  );
}
