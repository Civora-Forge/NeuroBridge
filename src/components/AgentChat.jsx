import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Loader2, ArrowRight, MessageSquareText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAgentStore from "@/stores/agentStore";

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
    
    if (action.type === "NAVIGATE") {
      // Navigate to the path, passing state if provided
      navigate(action.path, { state: action.data });
      // closeChat(); // Keep it open so they can see the context if they want
    }
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
                <div key={i} className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto' : ''}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                      isUser 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-muted rounded-bl-sm border border-border/50'
                    }`}>
                      {msg.content}
                    </div>
                    
                    {/* Action Card */}
                    {msg.action_payload && msg.action_payload.type === "NAVIGATE" && (
                      <button 
                        onClick={() => handleAction(msg.action_payload)}
                        className="mt-1 w-full max-w-sm neuro-card p-3 border-primary/20 bg-primary/5 hover:bg-primary/10 flex items-center justify-between text-left transition-colors group"
                      >
                        <span className="text-sm font-medium text-primary">Open Suggested Tool</span>
                        <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
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
                  <span className="text-xs text-muted-foreground">Thinking...</span>
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
