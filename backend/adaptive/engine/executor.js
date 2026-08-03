/**
 * executor.js — Adaptive Engine execution layer (Phase 3)
 *
 * Orchestrates a validated AdaptationPlan into per-action ExecutionResults.
 * The ONLY implemented executor is the UI executor (uiAdapter). All other
 * dimensions are reported as explicitly skipped (no executor exists yet);
 * module-owned execution remains an extension point for later phases.
 *
 * Separation of concerns (spec §4, §13):
 *   - decide() returns a plan; it never executes anything.
 *   - executeAdaptation(plan, moduleContext) is what applies actions, and is
 *     invoked by the caller only when it decides to execute.
 *
 * Guarantees:
 *   - Iterates `plan.priorityOrder` (falls back to `plan.actions` order).
 *   - Unknown action IDs are reported as failures, never silently dropped.
 *   - A single failing action never crashes the remaining actions.
 *   - UI actions are gated behind the `uiExecution` feature flag; while the
 *     flag is OFF every UI action is intentionally skipped.
 *   - No Role 4 persistence, no intervention lifecycle updates, no outcome
 *     recording, no network requests.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { AdaptationDimension } from "@/support/schemas/supportSchemas";
import { adaptUIAction } from "@/adaptive/ui/uiAdapter";
import { isUIExecutionEnabled } from "./featureFlags.js";

function baseResult(action, executedAt) {
  return { actionId: action.actionId, dimension: action.target, appliedAt: executedAt };
}

function dispatch(action, executedAt) {
  const base = baseResult(action, executedAt);
  try {
    if (action.target === AdaptationDimension.UI) {
      if (!isUIExecutionEnabled()) {
        return {
          ...base,
          ok: true,
          applied: false,
          skipped: "UI adaptive execution is disabled (feature flag)",
        };
      }
      const outcome = adaptUIAction(action);
      if (outcome.ok) {
        return {
          ...base,
          ok: true,
          applied: true,
          metadata: { mode: outcome.mode, config: outcome.config },
        };
      }
      return { ...base, ok: false, applied: false, error: outcome.error };
    }
    return {
      ...base,
      ok: true,
      applied: false,
      skipped: `unsupported dimension: ${action.target}`,
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      applied: false,
      error: error?.message ?? String(error),
    };
  }
}

function buildSummary(planId, decisionTraceId, moduleId, executedAt, results) {
  return {
    planId: planId ?? null,
    decisionTraceId: decisionTraceId ?? null,
    moduleId: moduleId ?? null,
    executedAt,
    results,
    summary: {
      total: results.length,
      applied: results.filter((result) => result.applied === true).length,
      skipped: results.filter((result) => result.skipped !== undefined).length,
      failed: results.filter((result) => result.ok === false).length,
    },
    ok: results.every((result) => result.ok !== false),
  };
}

/**
 * Execute the actions of a validated AdaptationPlan in priorityOrder.
 *
 * @param {import("../../../support/schemas/supportSchemas.js").AdaptationPlanSchema} plan
 * @param {object} [moduleContext] - ModuleContext (reserved for future module
 *   executors; used here only for execution-summary provenance).
 * @param {object} [options]
 * @param {() => number} [options.now] - Clock override for deterministic tests.
 * @returns {{
 *   planId: string|null,
 *   decisionTraceId: string|null,
 *   moduleId: string|null,
 *   executedAt: number,
 *   results: Array<object>,
 *   summary: { total: number, applied: number, skipped: number, failed: number },
 *   ok: boolean
 * }}
 */
export function executeAdaptation(plan, moduleContext, options = {}) {
  const now = typeof options.now === "function" ? options.now : Date.now;
  const executedAt = now();

  if (plan === null || plan === undefined || typeof plan !== "object") {
    return buildSummary(null, null, moduleContext?.moduleId ?? null, executedAt, []);
  }

  const actions = Array.isArray(plan.actions) ? plan.actions : [];
  const byId = new Map(actions.map((action) => [action.actionId, action]));

  const orderedIds =
    Array.isArray(plan.priorityOrder) && plan.priorityOrder.length > 0
      ? plan.priorityOrder
      : actions.map((action) => action.actionId);

  const visited = new Set();
  const results = [];

  for (const actionId of orderedIds) {
    visited.add(actionId);
    const action = byId.get(actionId);
    if (!action) {
      results.push({
        actionId,
        ok: false,
        applied: false,
        appliedAt: executedAt,
        error: `unknown actionId: ${actionId}`,
      });
      continue;
    }
    results.push(dispatch(action, executedAt));
  }

  // Any action not referenced by priorityOrder is still accounted for.
  for (const action of actions) {
    if (!visited.has(action.actionId)) {
      results.push(dispatch(action, executedAt));
    }
  }

  return buildSummary(plan.planId, plan.decisionTraceId, moduleContext?.moduleId ?? null, executedAt, results);
}
