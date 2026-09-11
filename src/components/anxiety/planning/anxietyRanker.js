/**
 * anxietyRanker.js — Engine-driven candidate ranking for the Adaptive Anxiety Engine
 *
 * Replaces the retired feature-local planner (`planInterventions`). Ranking is
 * deterministic and explainable:
 *
 *   1. Situational fit: each candidate scores against the current AnxietyState
 *      and inferred Pattern via its own `evaluateFit(...)`.
 *   2. Tier-9 learned overlay: the Adaptive Engine's decision (backed by Role 4
 *      outcomes reflected through `strategyEffectiveness`) can promote a single
 *      preferred strategy and/or deprioritize a single strategy. Those strategy
 *      ids are translated into feature `InterventionId`s by the caller and
 *      applied as fixed, documented score deltas here.
 *
 * When no learned preference is present, ranking is purely situational and the
 * stable-baseline path still produces Monitor Only.
 *
 * Ownership: Support & Learning Engineer
 */

import { ANXIETY_CANDIDATES } from "./anxietyCandidates";
import { InterventionId, AnxietyPatternType } from "../domain/anxietyTypes";

/** Boost applied to the strategy the engine prefers (REORDER/CONTENT overlap). */
const PREFERRED_BOOST = 0.25;
/** Penalty applied to the strategy the engine deprioritizes (REDUCE/CONTENT). */
const DEPRIORITIZED_PENALTY = 0.3;

function fitExplanation(interventionId, pattern) {
  switch (interventionId) {
    case InterventionId.NO_INTERVENTION:
      return pattern === AnxietyPatternType.STABLE_BASELINE
        ? "Distress is at baseline and stable. Continued monitoring is recommended without active intervention."
        : "Distress is manageable without active intervention.";
    case InterventionId.PHYSIOLOGICAL_BREATHING:
      return pattern === AnxietyPatternType.PHYSIOLOGICAL_ESCALATION
        ? "Rhythmic respiration directly targets elevated autonomic nervous system arousal."
        : "Paced breathing offers gentle nervous system regulation.";
    case InterventionId.PHYSIOLOGICAL_GROUNDING:
      return pattern === AnxietyPatternType.SENSORY_OVERWHELM
        ? "Sensory checklist re-anchors attention to immediate physical surroundings away from sensory overwhelm."
        : "Multi-sensory orienting helps interrupt rising distress.";
    case InterventionId.COGNITIVE_REFRAME:
      return pattern === AnxietyPatternType.COGNITIVE_WORRY_LOOP
        ? "Cognitive restructuring addresses repetitive worry loops and catastrophic assumptions."
        : "Reframing supports balanced reflection when distress is primarily cognitive.";
    case InterventionId.BEHAVIORAL_MICRO_ACTION:
      return pattern === AnxietyPatternType.AVOIDANCE_DRIVEN
        ? "Deconstructing the immediate task into a 2-minute micro-action overcomes procrastination paralysis."
        : "Structured micro-action builds momentum for task engagement.";
    default:
      return "";
  }
}

/**
 * Rank anxiety intervention candidates for the current state/pattern.
 *
 * @param {object} options
 * @param {object} [options.state] Current AnxietyState from deriveAnxietyState.
 * @param {object} [options.reasoningResult] Output from reasonAnxietyPattern.
 * @param {string|null} [options.preferredInterventionId] InterventionId the
 *   Adaptive Engine is promoting (from `preferredStrategyId`).
 * @param {string|null} [options.deprioritizedInterventionId] InterventionId the
 *   Adaptive Engine is deprioritizing (from `deprioritizedStrategyId`).
 * @returns {object} PlanResult with recommendedIntervention / allCandidates /
 *   isMonitorOnly / fitReason / personalizationNote / pattern / urgency /
 *   rationale.
 */
export function rankAnxietyCandidates({
  state = {},
  reasoningResult = {},
  preferredInterventionId = null,
  deprioritizedInterventionId = null,
} = {}) {
  const pattern = reasoningResult?.pattern || AnxietyPatternType.GENERAL_ANXIETY;

  const evaluated = ANXIETY_CANDIDATES.map((candidate) => {
    const baseFit = candidate.evaluateFit(state, pattern);
    let adjustedFit = baseFit;
    let personalizationNote = null;

    if (preferredInterventionId && preferredInterventionId === candidate.id) {
      adjustedFit = Math.min(1.0, adjustedFit + PREFERRED_BOOST);
      personalizationNote =
        "Adapted from your history: this strategy has helped you before, so it is prioritized now.";
    }
    if (deprioritizedInterventionId && deprioritizedInterventionId === candidate.id) {
      adjustedFit = Math.max(0.01, adjustedFit - DEPRIORITIZED_PENALTY);
      personalizationNote =
        "Adapted from your history: this strategy has been less effective for you recently, so it is de-emphasized.";
    }

    return {
      ...candidate,
      score: Number(adjustedFit.toFixed(2)),
      rawFit: Number(Math.min(1.0, Math.max(0, baseFit)).toFixed(2)),
      personalizationNote,
      fitExplanation: fitExplanation(candidate.id, pattern),
    };
  });

  const ranked = [...evaluated].sort((a, b) => b.score - a.score);
  const topCandidate = ranked[0];

  return {
    recommendedIntervention: topCandidate,
    allCandidates: ranked,
    isMonitorOnly: topCandidate.id === InterventionId.NO_INTERVENTION,
    fitReason: topCandidate.fitExplanation,
    personalizationNote: topCandidate.personalizationNote,
    pattern,
    urgency: reasoningResult?.urgency || "low",
    rationale: reasoningResult?.rationale || "",
  };
}