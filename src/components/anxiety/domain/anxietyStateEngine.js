/**
 * anxietyStateEngine.js — Multi-dimensional Anxiety State derivation with explicit evidence and confidence
 *
 * Responsibilities:
 *   - Consumes passive ContextSnapshot via anxietyContextAdapter + optional lightweight semantic input.
 *   - Produces an explainable, multi-dimensional AnxietyState object.
 *   - Every dimension carries { value, confidence, evidence }.
 *   - Does NOT fabricate clinical certainty or direct severity measurements.
 *   - Framework-independent pure JavaScript.
 */

import { adaptContextToAnxietyEvidence } from "./anxietyContextAdapter";

/**
 * Normalizes escalation velocity based on previous check-in records or telemetry history
 */
export function deriveEscalation(currentSeverity, currentTimestamp, history = []) {
  if (!Array.isArray(history) || history.length === 0 || currentSeverity == null) {
    return {
      value: 0.0,
      confidence: 0.3,
      evidence: ["No historical check-in velocity recorded"],
    };
  }

  const sorted = [...history]
    .filter((entry) => entry && entry.loggedAt)
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

  if (sorted.length === 0) {
    return {
      value: 0.0,
      confidence: 0.3,
      evidence: ["No timestamped historical records found"],
    };
  }

  const previous = sorted[0];
  const prevSeverity = Number(previous.level ?? previous.severity ?? 0);
  const nowMs = new Date(currentTimestamp || Date.now()).getTime();
  const prevMs = new Date(previous.loggedAt).getTime();
  const elapsedMinutes = Math.max(1, Math.round((nowMs - prevMs) / (60 * 1000)));

  const severityDelta = currentSeverity - prevSeverity;

  if (severityDelta <= 0) {
    return {
      value: 0.0,
      confidence: 0.85,
      evidence: [`Distress stable or decreased (${severityDelta} delta over ${elapsedMinutes}m)`],
    };
  }

  let rawVelocityScore = 0;
  if (elapsedMinutes <= 15) {
    rawVelocityScore = Math.min(1.0, (severityDelta / 4) * 0.95);
  } else if (elapsedMinutes <= 60) {
    const timeDecay = 1 - (elapsedMinutes - 15) / 90;
    rawVelocityScore = Math.min(1.0, (severityDelta / 5) * timeDecay);
  } else {
    rawVelocityScore = Math.min(0.5, severityDelta / 10);
  }

  const normalizedValue = Math.max(0.0, Math.min(1.0, Number(rawVelocityScore.toFixed(2))));
  const confidence = Math.min(0.95, Number((0.6 + Math.min(0.35, 10 / elapsedMinutes)).toFixed(2)));

  return {
    value: normalizedValue,
    confidence,
    evidence: [`Distress increased by +${severityDelta} over ${elapsedMinutes} minutes`],
  };
}

/**
 * Derives the complete multi-dimensional AnxietyState from passive context + optional semantic clarification
 *
 * @param {object} params
 * @param {object} [params.contextSnapshot] Generic ContextSnapshot from ContextProvider
 * @param {"body"|"thoughts"|"getting_started"|null} [params.semanticClarification] Optional 1-tap clarification
 * @param {number|null} [params.directSeverity] Optional direct user severity rating (0-10)
 * @param {Array} [params.history] Recent check-in / session history
 * @param {object} [params.userBaseline] Optional user baseline metrics
 * @param {string} [params.timestamp]
 * @returns {object} AnxietyState
 */
