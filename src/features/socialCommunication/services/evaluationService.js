/**
 * evaluationService.js — Structured communication evaluation for the Social
 * Communication Simulator.
 *
 * The numeric scores are computed deterministically from interpretable,
 * text/transcript features — never from an arbitrary LLM judgement. An
 * optional AI refinement may enrich only the QUALITATIVE fields (strengths,
 * improvements, alternatives, comment); scores are always owned by this
 * module. The `tone` dimension may additionally blend in an optional AI
 * politeness rating (clamped, only when available) so that rudeness which is
 * hard to detect from surface words — sarcasm, passive aggression — is still
 * caught once an API key is configured. No dimension penalises eye contact,
 * gestures, accent, or register.
 */

import {
  EVALUATION_DIMENSIONS,
  EVALUATION_DIMENSION_IDS,
  EVALUATION_VERSION,
  SCORE_BANDS,
  SPEAKER,
} from "../types/communicationTypes";
import { generateEvaluationInsights, generateToneAssessment } from "./aiService";
import { countWords } from "./speechAnalysis";

const STOPWORDS = new Set([
  "the", "a", "an", "to", "and", "of", "for", "in", "on", "with", "your", "you",
  "i", "my", "it", "is", "are", "be", "that", "this", "so", "at", "from", "have",
  "has", "how", "what", "when", "where", "who", "why", "do", "does", "can",
  "could", "should", "would", "will", "about", "want", "need", "like", "get",
  "make", "them", "they", "their", "his", "her", "its", "we", "our", "there",
  "then", "than", "not", "no", "but", "or", "as", "if", "me", "up", "out", "now",
]);

const ACK_PATTERNS = [
  /\bokay\b/, /\bgot it\b/, /\bi see\b/, /\bmakes sense\b/, /\bsure\b/,
  /\bright\b/, /\bunderstood\b/, /\bthanks\b/, /\bthank you\b/, /\bthat works\b/,
  /\bno problem\b/, /\bsounds good\b/,
];

const QUESTION_PATTERNS = [
  /\?\s*$/, /\bwhat\b/, /\bhow\b/, /\bcould you\b/, /\bcan you\b/, /\bwould you\b/,
  /\bdo you\b/, /\bdoes\b/, /\bwhy\b/, /\bwhen\b/, /\bwhere\b/, /\bwhich\b/,
];

const POLITE_PATTERNS = [
  /\bplease\b/, /\bthank you\b/, /\bthanks\b/, /\bcould\b/, /\bwould you\b/,
  /\bif that's okay\b/, /\bif that works\b/, /\bsorry\b/, /\bno problem\b/,
];

