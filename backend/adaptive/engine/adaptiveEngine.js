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
 *   - Preference (D14) is a real stage (reads `userPreferences` only; no
 *     persistence). Requestable preferences become Tier 2/4 candidates, hard
 *     restrictions become Tier 3 filters; an injected `options.preference`
 *     function replaces the default.
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
import {
  evaluatePolicies,
  ADAPTATION_POLICIES,
  CONTEXTUAL_POLICIES,
  DEMO_NAVIGATION_POLICY,
  DEMO_NAVIGATION_SWITCHES,
} from "../reasoning/adaptationPolicy.js";
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
import { runHysteresisStage, stabilizeCandidates } from "./hysteresis.js";
import { resolveConflicts } from "./conflictResolution.js";
import { applyUserPreferences } from "./preferences.js";
import { recommendFocusConfiguration } from "../reasoning/focusConfiguration.js";
import { applyLearnedPreferences } from "./learning.js";
import {
  applyProfileConstraints,
  buildPreferenceEvidence,
  partitionInfluences,
} from "./personalization.js";

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

/** Confidence of the demo navigation dimension (above the unchanged 0.5 floor). */
const DEMO_NAVIGATION_CONFIDENCE = 0.6;

/**
 * DEMO ONLY: overlay the `demoNavigationBurst` dimension on the policy state.
 * Reads only the switch COUNT in the snapshot's app-level evidence view;
 * a missing count stays missing ("unknown", confidence 0).
 */
