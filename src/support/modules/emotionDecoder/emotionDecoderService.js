/**
 * emotionDecoderService.js — Emotion Decoder logic.
 *
 * Primary path uses the Gemini provider (through the single AI facade in
 * aiService.js); every failure degrades to a deterministic, parametrised
 * fallback so the feature ALWAYS runs. The fallback is selected from a fixed
 * library by difficulty + activity type + a variant seed — the same seed always
 * yields the same scenario.
 *
 * Answering is free text and is graded deterministically against the expected
 * interpretations. Structured performance signals are built for the adaptive
 * interfaces; this module never talks to the engine itself.
 */

import { generateEmotionDecoderScenario } from "@/features/socialCommunication/services/aiService";
import {
  DECODER_ACTIVITY_TYPE_IDS,
  DECODER_DEFAULT_DIFFICULTY,
  DECODER_DIFFICULTIES,
  DECODER_SOURCE,
  EmotionDecoderScenarioSchema,
  getDecoderActivityTypeById,
} from "./emotionDecoderTypes";

// ─────────────────────────────────────────────
//  Deterministic fallback library
//  difficulty: 1 = very clear cues, 2 = subtler, 3 = mixed/similar feelings
// ─────────────────────────────────────────────
const FALLBACK_SCENARIOS = Object.freeze([
  {
    activityType: "daily_life",
    difficulty: 1,
    scenario: "A classmate drops their lunch tray in the hallway.",
    dialogue: "Oh no… my sandwich.",
    cues: ["their voice goes quiet", "they frown and look down", "they stop moving"],
    expectedInterpretations: ["upset", "embarrassed"],
    explanation: "Dropping food in front of others is embarrassing, and a quiet, frowning voice often means someone feels upset.",
  },
  {
    activityType: "daily_life",
    difficulty: 1,
    scenario: "A friend gets good news in the corridor.",
    dialogue: "I got the part! I can't believe it!",
    cues: ["a loud, bright voice", "a big smile", "jumping a little"],
    expectedInterpretations: ["excited", "happy"],
    explanation: "A bright, loud voice and smiling usually show excitement or happiness.",
  },
  {
    activityType: "daily_life",
    difficulty: 1,
    scenario: "Someone is waiting for a bus that is very late.",
    dialogue: "It should have been here ten minutes ago.",
    cues: ["keeping checking the time", "sighing", "tapping a foot"],
    expectedInterpretations: ["impatient", "annoyed"],
    explanation: "Checking the time and sighing while waiting usually signal impatience or annoyance.",
  },
  {
    activityType: "daily_life",
    difficulty: 2,
    scenario: "A colleague gives a short, flat answer to a friendly question.",
    dialogue: "Sure. Whatever you want.",
    cues: ["a flat tone", "a very short answer", "looking away"],
    expectedInterpretations: ["disappointed", "unhappy"],
    explanation: "A flat tone with a very short answer can hide disappointment even when the words sound polite.",
  },
  {
    activityType: "daily_life",
    difficulty: 3,
    scenario: "A friend who usually chats easily is very quiet today.",
    dialogue: "Hey.",
    cues: ["not starting any conversation", "short answers", "looking down"],
    expectedInterpretations: ["worried", "tired"],
    explanation: "Someone who is usually chatty being quiet and looking down can mean they feel worried, or simply tired. The best next step is a gentle question.",
  },
  {
    activityType: "friends",
    difficulty: 1,
    scenario: "A friend wins the raffle at the fair.",
    dialogue: "I actually won! This never happens to me!",
    cues: ["a wide smile", "a happy laugh", "clapping their hands"],
    expectedInterpretations: ["excited", "happy"],
    explanation: "A wide smile and happy laugh are clear signs of excitement.",
  },
  {
    activityType: "friends",
    difficulty: 1,
    scenario: "A friend hears their favourite song playing.",
    dialogue: "Oh, I love this song!",
    cues: ["tapping their foot", "smiling", "singing along"],
    expectedInterpretations: ["happy", "excited"],
    explanation: "Smiling and tapping along to a favourite song usually mean the person is happy.",
  },
  {
    activityType: "friends",
    difficulty: 2,
    scenario: "A friend talks very fast about a big test tomorrow.",
    dialogue: "I studied all night, but what if I blank on the day?",
    cues: ["speaking quickly", "biting their lip", "fidgeting"],
    expectedInterpretations: ["worried", "anxious"],
    explanation: "Fast speech, fidgeting and a worry question are common signs of anxiety.",
  },
  {
    activityType: "friends",
    difficulty: 2,
    scenario: "A friend is asked to do a chore they clearly dislike.",
    dialogue: "Fine, I guess.",
    cues: ["a flat voice", "a slow nod", "dropping their shoulders"],
    expectedInterpretations: ["annoyed", "reluctant"],
    explanation: "Agreeing with a flat voice and heavy shoulders often means annoyance or reluctance.",
  },
  {
    activityType: "friends",
    difficulty: 3,
    scenario: "A friend smiles but keeps checking their phone during your story.",
    dialogue: "Yeah, sounds fun.",
    cues: ["smiling", "glancing at the phone", "very short replies"],
    expectedInterpretations: ["distracted", "unsure"],
    explanation: "A smile with constant phone-checking and short replies can mean distraction, or uncertainty about what to say.",
  },
  {
    activityType: "family",
    difficulty: 1,
    scenario: "A sibling finds a toy they thought was lost.",
    dialogue: "I found it under the sofa!",
    cues: ["a bright voice", "holding the toy up", "smiling"],
    expectedInterpretations: ["relieved", "happy"],
    explanation: "Finding something lost with a bright voice and a smile usually means relief and happiness.",
  },
  {
    activityType: "family",
    difficulty: 1,
    scenario: "A parent sighs slowly after a long day.",
    dialogue: "What a day.",
    cues: ["a slow voice", "rubbing their eyes", "slumping into the chair"],
    expectedInterpretations: ["tired"],
    explanation: "Slow movement, eye-rubbing and a deep sigh are clear signs of tiredness.",
  },
  {
    activityType: "family",
    difficulty: 2,
    scenario: "A parent quietly puts the phone down after a call.",
    dialogue: "That was not good news.",
    cues: ["a quiet voice", "slow movements", "not meeting your eyes"],
    expectedInterpretations: ["worried", "sad"],
    explanation: "A quiet voice and slow movements after a hard call often mean worry or sadness.",
  },
  {
    activityType: "family",
    difficulty: 2,
    scenario: "A sibling returns a borrowed game with a small shrug.",
    dialogue: "It's fine, you can keep it.",
    cues: ["shrugging", "not making eye contact", "a flat tone"],
    expectedInterpretations: ["disappointed", "upset"],
    explanation: "Words can say one thing while a shrug and a flat tone say another — this often hides disappointment.",
  },
  {
    activityType: "family",
    difficulty: 3,
    scenario: "A grandparent laughs softly and pats your hand.",
    dialogue: "You remind me of someone I love.",
    cues: ["a soft laugh", "a gentle touch", "a warm look"],
    expectedInterpretations: ["loving", "warm"],
    explanation: "A soft laugh, a gentle touch and a warm look usually express love and warmth, even though the words are simple.",
  },
]);

