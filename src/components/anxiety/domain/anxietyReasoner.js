/**
 * anxietyReasoner.js — Explainable behavioral pattern reasoning for Anxiety states
 *
 * Responsibilities:
 *   - Evaluates multi-dimensional AnxietyState and Context Evidence to identify behavioral patterns.
 *   - Uses neutral, behavioral reasoning language (not diagnostic clinical claims).
 *   - Identifies STABLE_BASELINE (Level 0) when behavioral deviation and friction are low.
 *   - Signals when lightweight semantic clarification is helpful (needsClarification).
 *   - Maps to PHYSIOLOGICAL_ESCALATION, COGNITIVE_WORRY_LOOP, AVOIDANCE_DRIVEN, SENSORY_OVERWHELM, or GENERAL_ANXIETY.
 */

import { AnxietyPatternType } from "./anxietyTypes";

/**
 * Reasons over the current AnxietyState and produces structured pattern output
 *
 * @param {object} state Derived AnxietyState from deriveAnxietyState()
 * @param {object} [context] Optional additional context
 * @returns {object} ReasoningResult
 */
export function reasonAnxietyPattern(state, context = {}) {
  if (!state || typeof state !== "object") {
    return {
      pattern: AnxietyPatternType.STABLE_BASELINE,
      urgency: "low",
      responseTier: 0,
      needsClarification: false,
      dominantFactors: [],
      rationale: "No active friction telemetry or state signals detected. Remaining quiet.",
      evidenceSummary: ["No signals observed"],
    };
  }

  const severityVal = state.severity?.value;
  const arousalVal = state.arousal?.value ?? 0;
  const arousalConf = state.arousal?.confidence ?? 0;
  const ruminationVal = state.rumination?.value ?? 0;
  const ruminationConf = state.rumination?.confidence ?? 0;
  const avoidanceVal = state.avoidance?.value ?? 0;
  const avoidanceConf = state.avoidance?.confidence ?? 0;
  const cognitiveLoadVal = state.cognitiveLoad?.value ?? 0;
  const behavioralDeviation = state.behavioralDeviation?.value ?? 0;
  const frictionScore = state.frictionIndex?.value ?? 0;
  const clarification = state.semanticClarification;
  const responseTier = state.responseTier ?? 0;

  // 1. Stable Baseline (Level 0: Quiet / Do nothing)
  const isBaseline =
    clarification == null &&
    (severityVal == null || severityVal <= 3) &&
    frictionScore < 0.25 &&
    behavioralDeviation < 0.35 &&
    arousalVal < 0.45 &&
    ruminationVal < 0.45 &&
    avoidanceVal < 0.45;

  if (isBaseline) {
    return {
      pattern: AnxietyPatternType.STABLE_BASELINE,
      urgency: "low",
      responseTier: 0,
      needsClarification: false,
      dominantFactors: ["baseline_behavior", "low_friction"],
      rationale:
        "Observable interaction signals are within normal baseline ranges with no meaningful behavioral friction. System remains quiet.",
      evidenceSummary: [
        "Normal interaction telemetry",
        "No task-switching churn or hesitation bursts",
        "Low behavioral deviation",
      ],
    };
  }

  // 2. Direct Semantic Clarifications (High confidence from user's 1-tap confirmation)
  if (clarification === "body") {
    return {
      pattern: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
      urgency: "high",
      responseTier: 3,
      needsClarification: false,
      dominantFactors: ["arousal", "body_sensation"],
      rationale:
        "Confirmed physical/body sensations indicate elevated autonomic nervous system arousal. Somatic regulation selected.",
      evidenceSummary: [
        "User confirmed body/physical tension as hardest factor",
        ...(state.arousal?.evidence || []),
      ],
    };
  }

  if (clarification === "thoughts") {
    return {
      pattern: AnxietyPatternType.COGNITIVE_WORRY_LOOP,
      urgency: "moderate",
      responseTier: 3,
      needsClarification: false,
      dominantFactors: ["rumination", "cognitive_friction"],
      rationale:
        "Confirmed repetitive thought patterns indicate cognitive worry loops. Cognitive restructuring selected.",
      evidenceSummary: [
        "User confirmed looping thoughts as hardest factor",
        ...(state.rumination?.evidence || []),
      ],
    };
  }

  if (clarification === "getting_started") {
    return {
      pattern: AnxietyPatternType.AVOIDANCE_DRIVEN,
      urgency: "moderate",
      responseTier: 3,
      needsClarification: false,
      dominantFactors: ["avoidance", "task_initiation_freeze"],
      rationale:
        "Confirmed task initiation barrier indicates avoidance paralysis. Behavioral activation selected.",
      evidenceSummary: [
        "User confirmed getting started as hardest factor",
        ...(state.avoidance?.evidence || []),
      ],
    };
  }

  // 3. Passive Telemetry Inferences

  // Physiological Escalation from Passive Telemetry (High motor churn, task friction, focus instability)
  const isPhysiological =
    arousalVal >= 0.55 && arousalConf >= 0.5;

  if (isPhysiological) {
    return {
      pattern: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
      urgency: arousalVal >= 0.75 ? "critical" : "high",
      responseTier: Math.max(2, responseTier),
      needsClarification: false,
      dominantFactors: ["arousal", "task_friction"],
      rationale:
        "High task-switching churn combined with focus interruptions suggests elevated physiological or motor restlessness.",
      evidenceSummary: [
        `Arousal estimate: ${Math.round(arousalVal * 100)}% (confidence: ${Math.round(arousalConf * 100)}%)`,
        ...(state.arousal?.evidence || []),
      ],
    };
  }

  // Cognitive Worry Loop from Passive Telemetry (Typing hesitation, correction bursts, repeated navigations)
  const isCognitiveWorry =
    ruminationVal >= 0.50 && ruminationConf >= 0.5 && arousalVal < 0.6;

  if (isCognitiveWorry) {
    return {
      pattern: AnxietyPatternType.COGNITIVE_WORRY_LOOP,
      urgency: "moderate",
      responseTier: Math.max(1, responseTier),
      needsClarification: false,
      dominantFactors: ["rumination", "hesitation_bursts"],
      rationale:
        "High typing pause duration and correction churn indicate cognitive hesitation or second-guessing loops.",
      evidenceSummary: [
        `Rumination index: ${Math.round(ruminationVal * 100)}%`,
        ...(state.rumination?.evidence || []),
      ],
    };
  }

  // Avoidance-Driven from Passive Telemetry (Extended inactivity on active task)
  const isAvoidance =
    avoidanceVal >= 0.50 && avoidanceConf >= 0.5 && arousalVal < 0.6;

  if (isAvoidance) {
    return {
      pattern: AnxietyPatternType.AVOIDANCE_DRIVEN,
      urgency: "moderate",
      responseTier: Math.max(1, responseTier),
      needsClarification: false,
      dominantFactors: ["avoidance", "task_freeze"],
      rationale:
        "Extended pause on an active task with behavioral deviation indicates an avoidance or task initiation block.",
      evidenceSummary: [
        `Avoidance estimate: ${Math.round(avoidanceVal * 100)}%`,
        ...(state.avoidance?.evidence || []),
      ],
    };
  }

  // Sensory Overwhelm from Passive Telemetry (Sensory environment + high cognitive load)
  const isSensory =
    cognitiveLoadVal >= 0.65 && context.environment === "loud";

  if (isSensory) {
    return {
      pattern: AnxietyPatternType.SENSORY_OVERWHELM,
      urgency: "moderate",
      responseTier: Math.max(2, responseTier),
      needsClarification: false,
      dominantFactors: ["cognitiveLoad", "sensory_environment"],
      rationale:
        "Sensory environmental factors combined with cumulative load indicate sensory overwhelm.",
      evidenceSummary: [
        `Cognitive load: ${Math.round(cognitiveLoadVal * 100)}%`,
        ...(state.cognitiveLoad?.evidence || []),
      ],
    };
  }

  // Ambiguous Friction -> Suggest lightweight semantic clarification
  const needsClarification = frictionScore >= 0.35 && clarification == null;

  return {
    pattern: AnxietyPatternType.GENERAL_ANXIETY,
    urgency: frictionScore >= 0.6 ? "high" : "moderate",
    responseTier: Math.max(1, responseTier),
    needsClarification,
    dominantFactors: ["behavioral_friction"],
    rationale:
      "Telemetry indicates noticeable behavioral friction, but signals are mixed across physiological, cognitive, and task factors.",
    evidenceSummary: [
      `Behavioral friction score: ${Math.round(frictionScore * 100)}%`,
      `Behavioral deviation: ${Math.round(behavioralDeviation * 100)}%`,
      ...(state.activeEvidence?.map((e) => e.description) || []),
    ],
  };
}
