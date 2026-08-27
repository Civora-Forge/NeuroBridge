/**
 * useAdaptiveBehavioralEngine.js — Adaptive Engine React integration boundary
 * (Phase 3 runtime, Phase 4 live wiring)
 *
 * A feature-flagged hook that bridges Role 1 ContextSnapshot data into the
 * Adaptive Engine runtime without making Role 1 responsible for adaptation
 * decisions.
 *
 * Responsibilities:
 *   - Consume a ContextSnapshot (via an injected `getSnapshot` function).
 *   - Build the ModuleContext through the Phase 0B adapter when a module ID
 *     is provided.
 *   - Assemble the live Role 4 read path (`role4Signals` from a userId) and
 *     any provided userPreferences / currentTask / currentGoal fragments
 *     (Phase 4).
 *   - Invoke `decide()` and expose the resulting AdaptationPlan + trace.
 *
 * This hook NEVER executes actions automatically. Execution is only possible
 * through the explicit `execute()` call, and the executor itself keeps UI
 * application gated behind the `uiExecution` feature flag. When the runtime
 * flag is OFF the hook is inert: no decide, no state, no behavior change.
 *
 * Dependency stability: the hook re-decides when the snapshot value changes
 * or when a decision input (moduleId / userId / fragments) changes. The
 * `getSnapshot` producer must return a referentially stable snapshot for
 * unchanged state; the hook de-duplicates identical snapshots so an unstable
 * producer function identity does not cause repeated decide() cycles.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAdaptiveRuntimeEnabled } from "@backend/adaptive/engine/featureFlags";
import { decide } from "@backend/adaptive/engine/adaptiveEngine";
import { executeAdaptation } from "@backend/adaptive/engine/executor";
import { buildModuleContext } from "@/support/framework/moduleContextAdapter";
import { getSupportEvidenceAsync } from "@/support/evidence/supportEvidence";

const IDLE_DECISION = {
  plan: null,
  trace: null,
  error: null,
  decisionId: null,
  lastDecisionAt: null,
};

/**
 * Content signature for decision de-duplication. Callers may legitimately
 * pass unstable references (inline `userPreferences` objects, snapshot
 * producers that build a fresh object on every call), so reference identity
 * must never gate re-decide decisions. When the value is not JSON-serializable
 * the fallback keeps the conservative "re-decide" behaviour rather than
 * silently skipping a real change.
 */
function signatureOf(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return `non-serializable:${Date.now()}:${Math.random()}`;
  }
}

/**
 * @param {object} [options]
 * @param {string} [options.moduleId] - Canonical FEATURES module id; the
 *   ModuleContext is built via buildModuleContext when provided.
 * @param {() => (object|null)|Promise<object|null>} [options.getSnapshot] -
 *   Async/sync ContextSnapshot producer. Must return a referentially stable
 *   snapshot for unchanged state. When omitted, only `execute()` is
 *   meaningful (decide runs on whatever snapshot is supplied).
 * @param {boolean} [options.enabled] - Override for the runtime feature flag.
 * @param {string} [options.userId] - Normalized Role 4 userId. When enabled,
 *   the Role 4 read path (`buildRole4Signals`) supplies the live
 *   `role4Signals` input for the decision (Phase 4).
 * @param {object} [options.role4Signals] - Explicit `role4Signals` override.
 *   Takes precedence over the userId-driven read path. Callers must pass a
 *   stable reference (module-level constant or memoized value).
 * @param {object} [options.userPreferences] - Optional `userPreferences`
 *   fragment (spec §5). Stable reference required.
 * @param {object} [options.currentTask] - Optional derived task reference
 *   (spec §5, labeled `derived` upstream). Stable reference required.
 * @param {object} [options.currentGoal] - Optional goal reference
 *   (spec §5, labeled `derived` upstream). Stable reference required.
 */
