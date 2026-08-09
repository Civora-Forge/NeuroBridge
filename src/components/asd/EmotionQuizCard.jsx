/**
 * EmotionQuizCard.jsx — Quick, gentle questions about reading emotions.
 *
 * Rotates across three question types (match a situation to a feeling, spot the
 * cue, and choose a helpful reaction). Questions come from the Gemini provider
 * when available and always fall back to a deterministic library. Grading is
 * exact; a running score and streak keep practice light. The card consumes the
 * Adaptive Engine's module decision through `useModuleAdaptation` only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getGeminiApiKey } from "@/features/socialCommunication/services/aiService";
import { useModuleAdaptation } from "@/hooks/useModuleAdaptation";
import { buildUserPreferencesFragment } from "@/support/framework/userPreferencesAdapter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, BrainCircuit, CheckCircle2, XCircle } from "lucide-react";
import {
  EMOTION_QUIZ_MODULE_ID,
  QUIZ_DIFFICULTIES,
  QUIZ_QUESTION_TYPE_IDS,
  QUIZ_QUESTION_TYPES,
} from "@/support/modules/emotionQuiz/emotionQuizTypes";
import {
  buildQuizConfig,
  buildQuizPerformance,
  generateQuizQuestion,
  gradeQuizAnswer,
} from "@/support/modules/emotionQuiz/emotionQuizService";

const QUESTION_TYPE_LABELS = {
  [QUIZ_QUESTION_TYPES.MATCH_SCENARIO]: "What are they feeling?",
  [QUIZ_QUESTION_TYPES.IDENTIFY_CUE]: "Spot the cue",
  [QUIZ_QUESTION_TYPES.REACTION]: "Helpful reactions",
};

function deriveSignals(adjustments = []) {
  return {
    simplify: adjustments.some((adj) => adj.type === "SIMPLIFY" || adj.type === "REDUCE"),
    provideHints: adjustments.some((adj) => adj.type === "GUIDE"),
  };
}

export default function EmotionQuizCard() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const apiKey = getGeminiApiKey();

  const [questionType, setQuestionType] = useState(QUIZ_QUESTION_TYPES.MATCH_SCENARIO);
  const [difficulty, setDifficulty] = useState(1);
  const [question, setQuestion] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [grading, setGrading] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const userPreferences = useMemo(() => buildUserPreferencesFragment(user), [user]);

  const getSnapshot = useCallback(
    () => ({
      screen: "asd.emotion-quiz",
      session: question
        ? {
            questionType: question.type ?? questionType,
            difficulty: question.difficulty ?? difficulty,
            answered: score.total,
            correct: score.correct,
            streak,
          }
        : { questionType, difficulty, answered: score.total, correct: score.correct, streak },
      userProfile: {
        accessibility: user?.accessibility ?? null,
        disorders: Array.isArray(user?.disorders) ? user.disorders : [],
      },
    }),
    [question, questionType, difficulty, score, streak, user],
  );

  const adaptation = useModuleAdaptation({
    moduleId: EMOTION_QUIZ_MODULE_ID,
    getSnapshot,
    userId,
    userPreferences,
  });

  const signals = useMemo(() => deriveSignals(adaptation.adjustments), [adaptation.adjustments]);

  const config = useMemo(
    () => buildQuizConfig({ difficulty, questionType, signals, variantSeed: fallbackIndex }),
    [difficulty, questionType, signals, fallbackIndex],
  );

  const loadQuestion = useCallback(
    async (nextConfig) => {
      setLoading(true);
      try {
        const outcome = await generateQuizQuestion(nextConfig ?? config, { apiKey });
        setQuestion(outcome.question);
        setAiUnavailable(!outcome.aiAvailable);
        setSelectedOptionId(null);
        setGrading(null);
      } finally {
        setLoading(false);
      }
    },
    [config, apiKey],
  );

  useEffect(() => {
    loadQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (question) {
      loadQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, questionType]);

  const handleAnswer = useCallback(
    (optionId) => {
      if (grading) return;
      const evaluation = gradeQuizAnswer(question, optionId);
      setSelectedOptionId(optionId);
      setGrading(evaluation);
      setScore((current) => ({ correct: current.correct + (evaluation.correct ? 1 : 0), total: current.total + 1 }));
      setStreak((current) => {
        const next = evaluation.correct ? current + 1 : 0;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
    },
    [question, grading],
  );

  const handleNext = useCallback(() => {
    setFallbackIndex((current) => current + 1);
  }, []);

  useEffect(() => {
    if (fallbackIndex > 0) {
      loadQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackIndex]);

  const performance = useMemo(
    () => buildQuizPerformance({ total: score.total, correct: score.correct, attempts: score.total, streak }),
    [score, streak],
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <BrainCircuit size={20} /> Emotion Quiz
        </CardTitle>
        <CardDescription>
          Quick questions to practise reading feelings — you can do them as often as you like.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="quiz-type">Question type</Label>
            <Select value={questionType} onValueChange={setQuestionType}>
              <SelectTrigger id="quiz-type" aria-label="Question type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUIZ_QUESTION_TYPE_IDS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {QUESTION_TYPE_LABELS[type] ?? type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-difficulty">Level</Label>
            <Select value={String(difficulty)} onValueChange={(value) => setDifficulty(Number(value))}>
              <SelectTrigger id="quiz-difficulty" aria-label="Difficulty level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUIZ_DIFFICULTIES.map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    {level === 1 ? "Clear" : level === 2 ? "Subtler" : "Tricky"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {aiUnavailable && (
          <p className="text-xs text-muted-foreground">
            Practising with built-in questions right now; live ones will appear when the AI service is available.
          </p>
        )}

        {/* Question */}
        {loading || !question ? (
          <div className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
            Preparing a question…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 p-5 space-y-2">
              <p className="text-base font-medium">{question.prompt}</p>
              {question.scenario && (
                <p className="text-sm italic text-muted-foreground">“{question.scenario}”</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="Answer options">
              {question.options.map((option) => {
                const isSelected = selectedOptionId === option.id;
                const isCorrectOption = grading && option.id === question.correctOptionId;
                const isWrongPick = grading && isSelected && !isCorrectOption;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={Boolean(grading)}
                    onClick={() => handleAnswer(option.id)}
                    className={`rounded-2xl border-2 p-4 text-left text-sm font-medium transition-all ${
                      isCorrectOption
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                        : isWrongPick
                          ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                          : grading
                            ? "border-muted opacity-60"
                            : "border-slate-300 dark:border-slate-700 hover:ring-2 hover:ring-violet-400/50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{option.label}</span>
                      {isCorrectOption && <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" aria-label="Correct answer" />}
                      {isWrongPick && <XCircle size={18} className="text-red-500 flex-shrink-0" aria-label="Wrong answer" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {grading && (
              <div
                className={`rounded-2xl border-2 p-4 ${
                  grading.correct
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
                }`}
                role="status"
                aria-live="polite"
              >
                <p className={`font-semibold ${grading.correct ? "text-emerald-700 dark:text-emerald-300" : "text-orange-700 dark:text-orange-300"}`}>
                  {grading.correct ? "Correct!" : "Not this time."}
                  {!grading.correct && grading.correctLabel && (
                    <span className="font-normal"> The answer was: {grading.correctLabel}.</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{grading.explanation}</p>
                <Button className="mt-3 gap-2 w-full sm:w-auto" onClick={handleNext}>
                  Next question <ArrowRight size={16} />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Score */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Score: {performance.metrics.correct}/{performance.metrics.total}</Badge>
          <Badge variant="secondary">Accuracy: {Math.round(performance.metrics.accuracy * 100)}%</Badge>
          <Badge variant="secondary">Streak: {performance.metrics.streak}</Badge>
        </div>

        {/* Adaptation notice */}
        {adaptation.adjustments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {adaptation.adjustments.map((adj) => (
              <span
                key={adj.actionId ?? `${adj.target}:${adj.type}`}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-foreground"
              >
                {adj.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
