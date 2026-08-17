/**
 * SocialScenarioSimulatorCard.jsx — Practise ONE realistic social situation.
 *
 * The learner reads a single defined situation plus their role, speaks or types
 * one response, and immediately gets structured feedback (score, strengths,
 * improvements, detected cues, an optional suggested response and honest speech
 * notes). Scenarios come from Gemini when available and otherwise fall back to
 * a deterministic rotating library. The card consumes the Adaptive Engine's
 * module decision through `useModuleAdaptation` (never the engine itself).
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
import { ArrowRight, CheckCircle2, Mic, MicOff, MessagesSquare, Volume2 } from "lucide-react";
import {
  SCENARIO_CATEGORIES,
  SCENARIO_DIFFICULTIES,
  SOCIAL_SCENARIO_MODULE_ID,
  getScenarioCategoryById,
  getScenarioDifficultyById,
} from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";
import {
  buildScenarioConfig,
  generateScenario,
  getScenarioAttemptStats,
  listScenarioAttempts,
  recordScenarioAttempt,
} from "@/support/modules/socialScenarioSimulator/scenarioService";
import { evaluateResponse } from "@/support/modules/socialScenarioSimulator/evaluationService";

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
    slowPace: adjustments.some((adj) => adj.type === "DECREASE"),
  };
}

function scoreTone(score) {
  if (score >= 75) return { label: "Great response", className: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" };
  if (score >= 50) return { label: "Good start", className: "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" };
  return { label: "Keep practising", className: "border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300" };
}

export default function SocialScenarioSimulatorCard() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const speak = useSpeech();
  const voice = useVoiceInput();
  const apiKey = getGeminiApiKey();

  const [category, setCategory] = useState("daily_life");
  const [difficulty, setDifficulty] = useState("easy");
  const [scenario, setScenario] = useState(null);
  const [response, setResponse] = useState("");
  const [result, setResult] = useState(null);
  const [variantSeed, setVariantSeed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [voiceCapture, setVoiceCapture] = useState(null);
  const [stats, setStats] = useState({ totalAttempts: 0, averageScore: null });
  const [recentAttempts, setRecentAttempts] = useState([]);

  const userPreferences = useMemo(() => buildUserPreferencesFragment(user), [user]);

  const getSnapshot = useCallback(
    () => ({
      screen: SOCIAL_SCENARIO_MODULE_ID,
      session: {
        category,
        difficulty,
        attempts: stats.totalAttempts,
      },
      userProfile: {
        accessibility: user?.accessibility ?? null,
        disorders: Array.isArray(user?.disorders) ? user.disorders : [],
      },
    }),
    [category, difficulty, stats.totalAttempts, user],
  );

  const adaptation = useModuleAdaptation({
    moduleId: SOCIAL_SCENARIO_MODULE_ID,
    getSnapshot,
    userId,
    userPreferences,
  });

  const signals = useMemo(() => deriveSignals(adaptation.adjustments), [adaptation.adjustments]);

  const config = useMemo(
    () => buildScenarioConfig({ category, difficulty, signals, variantSeed }),
    [category, difficulty, signals, variantSeed],
  );

  const refreshStats = useCallback(() => {
    setStats(getScenarioAttemptStats(userId));
    setRecentAttempts(listScenarioAttempts(userId, { limit: 5 }));
  }, [userId]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const loadScenario = useCallback(
    async (nextConfig) => {
      setLoading(true);
      try {
        const outcome = await generateScenario(nextConfig ?? config, { apiKey });
        setScenario(outcome.scenario);
        setAiUnavailable(!outcome.aiAvailable);
      } finally {
        setLoading(false);
      }
    },
    [config, apiKey],
  );

  useEffect(() => {
    loadScenario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scenario) {
      loadScenario();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, difficulty]);

  const handleNext = useCallback(() => {
    setVariantSeed((current) => current + 1);
    setResponse("");
    setResult(null);
    setVoiceCapture(null);
  }, []);

  useEffect(() => {
    if (variantSeed > 0) {
      loadScenario();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantSeed]);

  const handleUseVoice = useCallback(() => {
    if (voice.listening) {
      voice.stop();
      return;
    }
    voice.start();
  }, [voice]);

  useEffect(() => {
    if (voice.transcript) {
      setResponse(voice.transcript);
    }
  }, [voice.transcript]);

  useEffect(() => {
    if (voice.capture) {
      setVoiceCapture(voice.capture);
    }
  }, [voice.capture]);

  const handleSubmit = useCallback(async () => {
    if (!response.trim() || !scenario) return;
    const evaluation = await evaluateResponse({
      scenario,
      response,
      capture: voiceCapture,
      config,
      apiKey,
    });
    setResult(evaluation);
    recordScenarioAttempt(userId, {
      scenario,
      evaluation,
      response,
      voiceUsed: Boolean(voiceCapture),
    });
    refreshStats();
  }, [scenario, response, voiceCapture, config, apiKey, userId, refreshStats]);

  const showCues = config.hintsEnabled || result;
  const cuesToShow = showCues
    ? config.reducedCues
      ? scenario?.cues?.slice(0, 2)
      : scenario?.cues
    : [];

  const tone = result ? scoreTone(result.score) : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <MessagesSquare size={20} /> Social Scenario Simulator
        </CardTitle>
        <CardDescription>
          Read one situation, then say or type how you would respond. You get kind, specific feedback each time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="scenario-category">Area</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="scenario-category" aria-label="Scenario area">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIO_CATEGORIES.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scenario-difficulty">Level</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger id="scenario-difficulty" aria-label="Difficulty level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIO_DIFFICULTIES.map((level) => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.label}
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
                speak([scenario?.situation, scenario?.question].filter(Boolean).join(" "))
              }
              disabled={!scenario}
            >
              <Volume2 size={14} /> Listen
            </Button>
          </div>
        </div>

        {aiUnavailable && (
          <p className="text-xs text-muted-foreground">
            Practise with a built-in situation right now; live ones will appear when the AI service is available.
          </p>
        )}

        {/* Scenario */}
        {loading || !scenario ? (
          <div className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
            Preparing a situation…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 p-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{getScenarioCategoryById(scenario.category)?.label ?? "Daily Life"}</Badge>
                <Badge variant="secondary">{getScenarioDifficultyById(scenario.difficulty)?.label ?? "Easy"}</Badge>
              </div>
              {scenario.title && <p className="text-sm font-semibold text-muted-foreground">{scenario.title}</p>}
              <p className="text-base font-medium">{scenario.situation}</p>
              {scenario.role && <p className="text-sm italic text-muted-foreground">Your role: {scenario.role}</p>}
              {scenario.question && (
                <p className="text-sm font-semibold">“{scenario.question}”</p>
              )}

              {showCues && Array.isArray(cuesToShow) && cuesToShow.length > 0 && (
                <div className="rounded-xl bg-white/60 dark:bg-slate-900/40 p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cues to notice</p>
                  <ul className="list-disc list-inside space-y-0.5 text-sm">
                    {cuesToShow.map((cue) => (
                      <li key={cue}>{cue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {showCues && scenario.hint && (
                <p className="text-xs italic text-muted-foreground">Hint: {scenario.hint}</p>
              )}
            </div>

            {/* Response */}
            <div className="space-y-2">
              <Label htmlFor="scenario-response">How would you respond?</Label>
              <div className="flex gap-2 items-start">
                <Textarea
                  id="scenario-response"
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder="Type your reply, or use the microphone…"
                  rows={2}
                  disabled={Boolean(result)}
                />
                {voice.supported && (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={voice.listening ? "Stop listening" : "Respond by voice"}
                    title={voice.listening ? "Stop listening" : "Respond by voice"}
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
                <Button onClick={handleSubmit} disabled={!response.trim() || loading} className="gap-2">
                  <CheckCircle2 size={16} /> Check my response
                </Button>
              )}
            </div>

            {/* Feedback */}
            {result && tone && (
              <div className={`rounded-2xl border-2 p-4 space-y-3 ${tone.className}`} role="status" aria-live="polite">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{tone.label} — score {result.score}/100</p>
                  {result.usedAi && (
                    <span className="text-[11px] font-medium text-muted-foreground">AI-enhanced feedback</span>
                  )}
                </div>
                {result.reasoning && <p className="text-sm text-muted-foreground">{result.reasoning}</p>}

                {Array.isArray(result.strengths) && result.strengths.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What went well</p>
                    <ul className="list-disc list-inside space-y-0.5 text-sm">
                      {result.strengths.map((strength) => (
                        <li key={strength}>{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(result.improvements) && result.improvements.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To try next time</p>
                    <ul className="list-disc list-inside space-y-0.5 text-sm">
                      {result.improvements.map((improvement) => (
                        <li key={improvement}>{improvement}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(result.detectedCues) && result.detectedCues.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cues you noticed</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.detectedCues.map((cue) => (
                        <Badge key={cue} variant="secondary">{cue}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {result.suggestedResponse && (
                  <p className="text-sm">
                    <span className="font-semibold">Another way to put it: </span>
                    <span className="italic">“{result.suggestedResponse}”</span>
                  </p>
                )}

                {result.speechNotes?.available && (
                  <p className="text-xs text-muted-foreground">{result.speechNotes.note}</p>
                )}

                <Button className="mt-1 gap-2 w-full sm:w-auto" onClick={handleNext}>
                  Next situation <ArrowRight size={16} />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Attempts: {stats.totalAttempts}</Badge>
          {Number.isFinite(stats.averageScore) && (
            <Badge variant="secondary">Average score: {stats.averageScore}</Badge>
          )}
        </div>

        {/* Recent attempts */}
        {recentAttempts.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent practice</p>
            <ul className="space-y-1 text-sm">
              {recentAttempts.map((attempt) => (
                <li key={attempt.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{attempt.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {Number.isFinite(attempt.score) ? `${attempt.score}/100` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
