/**
 * SocialScenarioSimulatorCard.jsx — Practise ONE realistic social situation.
 *
 * The learner reads a single defined situation plus their role, speaks or types
 * one response, and immediately gets structured feedback (score, strengths,
 * improvements, detected cues, an optional suggested response and honest speech
 * notes). Scenarios come from Gemini when available and otherwise fall back to
 * a deterministic rotating library. The card consumes the Adaptive Engine's
 * module decision through `useModuleAdaptation` (never the engine itself), and
 * that decision only shows up as natural coach copy — e.g. "Let's try a
 * simpler situation." It is visually distinct from Conversation Practice: one
 * immersive situation, one response, then an evaluation of how well it fit.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { getGeminiApiKey } from "@/features/socialCommunication/services/aiService";
import { useVoiceInput } from "@/features/socialCommunication/hooks/useVoiceInput";
import { useModuleAdaptation } from "@/hooks/useModuleAdaptation";
import { buildUserPreferencesFragment } from "@/support/framework/userPreferencesAdapter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, Mic, MicOff, Sparkles, Volume2 } from "lucide-react";
import {
  SCENARIO_CATEGORIES,
  SCENARIO_DIFFICULTIES,
  SOCIAL_SCENARIO_MODULE_ID,
  getScenarioCategoryById,
  getScenarioDifficultyById,
} from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";
import {
  SOCIAL_SCENARIO_STRATEGY_ID,
  buildScenarioConfig,
  generateScenario,
  getScenarioAttemptStats,
  listScenarioAttempts,
  recordScenarioAttempt,
} from "@/support/modules/socialScenarioSimulator/scenarioService";
import { evaluateResponse } from "@/support/modules/socialScenarioSimulator/evaluationService";
import { useReflectionSignals } from "@/adaptive/reflection/useReflectionSignals";
import { resolveOutcomeRating } from "@/adaptive/reflection/outcomeRatings";
import { saveInterventionOutcome } from "@/support/persistence/role4Store";
import { ROLE4_SCHEMA_VERSION } from "@/support/schemas/storageKeys";
import {
  InterventionStatus,
  ModuleCategory,
  OutcomeSource,
  PrivacyLevel,
} from "@/support/schemas/supportSchemas";
import {
  AsdCard,
  AsdCharacter,
  AsdChip,
  AsdDecor,
  AsdFeedback,
  AsdProgressBar,
  AsdRewardStars,
  AsdScene,
  AsdSpeechBubble,
  useASDPracticeCounts,
  useASDVisualStyle,
  PROGRESS_EVENTS,
} from "@/components/asd/ui";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";
import AdaptationExplanation from "@/components/adaptive/AdaptationExplanation";
import { buildAdaptationExplanation } from "@/adaptive/presentation/adaptationPresentation";

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

/** Pick the dominant strategy referenced by Tier 9 learned-personalization
 *  adjustments, mirroring deriveFeatureSignals in the adaptive engine. */
function tier9StrategyReference(adjustments, preference) {
  const match = (adjustments ?? []).find(
    (adj) =>
      adj &&
      typeof adj?.parameters?.strategyId === "string" &&
      adj.parameters.strategyId.trim().length > 0 &&
      adj.parameters.preference === preference,
  );
  return match?.parameters?.strategyId ?? null;
}

function deriveSignals(adjustments = []) {
  return {
    simplify: adjustments.some((adj) => adj.type === "SIMPLIFY" || adj.type === "REDUCE"),
    provideHints: adjustments.some((adj) => adj.type === "GUIDE"),
    slowPace: adjustments.some((adj) => adj.type === "DECREASE"),
    preferredStrategyId: tier9StrategyReference(adjustments, "prefer"),
    deprioritizedStrategyId: tier9StrategyReference(adjustments, "deprioritize"),
  };
}

const STAGE_GRADIENTS = [
  "radial-gradient(120% 120% at 15% 10%, #EDE9FE 0%, #DDD6FE 55%, #C4B5FD 100%)",
  "radial-gradient(120% 120% at 85% 10%, #E0F2FE 0%, #BAE6FD 55%, #A5B4FC 100%)",
  "radial-gradient(120% 120% at 50% 0%, #FDE8FF 0%, #F5D0FE 55%, #C4B5FD 100%)",
];

const NPC_TONES = ["violet", "sky", "rose", "teal"];
const NPC_ACCESSORIES = ["spark", "cloud", "star", "book"];

