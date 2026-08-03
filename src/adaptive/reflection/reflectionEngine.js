/**
 * reflectionEngine.js — Reflection Engine (Phase 5)
 *
 * Evaluates the historical effectiveness of strategies from Role 4 outcome
 * evidence and produces Tier 9 learned-personalization signals.
 *
 * Reflection is a SIGNAL PRODUCER, never a decision-maker:
 *   - It never creates or modifies an AdaptationPlan.
 *   - It never selects an adaptation action.
 *   - It never bypasses `evaluatePolicies()`.
 *   - Its output is consumed ONLY by Tier 9 (LEARNED PERSONALIZATION);
 *     it can never influence safety, requests, restrictions, preferences,
 *     goals, module constraints, task requirements, or current state.
 *
 * Every signal is explicitly OBSERVATIONAL and CORRELATIONAL
 * (`source: "observational_outcomes"`, `correlational: true`). Reflection
 * never claims causation, clinical efficacy, or guaranteed improvement.
 *
 * Determinism: identical historical evidence produces identical strategy
 * grouping, counts, scores, and confidence. The only generated value is
 * `generatedAt` (a timestamp), which callers may pin via `options.now`.
 *
 * Reflection is EXPLICIT, never automatic: it never runs inside `decide()`
 * and never persists anything. A caller invokes `reflect()` /
 * `reflectUserHistory()` when learned signals are wanted, then passes the
 * result (as `strategyEffectiveness`) into a FUTURE decision cycle.
 *
 * Ownership: Support & Learning Engineer
 */

import {
  InterventionStatus,
  validateEffectivenessSignal,
} from "@/support/schemas/supportSchemas";
import { saveInterventionOutcome } from "@/support/persistence/role4Store";
import { isReflectionEnabled } from "@backend/adaptive/engine/featureFlags";
import { buildRole4Signals } from "@backend/adaptive/engine/role4Signals";

// ─────────────────────────────────────────────────────────────────
//  Deterministic configuration (documented formulas)
// ─────────────────────────────────────────────────────────────────

/** Minimum evaluable outcomes required before an effectiveness score exists. */
const MIN_EVIDENCE_FOR_SCORE = 3;

/** Confidence half-life: the evaluable-sample size at which the quantity
 *  term reaches 0.5 before quality scaling. */
const CONFIDENCE_HALF_LIFE = 5;

/** Hard confidence cap — confidence never reports statistical certainty. */
const CONFIDENCE_CAP = 0.95;

/** Intervention lifecycle statuses treated as an explicit negative signal. */
const NEGATIVE_STATUSES = new Set([
  InterventionStatus.ABANDONED,
  InterventionStatus.FAILED,
  InterventionStatus.CANCELLED,
  InterventionStatus.BLOCKED,
  InterventionStatus.DISMISSED,
]);

