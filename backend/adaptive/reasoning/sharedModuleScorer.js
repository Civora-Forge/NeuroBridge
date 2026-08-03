/**
 * sharedModuleScorer.js — Reusable module scoring mathematics (Phase 6)
 *
 * Phase 6 consolidation: `interventionRanking` and `moduleSelector` each
 * implemented the same per-module scoring core:
 *
 *   score(module) = Σ tagScores[tag]  for every tag the module declares
 *
 * This module is the single home for that mathematics. Both callers keep
 * their domain-specific input adapters (tag-profile building, challenge
 * coverage, thresholds) and call back into `scoreModule` / `scoreModules`.
 *
 * Scope: reusable scoring/ranking math only. It owns no policy evaluation,
 * adaptation decisions, safety, user-state mutation, persistence, module
 * execution, reflection, or personalization. Missing tag scores are treated
 * as an empty profile and modules without tags score zero.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

export function scoreModule(tagScores = {}, module) {
  const scores = tagScores ?? {};
  return (module.tags || []).reduce((sum, tag) => sum + (scores[tag] || 0), 0);
}

export function scoreModules(tagScores = {}, modules = []) {
  return modules
    .map((module) => ({ ...module, score: scoreModule(tagScores, module) }))
    .sort((a, b) => b.score - a.score);
}
