/**
 * feedbackService.js — Communication scoring for the Social Scenario Simulator.
 *
 * Deterministic, rule-based feedback: five subscores (clarity, politeness,
 * confidence, emotional appropriateness, completeness) are computed from the
 * player's actual wording and blended with the chosen scripted option's base
 * quality. The report is always framed positively — the module never shames.
 */

import {
  FEEDBACK_SUBSCOE,
  FEEDBACK_SUBSCOE_KEYS,
} from "./socialScenarioTypes";

const clamp = (value) => Math.max(0, Math.min(100, value));
const round = (value) => Math.round(value * 100) / 100;

const POLITE_MARKERS = ["please", "thanks", "thank you", "excuse me", "could you", "would you", "may i", "can i", "sorry", "appreciate"];
const IMPOLITE_MARKERS = ["shut up", "whatever", "hate you"];
const HEDGE_MARKERS = ["maybe", "i guess", "kind of", "sort of", "not sure", "i don't know", "i dunno"];
const ASSERTIVE_MARKERS = ["i think", "i want", "i need", "i can", "i will", "i'd like", "i would", "yes", "no"];
const EMPATHY_MARKERS = ["understand", "help", "feel", "sorry", "glad", "happy", "frustrat", "appreciate"];
const NEGATIVE_ABSOLUTES = ["hate", "never", "always", "no way", "everything"];
const SUBJECT_PRONOUN = /(^|\s)(i|we|you|he|she|it|they)(\s|$)/i;
const SENTENCE_END = /[.!?]$/;

function countMatches(text, markers) {
  return markers.filter((marker) => text.includes(marker)).length;
}

/** Heuristic subscores (0-100) for a single free-text reply. */
export function scorePlayerText(text) {
  const raw = String(text ?? "").trim();
  const lower = raw.toLowerCase();
  const wordCount = raw.split(/\s+/).filter(Boolean).length;

  let politeness = 60;
  politeness += Math.min(30, countMatches(lower, POLITE_MARKERS) * 15);
  politeness -= Math.min(25, countMatches(lower, IMPOLITE_MARKERS) * 25);

  let clarity = 60;
  if (wordCount >= 2 && wordCount <= 25) clarity += 20;
  else if (wordCount === 1) clarity -= 15;
  else if (wordCount > 40) clarity -= 15;
  else if (wordCount > 25) clarity -= 5;
  if (raw.endsWith("?")) clarity += 5;

  let confidence = 60;
  confidence -= Math.min(30, countMatches(lower, HEDGE_MARKERS) * 15);
  confidence += Math.min(20, countMatches(lower, ASSERTIVE_MARKERS) * 10);
  if (wordCount >= 1 && wordCount <= 8) confidence += 10;

  let emotionalAppropriateness = 60;
  emotionalAppropriateness += Math.min(15, countMatches(lower, EMPATHY_MARKERS) * 5);
  emotionalAppropriateness += Math.min(10, countMatches(lower, POLITE_MARKERS) * 3);
  if (wordCount > 2 && raw === raw.toUpperCase()) emotionalAppropriateness -= 20;
  emotionalAppropriateness -= Math.min(15, countMatches(lower, NEGATIVE_ABSOLUTES) * 8);

  let completeness = 60;
  if (SENTENCE_END.test(raw)) completeness += 10;
  if (wordCount >= 2) completeness += 10;
  else if (wordCount === 1) completeness -= 20;
  if (SUBJECT_PRONOUN.test(raw)) completeness += 10;
  if (raw.endsWith("?")) completeness += 5;

  return {
    [FEEDBACK_SUBSCOE.CLARITY]: clamp(round(clarity)),
    [FEEDBACK_SUBSCOE.POLITENESS]: clamp(round(politeness)),
    [FEEDBACK_SUBSCOE.CONFIDENCE]: clamp(round(confidence)),
    [FEEDBACK_SUBSCOE.EMOTIONAL_APPROPRIATENESS]: clamp(round(emotionalAppropriateness)),
    [FEEDBACK_SUBSCOE.COMPLETENESS]: clamp(round(completeness)),
  };
}

/** Per-turn subscores: blend the scripted option quality with the wording
 *  heuristic. When no quality is supplied (free-form turns), the heuristic
 *  alone is used. */
export function scoreTurn(text, quality) {
  const heuristic = scorePlayerText(text);
  if (!quality || typeof quality !== "object") {
    return heuristic;
  }
  const blended = {};
  for (const key of FEEDBACK_SUBSCOE_KEYS) {
    const base = Number(quality[key]);
    blended[key] = Number.isFinite(base)
      ? clamp(Math.round(base * 0.6 + heuristic[key] * 0.4))
      : heuristic[key];
  }
  return blended;
}

function mean(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

export function encouragementForScore(score) {
  if (score >= 85) {
    return "Outstanding work! You used clear, warm communication — the other person would feel completely at ease.";
  }
  if (score >= 70) {
    return "Really strong practice. You communicated clearly and kept the conversation comfortable.";
  }
  if (score >= 55) {
    return "Good progress! You held the conversation well. A small tweak to your wording will take this even further.";
  }
  return "Great first step! You practised a real conversation, and every round builds confidence. Pick one suggestion to try next time.";
}

/** Build the full feedback report for a completed (or abandoned) session. */
export function buildFeedbackReport({ scenario, session }) {
  const turns = Array.isArray(session?.turns) ? session.turns : [];
  const alternativePool = Array.isArray(scenario?.alternativePool) ? scenario.alternativePool : [];

  if (turns.length === 0) {
    return {
      communicationScore: null,
      subscores: null,
      strengths: [],
      misunderstandings: [],
      alternatives: alternativePool,
      encouragement:
        "Press start and have your first practice conversation — every reply is a step forward.",
      summary: "No replies recorded yet in this session.",
      perTurn: [],
    };
  }

  const perTurn = turns.map((turn) => {
    const subscores = scoreTurn(turn.playerText, turn.quality);
    const keys = Object.values(subscores);
    return {
      id: turn.id,
      playerText: turn.playerText,
      matched: turn.matched,
      unexpected: turn.unexpected,
      cue: turn.cue ?? "",
      suggestion: turn.suggestion ?? "",
      subscores,
      mean: Math.round(mean(keys)),
    };
  });

  const overallSubscores = {};
  for (const key of FEEDBACK_SUBSCOE_KEYS) {
    overallSubscores[key] = Math.round(mean(perTurn.map((turn) => turn.subscores[key])));
  }
  const communicationScore = Math.round(mean(perTurn.map((turn) => turn.mean)));

  const strengths = uniqueStrings(
    perTurn.filter((turn) => turn.mean >= 75).map((turn) => turn.cue),
  ).slice(0, 4);

  const misunderstandings = uniqueStrings(
    perTurn.filter((turn) => !turn.matched).map((turn) => turn.suggestion),
  ).slice(0, 3);

  const alternatives = uniqueStrings([
    ...perTurn.filter((turn) => turn.mean < 75).map((turn) => turn.suggestion),
    ...alternativePool,
  ]).slice(0, 4);

  return {
    communicationScore,
    subscores: overallSubscores,
    strengths,
    misunderstandings,
    alternatives,
    encouragement: encouragementForScore(communicationScore),
    summary: `You scored ${communicationScore}/100 in “${scenario?.title ?? "this scenario"}”.`,
    perTurn,
  };
}
