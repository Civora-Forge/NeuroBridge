/**
 * anxietyCandidates.js — Candidate intervention definitions and metadata
 *
 * Responsibilities:
 *   - Declares the 4 core interventions + 1 monitor-only candidate.
 *   - Specifies candidate categories, target pattern alignments, contraindications, and base descriptions.
 *   - Pure data structures and evaluation helpers.
 */

import { InterventionCategory, InterventionId, AnxietyPatternType } from "../domain/anxietyTypes";

export const ANXIETY_CANDIDATES = [
  {
    id: InterventionId.PHYSIOLOGICAL_BREATHING,
    title: "Paced Box Breathing",
    category: InterventionCategory.PHYSIOLOGICAL,
    shortDesc: "4-4-4-4 paced respiration to downregulate autonomic arousal.",
    durationMinutes: 2,
    targetPatterns: [
      AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
      AnxietyPatternType.GENERAL_ANXIETY,
    ],
    evaluateFit: (state, pattern) => {
      const arousalVal = state.arousal?.value ?? 0;
      const escalationVal = state.escalation?.value ?? 0;
      const severityVal = state.severity?.value ?? 0;

      let fit = 0.35; // base baseline
      if (pattern === AnxietyPatternType.PHYSIOLOGICAL_ESCALATION) fit += 0.45;
      if (arousalVal >= 0.6) fit += arousalVal * 0.25;
      if (escalationVal >= 0.5) fit += escalationVal * 0.15;
      if (severityVal >= 7) fit += 0.1;
      return Math.min(1.0, fit);
    },
  },
  {
    id: InterventionId.PHYSIOLOGICAL_GROUNDING,
    title: "5-4-3-2-1 Sensory Grounding",
    category: InterventionCategory.PHYSIOLOGICAL,
    shortDesc: "Multi-sensory orienting to pull attention back from internal overwhelm.",
    durationMinutes: 3,
    targetPatterns: [
      AnxietyPatternType.SENSORY_OVERWHELM,
      AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
      AnxietyPatternType.GENERAL_ANXIETY,
    ],
    evaluateFit: (state, pattern) => {
      const cognitiveLoadVal = state.cognitiveLoad?.value ?? 0;
      const arousalVal = state.arousal?.value ?? 0;

      let fit = 0.3;
      if (pattern === AnxietyPatternType.SENSORY_OVERWHELM) fit += 0.55;
      if (pattern === AnxietyPatternType.PHYSIOLOGICAL_ESCALATION) fit += 0.35;
      if (cognitiveLoadVal >= 0.6) fit += cognitiveLoadVal * 0.2;
      if (arousalVal >= 0.5) fit += arousalVal * 0.15;
      return Math.min(1.0, fit);
    },
  },
  {
    id: InterventionId.COGNITIVE_REFRAME,
    title: "Cognitive Reframe Assistant",
    category: InterventionCategory.COGNITIVE,
    shortDesc: "Deconstruct worry loops and identify balanced alternative perspectives.",
    durationMinutes: 4,
    targetPatterns: [
      AnxietyPatternType.COGNITIVE_WORRY_LOOP,
      AnxietyPatternType.GENERAL_ANXIETY,
    ],
    evaluateFit: (state, pattern) => {
      const ruminationVal = state.rumination?.value ?? 0;
      const arousalVal = state.arousal?.value ?? 0;
      const severityVal = state.severity?.value ?? 0;

      let fit = 0.25;
      if (pattern === AnxietyPatternType.COGNITIVE_WORRY_LOOP) fit += 0.55;
      if (ruminationVal >= 0.5) fit += ruminationVal * 0.25;

      // Contraindication: Acute panic / extreme physiological arousal (> 0.85)
      // When sympathetic surge is maximal, cognitive restructuring has low immediate efficacy
      if (arousalVal >= 0.85 || (severityVal >= 9 && arousalVal >= 0.7)) {
        fit -= 0.5;
      }
      return Math.max(0.05, Math.min(1.0, fit));
    },
  },
  {
    id: InterventionId.BEHAVIORAL_MICRO_ACTION,
    title: "Avoidance Micro-Action & Task Activation",
    category: InterventionCategory.BEHAVIORAL,
    shortDesc: "Break avoidance loops with a 2-minute actionable first step.",
    durationMinutes: 2,
    targetPatterns: [
      AnxietyPatternType.AVOIDANCE_DRIVEN,
      AnxietyPatternType.GENERAL_ANXIETY,
    ],
    evaluateFit: (state, pattern) => {
      const avoidanceVal = state.avoidance?.value ?? 0;
      const arousalVal = state.arousal?.value ?? 0;

      let fit = 0.2;
      if (pattern === AnxietyPatternType.AVOIDANCE_DRIVEN) fit += 0.6;
      if (avoidanceVal >= 0.5) fit += avoidanceVal * 0.25;

      // Contraindicated if acute panic is active
      if (arousalVal >= 0.8) fit -= 0.4;
      return Math.max(0.05, Math.min(1.0, fit));
    },
  },
  {
    id: InterventionId.NO_INTERVENTION,
    title: "Monitor Only",
    category: InterventionCategory.MONITOR,
    shortDesc: "State is stable and low-intensity. No active coping intervention needed.",
    durationMinutes: 0,
    targetPatterns: [AnxietyPatternType.STABLE_BASELINE],
    evaluateFit: (state, pattern) => {
      const severityVal = state.severity?.value ?? 0;
      const escalationVal = state.escalation?.value ?? 0;
      const arousalVal = state.arousal?.value ?? 0;
      const ruminationVal = state.rumination?.value ?? 0;

      if (pattern === AnxietyPatternType.STABLE_BASELINE) return 0.95;
      if (severityVal <= 2 && escalationVal < 0.2 && arousalVal < 0.3 && ruminationVal < 0.3) {
        return 0.85;
      }
      if (severityVal <= 3 && escalationVal === 0) return 0.6;
      return 0.05;
    },
  },
];