export function deriveAnxietyState({
  contextSnapshot = {},
  semanticClarification = null,
  directSeverity = null,
  history = [],
  userBaseline = null,
  timestamp = new Date().toISOString(),
} = {}) {
  // 1. Adapt Generic Context to Anxiety Evidence
  const contextEvidenceResult = adaptContextToAnxietyEvidence(contextSnapshot, userBaseline);
  const evidenceList = contextEvidenceResult.evidence || [];
  const behavioralDeviation = contextEvidenceResult.behavioralDeviation;
  const frictionIndex = contextEvidenceResult.frictionIndex;

  // 2. Severity: Direct Evidence (if provided) or Null (no fabrication)
  const severity = directSeverity != null
    ? {
        value: Math.max(0, Math.min(10, Number(directSeverity))),
        confidence: 1.0,
        evidence: [`Direct user rating: ${directSeverity}/10`],
      }
    : {
        value: null,
        confidence: 0.0,
        evidence: ["Severity not explicitly reported (inferred from behavioral context)"],
      };

  // 3. Escalation Velocity
  const escalation = deriveEscalation(severity.value, timestamp, history);

  // 4. Physiological Arousal Derivation
  let arousalValue = 0.15;
  let arousalConfidence = 0.35;
  const arousalEvidence = [];

  if (semanticClarification === "body") {
    arousalValue = 0.85;
    arousalConfidence = 0.95;
    arousalEvidence.push("User explicitly confirmed body/physical tension as hardest factor");
  } else {
    // Look for biometrics in snapshot
    const biometrics = contextSnapshot?.biometrics || {};
    if (typeof biometrics.electrodermalActivityMuS === "number") {
      const eda = biometrics.electrodermalActivityMuS;
      if (eda > 4) {
        arousalValue = Math.max(arousalValue, 0.75);
        arousalConfidence = Math.max(arousalConfidence, 0.8);
        arousalEvidence.push(`Elevated electrodermal activity (${eda}μS) indicates physiological arousal`);
      }
    }

    // Look for task friction / restlessness evidence
    const taskFriction = evidenceList.find((e) => e.type === "task_friction");
    const focusInstability = evidenceList.find((e) => e.type === "focus_instability");
    if (taskFriction && focusInstability) {
      arousalValue = Number(Math.min(0.8, 0.4 + taskFriction.strength * 0.25 + focusInstability.strength * 0.2).toFixed(2));
      arousalConfidence = Number(Math.min(0.8, (taskFriction.confidence + focusInstability.confidence) / 2).toFixed(2));
      arousalEvidence.push("Rapid task-switching and focus instability suggest motor/physiological restlessness");
    } else if (taskFriction) {
      arousalValue = Number(Math.min(0.6, 0.3 + taskFriction.strength * 0.25).toFixed(2));
      arousalConfidence = 0.6;
      arousalEvidence.push("Task switching churn observed");
    } else {
      arousalEvidence.push("No acute physiological arousal indicators detected");
    }
  }

  const arousal = {
    value: arousalValue,
    confidence: arousalConfidence,
    evidence: arousalEvidence,
  };

  // 5. Rumination Derivation
  let ruminationValue = 0.15;
  let ruminationConfidence = 0.35;
  const ruminationEvidence = [];

  if (semanticClarification === "thoughts") {
    ruminationValue = 0.85;
    ruminationConfidence = 0.95;
    ruminationEvidence.push("User explicitly confirmed looping thoughts as hardest factor");
  } else {
    const hesitation = evidenceList.find((e) => e.type === "hesitation_bursts");
    const navChurn = evidenceList.find((e) => e.type === "repeated_navigation_churn");

    if (hesitation) {
      ruminationValue = Number(Math.min(0.85, 0.35 + hesitation.strength * 0.45).toFixed(2));
      ruminationConfidence = hesitation.confidence;
      ruminationEvidence.push(hesitation.description);
    }
    if (navChurn) {
      ruminationValue = Number(Math.min(0.85, ruminationValue + navChurn.strength * 0.2).toFixed(2));
      ruminationConfidence = Math.max(ruminationConfidence, navChurn.confidence);
      ruminationEvidence.push(navChurn.description);
    }
    if (ruminationEvidence.length === 0) {
      ruminationEvidence.push("Cognitive fluency within normal bounds");
    }
  }

  const rumination = {
    value: ruminationValue,
    confidence: ruminationConfidence,
    evidence: ruminationEvidence,
  };

  // 6. Avoidance Derivation
  let avoidanceValue = 0.15;
  let avoidanceConfidence = 0.35;
  const avoidanceEvidence = [];

  if (semanticClarification === "getting_started") {
    avoidanceValue = 0.85;
    avoidanceConfidence = 0.95;
    avoidanceEvidence.push("User explicitly confirmed starting/task paralysis as hardest factor");
  } else {
    const taskFreeze = evidenceList.find((e) => e.type === "task_inactivity_freeze");
    if (taskFreeze) {
      avoidanceValue = Number(Math.min(0.9, 0.4 + taskFreeze.strength * 0.45).toFixed(2));
      avoidanceConfidence = taskFreeze.confidence;
      avoidanceEvidence.push(taskFreeze.description);
    } else {
      avoidanceEvidence.push("Normal task engagement observed with no prolonged freezes");
    }
  }

  const avoidance = {
    value: avoidanceValue,
    confidence: avoidanceConfidence,
    evidence: avoidanceEvidence,
  };

  // 7. Cognitive Load Derivation
  let cognitiveLoadValue = 0.15;
  let cognitiveLoadConfidence = 0.4;
  const cognitiveLoadEvidence = [];

  const sessionStrain = evidenceList.find((e) => e.type === "session_strain");
  if (sessionStrain) {
    cognitiveLoadValue += sessionStrain.strength * 0.4;
    cognitiveLoadConfidence = Math.max(cognitiveLoadConfidence, sessionStrain.confidence);
    cognitiveLoadEvidence.push(sessionStrain.description);
  }
  if (behavioralDeviation.value >= 0.5) {
    cognitiveLoadValue += behavioralDeviation.value * 0.35;
    cognitiveLoadEvidence.push("High behavioral deviation contributes to cumulative cognitive load");
  }
  if (cognitiveLoadEvidence.length === 0) {
    cognitiveLoadEvidence.push("Working memory load within baseline bounds");
  }

  const cognitiveLoad = {
    value: Number(Math.min(1.0, cognitiveLoadValue).toFixed(2)),
    confidence: Number(Math.min(1.0, cognitiveLoadConfidence).toFixed(2)),
    evidence: cognitiveLoadEvidence,
  };

  // Overall Confidence
  const overallConfidence = Number(
    (
      (behavioralDeviation.confidence +
        arousal.confidence +
        rumination.confidence +
        avoidance.confidence +
        cognitiveLoad.confidence) /
      5
    ).toFixed(2)
  );

  return {
    severity,
    escalation,
    arousal,
    rumination,
    avoidance,
    cognitiveLoad,
    behavioralDeviation,
    frictionIndex,
    responseTier: contextEvidenceResult.responseTier,
    activeEvidence: evidenceList,
    overallConfidence,
    semanticClarification,
    timestamp,
  };
}
