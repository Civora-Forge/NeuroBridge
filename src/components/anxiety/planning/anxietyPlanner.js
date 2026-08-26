/**
 * anxietyPlanner.js — Candidate planning and multi-factor intervention ranker
 *
 * Responsibilities:
 *   - Evaluates all candidate interventions against current AnxietyState and inferred Pattern.
 *   - Incorporates state-specific personalized outcome modifiers.
 *   - Formulates explainable recommendations and fit reasons.
 *   - Supports NO_INTERVENTION (Monitor Only) for stable baseline states.
 *   - Pure, deterministic JavaScript.
 */

import { ANXIETY_CANDIDATES } from "./anxietyCandidates";
import { InterventionId, AnxietyPatternType } from "../domain/anxietyTypes";
import { getPersonalizedModifier } from "../adaptation/anxietyPersonalization";

/**
 * Plans and ranks intervention candidates based on current state, reasoning pattern, and learned outcomes.
 *
 * @param {object} state Current AnxietyState
 * @param {object} reasoningResult Output from reasonAnxietyPattern()
 * @param {object} [episode] Current AnxietyEpisode
 * @param {string} [userId="anon"]
 * @param {Array} [customHistory=null] Optional custom outcome history for testing
 * @returns {object} PlanResult
 */
export function planInterventions(
  state,
  reasoningResult,
  episode = null,
  userId = "anon",
  customHistory = null
) {
  const pattern = reasoningResult?.pattern || AnxietyPatternType.GENERAL_ANXIETY;

  const evaluated = ANXIETY_CANDIDATES.map((candidate) => {
    const rawFit = candidate.evaluateFit(state, pattern);
    const mod = getPersonalizedModifier(candidate.id, pattern, userId, customHistory);

    const compositeScore = Number(
      Math.max(0.01, Math.min(1.0, rawFit + mod.bonus - mod.penalty)).toFixed(2)
    );

    let fitExplanation = "";
    if (candidate.id === InterventionId.NO_INTERVENTION) {
      fitExplanation =
        pattern === AnxietyPatternType.STABLE_BASELINE
          ? "Distress is at baseline and stable. Continued monitoring is recommended without active intervention."
          : "Distress is manageable without active intervention.";
    } else if (candidate.id === InterventionId.PHYSIOLOGICAL_BREATHING) {
      fitExplanation =
        pattern === AnxietyPatternType.PHYSIOLOGICAL_ESCALATION
          ? "Rhythmic respiration directly targets elevated autonomic nervous system arousal."
          : "Paced breathing offers gentle nervous system regulation.";
    } else if (candidate.id === InterventionId.PHYSIOLOGICAL_GROUNDING) {
      fitExplanation =
        pattern === AnxietyPatternType.SENSORY_OVERWHELM
          ? "Sensory checklist re-anchors attention to immediate physical surroundings away from sensory overwhelm."
          : "Multi-sensory orienting helps interrupt rising distress.";
    } else if (candidate.id === InterventionId.COGNITIVE_REFRAME) {
      fitExplanation =
        pattern === AnxietyPatternType.COGNITIVE_WORRY_LOOP
          ? "Cognitive restructuring addresses repetitive worry loops and catastrophic assumptions."
          : "Reframing supports balanced reflection when distress is primarily cognitive.";
    } else if (candidate.id === InterventionId.BEHAVIORAL_MICRO_ACTION) {
      fitExplanation =
        pattern === AnxietyPatternType.AVOIDANCE_DRIVEN
          ? "Deconstructing the immediate task into a 2-minute micro-action overcomes procrastination paralysis."
          : "Structured micro-action builds momentum for task engagement.";
    }

    return {
      ...candidate,
      score: compositeScore,
      rawFit: Number(rawFit.toFixed(2)),
      personalizedBonus: mod.bonus,
      personalizedPenalty: mod.penalty,
      personalizationNote: mod.rationale,
      fitExplanation,
    };
  });

  // Sort descending by score
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
