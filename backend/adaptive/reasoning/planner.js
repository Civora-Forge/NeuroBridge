/**
 * planner.js — Planning Agent (Adaptive Engine, Phase 2)
 *
 * Assembles the canonical `AdaptationPlan` (§6 of the Adaptive Engine spec)
 * from the outputs of reasoning (`ReasoningResult`) and policy evaluation
 * (`TriggeredPolicyEntry[]` produced by `evaluatePolicies` in
 * adaptationPolicy.js).
 *
 * Responsibilities:
 *   - Convert each triggered PolicyRule into an `AdaptationAction` (1:1).
 *   - Preserve the precedence order established by policy evaluation
 *     (lower tier number wins; within a tier, higher numeric priority wins).
 *     The planner introduces no new ranking algorithm.
 *   - Derive action confidence deterministically: rule-level confidence wins
 *     when available; otherwise the reasoning-level confidence is the
 *     documented fallback; when neither is available, 0 (no evidence).
 *   - Carry explainable provenance (`reason` + `evidence`).
 *   - Reflect policy-declared timing (`durationMs` / `hysteresis`) into
 *     action `durationMs`/`expiry` and plan `reEvaluateAt`. Policies that
 *     declare no timing produce no `reEvaluateAt` (no invented defaults).
 *   - Express UI changes ONLY as `{type:"MODIFY", target:"UI", ...}`
 *     actions. The plan NEVER carries a top-level `uiMode`.
 *
 * The planner is read-only with respect to UserState: it stores a snapshot
 * reference and never mutates the input.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import {
  AdaptationActionType,
  AdaptationDimension,
  PolicyScope,
  validateAdaptationAction,
  validateAdaptationPlan,
} from "@/support/schemas/supportSchemas";

let idSequence = 0;

function createId(prefix, timestamp) {
  idSequence += 1;
  return `${prefix}_${timestamp}_${idSequence}`;
}

function isFiniteInRange(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isNonNegativeFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function pushUnique(list, value) {
  if (typeof value === "string" && value.trim().length > 0 && !list.includes(value)) {
    list.push(value);
  }
  return list;
}

/**
 * Derive the confidence for a single action.
 *
 * Precedence: rule-level confidence → reasoning-level confidence → 0.
 * This is the documented deterministic fallback: the repository's rules
 * (Phase 1 policies) carry no per-rule confidence, so the reasoning-level
 * confidence is used. No confidence value is invented.
 */
function deriveActionConfidence(entry, reasoning) {
  if (isFiniteInRange(entry?.confidence, 0, 1)) return entry.confidence;
  if (isFiniteInRange(reasoning?.confidence, 0, 1)) return reasoning.confidence;
  return 0;
}

/**
 * Actions are reversible by default. A policy that explicitly declares
 * `reversal: "none"` produces a non-reversible action. Safety-based
 * non-reversibility is intentionally not modelled here (Safety stage not yet
 * implemented).
 */
function deriveReversible(entry) {
  if (entry?.reversal === undefined) return true;
  return entry.reversal !== "none";
}

/** Human-readable "why" identifying the policy and its matched triggers. */
function buildReason(entry) {
  const ruleId = entry.ruleId;
  const version = entry.version ?? entry.ruleVersion ?? 1;
  const triggers = Array.isArray(entry.matchedTriggers) ? entry.matchedTriggers : [];
  const detail =
    triggers.length > 0
      ? triggers.map((t) => `${t.dimension} ${t.condition} ${JSON.stringify(t.value)}`).join("; ")
      : "trigger group(s) satisfied";
  return `Policy "${ruleId}" (v${version}) matched: ${detail}.`;
}

/**
 * Build provenance references from available sources: reasoning sources,
 * matched-trigger descriptors, the policy identity, and (for module-scoped
 * rules) the active module. Nothing is fabricated.
 */
