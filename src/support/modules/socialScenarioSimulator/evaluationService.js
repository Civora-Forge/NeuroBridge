/**
 * evaluationService.js — Deterministic evaluation for the Social Scenario
 * Simulator, with optional AI refinement through the shared AI facade.
 *
 * The score is ALWAYS computed deterministically from the user's wording so
 * behaviour stays stable and testable. When Gemini is available, the model may
 * refine the qualitative fields (strengths, improvements, detected cues,
 * suggested response, reasoning) — all Zod-validated — and is never allowed to
 * move the score. Speech notes are only included when the browser actually
 * reported timing data, and never claim to read emotion from audio.
 */

import { EVALUATION_DIMENSION_IDS } from "./socialScenarioTypes";
import { generateSocialScenarioEvaluation as callAiEvaluation } from "@/features/socialCommunication/services/aiService";
import { extractSpeechFeatures } from "@/features/socialCommunication/services/speechAnalysis";

const POLITE_MARKERS = ["please", "thanks", "thank you", "excuse me", "could you", "would you", "may i", "can i", "sorry", "appreciate", "mind if"];
const IMPOLITE_MARKERS = ["shut up", "whatever", "no way", "hate you", "stupid"];
const HEDGE_MARKERS = ["maybe", "i guess", "kind of", "sort of", "not sure", "i don't know", "i dunno"];
const ASSERTIVE_MARKERS = ["i think", "i want", "i need", "i can", "i will", "i'd like", "i would", "yes", "no"];
const ACKNOWLEDGEMENT_MARKERS = ["yes", "no", "sure", "okay", "ok", "good idea", "that makes sense", "i see", "sorry", "excuse me", "understand"];
const FIRST_PERSON = /(^|\s)(i|we|my|mine)(\s|$)/i;

const clamp = (value) => Math.max(0, Math.min(100, value));

function countMatches(text, markers) {
  return markers.filter((marker) => text.includes(marker)).length;
}

function toWords(text) {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean);
}

function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** How much of a target string's significant words appear in the reply. */
function overlapScore(reply, target) {
  const replyTokens = new Set(tokenize(reply));
  const targetTokens = [...new Set(tokenize(target))];
  if (targetTokens.length === 0) return 0;
  const hits = targetTokens.filter((token) => replyTokens.has(token)).length;
  return hits / targetTokens.length;
}

/** Score the wording of a response against the scenario (all 0-100). */
export function scoreResponseHeuristic(text, scenario = {}) {
  const raw = String(text ?? "").trim();
  const lower = raw.toLowerCase();
  const wordCount = toWords(raw).length;

  let politeness = 60;
  politeness += Math.min(30, countMatches(lower, POLITE_MARKERS) * 12);
  politeness -= Math.min(25, countMatches(lower, IMPOLITE_MARKERS) * 25);

  let clarity = 60;
  if (wordCount >= 3 && wordCount <= 30) clarity += 20;
  else if (wordCount === 1 || wordCount === 2) clarity -= 20;
  else if (wordCount > 40) clarity -= 15;
  if (/[.!?]$/.test(raw)) clarity += 5;

  const relevance = Math.round(
    60 + 40 * (0.6 * overlapScore(raw, scenario.suggestedResponse ?? "") + 0.4 * overlapScore(raw, scenario.question ?? "")),
  );

  let addressing = 50;
  if (ACKNOWLEDGEMENT_MARKERS.some((marker) => lower.includes(marker))) addressing += 30;
  if (FIRST_PERSON.test(raw)) addressing += 10;
  if (wordCount === 0) addressing = 0;

  const cueKeywords = (scenario.cues ?? [])
    .flatMap((cue) => tokenize(cue))
    .filter((token) => token.length > 3);
  const cueHits = cueKeywords.length > 0
    ? cueKeywords.filter((token) => lower.includes(token)).length / cueKeywords.length
    : 0;
  const cueRecognition = Math.round(55 + 45 * cueHits);

  const appropriateness = Math.round(
    clamp(politeness) * 0.5 + clamp(relevance) * 0.3 + clamp(addressing) * 0.2,
  );

  return {
    politeness: clamp(Math.round(politeness)),
    clarity: clamp(Math.round(clarity)),
    relevance: clamp(relevance),
    addressing: clamp(addressing),
    cueRecognition: clamp(cueRecognition),
    appropriateness: clamp(appropriateness),
  };
}

