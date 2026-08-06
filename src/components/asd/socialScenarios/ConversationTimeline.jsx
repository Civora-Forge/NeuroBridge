import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChatBubble from "./ChatBubble";

export default function ConversationTimeline({ messages = [], isTyping = false, largeText = false }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isTyping]);

  return (
    <ScrollArea className="h-[420px] w-full rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} largeText={largeText} />
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white border border-emerald-100 px-4 py-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:240ms]" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
