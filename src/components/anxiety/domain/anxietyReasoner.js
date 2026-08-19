/**
 * anxietyReasoner.js — Explainable behavioral pattern reasoning for Anxiety states
 *
 * Responsibilities:
 *   - Evaluates multi-dimensional AnxietyState to identify the dominant behavioral pattern.
 *   - Uses neutral, behavioral reasoning language (not diagnostic clinical claims).
 *   - Supports uncertainty (defaults to GENERAL_ANXIETY when evidence is ambiguous).
 *   - Identifies STABLE_BASELINE when distress is low and non-escalating.
 *   - Identifies SENSORY_OVERWHELM, PHYSIOLOGICAL_ESCALATION, COGNITIVE_WORRY_LOOP, AVOIDANCE_DRIVEN.
 */

import { AnxietyPatternType } from "./anxietyTypes";

/**
 * Reasons over the current AnxietyState and produces structured pattern output
 *
 * @param {object} state Derived AnxietyState
 * @param {object} [context] Optional additional context (e.g. activeTask, environment)
 * @returns {object} ReasoningResult
 */
export function reasonAnxietyPattern(state, context = {}) {
  if (!state || typeof state !== "object") {
    return {
      pattern: AnxietyPatternType.GENERAL_ANXIETY,
      urgency: "low",
      dominantFactors: [],
      rationale: "Insufficient state data available. Monitoring for signals.",
      evidenceSummary: ["No structured state provided"],
    };
  }

  const severityVal = state.severity?.value ?? 0;
  const arousalVal = state.arousal?.value ?? 0;
  const arousalConf = state.arousal?.confidence ?? 0;
  const ruminationVal = state.rumination?.value ?? 0;
  const ruminationConf = state.rumination?.confidence ?? 0;
  const avoidanceVal = state.avoidance?.value ?? 0;
  const avoidanceConf = state.avoidance?.confidence ?? 0;
  const cognitiveLoadVal = state.cognitiveLoad?.value ?? 0;
  const escalationVal = state.escalation?.value ?? 0;

  // 1. Stable Baseline Check (Low severity, non-escalating, minimal distress signals)
  if (
    severityVal <= 3 &&
    escalationVal < 0.35 &&
    arousalVal < 0.45 &&
    ruminationVal < 0.45 &&
    avoidanceVal < 0.45
  ) {
    return {
      pattern: AnxietyPatternType.STABLE_BASELINE,
      urgency: "low",
      dominantFactors: ["severity_baseline", "stable_trend"],
      rationale:
        "Current anxiety rating is within a low, stable baseline range with no acute physiological or cognitive escalation.",
      evidenceSummary: [
        `Low severity (${severityVal}/10)`,
        "No active escalation velocity",
        "Minimal autonomic or cognitive worry signals",
      ],
    };
  }

  // 2. Physiological Escalation Check (High arousal, rapid escalation, or acute physical signals)
  // Confidence-weighted check
  const isHighArousal = arousalVal >= 0.55 && arousalConf >= 0.4;
  const isRapidEscalation = escalationVal >= 0.65 && severityVal >= 6;
  const isAcutePanic = severityVal >= 8 && arousalVal >= 0.5;

  if (isHighArousal || isRapidEscalation || isAcutePanic) {
    const dominantFactors = ["arousal", "severity"];
    if (escalationVal >= 0.5) dominantFactors.push("escalation");

    let urgency = "high";
    if (severityVal >= 8 || arousalVal >= 0.8) urgency = "critical";

    const rationale =
      arousalVal >= 0.7
        ? "Pronounced physiological activation (such as elevated heart rate, physical tension, or rapid onset) suggests autonomic nervous system escalation."
        : "Rapid escalation in distress indicates acute physiological arousal that benefits from immediate somatic regulation.";

    return {
      pattern: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
      urgency,
      dominantFactors,
      rationale,
      evidenceSummary: [
        `Arousal estimate: ${Math.round(arousalVal * 100)}%`,
        `Severity rating: ${severityVal}/10`,
        ...(state.arousal?.evidence || []),
        ...(state.escalation?.evidence || []),
      ],
    };
  }

  // 3. Sensory Overwhelm Check (High cognitive load + sensory tags / environment cues, lower rumination)
  const isSensoryOverwhelm =
    cognitiveLoadVal >= 0.65 &&
    (state.rawInput?.selectedTags?.includes("loud_environment") ||
      state.rawInput?.selectedTags?.includes("sensory_overload") ||
      context.environment === "loud") &&
    ruminationVal < 0.6;

  if (isSensoryOverwhelm) {
    return {
      pattern: AnxietyPatternType.SENSORY_OVERWHELM,
      urgency: severityVal >= 7 ? "high" : "moderate",
      dominantFactors: ["cognitiveLoad", "sensory_overload"],
      rationale:
        "Environmental or sensory input appears to be saturating cognitive processing capacity, creating sensory overwhelm.",
      evidenceSummary: [
        `High cognitive load (${Math.round(cognitiveLoadVal * 100)}%)`,
        "Sensory environmental signals present",
        ...(state.cognitiveLoad?.evidence || []),
      ],
    };
  }

  // 4. Cognitive Worry Loop Check (High rumination with reasonable confidence, moderate/low arousal)
  const isRuminationDominant = ruminationVal >= 0.5 && ruminationConf >= 0.4 && arousalVal < 0.65;
  if (isRuminationDominant) {
    const dominantFactors = ["rumination", "cognitiveLoad"];
    const urgency = severityVal >= 7 ? "high" : "moderate";

    const rationale =
      "Reported signals indicate repetitive worry loops, catastrophizing, or anticipatory thought patterns without acute physical panic.";

    return {
      pattern: AnxietyPatternType.COGNITIVE_WORRY_LOOP,
      urgency,
      dominantFactors,
      rationale,
      evidenceSummary: [
        `Rumination index: ${Math.round(ruminationVal * 100)}%`,
        `Cognitive load: ${Math.round(cognitiveLoadVal * 100)}%`,
        `Arousal remains sub-acute (${Math.round(arousalVal * 100)}%)`,
        ...(state.rumination?.evidence || []),
      ],
    };
  }

  // 5. Avoidance-Driven Anxiety Check (High avoidance, task paralysis, moderate distress)
  const isAvoidanceDominant = avoidanceVal >= 0.5 && avoidanceConf >= 0.4 && arousalVal < 0.65;
  if (isAvoidanceDominant) {
    const dominantFactors = ["avoidance", "cognitiveLoad"];
    const urgency = "moderate";

    const rationale =
      "Distress appears linked to task paralysis, procrastination, or avoidance of an impending responsibility.";

    return {
      pattern: AnxietyPatternType.AVOIDANCE_DRIVEN,
      urgency,
      dominantFactors,
      rationale,
      evidenceSummary: [
        `Avoidance score: ${Math.round(avoidanceVal * 100)}%`,
        `Severity rating: ${severityVal}/10`,
        ...(state.avoidance?.evidence || []),
      ],
    };
  }

  // 6. Uncertainty Fallback: General Anxiety
  return {
    pattern: AnxietyPatternType.GENERAL_ANXIETY,
    urgency: severityVal >= 7 ? "high" : "moderate",
    dominantFactors: ["severity"],
    rationale:
      "Signals indicate moderate general anxiety without a single dominant physiological, cognitive, or avoidance pattern.",
    evidenceSummary: [
      `Severity rating: ${severityVal}/10`,
      "No single behavioral dimension exceeds dominant threshold",
    ],
  };
}
