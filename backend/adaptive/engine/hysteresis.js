/**
 * hysteresis.js — Engine-level hysteresis mechanism (D6)
 *
 * Closes the Phase 3 deviation where hysteresis was carried only as policy
 * config (HysteresisSchema + planner `reEvaluateAt` propagation) with no
 * runtime state and no threshold enforcement.
 *
 * Mechanism (spec §2 D6 / §9):
 *   - Per `(userId, moduleId, target)` in-memory adaptation state:
 *     `{ activeSince, lastAppliedAt, lastDeactivatedAt, expiresAt,
 *        minDurationMs, cooldownMs, activationThreshold,
 *        deactivationThreshold, governingRuleId }`.
 *   - Thresholds come from the triggering `PolicyRule.hysteresis` ONLY. No
 *     disorder- or domain-specific defaults are hardcoded here.
 *   - Activate only when signal ≥ activationThreshold; deactivate only when
 *     signal ≤ deactivationThreshold AND minDurationMs has elapsed; a
 *     deactivated target cannot re-activate until cooldownMs elapses.
 *   - Re-evaluate only on a material state transition (new `decide()` call)
 *     or at the scheduled `reEvaluateAt` timer; no per-call oscillation.
 *   - Expiry of a reversible adaptation triggers deactivation + reversal
 *     intent (never a silent flip of preference state).
 *   - Safety outranks hysteresis: Tier 1 (SAFETY) entries and any entry the
 *     Safety stage already raised to ESCALATE are never gated by hysteresis.
 *   - Deterministic under an injected clock (`options.now`); the state store
 *     is in-memory only (lifecycle/limitations are explicit in §"Lifecycle").
 *
 * Lifecycle & limitations (explicit):
 *   - State is in-memory, per-process: it is lost on reload and not shared
 *     across tabs/instances. Persistence of adaptation state is an Open Item
 *     (§21 spec); the engine signals reversal intent via `DecisionTrace`
 *     (`overrides` kind `hysteresis` + `rejectedConditions`), and execution-
 *     layer applies the actual revert.
 *   - User identity for the key is `options.userId` when supplied, else the
 *     literal `"default"` (see decide()). Multi-user isolation therefore
 *     requires callers to pass a normalized userId.
 *   - The store is capped at MAX_ADAPTATION_STATES entries (oldest evicted)
 *     and stale entries (fully past their activity + cooldown horizon) are
 *     pruned on every run to bound memory.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { PriorityTier } from "@/support/schemas/supportSchemas";

export const MAX_ADAPTATION_STATES = 10000;

const states = new Map();
const lastTouched = new Map();

function isFiniteIn01(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isNonNegativeFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Stable per (user, module, target) identity. */
export function adaptationStateKey(userId, moduleId, target) {
  const user = typeof userId === "string" && userId.trim().length > 0 ? userId : "default";
  const module = typeof moduleId === "string" && moduleId.trim().length > 0 ? moduleId : "generic";
  const dim = typeof target === "string" && target.trim().length > 0 ? target : "unknown";
  return `${user}|${module}|${dim}`;
}

export function readAdaptationState(key) {
  return states.get(key);
}

export function writeAdaptationState(key, state) {
  states.set(key, state);
  lastTouched.set(key, state.lastAppliedAt ?? Date.now());
  if (states.size > MAX_ADAPTATION_STATES) {
    let oldestKey;
    let oldestValue = Infinity;
    for (const [candidateKey, touched] of lastTouched) {
      if (touched < oldestValue) {
        oldestValue = touched;
        oldestKey = candidateKey;
      }
    }
    if (oldestKey !== undefined) {
      states.delete(oldestKey);
      lastTouched.delete(oldestKey);
    }
  }
}

export function deleteAdaptationState(key) {
  states.delete(key);
  lastTouched.delete(key);
}

/** Clear adaptation state for a user, optionally restricted to a module. */
export function clearAdaptiveHysteresis(userId, moduleId) {
  const prefix = `${userId ?? "default"}|`;
  const module = typeof moduleId === "string" ? moduleId : null;
  for (const key of [...states.keys()]) {
    if (!key.startsWith(prefix)) continue;
    if (module !== null && !key.startsWith(`${prefix}${module}|`)) continue;
    deleteAdaptationState(key);
  }
}

