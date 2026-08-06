/**
 * preferences.js — D14 preference application stage
 *
 * Turns the `userPreferences` input fragment (spec §5) into real adaptation
 * candidates instead of a pass-through:
 *
 *   - `requested`    → Tier 2 EXPLICIT_USER_REQUEST candidates.
 *   - `restricted`   → Tier 3 hard boundaries (MemoryType.SUPPORT_BOUNDARY).
 *                      A boundary is a negative constraint: it suppresses
 *                      conflicting candidates on its target but never creates
 *                      an action of its own (no invented no-op actions).
 *   - `accessibility`→ Tier 4 EXPLICIT_PREFERENCE (soft) candidates, limited
 *                      to a fixed allowlist of engine-known keys
 *                      (`reduceMotion`, `screenReader`) with boolean `true`.
 *
 * The stage never fabricates preferences: malformed entries are skipped, only
 * allowlisted accessibility keys are considered, and unknown inputs are
 * ignored. When no usable preference fragment is present the stage is a pure
 * pass-through so existing decisions are byte-for-byte unchanged.
 *
 * Precedence is the D4 categorical model: lower tier number wins. Preference
 * candidates are merged with the D4 survivors and re-resolved with the same
 * deterministic comparator (`compareConflictPrecedence`). Tier 1 SAFETY
 * candidates always win, so a preference can never override safety, and a
 * learned (Tier 9) candidate always loses to a requestable preference.
 *
 * Outputs follow the PreferenceResult contract: `appliedRequests`
 * (requested + accessibility ids that reached the plan), `honoredRestrictions`
 * (restriction ids that blocked at least one candidate), `learnedSignalsUsed`
 * (strategy ids whose `strategyEffectiveness:<id>` trigger fired on a
 * surviving Tier 9 rule — derived from matched triggers, never invented), and
 * `overrides` records for every preference that won or lost an actual conflict.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import {
  AdaptationActionType,
  AdaptationDimension,
  PolicyScope,
  PreferenceRequestSchema,
  PriorityTier,
  RestrictionSchema,
} from "@/support/schemas/supportSchemas";
import { compareConflictPrecedence, entriesConflict } from "./conflictResolution.js";

const PREFERENCE_VERSION = 1;
const LEARNED_DIMENSION_PREFIX = "strategyEffectiveness:";

/**
 * Engine-known accessibility keys → candidate mapping. Keys outside this
 * allowlist are ignored so an arbitrary accessibility flag can never be turned
 * into a fabricated adaptation.
 */
const ACCESSIBILITY_DIMENSIONS = {
  reduceMotion: {
    type: AdaptationActionType.MODIFY,
    target: AdaptationDimension.UI,
    parameterKey: "reduceMotion",
  },
  screenReader: {
    type: AdaptationActionType.ENABLE,
    target: AdaptationDimension.ASSISTANCE,
    parameterKey: "screenReader",
  },
};

function isNonNullObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isFiniteIn01(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function buildEntry({ ruleId, tier, priority, action, confidence, source }) {
  return {
    ruleId,
    version: PREFERENCE_VERSION,
    tier,
    priority: finiteNumber(priority),
    scope: PolicyScope.USER,
    action,
    matchedTriggers: [],
    confidence: isFiniteIn01(confidence) ? confidence : 1,
    reversal: "auto",
    _preferenceSource: source,
  };
}

function requestedEntries(preferences) {
  const entries = [];
  const list = Array.isArray(preferences?.requested) ? preferences.requested : [];
  for (const item of list) {
    const parsed = PreferenceRequestSchema.safeParse(item);
    if (!parsed.success) continue;
    const pref = parsed.data;
    entries.push(
      buildEntry({
        ruleId: pref.id,
        tier: PriorityTier.EXPLICIT_USER_REQUEST,
        priority: pref.priority ?? 0,
        action: {
          type: pref.type ?? AdaptationActionType.MODIFY,
          target: pref.target,
          parameters: pref.parameters ?? {},
        },
        confidence: pref.confidence,
        source: "requested",
      }),
    );
  }
  return entries;
}

function accessibilityEntries(preferences) {
  const entries = [];
  const accessibility = isNonNullObject(preferences?.accessibility)
    ? preferences.accessibility
    : {};
  for (const [key, value] of Object.entries(accessibility)) {
    if (value !== true) continue;
    const mapping = ACCESSIBILITY_DIMENSIONS[key];
    if (!mapping) continue;
    entries.push(
      buildEntry({
        ruleId: `accessibility.${key}`,
        tier: PriorityTier.EXPLICIT_PREFERENCE,
        priority: 0,
        action: {
          type: mapping.type,
          target: mapping.target,
          parameters: { [mapping.parameterKey]: true },
        },
        confidence: 1,
        source: "accessibility",
      }),
    );
  }
  return entries;
}

function restrictionList(preferences) {
  const list = [];
  const raw = Array.isArray(preferences?.restricted) ? preferences.restricted : [];
  for (const item of raw) {
    const parsed = RestrictionSchema.safeParse(item);
    if (parsed.success) {
      list.push(parsed.data);
    }
  }
  return list;
}

/** A restriction with neither a direction nor parameters is a blanket ban. */
function isBlanketRestriction(restriction) {
  return (
    restriction.type === undefined &&
    Object.keys(restriction.parameters ?? {}).length === 0
  );
}

/**
 * Apply hard boundaries as filters. A restriction never creates an action; it
 * removes conflicting candidates on its target unless the candidate is Tier 1
 * SAFETY (safety always wins over a user boundary).
 */
function applyRestrictions(candidates, restrictions) {
  const blocked = [];
  const honored = [];
  const overrides = [];
  let pool = candidates;

  for (const restriction of restrictions) {
    const target = restriction.target;
    const blanket = isBlanketRestriction(restriction);
    const restEntry = {
      action: {
        type: restriction.type,
        target: restriction.target,
        parameters: restriction.parameters ?? {},
      },
    };

    const remaining = [];
    const blockedIds = [];
    for (const candidate of pool) {
      if (candidate.action?.target !== target) {
        remaining.push(candidate);
        continue;
      }
      if (candidate.tier === PriorityTier.SAFETY) {
        remaining.push(candidate);
        continue;
      }
      if (blanket || entriesConflict(restEntry, candidate)) {
        blocked.push(candidate);
        blockedIds.push(candidate.ruleId);
        continue;
      }
      remaining.push(candidate);
    }

    if (blockedIds.length > 0) {
      honored.push(restriction.id);
      overrides.push({
        kind: "preference",
        actionId: restriction.id,
        applied: true,
        detail: `restriction "${restriction.id}" blocked ${blockedIds.join(", ")} on target "${target}"`,
      });
    }
    pool = remaining;
  }

  return { candidates: pool, blocked, honored, overrides };
}

/**
 * Deterministic per-target resolution over the merged candidate list, reusing
 * the D4 conflict model and comparator. `pairs` record every suppressed
 * candidate and the kept winner that suppressed it.
 */
function resolveCandidates(candidates) {
  const kept = [];
  const rejected = [];
  const pairs = [];
  const ordered = [...candidates].sort(compareConflictPrecedence);
  for (const candidate of ordered) {
    const winner = kept.find((entry) => entriesConflict(candidate, entry));
    if (winner) {
      rejected.push(candidate);
      pairs.push({ winner, loser: candidate });
    } else {
      kept.push(candidate);
    }
  }
  return { kept, rejected, pairs };
}

/** Override records for preference entries that won or lost a conflict. */
function buildPreferenceOverrides(pairs) {
  const overrides = [];
  const seen = new Set();
  for (const { winner, loser } of pairs) {
    const target = loser.action?.target ?? winner.action?.target ?? "unknown";
    if (winner._preferenceSource) {
      const key = `applied:${winner.ruleId}:${loser.ruleId}`;
      if (!seen.has(key)) {
        seen.add(key);
        overrides.push({
          kind: "preference",
          actionId: winner.ruleId,
          applied: true,
          detail: `preference "${winner.ruleId}" overrode "${loser.ruleId}" on target "${target}"`,
        });
      }
    }
    if (loser._preferenceSource) {
      const key = `rejected:${loser.ruleId}:${winner.ruleId}`;
      if (!seen.has(key)) {
        seen.add(key);
        overrides.push({
          kind: "preference",
          actionId: loser.ruleId,
          applied: false,
          detail: `preference "${loser.ruleId}" overridden by "${winner.ruleId}" on target "${target}"`,
        });
      }
    }
  }
  return overrides;
}

/**
 * Derived provenance: strategy ids whose `strategyEffectiveness:<id>` trigger
 * fired on a surviving Tier 9 rule. Read only from actual matched triggers.
 */
function learnedSignalsFrom(entries) {
  const signals = [];
  for (const entry of entries) {
    if (!entry || entry.tier !== PriorityTier.LEARNED_PERSONALIZATION) continue;
    const triggers = Array.isArray(entry.matchedTriggers) ? entry.matchedTriggers : [];
    for (const trigger of triggers) {
      const dimension = typeof trigger?.dimension === "string" ? trigger.dimension : "";
      if (!dimension.startsWith(LEARNED_DIMENSION_PREFIX)) continue;
      const strategyId = dimension.slice(LEARNED_DIMENSION_PREFIX.length).trim();
      if (strategyId.length > 0 && !signals.includes(strategyId)) {
        signals.push(strategyId);
      }
    }
  }
  return signals;
}

/**
 * Default D14 preference stage. Signature matches the engine's Preference
 * extension point: `(entries, context) => { actions, result, overrides,
 * rejected }`.
 *
 * @param {Array<object>} entries - D4 conflict survivors.
 * @param {{ moduleContext?: object|null, userPreferences?: object|null }} [context]
 * @returns {{ actions: object[], result: { appliedRequests: string[],
 *   honoredRestrictions: string[], learnedSignalsUsed: string[] },
 *   overrides: object[], rejected: object[] }}
 */
export function applyUserPreferences(entries, context = {}) {
  const policyEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const preferences = context?.userPreferences;

  if (!isNonNullObject(preferences)) {
    return {
      actions: policyEntries,
      result: {
        appliedRequests: [],
        honoredRestrictions: [],
        learnedSignalsUsed: learnedSignalsFrom(policyEntries),
      },
      overrides: [],
      rejected: [],
    };
  }

  const requested = requestedEntries(preferences);
  const accessibility = accessibilityEntries(preferences);
  const restrictions = restrictionList(preferences);

  if (requested.length === 0 && accessibility.length === 0 && restrictions.length === 0) {
    return {
      actions: policyEntries,
      result: {
        appliedRequests: [],
        honoredRestrictions: [],
        learnedSignalsUsed: learnedSignalsFrom(policyEntries),
      },
      overrides: [],
      rejected: [],
    };
  }

  const restrictionOutcome = applyRestrictions(
    [...policyEntries, ...requested, ...accessibility],
    restrictions,
  );

  const { kept, rejected, pairs } = resolveCandidates(restrictionOutcome.candidates);

  const applied = kept.filter((entry) => entry._preferenceSource);
  const appliedRequests = applied
    .filter(
      (entry) =>
        entry._preferenceSource === "requested" ||
        entry._preferenceSource === "accessibility",
    )
    .map((entry) => entry.ruleId);

  return {
    actions: kept,
    result: {
      appliedRequests,
      honoredRestrictions: restrictionOutcome.honored,
      learnedSignalsUsed: learnedSignalsFrom(kept),
    },
    overrides: [...restrictionOutcome.overrides, ...buildPreferenceOverrides(pairs)],
    rejected: [...rejected, ...restrictionOutcome.blocked],
  };
}