function scoreTone(score) {
  if (score >= 75) return { kind: "success", label: "Great response" };
  if (score >= 50) return { kind: "gentle", label: "Good start" };
  return { kind: "neutral", label: "Keep practising" };
}

const hashOf = (value) => String(value).split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

export default function SocialScenarioSimulatorCard() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const speak = useSpeech();
  const voice = useVoiceInput();
  const apiKey = getGeminiApiKey();
  const { recordEvent } = useASDPracticeCounts(userId);
  const { reduced, gentle } = useSensoryReducedMotion();
  const { style } = useASDVisualStyle();
  const playful = style === "younger";
  const reflection = useReflectionSignals(userId);

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
    role4Signals: reflection.signals,
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

    const rating = resolveOutcomeRating({
      score: Number.isFinite(evaluation.score) ? evaluation.score : undefined,
    });
    const now = new Date().toISOString();
    saveInterventionOutcome(userId, {
      schemaVersion: ROLE4_SCHEMA_VERSION,
      id: `scenario-out-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      interventionId: `scenario-${scenario.id ?? "round"}-${Date.now()}`,
      moduleId: SOCIAL_SCENARIO_MODULE_ID,
      interventionType: "social_scenario_simulation",
      category: ModuleCategory.SPECIALIZED,
      status: InterventionStatus.COMPLETED,
      source: OutcomeSource.MODULE_EVENT,
      privacy: PrivacyLevel.PRIVATE,
      completed: true,
      rating: rating ?? undefined,
      metrics: {
        score: evaluation.score ?? null,
        difficulty: scenario.difficulty ?? null,
        category: scenario.category ?? null,
        scenarioId: scenario.id ?? null,
        usedAi: evaluation.usedAi === true,
        voiceUsed: Boolean(voiceCapture),
      },
      createdAt: now,
      updatedAt: now,
    });
    reflection.refresh();

    recordEvent(PROGRESS_EVENTS.SCENARIO_PRACTISED);
    refreshStats();
  }, [scenario, response, voiceCapture, config, apiKey, userId, refreshStats, recordEvent, reflection]);

  const showCues = config.hintsEnabled || result || config.deprioritizedByHistory;
  const cuesToShow = showCues
    ? config.reducedCues
      ? scenario?.cues?.slice(0, 2)
      : scenario?.cues
    : [];

  const tone = result ? scoreTone(result.score) : null;
  const adaptationExplanation = buildAdaptationExplanation({
    feature: "socialScenario",
    baseline: {
      difficulty: getScenarioDifficultyById(difficulty)?.label ?? "Easy",
      supportiveCues: false,
    },
    applied: {
      difficulty: getScenarioDifficultyById(scenario?.difficulty ?? config.difficulty)?.label ?? "Easy",
      supportiveCues: config.hintsEnabled,
    },
  });
  const stageSeed = hashOf(scenario?.id ?? "stage");
  const stageKind = stageSeed % STAGE_GRADIENTS.length;
  const npcTone = NPC_TONES[stageSeed % NPC_TONES.length];
  const npcAccessory = NPC_ACCESSORIES[stageSeed % NPC_ACCESSORIES.length];

  return (
    <AsdCard tone="stone" className="!rounded-2xl !shadow-[4px_4px_0_#C4B5FD]">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-gradient-to-br from-[#C4B5FD] to-[#7C3AED] text-white shadow-[2px_2px_0_#EDE9FE]">
          <Sparkles size={20} />
        </span>
        <div>
          <h2 className="text-xl font-black text-[#134E4A]">Social Scenario Simulator</h2>
          <p className="text-sm text-[#5F8A87]">Step into one situation, respond once, then see how well it fit.</p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="scenario-category" className="text-sm font-bold text-[#134E4A]">Area</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="scenario-category" aria-label="Scenario area" className="border-[#DDD6FE]">
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
            <Label htmlFor="scenario-difficulty" className="text-sm font-bold text-[#134E4A]">Level</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger id="scenario-difficulty" aria-label="Difficulty level" className="border-[#DDD6FE]">
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
            <Label className="block text-sm font-bold text-[#134E4A]">Read aloud</Label>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-[#DDD6FE] text-[#6D28D9]"
              onClick={() => speak([scenario?.situation, scenario?.question].filter(Boolean).join(" "))}
              disabled={!scenario}
            >
              <Volume2 size={14} /> Listen
            </Button>
          </div>
        </div>

        {aiUnavailable && (
          <p className="text-xs text-[#8B9C98]">
            Practising with a built-in situation right now; live ones will appear when the AI service is available.
          </p>
        )}

        {/* The stage — one immersive situation */}
        {loading || !scenario ? (
          <div className="rounded-2xl border-2 border-dashed border-[#DDD6FE] p-6 text-center text-sm text-[#5F8A87]">
            Setting the scene…
          </div>
        ) : (
          <div className="space-y-4">
            <AdaptationExplanation explanation={adaptationExplanation} />
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: gentle ? 0.3 : 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className="asd-stage-glow overflow-hidden rounded-2xl border-2 border-[#DDD6FE]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#DDD6FE]/70 bg-white/60 px-4 py-2">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6D28D9]">
                  Scenario Simulator
                </p>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#DDD6FE] bg-[#F5F3FF] px-2.5 py-0.5 text-[11px] font-bold text-[#6D28D9]">
                    {getScenarioCategoryById(scenario.category)?.label ?? "Daily life"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#DDD6FE] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#6D28D9]">
                    {getScenarioDifficultyById(scenario.difficulty)?.label ?? "Easy"}
                  </span>
                </span>
              </div>

              <AsdScene
                gradient={STAGE_GRADIENTS[stageKind]}
                blobPalette={stageKind}
                className="relative"
              >
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                  <div className="flex shrink-0 flex-col items-center gap-1.5 self-center sm:self-start">
                    <div className="relative">
                      <span className="absolute -inset-2 rounded-full bg-[#8B5CF6]/15" aria-hidden="true" />
                      <AsdCharacter
                        size={72}
                        ariaHidden
                        className="asd-illustration nb-mascot-float relative drop-shadow-[0_6px_12px_rgba(109,40,217,0.25)]"
                        tone={npcTone}
                        accessory={npcAccessory}
                      />
                      <AsdDecor className="absolute -right-2 -top-1 text-xl" label="a sparkle">✨</AsdDecor>
                    </div>
                    <AsdChip tone="violet">They</AsdChip>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    {scenario.title && <p className="text-xs font-bold uppercase tracking-wide text-[#5B21B6]">{scenario.title}</p>}
                    <AsdSpeechBubble tone="violet" align="left">
                      {scenario.situation}
                    </AsdSpeechBubble>
                    {scenario.role && (
                      <p className="text-sm italic text-[#6B7280]">Your role: {scenario.role}</p>
                    )}
                    {scenario.question && (
                      <p className="ml-6 flex items-start gap-2 rounded-2xl rounded-br-sm border-2 border-[#A78BFA] bg-white px-4 py-2.5 text-sm font-bold text-[#5B21B6] shadow-sm">
                        <span className="mt-0.5" aria-hidden="true">🗨️</span>
                        <span>“{scenario.question}”</span>
                      </p>
                    )}

                    {showCues && Array.isArray(cuesToShow) && cuesToShow.length > 0 && (
                      <div className="rounded-xl bg-white/80 border border-[#DDD6FE] p-3 space-y-1.5">
                        <p className="text-xs font-black uppercase tracking-wide text-[#6D28D9]">Cues to notice</p>
                        <div className="flex flex-wrap gap-1.5">
                          {cuesToShow.map((cue) => (
                            <AsdChip key={cue} tone="violet">{cue}</AsdChip>
                          ))}
                        </div>
                      </div>
                    )}
                    {showCues && scenario.hint && (
                      <p className="text-xs italic text-[#6D28D9]">Hint: {scenario.hint}</p>
                    )}
                  </div>
                </div>

                {!result && (
                  <div className="border-t border-white/50 bg-white/40 px-5 py-3">
                    <p className="flex items-center gap-2 text-sm font-black text-[#5B21B6]">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#7C3AED] text-white text-[11px]" aria-hidden="true">You</span>
                      What would you do next?
                    </p>
                  </div>
                )}
              </AsdScene>
            </motion.div>

            {/* Response */}
            <div className="space-y-2">
              <Label htmlFor="scenario-response" className="text-sm font-bold text-[#134E4A]">How would you respond?</Label>
              <div className="flex gap-2 items-start">
                <Textarea
                  id="scenario-response"
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder="Type your reply, or use the microphone…"
                  rows={2}
                  disabled={Boolean(result)}
                  className="border-[#DDD6FE] focus:border-[#7C3AED]"
                />
                {voice.supported && (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={voice.listening ? "Stop listening" : "Respond by voice"}
                    title={voice.listening ? "Stop listening" : "Respond by voice"}
                    onClick={handleUseVoice}
                    className="border-[#DDD6FE] text-[#6D28D9] shrink-0"
                  >
                    {voice.listening ? <MicOff size={16} /> : <Mic size={16} />}
                  </Button>
                )}
              </div>
              {voice.listening && (
                <p className="text-xs text-[#5F8A87]" role="status">
                  Listening… {voice.interimTranscript || ""}
                </p>
              )}
              {voice.error && (
                <p className="text-xs text-amber-600" role="status">{voice.error}</p>
              )}
              {!result && (
                <Button onClick={handleSubmit} disabled={!response.trim() || loading} className="gap-2 bg-[#7C3AED] text-white hover:bg-[#6D28D9] shadow-[2px_2px_0_#C4B5FD] font-bold">
                  <CheckCircle2 size={16} /> {playful ? "Try it out!" : "Check my response"}
                </Button>
              )}
            </div>

            {/* Feedback */}
            {result && tone && (
              <AsdFeedback
                kind={tone.kind}
                title={`${playful ? "Nice try!" : "Debrief"} · ${result.score}/100`}
                action={
                  <Button className="gap-2 w-full sm:w-auto bg-[#7C3AED] text-white hover:bg-[#6D28D9] shadow-[2px_2px_0_#C4B5FD] font-bold" onClick={handleNext}>
                    {playful ? "Next!" : "Next situation"} <ArrowRight size={16} />
                  </Button>
                }
              >
                {result.score >= 70 && <div className="pb-1"><AsdRewardStars earned={3} label="Great score" /></div>}
                {result.usedAi && <p className="text-xs font-semibold text-[#6D28D9]">AI-enhanced feedback</p>}
                {result.reasoning && <p className="text-sm text-[#5F8A87]">{result.reasoning}</p>}

                {Array.isArray(result.strengths) && result.strengths.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-wide text-[#5F8A87]">What went well</p>
                    <ul className="list-disc list-inside space-y-0.5 text-sm text-[#134E4A]">
                      {result.strengths.map((strength) => <li key={strength}>{strength}</li>)}
                    </ul>
                  </div>
                )}

                {Array.isArray(result.improvements) && result.improvements.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-wide text-[#5F8A87]">To try next time</p>
                    <ul className="list-disc list-inside space-y-0.5 text-sm text-[#134E4A]">
                      {result.improvements.map((improvement) => <li key={improvement}>{improvement}</li>)}
                    </ul>
                  </div>
                )}

                {Array.isArray(result.detectedCues) && result.detectedCues.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-wide text-[#5F8A87]">Cues you noticed</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.detectedCues.map((cue) => <AsdChip key={cue} tone="violet">{cue}</AsdChip>)}
                    </div>
                  </div>
                )}

                {result.suggestedResponse && (
                  <p className="text-sm text-[#134E4A]">
                    <span className="font-semibold">Another way to put it: </span>
                    <span className="italic">“{result.suggestedResponse}”</span>
                  </p>
                )}

                {result.speechNotes?.available && (
                  <p className="text-xs text-[#5F8A87]">{result.speechNotes.note}</p>
                )}
              </AsdFeedback>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] p-3 space-y-2">
          <AsdProgressBar
            value={Math.round(stats.averageScore ?? 0)}
            max={100}
            tone="violet"
            label="Average response score"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <AsdChip tone="violet">Attempts: {stats.totalAttempts}</AsdChip>
            {Number.isFinite(stats.averageScore) && <AsdChip tone="neutral">Average score: {stats.averageScore}</AsdChip>}
          </div>
        </div>

        {/* Recent attempts */}
        {recentAttempts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-black uppercase tracking-wide text-[#5F8A87]">Recent practice</p>
            <ul className="space-y-1.5">
              {recentAttempts.map((attempt) => (
                <li key={attempt.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#DDD6FE] bg-white/70 px-3 py-2">
                  <span className="truncate text-sm font-medium text-[#134E4A]">{attempt.title}</span>
                  <span className="shrink-0 text-sm text-[#5F8A87]">
                    {Number.isFinite(attempt.score) ? `${attempt.score}/100` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AsdCard>
  );
}
