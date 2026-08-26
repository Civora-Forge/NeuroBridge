/**
 * anxietyContextAdapter.js — Translates generic NeuroBridge ContextSnapshot signals into Anxiety Evidence
 *
 * Responsibilities:
 *   - Consumes existing ContextSnapshot (behavior, deviceInteraction, activity, environment, session, profile).
 *   - Extracts multi-signal behavioral friction evidence without jumping to simplistic diagnosis.
 *   - Compares current metrics against optional user baseline to detect personal deviation.
 *   - Computes composite friction index and suggested graduated response tier.
 *   - Transparent, explainable, and framework-independent pure JavaScript.
 */

/**
 * Evaluates individual telemetry signals and extracts evidence items
 *
 * @param {object} snapshot Generic ContextSnapshot
 * @param {object} [baseline] Optional user personal baseline
 * @returns {object} { evidence: Array, behavioralDeviation: object, frictionIndex: object, responseTier: number }
 */
export function adaptContextToAnxietyEvidence(snapshot = {}, baseline = null) {
  const safeSnapshot = snapshot || {};
  const behavior = safeSnapshot.behavior || {};
  const deviceInteraction = safeSnapshot.deviceInteraction || {};
  const activity = safeSnapshot.activity || {};
  const environment = safeSnapshot.environment || {};
  const session = safeSnapshot.session || {};

  const evidence = [];

  // 1. Task Friction / Route Churn
  const taskSwitchFreq = behavior.taskSwitchFrequency ?? (activity.taskSwitching === "high" ? 0.8 : activity.taskSwitching === "medium" ? 0.4 : 0.1);
  if (taskSwitchFreq >= 0.5) {
    evidence.push({
      type: "task_friction",
      strength: Number(Math.min(1.0, taskSwitchFreq).toFixed(2)),
      confidence: 0.75,
      source: "behavior.taskSwitchFrequency",
      description: `Elevated task switching frequency (${taskSwitchFreq}/min) suggests restlessness or navigation churn`,
    });
  }

  // 2. Hesitation / Typing Burden
  const typingPause = behavior.typingPauseDuration ?? 0;
  const correctionRate = behavior.correctionRate ?? 0;
  if (typingPause >= 2500 || correctionRate >= 0.3) {
    const strength = Number(
      Math.min(1.0, (typingPause / 4000) * 0.5 + correctionRate * 0.5).toFixed(2)
    );
    evidence.push({
      type: "hesitation_bursts",
      strength,
      confidence: 0.7,
      source: "behavior.typingPauseDuration + correctionRate",
      description: `High typing pause duration (${typingPause}ms) and correction rate (${Math.round(correctionRate * 100)}%) indicate cognitive hesitation or second-guessing`,
    });
  }

  // 3. Focus Instability / Interruptions
  const interruptions = deviceInteraction.focusSessionInterruptions ?? 0;
  if (interruptions >= 2) {
    evidence.push({
      type: "focus_instability",
      strength: Number(Math.min(1.0, interruptions * 0.3).toFixed(2)),
      confidence: 0.8,
      source: "deviceInteraction.focusSessionInterruptions",
      description: `Observed ${interruptions} focus interruptions (tab/window switches) during active session`,
    });
  }

  // 4. Task Inactivity Freeze (Avoidance / Paralysis)
  const idleDuration = behavior.idleDuration ?? deviceInteraction.timeSinceLastInteraction ?? 0;
  const hasActiveTask = Boolean(activity.currentTask || safeSnapshot.task?.currentTask);
  if (idleDuration >= 60 && hasActiveTask) {
    evidence.push({
      type: "task_inactivity_freeze",
      strength: Number(Math.min(1.0, idleDuration / 180).toFixed(2)),
      confidence: 0.75,
      source: "behavior.idleDuration with activeTask",
      description: `Extended inactivity (${Math.round(idleDuration)}s) on an active task suggests task initiation barrier or freeze`,
    });
  }

  // 5. Session Strain & Time-of-Day
  const sessionMinutes = (activity.sessionDurationMs ?? session.sessionLength ?? 0) / (60 * 1000);
  const isLateNight = environment.timeOfDay === "night";
  if (sessionMinutes >= 45 || (sessionMinutes >= 30 && isLateNight)) {
    evidence.push({
      type: "session_strain",
      strength: Number(Math.min(1.0, sessionMinutes / 90).toFixed(2)),
      confidence: 0.65,
      source: "activity.sessionDurationMs + environment.timeOfDay",
      description: `Prolonged continuous session (${Math.round(sessionMinutes)}m)${isLateNight ? " during late night" : ""} increases cumulative cognitive fatigue`,
    });
  }

  // 6. Repeated Navigation Churn
  const repeatedNav = deviceInteraction.repeatedNavigation ?? 0;
  if (repeatedNav >= 3) {
    evidence.push({
      type: "repeated_navigation_churn",
      strength: Number(Math.min(1.0, repeatedNav * 0.25).toFixed(2)),
      confidence: 0.7,
      source: "deviceInteraction.repeatedNavigation",
      description: `Rapid repeated navigation between pages (${repeatedNav} cycles) indicates disorientation or difficulty continuing`,
    });
  }

  // Compute Personal Behavioral Deviation
  let deviationValue = 0.1;
  let deviationConfidence = 0.4;
  const deviationEvidence = [];

  if (baseline && typeof baseline === "object") {
    // Compare against known user baseline
    const baselineSwitch = baseline.taskSwitchFrequency ?? 0.2;
    const baselineCorrection = baseline.correctionRate ?? 0.1;

    const switchDelta = Math.max(0, taskSwitchFreq - baselineSwitch);
    const corrDelta = Math.max(0, correctionRate - baselineCorrection);

    deviationValue = Number(Math.min(1.0, switchDelta * 1.5 + corrDelta * 1.5).toFixed(2));
    deviationConfidence = 0.85;
    deviationEvidence.push(
      `Task switching is ${taskSwitchFreq}/min (user baseline: ${baselineSwitch}/min)`
    );
  } else if (evidence.length > 0) {
    // Estimate deviation conservatively from aggregate evidence strength
    const avgStrength = evidence.reduce((sum, e) => sum + e.strength, 0) / evidence.length;
    deviationValue = Number(Math.min(1.0, avgStrength * (0.5 + evidence.length * 0.15)).toFixed(2));
    deviationConfidence = 0.6;
    deviationEvidence.push(
      `Inferred deviation from ${evidence.length} active telemetry friction signals (no personal baseline stored yet)`
    );
  } else {
    deviationEvidence.push("Behavioral telemetry matches calm baseline patterns");
  }

  // Composite Behavioral Friction Index
  const totalEvidenceScore = evidence.reduce((sum, e) => sum + e.strength * e.confidence, 0);
  const frictionScore = evidence.length > 0 ? Number(Math.min(1.0, totalEvidenceScore / 2.5).toFixed(2)) : 0.0;
  const overallConfidence = evidence.length > 0
    ? Number((evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length).toFixed(2))
    : 0.5;

  // Graduated Response Tier:
  // Tier 0: No meaningful evidence (Quiet)
  // Tier 1: Subtle prompt ("Need a quick reset?")
  // Tier 2: Gentle contextual suggestion ("Difficult point? Take a short reset")
  // Tier 3: Strong multi-signal evidence / acute
  let responseTier = 0;
  if (frictionScore >= 0.7 && overallConfidence >= 0.65) {
    responseTier = 3;
  } else if (frictionScore >= 0.45 || (evidence.length >= 2 && frictionScore >= 0.35)) {
    responseTier = 2;
  } else if (frictionScore >= 0.25 || evidence.length >= 1) {
    responseTier = 1;
  }

  return {
    evidence,
    behavioralDeviation: {
      value: deviationValue,
      confidence: deviationConfidence,
      baselineAvailable: Boolean(baseline),
      evidence: deviationEvidence,
    },
    frictionIndex: {
      value: frictionScore,
      confidence: overallConfidence,
    },
    responseTier,
    activeSignalsCount: evidence.length,
    timestamp: new Date().toISOString(),
  };
}