function buildEvidence(reasoning, entry, moduleContext) {
  const evidence = [];
  const sources = Array.isArray(reasoning?.sources) ? reasoning.sources : [];
  for (const source of sources) {
    pushUnique(evidence, source);
  }
  const triggers = Array.isArray(entry.matchedTriggers) ? entry.matchedTriggers : [];
  for (const trigger of triggers) {
    pushUnique(
      evidence,
      `trigger:${trigger.dimension} ${trigger.condition} ${JSON.stringify(trigger.value)}`,
    );
  }
  pushUnique(evidence, `policy:${entry.ruleId}@v${entry.version ?? entry.ruleVersion ?? 1}`);
  if (entry.scope === PolicyScope.MODULE && moduleContext?.moduleId) {
    pushUnique(evidence, `module:${moduleContext.moduleId}`);
  }
  return evidence;
}

/** Map a single triggered policy into a validated AdaptationAction. */
function buildAction(entry, reasoning, timestamp, moduleContext) {
  const durationMs = isNonNegativeFinite(entry.durationMs) ? entry.durationMs : undefined;
  const expiry = isNonNegativeFinite(entry.expiry) ? entry.expiry : undefined;

  const action = {
    actionId: createId("action", timestamp),
    type: entry.action.type,
    target: entry.action.target,
    parameters: entry.action.parameters ?? {},
    tier: entry.tier,
    numericPriority: entry.priority,
    confidence: deriveActionConfidence(entry, reasoning),
    reason: buildReason(entry),
    evidence: buildEvidence(reasoning, entry, moduleContext),
    reversible: deriveReversible(entry),
  };

  if (durationMs !== undefined) {
    action.durationMs = durationMs;
  }
  if (expiry !== undefined) {
    action.expiry = expiry;
  } else if (durationMs !== undefined && durationMs > 0) {
    action.expiry = timestamp + durationMs;
  }

  return validateAdaptationAction(action);
}

/**
 * Derive the plan-level `reEvaluateAt` from policy-declared timing only:
 * rule-level expiry, `durationMs`, `hysteresis.minDurationMs` and
 * `hysteresis.cooldownMs`, plus any action expiry already derived. The
 * earliest candidate wins; omitted when no policy declares timing.
 */
function deriveReEvaluateAt(entries, timestamp, actions) {
  const candidates = [];
  const pushEpoch = (value) => {
    if (isNonNegativeFinite(value)) {
      candidates.push(value);
    }
  };

  for (const entry of entries) {
    pushEpoch(entry?.expiry);
    if (isNonNegativeFinite(entry?.durationMs) && entry.durationMs > 0) {
      pushEpoch(timestamp + entry.durationMs);
    }
    if (isNonNegativeFinite(entry?.hysteresis?.minDurationMs) && entry.hysteresis.minDurationMs > 0) {
      pushEpoch(timestamp + entry.hysteresis.minDurationMs);
    }
    if (isNonNegativeFinite(entry?.hysteresis?.cooldownMs) && entry.hysteresis.cooldownMs > 0) {
      pushEpoch(timestamp + entry.hysteresis.cooldownMs);
    }
  }
  for (const action of actions) {
    pushEpoch(action.expiry);
  }

  return candidates.length > 0 ? Math.min(...candidates) : undefined;
}

/**
 * Overall confidence is the deterministic mean of the final action
 * confidences; with no actions it falls back to the reasoning-level
 * confidence (or 0 when absent).
 */
function deriveOverallConfidence(actions, reasoning) {
  if (actions.length > 0) {
    const total = actions.reduce((sum, action) => sum + action.confidence, 0);
    return clamp01(total / actions.length);
  }
  if (isFiniteInRange(reasoning?.confidence, 0, 1)) return reasoning.confidence;
  return 0;
}

/** Plan-level provenance = the reasoning sources (input signals). */
function planSources(reasoning) {
  const sources = [];
  const raw = Array.isArray(reasoning?.sources) ? reasoning.sources : [];
  for (const source of raw) {
    pushUnique(sources, source);
  }
  return sources;
}