const DIMENSION_WEIGHTS = {
  politeness: 0.25,
  clarity: 0.2,
  relevance: 0.2,
  addressing: 0.15,
  cueRecognition: 0.1,
  appropriateness: 0.1,
};

export function computeOverallScore(subscores = {}) {
  const weighted = EVALUATION_DIMENSION_IDS.reduce(
    (sum, id) => sum + (Number.isFinite(subscores[id]) ? subscores[id] * DIMENSION_WEIGHTS[id] : 0),
    0,
  );
  return clamp(Math.round(weighted));
}

function kindnessCueLabel(dimensionId) {
  return {
    politeness: "You used respectful, polite language.",
    clarity: "Your reply was clear and easy to follow.",
    relevance: "Your reply stayed relevant to the situation.",
    addressing: "You acknowledged what the other person said.",
    cueRecognition: "You picked up on the social cues in the situation.",
    appropriateness: "Your response was socially appropriate.",
  }[dimensionId];
}

function improvementSuggestion(dimensionId, text) {
  const wordCount = toWords(text).length;
  return {
    politeness: "Adding a small 'please' or 'thank you' can soften the message.",
    clarity: "Try one clear sentence that says what you want.",
    relevance: "Stick closely to what happened in the situation.",
    addressing: "Start by responding to what the other person actually said.",
    cueRecognition: wordCount < 3
      ? "Try naming what you noticed about the other person."
      : "Consider the cues in the situation (tone, words, actions) in your reply.",
    appropriateness: "Keep the reply short and neutral — it keeps the exchange comfortable.",
  }[dimensionId];
}

function detectedCuesFromResponse(scenario, text) {
  const lower = String(text ?? "").toLowerCase();
  return (scenario?.cues ?? [])
    .map((cue) => {
      const keywords = tokenize(cue).filter((token) => token.length > 3);
      const matched = keywords.length > 0 && keywords.some((token) => lower.includes(token));
      return { cue, matched };
    })
    .filter((entry) => entry.matched)
    .map((entry) => entry.cue);
}

function buildSpeechNotes(capture) {
  if (!capture || typeof capture !== "object") return null;
  const duration = Number.isFinite(capture.durationMs) ? capture.durationMs : null;
  const features = extractSpeechFeatures({
    transcript: capture.transcript,
    durationMs: duration,
    latencyMs: Number.isFinite(capture.latencyMs) ? capture.latencyMs : null,
  });
  if (features.wordCount === 0 || duration === null || duration <= 0) {
    return {
      available: false,
      note: "The browser did not report timing details for this voice reply, so no pacing estimate is included.",
    };
  }
  const seconds = Math.max(1, Math.round(duration / 1000));
  const parts = [
    `Your spoken reply took about ${seconds} second${seconds === 1 ? "" : "s"} at roughly ${features.wpm} words per minute.`,
  ];
  if (Number.isFinite(features.estimatedSilenceMs) && features.estimatedSilenceMs > 400) {
    parts.push(`There were noticeable pauses (an estimated ${Math.round(features.estimatedSilenceMs / 1000)} second${Math.round(features.estimatedSilenceMs / 1000) === 1 ? "" : "s"} of silence).`);
  }
  if (features.fillerCount > 0) {
    parts.push(`A few filler words like 'um' were noticed.`);
  }
  parts.push("These are rough browser-based timing estimates — they describe pacing only, not emotion or confidence.");
  return { available: true, note: parts.join(" "), wpm: features.wpm, fillerCount: features.fillerCount };
}

/**
 * Build the complete structured evaluation from deterministic heuristics.
 * @returns {{ score: number, strengths: string[], improvements: string[],
 *   detectedCues: string[], suggestedResponse: string|null, reasoning: string,
 *   speechNotes: object|null, subscores: object, usedAi: boolean }}
 */