/**
 * Idle horizon after which an untouched state is forgotten. Active states are
 * never pruned while they are still being applied (they used to be deleted
 * once `minDurationMs + cooldownMs` elapsed, which forced a sustained
 * adaptation to re-enter and flicker).
 */
export const ADAPTATION_IDLE_HORIZON_MS = 30 * 60 * 1000;

/** Remove states that are fully past their activity + cooldown horizon. */
export function pruneStaleAdaptationStates(now) {
  for (const key of [...states.keys()]) {
    const state = states.get(key);
    let horizon;
    if (state.activeSince != null) {
      horizon = (state.lastAppliedAt ?? state.activeSince) + ADAPTATION_IDLE_HORIZON_MS;
    } else {
      const anchor =
        state.lastDeactivatedAt ?? state.pendingSince ?? state.expiresAt ?? state.lastAppliedAt ?? now;
      horizon = anchor + (state.cooldownMs ?? 0) + (state.minDurationMs ?? 0);
    }
    if (now > horizon) {
      deleteAdaptationState(key);
    }
  }
}

/** Reset all adaptation state (test + reconfiguration boundary). */
export function resetAdaptiveHysteresis() {
  states.clear();
  lastTouched.clear();
}

export function adaptationStateCount() {
  return states.size;
}

/** Earliest expiry candidate across gated entries (policy-declared only). */
function earliestExpiry(gatedEntries, now) {
  let earliest = null;
  for (const entry of gatedEntries) {
    if (isNonNegativeFinite(entry.expiry)) {
      earliest = earliest === null ? entry.expiry : Math.min(earliest, entry.expiry);
    } else if (isNonNegativeFinite(entry.durationMs) && entry.durationMs > 0) {
      const candidate = now + entry.durationMs;
      earliest = earliest === null ? candidate : Math.min(earliest, candidate);
    }
  }
  return earliest;
}

// ─────────────────────────────────────────────────────────────────
//  Temporal stability (Task 2)
//
//  Hysteresis now spans decisions instead of treating each snapshot
//  independently:
//    - entry needs `activationThreshold` evidence that persists for
//      `confirmationMs` (or reaches `immediateActivationThreshold`);
//    - an active adaptation is maintained on weaker evidence (above
//      `deactivationThreshold`) and held through brief contradiction until
//      `minDurationMs` has elapsed;
//    - it is withdrawn at once when its evidence is lost/stale, when an
//      explicit preference or safety outcome removes it, or when it has been
//      maintained for `maxDurationMs` without fresh entry-level evidence;
//    - a competing current-state mode on the same target must itself be
//      confirmed before it replaces a still-supported incumbent.
//  Tier 1 SAFETY and explicit-tier (< CURRENT_STATE) entries are never gated.
// ─────────────────────────────────────────────────────────────────

/** Active adaptations are re-checked at least this often (stale evidence). */
export const ACTIVE_REVIEW_INTERVAL_MS = 30000;

/**
 * Key scope: generic (app-wide) policies keep their state across modules so
 * navigating does not reset a sustained adaptation; module policies stay
 * per module.
 */
function stateModuleFor(entry, moduleId) {
  return entry?.scope === "generic" ? "generic" : moduleId;
}

function keyFor(entry, userId, moduleId) {
  return adaptationStateKey(userId, stateModuleFor(entry, moduleId), entry?.action?.target ?? "unknown");
}

/** Signal strength for an entry: rule-declared → evidence → reasoning. */
function signalFor(entry, reasoningConfidence) {
  if (isFiniteIn01(entry?.confidence)) return entry.confidence;
  if (isFiniteIn01(entry?.evidenceConfidence)) return entry.evidenceConfidence;
  return isFiniteIn01(reasoningConfidence) ? reasoningConfidence : 0;
}

function isTemporallyGated(entry) {
  return eligibleForGating(entry) && (entry.tier ?? 0) >= PriorityTier.CURRENT_STATE;
}

function isMissing(value) {
  return value === undefined || value === null || value === "unknown" || value === "";
}

function readValue(state, dimension) {
  const value = state?.[dimension];
  if (value && typeof value === "object" && "value" in value) return value.value;
  return value;
}

/**
 * Why a previously active rule no longer matches: "lost" when any trigger
 * dimension has no current value (stale/missing evidence), otherwise
 * "contradicted" (fresh evidence now says something else).
 */