// ─────────────────────────────────────────────────────────────────
//  Small deterministic helpers
// ─────────────────────────────────────────────────────────────────

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toEpoch(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * Classify a single outcome into a binary positive/negative signal, or
 * neutral when the record carries no explicit evaluable signal.
 *
 * Documented precedence (most direct user evidence wins):
 *   1. `rating` (1–5): 4–5 → positive, 1–2 → negative, 3 → neutral.
 *   2. `completed` flag: true → positive, false → negative.
 *   3. `status`: completed → positive; abandoned/failed/cancelled/blocked/
 *      dismissed → negative.
 *   4. Anything else (incl. partially_completed) → neutral (not evaluable).
 */
function classifyOutcome(outcome) {
  const rating = outcome?.rating;
  if (typeof rating === "number" && Number.isFinite(rating) && rating >= 1 && rating <= 5) {
    if (rating >= 4) return "positive";
    if (rating <= 2) return "negative";
    return "neutral";
  }

  if (outcome?.completed === true) return "positive";
  if (outcome?.completed === false) return "negative";

  const status = outcome?.status;
  if (status === InterventionStatus.COMPLETED) return "positive";
  if (typeof status === "string" && NEGATIVE_STATUSES.has(status)) return "negative";

  return "neutral";
}

function strategyFields(outcome) {
  const moduleId =
    typeof outcome?.moduleId === "string" && outcome.moduleId.trim().length > 0
      ? outcome.moduleId.trim()
      : undefined;
  const interventionType =
    typeof outcome?.interventionType === "string" && outcome.interventionType.trim().length > 0
      ? outcome.interventionType.trim()
      : undefined;
  return { moduleId, interventionType };
}

/**
 * Deterministic strategy identity from the most specific identifiers the
 * repository records on outcomes: `moduleId` + `interventionType`. No target
 * dimension component exists because Role 4 outcome contracts do not record
 * one. Never random; identical evidence groups identically.
 */
function buildStrategyId(moduleId, interventionType) {
  return `${moduleId}:${interventionType}`;
}

/**
 * Confidence formula (documented):
 *
 *   quantity   = 1 − 1 / (1 + n / 5)              // n = evaluable outcomes
 *   agreement  = max(positive, negative) / n       // quality: contradiction penalty
 *   confidence = n === 0 ? 0
 *              : min(0.95, quantity) * (0.5 + 0.5 * agreement)
 *
 * Monotonic in evidence quantity, bounded in [0, 0.95], penalized by mixed
 * evidence, and 0 when there is no evidence.
 */
function confidenceFor(sampleSize, positiveOutcomes, negativeOutcomes) {
  if (sampleSize === 0) {
    return 0;
  }
  const quantity = 1 - 1 / (1 + sampleSize / CONFIDENCE_HALF_LIFE);
  const agreement = Math.max(positiveOutcomes, negativeOutcomes) / sampleSize;
  return clamp01(Math.min(CONFIDENCE_CAP, quantity) * (0.5 + 0.5 * agreement));
}

function resolveNow(options) {
  return typeof options?.now === "number" && Number.isFinite(options.now) ? options.now : Date.now();
}

// ─────────────────────────────────────────────────────────────────
//  Signal generation
// ─────────────────────────────────────────────────────────────────

/**
 * Generate effectiveness signals from historical Role 4 outcome evidence.
 *
 * Pure and deterministic for identical inputs except the generated
 * `generatedAt` timestamp (pin via `options.now`).
 *
 * @param {object} [input]
 * @param {string} [input.userId] - When provided, outcomes whose `userId`
 *   differs are excluded (Role 4 user scoping).
 * @param {string} [input.moduleId] - Optional module filter.
 * @param {object[]} [input.outcomes] - `InterventionOutcome` records (the
 *   authoritative historical evidence). Only outcomes are scored.
 * @param {object[]} [input.interventions] - Accepted for contract
 *   compatibility and treated as contextual only (never double-counted; an
 *   outcome that was never recorded is never inferred).
 * @param {object} [input.strategyEffectiveness] - Accepted for contract
 *   compatibility; NOT blended into outcome-derived scores (no cross-contract
 *   normalization rule exists, so mixing would fabricate evidence).
 * @param {{ start?: number, end?: number }} [input.timeWindow] - Optional
 *   epoch-ms filter over outcome `createdAt`.
 * @param {object} [options]
 * @param {number} [options.now] - Epoch ms used for `generatedAt` (defaults
 *   to `Date.now()`). Provided so determinism is testable.
 * @returns {Array<import("../../../support/schemas/supportSchemas.js").EffectivenessSignalSchema>}
 */
export function generateEffectivenessSignals(input = {}, options = {}) {
  const outcomes = Array.isArray(input?.outcomes) ? input.outcomes : [];
  const userId =
    typeof input?.userId === "string" && input.userId.trim().length > 0
      ? input.userId.trim()
      : undefined;
  const moduleFilter =
    typeof input?.moduleId === "string" && input.moduleId.trim().length > 0
      ? input.moduleId.trim()
      : undefined;
  const windowStart = toEpoch(input?.timeWindow?.start);
  const windowEnd = toEpoch(input?.timeWindow?.end);
  const now = resolveNow(options);

  // Deterministic grouping: Map preserves first-appearance order, which is the
  // input order for identical evidence (no iteration-order dependence).
  const groups = new Map();

  for (const outcome of outcomes) {
    if (!isPlainObject(outcome)) continue;

    if (userId !== undefined && typeof outcome.userId === "string" && outcome.userId.trim() !== userId) {
      continue;
    }

    const { moduleId, interventionType } = strategyFields(outcome);
    if (!moduleId || !interventionType) continue;
    if (moduleFilter !== undefined && moduleId !== moduleFilter) continue;

    const createdAt = toEpoch(outcome.createdAt);
    if (windowStart !== undefined && (createdAt === undefined || createdAt < windowStart)) continue;
    if (windowEnd !== undefined && (createdAt === undefined || createdAt > windowEnd)) continue;

    const classification = classifyOutcome(outcome);
    const strategyId = buildStrategyId(moduleId, interventionType);

    let group = groups.get(strategyId);
    if (!group) {
      group = { moduleId, actionType: interventionType, evidenceCount: 0, positiveOutcomes: 0, negativeOutcomes: 0 };
      groups.set(strategyId, group);
    }
    group.evidenceCount += 1;
    if (classification === "positive") group.positiveOutcomes += 1;
    if (classification === "negative") group.negativeOutcomes += 1;
  }

  const signals = [];
  for (const [strategyId, group] of groups) {
    const sampleSize = group.positiveOutcomes + group.negativeOutcomes;

    const signal = {
      moduleId: group.moduleId,
      actionType: group.actionType,
      strategyId,
      sampleSize,
      positiveOutcomes: group.positiveOutcomes,
      negativeOutcomes: group.negativeOutcomes,
      confidence: confidenceFor(sampleSize, group.positiveOutcomes, group.negativeOutcomes),
      evidenceCount: group.evidenceCount,
      source: "observational_outcomes",
      correlational: true,
      generatedAt: now,
    };
    if (userId !== undefined) {
      signal.userId = userId;
    }
    // Insufficient evidence → no fabricated score (never 0% or 100%).
    if (sampleSize >= MIN_EVIDENCE_FOR_SCORE) {
      signal.effectivenessScore = clamp01(group.positiveOutcomes / sampleSize);
    }

    signals.push(validateEffectivenessSignal(signal));
  }

  return signals;
}

/**
 * Explicit reflection entry point: run reflection over provided evidence and
 * return the effectiveness signals plus a descriptive summary.
 *
 * @param {object} [input] - Same input contract as generateEffectivenessSignals.
 * @param {object} [options]
 * @param {number} [options.now]
 * @returns {{ signals: Array<object>, summary: { strategyCount: number, evidenceCount: number, correlational: true, generatedAt: number } }}
 */
export function reflect(input = {}, options = {}) {
  const signals = generateEffectivenessSignals(input, options);
  const evidenceCount = signals.reduce((sum, signal) => sum + signal.evidenceCount, 0);
  return {
    signals,
    summary: {
      strategyCount: signals.length,
      evidenceCount,
      correlational: true,
      generatedAt: resolveNow(options),
    },
  };
}

/**
 * Convert effectiveness signals into the `role4Signals.strategyEffectiveness`
 * fragment consumed by future decision cycles: `Record<strategyId, score>`.
 * Strategies with no computed score (insufficient evidence) are omitted so no
 * unearned value is injected.
 *
 * @param {Array<object>} signals
 * @returns {Record<string, number>}
 */
export function toStrategyEffectiveness(signals) {
  const result = {};
  for (const signal of Array.isArray(signals) ? signals : []) {
    if (!isPlainObject(signal)) continue;
    if (typeof signal.strategyId !== "string" || signal.strategyId.trim().length === 0) continue;
    if (typeof signal.effectivenessScore !== "number" || !Number.isFinite(signal.effectivenessScore)) continue;
    result[signal.strategyId] = clamp01(signal.effectivenessScore);
  }
  return result;
}

/**
 * Flag-aware explicit caller for the live app. Reads Role 4 historical
 * evidence through the existing Phase 4 read path (`buildRole4Signals`) and
 * runs reflection. When the `reflection` feature flag is OFF it returns no
 * signals, so nothing can leak learned personalization into decisions.
 *
 * @param {string} [userId]
 * @param {object} [options]
 * @param {number} [options.now]
 * @returns {{ signals: Array<object>, summary: object }}
 */
export function reflectUserHistory(userId, options = {}) {
  const now = resolveNow(options);
  if (!isReflectionEnabled()) {
    return {
      signals: [],
      summary: {
        disabled: true,
        strategyCount: 0,
        evidenceCount: 0,
        correlational: true,
        generatedAt: now,
      },
    };
  }
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return {
      signals: [],
      summary: {
        strategyCount: 0,
        evidenceCount: 0,
        correlational: true,
        generatedAt: now,
      },
    };
  }
  const normalizedUserId = userId.trim();
  const signals = buildRole4Signals(normalizedUserId);
  return reflect(
    {
      userId: normalizedUserId,
      outcomes: signals.outcomes,
      interventions: signals.interventions,
    },
    options,
  );
}

