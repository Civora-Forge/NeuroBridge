import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb, MessagesSquare, Mic, MicOff, Pause, Play, RotateCcw, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DIFFICULTY_LEVELS, SESSION_STATUS, SPEAKER, RESPONSE_SOURCE } from "../types/communicationTypes";
import { extractSpeechFeatures } from "../services/speechAnalysis";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { AsdCharacter, AsdChip } from "@/components/asd/ui";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";
import AdaptationExplanation from "@/components/adaptive/AdaptationExplanation";
import { buildAdaptationExplanation } from "@/adaptive/presentation/adaptationPresentation";

function MessageBubble({ turn, largeText, kind = "teal" }) {
  const isUser = turn.speaker === SPEAKER.USER;
  const { reduced, gentle } = useSensoryReducedMotion();
  return (
    <motion.div
      className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
      initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: gentle ? 0.25 : 0.3, ease: "easeOut" }}
    >
      {!isUser && (
        <AsdCharacter
          size={34}
          ariaHidden
          tone={kind}
          accessory="spark"
          className="mb-0.5"
        />
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-gradient-to-r from-[#0D9488] to-[#14B8A6] text-white rounded-br-sm shadow-[2px_2px_0_#B2DFDB]"
            : "bg-white border-2 border-[#B2DFDB] text-[#134E4A] rounded-bl-sm"
        } ${largeText ? "text-base" : ""}`}
      >
        <p>{turn.text}</p>
        {turn.source === RESPONSE_SOURCE.VOICE && (
          <p className={`text-[11px] mt-1 ${isUser ? "text-teal-100" : "text-[#3D6A66]"}`}>
            Spoken reply
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default function ConversationView({ engine }) {
  const session = engine.session;
  const scenario = session?.scenario;
  const voice = useVoiceInput();

  const [draft, setDraft] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [voiceSubmitted, setVoiceSubmitted] = useState(false);
  const scrollRef = useRef(null);

  const isActive = session?.status === SESSION_STATUS.ACTIVE;
  const isPaused = session?.status === SESSION_STATUS.PAUSED;
  const hintsAvailable = session?.hintsEnabled || session?.adaptation?.provideHints === true;

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [session?.turns?.length]);

  useEffect(() => {
    if (voice.capture && !voiceSubmitted) {
      const { transcript, durationMs, latencyMs } = voice.capture;
      setVoiceSubmitted(true);
      if (transcript && transcript.trim().length > 0) {
        const speech = extractSpeechFeatures({ transcript, durationMs, latencyMs });
        engine.submitReply(transcript, { source: RESPONSE_SOURCE.VOICE, speech });
      }
      setDraft(transcript || draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.capture]);

  useEffect(() => {
    if (!voice.listening) {
      setVoiceSubmitted(false);
    }
  }, [voice.listening]);

  const sendText = () => {
    const text = draft.trim();
    if (!text || engine.busy || !isActive) return;
    setDraft("");
    engine.submitReply(text, { source: RESPONSE_SOURCE.TEXT });
  };

  const toggleVoice = () => {
    if (voice.listening) {
      voice.stop();
    } else {
      voice.start();
    }
  };

  const npcName = scenario?.npc?.name ?? "Alex";
  const requestedDifficulty = session?.requestedDifficulty ?? session?.difficulty;
  const adaptationExplanation = buildAdaptationExplanation({
    feature: "conversation",
    baseline: {
      difficulty: requestedDifficulty,
      hintsEnabled: DIFFICULTY_LEVELS[requestedDifficulty]?.hints === true,
      pacing: "normal",
    },
    applied: {
      difficulty: session?.effectiveDifficulty,
      hintsEnabled: session?.hintsEnabled,
      pacing: session?.adaptation?.pacing ?? "normal",
    },
  });

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border-2 border-[#B2DFDB] shadow-[3px_3px_0_#D5F5EC]">
        <div className="flex items-center justify-between gap-3 border-b-2 border-[#B2DFDB] bg-white/80 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <AsdCharacter size={38} ariaHidden tone="cyan" accessory="cloud" />
              <span
                aria-hidden="true"
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                  isActive ? "bg-[#34D399]" : "bg-[#A7B6B3]"
                }`}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#134E4A]">{npcName}</p>
              <p className="flex items-center gap-1 text-xs text-[#3D6A66]">
                {isActive ? (
                  <>
                    <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full bg-[#34D399] ${engine.a11y.reduceMotion ? "" : "asd-pulse-soft"}`} />
                    Live practice
                  </>
                ) : isPaused ? (
                  "Paused"
                ) : (
                  "Session"
                )}
                <span aria-hidden="true" className="mx-0.5 text-[#A7B6B3]">·</span>
                Turn {Math.min(session?.turnCount ?? 0, session?.turnLimit ?? 1)} of {session?.turnLimit}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="border-[#B2DFDB] text-[#134E4A] h-8" onClick={isPaused ? engine.resume : engine.pause}>
              {isPaused ? <Play className="w-3.5 h-3.5 mr-1.5" /> : <Pause className="w-3.5 h-3.5 mr-1.5" />}
              {isPaused ? "Resume" : "Pause"}
            </Button>
            <Button variant="outline" size="sm" className="border-[#B2DFDB] text-[#134E4A] h-8" onClick={engine.endEarly}>
              <Square className="w-3.5 h-3.5 mr-1.5" /> End practice
            </Button>
          </div>
        </div>

      <div
        ref={scrollRef}
        className="asd-chat-scroll h-[380px] overflow-y-auto bg-gradient-to-b from-[#F0FAF7] to-[#E6F7F2] p-4 space-y-3"
      >
        {scenario?.title && (
          <div className="flex justify-center pb-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#B2DFDB] bg-white/80 px-3 py-1 text-xs font-bold text-[#0F766E]">
              <MessagesSquare className="w-3.5 h-3.5" aria-hidden="true" /> {scenario.title}
            </span>
          </div>
        )}

        <div className="flex items-end gap-2 justify-start">
          <AsdCharacter size={34} ariaHidden tone="cyan" accessory="spark" className="mb-0.5" />
          <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-white border-2 border-[#B2DFDB] text-[#134E4A] rounded-bl-sm">
            <p className="italic">“{scenario?.openingLine}”</p>
            <p className="text-[11px] text-[#3D6A66] mt-1">{npcName} started the conversation.</p>
          </div>
        </div>

        {(session?.turns ?? []).map((turn) => (
          <MessageBubble key={turn.id} turn={turn} largeText={engine.a11y.largeText} kind="cyan" />
        ))}

        {engine.busy && (
          <div className="flex items-end gap-2 justify-start">
            <AsdCharacter size={34} ariaHidden tone="cyan" accessory="spark" className="mb-0.5" />
            <div className="rounded-2xl px-4 py-2.5 bg-white border-2 border-[#B2DFDB] text-[#3D6A66] text-sm animate-pulse">
              {npcName} is thinking…
            </div>
          </div>
        )}
      </div>
      </div>

      <AdaptationExplanation explanation={adaptationExplanation} />

      {voice.supported && voice.error && (
        <div className="rounded-xl border-2 border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-sm text-[#B45309]">
          {voice.error}
        </div>
      )}

      <div className="rounded-2xl bg-white border-2 border-[#B2DFDB] shadow-[2px_2px_0_#D5F5EC] p-3">
        {hintsAvailable && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowHint((value) => !value)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D9488] hover:text-[#0F766E]"
            >
              <Lightbulb className="w-4 h-4" /> {showHint ? "Hide a hint" : "Show a hint"}
            </button>
            {showHint && (
              <p className="mt-2 rounded-xl bg-[#F0FAF7] border border-[#B2DFDB] px-4 py-3 text-sm text-[#134E4A]">
                {scenario?.hint || scenario?.suggestedResponses?.[0]}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {voice.supported && (
            <Button
              variant={voice.listening ? "destructive" : "outline"}
              size="icon"
              onClick={toggleVoice}
              disabled={!isActive || engine.busy}
              aria-label={voice.listening ? "Stop recording" : "Start speaking"}
              className="shrink-0 border-[#B2DFDB]"
            >
              {voice.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
          <Input
            value={voice.listening ? voice.interimTranscript || voice.transcript : draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") sendText();
            }}
            placeholder={isPaused ? "Practice is paused — press Resume to continue" : "Type your reply…"}
            disabled={!isActive || engine.busy || voice.listening}
            className="flex-1 border-[#B2DFDB] focus:border-[#0D9488]"
            aria-label="Your reply"
          />
          <Button size="icon" onClick={sendText} disabled={!isActive || engine.busy || voice.listening} aria-label="Send reply" className="bg-[#0D9488] hover:bg-[#0F766E] text-white shadow-[2px_2px_0_#B2DFDB]">
            <Send className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={engine.retry}
            disabled={!isActive || (session?.turns ?? []).length < 1}
            aria-label="Try your last reply again"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {voice.supported && !isPaused && !voice.listening && (
          <p className="text-[11px] text-[#3D6A66] mt-2 flex items-center gap-1">
            <Mic className="w-3 h-3" /> Tap the mic and speak, or type. You can use both.
          </p>
        )}

        {voice.supported && voice.listening && (
          <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-rose-600">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            <span>
              Listening… {voice.listeningFor}s — speak now
            </span>
            <button type="button" className="underline hover:no-underline" onClick={voice.stop}>
              stop
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <AsdChip tone="cyan">Rehearse, don't perform</AsdChip>
        <AsdChip tone="teal">{isPaused ? "Paused" : "Practice session"}</AsdChip>
      </div>
    </div>
  );
}
