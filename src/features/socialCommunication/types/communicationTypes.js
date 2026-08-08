/**
 * communicationTypes.js — Shared constants and Zod schemas for the Social
 * Communication Simulator.
 *
 * The simulator is a cross-disorder communication practice tool: multi-turn,
 * voice-or-text conversations with an AI partner, structured evaluation and
 * adaptive difficulty. It is deliberately NOT a disorder-specific feature and
 * never scores eye contact, gestures, accent or prosody.
 */

import { z } from "zod";

export const COMMUNICATION_MODULE_ID = "communication.simulator";
export const COMMUNICATION_STORAGE_PREFIX = "nb_communication_simulator_v1";

// ─────────────────────────────────────────────
//  Conversation domains
// ─────────────────────────────────────────────
export const COMMUNICATION_DOMAINS = Object.freeze([
  { id: "initiating", label: "Starting a conversation", description: "Begin a chat with someone you do not know well yet." },
  { id: "requesting_help", label: "Asking for help", description: "Request assistance or information in a clear way." },
  { id: "expressing_preference", label: "Expressing a preference", description: "Share what you want or enjoy." },
  { id: "disagreeing", label: "Disagreeing respectfully", description: "Offer a different opinion without conflict." },
  { id: "saying_no", label: "Saying no", description: "Decline a request while keeping it friendly." },
  { id: "clarifying", label: "Clarifying a misunderstanding", description: "Ask for and give clearer information." },
  { id: "small_talk", label: "Everyday small talk", description: "Keep a light conversation flowing." },
  { id: "receiving_feedback", label: "Receiving feedback", description: "Respond well to praise or suggestions." },
]);

export const COMMUNICATION_DOMAIN_IDS = Object.freeze(
  COMMUNICATION_DOMAINS.map((domain) => domain.id),
);

export function getDomainById(domainId) {
  return COMMUNICATION_DOMAINS.find((domain) => domain.id === domainId) ?? null;
}

// ─────────────────────────────────────────────
//  Difficulty (1-5, bounded, ascending)
// ─────────────────────────────────────────────
export const DIFFICULTY_LEVELS = Object.freeze({
  1: { label: "Very easy", turnLimit: 6, hints: true, complexity: "short" },
  2: { label: "Easy", turnLimit: 7, hints: true, complexity: "short" },
  3: { label: "Moderate", turnLimit: 8, hints: false, complexity: "medium" },
  4: { label: "Challenging", turnLimit: 9, hints: false, complexity: "medium" },
  5: { label: "Advanced", turnLimit: 10, hints: false, complexity: "long" },
});

export const DIFFICULTY_IDS = Object.freeze([1, 2, 3, 4, 5]);
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 5;
export const DEFAULT_DIFFICULTY = 3;

export const TURN_LIMIT_FOR = (difficulty) => {
  const level = DIFFICULTY_LEVELS[difficulty] ?? DIFFICULTY_LEVELS[DEFAULT_DIFFICULTY];
  return level.turnLimit;
};

// ─────────────────────────────────────────────
//  Session status
// ─────────────────────────────────────────────
export const SESSION_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
});

export const SPEAKER = Object.freeze({
  USER: "user",
  NPC: "npc",
});

export const RESPONSE_SOURCE = Object.freeze({
  VOICE: "voice",
  TEXT: "text",
});

export const SCENARIO_SOURCE = Object.freeze({
  AI: "ai",
  FALLBACK: "fallback",
});

// ─────────────────────────────────────────────
//  Structured evaluation (7 dimensions)
// ─────────────────────────────────────────────
export const EVALUATION_DIMENSIONS = Object.freeze([
  { id: "messageClarity", label: "Clarity of message", description: "How easy your message was to follow." },
  { id: "goalProgress", label: "Progress toward your goal", description: "Whether your replies moved the conversation toward its aim." },
  { id: "listening", label: "Listening", description: "Signs you were paying attention to the other person." },
  { id: "reciprocity", label: "Give-and-take", description: "Balance between speaking and responding to the other person." },
  { id: "tone", label: "Tone", description: "How your words came across." },
  { id: "emotion", label: "Managing the moment", description: "Staying steady when the conversation gets tricky." },
  { id: "pacing", label: "Natural pacing", description: "A comfortable speed for speaking and replying." },
]);

export const EVALUATION_DIMENSION_IDS = Object.freeze(
  EVALUATION_DIMENSIONS.map((dimension) => dimension.id),
);

export const EVALUATION_VERSION = 1;

// Score bands used for feedback + difficulty without shaming language.
export const SCORE_BANDS = Object.freeze({
  HIGH: 80,
  MEDIUM: 60,
});

// ─────────────────────────────────────────────
//  Adaptation signals this feature understands
// ─────────────────────────────────────────────
export const ADAPTATION_SIGNALS = Object.freeze({
  SIMPLIFY: "simplify",
  SLOW_PACE: "slowPace",
  REDUCE_DISTRACTIONS: "reduceDistractions",
  PROVIDE_HINTS: "provideHints",
  RECOMMEND_EASIER: "recommendEasier",
});

export const DEFAULT_ADAPTATION_SIGNALS = Object.freeze({
  active: false,
  simplify: false,
  slowPace: false,
  reduceDistractions: false,
  provideHints: false,
  recommendEasier: false,
  decisionTraceId: null,
  sources: [],
  overallConfidence: null,
});

// Privacy guardrails: only ever send a short slice of the current turn to the
// AI, never a full conversation log, name, userId or audio.
export const AI_TRANSCRIPT_LIMIT = 400;
export const AI_TIMEOUT_MS = 12000;

// ─────────────────────────────────────────────
//  AI output schemas (validated before use)
// ─────────────────────────────────────────────
export const ScenarioContentSchema = z.object({
  domain: z.string().trim().min(1),
  title: z.string().trim().min(1),
  setting: z.string().trim().min(1),
  goal: z.string().trim().min(1),
  context: z.string().trim().min(1),
  npc: z.object({
    name: z.string().trim().min(1),
    role: z.string().trim().min(1),
    personality: z.string().trim().min(1),
  }),
  openingLine: z.string().trim().min(1),
  suggestedResponses: z.array(z.string().trim().min(1)).min(1),
  hint: z.string().trim().optional(),
});

export const NpcTurnSchema = z.object({
  line: z.string().trim().min(1),
  followUp: z.string().trim().min(1),
  emotion: z.string().trim().min(1).optional(),
  done: z.boolean().default(false),
  hint: z.string().trim().optional(),
});

export const EvaluationInsightsSchema = z.object({
  strengths: z.array(z.string().trim().min(1)).max(3).default([]),
  improvements: z.array(z.string().trim().min(1)).max(3).default([]),
  alternatives: z.array(z.string().trim().min(1)).max(3).default([]),
  overallComment: z.string().trim().min(1).optional(),
});

// ─────────────────────────────────────────────
//  Feature-level mode config (per-disorder overrides)
// ─────────────────────────────────────────────
export const COMMUNICATION_MODE_CONFIG = Object.freeze({
  // Example hook: extra hint exposure for users whose profile marks a need
  // for more scaffolding. The UI may extend this without disorder branching.
  hintsAlwaysAvailable: false,
});
