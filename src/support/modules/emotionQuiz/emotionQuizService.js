/**
 * emotionQuizService.js — Emotion Quiz logic.
 *
 * Primary path uses the Gemini provider (through the single AI facade in
 * aiService.js); every failure degrades to a deterministic fallback so the
 * quiz ALWAYS runs. Questions rotate across three question types
 * (match_scenario, identify_cue, reaction) so practice never becomes one
 * repetitive pattern. Grading is exact and deterministic; structured
 * performance signals are built for the adaptive interfaces.
 */

import { generateEmotionQuizQuestion } from "@/features/socialCommunication/services/aiService";
import {
  EMOTION_QUIZ_MODULE_ID,
  EmotionQuizQuestionSchema,
  QUIZ_DEFAULT_DIFFICULTY,
  QUIZ_DIFFICULTIES,
  QUIZ_QUESTION_TYPES,
  QUIZ_QUESTION_TYPE_IDS,
  QUIZ_SOURCE,
} from "./emotionQuizTypes";

// ─────────────────────────────────────────────
//  Deterministic fallback question library
//  difficulty: 1 = obvious, 2 = subtler, 3 = tricky but fair
// ─────────────────────────────────────────────
const FALLBACK_QUESTIONS = Object.freeze([
  {
    type: QUIZ_QUESTION_TYPES.MATCH_SCENARIO,
    difficulty: 1,
    prompt: "What is this friend most likely feeling?",
    scenario: "A friend gets good news and laughs out loud, clapping their hands.",
    options: [
      { id: "a", label: "Excited" },
      { id: "b", label: "Angry" },
      { id: "c", label: "Bored" },
      { id: "d", label: "Tired" },
    ],
    correctOptionId: "a",
    explanation: "Laughing out loud and clapping usually mean excitement and joy.",
  },
  {
    type: QUIZ_QUESTION_TYPES.MATCH_SCENARIO,
    difficulty: 1,
    prompt: "What is this classmate most likely feeling?",
    scenario: "A classmate stares at a hard exam paper and bites their lip.",
    options: [
      { id: "a", label: "Relieved" },
      { id: "b", label: "Worried" },
      { id: "c", label: "Calm" },
      { id: "d", label: "Excited" },
    ],
    correctOptionId: "b",
    explanation: "Staring at something hard and biting the lip are common signs of worry.",
  },
  {
    type: QUIZ_QUESTION_TYPES.MATCH_SCENARIO,
    difficulty: 2,
    prompt: "What is this teammate most likely feeling?",
    scenario: "After their idea is turned down, a teammate says 'Great, whatever' in a flat voice.",
    options: [
      { id: "a", label: "Grateful" },
      { id: "b", label: "Proud" },
      { id: "c", label: "Excited" },
      { id: "d", label: "Annoyed" },
    ],
    correctOptionId: "d",
    explanation: "A flat voice and a sarcastic 'whatever' after a rejection often hide annoyance.",
  },
  {
    type: QUIZ_QUESTION_TYPES.MATCH_SCENARIO,
    difficulty: 3,
    prompt: "What is this friend most likely feeling?",
    scenario: "A friend smiles and nods, but keeps checking their phone while you talk.",
    options: [
      { id: "a", label: "Distracted" },
      { id: "b", label: "Furious" },
      { id: "c", label: "Deeply grateful" },
      { id: "d", label: "Proud" },
    ],
    correctOptionId: "a",
    explanation: "A smile with constant phone-checking often means the person is distracted, not unhappy.",
  },
  {
    type: QUIZ_QUESTION_TYPES.MATCH_SCENARIO,
    difficulty: 2,
    prompt: "What is this sibling most likely feeling?",
    scenario: "A sibling finally finds a lost phone after searching for an hour.",
    options: [
      { id: "a", label: "Relieved" },
      { id: "b", label: "Jealous" },
      { id: "c", label: "Confused" },
      { id: "d", label: "Furious" },
    ],
    correctOptionId: "a",
    explanation: "Finding something after a long search usually brings relief.",
  },
  {
    type: QUIZ_QUESTION_TYPES.IDENTIFY_CUE,
    difficulty: 1,
    prompt: "Which clue best suggests someone is excited?",
    options: [
      { id: "a", label: "A big smile and a bright voice" },
      { id: "b", label: "Crossed arms and a flat voice" },
      { id: "c", label: "Looking down and staying silent" },
      { id: "d", label: "Yawning and closing their eyes" },
    ],
    correctOptionId: "a",
    explanation: "A bright voice and a big smile are the clearest signs of excitement.",
  },
  {
    type: QUIZ_QUESTION_TYPES.IDENTIFY_CUE,
    difficulty: 1,
    prompt: "Which clue best suggests someone is tired?",
    options: [
      { id: "a", label: "Jumping up and down" },
      { id: "b", label: "Talking very quickly" },
      { id: "c", label: "Slow movements and rubbing their eyes" },
      { id: "d", label: "Laughing loudly" },
    ],
    correctOptionId: "c",
    explanation: "Slow movements and rubbing the eyes are clear signs of tiredness.",
  },
  {
    type: QUIZ_QUESTION_TYPES.IDENTIFY_CUE,
    difficulty: 2,
    prompt: "Which clue best suggests someone feels worried?",
    options: [
      { id: "a", label: "Singing a happy song" },
      { id: "b", label: "Biting their lip and fidgeting" },
      { id: "c", label: "Relaxing in a chair" },
      { id: "d", label: "Clapping their hands" },
    ],
    correctOptionId: "b",
    explanation: "Lip-biting and fidgeting are common, quiet signs of worry.",
  },
  {
    type: QUIZ_QUESTION_TYPES.IDENTIFY_CUE,
    difficulty: 2,
    prompt: "Which clue best suggests someone is annoyed?",
    options: [
      { id: "a", label: "A wide smile" },
      { id: "b", label: "A soft laugh" },
      { id: "c", label: "A gentle pat on the shoulder" },
      { id: "d", label: "A flat voice and short answers" },
    ],
    correctOptionId: "d",
    explanation: "A flat voice with very short answers often signals annoyance.",
  },
  {
    type: QUIZ_QUESTION_TYPES.IDENTIFY_CUE,
    difficulty: 3,
    prompt: "Which clue best suggests someone feels disappointed?",
    options: [
      { id: "a", label: "A loud, excited shout" },
      { id: "b", label: "Humming a tune happily" },
      { id: "c", label: "A small shrug and looking away" },
      { id: "d", label: "Rubbing their hands together" },
    ],
    correctOptionId: "c",
    explanation: "A small shrug with eyes turning away is a subtle but common sign of disappointment.",
  },
  {
    type: QUIZ_QUESTION_TYPES.REACTION,
    difficulty: 1,
    prompt: "You notice you feel overwhelmed before a big task. Which reaction is most helpful?",
    options: [
      { id: "a", label: "Stop and take three slow breaths before the next small step" },
      { id: "b", label: "Keep pushing faster without a break" },
      { id: "c", label: "Put the task away and never start it" },
      { id: "d", label: "Try to do everything at once" },
    ],
    correctOptionId: "a",
    explanation: "Pausing to breathe and taking one small step reduces overwhelm and keeps you moving.",
  },
  {
    type: QUIZ_QUESTION_TYPES.REACTION,
    difficulty: 1,
    prompt: "You notice you feel angry during a game. Which reaction is most helpful?",
    options: [
      { id: "a", label: "Shout at the other player" },
      { id: "b", label: "Pause, take a breath, and tell a grown-up you need a minute" },
      { id: "c", label: "Throw the controller" },
      { id: "d", label: "Stay silent and bottle it up" },
    ],
    correctOptionId: "b",
    explanation: "Taking a minute and telling a trusted adult helps you calm down without hurting anyone.",
  },
  {
    type: QUIZ_QUESTION_TYPES.REACTION,
    difficulty: 2,
    prompt: "You feel worried about tomorrow's test. Which reaction is most helpful?",
    options: [
      { id: "a", label: "Stay up all night and ignore it" },
      { id: "b", label: "Skip the test without telling anyone" },
      { id: "c", label: "Ask one clear question and make a small plan" },
      { id: "d", label: "Worry quietly and change nothing" },
    ],
    correctOptionId: "c",
    explanation: "One clear question plus a small plan turns worry into something you can act on.",
  },
  {
    type: QUIZ_QUESTION_TYPES.REACTION,
    difficulty: 2,
    prompt: "You feel sad after a friend cancels plans. Which reaction is most helpful?",
    options: [
      { id: "a", label: "Pretend you are fine and say nothing" },
      { id: "b", label: "Cancel every plan forever" },
      { id: "c", label: "Blame yourself loudly" },
      { id: "d", label: "Tell someone you trust and do one calming activity" },
    ],
    correctOptionId: "d",
    explanation: "Talking to someone you trust and doing one calming activity helps sadness pass gently.",
  },
  {
    type: QUIZ_QUESTION_TYPES.REACTION,
    difficulty: 3,
    prompt: "You feel frustrated when a task is harder than expected. Which reaction is most helpful?",
    options: [
      { id: "a", label: "Force yourself to finish everything right now" },
      { id: "b", label: "Give up and avoid similar tasks forever" },
      { id: "c", label: "Pause, check what you have done, and take one tiny next step" },
      { id: "d", label: "Complain and wait for someone else to do it" },
    ],
    correctOptionId: "c",
    explanation: "Checking progress and taking one tiny step keeps frustration from stopping you.",
  },
]);

