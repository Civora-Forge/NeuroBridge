/**
 * conflictResolution.js — Per-target conflict resolution (D4)
 *
 * Closes the Phase 3 deviation where the engine accepted every triggered
 * policy for a target, leaving conflicting candidates as duplicate actions
 * and `DecisionTrace.conflicts` always empty.
 *
 * Model (spec §2 D4 / §8 / §4):
 *   - A conflict is two entries sharing `action.target` with incompatible
 *     `parameters` (any shared parameter key holding a different value) or
 *     opposing `action.type` direction (e.g. INCREASE vs DECREASE).
 *   - Per `(target)` the highest-precedence candidate wins; losers are
 *     suppressed (never blindly merged) and recorded in `DecisionTrace.conflicts`
 *     and `rejectedConditions`.
 *   - Precedence is categorical and deterministic: lower tier → higher numeric
 *     priority → higher confidence → fresher policy (version) → stable rule id.
 *   - Compatible candidates (identical parameters / no shared conflicting keys)
 *     coexist; the stage never fabricates a conflict.
 *
 * The stage is entry-level and runs BEFORE preference/safety/hysteresis, so
 * suppressed losers never reach later stages. Tier 1 SAFETY naturally wins any
 * conflict via the categorical tier tie-break.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

const OPPOSING_DIRECTION_PAIRS = [
  ["INCREASE", "DECREASE"],
  ["ENABLE", "DISABLE"],
  ["PAUSE", "RESUME"],
  ["DELAY", "ACCELERATE"],
  ["SIMPLIFY", "EXPAND"],
  ["REDUCE", "EXPAND"],
];

function isOpposingDirections(typeA, typeB) {
  if (typeof typeA !== "string" || typeof typeB !== "string" || typeA === typeB) {
    return false;
  }
  return OPPOSING_DIRECTION_PAIRS.some(
    ([left, right]) =>
      (typeA === left && typeB === right) || (typeA === right && typeB === left),
  );
}

/** Two parameter maps disagree when a shared key holds a different value. */
function parametersDisagree(paramsA, paramsB) {
  const a = paramsA && typeof paramsA === "object" ? paramsA : {};
  const b = paramsB && typeof paramsB === "object" ? paramsB : {};
  for (const [key, value] of Object.entries(a)) {
    if (!(key in b)) continue;
    if (value !== b[key]) return true;
  }
  return false;
}

/**
 * Two entries conflict when they target the same dimension AND either oppose
 * in direction or carry incompatible parameters.
 */
export function entriesConflict(entryA, entryB) {
  if (!entryA?.action?.target || entryA.action.target !== entryB?.action?.target) {
    return false;
  }
  if (isOpposingDirections(entryA.action.type, entryB.action.type)) {
    return true;
  }
  return parametersDisagree(entryA.action.parameters, entryB.action.parameters);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Deterministic D4 precedence: lower tier wins; within a tier higher numeric
 * priority; then higher confidence; then fresher policy version; finally the
 * stable rule id (ascending) so ties never rely on insertion order.
 */
export function compareConflictPrecedence(left, right) {
  if (left.tier !== right.tier) {
    return finiteNumber(left.tier) - finiteNumber(right.tier);
  }
  if (left.priority !== right.priority) {
    return finiteNumber(right.priority) - finiteNumber(left.priority);
  }
  const leftConfidence = finiteNumber(left.confidence);
  const rightConfidence = finiteNumber(right.confidence);
  if (leftConfidence !== rightConfidence) {
    return rightConfidence - leftConfidence;
  }
  const leftVersion = finiteNumber(left.version);
  const rightVersion = finiteNumber(right.version);
  if (leftVersion !== rightVersion) {
    return rightVersion - leftVersion;
  }
  const leftId = typeof left.ruleId === "string" ? left.ruleId : "";
  const rightId = typeof right.ruleId === "string" ? right.ruleId : "";
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function conflictReason(winner, loser) {
  if (
    winner?.action?.target === loser?.action?.target &&
    isOpposingDirections(winner.action.type, loser.action.type)
  ) {
    return `opposing direction (${winner.action.type} vs ${loser.action.type}) on target ${winner.action.target}`;
  }
  return `incompatible parameters on target ${winner?.action?.target ?? "unknown"}`;
}

/**
 * Resolve per-target conflicts among triggered entries.
 *
 * @param {Array<object>} entries - Precedence-relevant triggered entries.
 * @returns {{ kept: object[], rejected: object[], conflicts: object[] }}
 *   `conflicts` entries match ConflictRecordSchema: `{ target, winnerActionId,
 *   loserActionIds, reason }`. Identifiers are the governing ruleIds.
 */
export function resolveConflicts(entries = []) {
  const kept = [];
  const rejected = [];
  const conflicts = [];

  const groups = new Map();
  for (const entry of entries) {
    if (!entry) continue;
    const target = entry.action?.target;
    const key = typeof target === "string" ? target : "__no_target__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  for (const [target, group] of groups) {
    const ordered = [...group].sort(compareConflictPrecedence);
    const targetKept = [];

    for (const candidate of ordered) {
      const winner = targetKept.find((keptEntry) => entriesConflict(candidate, keptEntry));
      if (winner) {
        rejected.push(candidate);
        const existing = conflicts.find(
          (record) => record.target === target && record.winnerActionId === winner.ruleId,
        );
        if (existing) {
          existing.loserActionIds.push(candidate.ruleId);
        } else {
          conflicts.push({
            target,
            winnerActionId: winner.ruleId,
            loserActionIds: [candidate.ruleId],
            reason: conflictReason(winner, candidate),
          });
        }
        continue;
      }
      targetKept.push(candidate);
      kept.push(candidate);
    }
  }

  return { kept, rejected, conflicts };
}