function withDemoNavigationDimension(state, contextSnapshot) {
  const count = contextSnapshot?.interactionEvidence?.recentNavigationSwitches?.count;
  const known = typeof count === "number" && Number.isFinite(count) && count >= 0;
  const value = !known ? "unknown" : count >= DEMO_NAVIGATION_SWITCHES ? "present" : "none";
  const dimension = {
    value,
    confidence: value === "present" ? DEMO_NAVIGATION_CONFIDENCE : 0,
    reasons: [known
      ? `DEMO: ${count} page switch(es) in the last 60 s (trigger at ${DEMO_NAVIGATION_SWITCHES})`
      : "DEMO: no navigation count available"],
    sources: ["interactionEvidence.recentNavigationSwitches"],
  };
  return {
    ...state,
    demoNavigationBurst: value,
    _dimensions: { ...(state?._dimensions ?? {}), demoNavigationBurst: dimension },
  };
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
 * Preference stage. Defaults to the D14 real implementation
 * (`applyUserPreferences`), which reads `context.userPreferences` and turns
 * requestable preferences into Tier 2/4 candidates and hard restrictions into
 * Tier 3 filters. An injected function overrides the default entirely and may
 * return `{ actions, result, overrides }`; `outcome.rejected` is optional and
 * is appended to the dropped entries.
 */
function runPreferenceStage(entries, context, preferenceFn) {
  const fn = typeof preferenceFn === "function" ? preferenceFn : applyUserPreferences;
  const outcome = fn(entries, context) ?? {};
  const nextEntries = Array.isArray(outcome.actions) ? outcome.actions : entries;
  const dropped = entries.filter((entry) => !nextEntries.includes(entry));
  const extraRejected = Array.isArray(outcome.rejected) ? outcome.rejected : [];
  for (const entry of extraRejected) {
    if (!dropped.includes(entry)) {
      dropped.push(entry);
    }
  }
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
 * @param {(entries: object[], context: object|null) => { actions?: object[], result?: object, overrides?: object[], rejected?: object[] }} [options.preference]
 *   Preference extension point. Defaults to the D14 real stage
 *   (`applyUserPreferences`), which reads `userPreferences` from the context
 *   (`{ moduleContext, userPreferences }`). A custom function replaces the
 *   default entirely.
 * @param {(trace: object) => void|Promise} [options.persistTrace]
 *   Trace persistence hook for a later integration boundary. Never awaited.
 * @param {string} [options.decisionTraceId]
 *   Optional trace id (else generated by the planner).
 * @param {number|(() => number)} [options.now]
 *   Deterministic clock for hysteresis state and the plan timestamp.
 * @param {string} [options.userId]
 *   Normalized Role 4 userId used to key per-user hysteresis state and
 *   recorded on the trace when present.
 * @param {object} [options.baseline]
 *   The user's shared behavioural baseline (src/adaptive/baseline). Lets the
 *   contextual inference read evidence relative to the user's own normal;
 *   without it, conservative population thresholds apply.
 * @param {boolean} [options.demoNavigationTrigger]
 *   DEMO ONLY. Evaluate the repeated-navigation demonstration rule
 *   (DEMO_NAVIGATION_POLICY). Never set outside demo mode.
 * @param {string} [options.stateScope]
 *   Optional decision-path namespace for hysteresis state (e.g. "module").
 *   Callers running an additional, independent decision path for the same
 *   user pass a scope so their temporal state is isolated from the app-level
 *   runtime. Omitted → the shared default slot (unchanged behaviour).
 * @param {Record<string, object>} [options.learnedPreferences]
 *   Learned preferences (src/adaptive/learning getLearnedPreferences) used as
 *   bounded supporting evidence; their influence is recorded in trace.learning.
 * @param {object} [options.personalization]
 *   Resolved persistent personalization profile (Task 5,
 *   src/adaptive/personalization resolveProfileView). Explicit preferred
 *   modes become bounded supporting evidence, explicitly avoided modes become
 *   constraints, presentation preferences shape UI parameters (calmer only),
 *   and promoted learned stances back-fill missing live feedback. Never
 *   touches safety or explicit tiers. Recorded in trace.personalization.
 * @returns {{ plan: import("../../../support/schemas/supportSchemas.js").AdaptationPlanSchema, trace: import("../../../support/schemas/supportSchemas.js").DecisionTraceSchema }}
 */
export function decide(input = {}, options = {}) {
  // ── 1 COLLECT (validate/normalize against the existing contract) ──
  const raw = isNonNullObject(input) ? input : {};
  const contextSnapshot = isNonNullObject(raw.contextSnapshot) ? raw.contextSnapshot : {};
  const moduleContext = isNonNullObject(raw.moduleContext) ? raw.moduleContext : null;

  const normalized = validateAdaptiveEngineInput({
    contextSnapshot,
    userState: isNonNullObject(raw.userState)
      ? raw.userState
      : buildUserState(contextSnapshot, {
          // Module-aware interpretation of behavioural evidence and the
          // user's own behavioural baseline (contextualInference.js).
          moduleContext,
          baseline: isNonNullObject(options.baseline) ? options.baseline : undefined,
        }),
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
  // Independent decision paths (app-level runtime vs module-level consumers)
  // keep separate temporal state so they never advance or reset each other's
  // confirmation windows / withdrawals from different snapshots.
  const stateScope =
    typeof options.stateScope === "string" && options.stateScope.trim().length > 0
      ? options.stateScope.trim()
      : undefined;

  // ── 2 REASON (existing Cognitive Reasoning Core) ──
  const reasoning = reasonAboutUserState(userState);

  // ── 3 POLICY APPLY (existing Phase 1 evaluator) ──
  const modulePolicies = Array.isArray(context?.modulePolicies) ? context.modulePolicies : [];
  // DEMO ONLY: the repeated-navigation rule exists only when the caller
  // explicitly asks for it (app-level runtime, demo flag on).
  const demoNavigation = options.demoNavigationTrigger === true;
  const rules = [
    ...ADAPTATION_POLICIES,
    ...CONTEXTUAL_POLICIES,
    ...(demoNavigation ? [DEMO_NAVIGATION_POLICY] : []),
    ...modulePolicies,
  ];
  // Tier 9 only: learned personalization surfaces as derived resolved-state
  // dimensions; the existing evaluator and its precedence order are unchanged.
  const learnedPolicyState = resolvePolicyState(
    userState,
    isEffectivenessRecord(normalized.role4Signals)
      ? normalized.role4Signals.strategyEffectiveness
      : undefined,
  );
  const policyState = demoNavigation
    ? withDemoNavigationDimension(learnedPolicyState, contextSnapshot)
    : learnedPolicyState;
  // Evidence-grounded evaluation: rules whose trigger values matched but whose
  // evidence was stale or too weak are returned as `suppressed` and recorded
  // in the trace; they never reach the plan.
  const evaluated = evaluatePolicies(rules, policyState);

  // ── 3a LEARNED PREFERENCES (Task 4) — bounded supporting evidence from the
  // user's explicit feedback history; current-state tiers only, never safety
  // or explicit preferences. No-op unless `options.learnedPreferences` given.
  // Task 5: the persistent profile contributes evidence by type — explicit
  // preferred modes outrank live feedback, which outranks promoted stances.
  const personalizationView = isNonNullObject(options.personalization) ? options.personalization : undefined;
  const preferenceEvidence = buildPreferenceEvidence(options.learnedPreferences, personalizationView);
  const learning = applyLearnedPreferences(
    { triggered: evaluated.triggered, suppressed: evaluated.suppressed ?? [] },
    preferenceEvidence.learned,
  );
  const influences = partitionInfluences(learning.influences, preferenceEvidence);
  const triggered = learning.triggered;
  const evidenceSuppressed = learning.suppressed;
  const focusRecommendation = recommendFocusConfiguration(normalized.role4Signals?.supportEvidence);
  const learnedFocusEntry = context?.moduleId === "support.focus_session" && focusRecommendation
    ? [{ ruleId: "role4.focus_configuration", version: 1, scope: "user", tier: 9, priority: 0, confidence: focusRecommendation.confidence, action: { type: "MODIFY", target: "PACING", parameters: { focusConfiguration: focusRecommendation } }, matchedTriggers: [], reversal: "auto" }]
    : [];

  // ── 3b TEMPORAL STABILITY (Task 2) — consult recent adaptation state before
  // precedence is applied: reinstate still-valid incumbents (maintained on
  // weaker evidence / held through brief contradiction), withdraw those whose
  // evidence is lost, and defer unconfirmed challengers to a supported mode.
  // Reinstated entries still pass restriction, conflict, preference and safety.
  const temporal = stabilizeCandidates(
    { triggered, suppressed: evidenceSuppressed, rules, userState: policyState },
    { now, userId, moduleId: context?.moduleId, reasoningConfidence: reasoning.confidence, stateScope },
  );
  const maintainedIds = new Set(temporal.maintainedIds);
  const reportedSuppressed = evidenceSuppressed.filter((entry) => !maintainedIds.has(entry.ruleId));

  // Hard module boundary: restricted dimensions are never adapted.
  const restricted = applyRestrictedDimensions([...temporal.entries, ...learnedFocusEntry], context);

  // ── 4 CONFLICT (D4) — per-target, highest-precedence candidate wins ──
  const conflict = resolveConflicts(restricted.kept);

  // ── 5 PREFERENCE (D14 — requestable preferences honored; learned = tier 9) ──
  const preference = runPreferenceStage(
    conflict.kept,
    { moduleContext: context, userPreferences: normalized.userPreferences },
    options.preference,
  );

  // ── 5a PERSONALIZATION PROFILE (Task 5) — explicitly avoided modes are
  // constraints; presentation preferences shape UI parameters (calmer only).
  // Runs before safety, so safety still has the final word.
  const profileStage = applyProfileConstraints(preference.entries, personalizationView);

  // ── 6 SAFETY (production default reuses assessSupportSafety; DI preserved) ──
  const safety = runSafetyStage(profileStage.kept, context, options.safety ?? safetyGate);

  // ── 7 HYSTERESIS (D6) — per (user, module, target) state; safety first ──
  // Why an active adaptation disappeared before the hysteresis stage (trace).
  const droppedBy = {};
  const markDropped = (list, stage) => {
    for (const entry of list) {
      if (entry?.ruleId && droppedBy[entry.ruleId] === undefined) droppedBy[entry.ruleId] = stage;
    }
  };
  markDropped(restricted.rejected, "a module-restricted dimension");
  markDropped(conflict.rejected, "conflict resolution (higher-precedence candidate)");
  markDropped(preference.dropped, "an explicit user preference");
  markDropped(profileStage.dropped, "an explicit personalization preference");
  markDropped(safety.blocked, "the safety stage");

  const hysteresis = runHysteresisStage(safety.kept, {
    now: () => now,
    reasoningConfidence: reasoning.confidence,
    userId,
    moduleId: context?.moduleId,
    stateScope,
    temporal,
    droppedBy,
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
    ...reportedSuppressed,
    ...restricted.rejected,
    ...conflict.rejected,
    ...preference.dropped,
    ...profileStage.dropped,
    ...safety.blocked,
    ...hysteresis.rejected,
  ];
  const evidenceOverrides = reportedSuppressed.map((entry) => ({
    kind: "evidence",
    applied: false,
    detail: `rule "${entry.ruleId}" not applied: ${entry.evidenceReason}${
      typeof entry.confidence === "number" ? ` (confidence ${entry.confidence})` : ""
    }`,
  }));
  const profileOverrides = profileStage.dropped.map((entry) => ({
    kind: "preference",
    applied: true,
    detail: `rule "${entry.ruleId}" not applied: support mode avoided in the personalization profile`,
  }));
  const overrides = [
    ...evidenceOverrides,
    ...preference.overrides,
    ...profileOverrides,
    ...safety.overrides,
    ...hysteresis.overrides,
  ];

  // Spec §5 availability rules: the trace records which optional input
  // fragments were present at runtime (role4Signals / userPreferences).
  const sourceTags = new Set(plan.sources);
  if (normalized.role4Signals !== undefined) {
    sourceTags.add("role4_signals");
  }
  if (normalized.userPreferences !== undefined) {
    sourceTags.add("user_preferences");
  }
  if (learnedPolicyState !== userState) {
    sourceTags.add("learned_personalization");
  }
  if (influences.learning.length > 0) {
    sourceTags.add("learned_preferences");
  }
  if (personalizationView !== undefined) {
    sourceTags.add("personalization_profile");
  }
  // Observable: every decision made with the demo trigger enabled says so.
  if (demoNavigation) {
    sourceTags.add("demo_navigation_trigger");
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
    learning: influences.learning,
  };
  if (personalizationView !== undefined) {
    trace.personalization = {
      profileRevision: Number.isInteger(personalizationView.revision) && personalizationView.revision >= 0
        ? personalizationView.revision
        : 0,
      applied: [...influences.applied, ...profileStage.applied],
    };
  }
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
