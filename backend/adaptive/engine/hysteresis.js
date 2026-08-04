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

/** Remove states that are fully past their activity + cooldown horizon. */
export function pruneStaleAdaptationStates(now) {
  for (const key of [...states.keys()]) {
    const state = states.get(key);
    const anchor =
      state.expiresAt ?? state.activeSince ?? state.lastDeactivatedAt ?? now;
    const horizon = anchor + (state.cooldownMs ?? 0) + (state.minDurationMs ?? 0);
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

/**
 * Decide the hysteresis action for one target. Pure and deterministic.
 *
 * @returns {{ action: "activate"|"sustain"|"deactivate"|"wait_cooldown"|"wait_threshold",
 *             reason?: string, nextReEvaluateAt?: number }}
 */
function decideHysteresis({ state, cfg, signal, now }) {
  if (state && state.activeSince != null) {
    const expiresAt =
      state.expiresAt != null ? state.expiresAt : now + (cfg.minDurationMs ?? 0);
    if (state.expiresAt != null && now >= state.expiresAt) {
      return {
        action: "deactivate",
        reason: "expired (expiry reached); a reversible adaptation must be reverted, never silently flipped",
        nextReEvaluateAt: undefined,
      };
    }
    const durationElapsed = now - state.activeSince >= (cfg.minDurationMs ?? 0);
    if (durationElapsed && signal <= (cfg.deactivationThreshold ?? 0)) {
      return {
        action: "deactivate",
        reason: `signal (${signal}) ≤ deactivationThreshold (${cfg.deactivationThreshold}) after min duration; a reversible adaptation must be reverted`,
        nextReEvaluateAt: undefined,
      };
    }
    return { action: "sustain", nextReEvaluateAt: expiresAt };
  }

  const cooldownUntil =
    state && state.lastDeactivatedAt != null
      ? state.lastDeactivatedAt + (cfg.cooldownMs ?? 0)
      : null;
  if (cooldownUntil !== null && now < cooldownUntil) {
    return { action: "wait_cooldown", nextReEvaluateAt: cooldownUntil };
  }
  if (signal >= (cfg.activationThreshold ?? 0)) {
    return {
      action: "activate",
      nextReEvaluateAt: now + (cfg.minDurationMs ?? 0),
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

  pruneStaleAdaptationStates(now);

  const kept = [];
  const rejected = [];
  const overrides = [];
  const timers = [];

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
    const signal = isFiniteIn01(governing.confidence)
      ? governing.confidence
      : isFiniteIn01(reasoningConfidence)
        ? reasoningConfidence
        : 0;
    const key = adaptationStateKey(userId, moduleId, target);
    const state = readAdaptationState(key);
    const decision = decideHysteresis({ state, cfg, signal, now });

    switch (decision.action) {
      case "activate": {
        const nextState = {
          activeSince: now,
          lastAppliedAt: now,
          lastDeactivatedAt: null,
          expiresAt: earliestExpiry(gated, now),
          minDurationMs: cfg.minDurationMs ?? 0,
          cooldownMs: cfg.cooldownMs ?? 0,
          activationThreshold: cfg.activationThreshold ?? 0,
          deactivationThreshold: cfg.deactivationThreshold ?? 0,
          governingRuleId: governing.ruleId,
        };
        writeAdaptationState(key, nextState);
        kept.push(...gated);
        overrides.push({
          kind: "hysteresis",
          applied: true,
          detail: `activated (signal ${signal} ≥ activationThreshold ${nextState.activationThreshold})`,
        });
        pushTimer(timers, decision.nextReEvaluateAt);
        break;
      }
      case "sustain": {
        const mergedExpiry = earliestExpiry(gated, now);
        const nextState = {
          ...state,
          lastAppliedAt: now,
          expiresAt:
            mergedExpiry === null
              ? state.expiresAt
              : state.expiresAt === null
                ? mergedExpiry
                : Math.min(state.expiresAt, mergedExpiry),
        };
        writeAdaptationState(key, nextState);
        kept.push(...gated);
        overrides.push({
          kind: "hysteresis",
          applied: true,
          detail: "sustained (within the hysteresis band)",
        });
        pushTimer(timers, decision.nextReEvaluateAt);
        break;
      }
      case "deactivate": {
        writeAdaptationState(key, {
          ...state,
          activeSince: null,
          lastAppliedAt: now,
          lastDeactivatedAt: now,
        });
        rejectAll(gated, decision.reason ?? "deactivated by hysteresis", rejected, overrides);
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

  const nextReEvaluateAt = timers.length > 0 ? Math.min(...timers) : undefined;
  return { kept, rejected, overrides, nextReEvaluateAt };
}
