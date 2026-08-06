/**
 * adaptationService.js — Consumes the Adaptive Engine's PUBLIC outputs and maps
 * them to the simulator's own, safe adaptation signals.
 *
 * This module never modifies the Adaptive Engine. It only reads `plan` and
 * `trace` (the documented public contract of `useAdaptiveBehavioralEngine` /
 * `decide()`) and translates supported actions into a small, self-applied set
 * of changes: simplify scenario, slow pace, reduce distractions, recommend an
 * easier scenario. When the engine is off, errors, or yields nothing usable,
 * the module degrades gracefully to its default experience.
 */

import { AdaptationDimension, AdaptationActionType } from "@/support/schemas/supportSchemas";
import {
  ADAPTATION_SIGNALS,
  DEFAULT_ADAPTATION_SIGNALS,
  DIFFICULTY_IDS,
} from "./socialScenarioTypes";
import { getScenariosByCategory } from "./scenarioLibrary";

const NEXT_EASIER_DIFFICULTY = {
  hard: "medium",
  medium: "easy",
  easy: "easy",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeEnginePlan(plan) {
  if (!plan || typeof plan !== "object") return null;
  return {
    ...plan,
    actions: asArray(plan.actions),
  };
}

function matchesDimension(action, dimensions) {
  return dimensions.includes(action?.target);
}

function matchesType(action, types) {
  return types.includes(action?.type);
}

/** Translate a validated plan into the four simulator adaptation signals. */
export function parseEnginePlan(plan) {
  const normalized = normalizeEnginePlan(plan);
  if (!normalized) {
    return { ...DEFAULT_ADAPTATION_SIGNALS, active: false };
  }

  const actions = normalized.actions;

  const simplifyScenario = actions.some(
    (action) =>
      matchesDimension(action, [
        AdaptationDimension.CONTENT,
        AdaptationDimension.TASK,
        AdaptationDimension.INTERACTION,
      ]) &&
      matchesType(action, [
        AdaptationActionType.SIMPLIFY,
        AdaptationActionType.DECOMPOSE,
        AdaptationActionType.REDUCE,
      ]),
  );

  const slowPace = actions.some(
    (action) =>
      matchesDimension(action, [
        AdaptationDimension.PACING,
        AdaptationDimension.TIMING,
        AdaptationDimension.INTERACTION,
      ]) &&
      matchesType(action, [
        AdaptationActionType.DECREASE,
        AdaptationActionType.DELAY,
        AdaptationActionType.PAUSE,
        AdaptationActionType.SUPPRESS,
      ]),
  );

  const reduceDistractions = actions.some(
    (action) =>
      matchesDimension(action, [AdaptationDimension.UI, AdaptationDimension.NOTIFICATIONS]) &&
      matchesType(action, [
        AdaptationActionType.REDUCE,
        AdaptationActionType.SUPPRESS,
        AdaptationActionType.DISABLE,
      ]),
  );

  const recommendEasierScenario = actions.some(
    (action) => matchesType(action, [AdaptationActionType.RECOMMEND]),
  );

  const active =
    simplifyScenario || slowPace || reduceDistractions || recommendEasierScenario;

  return {
    active,
    simplifyScenario,
    slowPace,
    reduceDistractions,
    recommendEasierScenario,
    decisionTraceId: normalized.decisionTraceId ?? normalized.planId ?? null,
    sources: asArray(normalized.sources),
    overallConfidence:
      Number.isFinite(normalized.overallConfidence) ? normalized.overallConfidence : null,
    actionCount: actions.length,
  };
}

/**
 * Full public-output consumer. Always returns a stable object; never throws.
 * @param {{ plan?: object, trace?: object, enabled?: boolean, error?: unknown }} input
 */
export function consumeEngineOutput({ plan, trace, enabled = false, error } = {}) {
  const traceId = trace?.decisionTraceId ?? plan?.decisionTraceId ?? null;
  const sources = asArray(trace?.sources);

  if (error) {
    return {
      available: false,
      signals: { ...DEFAULT_ADAPTATION_SIGNALS },
      degraded: { reason: "engine_error", message: String(error) },
      decisionTraceId: traceId,
      sources,
    };
  }

  if (!enabled) {
    return {
      available: false,
      signals: { ...DEFAULT_ADAPTATION_SIGNALS },
      degraded: { reason: "engine_unavailable" },
      decisionTraceId: traceId,
      sources,
    };
  }

  if (!plan) {
    return {
      available: false,
      signals: { ...DEFAULT_ADAPTATION_SIGNALS },
      degraded: { reason: "no_plan" },
      decisionTraceId: traceId,
      sources,
    };
  }

  try {
    const signals = parseEnginePlan(plan);
    return {
      available: true,
      signals: { ...DEFAULT_ADAPTATION_SIGNALS, ...signals },
      degraded: null,
      decisionTraceId: signals.decisionTraceId ?? traceId,
      sources: signals.sources.length > 0 ? signals.sources : sources,
    };
  } catch {
    return {
      available: false,
      signals: { ...DEFAULT_ADAPTATION_SIGNALS },
      degraded: { reason: "parse_error" },
      decisionTraceId: traceId,
      sources,
    };
  }
}

export function getNextEasierDifficulty(difficulty) {
  return NEXT_EASIER_DIFFICULTY[difficulty] ?? "easy";
}

/** Pick the easiest uncompleted scenario in the same category as a gentle
 *  recommendation, or null when none is meaningfully easier. */
export function recommendEasierScenario(scenario, completedScenarioIds = []) {
  if (!scenario) return null;
  const candidates = getScenariosByCategory(scenario.category)
    .filter((candidate) => candidate.id !== scenario.id)
    .sort((a, b) => DIFFICULTY_IDS.indexOf(a.difficulty) - DIFFICULTY_IDS.indexOf(b.difficulty));
  return candidates.find((candidate) => !completedScenarioIds.includes(candidate.id)) ?? candidates[0] ?? null;
}

/**
 * Apply adaptation signals to a session. Never mutates; returns a new session
 * or the same reference when nothing changes. Missing signals are ignored so
 * the simulator always runs.
 */
export function applyAdaptationSignals(session, signals = {}) {
  if (!session || !signals || signals.active !== true) return session;

  const adaptation = { ...(session.adaptation ?? {}) };
  let changed = false;

  if (signals.simplifyScenario) {
    const next = getNextEasierDifficulty(session.difficulty);
    if (next !== session.difficulty) {
      adaptation.effectiveDifficulty = next;
      changed = true;
    }
  }
  if (signals.slowPace) {
    adaptation.pacing = "slow";
    changed = true;
  }
  if (signals.reduceDistractions) {
    adaptation.distractionFree = true;
    changed = true;
  }
  if (signals.recommendEasierScenario) {
    adaptation.recommendEasierScenario = true;
    changed = true;
  }

  if (!changed) return session;
  return { ...session, adaptation };
}
