/**
 * EmotionDecoderCard.jsx — Practise reading what someone might be feeling.
 *
 * Presents a short everyday scenario (situation + dialogue + cues), reads it
 * aloud on request, and grades a free-text answer deterministically against the
 * expected interpretations. Scenarios come from the Gemini provider when
 * available and always fall back to a deterministic library. The card consumes
 * the Adaptive Engine's module decision through `useModuleAdaptation` (never
 * the engine itself) to shape difficulty and hint availability.
 *
 * All logic, services, speech, voice and adaptation wiring are unchanged from
 * the previous implementation — only the presentation was redesigned to feel
 * like decoding a small real social scene.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getGeminiApiKey } from "@/features/socialCommunication/services/aiService";
import { useVoiceInput } from "@/features/socialCommunication/hooks/useVoiceInput";
import { useModuleAdaptation } from "@/hooks/useModuleAdaptation";
import { buildUserPreferencesFragment } from "@/support/framework/userPreferencesAdapter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Mic, MicOff, Sparkles, Volume2 } from "lucide-react";
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

const CHARACTER_TONES = ["teal", "sky", "amber", "violet", "rose"];

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

/** Adaptations become natural coach copy, never engine jargon. */
function friendlyAdaptationNote(signals) {
  if (signals.simplify && signals.provideHints) {
    return "Today we're keeping situations clearer and extra clues are always available.";
  }
  if (signals.simplify) return "Today we're keeping situations a little clearer.";
  if (signals.provideHints) return "Extra clues are available whenever you need them.";
  return null;
}

const CHARACTER_ACCESSORY = ["leaf", "star", "spark", "flower", "book"];

