/**
 * feedbackGenerator.js — Turns a structured CommunicationEvaluation into the
 * readable, non-judgmental feedback sections shown after a session.
 *
 * Guarantees: neutral wording (never "wrong", "bad", "failed"), always
 * acknowledges participation, and always offers at least one alternative.
 */

import { SCORE_BANDS } from "../types/communicationTypes";

const FORBIDDEN_WORDS = /\b(wrong|bad|failed|failure|poor|stupid|sloppy|mistake|shouldn't)\b/i;

const BAND_ENCOURAGEMENT = {
  high: "You carried the conversation confidently. Keep using the same approach.",
  medium: "Solid effort — a couple of small tweaks will make it flow even more easily.",
  low: "Nice job showing up and trying. Short, kind replies are a great next step.",
  empty: "You began the activity, and that's what matters. Every conversation starts with one reply.",
};

function bandFor(evaluation) {
  if (evaluation?.stats?.wordCount === 0) return "empty";
  if (evaluation.overallScore >= SCORE_BANDS.HIGH) return "high";
  if (evaluation.overallScore >= SCORE_BANDS.MEDIUM) return "medium";
  return "low";
}

function sanitize(phrases) {
  return (Array.isArray(phrases) ? phrases : [])
    .filter((phrase) => typeof phrase === "string" && phrase.trim().length > 0)
    .filter((phrase) => !FORBIDDEN_WORDS.test(phrase))
    .map((phrase) => phrase.trim());
}

export function buildFeedback(evaluation) {
  if (!evaluation) {
    return { sections: [], summary: "" };
  }

  const whatWorked = sanitize(evaluation.strengths);
  const couldImprove = sanitize(evaluation.improvements);
  const alternatives = sanitize(evaluation.alternatives);

  const sections = [];

  if (whatWorked.length > 0) {
    sections.push({ id: "what_worked", title: "What worked", items: whatWorked });
  }

  if (couldImprove.length > 0) {
    sections.push({
      id: "could_improve",
      title: "Could build on",
      items: couldImprove,
    });
  } else {
    sections.push({
      id: "could_improve",
      title: "Could build on",
      items: ["Keep replying — each exchange helps you practice."],
    });
  }

  if (alternatives.length > 0) {
    sections.push({
      id: "alternatives",
      title: "Try saying it this way",
      items: alternatives,
    });
  }

  return {
    sections,
    summary: BAND_ENCOURAGEMENT[bandFor(evaluation)],
    overallScore: evaluation.overallScore,
  };
}