// Rudeness is hard to detect from words alone; these are deliberately
// conservative so we never penalise a person for setting a boundary or
// asserting a preference. Each pattern carries a severity weight.
const RUDENESS_PATTERNS = [
  { pattern: /\b(shut up|stupid|idiot|moron|dumb|loser|jerk|annoying|clueless|ridiculous)\b/i, weight: 2 },
  { pattern: /\bdamn\b/i, weight: 1 },
  { pattern: /\b(give me|gimme|you must|do it now|right now|listen to me|go away)\b/i, weight: 2 },
  { pattern: /\b(whatever|i don't care|i do not care|not my problem|not your problem|so what|who cares|big deal)\b/i, weight: 2 },
  { pattern: /\b(your fault|you always|you never|this is on you)\b/i, weight: 2 },
];

/**
 * Conservative surface signal for rudeness. Returns a severity score plus a
 * flag for all-caps shouting (short, uppercase-heavy turns).
 */
function computeRudeness(text) {
  if (!text) return { severity: 0, hasYelling: false };
  let severity = 0;
  for (const { pattern, weight } of RUDENESS_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) severity += matches.length * weight;
  }
  const words = text.split(/\s+/).filter(Boolean);
  const hasYelling =
    words.length > 0 &&
    words.length <= 20 &&
    words.some((word) => word.length >= 3 && word === word.toUpperCase() && /[A-Z]/.test(word));
  if (hasYelling) severity += 2;
  return { severity, hasYelling };
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function splitSentences(text) {
  return text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function goalKeywords(goal) {
  if (typeof goal !== "string") return [];
  return goal
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z']/g, ""))
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));
}

// ─────────────────────────────────────────────
//  Deterministic per-dimension scorers
// ─────────────────────────────────────────────
const DIMENSION_SCORERS = {
  messageClarity({ totalWords, avgSentenceWords, fillerRatio, longTurnRatio }) {
    let score = 78;
    if (avgSentenceWords >= 4 && avgSentenceWords <= 14) score += 8;
    else if (avgSentenceWords > 22) score -= 8;
    if (fillerRatio > 0.15) score -= Math.min(15, (fillerRatio - 0.15) * 60);
    if (longTurnRatio > 0.3) score -= 10;
    if (totalWords === 0) score = 20;
    return clamp(score);
  },
  goalProgress({ goalKeywords, userTurns }) {
    let score = 55;
    if (userTurns.length === 0) return clamp(20);
    const hits = userTurns.filter((text) =>
      goalKeywords.some((keyword) => text.toLowerCase().includes(keyword)),
    ).length;
    score += Math.min(25, hits * 6);
    if (userTurns.some((text) => countWords(text) >= 5)) score += 6;
    if (userTurns.every((text) => countWords(text) >= 3)) score += 5;
    return clamp(score);
  },
  listening({ ackCount, userTurns }) {
    let score = 55;
    if (ackCount > 0) score += Math.min(25, 8 + ackCount * 4);
    if (userTurns.length >= 2) score += 5;
    if (ackCount === 0 && userTurns.length >= 2) score -= 5;
    return clamp(score);
  },
  reciprocity({ questionCount, userTurns }) {
    let score = 55;
    score += Math.min(30, questionCount * 8);
    if (userTurns.length >= 2) score += 8;
    const allLong = userTurns.length > 0 && userTurns.every((text) => countWords(text) > 25);
    if (allLong && questionCount === 0) score -= 12;
    return clamp(score);
  },
  tone({ politeCount, rudenessScore, hasYelling, aiToneScore }) {
    let score = 82;
    if (politeCount > 0) score += Math.min(10, politeCount * 2);
    score -= Math.min(65, rudenessScore * 8);
    if (hasYelling) score -= 10;
    if (Number.isFinite(aiToneScore)) {
      score = Math.round(score * 0.5 + aiToneScore * 0.5);
    }
    return clamp(score);
  },
  emotion({ userTurns, rudenessScore, hasYelling }) {
    let score = 85;
    score -= Math.min(30, rudenessScore * 5);
    if (hasYelling) score -= 8;
    const brief = userTurns.filter((text) => countWords(text) < 3).length;
    if (userTurns.length > 0 && brief / userTurns.length > 0.5) score -= 8;
    return clamp(Math.max(55, score));
  },
  pacing({ hasSpeech, wpm, estimatedSilenceMs, latencyMs }) {
    if (!hasSpeech) return { score: 70, estimated: true };
    let score = 74;
    if (wpm != null) {
      if (wpm >= 110 && wpm <= 185) score += 8;
      if (wpm > 220) score -= 10;
    }
    if (estimatedSilenceMs != null && estimatedSilenceMs > 5000) score -= 7;
    if (latencyMs != null && latencyMs > 6000) score -= 5;
    return { score: clamp(score), estimated: false };
  },
};

// ─────────────────────────────────────────────
//  Qualitative phrase libraries (deterministic)
// ─────────────────────────────────────────────
const STRENGTH_PHRASES = {
  messageClarity: "Your messages were clear and easy to follow.",
  goalProgress: "You kept the conversation moving toward your goal.",
  listening: "You showed you were listening to the other person.",
  reciprocity: "You balanced speaking with asking questions.",
  tone: "Your tone came across as friendly and warm.",
  emotion: "You stayed steady even when the conversation was tricky.",
  pacing: "You found a comfortable pace for speaking.",
};

const IMPROVEMENT_PHRASES = {
  messageClarity: "Try turning longer replies into shorter sentences.",
  goalProgress: "Keep one clear goal in mind and steer replies back toward it.",
  listening: "Try acknowledging what the other person said before replying.",
  reciprocity: "Add a short question after your reply to keep the other person involved.",
  tone: "Small phrases like 'please' or 'thanks' can add warmth.",
  emotion: "When a reply feels hard, it can help to pause and answer simply.",
  pacing: "Pausing briefly before replying can help you find a natural pace.",
};

const ALTERNATIVE_PHRASES = {
  messageClarity: "Could you explain that again? I want to make sure I understand.",
  goalProgress: "One thing I'd really like to get from this is...",
  listening: "That makes sense. So what happens after that?",
  reciprocity: "What do you think we should do first?",
  tone: "Thanks for asking — I'd be happy to help.",
  emotion: "That's a lot to take in. Let me think about that for a second.",
  pacing: "Let me think about that before I answer.",
};

// ─────────────────────────────────────────────
//  Main evaluation
// ─────────────────────────────────────────────
function userTurnTexts(session) {
  return Array.isArray(session?.turns)
    ? session.turns.filter((turn) => turn?.speaker === SPEAKER.USER)
    : [];
}

export function evaluateSession(session, { aiToneScore } = {}) {
  const userTurns = userTurnTexts(session);
  const texts = userTurns.map((turn) => turn.text ?? "");

  const totalWords = texts.reduce((sum, text) => sum + countWords(text), 0);
  const sentences = texts.flatMap(splitSentences);
  const avgSentenceWords =
    sentences.length > 0 ? totalWords / Math.max(1, sentences.length) : 0;

  const fillerCount = texts.reduce((sum, text) => {
    const words = countWords(text);
    return sum + (words > 0 ? (text.toLowerCase().match(/\b(um|uh|er|erm|ah|hmm)\b/g) ?? []).length : 0);
  }, 0);
  const fillerRatio = totalWords > 0 ? fillerCount / totalWords : 0;

  const longTurns = texts.filter((text) => countWords(text) > 40).length;
  const longTurnRatio = texts.length > 0 ? longTurns / texts.length : 0;

  const ackCount = texts.filter((text) => ACK_PATTERNS.some((pattern) => pattern.test(text))).length;
  const questionCount = texts.filter((text) => QUESTION_PATTERNS.some((pattern) => pattern.test(text))).length;
  const politeCount = texts.filter((text) => POLITE_PATTERNS.some((pattern) => pattern.test(text))).length;
  const rudeness = texts.map(computeRudeness);
  const rudenessScore = rudeness.reduce((sum, item) => sum + item.severity, 0);
  const hasYelling = rudeness.some((item) => item.hasYelling);

  const goal = session?.scenario?.goal ?? "";
  const keywords = goalKeywords(goal);

  const voiceTurns = userTurns.filter((turn) => turn.source === "voice");
  const hasSpeech = voiceTurns.length > 0;
  const wpmValues = voiceTurns.map((turn) => turn.speech?.wpm).filter(Number.isFinite);
  const wpm = wpmValues.length > 0
    ? Math.round(wpmValues.reduce((sum, value) => sum + value, 0) / wpmValues.length)
    : null;
  const silenceValues = voiceTurns.map((turn) => turn.speech?.estimatedSilenceMs).filter(Number.isFinite);
  const estimatedSilenceMs = silenceValues.length > 0
    ? Math.round(silenceValues.reduce((sum, value) => sum + value, 0) / silenceValues.length)
    : null;
  const latencyValues = voiceTurns.map((turn) => turn.speech?.latencyMs).filter(Number.isFinite);
  const latencyMs = latencyValues.length > 0
    ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
    : null;

  const base = {
    totalWords,
    avgSentenceWords,
    fillerRatio,
    longTurnRatio,
    goalKeywords: keywords,
    userTurns: texts,
    ackCount,
    questionCount,
    politeCount,
    rudenessScore,
    hasYelling,
    aiToneScore: Number.isFinite(aiToneScore) ? clamp(aiToneScore) : undefined,
    hasSpeech,
    wpm,
    estimatedSilenceMs,
    latencyMs,
  };

  const dimensions = EVALUATION_DIMENSIONS.map(({ id, label, description }) => {
    const raw = DIMENSION_SCORERS[id](base);
    const numeric = typeof raw === "number" ? raw : raw.score;
    const estimated = typeof raw === "object" ? raw.estimated : false;
    return {
      id,
      label,
      description,
      score: numeric,
      confidence: estimated ? "estimated" : "measured",
    };
  });

  const dimensionScores = dimensions.reduce((acc, dimension) => {
    acc[dimension.id] = dimension.score;
    return acc;
  }, {});

  const overallScore = clamp(
    userTurns.length === 0
      ? 25
      : dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length,
  );

  const strengths = [];
  const improvements = [];
  dimensions.forEach((dimension) => {
    if (totalWords === 0) return;
    if (dimension.score >= SCORE_BANDS.HIGH) strengths.push(STRENGTH_PHRASES[dimension.id]);
    if (dimension.score <= SCORE_BANDS.MEDIUM) improvements.push(IMPROVEMENT_PHRASES[dimension.id]);
  });

  if (totalWords === 0) {
    improvements.push("Try saying or typing at least one full sentence to begin.");
  }
  if (improvements.length === 0 && dimensions.length > 0) {
    const weakest = dimensions.reduce((a, b) => (a.score <= b.score ? a : b));
    improvements.push(IMPROVEMENT_PHRASES[weakest.id]);
  }

  const weakestId = dimensions.reduce((a, b) => (a.score <= b.score ? a : b)).id;
  const alternatives =
    totalWords > 0
      ? [ALTERNATIVE_PHRASES[weakestId], ALTERNATIVE_PHRASES.reciprocity]
      : ["Hi, I wanted to talk with you about something.", "Can you tell me more about that?"];

  const overallComment =
    totalWords === 0
      ? "You started the activity — that's a good first step. Every conversation begins with one reply."
      : overallScore >= SCORE_BANDS.HIGH
        ? "Well done — your replies carried the conversation well."
        : overallScore >= SCORE_BANDS.MEDIUM
          ? "Nice work. A few small tweaks could make your replies even clearer."
          : "Good effort. Short, kind replies are a great place to keep building from.";

  return {
    version: EVALUATION_VERSION,
    overallScore,
    dimensions,
    dimensionScores,
    strengths,
    improvements,
    alternatives,
    overallComment,
    confidence: hasSpeech ? "measured" : "estimated",
    stats: {
      turnCount: userTurns.length,
      wordCount: totalWords,
      voiceTurns: voiceTurns.length,
      textTurns: texts.length - voiceTurns.length,
      usedFallback: Boolean(session?.scenario?.source === "fallback"),
    },
  };
}

/**
 * Ask the model to rate how warm/rude the user's replies sound (0-100). Used
 * to blend into the `tone` dimension so sarcasm and passive aggression are
 * caught once an API key is configured. Returns a clamped number or null
 * when unavailable — never fabricates a rating.
 */
export async function assessToneWithAI(session, { apiKey } = {}) {
  if (!apiKey) return null;
  const userTurns = userTurnTexts(session).map((turn) => turn.text);
  try {
    const assessment = await generateToneAssessment({
      userTurns,
      scenario: session?.scenario,
      apiKey,
    });
    return Number.isFinite(assessment?.toneScore) ? clamp(assessment.toneScore) : null;
  } catch {
    return null;
  }
}

/**
 * Enrich the qualitative feedback with AI-generated wording. Numeric scores
 * are never modified. Returns a new evaluation object; on AI failure the
 * deterministic evaluation is returned unchanged (success is not fabricated).
 */
export async function refineEvaluationWithAI(evaluation, { session, apiKey } = {}) {
  if (!evaluation || !apiKey) return evaluation;

  const userTurns = userTurnTexts(session).map((turn) => turn.text);
  try {
    const insights = await generateEvaluationInsights({
      evaluation,
      userTurns,
      scenario: session?.scenario,
      apiKey,
    });
    if (!insights) return evaluation;

    return {
      ...evaluation,
      strengths: insights.strengths.length > 0 ? insights.strengths : evaluation.strengths,
      improvements: insights.improvements.length > 0 ? insights.improvements : evaluation.improvements,
      alternatives: insights.alternatives.length > 0 ? insights.alternatives : evaluation.alternatives,
      overallComment: insights.overallComment ?? evaluation.overallComment,
      refinedByAI: true,
    };
  } catch {
    return evaluation;
  }
}

export function isEvaluationShape(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      Number.isFinite(value.overallScore) &&
      Array.isArray(value.dimensions) &&
      value.dimensions.every((dimension) => EVALUATION_DIMENSION_IDS.includes(dimension?.id)),
  );
}
