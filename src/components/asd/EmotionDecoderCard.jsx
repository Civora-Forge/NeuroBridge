/**
 * EmotionDecoderCard.jsx — Practise reading what someone might be feeling.
 *
 * Presents a short everyday scenario (situation + dialogue + cues), reads it
 * aloud on request, and grades a free-text answer deterministically against the
 * expected interpretations. Scenarios come from the Gemini provider when
 * available and always fall back to a deterministic library. The card consumes
 * the Adaptive Engine's module decision through `useModuleAdaptation` (never
 * the engine itself) to shape difficulty and hint availability.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getGeminiApiKey } from "@/features/socialCommunication/services/aiService";
import { useVoiceInput } from "@/features/socialCommunication/hooks/useVoiceInput";
import { useModuleAdaptation } from "@/hooks/useModuleAdaptation";
import { buildUserPreferencesFragment } from "@/support/framework/userPreferencesAdapter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, Mic, MicOff, ScanFace, Volume2 } from "lucide-react";
import {
  DECODER_ACTIVITY_TYPES,
  DECODER_ACTIVITY_TYPE_IDS,
  DECODER_DIFFICULTIES,
  EMOTION_DECODER_MODULE_ID,
  getDecoderActivityTypeById,
} from "@/support/modules/emotionDecoder/emotionDecoderTypes";
import {
  buildDecoderConfig,
  buildDecoderPerformance,
  evaluateDecoderAnswer,
  generateDecoderScenario,
} from "@/support/modules/emotionDecoder/emotionDecoderService";

function useSpeech() {
  const speak = useCallback((text, rate = 0.95, pitch = 1.05) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    window.speechSynthesis.speak(utterance);
  }, []);
  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );
  return speak;
}

function deriveSignals(adjustments = []) {
  return {
    simplify: adjustments.some((adj) => adj.type === "SIMPLIFY" || adj.type === "REDUCE"),
    provideHints: adjustments.some((adj) => adj.type === "GUIDE"),
  };
}

export default function EmotionDecoderCard() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const speak = useSpeech();
  const voice = useVoiceInput();
  const apiKey = getGeminiApiKey();

  const [activityType, setActivityType] = useState(DECODER_ACTIVITY_TYPE_IDS[0]);
  const [difficulty, setDifficulty] = useState(1);
  const [scenario, setScenario] = useState(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const userPreferences = useMemo(() => buildUserPreferencesFragment(user), [user]);

  const getSnapshot = useCallback(
    () => ({
      screen: "asd.emotion-decoder",
      session: scenario
        ? {
            activityType: scenario.activityType ?? activityType,
            difficulty: scenario.difficulty ?? difficulty,
            attempts,
            correct: correctCount,
          }
        : { activityType, difficulty, attempts, correct: correctCount },
      userProfile: {
        accessibility: user?.accessibility ?? null,
        disorders: Array.isArray(user?.disorders) ? user.disorders : [],
      },
    }),
    [scenario, activityType, difficulty, attempts, correctCount, user],
  );

  const adaptation = useModuleAdaptation({
    moduleId: EMOTION_DECODER_MODULE_ID,
    getSnapshot,
    userId,
    userPreferences,
  });

  const signals = useMemo(() => deriveSignals(adaptation.adjustments), [adaptation.adjustments]);

  const config = useMemo(
    () => buildDecoderConfig({ difficulty, activityType, signals, variantSeed: fallbackIndex }),
    [difficulty, activityType, signals, fallbackIndex],
  );

  const loadScenario = useCallback(
    async (nextConfig) => {
      setLoading(true);
      try {
        const outcome = await generateDecoderScenario(nextConfig ?? config, { apiKey });
        setScenario(outcome.scenario);
        setAiUnavailable(!outcome.aiAvailable);
      } finally {
        setLoading(false);
      }
    },
    [config, apiKey],
  );

  // Load the first scenario on mount.
  useEffect(() => {
    loadScenario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when the learner changes difficulty or activity type.
  useEffect(() => {
    if (scenario) {
      loadScenario();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, activityType]);

  const handleSubmit = useCallback(() => {
    const evaluation = evaluateDecoderAnswer({ scenario, answer });
    if (!evaluation.answered) return;
    setResult(evaluation);
    setAttempts((current) => current + 1);
    if (evaluation.correct) {
      setCorrectCount((current) => current + 1);
    }
  }, [scenario, answer]);

  const handleNext = useCallback(() => {
    setFallbackIndex((current) => current + 1);
    setAnswer("");
    setResult(null);
  }, []);

  useEffect(() => {
    if (fallbackIndex > 0) {
      loadScenario();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackIndex]);

  const handleUseVoice = useCallback(() => {
    if (voice.listening) {
      voice.stop();
      return;
    }
    voice.start();
  }, [voice]);

  useEffect(() => {
    if (voice.transcript) {
      setAnswer(voice.transcript);
    }
  }, [voice.transcript]);

  const showHint = config.hintsEnabled || result;
  const performance = useMemo(
    () => buildDecoderPerformance({ attempts, correct: correctCount, hintsUsed, durationMs: null }),
    [attempts, correctCount, hintsUsed],
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ScanFace size={20} /> Emotion Decoder
        </CardTitle>
        <CardDescription>
          Read a short situation, then say or type what this person is most likely feeling.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="decoder-activity">Situation</Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger id="decoder-activity" aria-label="Situation type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DECODER_ACTIVITY_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decoder-difficulty">Level</Label>
            <Select value={String(difficulty)} onValueChange={(value) => setDifficulty(Number(value))}>
              <SelectTrigger id="decoder-difficulty" aria-label="Difficulty level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DECODER_DIFFICULTIES.map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    {level === 1 ? "Clear cues" : level === 2 ? "Subtler cues" : "Mixed feelings"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="block">Read aloud</Label>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                speak(
                  [scenario?.scenario, scenario?.dialogue].filter(Boolean).join(" "),
                )
              }
            >
              <Volume2 size={14} /> Listen
            </Button>
          </div>
        </div>

        {aiUnavailable && (
          <p className="text-xs text-muted-foreground">
            Practise with a built-in scenario right now; live ones will appear when the AI service is available.
          </p>
        )}

        {/* Scenario */}
        {loading || !scenario ? (
          <div className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
            Preparing a scenario…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 p-5 space-y-3">
              <p className="text-base font-medium">{scenario.scenario}</p>
              {scenario.dialogue && (
                <p className="text-sm italic text-muted-foreground">“{scenario.dialogue}”</p>
              )}
              <p className="text-sm font-semibold text-muted-foreground">{scenario.question}</p>

              {showHint && Array.isArray(scenario.cues) && scenario.cues.length > 0 && (
                <div className="rounded-xl bg-white/60 dark:bg-slate-900/40 p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cues to notice</p>
                  <ul className="list-disc list-inside space-y-0.5 text-sm">
                    {scenario.cues.map((cue) => (
                      <li key={cue}>{cue}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  setHintsUsed((current) => current + 1);
                  speak(scenario.cues?.join(". ") ?? scenario.explanation);
                }}
              >
                <Volume2 size={13} /> Hear the cues
              </Button>
            </div>

            {/* Answer */}
            <div className="space-y-2">
              <Label htmlFor="decoder-answer">What do you think they feel?</Label>
              <div className="flex gap-2 items-start">
                <Textarea
                  id="decoder-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Type a feeling word, e.g. excited, worried…"
                  rows={2}
                  disabled={Boolean(result)}
                />
                {voice.supported && (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={voice.listening ? "Stop listening" : "Answer by voice"}
                    title={voice.listening ? "Stop listening" : "Answer by voice"}
                    onClick={handleUseVoice}
                  >
                    {voice.listening ? <MicOff size={16} /> : <Mic size={16} />}
                  </Button>
                )}
              </div>
              {voice.listening && (
                <p className="text-xs text-muted-foreground" role="status">
                  Listening… {voice.interimTranscript || ""}
                </p>
              )}
              {voice.error && (
                <p className="text-xs text-amber-600" role="status">{voice.error}</p>
              )}
              {!result && (
                <Button onClick={handleSubmit} disabled={!answer.trim() || loading} className="gap-2">
                  <CheckCircle2 size={16} /> Check my answer
                </Button>
              )}
            </div>

            {/* Feedback */}
            {result && (
              <div
                className={`rounded-2xl border-2 p-4 ${
                  result.correct
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
                }`}
                role="status"
                aria-live="polite"
              >
                <p className={`font-semibold ${result.correct ? "text-emerald-700 dark:text-emerald-300" : "text-orange-700 dark:text-orange-300"}`}>
                  {result.correct ? "That's it!" : "Not quite yet."}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{result.feedback}</p>
                <Button className="mt-3 gap-2 w-full sm:w-auto" onClick={handleNext}>
                  Next scenario <ArrowRight size={16} />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{getDecoderActivityTypeById(activityType)?.label ?? "daily life"}</Badge>
          <Badge variant="secondary">Attempts: {performance.metrics.attempts}</Badge>
          <Badge variant="secondary">Correct: {performance.metrics.correct}</Badge>
          <Badge variant="secondary">Accuracy: {Math.round(performance.metrics.accuracy * 100)}%</Badge>
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
