import { useEffect, useRef, useState } from "react";
import { Lightbulb, Mic, MicOff, Pause, Play, RotateCcw, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SESSION_STATUS, SPEAKER, RESPONSE_SOURCE } from "../types/communicationTypes";
import { extractSpeechFeatures } from "../services/speechAnalysis";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { AsdCharacter, AsdChip } from "@/components/asd/ui";

function MessageBubble({ turn, largeText, kind = "teal" }) {
  const isUser = turn.speaker === SPEAKER.USER;
  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
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
          <p className={`text-[11px] mt-1 ${isUser ? "text-teal-100" : "text-[#5F8A87]"}`}>
            Spoken reply
          </p>
        )}
      </div>
    </div>
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

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AsdCharacter size={44} ariaHidden tone="cyan" accessory="cloud" />
          <div>
            <h2 className="font-black text-[#134E4A]">{scenario?.title}</h2>
            <p className="text-sm text-[#5F8A87]">
              Turn {Math.min(session?.turnCount ?? 0, session?.turnLimit ?? 1)} of {session?.turnLimit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-[#B2DFDB] text-[#134E4A]" onClick={isPaused ? engine.resume : engine.pause}>
            {isPaused ? <Play className="w-3.5 h-3.5 mr-1.5" /> : <Pause className="w-3.5 h-3.5 mr-1.5" />}
            {isPaused ? "Resume" : "Pause"}
          </Button>
          <Button variant="outline" size="sm" className="border-[#B2DFDB] text-[#134E4A]" onClick={engine.endEarly}>
            <Square className="w-3.5 h-3.5 mr-1.5" /> End practice
          </Button>
        </div>
      </div>

      {engine.adaptation.active && (
        <div className="rounded-xl border-2 border-[#B2DFDB] bg-[#F0FAF7] px-4 py-2.5 text-sm text-[#0F766E]">
          <span className="font-black text-[#0D9488]">Support is on — </span>
          {engine.adaptation.signals.slowPace ? "taking it at a relaxed pace. " : ""}
          {engine.adaptation.signals.provideHints ? "Hints are available. " : ""}
          {engine.adaptation.signals.reduceDistractions ? "Distractions are reduced. " : ""}
          You can adjust settings on the setup screen any time.
        </div>
      )}

      <div
        ref={scrollRef}
        className="h-[420px] overflow-y-auto rounded-2xl border-2 border-[#B2DFDB] bg-gradient-to-b from-[#F0FAF7] to-[#E6F7F2] p-4 space-y-3"
      >
        <div className="flex items-end gap-2 justify-start">
          <AsdCharacter size={34} ariaHidden tone="cyan" accessory="spark" className="mb-0.5" />
          <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-white border-2 border-[#B2DFDB] text-[#134E4A] rounded-bl-sm">
            <p className="italic">“{scenario?.openingLine}”</p>
            <p className="text-[11px] text-[#5F8A87] mt-1">{npcName} started the conversation.</p>
          </div>
        </div>

        {(session?.turns ?? []).map((turn) => (
          <MessageBubble key={turn.id} turn={turn} largeText={engine.a11y.largeText} kind="cyan" />
        ))}

        {engine.busy && (
          <div className="flex items-end gap-2 justify-start">
            <AsdCharacter size={34} ariaHidden tone="cyan" accessory="spark" className="mb-0.5" />
            <div className="rounded-2xl px-4 py-2.5 bg-white border-2 border-[#B2DFDB] text-[#5F8A87] text-sm animate-pulse">
              {npcName} is thinking…
            </div>
          </div>
        )}
      </div>

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
          <p className="text-[11px] text-[#5F8A87] mt-2 flex items-center gap-1">
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