function pickQuestion(pool, variantSeed) {
  const safeSeed = Math.abs(Math.trunc(variantSeed || 0));
  return pool[safeSeed % pool.length];
}

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────
export function buildQuizConfig({
  difficulty = QUIZ_DEFAULT_DIFFICULTY,
  questionType = QUIZ_QUESTION_TYPES.MATCH_SCENARIO,
  signals = {},
  variantSeed = 0,
} = {}) {
  const numericDifficulty = QUIZ_DIFFICULTIES.includes(difficulty) ? difficulty : QUIZ_DEFAULT_DIFFICULTY;
  const resolvedType = QUIZ_QUESTION_TYPE_IDS.includes(questionType) ? questionType : QUIZ_QUESTION_TYPES.MATCH_SCENARIO;
  const effectiveDifficulty = signals.simplify ? Math.max(1, numericDifficulty - 1) : numericDifficulty;
  const hintsEnabled = effectiveDifficulty === 1 || signals.provideHints === true;

  return {
    moduleId: EMOTION_QUIZ_MODULE_ID,
    difficulty: numericDifficulty,
    effectiveDifficulty,
    questionType: resolvedType,
    hintsEnabled,
    variantSeed,
    aiEnabled: true,
  };
}

export function getFallbackQuizQuestion(config = {}) {
  const {
    effectiveDifficulty = QUIZ_DEFAULT_DIFFICULTY,
    questionType = QUIZ_QUESTION_TYPES.MATCH_SCENARIO,
    variantSeed = 0,
  } = config;

  const pool = FALLBACK_QUESTIONS.filter(
    (question) => question.type === questionType && question.difficulty === effectiveDifficulty,
  );
  const fallbackPool = FALLBACK_QUESTIONS.filter((question) => question.type === questionType);
  const selected = pickQuestion(pool.length > 0 ? pool : fallbackPool, variantSeed);

  return {
    id: `fallback-quiz-${selected.type}-${selected.difficulty}-v${variantSeed % 10}`,
    ...selected,
    source: QUIZ_SOURCE.FALLBACK,
  };
}