/** Read-only snapshot of the UserState used for the decision. */
function snapshotUserState(userState) {
  if (
    userState === null ||
    userState === undefined ||
    typeof userState !== "object" ||
    Array.isArray(userState)
  ) {
    return {};
  }
  return { ...userState };
}

/**
 * @typedef {object} ReasoningResult
 * @property {string} situation - Situation id from the Cognitive Reasoning Core
 * @property {string} primaryNeed
 * @property {string[]} secondaryNeeds
 * @property {Array<object|string>} reasoning - Per-factor explanation
 * @property {number} confidence - 0..1
 * @property {string[]} sources - Input signals that informed the result
 */

/**
 * @typedef {object} TriggeredPolicyEntry
 * @property {string} ruleId
 * @property {number} [version] - PolicyRule version
 * @property {number} tier - PriorityTier that won
 * @property {number} priority - Within-tier numeric tie-break
 * @property {string} scope
 * @property {{ type: string, target: string, parameters?: object }} action
 * @property {Array<object>} [matchedTriggers]
 * @property {number} [confidence] - Rule-level confidence (when available)
 * @property {number} [durationMs]
 * @property {number} [expiry]
 * @property {{ minDurationMs?: number, cooldownMs?: number }} [hysteresis]
 * @property {string} [reversal]
 */

/**
 * @typedef {object} PlannerInput
 * @property {ReasoningResult} reasoning
 * @property {TriggeredPolicyEntry[]} triggeredRules - Precedence-ordered results
 *   from evaluatePolicies/selectRules
 * @property {import("../state/userStateModel.js").UserState} userState
 * @property {import("../../../support/framework/moduleContextAdapter.js").ModuleContext} [moduleContext]
 * @property {string} [decisionTraceId] - Provided trace id (else generated)
 * @property {number|(() => number)} [now] - Deterministic clock for the plan
 *   timestamp and derived expiry/reEvaluateAt (else Date.now())
 */

/**
 * Assemble a validated `AdaptationPlan` from reasoning + triggered policies.
 *
 * @param {PlannerInput} input
 * @returns {import("../../../support/schemas/supportSchemas.js").AdaptationPlanSchema}
 */
export function buildAdaptationPlan(input = {}) {
  const {
    reasoning = {},
    triggeredRules = [],
    userState,
    moduleContext,
    decisionTraceId,
    now,
  } = input;

  const timestamp =
    typeof now === "function"
      ? now()
      : isNonNegativeFinite(now)
        ? now
        : Date.now();
  const planId = createId("plan", timestamp);
  const traceId =
    typeof decisionTraceId === "string" && decisionTraceId.trim().length > 0
      ? decisionTraceId
      : createId("trace", timestamp);

  const entries = Array.isArray(triggeredRules) ? triggeredRules.filter(Boolean) : [];
  const actions = entries.map((entry) => buildAction(entry, reasoning, timestamp, moduleContext));

  const priorityOrder = actions.map((action) => action.actionId);
  const reEvaluateAt = deriveReEvaluateAt(entries, timestamp, actions);

  const plan = {
    planId,
    timestamp,
    decisionTraceId: traceId,
    situation: reasoning.situation,
    primaryNeed: reasoning.primaryNeed,
    secondaryNeeds: Array.isArray(reasoning.secondaryNeeds) ? reasoning.secondaryNeeds : [],
    reasoning: Array.isArray(reasoning.reasoning) ? reasoning.reasoning : [],
    actions,
    overallConfidence: deriveOverallConfidence(actions, reasoning),
    sources: planSources(reasoning),
    userStateReference: snapshotUserState(userState),
    priorityOrder,
  };
  if (reEvaluateAt !== undefined) {
    plan.reEvaluateAt = reEvaluateAt;
  }

  return validateAdaptationPlan(plan);
}