// ─────────────────────────────────────────────────────────────────
//  Preserved public exports (Phase 0 stubs, now implemented)
// ─────────────────────────────────────────────────────────────────

/**
 * Record an intervention outcome through the existing Role 4 persistence API.
 * Requires the outcome to carry a non-empty `userId`; otherwise the outcome
 * cannot be scoped to a user and nothing is persisted. No parallel storage is
 * created and no outcome is fabricated.
 *
 * @param {object} outcome - The intervention outcome data (must satisfy
 *   InterventionOutcomeSchema for persistence).
 * @returns {object|null} The persisted Role 4 record, or null when the
 *   outcome has no user scope.
 */
export function recordOutcome(outcome) {
  if (!isPlainObject(outcome)) {
    return null;
  }
  const userId = typeof outcome.userId === "string" && outcome.userId.trim().length > 0 ? outcome.userId.trim() : undefined;
  if (!userId) {
    return null;
  }
  return saveInterventionOutcome(userId, outcome);
}

/**
 * Analyze historical outcome patterns per strategy. Outputs are descriptive,
 * observational analysis only — never actions, policies, or plan fragments.
 * Effective/ineffective patterns require a computed score (sufficient
 * evidence); recommendations are correlational statements, never causal
 * claims and never adaptation actions.
 *
 * @param {InterventionOutcome[]} outcomes - Historical outcomes
 * @param {object} [options]
 * @param {number} [options.now]
 * @returns {{ effectivePatterns: object[], ineffectivePatterns: object[], recommendations: string[] }}
 */
