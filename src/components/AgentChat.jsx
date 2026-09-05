import { useState, useRef, useEffect } from "react";
import {
  X, Send, Bot, User, Loader2, ArrowRight, MessageSquareText, CheckCircle2, Clock, Activity,
  Mic, MicOff, Volume2, VolumeX, AlertCircle, RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAgentStore from "@/stores/agentStore";
import useAgentVoice from "@/hooks/useAgentVoice";
import { useAuth } from "@/context/AuthContext";

function TaskBreakdownCard({ data, onNavigate }) {
  if (!data || !data.steps) return null;
  return (
    <div className="mt-2 w-full max-w-sm neuro-card p-4 border-primary/20 bg-primary/5 text-left transition-colors">
      <div className="flex items-center gap-2 mb-2 text-primary font-semibold text-sm">
        <CheckCircle2 className="w-4 h-4" />
        <span>Task Breakdown Created</span>
      </div>
      <p className="text-xs font-medium text-slate-700 mb-3">"{data.original_task}"</p>
      <div className="space-y-2 mb-4">
        {data.steps.slice(0, 3).map((step, idx) => (
          <div key={idx} className="flex items-start gap-2 text-xs bg-white p-2 rounded-md border border-slate-100">
            <div className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0 mt-0.5" />
            <span className="text-slate-600">{step.description} <span className="text-slate-400">({step.estimated_minutes}m)</span></span>
          </div>
        ))}
        {data.steps.length > 3 && (
          <div className="text-xs text-slate-500 italic pl-1">+ {data.steps.length - 3} more steps</div>
        )}
      </div>
      <button
        onClick={onNavigate}
        className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
      >
        Open in Workspace <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function FocusSessionCard({ data, onNavigate }) {
  if (!data) return null;
  return (
    <div className="mt-2 w-full max-w-sm neuro-card p-4 border-blue-500/20 bg-blue-500/5 text-left transition-colors">
      <div className="flex items-center gap-2 mb-2 text-blue-600 font-semibold text-sm">
        <Clock className="w-4 h-4" />
        <span>Focus Session Planned</span>
      </div>
      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100 mb-4">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 uppercase font-semibold">Intent</span>
          <span className="text-sm font-medium text-slate-800">{data.intent || "Deep Work"}</span>
        </div>
        <div className="text-2xl font-bold text-blue-600">{data.duration_minutes}m</div>
      </div>
      <button
        onClick={onNavigate}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
      >
        Start Session <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function GroundingSessionCard({ data, onNavigate }) {
  if (!data) return null;
  return (
    <div className="mt-2 w-full max-w-sm neuro-card p-4 border-emerald-500/20 bg-emerald-500/5 text-left transition-colors">
      <div className="flex items-center gap-2 mb-2 text-emerald-600 font-semibold text-sm">
        <Activity className="w-4 h-4" />
        <span>Grounding Exercise Selected</span>
      </div>
      <p className="text-sm font-medium text-slate-700 mb-4">{data.exercise_type}</p>
      <button
        onClick={onNavigate}
        className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
      >
        Begin Exercise <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function ExposureCreatedCard({ data, onNavigate }) {
  if (!data) return null;
  return (
    <div className="mt-2 w-full max-w-sm neuro-card p-4 border-violet-500/20 bg-violet-500/5 text-left transition-colors">
      <div className="flex items-center gap-2 mb-2 text-violet-600 font-semibold text-sm">
        <CheckCircle2 className="w-4 h-4" />
        <span>Exposure Added</span>
      </div>
      <p className="text-sm font-medium text-slate-700 mb-1">{data.description}</p>
      <p className="text-xs text-slate-500 mb-4">Added to "{data.hierarchy_title}" &middot; SUDS ~{data.estimated_suds}</p>
      <button
        onClick={onNavigate}
        className="w-full bg-violet-600 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors"
      >
        View Hierarchy <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function ErpSessionCard({ data, onNavigate, complete }) {
  if (!data) return null;
  return (
    <div className="mt-2 w-full max-w-sm neuro-card p-4 border-amber-500/20 bg-amber-500/5 text-left transition-colors">
      <div className="flex items-center gap-2 mb-2 text-amber-600 font-semibold text-sm">
        <Activity className="w-4 h-4" />
        <span>{complete ? "ERP Session Complete" : "ERP Session Started"}</span>
      </div>
      <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-slate-100 mb-3 text-sm">
        <div><span className="text-slate-500">Pre-SUDS </span><span className="font-semibold">{data.pre_suds}</span></div>
        {complete && <div><span className="text-slate-500">Post-SUDS </span><span className="font-semibold">{data.post_suds}</span></div>}
      </div>
      {complete && data.ai_summary && <p className="text-xs text-slate-600 italic mb-3">{data.ai_summary}</p>}
      <button
        onClick={onNavigate}
        className="w-full bg-amber-600 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors"
      >
        {complete ? "View Progress" : "Continue Session"} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function PendingConfirmationCard({ toolName, toolArgs, onConfirm, onCancel, isLoading }) {
  const readable = toolName?.replace(/_/g, " ") ?? "this action";
  return (
    <div className="mt-2 w-full max-w-sm neuro-card p-4 border-orange-400/30 bg-orange-400/5 text-left">
      <div className="flex items-center gap-2 mb-2 text-orange-600 font-semibold text-sm">
        <AlertCircle className="w-4 h-4" />
        <span>Confirm action</span>
      </div>
      <p className="text-xs text-slate-600 mb-3">
        I'd like to <strong>{readable}</strong>
        {toolArgs?.description ? `: "${toolArgs.description}"` : ""}. This will be saved to your account.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 bg-white border border-slate-200 text-slate-600 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-orange-700 disabled:opacity-50"
        >
          {isLoading ? "Working..." : "Confirm"}
        </button>
      </div>
    </div>
  );
}

export default function AgentChat() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const {
    isOpen, closeChat, toggleChat, messages, isLoading, sendMessage, error, clearError,
    pendingConfirmation, confirmPendingAction, cancelPendingAction,
  } = useAgentStore();
  const [input, setInput] = useState("");
  const [lastUserMessage, setLastUserMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const wasListeningRef = useRef(false);

  const voice = useAgentVoice();
  const isRealAccount = isAuthenticated && user?._supabase;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isOpen]);

  // Auto-send once the browser finishes recognizing a spoken utterance.
  useEffect(() => {
    if (wasListeningRef.current && !voice.isListening && voice.transcript.trim()) {
      submit(voice.transcript.trim());
    }
    wasListeningRef.current = voice.isListening;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.isListening]);

  // Optionally speak new assistant replies.
  const lastSpokenIndexRef = useRef(-1);
  useEffect(() => {
    if (!voice.voiceResponsesEnabled || messages.length === 0) return;
    const lastIndex = messages.length - 1;
    const last = messages[lastIndex];
    if (last.role === "model" && lastIndex !== lastSpokenIndexRef.current) {
      lastSpokenIndexRef.current = lastIndex;
      voice.speak(last.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voice.voiceResponsesEnabled]);

  const submit = (text) => {
    if (!text.trim() || isLoading || !isRealAccount) return;
    setLastUserMessage(text);
    sendMessage(text, user?.id);
    setInput("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit(input);
  };

  const handleMicClick = () => {
    if (voice.isListening) {
      voice.stopListening();
    } else {
      voice.startListening();
    }
  };

  const handleAction = (action) => {
    if (!action) return;
    if (action.type === "NAVIGATE" || action.type === "NAVIGATE_WITH_DATA") {
      navigate(action.path, { state: action.data });
    }
  };

  const renderActionCard = (action, messageIndex) => {
    if (!action) return null;

    if (action.type === "PENDING_CONFIRMATION") {
      if (!pendingConfirmation || pendingConfirmation.messageIndex !== messageIndex) return null;
      return (
        <PendingConfirmationCard
          toolName={action.tool_name}
          toolArgs={action.tool_args}
          onConfirm={confirmPendingAction}
          onCancel={cancelPendingAction}
          isLoading={isLoading}
        />
      );
    }

    if (!action.type?.startsWith("NAVIGATE")) return null;

    switch (action.card_type) {
      case "TASK_BREAKDOWN":
        return <TaskBreakdownCard data={action.data} onNavigate={() => handleAction(action)} />;
      case "FOCUS_SESSION":
        return <FocusSessionCard data={action.data} onNavigate={() => handleAction(action)} />;
      case "GROUNDING_SESSION":
        return <GroundingSessionCard data={action.data} onNavigate={() => handleAction(action)} />;
      case "EXPOSURE_CREATED":
        return <ExposureCreatedCard data={action.data} onNavigate={() => handleAction(action)} />;
      case "ERP_SESSION_STARTED":
        return <ErpSessionCard data={action.data} onNavigate={() => handleAction(action)} complete={false} />;
      case "ERP_SESSION_COMPLETE":
        return <ErpSessionCard data={action.data} onNavigate={() => handleAction(action)} complete />;
      default:
        return (
          <button
            onClick={() => handleAction(action)}
            className="mt-1 w-full max-w-sm neuro-card p-3 border-primary/20 bg-primary/5 hover:bg-primary/10 flex items-center justify-between text-left transition-colors group"
          >
            <span className="text-sm font-medium text-primary">Open Suggested Tool</span>
            <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
          </button>
        );
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all z-50 hover:scale-105 active:scale-95"
          aria-label="Open AI Assistant"
        >
          <MessageSquareText className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[600px] max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">NeuroBridge Assistant</h3>
                <p className="text-xs text-muted-foreground">Always here to help</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {voice.ttsSupported && (
                <>
                  {voice.isSpeaking && (
                    <button
                      onClick={voice.stopSpeaking}
                      className="text-primary hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
                      aria-label="Stop speaking"
                      title="Stop speaking"
                    >
                      <VolumeX className="w-4 h-4 animate-pulse" />
                    </button>
                  )}
                  <button
                    onClick={voice.toggleVoiceResponses}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
                    aria-label={voice.voiceResponsesEnabled ? "Turn off voice replies" : "Turn on voice replies"}
                    title={voice.voiceResponsesEnabled ? "Voice replies on" : "Voice replies off"}
                  >
                    {voice.voiceResponsesEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                </>
              )}
              <button
                onClick={closeChat}
                className="text-muted-foreground hover:text-foreground transition-colors p-1.5"
                aria-label="Close assistant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-background/50">
            {!isRealAccount && (
              <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Sign in with your NeuroBridge account (not a demo role) to use the assistant — it needs a real, secure session to act on your data.</span>
              </div>
            )}

            {messages.length === 0 && isRealAccount && (
              <div className="text-center text-muted-foreground text-sm my-auto opacity-70">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Hi! I'm your NeuroBridge assistant.</p>
                <p className="mt-1">Tell me what's going on — I can break down tasks, check your ERP progress, start a grounding exercise, and more.</p>
              </div>
            )}

            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div key={i} className={`flex gap-3 max-w-[90%] ${isUser ? 'ml-auto' : ''}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} w-full`}>
                    <div className={`flex items-end gap-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted rounded-bl-sm border border-border/50'
                      }`}>
                        {msg.content}
                      </div>
                      {!isUser && voice.ttsSupported && msg.content && (
                        <button
                          onClick={() => voice.speak(msg.content)}
                          className="text-muted-foreground hover:text-primary transition-colors p-1 flex-shrink-0"
                          aria-label="Replay this response aloud"
                          title="Replay aloud"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {renderActionCard(msg.action_payload, i)}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-sm border border-border/50 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking and preparing tools...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{error}</p>
                  {lastUserMessage && (
                    <button
                      onClick={() => { clearError(); submit(lastUserMessage); }}
                      className="mt-1.5 inline-flex items-center gap-1 font-semibold hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" /> Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            {voice.voiceError && (
              <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{voice.voiceError}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-border bg-card">
            {voice.isListening ? (
              <div className="flex items-center gap-3 bg-muted rounded-full pl-4 pr-2 py-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="flex-1 text-sm text-muted-foreground truncate">
                  {voice.transcript || voice.interimTranscript || "Listening..."}
                </span>
                <button
                  type="button"
                  onClick={voice.cancelListening}
                  className="p-2 rounded-full text-muted-foreground hover:bg-background transition-colors"
                  aria-label="Cancel listening"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={voice.stopListening}
                  className="p-2 bg-primary text-primary-foreground rounded-full"
                  aria-label="Stop listening and send"
                >
                  <MicOff className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isRealAccount ? "How can I help you right now?" : "Sign in to chat with the assistant"}
                    className="w-full bg-muted border border-border/50 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
                    disabled={isLoading || !isRealAccount}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading || !isRealAccount}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground transition-colors"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                {voice.voiceSupported && (
                  <button
                    type="button"
                    onClick={handleMicClick}
                    disabled={isLoading || !isRealAccount}
                    className="p-3 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50 flex-shrink-0"
                    aria-label="Speak your message"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
