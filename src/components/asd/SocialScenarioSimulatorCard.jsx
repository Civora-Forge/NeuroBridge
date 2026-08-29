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
  buildScenarioConfig,
  generateScenario,
  getScenarioAttemptStats,
  listScenarioAttempts,
  recordScenarioAttempt,
} from "@/support/modules/socialScenarioSimulator/scenarioService";
import { evaluateResponse } from "@/support/modules/socialScenarioSimulator/evaluationService";
import {
  AsdCard,
  AsdCharacter,
  AsdChip,
  AsdFeedback,
  AsdProgressBar,
  useASDPracticeCounts,
  PROGRESS_EVENTS,
} from "@/components/asd/ui";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

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

/** Adaptations become natural coach copy, never engine jargon. */
function friendlyAdaptationNote(signals) {
  if (signals.simplify) return "Let's try a simpler situation.";
  if (signals.slowPace) return "We'll take this one slowly — no rush.";
  if (signals.provideHints) return "Clues are switched on for now.";
  return null;
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
    recordEvent(PROGRESS_EVENTS.SCENARIO_PRACTISED);
    refreshStats();
  }, [scenario, response, voiceCapture, config, apiKey, userId, refreshStats, recordEvent]);

  const showCues = config.hintsEnabled || result;
  const cuesToShow = showCues
    ? config.reducedCues
      ? scenario?.cues?.slice(0, 2)
      : scenario?.cues
    : [];

  const tone = result ? scoreTone(result.score) : null;
  const coachNote = friendlyAdaptationNote(signals);
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
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: gentle ? 0.3 : 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden rounded-2xl border-2 border-[#DDD6FE]"
              style={{ background: STAGE_GRADIENTS[stageKind] }}
            >
              <div className="flex items-start gap-3 p-5">
                <div className="flex flex-col items-center gap-1.5">
                  <AsdCharacter
                    size={68}
                    ariaHidden
                    tone={npcTone}
                    accessory={npcAccessory}
                    className="nb-mascot-float drop-shadow-[0_6px_12px_rgba(109,40,217,0.25)]"
                  />
                  <AsdChip tone="violet">NPC</AsdChip>
                </div>
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AsdChip tone="violet">{getScenarioCategoryById(scenario.category)?.label ?? "Daily life"}</AsdChip>
                    <AsdChip tone="neutral">{getScenarioDifficultyById(scenario.difficulty)?.label ?? "Easy"}</AsdChip>
                  </div>
                  {scenario.title && <p className="text-xs font-bold uppercase tracking-wide text-[#5B21B6]">{scenario.title}</p>}
                  <p className="relative rounded-2xl rounded-bl-sm border-2 border-white/70 bg-white/95 px-4 py-3 text-base font-semibold leading-relaxed text-[#312E81] shadow-sm">
                    {scenario.situation}
                  </p>
                  {scenario.role && (
                    <p className="text-sm italic text-[#6B7280]">Your role: {scenario.role}</p>
                  )}
                  {scenario.question && (
                    <p className="relative ml-8 rounded-2xl rounded-br-sm border-2 border-[#A78BFA] bg-white px-4 py-2.5 text-sm font-bold text-[#5B21B6] shadow-sm">
                      <span className="mr-1.5" aria-hidden="true">🗨️</span>“{scenario.question}”
                    </p>
                  )}

                  {showCues && Array.isArray(cuesToShow) && cuesToShow.length > 0 && (
                    <div className="rounded-xl bg-white/70 border border-[#DDD6FE] p-3 space-y-1.5">
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
            </motion.div>

            {coachNote && (
              <p className="flex items-center gap-2 text-xs font-semibold text-[#7C3AED] rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] px-3 py-2">
                <Sparkles size={13} /> {coachNote}
              </p>
            )}

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
                  <CheckCircle2 size={16} /> Check my response
                </Button>
              )}
            </div>

            {/* Feedback */}
            {result && tone && (
              <AsdFeedback
                kind={tone.kind}
                title={`${tone.label} · ${result.score}/100`}
                action={
                  <Button className="gap-2 w-full sm:w-auto bg-[#7C3AED] text-white hover:bg-[#6D28D9] shadow-[2px_2px_0_#C4B5FD] font-bold" onClick={handleNext}>
                    Next situation <ArrowRight size={16} />
                  </Button>
                }
              >
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