export function analyzePatterns(outcomes, options = {}) {
  const signals = generateEffectivenessSignals({ outcomes }, options);
  const effectivePatterns = [];
  const ineffectivePatterns = [];
  const recommendations = [];

  for (const signal of signals) {
    if (typeof signal.effectivenessScore !== "number") {
      continue;
    }
    const descriptor = `${signal.moduleId} / ${signal.actionType}`;
    if (signal.effectivenessScore >= 0.6) {
      effectivePatterns.push({
        strategyId: signal.strategyId,
        descriptor,
        effectivenessScore: signal.effectivenessScore,
        sampleSize: signal.sampleSize,
        confidence: signal.confidence,
        correlational: true,
      });
      recommendations.push(
        `Observational: "${descriptor}" is historically associated with favorable outcomes (${signal.positiveOutcomes}/${signal.sampleSize} evaluable).`,
      );
    } else if (signal.effectivenessScore <= 0.4) {
      ineffectivePatterns.push({
        strategyId: signal.strategyId,
        descriptor,
        effectivenessScore: signal.effectivenessScore,
        sampleSize: signal.sampleSize,
        confidence: signal.confidence,
        correlational: true,
      });
      recommendations.push(
        `Observational: "${descriptor}" is historically associated with less favorable outcomes (${signal.negativeOutcomes}/${signal.sampleSize} evaluable).`,
      );
    }
  }

  return { effectivePatterns, ineffectivePatterns, recommendations };
}

/**
 * Generate a descriptive reflection summary for a session. Purely analytical;
 * `followUpSuggestions` are observational suggestions, never adaptation
 * actions or plan fragments.
 *
 * @param {InterventionOutcome[]} sessionOutcomes
 * @param {object} [options]
 * @param {number} [options.now]
 * @returns {{ summary: string, keyInsights: string[], followUpSuggestions: string[] }}
 */
export function reflectOnSession(sessionOutcomes, options = {}) {
  const signals = generateEffectivenessSignals({ outcomes: sessionOutcomes }, options);
  const evaluated = signals.filter((signal) => typeof signal.effectivenessScore === "number");

  if (evaluated.length === 0) {
    return {
      summary: "No evaluable outcomes yet. Any reflection would be observational, not causal.",
      keyInsights: [],
      followUpSuggestions: [],
    };
  }

  const favorable = evaluated.filter((signal) => signal.effectivenessScore >= 0.6);
  const summary = `Session analysis: ${evaluated.length} strategy(ies) with sufficient evidence. Findings are observational and correlational, never causal.`;
  const keyInsights = favorable.map(
    (signal) =>
      `"${signal.moduleId}/${signal.actionType}" historically favorable (${signal.positiveOutcomes}/${signal.sampleSize} evaluable).`,
  );
  const followUpSuggestions = evaluated
    .filter((signal) => signal.effectivenessScore < 0.6)
    .map((signal) => `Gather more evidence on "${signal.moduleId}/${signal.actionType}".`);

  return { summary, keyInsights, followUpSuggestions };
}
