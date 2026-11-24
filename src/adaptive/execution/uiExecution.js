/**
 * uiExecution.js — Production adaptive execution layer (Task 3)
 *
 * The single place where an Adaptive Engine plan becomes UI behaviour.
 * `resolvePlanExecution(plan, context)` is pure and deterministic: it decides,
 * per action, whether it is APPLIED, MODIFIED, DEFERRED, REJECTED or DISMISSED
 * and returns the effective plan that consumers (AdaptiveUIRuntime, module
 * adaptation) may act on. Guardrails, in precedence order:
 *
 *   1. Runtime / execution flags — UI actions apply only when the
 *      `uiExecution` flag is ON (non-UI actions are module-owned and gated by
 *      the runtime flag upstream).
 *   2. Safety outcomes — an action the safety stage BLOCKed / ESCALATEd is
 *      never applied, and when the decision's aggregate safety result is
 *      BLOCK / ESCALATE no ordinary (non-Tier-1) adaptation is applied.
 *   3. User consent — a `requireConfirmation` guardrail defers the action
 *      until the user explicitly accepts it; a decline is honoured
 *      (DISMISSED) and persists for the session.
 *   4. Safety modifications — on UI actions, `reducedIntensity` keeps only
 *      protective flags (reduced motion / colour) and drops layout-changing
 *      mode switches. Non-UI (module-owned) actions keep their parameters.
 *
 * A small session store keeps consent decisions and recommendation dismissals
 * stable across unrelated state changes (and across remounts, via
 * sessionStorage when available). An execution ledger records each effective
 * change with a reason and is idempotent: re-committing an unchanged effective
 * plan records nothing.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { AdaptationDimension, PriorityTier } from "@/support/schemas/supportSchemas";
import { adaptUIAction } from "@/adaptive/ui/uiAdapter";
import { isUIExecutionEnabled } from "@backend/adaptive/engine/featureFlags";

export const PlanExecutionStatus = Object.freeze({
  APPLIED: "applied",
  MODIFIED: "modified",
  DEFERRED: "deferred",
  REJECTED: "rejected",
  DISMISSED: "dismissed",
  IDLE: "idle",
});

/** How long a declined adaptation / dismissed recommendation stays suppressed. */
export const DISMISSAL_TTL_MS = 30 * 60 * 1000;

const STORAGE_KEY = "neurobridge.adaptive.execution.v1";
const BLOCKING_DISPOSITIONS = new Set(["BLOCK", "ESCALATE"]);
/** Parameters that only protect (never re-layout) — kept under reducedIntensity. */
const PROTECTIVE_PARAMETERS = ["reduceMotion", "reduceAnimations", "reduceColorIntensity"];
/** Guardrail keys the safety stage merges into parameters (not UI content). */
const GUARDRAIL_PARAMETERS = new Set(["requireConfirmation", "reducedIntensity"]);

// ─────────────────────────────────────────────────────────────────
//  Stable identities
// ─────────────────────────────────────────────────────────────────

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function contentParameters(parameters) {
  const out = {};
  for (const [key, value] of Object.entries(parameters ?? {})) {
    if (!GUARDRAIL_PARAMETERS.has(key)) out[key] = value;
  }
  return out;
}

function ruleIdOf(action) {
  const evidence = Array.isArray(action?.evidence) ? action.evidence : [];
  const policy = evidence.find((entry) => typeof entry === "string" && entry.startsWith("policy:"));
  if (policy) return policy.slice("policy:".length).replace(/@v\d+$/, "");
  const match = typeof action?.reason === "string" ? action.reason.match(/Policy "([^"]+)"/) : null;
  return match ? match[1] : action?.actionId ?? "unknown";
}

/**
 * Identity of an adaptation that is stable across decisions (action ids and
 * timestamps change on every decide()); used to key consent decisions.
 */
export function adaptationKey(action) {
  return `${action?.target ?? "unknown"}:${ruleIdOf(action)}:${stableStringify(contentParameters(action?.parameters))}`;
}

/**
 * Content signature of a plan: ignores generated ids, timestamps and
 * confidence jitter so an unchanged effective plan compares equal.
 */
