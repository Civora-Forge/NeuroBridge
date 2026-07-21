/**
 * moduleSelector.js — Adaptive Module Scoring Engine
 *
 * Algorithm:
 *  1. Merge tagScores from every answered question.
 *  2. Score each candidate module as the sum of tagScores[tag] for each
 *     tag the module declares.
 *  3. Enable modules whose score >= THRESHOLD.
 *  4. Enforce MIN_MODULES and MAX_MODULES bounds.
 *  5. Guarantee at least one module per selected challenge area.
 */

import { CHALLENGE_MODULE_MAP, getModulesForChallenges } from "@/data/modulesRegistry";
import { getQuestionsForChallenges } from "@/utils/questionEngine";

const THRESHOLD   = 2;   // min score to unlock a module
const MIN_MODULES = 2;   // never show fewer than this
const MAX_MODULES = 8;   // never show more than this

// ── Build cumulative tag scores from all answers ──────────────────
export function buildTagScores(answersByQuestionId = {}, questions = []) {
  const scores = {};
  for (const question of questions) {
    const selectedText = answersByQuestionId[question.id];
    if (!selectedText) continue;
    const option = question.options.find((o) => o.text === selectedText);
    if (!option?.tagScores) continue;
    for (const [tag, weight] of Object.entries(option.tagScores)) {
      scores[tag] = (scores[tag] || 0) + weight;
    }
  }
  return scores;
}

// ── Score a single module against the accumulated tag scores ──────
export function scoreModule(tagScores = {}, module) {
  return (module.tags || []).reduce((sum, tag) => sum + (tagScores[tag] || 0), 0);
}

// ── Score all candidate modules and sort descending ───────────────
export function scoreModules(tagScores = {}, modules = []) {
  return modules
    .map((m) => ({ ...m, score: scoreModule(tagScores, m) }))
    .sort((a, b) => b.score - a.score);
}

// ── Guarantee at least one module per selected challenge area ─────
function ensureChallengeCoverage(enabledSet, selectedChallenges, scoredModules) {
  const byId = new Map(scoredModules.map((m) => [m.id, m]));

  for (const challengeId of selectedChallenges) {
    const pool = CHALLENGE_MODULE_MAP[challengeId] || [];
    const alreadyCovered = pool.some((id) => enabledSet.has(id));
    if (alreadyCovered) continue;

    // Pick the highest-scored module from this challenge pool
    const best = pool.map((id) => byId.get(id)).filter(Boolean)[0];
    if (best) enabledSet.add(best.id);
  }

  return enabledSet;
}

// ── Main entry point ─────────────────────────────────────────────
export function selectModulesForUser({ selectedChallenges = [], answersByQuestionId = {} }) {
  const questions      = getQuestionsForChallenges(selectedChallenges);
  const tagScores      = buildTagScores(answersByQuestionId, questions);
  const candidatePool  = getModulesForChallenges(selectedChallenges);
  const scored         = scoreModules(tagScores, candidatePool);

  // Modules that passed the threshold
  const passing = scored.filter((m) => m.score >= THRESHOLD);

  // Enforce minimum — if not enough passed, fill from top scorers
  const base = passing.length >= MIN_MODULES ? passing : scored.slice(0, MIN_MODULES);

  // Build a set capped at MAX_MODULES
  const enabledSet = new Set(base.slice(0, MAX_MODULES).map((m) => m.id));

  // Guarantee coverage for every selected challenge
  ensureChallengeCoverage(enabledSet, selectedChallenges, scored);

  // Resolve final unique ordered list (preserve score order)
  const finalModules = scored.filter((m) => enabledSet.has(m.id));

  return {
    questions,
    tagScores,
    scoredModules: scored,
    enabledModules: finalModules.map((m) => m.id),
    selectedModules: finalModules,
    // legacy alias kept for OnboardingFlow
    userTags: tagScores,
  };
}
