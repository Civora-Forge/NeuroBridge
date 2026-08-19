/**
 * anxietyStateEngine.js — Multi-dimensional Anxiety State derivation with explicit evidence and confidence
 *
 * Responsibilities:
 *   - Consumes user input signals (severity, selected tags, trigger text, timestamp) and recent log history.
 *   - Produces an explainable, multi-dimensional AnxietyState object.
 *   - Every dimension carries { value, confidence, evidence }.
 *   - Normalizes temporal severity velocity.
 *   - Framework-independent pure JavaScript.
 */

import { CONTEXT_TAGS } from "./anxietyTypes";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "just", "very", "have",
  "been", "into", "about", "when", "what", "your", "will", "would", "could",
  "they", "them", "were", "is", "are", "was", "i", "my", "me", "to", "in", "it"
]);

/**
 * Tokenizes text and removes common stop words
 */
export function tokenizeText(text = "") {
  if (typeof text !== "string") return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Normalizes escalation velocity based on delta severity and elapsed time
 *
 * @param {number} currentSeverity (0-10)
 * @param {string|number|Date} currentTimestamp
 * @param {Array} history Array of previous log entries
 * @returns {{ value: number, confidence: number, evidence: string[] }}
 */
export function deriveEscalation(currentSeverity, currentTimestamp, history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      value: 0.0,
      confidence: 0.3,
      evidence: ["No previous check-in history available to compute velocity"],
    };
  }

  const sorted = [...history]
    .filter((entry) => entry && entry.loggedAt)
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

  if (sorted.length === 0) {
    return {
      value: 0.0,
      confidence: 0.3,
      evidence: ["No previous timestamped records found"],
    };
  }

  const previous = sorted[0];
  const prevSeverity = Number(previous.level ?? previous.severity ?? 0);
  const nowMs = new Date(currentTimestamp).getTime();
  const prevMs = new Date(previous.loggedAt).getTime();
  const elapsedMinutes = Math.max(1, Math.round((nowMs - prevMs) / (60 * 1000)));

  const severityDelta = currentSeverity - prevSeverity;

  // If severity decreased or remained unchanged
  if (severityDelta <= 0) {
    return {
      value: 0.0,
      confidence: 0.85,
      evidence: [
        `Severity changed by ${severityDelta} points over ${elapsedMinutes}m (stable/decreasing trend)`,
      ],
    };
  }

  // Velocity points per hour
  const pointsPerHour = (severityDelta / elapsedMinutes) * 60;

  // Normalized velocity score:
  // - Severity jump >= 4 in <= 15 minutes is extreme escalation (~0.85 - 1.0)
  // - Severity jump of 2-3 in <= 30 minutes is moderate-to-high escalation (~0.6 - 0.8)
  // - Severity jump of 2-3 over 6+ hours is gradual increase (~0.2 - 0.4)
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
    evidence: [
      `Severity increased by +${severityDelta} points (from ${prevSeverity} to ${currentSeverity}) over ${elapsedMinutes} minutes`,
    ],
  };
}

/**
 * Derives the complete multi-dimensional AnxietyState
 *
 * @param {object} input
 * @param {number} input.severity (0-10)
 * @param {string[]} [input.selectedTags] Array of tag ids (e.g. 'racing_heart', 'worry_loop')
 * @param {string} [input.triggerText] User-entered trigger or context description
 * @param {string|Date} [input.timestamp] Current timestamp
 * @param {Array} [history] Array of previous check-in entries
 * @returns {object} AnxietyState
 */