export function buildDeterministicEvaluation({ scenario, response, capture } = {}) {
  const text = String(response ?? "").trim();
  const wordCount = toWords(text).length;

  if (wordCount < 2) {
    const speechNotes = buildSpeechNotes(capture);
    return {
      score: 20,
      strengths: [],
      improvements: [
        "Reply with at least a short sentence so the other person knows where you stand.",
        "Try acknowledging the situation first, then a simple polite answer.",
      ],
      detectedCues: [],
      suggestedResponse: scenario?.suggestedResponse ?? null,
      reasoning:
        "The reply was too short to evaluate. A one-line, polite response is usually enough for this kind of situation.",
      speechNotes,
      subscores: null,
      usedAi: false,
    };
  }

  const subscores = scoreResponseHeuristic(text, scenario);
  const score = computeOverallScore(subscores);
  const detectedCues = detectedCuesFromResponse(scenario, text);

  const strengths = EVALUATION_DIMENSION_IDS.filter((id) => subscores[id] >= 75)
    .map(kindnessCueLabel)
    .slice(0, 3);
  if (detectedCues.length > 0 && !strengths.includes(kindnessCueLabel("cueRecognition"))) {
    strengths.unshift(kindnessCueLabel("cueRecognition"));
  }

  const improvements = EVALUATION_DIMENSION_IDS.filter((id) => subscores[id] < 65)
    .map((id) => improvementSuggestion(id, text))
    .slice(0, 3);

  const suggestedResponse = score < 70 ? scenario?.suggestedResponse ?? null : null;
  const lowDimensions = EVALUATION_DIMENSION_IDS.filter((id) => subscores[id] < 65)
    .map((id) => ({ id, label: { politeness: "politeness", clarity: "clarity", relevance: "relevance", addressing: "addressing what was said", cueRecognition: "reading the cues", appropriateness: "social appropriateness" }[id] }))
    .map((entry) => entry.label);

  const reasoning = lowDimensions.length > 0
    ? `The reply handled the situation, though ${lowDimensions.join(" and ")} could be strengthened next time.`
    : "The reply handled the situation well — it was clear, polite and relevant.";

  return {
    score,
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4),
    detectedCues: detectedCues.slice(0, 4),
    suggestedResponse,
    reasoning,
    speechNotes: buildSpeechNotes(capture),
    subscores,
    usedAi: false,
  };
}

function uniqueStrings(values, limit) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
    if (result.length >= limit) break;
  }
  return result;
}

/** Merge a Zod-validated AI refinement into the deterministic base. */
export function mergeAiRefinement(base, refined) {
  if (!base || !refined || typeof refined !== "object") return base;
  const strengths = uniqueStrings(
    [...(Array.isArray(refined.strengths) ? refined.strengths : []), ...base.strengths],
    4,
  );
  const improvements = uniqueStrings(
    [...(Array.isArray(refined.improvements) ? refined.improvements : []), ...base.improvements],
    4,
  );
  const detectedCues = uniqueStrings(
    [...base.detectedCues, ...(Array.isArray(refined.detectedCues) ? refined.detectedCues : [])],
    4,
  );
  return {
    ...base,
    score: base.score,
    strengths: strengths.length > 0 ? strengths : base.strengths,
    improvements: improvements.length > 0 ? improvements : base.improvements,
    detectedCues: detectedCues.length > 0 ? detectedCues : base.detectedCues,
    suggestedResponse: refined.suggestedResponse || base.suggestedResponse || null,
    reasoning: refined.reasoning || base.reasoning,
    usedAi: true,
  };
}

/**
 * Evaluate a user response. Deterministic score always; AI refines the
 * qualitative fields when available. Never throws.
 */
export async function evaluateResponse({ scenario, response, capture, config, apiKey } = {}) {
  const base = buildDeterministicEvaluation({ scenario, response, capture });
  if (!apiKey || !scenario) return base;
  try {
    const refined = await callAiEvaluation({ scenario, response, capture, config, apiKey });
    if (refined) return mergeAiRefinement(base, refined);
  } catch {
    // fall through to the deterministic evaluation
  }
  return base;
}
