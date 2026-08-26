/**
 * adaptationService.js — Consumes the Adaptive Engine's PUBLIC outputs
 * (`plan`, `trace`, `enabled`, `error` from useAdaptiveBehavioralEngine) and
 * maps them to the simulator's own safe signals. This module never modifies
 * the engine — it only reads its documented public contract. When the engine
 * is off, errors, or yields nothing usable, the feature degrades gracefully.
 */

import { AdaptationActionType, AdaptationDimension } from "@/support/schemas/supportSchemas";
import { DEFAULT_ADAPTATION_SIGNALS } from "../types/communicationTypes";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function matchesDimension(action, dimensions) {
  return dimensions.includes(action?.target);
}

function matchesType(action, types) {
  return types.includes(action?.type);
}

export function normalizeEnginePlan(plan) {
  if (!plan || typeof plan !== "object") return null;
  return { ...plan, actions: asArray(plan.actions) };
}

export function parseEnginePlan(plan) {
  const normalized = normalizeEnginePlan(plan);
  if (!normalized) {
    return { ...DEFAULT_ADAPTATION_SIGNALS };
  }

  const actions = normalized.actions;

  const simplify = actions.some(
    (action) =>
      matchesDimension(action, [AdaptationDimension.CONTENT, AdaptationDimension.TASK, AdaptationDimension.INTERACTION]) &&
      matchesType(action, [AdaptationActionType.SIMPLIFY, AdaptationActionType.DECOMPOSE, AdaptationActionType.REDUCE]),
  );

  const slowPace = actions.some(
    (action) =>
      matchesDimension(action, [AdaptationDimension.PACING, AdaptationDimension.TIMING, AdaptationDimension.INTERACTION]) &&
      matchesType(action, [AdaptationActionType.DECREASE, AdaptationActionType.DELAY, AdaptationActionType.PAUSE, AdaptationActionType.SUPPRESS]),
  );

  const reduceDistractions = actions.some(
    (action) =>
      matchesDimension(action, [AdaptationDimension.UI, AdaptationDimension.NOTIFICATIONS]) &&
      matchesType(action, [AdaptationActionType.REDUCE, AdaptationActionType.SUPPRESS, AdaptationActionType.DISABLE]),
  );

  const provideHints = actions.some(
    (action) =>
      matchesDimension(action, [AdaptationDimension.ASSISTANCE, AdaptationDimension.CONTENT]) &&
      matchesType(action, [AdaptationActionType.INCREASE, AdaptationActionType.REINFORCE, AdaptationActionType.GUIDE]),
  );

  const recommendEasier = actions.some((action) => matchesType(action, [AdaptationActionType.RECOMMEND]));

  const active = simplify || slowPace || reduceDistractions || provideHints || recommendEasier;

  return {
    ...DEFAULT_ADAPTATION_SIGNALS,
    active,
    simplify,
    slowPace,
    reduceDistractions,
    provideHints,
    recommendEasier,
    decisionTraceId: normalized.decisionTraceId ?? normalized.planId ?? null,
    sources: asArray(normalized.sources),
    overallConfidence: Number.isFinite(normalized.overallConfidence) ? normalized.overallConfidence : null,
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

/**
 * Apply adaptation signals to a session. Never mutates; returns a new session
 * (or the same reference when nothing changes). Missing signals are ignored so
 * the simulator always runs.
 */
export function applyAdaptationSignals(session, signals = {}) {
  if (!session || !signals || signals.active !== true) return session;

  const adaptation = { ...(session.adaptation ?? {}) };
  let changed = false;

  if (signals.simplify && session.effectiveDifficulty > 1) {
    adaptation.effectiveDifficulty = session.effectiveDifficulty - 1;
    changed = true;
  }
  if (signals.slowPace) {
    adaptation.pacing = "slow";
    changed = true;
  }
  if (signals.reduceDistractions) {
    adaptation.distractionFree = true;
    changed = true;
  }
  if (signals.provideHints) {
    adaptation.provideHints = true;
    changed = true;
  }
  if (signals.recommendEasier) {
    adaptation.recommendEasier = true;
    changed = true;
  }

  if (!changed) return session;
  return { ...session, adaptation };
}