export function deriveAnxietyState(input = {}, history = []) {
  const rawSeverity = Number(input.severity ?? 4);
  const clampedSeverity = Math.max(0, Math.min(10, rawSeverity));
  const selectedTagIds = Array.isArray(input.selectedTags) ? input.selectedTags : [];
  const triggerText = typeof input.triggerText === "string" ? input.triggerText : "";
  const timestamp = input.timestamp || new Date().toISOString();

  // 1. Severity: direct user evidence
  const severity = {
    value: clampedSeverity,
    confidence: 1.0,
    evidence: [`Direct user rating: ${clampedSeverity}/10`],
  };

  // 2. Escalation: normalized temporal velocity
  const escalation = deriveEscalation(clampedSeverity, timestamp, history);

  // Match selected tags
  const physicalTags = selectedTagIds.filter((id) => CONTEXT_TAGS[id.toUpperCase()]?.category === "physical");
  const cognitiveTags = selectedTagIds.filter((id) => CONTEXT_TAGS[id.toUpperCase()]?.category === "cognitive");
  const behavioralTags = selectedTagIds.filter((id) => CONTEXT_TAGS[id.toUpperCase()]?.category === "behavioral");
  const sensoryTags = selectedTagIds.filter((id) => CONTEXT_TAGS[id.toUpperCase()]?.category === "sensory");

  // Keyword tokens
  const tokens = tokenizeText(triggerText);
  const tokenSet = new Set(tokens);

  // 3. Physiological Arousal derivation
  const arousalEvidence = [];
  let arousalScore = 0.0;
  let arousalConfidence = 0.4;

  if (physicalTags.length > 0) {
    const matchedLabels = physicalTags.map((id) => CONTEXT_TAGS[id.toUpperCase()]?.label || id);
    arousalScore += Math.min(0.65, physicalTags.length * 0.35);
    arousalConfidence = Math.min(0.95, 0.6 + physicalTags.length * 0.15);
    arousalEvidence.push(`Physical tension signals reported: ${matchedLabels.join(", ")}`);
  }

  // Keyword triggers indicating physical arousal
  const arousalKeywords = ["heart", "pulse", "palpitation", "breathe", "breath", "dizzy", "shake", "shaking", "panic", "choking", "sweat", "chest"];
  const matchedArousalKeywords = arousalKeywords.filter((kw) => tokenSet.has(kw));
  if (matchedArousalKeywords.length > 0) {
    arousalScore += Math.min(0.3, matchedArousalKeywords.length * 0.15);
    arousalConfidence = Math.max(arousalConfidence, 0.7);
    arousalEvidence.push(`Arousal-related keywords detected: "${matchedArousalKeywords.join('", "')}"`);
  }

  // Base contribution from high severity + rapid escalation
  if (clampedSeverity >= 7) {
    const severityBoost = (clampedSeverity - 6) * 0.08;
    arousalScore += severityBoost;
    arousalEvidence.push(`High severity rating (${clampedSeverity}/10) elevated baseline arousal estimate`);
  }
  if (escalation.value >= 0.6) {
    arousalScore += escalation.value * 0.2;
    arousalEvidence.push(`Rapid onset velocity contributed to physiological arousal estimate`);
  }

  if (arousalEvidence.length === 0) {
    arousalEvidence.push("No acute physical arousal signals selected or detected");
  }

  const arousal = {
    value: Number(Math.max(0.0, Math.min(1.0, arousalScore)).toFixed(2)),
    confidence: Number(Math.max(0.2, Math.min(1.0, arousalConfidence)).toFixed(2)),
    evidence: arousalEvidence,
  };

  // 4. Rumination derivation
  const ruminationEvidence = [];
  let ruminationScore = 0.0;
  let ruminationConfidence = 0.4;

  if (cognitiveTags.length > 0) {
    const matchedLabels = cognitiveTags.map((id) => CONTEXT_TAGS[id.toUpperCase()]?.label || id);
    ruminationScore += Math.min(0.7, cognitiveTags.length * 0.35);
    ruminationConfidence = Math.min(0.95, 0.65 + cognitiveTags.length * 0.15);
    ruminationEvidence.push(`Cognitive worry signals selected: ${matchedLabels.join(", ")}`);
  }

  const ruminationKeywords = ["worry", "worried", "whatif", "fail", "failing", "disaster", "ruined", "overthinking", "thinking", "loop", "mistake", "judging", "judge", "afraid"];
  const matchedRuminationKeywords = ruminationKeywords.filter((kw) => tokenSet.has(kw));
  if (matchedRuminationKeywords.length > 0) {
    ruminationScore += Math.min(0.4, matchedRuminationKeywords.length * 0.15);
    ruminationConfidence = Math.max(ruminationConfidence, 0.7);
    ruminationEvidence.push(`Rumination-oriented keywords in trigger text: "${matchedRuminationKeywords.join('", "')}"`);
  }

  if (ruminationEvidence.length === 0) {
    ruminationEvidence.push("No cognitive worry loops explicitly selected or detected");
  }

  const rumination = {
    value: Number(Math.max(0.0, Math.min(1.0, ruminationScore)).toFixed(2)),
    confidence: Number(Math.max(0.2, Math.min(1.0, ruminationConfidence)).toFixed(2)),
    evidence: ruminationEvidence,
  };

  // 5. Avoidance derivation
  const avoidanceEvidence = [];
  let avoidanceScore = 0.0;
  let avoidanceConfidence = 0.4;

  if (behavioralTags.length > 0) {
    const matchedLabels = behavioralTags.map((id) => CONTEXT_TAGS[id.toUpperCase()]?.label || id);
    avoidanceScore += Math.min(0.75, behavioralTags.length * 0.4);
    avoidanceConfidence = Math.min(0.95, 0.7 + behavioralTags.length * 0.15);
    avoidanceEvidence.push(`Avoidance/paralysis signals selected: ${matchedLabels.join(", ")}`);
  }

  const avoidanceKeywords = ["procrastinate", "procrastinating", "avoid", "avoiding", "delay", "can't start", "stuck", "paralyzed", "putting off", "behind"];
  const matchedAvoidanceKeywords = avoidanceKeywords.filter((kw) => tokenSet.has(kw));
  if (matchedAvoidanceKeywords.length > 0) {
    avoidanceScore += Math.min(0.4, matchedAvoidanceKeywords.length * 0.2);
    avoidanceConfidence = Math.max(avoidanceConfidence, 0.7);
    avoidanceEvidence.push(`Avoidance keywords in trigger text: "${matchedAvoidanceKeywords.join('", "')}"`);
  }

  if (avoidanceEvidence.length === 0) {
    avoidanceEvidence.push("No task avoidance signals selected or detected");
  }

  const avoidance = {
    value: Number(Math.max(0.0, Math.min(1.0, avoidanceScore)).toFixed(2)),
    confidence: Number(Math.max(0.2, Math.min(1.0, avoidanceConfidence)).toFixed(2)),
    evidence: avoidanceEvidence,
  };

  // 6. Cognitive Load derivation
  const cognitiveLoadEvidence = [];
  let cognitiveLoadScore = 0.1;
  let cognitiveLoadConfidence = 0.4;

  if (sensoryTags.length > 0) {
    const matchedLabels = sensoryTags.map((id) => CONTEXT_TAGS[id.toUpperCase()]?.label || id);
    cognitiveLoadScore += Math.min(0.5, sensoryTags.length * 0.3);
    cognitiveLoadConfidence = Math.max(cognitiveLoadConfidence, 0.75);
    cognitiveLoadEvidence.push(`Sensory environmental overwhelm signals: ${matchedLabels.join(", ")}`);
  }

  if (clampedSeverity >= 6) {
    cognitiveLoadScore += (clampedSeverity / 10) * 0.4;
    cognitiveLoadEvidence.push(`Elevated anxiety intensity (${clampedSeverity}/10) consumes cognitive working memory`);
  }
  if (rumination.value >= 0.5) {
    cognitiveLoadScore += rumination.value * 0.3;
    cognitiveLoadEvidence.push("High internal rumination adds to cognitive processing load");
  }

  if (cognitiveLoadEvidence.length === 0) {
    cognitiveLoadEvidence.push("Working memory load within baseline bounds");
  }

  const cognitiveLoad = {
    value: Number(Math.max(0.0, Math.min(1.0, cognitiveLoadScore)).toFixed(2)),
    confidence: Number(Math.max(0.3, Math.min(1.0, cognitiveLoadConfidence)).toFixed(2)),
    evidence: cognitiveLoadEvidence,
  };

  // Aggregate overall confidence
  const overallConfidence = Number(
    (
      (severity.confidence +
        escalation.confidence +
        arousal.confidence +
        rumination.confidence +
        avoidance.confidence +
        cognitiveLoad.confidence) /
      6
    ).toFixed(2)
  );

  return {
    severity,
    escalation,
    arousal,
    rumination,
    avoidance,
    cognitiveLoad,
    overallConfidence,
    timestamp,
    rawInput: {
      severity: clampedSeverity,
      selectedTags: selectedTagIds,
      triggerText,
    },
  };
}