/**
 * Generate a quiz question, preferring the AI provider and always degrading to
 * the deterministic fallback. Returns `{ question, source, aiAvailable,
 * aiError }`. Never throws.
 */
export async function generateQuizQuestion(config = {}, { apiKey } = {}) {
  const resolved = buildQuizConfig(config);

  let aiQuestion = null;
  let aiError = null;
  if (resolved.aiEnabled && apiKey) {
    try {
      aiQuestion = await generateEmotionQuizQuestion({ config: resolved, apiKey });
    } catch (error) {
      aiError = error?.message ?? String(error);
    }
  }

  if (aiQuestion && typeof aiQuestion === "object" && EmotionQuizQuestionSchema.safeParse(aiQuestion).success) {
    return {
      question: {
        id: `quiz-ai-${Date.now()}`,
        ...aiQuestion,
        difficulty: aiQuestion.difficulty ?? resolved.effectiveDifficulty,
        source: QUIZ_SOURCE.AI,
      },
      source: QUIZ_SOURCE.AI,
      aiAvailable: true,
      aiError: null,
    };
  }

  return {
    question: getFallbackQuizQuestion({
      ...resolved,
      variantSeed: resolved.variantSeed + (config?.fallbackIndex ?? 0),
    }),
    source: QUIZ_SOURCE.FALLBACK,
    aiAvailable: false,
    aiError,
  };
}

// ─────────────────────────────────────────────
//  Deterministic grading
// ─────────────────────────────────────────────
export function gradeQuizAnswer(question, optionId) {
  if (!question || !Array.isArray(question.options)) {
    return { answered: false, correct: false, explanation: "" };
  }
  const normalizedId = String(optionId ?? "");
  const selected = question.options.find((option) => option.id === normalizedId) ?? null;
  const correctOption = question.options.find((option) => option.id === question.correctOptionId) ?? null;
  const correct = selected ? selected.id === question.correctOptionId : false;

  return {
    answered: Boolean(selected),
    correct,
    selectedOptionId: selected?.id ?? null,
    selectedLabel: selected?.label ?? null,
    correctLabel: correctOption?.label ?? null,
    explanation: question.explanation ?? "",
  };
}

// ─────────────────────────────────────────────
//  Structured performance signal (adaptive interfaces)
// ─────────────────────────────────────────────
export function buildQuizPerformance({
  total = 0,
  correct = 0,
  attempts = 0,
  streak = 0,
  durationMs,
} = {}) {
  const totalCount = Number.isInteger(total) && total >= 0 ? total : 0;
  const correctCount = Number.isInteger(correct) && correct >= 0 ? Math.min(correct, totalCount) : 0;
  const attemptsCount = Number.isInteger(attempts) && attempts >= 0 ? attempts : 0;
  const streakCount = Number.isInteger(streak) && streak >= 0 ? streak : 0;

  return {
    completionStatus:
      totalCount > 0 && correctCount === totalCount
        ? "completed"
        : totalCount > 0
          ? "partially_completed"
          : "not_started",
    durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? Math.floor(durationMs) : null,
    metrics: {
      total: totalCount,
      correct: correctCount,
      accuracy: totalCount > 0 ? correctCount / totalCount : 0,
      attempts: attemptsCount,
      streak: streakCount,
    },
  };
}