export function useAdaptiveBehavioralEngine(options = {}) {
  const {
    moduleId,
    getSnapshot,
    enabled: enabledOverride,
    userId,
    role4Signals,
    userPreferences,
    currentTask,
    currentGoal,
  } = options;
  const enabled = enabledOverride !== undefined ? enabledOverride : isAdaptiveRuntimeEnabled();
  const hasSnapshot = typeof getSnapshot === "function";

  const [decision, setDecision] = useState(IDLE_DECISION);
  const [execution, setExecution] = useState(null);

  // Tracks the signature of the last decision so an unstable producer
  // identity or option reference does not re-run decide() with unchanged data.
  const lastRunRef = useRef(null);

  const setError = useCallback((error) => {
    setDecision((current) => ({
      ...current,
      error: error?.message ?? String(error),
    }));
  }, []);

  const buildInput = useCallback(
    async (snapshot) => {
      const input = { contextSnapshot: snapshot ?? {} };
      if (moduleId) {
        try {
          input.moduleContext = buildModuleContext(moduleId);
        } catch {
          // Unknown module → generic engine fallback; the snapshot still flows.
        }
      }
      const liveRole4Signals = role4Signals !== undefined && role4Signals !== null
        ? { strategyEffectiveness: role4Signals.strategyEffectiveness, supportEvidence: role4Signals.supportEvidence }
        : undefined;
      if (liveRole4Signals !== undefined) {
        input.role4Signals = { ...liveRole4Signals };
        if (moduleId === "support.focus_session" && userId) {
          input.role4Signals.supportEvidence = await getSupportEvidenceAsync(userId, ["support.focus_session"]);
        }
      } else if (moduleId === "support.focus_session" && userId) {
        input.role4Signals = { supportEvidence: await getSupportEvidenceAsync(userId, ["support.focus_session"]) };
      }
      if (userPreferences !== undefined && userPreferences !== null) {
        input.userPreferences = userPreferences;
      }
      if (currentTask !== undefined && currentTask !== null) {
        input.currentTask = currentTask;
      }
      if (currentGoal !== undefined && currentGoal !== null) {
        input.currentGoal = currentGoal;
      }
      return input;
    },
    [moduleId, userId, role4Signals, userPreferences, currentTask, currentGoal]
  );

  const decideWithSnapshot = useCallback(
    async (snapshot) => {
      if (!enabled) {
        return null;
      }
      try {
        const outcome = decide(await buildInput(snapshot), { userId });
        setDecision({
          plan: outcome.plan,
          trace: outcome.trace,
          error: null,
          decisionId: outcome.plan.decisionTraceId,
          lastDecisionAt: outcome.plan.timestamp,
        });
        return outcome;
      } catch (error) {
        setError(error);
        return null;
      }
    },
    [enabled, buildInput, setError, userId]
  );

  const runDecision = useCallback(async () => {
    if (!enabled) {
      return null;
    }
    let snapshot;
    try {
      snapshot = typeof getSnapshot === "function" ? await getSnapshot() : null;
    } catch (error) {
      setError(error);
      return null;
    }
    return decideWithSnapshot(snapshot);
  }, [enabled, getSnapshot, decideWithSnapshot, setError]);

  useEffect(() => {
    if (!enabled || !hasSnapshot) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      let snapshot;
      try {
        snapshot = await getSnapshot();
      } catch (error) {
        if (!cancelled) {
          setError(error);
        }
        return;
      }
      if (cancelled) {
        return;
      }
      // Content-based de-duplication: both the snapshot producer and the
      // optional decision fragments may be reference-unstable across renders
      // (e.g. an inline `userPreferences` object). Reference equality would
      // defeat the guard and re-run decide() on every render, producing an
      // unbounded render → decide → render storm. Comparing the serialized
      // input content preserves the "re-decide on real change" contract while
      // ignoring identity churn.
      const input = await buildInput(snapshot);
      const signature = signatureOf({ snapshot, input, userId });
      const last = lastRunRef.current;
      if (last && last.signature === signature) {
        return;
      }
      lastRunRef.current = { signature };
      await decideWithSnapshot(snapshot);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, hasSnapshot, getSnapshot, decideWithSnapshot, setError]);

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