function pickScenario(pool, variantSeed) {
  const safeSeed = Math.abs(Math.trunc(variantSeed || 0));
  return pool[safeSeed % pool.length];
}

function withDefaults(scenario, id) {
  return {
    ...scenario,
    id,
    question: scenario.question ?? "What is this person most likely feeling?",
  };
}

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────
export function buildDecoderConfig({
  difficulty = DECODER_DEFAULT_DIFFICULTY,
  activityType = "daily_life",
  contextHint = "",
  signals = {},
  variantSeed = 0,
} = {}) {
  const numericDifficulty = DECODER_DIFFICULTIES.includes(difficulty)
    ? difficulty
    : DECODER_DEFAULT_DIFFICULTY;
  const resolvedActivity = DECODER_ACTIVITY_TYPE_IDS.includes(activityType)
    ? activityType
    : "daily_life";
  const effectiveDifficulty = signals.simplify ? Math.max(1, numericDifficulty - 1) : numericDifficulty;
  const hintsEnabled = effectiveDifficulty === 1 || signals.provideHints === true;

  return {
    difficulty: numericDifficulty,
    effectiveDifficulty,
    activityType: resolvedActivity,
    activityLabel: getDecoderActivityTypeById(resolvedActivity)?.label ?? "daily life",
    contextHint,
    hintsEnabled,
    variantSeed,
    aiEnabled: true,
  };
}

export function getFallbackDecoderScenario(config = {}) {
  const {
    effectiveDifficulty = DECODER_DEFAULT_DIFFICULTY,
    activityType = "daily_life",
    hintsEnabled = effectiveDifficulty === 1,
    variantSeed = 0,
  } = config;

  const pool = FALLBACK_SCENARIOS.filter(
    (scenario) =>
      scenario.difficulty === effectiveDifficulty &&
      (activityType === "daily_life" ? true : scenario.activityType === activityType),
  );
  const selected = pool.length > 0 ? pickScenario(pool, variantSeed) : FALLBACK_SCENARIOS[0];

  return withDefaults(
    {
      ...selected,
      hint: hintsEnabled ? "Look at the cues first: what does the person's voice, face or body show?" : "",
    },
    `fallback-decoder-${selected.activityType}-${selected.difficulty}-v${variantSeed % 10}`,
  );
}