export function planSignature(plan) {
  if (!plan || !Array.isArray(plan.actions)) return "none";
  return stableStringify({
    situation: plan.situation ?? null,
    primaryNeed: plan.primaryNeed ?? null,
    actions: plan.actions.map((action) => ({
      key: adaptationKey(action),
      type: action.type,
      tier: action.tier,
      reason: action.reason ?? null,
      guardrails: {
        requireConfirmation: action.parameters?.requireConfirmation === true,
        reducedIntensity: action.parameters?.reducedIntensity === true,
      },
      safety: action.safety?.disposition ?? null,
    })),
  });
}

// ─────────────────────────────────────────────────────────────────
//  Session store: consent decisions + recommendation dismissals
// ─────────────────────────────────────────────────────────────────

let store = loadStore();
let version = 0;
const listeners = new Set();

/** Bound on stored consent decisions / dismissals (Task 6). */
export const MAX_STORED_DECISIONS = 200;

function emptyStore(owner = null) {
  return { owner, consent: {}, dismissed: {} };
}

function plainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** Drop expired / malformed entries and keep the newest MAX_STORED_DECISIONS. */
function pruneEntries(entries, now, keep) {
  const live = Object.entries(plainRecord(entries)).filter(
    ([, entry]) => entry && typeof entry.at === "number" && Number.isFinite(entry.at) && keep(entry, now),
  );
  live.sort((left, right) => right[1].at - left[1].at);
  return Object.fromEntries(live.slice(0, MAX_STORED_DECISIONS));
}

function pruneStore(current, now = Date.now()) {
  return {
    owner: typeof current.owner === "string" ? current.owner : null,
    // Grants last for the session; declines and dismissals expire.
    consent: pruneEntries(current.consent, now, (entry, at) =>
      entry.decision === "granted" || (entry.decision === "declined" && at - entry.at < DISMISSAL_TTL_MS),
    ),
    dismissed: pruneEntries(current.dismissed, now, (entry, at) => at - entry.at < DISMISSAL_TTL_MS),
  };
}

function safeSession() {
  try {
    return typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function loadStore() {
  try {
    const raw = safeSession()?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return pruneStore(parsed);
    }
  } catch {
    // Storage unavailable or corrupt: fall back to an in-memory session store.
  }
  return emptyStore();
}

function persist() {
  store = pruneStore(store);
  try {
    safeSession()?.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best-effort persistence only.
  }
}

function changed() {
  version += 1;
  persist();
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A failing subscriber must not break execution.
    }
  }
}

function isLive(entry, now) {
  return entry && typeof entry.at === "number" && now - entry.at < DISMISSAL_TTL_MS;
}