function classifyMiss(rule, userState) {
  const groups = Array.isArray(rule?.triggerGroups) ? rule.triggerGroups : [];
  for (const group of groups) {
    for (const trigger of group?.triggers ?? []) {
      if (isMissing(readValue(userState, trigger.dimension))) return "lost";
    }
  }
  return "contradicted";
}

function ruleEntry(rule, extra) {
  return {
    ruleId: rule.id,
    version: rule.version ?? 1,
    tier: rule.tier,
    priority: rule.priority ?? 0,
    scope: rule.scope,
    action: rule.action,
    matchedTriggers: [],
    hysteresis: rule.hysteresis,
    durationMs: rule.durationMs,
    expiry: rule.expiry,
    ...extra,
  };
}

function precedes(left, right) {
  if (left.tier !== right.tier) return (left.tier ?? 0) - (right.tier ?? 0) < 0;
  return (left.priority ?? 0) > (right.priority ?? 0);
}

/**
 * Pre-conflict temporal stage. Reads adaptation state only (no writes):
 * reinstates still-valid incumbents (maintained on weaker evidence, or held
 * through brief contradiction), withdraws incumbents whose evidence is lost,
 * and defers unconfirmed current-state challengers that would displace a
 * still-supported incumbent on the same target.
 *
 * @param {object} input
 * @param {object[]} input.triggered - evaluatePolicies().triggered
 * @param {object[]} [input.suppressed] - evaluatePolicies().suppressed
 * @param {object[]} [input.rules] - Rule definitions (for reinstatement)
 * @param {object} [input.userState] - Resolved state used for policy evaluation
 * @returns {{ entries: object[], maintainedIds: string[], deferred: object[],
 *   withdrawals: object[], overrides: object[] }}
 */
export function stabilizeCandidates(input = {}, options = {}) {
  const now = typeof options.now === "function" ? options.now() : isNonNegativeFinite(options.now) ? options.now : Date.now();
  const { userId, moduleId } = options;
  const triggered = Array.isArray(input.triggered) ? input.triggered : [];
  const suppressed = Array.isArray(input.suppressed) ? input.suppressed : [];
  const rulesById = new Map((input.rules ?? []).filter(Boolean).map((rule) => [rule.id, rule]));

  const entries = [...triggered];
  const maintainedIds = [];
  const deferred = [];
  const withdrawals = [];
  const overrides = [];

  // Active incumbents relevant to this decision (user + generic/module scope).
  const user = typeof userId === "string" && userId.trim().length > 0 ? userId : "default";
  const scopes = new Set([`${user}|generic|`, `${user}|${moduleId ?? "generic"}|`]);
  for (const [key, state] of states) {
    if (state?.activeSince == null) continue;
    if (![...scopes].some((prefix) => key.startsWith(prefix))) continue;
    const rule = rulesById.get(state.governingRuleId);
    if (!rule) continue;
    const target = key.slice(key.lastIndexOf("|") + 1);
    if (rule.action?.target !== target) continue;

    let incumbent = entries.find((entry) => entry.ruleId === rule.id);
    if (!incumbent) {
      const weak = suppressed.find((entry) => entry.ruleId === rule.id);
      const cfg = rule.hysteresis ?? {};
      const inDwell = now - state.activeSince < (cfg.minDurationMs ?? 0);
      if (weak && weak.evidenceReason === "stale_evidence") {
        withdrawals.push({ key, ruleId: rule.id, target, reason: "supporting evidence is stale" });
        continue;
      }
      if (weak && isFiniteIn01(weak.evidenceConfidence) && weak.evidenceConfidence > (cfg.deactivationThreshold ?? 0)) {
        incumbent = ruleEntry(rule, {
          matchedTriggers: weak.matchedTriggers ?? [],
          evidenceConfidence: weak.evidenceConfidence,
          _temporal: "maintained",
        });
      } else if (weak && inDwell) {
        incumbent = ruleEntry(rule, { matchedTriggers: weak.matchedTriggers ?? [], evidenceConfidence: weak.evidenceConfidence, _temporal: "held" });
      } else if (weak) {
        withdrawals.push({
          key, ruleId: rule.id, target,
          reason: `evidence (${weak.evidenceConfidence ?? 0}) fell to the maintenance threshold (${cfg.deactivationThreshold ?? 0})`,
        });
        continue;
      } else {
        const miss = classifyMiss(rule, input.userState);
        if (miss === "lost") {
          withdrawals.push({ key, ruleId: rule.id, target, reason: "supporting evidence is no longer available (stale or missing)" });
          continue;
        }
        if (!inDwell) {
          withdrawals.push({ key, ruleId: rule.id, target, reason: "current state no longer supports it (recovered after minimum duration)" });
          continue;
        }
        incumbent = ruleEntry(rule, { _temporal: "held" });
      }
      entries.push(incumbent);
      maintainedIds.push(rule.id);
    }

    // Defer unconfirmed current-state challengers that would displace it.
    for (const challenger of [...entries]) {
      if (challenger === incumbent || challenger.action?.target !== target) continue;
      if (!isTemporallyGated(challenger) || !precedes(challenger, incumbent)) continue;
      const cfg = challenger.hysteresis;
      const signal = signalFor(challenger, options.reasoningConfidence);
      const immediate = isFiniteIn01(cfg.immediateActivationThreshold) && signal >= cfg.immediateActivationThreshold;
      const confirmed =
        !(cfg.confirmationMs > 0) ||
        (state.challengerRuleId === challenger.ruleId && now - state.challengerSince >= cfg.confirmationMs);
      if (immediate || confirmed) continue;
      entries.splice(entries.indexOf(challenger), 1);
      deferred.push({ key, entry: { ...challenger, _hysteresisReason: `deferred: "${incumbent.ruleId}" remains supported; "${challenger.ruleId}" awaits confirmation` } });
      overrides.push({
        kind: "hysteresis",
        applied: false,
        detail: `deferred "${challenger.ruleId}" on ${target}: incumbent "${incumbent.ruleId}" remains supported; challenger must persist ${cfg.confirmationMs}ms`,
      });
    }
  }

  return { entries, maintainedIds, deferred, withdrawals, overrides };
}