/**
 * Generate a decoder scenario, preferring the AI provider and always degrading
 * to the deterministic fallback. Returns `{ scenario, source, aiAvailable,
 * aiError }`. Never throws.
 */
export async function generateDecoderScenario(config = {}, { apiKey } = {}) {
  const resolved = buildDecoderConfig(config);

  let aiScenario = null;
  let aiError = null;
  if (resolved.aiEnabled && apiKey) {
    try {
      aiScenario = await generateEmotionDecoderScenario({ config: resolved, apiKey });
    } catch (error) {
      aiError = error?.message ?? String(error);
    }
  }

  if (aiScenario && typeof aiScenario === "object" && EmotionDecoderScenarioSchema.safeParse(aiScenario).success) {
    return {
      scenario: {
        id: `decoder-ai-${Date.now()}`,
        ...aiScenario,
        difficulty: aiScenario.difficulty ?? resolved.effectiveDifficulty,
        activityType: aiScenario.activityType ?? resolved.activityType,
        hint: resolved.hintsEnabled ? aiScenario.hint ?? "" : "",
        source: DECODER_SOURCE.AI,
      },
      source: DECODER_SOURCE.AI,
      aiAvailable: true,
      aiError: null,
    };
  }

  return {
    scenario: getFallbackDecoderScenario({
      ...resolved,
      variantSeed: resolved.variantSeed + (config?.fallbackIndex ?? 0),
    }),
    source: DECODER_SOURCE.FALLBACK,
    aiAvailable: false,
    aiError,
  };
}

// ─────────────────────────────────────────────
//  Deterministic free-text grading
// ─────────────────────────────────────────────
function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesInterpretation(answer, interpretation) {
  const normalizedAnswer = normalize(answer);
  const normalized = normalize(interpretation);
  if (!normalizedAnswer || !normalized) return false;
  if (normalizedAnswer === normalized) return true;
  const words = normalized.split(" ").filter(Boolean);
  if (words.length === 1) {
    return new RegExp(`\\b${words[0]}\\b`).test(normalizedAnswer);
  }
  return normalizedAnswer.includes(normalized);
}

export function evaluateDecoderAnswer({ scenario, answer } = {}) {
  const text = String(answer ?? "").trim();
  const expected = Array.isArray(scenario?.expectedInterpretations)
    ? scenario.expectedInterpretations
    : [];
  const cues = Array.isArray(scenario?.cues) ? scenario.cues : [];
  const explanation = scenario?.explanation ?? "";

  if (!text) {
    return {
      answered: false,
      correct: false,
      matches: [],
      expected,
      feedback: "Type or say what you think this person is feeling, then try again.",
    };
  }

  const matches = expected.filter((label) => matchesInterpretation(text, label));
  const correct = matches.length > 0;

  return {
    answered: true,
    correct,
    matches,
    expected,
    explanation,
    cues,
    feedback: correct
      ? `That's it. ${explanation || "The cues point to that emotion."}`
      : `Not quite yet. Cues to notice: ${cues.join("; ") || "the person's voice, face and body"}. Here the emotion is ${expected.join(" or ") || "one of the expected feelings"}.`,
  };
}

// ─────────────────────────────────────────────
//  Structured performance signal (adaptive interfaces)
// ─────────────────────────────────────────────
export function buildDecoderPerformance({ attempts = 0, correct = 0, hintsUsed = 0, durationMs } = {}) {
  const attemptsCount = Number.isInteger(attempts) && attempts >= 0 ? attempts : 0;
  const correctCount = Number.isInteger(correct) && correct >= 0 ? Math.min(correct, attemptsCount) : 0;

  return {
    completionStatus:
      attemptsCount > 0 && correctCount === attemptsCount
        ? "completed"
        : attemptsCount > 0
          ? "partially_completed"
          : "not_started",
    durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? Math.floor(durationMs) : null,
    metrics: {
      attempts: attemptsCount,
      correct: correctCount,
      accuracy: attemptsCount > 0 ? correctCount / attemptsCount : 0,
      hintsUsed: Number.isInteger(hintsUsed) && hintsUsed >= 0 ? hintsUsed : 0,
    },
  };
}
