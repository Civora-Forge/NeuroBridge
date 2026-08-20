import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Loader2, ArrowRight, MessageSquareText, CheckCircle2, Clock, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAgentStore from "@/stores/agentStore";

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


export default function AgentChat() {
  const navigate = useNavigate();
  const { isOpen, closeChat, toggleChat, messages, isLoading, sendMessage } = useAgentStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  const handleAction = (action) => {
    if (!action) return;
    
    if (action.type === "NAVIGATE" || action.type === "NAVIGATE_WITH_DATA") {
      navigate(action.path, { state: action.data });
    }
  };

  const renderActionCard = (action) => {
    if (!action || !action.type.startsWith("NAVIGATE")) return null;
    
    if (action.card_type === "TASK_BREAKDOWN") {
      return <TaskBreakdownCard data={action.data} onNavigate={() => handleAction(action)} />;
    }
    if (action.card_type === "FOCUS_SESSION") {
      return <FocusSessionCard data={action.data} onNavigate={() => handleAction(action)} />;
    }
    if (action.card_type === "GROUNDING_SESSION") {
      return <GroundingSessionCard data={action.data} onNavigate={() => handleAction(action)} />;
    }
    
    // Generic fallback
    return (
      <button 
        onClick={() => handleAction(action)}
        className="mt-1 w-full max-w-sm neuro-card p-3 border-primary/20 bg-primary/5 hover:bg-primary/10 flex items-center justify-between text-left transition-colors group"
      >
        <span className="text-sm font-medium text-primary">Open Suggested Tool</span>
        <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
      </button>
    );
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all z-50 hover:scale-105 active:scale-95"
          aria-label="Open AI Assistant"
        >
          <MessageSquareText className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[600px] max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
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
            <button
              onClick={closeChat}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-background/50">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm my-auto opacity-70">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Hi! I'm your NeuroBridge assistant.</p>
                <p className="mt-1">I can help you break down tasks, prepare for ERP sessions, or find the right support tools.</p>
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
                    <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                      isUser 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-muted rounded-bl-sm border border-border/50'
                    }`}>
                      {msg.content}
                    </div>
                    
                    {/* Rich Action Card */}
                    {renderActionCard(msg.action_payload)}
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
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-card">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="How can I help you right now?"
                className="w-full bg-muted border border-border/50 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-1.5 p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