/**
 * Decide the hysteresis action for one target. Pure and deterministic.
 *
 * @returns {{ action: "activate"|"sustain"|"deactivate"|"wait_cooldown"|"wait_threshold"|"wait_confirmation",
 *             reason?: string, nextReEvaluateAt?: number }}
 */
function decideHysteresis({ state, cfg, signal, now, governing }) {
  const temporal = governing?._temporal;
  const sameRule = !state?.governingRuleId || state.governingRuleId === governing?.ruleId;
  if (state && state.activeSince != null && sameRule) {
    const expiresAt =
      state.expiresAt != null ? state.expiresAt : now + (cfg.minDurationMs ?? 0);
    if (state.expiresAt != null && now >= state.expiresAt) {
      return {
        action: "deactivate",
        reason: "expired (expiry reached); a reversible adaptation must be reverted, never silently flipped",
        nextReEvaluateAt: undefined,
      };
    }
    const maxMs = cfg.maxDurationMs;
    if (temporal !== undefined && isNonNegativeFinite(maxMs) && now - (state.lastConfirmedAt ?? state.activeSince) >= maxMs) {
      return {
        action: "deactivate",
        reason: `maintenance limit (${maxMs}ms) reached without fresh entry-level evidence`,
      };
    }
    const durationElapsed = now - state.activeSince >= (cfg.minDurationMs ?? 0);
    if (temporal !== "held" && durationElapsed && signal <= (cfg.deactivationThreshold ?? 0)) {
      return {
        action: "deactivate",
        reason: `signal (${signal}) ≤ deactivationThreshold (${cfg.deactivationThreshold}) after min duration; a reversible adaptation must be reverted`,
        nextReEvaluateAt: undefined,
      };
    }
    return { action: "sustain", nextReEvaluateAt: Math.min(expiresAt, now + ACTIVE_REVIEW_INTERVAL_MS) };
  }

  // Switching modes on an already-adapted target is a hand-over, not a new
  // entry: it is allowed once the challenger survived the pre-conflict stage.
  const handover = state && state.activeSince != null && !sameRule;

  const cooldownUntil =
    !handover && state && state.lastDeactivatedAt != null &&
    (state.lastWithdrawnRuleId === undefined || state.lastWithdrawnRuleId === governing?.ruleId)
      ? state.lastDeactivatedAt + (cfg.cooldownMs ?? 0)
      : null;
  if (cooldownUntil !== null && now < cooldownUntil) {
    return { action: "wait_cooldown", nextReEvaluateAt: cooldownUntil };
  }
  if (signal >= (cfg.activationThreshold ?? 0)) {
    const immediate =
      handover ||
      !(cfg.confirmationMs > 0) ||
      (isFiniteIn01(cfg.immediateActivationThreshold) && signal >= cfg.immediateActivationThreshold);
    const pendingSince = state?.pendingRuleId === governing?.ruleId ? state.pendingSince : null;
    if (immediate || (pendingSince != null && now - pendingSince >= cfg.confirmationMs)) {
      return {
        action: "activate",
        handover,
        reason: handover
          ? `changed from "${state.governingRuleId}"`
          : immediate
            ? `entered (signal ${signal} ≥ ${cfg.confirmationMs > 0 ? `immediate threshold ${cfg.immediateActivationThreshold}` : `activationThreshold ${cfg.activationThreshold ?? 0}`})`
            : `entered (signal ${signal} ≥ activationThreshold ${cfg.activationThreshold ?? 0}, persisted ${now - pendingSince}ms)`,
        nextReEvaluateAt: now + (cfg.minDurationMs ?? 0),
      };
    }
    const since = pendingSince ?? now;
    return {
      action: "wait_confirmation",
      pendingSince: since,
      reason: `awaiting confirmation: signal ${signal} must persist ${cfg.confirmationMs}ms (transient signals do not change the UI)`,
      nextReEvaluateAt: since + cfg.confirmationMs,
    };
  }
  return {
    action: "wait_threshold",
    reason: `signal (${signal}) below activationThreshold (${cfg.activationThreshold ?? 0}); no timer, waits for a material state transition`,
    nextReEvaluateAt: undefined,
  };
}