export default function EmotionDecoderCard() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const speak = useSpeech();
  const voice = useVoiceInput();
  const apiKey = getGeminiApiKey();
  const { recordEvent } = useASDPracticeCounts(userId);
  const { reduced, gentle } = useSensoryReducedMotion();

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

  useEffect(() => {
    loadScenario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      recordEvent(PROGRESS_EVENTS.EMOTION_SOLVED);
    }
  }, [scenario, answer, recordEvent]);

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

  const coachNote = friendlyAdaptationNote(signals);
  const characterIndex = Math.abs((scenario?.id ?? "decoder").split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0));

  return (
    <AsdCard tone="stone" className="!rounded-2xl !shadow-[4px_4px_0_#B2DFDB]">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-gradient-to-br from-[#FCD34D] to-[#F59E0B] text-white shadow-[2px_2px_0_#FDE68A]">
          <Sparkles size={20} />
        </span>
        <div>
          <h2 className="text-xl font-black text-[#134E4A]">Emotion Decoder</h2>
          <p className="text-sm text-[#5F8A87]">Read a small situation, then say or type what the person is most likely feeling.</p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="decoder-activity" className="text-sm font-bold text-[#134E4A]">Situation</Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger id="decoder-activity" aria-label="Situation type" className="border-[#B2DFDB]">
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
            <Label htmlFor="decoder-difficulty" className="text-sm font-bold text-[#134E4A]">Clues</Label>
            <Select value={String(difficulty)} onValueChange={(value) => setDifficulty(Number(value))}>
              <SelectTrigger id="decoder-difficulty" aria-label="Difficulty level" className="border-[#B2DFDB]">
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
            <Label className="block text-sm font-bold text-[#134E4A]">Read aloud</Label>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-[#B2DFDB] text-[#134E4A]"
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
          <p className="text-xs text-[#8B9C98]">
            Practising with a built-in situation right now; live ones will appear when the AI service is available.
          </p>
        )}

        {/* Scenario as a small social scene */}
        {loading || !scenario ? (
          <div className="rounded-2xl border-2 border-dashed border-[#B2DFDB] p-6 text-center text-sm text-[#5F8A87]">
            Setting the scene…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border-2 border-[#FDE68A] bg-gradient-to-br from-[#FFFDF5] to-[#FDF6E3]">
              <div className="flex items-start gap-3 p-5">
                <AsdCharacter
                  size={64}
                  ariaHidden
                  tone={CHARACTER_TONES[characterIndex % CHARACTER_TONES.length]}
                  accessory={CHARACTER_ACCESSORY[characterIndex % CHARACTER_ACCESSORY.length]}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <p className="text-base font-semibold leading-relaxed text-[#134E4A]">{scenario.scenario}</p>
                  {scenario.dialogue && (
                    <p className="relative rounded-2xl rounded-bl-sm border-2 border-[#FDE68A] bg-white px-4 py-2.5 text-sm italic text-[#7C5E10] shadow-sm">
                      “{scenario.dialogue}”
                    </p>
                  )}
                  <p className="flex items-center gap-2 text-sm font-black text-[#D97706]">
                    <Sparkles size={14} /> {scenario.question}
                  </p>

                  {showHint && Array.isArray(scenario.cues) && scenario.cues.length > 0 && (
                    <div className="rounded-xl bg-white/70 border border-[#FDE68A] p-3 space-y-1.5">
                      <p className="text-xs font-black uppercase tracking-wide text-[#B45309]">Clues to notice</p>
                      <div className="flex flex-wrap gap-1.5">
                        {scenario.cues.map((cue) => (
                          <AsdChip key={cue} tone="amber">{cue}</AsdChip>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-[#D97706]"
                        onClick={() => {
                          setHintsUsed((current) => current + 1);
                          speak(scenario.cues?.join(". ") ?? scenario.explanation);
                        }}
                      >
                        <Volume2 size={13} /> Hear the clues
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {coachNote && (
              <p className="flex items-center gap-2 text-xs font-semibold text-[#0D9488] rounded-xl bg-[#F0FAF7] border border-[#B2DFDB] px-3 py-2">
                <Sparkles size={13} /> {coachNote}
              </p>
            )}

            {/* Answer */}
            <div className="space-y-2">
              <Label htmlFor="decoder-answer" className="text-sm font-bold text-[#134E4A]">What do you think they feel?</Label>
              <div className="flex gap-2 items-start">
                <Textarea
                  id="decoder-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Type a feeling word, e.g. excited, worried…"
                  rows={2}
                  disabled={Boolean(result)}
                  className="border-[#B2DFDB] focus:border-[#0D9488]"
                />
                {voice.supported && (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={voice.listening ? "Stop listening" : "Answer by voice"}
                    title={voice.listening ? "Stop listening" : "Answer by voice"}
                    onClick={handleUseVoice}
                    className="border-[#B2DFDB] text-[#134E4A] shrink-0"
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
                <Button onClick={handleSubmit} disabled={!answer.trim() || loading} className="gap-2 bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB] font-bold">
                  Check my answer
                </Button>
              )}
            </div>

            {/* Feedback */}
            {result && (
              <AsdFeedback
                kind={result.correct ? "success" : "gentle"}
                title={result.correct ? "That's it!" : "Not quite yet."}
                action={
                  <Button className="gap-2 bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB] font-bold" onClick={handleNext}>
                    Next situation <ArrowRight size={16} />
                  </Button>
                }
              >
                {result.feedback}
              </AsdFeedback>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="rounded-xl border border-[#B2DFDB] bg-[#F0FAF7] p-3 space-y-2">
          <AsdProgressBar value={correctCount} max={Math.max(attempts, 1)} tone="amber" label={`Emotions solved · ${correctCount} of ${attempts || 0}`} />
          <div className="flex flex-wrap items-center gap-1.5">
            <AsdChip tone="teal">{getDecoderActivityTypeById(activityType)?.label ?? "Daily life"}</AsdChip>
            <AsdChip tone="neutral">Accuracy {Math.round(performance.metrics.accuracy * 100)}%</AsdChip>
          </div>
        </div>
      </div>
    </AsdCard>
  );
}