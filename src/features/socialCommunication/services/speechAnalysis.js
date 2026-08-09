/**
 * speechAnalysis.js — Deterministic, interpretable speech features derived from
 * a voice capture. Nothing here scores the user against "neurotypical" norms:
 * it only produces neutral measurements (rate, fillers, pauses) that the
 * evaluator may reference descriptively. Input is always safe to compute and
 * never penalises accent, register, or word choice.
 */

const FILLER_TOKENS = new Set(["um", "uh", "er", "erm", "ah", "you know", "hmm"]);
const ESTIMATED_MS_PER_WORD = 420;

function toWords(text) {
  if (typeof text !== "string") return [];
  return text
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function countWords(text) {
  return toWords(text).length;
}

export function countFillers(text) {
  if (typeof text !== "string") return 0;
  let count = 0;
  const lower = text.toLowerCase();
  FILLER_TOKENS.forEach((token) => {
    const regex = new RegExp(`\\b${token.replace(" ", "\\s+")}\\b`, "g");
    const matches = lower.match(regex);
    if (matches) count += matches.length;
  });
  return count;
}

/**
 * Estimate how long the speaker was likely silent, in milliseconds, from the
 * captured duration and word count. Positive values suggest noticeable pauses;
 * this is a soft estimate, not a measurement of disfluency.
 */
export function estimateSilenceMs({ durationMs, wordCount }) {
  const duration = Number.isFinite(durationMs) ? durationMs : 0;
  const words = Number.isFinite(wordCount) ? wordCount : 0;
  if (words === 0) return 0;
  return Math.max(0, duration - words * ESTIMATED_MS_PER_WORD);
}

/**
 * Build the neutral speech-feature object stored on a voice turn. Always
 * returns a well-formed object; any missing measurement is `null`.
 */
export function extractSpeechFeatures({ transcript = "", durationMs, latencyMs } = {}) {
  const text = typeof transcript === "string" ? transcript : "";
  const words = countWords(text);
  const duration = Number.isFinite(durationMs) ? durationMs : null;
  const latency = Number.isFinite(latencyMs) ? latencyMs : null;

  return {
    transcript: text,
    wordCount: words,
    durationMs: duration,
    latencyMs: latency,
    wpm: words > 0 && duration && duration > 0 ? Math.round((words / duration) * 60000) : null,
    fillerCount: countFillers(text),
    estimatedSilenceMs: duration != null ? estimateSilenceMs({ durationMs: duration, wordCount: words }) : null,
  };
}

/** True when a transcript has nothing usable to evaluate. */
export function isEmptyTranscript(transcript) {
  return typeof transcript !== "string" || transcript.trim().length === 0;
}