/**
 * Entries eligible for hysteresis gating. Tier 1 SAFETY rules and anything
 * the Safety stage already escalated are never gated (safety > hysteresis).
 */
function eligibleForGating(entry) {
  if (entry?.tier === PriorityTier.SAFETY) return false;
  if (entry?._safety?.disposition === "ESCALATE") return false;
  return Boolean(entry?.hysteresis);
}

function pushTimer(timers, value) {
  if (isNonNegativeFinite(value)) {
    timers.push(value);
  }
}

function rejectAll(gated, reason, rejected, overrides) {
  for (const entry of gated) {
    rejected.push({ ...entry, _hysteresisReason: reason });
  }
  overrides.push({
    kind: "hysteresis",
    applied: false,
    detail: reason,
  });
}

function deactivateState(key, state, now, reason, overrides, ruleId, target) {
  writeAdaptationState(key, {
    ...state,
    activeSince: null,
    lastAppliedAt: now,
    lastDeactivatedAt: now,
    lastWithdrawnRuleId: ruleId ?? state.governingRuleId,
    challengerRuleId: undefined,
    challengerSince: undefined,
    lastTransition: "withdrawn",
  });
  overrides.push({
    kind: "hysteresis",
    applied: false,
    detail: `withdrawn "${ruleId ?? state.governingRuleId}" on ${target}: ${reason}`,
  });
}

/**
 * Hysteresis stage: gate safety-surviving candidates by per-target adaptation
 * state. Runs AFTER the Safety stage and BEFORE planning (spec §4 order).
 *
 * @param {Array<object>} entries - Safety-stage survivors.
 * @param {object} [options]
 * @param {number|(() => number)} [options.now] - Deterministic clock.
 * @param {number} [options.reasoningConfidence] - Reasoning-level confidence,
 *   used as the signal fallback when the rule carries none.
 * @param {string} [options.userId] - Normalized userId for per-user state.
 * @param {string} [options.moduleId] - ModuleContext.moduleId.
 * @param {object} [options.temporal] - stabilizeCandidates() output.
 * @param {Record<string,string>} [options.droppedBy] - ruleId → stage that
 *   removed it (restriction / preference / safety / conflict), used to
 *   explain withdrawals of active adaptations.
 * @returns {{ kept: object[], rejected: object[], overrides: object[], nextReEvaluateAt?: number }}
 */
