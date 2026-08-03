/**
 * role4Signals.js — Role 4 read path at runtime (Phase 4)
 *
 * Spec §22 Phase 4: "Role 4 read path at runtime". This module assembles the
 * `role4Signals` input fragment (spec §5) from the existing, authoritative
 * Role 4 persistence API (role4Store). It is strictly READ-ONLY:
 *
 *   - reads interventions, outcomes, memories, and the newest personalization
 *     profile for a userId;
 *   - never writes Role 4 records and never touches intervention lifecycles;
 *   - degrades gracefully (empty arrays) when the userId is missing or the
 *     persistence layer is unavailable, so the engine never crashes on a
 *     sparse signal set (spec §5 availability rules).
 *
 * `strategyEffectiveness` (spec §5) is intentionally left unpopulated: the
 * only producer is the legacy `memorySystem.getUserStrategyEffectiveness`
 * helper, which Phase 6 deprecates in favor of Role 4 outcome-derived signals
 * (spec §21 / D11).
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import {
  listInterventionOutcomes,
  listInterventions,
  listPersonalizationProfiles,
  listUserMemories,
} from "@/support/persistence/role4Store";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Build the `role4Signals` fragment for a user at runtime.
 *
 * @param {string} [userId] - Normalized Role 4 userId (from AuthContext).
 * @returns {{ interventions: object[], outcomes: object[], memories: object[], personalization?: object }}
 *   Empty arrays / omitted personalization when the user has no records or
 *   the read is unavailable. Never throws.
 */
export function buildRole4Signals(userId) {
  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    return { interventions: [], outcomes: [], memories: [] };
  }

  let interventions = [];
  let outcomes = [];
  let memories = [];
  let personalization;

  try {
    interventions = asArray(listInterventions(userId));
  } catch {
    interventions = [];
  }
  try {
    outcomes = asArray(listInterventionOutcomes(userId));
  } catch {
    outcomes = [];
  }
  try {
    memories = asArray(listUserMemories(userId));
  } catch {
    memories = [];
  }
  try {
    const profiles = asArray(listPersonalizationProfiles(userId));
    personalization = profiles[0] ?? undefined;
  } catch {
    personalization = undefined;
  }

  const signals = { interventions, outcomes, memories };
  if (personalization !== undefined) {
    signals.personalization = personalization;
  }
  return signals;
}
