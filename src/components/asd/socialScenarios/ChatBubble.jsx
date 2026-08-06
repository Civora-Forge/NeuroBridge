import { cn } from "@/lib/utils";

export default function ChatBubble({ message, largeText = false }) {
  const isNpc = message.role === "npc";
  return (
    <div className={cn("flex", isNpc ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          largeText && "text-base",
          isNpc
            ? "bg-white border border-emerald-100 text-slate-800 rounded-bl-sm"
            : "bg-emerald-600 text-white rounded-br-sm",
        )}
      >
        {message.text}
      </div>
    </div>
  );
}