export function runHysteresisStage(entries, options = {}) {
  const now =
    typeof options.now === "function"
      ? options.now()
      : isNonNegativeFinite(options.now)
        ? options.now
        : Date.now();
  const userId = options.userId;
  const moduleId = options.moduleId;
  const reasoningConfidence = options.reasoningConfidence;
  const temporal = options.temporal ?? {};
  const droppedBy = options.droppedBy ?? {};

  pruneStaleAdaptationStates(now);

  const kept = [];
  const rejected = [];
  const overrides = [...(temporal.overrides ?? [])];
  const timers = [];
  const touchedKeys = new Set();

  // Record challengers deferred by the pre-conflict stage (confirmation clock).
  for (const { key, entry } of temporal.deferred ?? []) {
    const state = readAdaptationState(key);
    if (!state) continue;
    const since = state.challengerRuleId === entry.ruleId ? state.challengerSince : now;
    writeAdaptationState(key, { ...state, challengerRuleId: entry.ruleId, challengerSince: since });
    rejected.push(entry);
    pushTimer(timers, since + (entry.hysteresis?.confirmationMs ?? 0));
  }

  const groups = new Map();
  for (const entry of entries) {
    const target = entry?.action?.target ?? "unknown";
    if (!groups.has(target)) groups.set(target, []);
    groups.get(target).push(entry);
  }

  for (const [target, group] of groups) {
    const gated = group.filter(eligibleForGating);
    const plain = group.filter((entry) => !eligibleForGating(entry));
    kept.push(...plain);

    if (gated.length === 0) {
      continue;
    }

    const governing = gated[0];
    const cfg = governing.hysteresis;
    const signal = signalFor(governing, reasoningConfidence);
    const key = keyFor(governing, userId, moduleId);
    touchedKeys.add(key);
    const state = readAdaptationState(key);
    const decision = decideHysteresis({ state, cfg, signal, now, governing });

    switch (decision.action) {
      case "activate": {
        const nextState = {
          ...(state ?? {}),
          activeSince: now,
          lastAppliedAt: now,
          lastConfirmedAt: now,
          lastDeactivatedAt: null,
          expiresAt: earliestExpiry(gated, now),
          minDurationMs: cfg.minDurationMs ?? 0,
          cooldownMs: cfg.cooldownMs ?? 0,
          activationThreshold: cfg.activationThreshold ?? 0,
          deactivationThreshold: cfg.deactivationThreshold ?? 0,
          maxDurationMs: cfg.maxDurationMs,
          governingRuleId: governing.ruleId,
          lastSignal: signal,
          pendingRuleId: undefined,
          pendingSince: undefined,
          challengerRuleId: undefined,
          challengerSince: undefined,
          lastTransition: decision.handover ? "changed" : "entered",
        };
        writeAdaptationState(key, nextState);
        kept.push(...gated);
        overrides.push({
          kind: "hysteresis",
          applied: true,
          detail: decision.handover
            ? `changed ${target}: "${state.governingRuleId}" → "${governing.ruleId}" (signal ${signal})`
            : `activated "${governing.ruleId}" on ${target} (signal ${signal} ≥ activationThreshold ${nextState.activationThreshold}); ${decision.reason}`,
        });
        pushTimer(timers, decision.nextReEvaluateAt);
        break;
      }
      case "sustain": {
        const mergedExpiry = earliestExpiry(gated, now);
        const entryLevel = governing._temporal === undefined && signal >= (cfg.activationThreshold ?? 0);
        const nextState = {
          ...state,
          lastAppliedAt: now,
          lastSignal: signal,
          lastConfirmedAt: entryLevel ? now : state.lastConfirmedAt ?? state.activeSince,
          challengerRuleId: temporal.deferred?.some((d) => d.key === key) ? state.challengerRuleId : undefined,
          challengerSince: temporal.deferred?.some((d) => d.key === key) ? state.challengerSince : undefined,
          lastTransition: "maintained",
          expiresAt:
            mergedExpiry === null
              ? state.expiresAt
              : state.expiresAt === null
                ? mergedExpiry
                : Math.min(state.expiresAt, mergedExpiry),
        };
        writeAdaptationState(key, nextState);
        kept.push(...gated);
        const why =
          governing._temporal === "held"
            ? "held through brief contradiction until the minimum duration elapses"
            : governing._temporal === "maintained"
              ? `maintained on weaker evidence (signal ${signal} > deactivationThreshold ${cfg.deactivationThreshold ?? 0})`
              : "sustained (within the hysteresis band)";
        overrides.push({
          kind: "hysteresis",
          applied: true,
          detail: `"${governing.ruleId}" on ${target} ${why}`,
        });
        pushTimer(timers, decision.nextReEvaluateAt);
        if (isNonNegativeFinite(cfg.maxDurationMs)) {
          pushTimer(timers, (nextState.lastConfirmedAt ?? now) + cfg.maxDurationMs);
        }
        if (governing._temporal === "held") {
          pushTimer(timers, state.activeSince + (cfg.minDurationMs ?? 0));
        }
        break;
      }
      case "deactivate": {
        deactivateState(key, state, now, decision.reason ?? "deactivated by hysteresis", overrides, governing.ruleId, target);
        for (const entry of gated) {
          rejected.push({ ...entry, _hysteresisReason: decision.reason });
        }
        break;
      }
      case "wait_confirmation": {
        writeAdaptationState(key, {
          ...(state ?? {}),
          activeSince: state?.activeSince ?? null,
          lastAppliedAt: state?.lastAppliedAt ?? now,
          pendingRuleId: governing.ruleId,
          pendingSince: decision.pendingSince,
          minDurationMs: state?.minDurationMs ?? cfg.minDurationMs ?? 0,
          cooldownMs: state?.cooldownMs ?? cfg.cooldownMs ?? 0,
        });
        rejectAll(gated, `"${governing.ruleId}" ${decision.reason}`, rejected, overrides);
        pushTimer(timers, decision.nextReEvaluateAt);
        break;
      }
      case "wait_cooldown": {
        rejectAll(
          gated,
          `cooldown active until ${decision.nextReEvaluateAt}; re-evaluate at that timer`,
          rejected,
          overrides,
        );
        pushTimer(timers, decision.nextReEvaluateAt);
        break;
      }
      case "wait_threshold": {
        rejectAll(
          gated,
          decision.reason ?? "below activation threshold; no timer set",
          rejected,
          overrides,
        );
        break;
      }
      default:
        break;
    }
  }

  // Reconcile: withdrawals decided pre-conflict, active adaptations removed
  // by a later stage (explicit preference / restriction / safety / conflict),
  // and transient pending entries that did not persist.
  const withdrawn = new Set();
  for (const { key, ruleId, target, reason } of temporal.withdrawals ?? []) {
    const state = readAdaptationState(key);
    if (!state) continue;
    if (touchedKeys.has(key)) {
      // The target was handed over to another mode in this decision.
      overrides.push({ kind: "hysteresis", applied: false, detail: `withdrawn "${ruleId}" on ${target}: ${reason}` });
      continue;
    }
    if (state.activeSince == null) continue;
    deactivateState(key, state, now, reason, overrides, ruleId, target);
    withdrawn.add(key);
  }
  const keptIds = new Set(kept.map((entry) => entry.ruleId));
  const user = typeof userId === "string" && userId.trim().length > 0 ? userId : "default";
  const prefixes = [`${user}|generic|`, `${user}|${moduleId ?? "generic"}|`];
  for (const [key, state] of [...states]) {
    if (!prefixes.some((prefix) => key.startsWith(prefix)) || withdrawn.has(key)) continue;
    const target = key.slice(key.lastIndexOf("|") + 1);
    if (state.activeSince != null && !touchedKeys.has(key) && !keptIds.has(state.governingRuleId)) {
      const stage = droppedBy[state.governingRuleId];
      if (stage) {
        deactivateState(key, state, now, `removed by ${stage}`, overrides, state.governingRuleId, target);
      }
    } else if (state.activeSince == null && state.pendingRuleId && !touchedKeys.has(key)) {
      writeAdaptationState(key, { ...state, pendingRuleId: undefined, pendingSince: undefined, lastAppliedAt: now });
      overrides.push({
        kind: "hysteresis",
        applied: false,
        detail: `discarded transient "${state.pendingRuleId}" on ${target}: signal did not persist`,
      });
    }
  }

  const nextReEvaluateAt = timers.length > 0 ? Math.min(...timers) : undefined;
  return { kept, rejected, overrides, nextReEvaluateAt };
}
