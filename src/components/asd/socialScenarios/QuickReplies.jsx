import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function QuickReplies({ replies = [], onSelect, disabled = false, largeText = false }) {
  if (!replies || replies.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className={cn("text-xs font-semibold uppercase tracking-wide text-slate-400", largeText && "text-sm")}>
        Suggested replies — tap one or type your own
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {replies.map((reply, index) => (
          <motion.button
            key={reply}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            onClick={() => onSelect(reply)}
            disabled={disabled}
            className={cn(
              "group flex items-center gap-3 rounded-2xl border-2 border-green-200 bg-white px-4 py-3 text-left",
              "transition-colors hover:border-green-400 hover:bg-green-50",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0 group-hover:bg-green-600 group-hover:text-white transition-colors">
              <MessageSquare className="h-3.5 w-3.5" />
            </span>
            <span className={cn("font-medium text-slate-700", largeText ? "text-base" : "text-sm")}>{reply}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
