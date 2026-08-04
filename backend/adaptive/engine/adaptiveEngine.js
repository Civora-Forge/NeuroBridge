/**
 * adaptiveEngine.js — Adaptive Engine runtime entry point (Phase 3)
 *
 * `decide(input)` wires the existing validated contracts into a single
 * decision cycle (spec §4):
 *
 *   COLLECT → REASON → POLICY APPLY → PRIORITY → CONFLICT → PREFERENCE →
 *   SAFETY → HYSTERESIS → PLAN → TRACE → RETURN
 *
 * This module never re-implements reasoning, policy evaluation, or plan
 * assembly. It composes the already-shipped components:
 *
 *   - buildUserState        (Role 2 user state model)
 *   - reasonAboutUserState  (Cognitive Reasoning Core)
 *   - evaluatePolicies      (Phase 1 policy evaluation + precedence order)
 *   - buildAdaptationPlan   (Phase 2 planner)
 *
 * Stage boundaries honored by Phase 3:
 *   - Priority/Conflict reuse Phase 1 ordering (evaluatePolicies) and the
 *     planner; no second conflict resolver is introduced.
 *   - Preference is a declared extension point (reads existing inputs only;
 *     no persistence).
 *   - Safety is a declared extension point (no safety logic is implemented
 *     here). A supplied `safety` function may ALLOW / MODIFY / BLOCK /
 *     ESCALATE each candidate entry; the production default reuses the
 *     existing `assessSupportSafety` primitive via the Safety stage and fails
 *     closed when the primitive is unavailable (D5).
 *   - Trace is a structural linkage: a DecisionTrace object is returned with
 *     the plan. NO persistence happens inside the engine; an optional
 *     `persistTrace` hook is provided for a later integration boundary.
 *
 * Determinism: identical inputs produce identical decisions except
 * generated IDs and timestamps. The engine never mutates UserState, module
 * state, or any input object.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { buildUserState } from "../state/userStateModel.js";
import { reasonAboutUserState } from "../reasoning/cognitiveReasoning.js";
import { evaluatePolicies, ADAPTATION_POLICIES } from "../reasoning/adaptationPolicy.js";
import { buildAdaptationPlan } from "../reasoning/planner.js";
import {
  validateAdaptiveEngineInput,
  validateAdaptationPlan,
  validateDecisionTrace,
  SafetyLevel,
  SafetyResultSchema,
} from "@/support/schemas/supportSchemas";
import { isNonNullObject } from "@/adaptive/context/contextSnapshot.js";
import { safetyGate } from "./safetyGate.js";
import { runHysteresisStage } from "./hysteresis.js";
import { resolveConflicts } from "./conflictResolution.js";

const DEFAULT_SAFETY_RESULT = {
  level: SafetyLevel.STANDARD,
  disposition: "ALLOW",
  reasons: [],
  guardrails: {},
};

const EMPTY_PREFERENCE_RESULT = {
  appliedRequests: [],
  honoredRestrictions: [],
  learnedSignalsUsed: [],
};

const DISPOSITION_SEVERITY = { ALLOW: 0, MODIFY: 1, BLOCK: 2, ESCALATE: 3 };

/**
 * Learned personalization dimensions (Tier 9). `role4Signals.strategyEffectiveness`
 * is a `Record<strategyId, 0..1>`; each entry is exposed to the existing policy
 * evaluator as a synthetic resolved-state dimension named
 * `strategyEffectiveness:<strategyId>`. Only Tier 9 policy rules are expected to
 * reference these dimensions, so learned signals can only bias selection inside
 * Tier 9 — the existing categorical precedence (lower tier number wins) keeps
 * every higher tier protected.
 */
const LEARNED_DIMENSION_PREFIX = "strategyEffectiveness:";

// ─────────────────────────────────────────────────────────────────
//  Small deterministic helpers
// ─────────────────────────────────────────────────────────────────

function isEffectivenessRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Derive the read-only resolved state handed to `evaluatePolicies`. When
 * learned personalization is supplied, the overlay adds `strategyEffectiveness:<id>`
 * dimensions without mutating the UserState (a new object is produced only in
 * that case). Without learned signals the original UserState reference is
 * returned, so existing decisions are byte-for-byte unchanged.
 */
function resolvePolicyState(userState, strategyEffectiveness) {
  if (!isEffectivenessRecord(strategyEffectiveness)) {
    return userState;
  }
  const learned = {};
  let hasLearned = false;
  for (const [strategyId, rawValue] of Object.entries(strategyEffectiveness)) {
    if (typeof strategyId !== "string" || strategyId.trim().length === 0) continue;
    // Only schema-valid effectiveness values (finite 0..1) become dimensions;
    // anything else is ignored so an out-of-range input cannot fabricate a
    // learned score at the policy boundary.
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
    if (rawValue < 0 || rawValue > 1) continue;
    learned[`${LEARNED_DIMENSION_PREFIX}${strategyId.trim()}`] = rawValue;
    hasLearned = true;
  }
  if (!hasLearned) {
    return userState;
  }
  return { ...userState, ...learned };
}

