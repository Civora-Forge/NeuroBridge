import { useState, useRef, useEffect, useId } from "react";
import {
  X, Send, Bot, User, Loader2, ArrowRight, MessageSquareText, CheckCircle2, Clock, Activity,
  Mic, MicOff, Volume2, VolumeX, AlertCircle, RotateCcw,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import useAgentStore from "@/stores/agentStore";
import useAgentVoice from "@/hooks/useAgentVoice";
import { useAuth } from "@/context/AuthContext";
import AgentCursor from "@/components/AgentCursor";
import { findNavTarget } from "@/lib/findNavTarget";
import { isAffirmativeConfirmation, isNegativeConfirmation } from "@/lib/confirmationPhrases";
import useFocusSessionControlStore from "@/stores/focusSessionControlStore";
import { applyPresetGlobally } from "@/lib/presentationPreferences";

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
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const {
    isOpen, closeChat, toggleChat, messages, isLoading, sendMessage, error, clearError,
    pendingConfirmation, confirmPendingAction, cancelPendingAction, abortActiveStream,
  } = useAgentStore();
  const [input, setInput] = useState("");
  const [lastUserMessage, setLastUserMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const wasListeningRef = useRef(false);
  const avatarRef = useRef(null);
  const [cursorAnim, setCursorAnim] = useState(null); // { from, to, action } | null
  const announcedActionIdsRef = useRef(new Set());
  const panelRef = useRef(null);
  const openButtonRef = useRef(null);
  const inputRef = useRef(null);
  const wasOpenRef = useRef(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const dialogTitleId = useId();
  const statusId = useId();

  const voice = useAgentVoice();
  // Any authenticated "user"-role account can use the agent — a real Supabase
  // session or one of the Demo Access mock logins. Demo mode gets real backend
  // access too (see agentStore.js), just under an isolated demo identity.
  const canUseAgent = isAuthenticated && !!user;
  const isDemoAccount = canUseAgent && !user?._supabase;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isOpen]);

  // Unmounting (or navigating away) must not leave a stream running in the
  // background against a component that no longer exists.
  useEffect(() => () => abortActiveStream(), [abortActiveStream]);

  // Focus management for the chat panel: the widget is a modal-like floating
  // panel (role="dialog") rather than a Radix Dialog, so it needs its own
  // focus-in-on-open / focus-return-on-close / Escape-to-close / Tab-trap —
  // without these, keyboard and screen-reader users can't reliably reach or
  // leave it (WCAG 2.4.3, 2.1.2).
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Opening: move focus into the panel (the input, if usable; otherwise
      // the close button) instead of leaving it stranded on the now-hidden
      // toggle button.
      const target = canUseAgent ? inputRef.current : panelRef.current?.querySelector("button");
      target?.focus();
    } else if (!isOpen && wasOpenRef.current) {
      // Closing: return focus to the control that opened it, so keyboard
      // users don't lose their place in the page.
      openButtonRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, canUseAgent]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeChat();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, closeChat]);

  // A single, stable screen-reader-only status region for the agent's
  // finalized replies and confirmation prompts. The visible message bubbles
  // toggle aria-live on/off per-bubble as they stream (see below), which is
  // too fragile to rely on alone — this mirrors just the *final* text once,
  // per message, so screen reader users reliably hear each new answer without
  // the interim streaming noise (WCAG 4.1.3 Status Messages).
  const announcedFinalIndexRef = useRef(-1);
  useEffect(() => {
    if (messages.length === 0) return;
    const lastIndex = messages.length - 1;
    const last = messages[lastIndex];
    if (last.role === "model" && !last.streaming && last.content && lastIndex !== announcedFinalIndexRef.current) {
      announcedFinalIndexRef.current = lastIndex;
      setLiveAnnouncement(last.content);
    }
  }, [messages]);

  useEffect(() => {
    if (pendingConfirmation) {
      setLiveAnnouncement("Confirmation required before continuing.");
    }
  }, [pendingConfirmation]);

  useEffect(() => {
    if (error) setLiveAnnouncement(error);
  }, [error]);

  // Auto-send once the browser finishes recognizing a spoken utterance.
  useEffect(() => {
    if (wasListeningRef.current && !voice.isListening && voice.transcript.trim()) {
      submit(voice.transcript.trim());
    }
    wasListeningRef.current = voice.isListening;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.isListening]);

  // Optionally speak new assistant replies. Must wait for the message to be
  // finalized (streaming: false) — the placeholder is added with empty content
  // the instant a request starts, at the same array index the real answer will
  // later fill in; speaking (and marking-as-spoken) too early would permanently
  // skip the actual response once it arrives at that same index.
  const lastSpokenIndexRef = useRef(-1);
  useEffect(() => {
    if (!voice.voiceResponsesEnabled || messages.length === 0) return;
    const lastIndex = messages.length - 1;
    const last = messages[lastIndex];
    if (last.role === "model" && !last.streaming && last.content && lastIndex !== lastSpokenIndexRef.current) {
      lastSpokenIndexRef.current = lastIndex;
      voice.speak(last.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voice.voiceResponsesEnabled]);

  // The agent "operating the app for you": once a finalized message carries a
  // real navigation action (never for PENDING_CONFIRMATION — writes still wait
  // for an explicit confirm), a cursor glides to the actual on-screen control
  // and clicks it, then the app navigates. Falls back to navigating directly,
  // with no animation, if that real control isn't visible on the current page.
  //
  // FOCUS_SESSION_CONTROL actions are different in kind: there is nothing to
  // "navigate to" if the user is already on the Focus Session page — the
  // command (pause/resume/stop/set_duration) is dispatched directly to the
  // one real, already-mounted timer via focusSessionControlStore, which
  // calls that page's own real handlers (same as a manual click). Only when
  // NOT already there does it navigate first, carrying the command along.
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    const action = last.action_payload;
    const isNavigate = action?.type?.startsWith("NAVIGATE");
    const isFocusControl = action?.type === "FOCUS_SESSION_CONTROL";
    const isPresentationPreset = action?.type === "PRESENTATION_PRESET";
    if (
      last.role !== "model" || last.streaming || !action ||
      (!isNavigate && !isFocusControl && !isPresentationPreset) ||
      !last.id || announcedActionIdsRef.current.has(last.id)
    ) {
      return;
    }
    announcedActionIdsRef.current.add(last.id);

    if (isPresentationPreset) {
      // No page/target involved — applies instantly wherever the user already is.
      applyPresetGlobally(action.preset_id);
      return;
    }

    if (isFocusControl && location.pathname === action.path) {
      useFocusSessionControlStore.getState().dispatch({ command: action.command, session: action.session });
      return;
    }

    const targetEl = findNavTarget(action.path);
    if (!targetEl || !avatarRef.current) {
      if (isFocusControl) {
        navigate(action.path, { state: { focusSessionCommand: { command: action.command, session: action.session } } });
      } else {
        handleAction(action);
      }
      return;
    }
    const fromRect = avatarRef.current.getBoundingClientRect();
    const toRect = targetEl.getBoundingClientRect();
    setCursorAnim({
      from: { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 },
      to: { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 },
      action,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, location.pathname]);

  const submit = (text) => {
    if (!text.trim() || isLoading || !canUseAgent) return;

    // Hands-free confirmation: while a write is awaiting confirmation, a clear
    // "yes"/"no" (typed or spoken) drives the existing confirm/cancel actions
    // directly instead of being sent as a brand-new agent message. Anything
    // not an exact match falls through to the normal pipeline unchanged —
    // never silently treated as confirmation.
    if (pendingConfirmation) {
      if (isAffirmativeConfirmation(text)) {
        confirmPendingAction(user);
        setInput("");
        return;
      }
      if (isNegativeConfirmation(text)) {
        cancelPendingAction();
        setInput("");
        return;
      }
    }

    setLastUserMessage(text);
    sendMessage(text, user);
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
          onConfirm={() => confirmPendingAction(user)}
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
      {cursorAnim && (
        <AgentCursor
          from={cursorAnim.from}
          to={cursorAnim.to}
          onArrive={() => {
            if (cursorAnim.action.type === "FOCUS_SESSION_CONTROL") {
              navigate(cursorAnim.action.path, {
                state: { focusSessionCommand: { command: cursorAnim.action.command, session: cursorAnim.action.session } },
              });
            } else {
              handleAction(cursorAnim.action);
            }
            setCursorAnim(null);
          }}
        />
      )}
      {/* Mirrors the agent's finalized replies, confirmation prompts, and
          errors into a stable, always-present live region — independent of
          whether the chat panel is even open — so screen reader users get an
          announcement without needing the panel's visible DOM to stay put. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {!isOpen && (
        <button
          ref={openButtonRef}
          onClick={toggleChat}
          className="fixed top-20 right-6 md:top-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all z-50 hover:scale-105 active:scale-95"
          aria-label="Open AI Assistant"
        >
          <MessageSquareText className="w-6 h-6" aria-hidden="true" />
        </button>
      )}

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          className="fixed top-20 right-6 md:top-6 w-[380px] h-[600px] max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-top-5"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <div ref={avatarRef} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" aria-hidden="true" />
              </div>
              <div>
                <h3 id={dialogTitleId} className="font-semibold text-sm">NeuroBridge Assistant</h3>
                <p id={statusId} role="status" aria-live="polite" className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {voice.isListening ? (
                    <>
                      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                      </span>
                      Listening
                    </>
                  ) : isLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                      Thinking
                    </>
                  ) : voice.isSpeaking ? (
                    <>
                      <Volume2 className="w-3 h-3" aria-hidden="true" />
                      Speaking
                    </>
                  ) : (
                    "Ready — ask or say what's going on"
                  )}
                </p>
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

          {/* tabIndex + aria-label make this independently-scrolling region
              reachable and operable via keyboard (arrow/Page keys once
              focused) without making it an implicit live region — the
              dedicated sr-only status region above already owns
              announcements, and role="log" here would double them up. */}
          <div
            className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-background/50"
            tabIndex={0}
            aria-label="Conversation with the assistant"
          >
            {!canUseAgent && (
              <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Sign in (or use a Demo Access account) to use the assistant.</span>
              </div>
            )}

            {isDemoAccount && (
              <div className="flex items-start gap-2 text-xs bg-sky-50 border border-sky-200 text-sky-800 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>You're in demo mode — the assistant fully works, but demo data is separate from a real account and may be reset. Messages are also rate-limited in demo mode.</span>
              </div>
            )}

            {messages.length === 0 && canUseAgent && (
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
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                          isUser
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted rounded-bl-sm border border-border/50'
                        }`}
                        aria-live={msg.streaming ? "polite" : undefined}
                      >
                        {msg.streaming ? (
                          msg.steps && msg.steps.length > 0 ? (
                            <div className="flex flex-col gap-1 min-w-[160px]">
                              {msg.steps.map((step) => (
                                <span
                                  key={step.id}
                                  className={`flex items-center gap-1.5 text-xs ${
                                    step.status === 'active' ? 'text-foreground font-medium' : 'text-muted-foreground'
                                  }`}
                                >
                                  {step.status === 'done' && <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
                                  {step.status === 'failed' && <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />}
                                  {step.status === 'active' && <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />}
                                  <span className="truncate">{step.label}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                              {msg.statusLabel || "Working on it..."}
                            </span>
                          )
                        ) : (
                          msg.content
                        )}
                      </div>
                      {!isUser && !msg.streaming && voice.ttsSupported && msg.content && (
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
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="flex-1 text-sm text-muted-foreground truncate" role="status" aria-live="polite">
                  {voice.transcript || voice.interimTranscript || "Listening..."}
                </span>
                <button
                  type="button"
                  onClick={voice.cancelListening}
                  className="p-2 rounded-full text-muted-foreground hover:bg-background transition-colors"
                  aria-label="Cancel listening"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={voice.stopListening}
                  className="p-2 bg-primary text-primary-foreground rounded-full"
                  aria-label="Stop listening and send"
                >
                  <MicOff className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={canUseAgent ? "How can I help you right now?" : "Sign in to chat with the assistant"}
                    aria-label="Message to the assistant"
                    className="w-full bg-muted border border-border/50 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
                    disabled={isLoading || !canUseAgent}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading || !canUseAgent}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground transition-colors"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                {voice.voiceSupported ? (
                  <button
                    type="button"
                    onClick={handleMicClick}
                    disabled={isLoading || !canUseAgent}
                    className="p-3 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50 flex-shrink-0"
                    aria-label="Speak your message"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                ) : (
                  // Voice input relies on the browser's built-in speech recognition
                  // (Chrome/Edge/Safari only — Firefox and Firefox-based browsers like
                  // Zen have no support at all). Show why instead of silently hiding it.
                  <button
                    type="button"
                    disabled
                    title="Voice input isn't supported in this browser. Try Chrome, Edge, or Safari."
                    aria-label="Voice input isn't supported in this browser. Try Chrome, Edge, or Safari."
                    className="p-3 rounded-full bg-muted text-muted-foreground/40 flex-shrink-0 cursor-not-allowed"
                  >
                    <MicOff className="w-4 h-4" />
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