export function subscribeExecutionStore(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getExecutionStoreVersion() {
  return version;
}

/** User accepted an adaptation that required confirmation. */
export function grantConsent(key, now = Date.now()) {
  store = { ...store, consent: { ...store.consent, [key]: { decision: "granted", at: now } } };
  changed();
}

/** User declined an adaptation that required confirmation (session-scoped). */
export function declineConsent(key, now = Date.now()) {
  store = { ...store, consent: { ...store.consent, [key]: { decision: "declined", at: now } } };
  changed();
}

export function getConsentDecision(key, now = Date.now()) {
  const entry = store.consent[key];
  if (!entry) return null;
  // Grants last for the session; declines expire after the dismissal TTL.
  if (entry.decision === "declined" && !isLive(entry, now)) return null;
  return entry.decision;
}

/** Dismiss a recommendation: it stays hidden across unrelated state changes. */
export function dismissRecommendation(id, now = Date.now()) {
  if (!id) return;
  store = { ...store, dismissed: { ...store.dismissed, [id]: { at: now } } };
  changed();
}

export function isRecommendationDismissed(id, now = Date.now()) {
  return Boolean(id) && Boolean(isLive(store.dismissed[id], now));
}

/**
 * Scope consent decisions and dismissals to the signed-in user (Task 6). A
 * consent granted by one user must never apply an adaptation for another
 * user of the same tab, so switching users starts from an empty store.
 */
export function bindExecutionStoreToUser(userId) {
  const owner = typeof userId === "string" && userId.length > 0 ? userId : null;
  if (store.owner === owner) return false;
  store = emptyStore(owner);
  changed();
  return true;
}

export function getExecutionStoreOwner() {
  return store.owner;
}

/** Test / sign-out boundary. */
export function resetExecutionStore() {
  store = emptyStore();
  try {
    safeSession()?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  changed();
}

// ─────────────────────────────────────────────────────────────────
//  Resolution
// ─────────────────────────────────────────────────────────────────

function reduceIntensity(action) {
  const parameters = {};
  for (const key of PROTECTIVE_PARAMETERS) {
    if (action.parameters?.[key] === true) parameters[key] = true;
  }
  return { ...action, parameters };
}

/**
 * Resolve how a plan may be executed.
 *
 * @param {object|null} plan - AdaptationPlan (or null when idle/disabled)
 * @param {object} [context]
 * @param {object|null} [context.trace] - DecisionTrace of the same decision
 * @param {boolean} [context.runtimeEnabled=true]
 * @param {boolean} [context.uiExecutionEnabled] - defaults to the uiExecution flag
 * @param {(key: string) => ("granted"|"declined"|null)} [context.consentFor]
 * @param {string[]} [context.targets] - restrict resolution to these targets
 * @returns {{ status: string, reason: string, effectivePlan: object|null,
 *   records: object[], pendingConsent: object[], suppressRecommendations: boolean,
 *   signature: string }}
 */
export function resolvePlanExecution(plan, context = {}) {
  const runtimeEnabled = context.runtimeEnabled !== false;
  const uiExecutionEnabled =
    typeof context.uiExecutionEnabled === "boolean" ? context.uiExecutionEnabled : isUIExecutionEnabled();
  const consentFor = typeof context.consentFor === "function" ? context.consentFor : (key) => getConsentDecision(key);
  const aggregate = context.trace?.safetyResult?.disposition;
  const safetyOverride = BLOCKING_DISPOSITIONS.has(aggregate);

  const baseline = (status, reason) => ({
    status,
    reason,
    effectivePlan: null,
    records: [],
    pendingConsent: [],
    suppressRecommendations: safetyOverride,
    signature: `baseline:${status}`,
  });

  if (!runtimeEnabled) return baseline(PlanExecutionStatus.REJECTED, "adaptive runtime disabled (feature flag)");
  if (!plan || !Array.isArray(plan.actions) || plan.actions.length === 0) {
    return baseline(PlanExecutionStatus.IDLE, "no adaptation in the current decision (baseline UI)");
  }

  const records = [];
  const pendingConsent = [];
  const effective = [];
  for (const action of plan.actions) {
    if (Array.isArray(context.targets) && !context.targets.includes(action?.target)) continue;
    const key = adaptationKey(action);
    const base = { key, actionId: action.actionId, ruleId: ruleIdOf(action), target: action.target };
    const record = (status, reason) => records.push({ ...base, status, reason });
    const isUI = action.target === AdaptationDimension.UI;

    if (isUI && !uiExecutionEnabled) {
      record(PlanExecutionStatus.REJECTED, "UI execution disabled (VITE_NEUROBRIDGE_ADAPTIVE_UI_EXECUTION is off)");
      continue;
    }
    if (BLOCKING_DISPOSITIONS.has(action.safety?.disposition)) {
      record(PlanExecutionStatus.REJECTED, `safety stage ${action.safety.disposition} — never applied`);
      continue;
    }
    if (safetyOverride && action.tier !== PriorityTier.SAFETY) {
      record(PlanExecutionStatus.REJECTED, `decision safety outcome ${aggregate} overrides ordinary adaptation`);
      continue;
    }
    if (isUI && typeof action.parameters?.mode === "string") {
      const check = adaptUIAction(action);
      if (!check.ok) {
        record(PlanExecutionStatus.REJECTED, `invalid UI action: ${check.error}`);
        continue;
      }
    }

    if (action.parameters?.requireConfirmation === true) {
      const decision = consentFor(key);
      if (decision === "declined") {
        record(PlanExecutionStatus.DISMISSED, "declined by the user (requireConfirmation)");
        continue;
      }
      if (decision !== "granted") {
        record(PlanExecutionStatus.DEFERRED, "awaiting user confirmation (safety guardrail requireConfirmation)");
        pendingConsent.push({ key, action, ruleId: base.ruleId, reason: action.reason ?? null });
        continue;
      }
    }

    // reducedIntensity is a UI guardrail: it drops layout-changing mode
    // switches and keeps only protective motion/colour flags. Module-owned
    // (non-UI) actions carry no motion/colour parameters, so applying the same
    // filter would erase their content (e.g. TASK/GUIDE `{ guidedBreathing }`
    // → `{}`) and leave an empty adaptation behind the user's consent. For
    // non-UI targets the action passes through with its parameters intact;
    // the module's own executor owns its intensity.
    if (isUI && action.parameters?.reducedIntensity === true) {
      effective.push(reduceIntensity(action));
      record(PlanExecutionStatus.MODIFIED, "safety guardrail reducedIntensity: only protective (motion/colour) changes applied");
      continue;
    }

    effective.push(action);
    record(
      PlanExecutionStatus.APPLIED,
      action.parameters?.requireConfirmation === true ? "applied with user consent" : "applied",
    );
  }

  const count = (status) => records.filter((entry) => entry.status === status).length;
  let status;
  let reason;
  if (records.length === 0) {
    status = PlanExecutionStatus.IDLE;
    reason = "no adaptation for the resolved targets";
  } else if (count(PlanExecutionStatus.MODIFIED) > 0) {
    status = PlanExecutionStatus.MODIFIED;
    reason = "applied with safety modifications";
  } else if (count(PlanExecutionStatus.APPLIED) > 0) {
    status = PlanExecutionStatus.APPLIED;
    reason = count(PlanExecutionStatus.DEFERRED) > 0 ? "applied; some actions await confirmation" : "applied";
  } else if (count(PlanExecutionStatus.DEFERRED) > 0) {
    status = PlanExecutionStatus.DEFERRED;
    reason = "awaiting user confirmation";
  } else if (count(PlanExecutionStatus.DISMISSED) > 0 && count(PlanExecutionStatus.REJECTED) === 0) {
    status = PlanExecutionStatus.DISMISSED;
    reason = "declined by the user";
  } else {
    status = PlanExecutionStatus.REJECTED;
    reason = records.find((entry) => entry.status === PlanExecutionStatus.REJECTED)?.reason ?? "rejected";
  }

  const effectivePlan = effective.length > 0 ? { ...plan, actions: effective, priorityOrder: effective.map((a) => a.actionId) } : null;
  return {
    status,
    reason,
    effectivePlan,
    records,
    pendingConsent,
    suppressRecommendations: safetyOverride,
    signature: `${status}|${planSignature(effectivePlan)}|${pendingConsent.map((p) => p.key).join(",")}`,
  };
}

// ─────────────────────────────────────────────────────────────────
//  Execution ledger (traceability + idempotence)
// ─────────────────────────────────────────────────────────────────

/**
 * Bounded, idempotent log of execution outcomes. `commit` records a new
 * entry only when the effective execution changed; re-committing the same
 * resolution (duplicate execution) is a no-op that reports `duplicate: true`.
 */
export function createExecutionLedger({ limit = 50 } = {}) {
  const entries = [];
  let lastSignature = null;
  let lastActive = false;

  return {
    commit(resolution, plan, now = Date.now()) {
      if (!resolution) return { duplicate: true, entry: null };
      if (resolution.signature === lastSignature) {
        return { duplicate: true, entry: entries[entries.length - 1] ?? null };
      }
      const active = resolution.effectivePlan !== null;
      const restored = !active && lastActive;
      const entry = {
        decisionId: plan?.decisionTraceId ?? null,
        planId: plan?.planId ?? null,
        status: restored && resolution.status === PlanExecutionStatus.IDLE ? PlanExecutionStatus.APPLIED : resolution.status,
        reason: restored && resolution.status === PlanExecutionStatus.IDLE
          ? "adaptation withdrawn — baseline UI restored"
          : resolution.reason,
        actions: resolution.records.map(({ actionId, ruleId, target, status, reason }) => ({
          actionId, ruleId, target, status, reason,
        })),
        at: now,
      };
      entries.push(entry);
      if (entries.length > limit) entries.shift();
      lastSignature = resolution.signature;
      lastActive = active;
      return { duplicate: false, entry };
    },
    entries() {
      return entries.slice();
    },
    last() {
      return entries[entries.length - 1] ?? null;
    },
  };
}