function isFiniteIn01(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function epochFromTimestamp(value) {
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
 * Normalize a safety-stage output into a complete SafetyResult. The default
 * (no safety function) is a full ALLOW. An extension returning garbage fails
 * loudly via schema validation rather than being silently ignored.
 */
function normalizeSafetyResult(value) {
  if (value === null || typeof value !== "object") {
    return { ...DEFAULT_SAFETY_RESULT };
  }
  return SafetyResultSchema.parse({ ...DEFAULT_SAFETY_RESULT, ...value });
}

/** Map a triggered-policy entry to the TriggeredRule trace shape. */
function toTriggeredRule(entry) {
  const rule = {
    ruleId: entry.ruleId,
    ruleVersion: entry.version ?? entry.ruleVersion ?? 1,
    scope: entry.scope,
    tier: entry.tier,
    matchedTriggers: Array.isArray(entry.matchedTriggers) ? entry.matchedTriggers : [],
  };
  if (isFiniteIn01(entry.confidence)) {
    rule.confidence = entry.confidence;
  }
  return rule;
}

// ─────────────────────────────────────────────────────────────────
//  Stage implementations (thin, compositional)
// ─────────────────────────────────────────────────────────────────

/**
 * Module-declared restricted dimensions are a hard boundary: the engine must
 * not touch them. Affected candidates are removed and recorded for the trace.
 */
function applyRestrictedDimensions(entries, moduleContext) {
  const restricted = Array.isArray(moduleContext?.restrictedDimensions)
    ? moduleContext.restrictedDimensions
    : [];
  if (restricted.length === 0) {
    return { kept: entries, rejected: [] };
  }
  const restrictedSet = new Set(restricted);
  const kept = [];
  const rejected = [];
  for (const entry of entries) {
    const target = entry.action?.target;
    if (target !== undefined && restrictedSet.has(target)) {
      rejected.push(entry);
    } else {
      kept.push(entry);
    }
  }
  return { kept, rejected };
}

/**
 * Preference stage (extension point). Without an injected function it is a
 * pass-through with an empty PreferenceResult. A provided function may return
 * `{ actions, result, overrides }`.
 */
function runPreferenceStage(entries, moduleContext, preferenceFn) {
  if (typeof preferenceFn !== "function") {
    return { entries, result: { ...EMPTY_PREFERENCE_RESULT }, overrides: [], dropped: [] };
  }
  const outcome = preferenceFn(entries, moduleContext) ?? {};
  const nextEntries = Array.isArray(outcome.actions) ? outcome.actions : entries;
  const dropped = entries.filter((entry) => !nextEntries.includes(entry));
  return {
    entries: nextEntries,
    result: { ...EMPTY_PREFERENCE_RESULT, ...(outcome.result ?? {}) },
    overrides: Array.isArray(outcome.overrides) ? outcome.overrides : [],
    dropped,
  };
}

/**
 * Safety stage (extension point). Default disposition is ALLOW for every
 * candidate. MODIFY merges guardrails into the candidate parameters; BLOCK
 * and ESCALATE remove the candidate. No safety logic is implemented here.
 */
function runSafetyStage(entries, moduleContext, safetyFn) {
  const kept = [];
  const blocked = [];
  const overrides = [];
  for (const entry of entries) {
    const raw = typeof safetyFn === "function" ? safetyFn(entry, moduleContext) : undefined;
    const safety = normalizeSafetyResult(raw);

    if (safety.disposition === "BLOCK" || safety.disposition === "ESCALATE") {
      blocked.push({ ...entry, _safety: safety });
      overrides.push({
        kind: "safety",
        applied: false,
        detail: `rule "${entry.ruleId}" ${safety.disposition}: ${
          safety.reasons.join(", ") || "action blocked by the safety stage"
        }`,
      });
      continue;
    }

    let next = entry;
    if (safety.disposition === "MODIFY") {
      next = {
        ...entry,
        action: {
          ...entry.action,
          parameters: { ...(entry.action?.parameters ?? {}), ...safety.guardrails },
        },
      };
      overrides.push({
        kind: "safety",
        applied: true,
        detail: `rule "${entry.ruleId}" MODIFY: ${
          safety.reasons.join(", ") || "safety guardrails applied"
        }`,
      });
    }
    next = { ...next, _safety: safety };
    kept.push(next);
  }
  return { kept, blocked, overrides };
}

/** Aggregate the strictest per-action safety outcome for the trace. */
function aggregateSafety(entries) {
  let aggregate = { ...DEFAULT_SAFETY_RESULT };
  let severity = DISPOSITION_SEVERITY[aggregate.disposition];
  for (const entry of entries) {
    const safety = entry._safety;
    if (!safety) continue;
    const current = DISPOSITION_SEVERITY[safety.disposition] ?? 0;
    if (current > severity) {
      severity = current;
      aggregate = safety;
    }
  }
  return aggregate;
}

// ─────────────────────────────────────────────────────────────────
//  Main entry point
// ─────────────────────────────────────────────────────────────────

/**
 * Run one adaptive decision cycle and return a validated plan plus its
 * structural DecisionTrace (no persistence).
 *
 * @param {import("../../../support/schemas/supportSchemas.js").AdaptiveEngineInputSchema} [input]
 *   contextSnapshot, userState (optional — built from the snapshot when
 *   absent), moduleContext (optional — a generic fallback is used), plus
 *   optional role4Signals / userPreferences / currentTask / currentGoal.
 * @param {object} [options]
 * @param {(entry: object, context: object|null) => object|null} [options.safety]
 *   Safety extension point. Defaults to the production safety gate (D5),
 *   which reuses `assessSupportSafety` and fails closed.
 * @param {(entries: object[], context: object|null) => { actions?: object[], result?: object, overrides?: object[] }} [options.preference]
 *   Preference extension point. Defaults to a pass-through.
 * @param {(trace: object) => void|Promise} [options.persistTrace]
 *   Trace persistence hook for a later integration boundary. Never awaited.
 * @param {string} [options.decisionTraceId]
 *   Optional trace id (else generated by the planner).
 * @param {number|(() => number)} [options.now]
 *   Deterministic clock for hysteresis state and the plan timestamp.
 * @param {string} [options.userId]
 *   Normalized Role 4 userId used to key per-user hysteresis state and
 *   recorded on the trace when present.
 * @returns {{ plan: import("../../../support/schemas/supportSchemas.js").AdaptationPlanSchema, trace: import("../../../support/schemas/supportSchemas.js").DecisionTraceSchema }}
 */
export function decide(input = {}, options = {}) {
  // ── 1 COLLECT (validate/normalize against the existing contract) ──
  const raw = isNonNullObject(input) ? input : {};
  const contextSnapshot = isNonNullObject(raw.contextSnapshot) ? raw.contextSnapshot : {};
  const moduleContext = isNonNullObject(raw.moduleContext) ? raw.moduleContext : null;

  const normalized = validateAdaptiveEngineInput({
    contextSnapshot,
    userState: isNonNullObject(raw.userState) ? raw.userState : buildUserState(contextSnapshot),
    role4Signals: isNonNullObject(raw.role4Signals) ? raw.role4Signals : undefined,
    userPreferences: isNonNullObject(raw.userPreferences) ? raw.userPreferences : undefined,
    moduleContext: moduleContext ?? { moduleId: "generic" },
    currentTask: isNonNullObject(raw.currentTask) ? raw.currentTask : undefined,
    currentGoal: isNonNullObject(raw.currentGoal) ? raw.currentGoal : undefined,
  });

  const userState = normalized.userState;
  const context = normalized.moduleContext;

  // Deterministic clock shared by the hysteresis stage and the planner.
  const now =
    typeof options.now === "function"
      ? options.now()
      : typeof options.now === "number" && Number.isFinite(options.now) && options.now >= 0
        ? options.now
        : Date.now();
  const userId =
    typeof options.userId === "string" && options.userId.trim().length > 0
      ? options.userId
      : undefined;

  // ── 2 REASON (existing Cognitive Reasoning Core) ──
  const reasoning = reasonAboutUserState(userState);

  // ── 3 POLICY APPLY (existing Phase 1 evaluator) ──
  const modulePolicies = Array.isArray(context?.modulePolicies) ? context.modulePolicies : [];
  const rules = [...ADAPTATION_POLICIES, ...modulePolicies];
  // Tier 9 only: learned personalization surfaces as derived resolved-state
  // dimensions; the existing evaluator and its precedence order are unchanged.
  const policyState = resolvePolicyState(
    userState,
    isEffectivenessRecord(normalized.role4Signals)
      ? normalized.role4Signals.strategyEffectiveness
      : undefined,
  );
  const { triggered } = evaluatePolicies(rules, policyState);

  // Hard module boundary: restricted dimensions are never adapted.
  const restricted = applyRestrictedDimensions(triggered, context);

  // ── 4 CONFLICT (D4) — per-target, highest-precedence candidate wins ──
  const conflict = resolveConflicts(restricted.kept);

  // ── 5 PREFERENCE (extension point) ──
  const preference = runPreferenceStage(conflict.kept, context, options.preference);

  // ── 6 SAFETY (production default reuses assessSupportSafety; DI preserved) ──
  const safety = runSafetyStage(preference.entries, context, options.safety ?? safetyGate);

  // ── 7 HYSTERESIS (D6) — per (user, module, target) state; safety first ──
  const hysteresis = runHysteresisStage(safety.kept, {
    now: () => now,
    reasoningConfidence: reasoning.confidence,
    userId,
    moduleId: context?.moduleId,
  });

  // ── 8 PLAN (existing Phase 2 planner) ──
  const traceId =
    typeof options.decisionTraceId === "string" && options.decisionTraceId.trim().length > 0
      ? options.decisionTraceId
      : undefined;

  let plan = buildAdaptationPlan({
    reasoning,
    triggeredRules: hysteresis.kept,
    userState,
    moduleContext: context,
    decisionTraceId: traceId,
    now: () => now,
  });

  // The hysteresis stage may schedule a re-evaluation (cooldown expiry /
  // min-duration end). Merge it with any planner-derived timer, earliest wins.
  if (hysteresis.nextReEvaluateAt !== undefined) {
    const merged =
      plan.reEvaluateAt === undefined
        ? hysteresis.nextReEvaluateAt
        : Math.min(plan.reEvaluateAt, hysteresis.nextReEvaluateAt);
    if (plan.reEvaluateAt !== merged) {
      plan = validateAdaptationPlan({ ...plan, reEvaluateAt: merged });
    }
  }

  // Attach per-action safety outcomes. The planner maps surviving entries to
  // actions 1:1 in order, so the zip below stays aligned.
  if (hysteresis.kept.some((entry) => entry._safety)) {
    const updatedActions = plan.actions.map((action, index) => {
      const entrySafety = hysteresis.kept[index]?._safety;
      return entrySafety ? { ...action, safety: entrySafety } : action;
    });
    plan = validateAdaptationPlan({ ...plan, actions: updatedActions });
  }

  // ── 9 TRACE (structural linkage only; no persistence) ──
  const rejectedEntries = [
    ...restricted.rejected,
    ...conflict.rejected,
    ...preference.dropped,
    ...safety.blocked,
    ...hysteresis.rejected,
  ];
  const overrides = [...preference.overrides, ...safety.overrides, ...hysteresis.overrides];

  // Spec §5 availability rules: the trace records which optional input
  // fragments were present at runtime (role4Signals / userPreferences).
  const sourceTags = new Set(plan.sources);
  if (normalized.role4Signals !== undefined) {
    sourceTags.add("role4_signals");
  }
  if (normalized.userPreferences !== undefined) {
    sourceTags.add("user_preferences");
  }
  if (policyState !== userState) {
    sourceTags.add("learned_personalization");
  }

  const trace = {
    decisionId: plan.decisionTraceId,
    timestamp: plan.timestamp,
    moduleId: context?.moduleId ?? "generic",
    inputRef: {
      snapshotAt: epochFromTimestamp(contextSnapshot.timestamp) ?? plan.timestamp,
    },
    situation: plan.situation,
    primaryNeed: plan.primaryNeed,
    reasoning: plan.reasoning,
    triggeredConditions: safety.kept.map(toTriggeredRule),
    rejectedConditions: rejectedEntries.map(toTriggeredRule),
    conflicts: conflict.conflicts,
    overrides,
    safetyResult: aggregateSafety([...safety.kept, ...safety.blocked]),
    preferenceResult: preference.result,
    policyIds: safety.kept.map((entry) => entry.ruleId),
    policyVersions: safety.kept.map((entry) => entry.version ?? entry.ruleVersion ?? 1),
    finalActions: plan.actions,
    confidence: plan.overallConfidence,
    sources: [...sourceTags],
  };
  if (typeof userState?.timestamp === "string") {
    trace.inputRef.userStateRef = userState.timestamp;
  }
  if (userId !== undefined) {
    trace.userId = userId;
  }
  if (plan.reEvaluateAt !== undefined) {
    trace.reEvaluateAt = plan.reEvaluateAt;
  }
  const validatedTrace = validateDecisionTrace(trace);

  // ── 8 TRACE PERSISTENCE HOOK (fire-and-forget; integration boundary) ──
  if (typeof options.persistTrace === "function") {
    const result = options.persistTrace(validatedTrace);
    if (result && typeof result.then === "function") {
      result.catch(() => {});
    }
  }

  return { plan, trace: validatedTrace };
}

/**
 * Object-form surface (`adaptiveEngine.decide`) mirroring the spec's
 * `engine.decide(input)` wording.
 */
export const adaptiveEngine = { decide };
