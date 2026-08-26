/**
 * AdaptiveStateCard.jsx — Primary action card that adapts to the user's current state.
 *
 * Shows one recommended action based on the adaptive engine's assessment.
 * During normal state: encourages exploration.
 * During overload: suggests a single calming action.
 * During high anxiety: presents one simple instruction.
 *
 * Reduces decision-making during anxiety by showing only what's most needed.
 */

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import CompanionSticker from "./CompanionSticker";

const STATE_CONFIGS = {
  normal: {
    sticker: "calm-cloud",
    mood: "calm",
    cardBg: "bg-gradient-to-br from-white via-[#f8fbff] to-[#f0f4ff]",
    border: "border-[#bfdbfe]",
    shadow: "shadow-[5px_5px_0_#dde8fc]",
    accent: "text-[#4F6BF6]",
    buttonBg: "bg-[#4F6BF6] hover:bg-[#3B51D4] shadow-[3px_3px_0_#c7d2fe]",
  },
  prolonged: {
    sticker: "calm-moon",
    mood: "calm",
    cardBg: "bg-gradient-to-br from-white via-[#fef9ec] to-[#fff8e1]",
    border: "border-[#f3d58a]",
    shadow: "shadow-[5px_5px_0_#fef3c7]",
    accent: "text-[#d89500]",
    buttonBg: "bg-[#F59E0B] hover:bg-[#D97706] shadow-[3px_3px_0_#fde68a]",
  },
  overload: {
    sticker: "concern",
    mood: "concern",
    cardBg: "bg-gradient-to-br from-white via-[#fff5f5] to-[#ffe8e8]",
    border: "border-[#fca5a5]",
    shadow: "shadow-[5px_5px_0_#fecaca]",
    accent: "text-[#EF4444]",
    buttonBg: "bg-[#EF4444] hover:bg-[#DC2626] shadow-[3px_3px_0_#fca5a5]",
  },
  highAnxiety: {
    sticker: "breathing",
    mood: "breathing",
    cardBg: "bg-gradient-to-br from-white via-[#f0f7ff] to-[#e8f1ff]",
    border: "border-[#93c5fd]",
    shadow: "shadow-[5px_5px_0_#bfdbfe]",
    accent: "text-[#3B82F6]",
    buttonBg: "bg-[#3B82F6] hover:bg-[#2563EB] shadow-[3px_3px_0_#93c5fd]",
  },
  recovery: {
    sticker: "recovery-sprout",
    mood: "recovery",
    cardBg: "bg-gradient-to-br from-white via-[#f0fdf4] to-[#e8faf0]",
    border: "border-[#86efac]",
    shadow: "shadow-[5px_5px_0_#bbf7d0]",
    accent: "text-[#10B981]",
    buttonBg: "bg-[#10B981] hover:bg-[#059669] shadow-[3px_3px_0_#86efac]",
  },
};

function stateKey(responseTier, isRecovering) {
  if (isRecovering) return "recovery";
  if (responseTier >= 3) return "highAnxiety";
  if (responseTier === 2) return "overload";
  if (responseTier === 1) return "prolonged";
  return "normal";
}

export default function AdaptiveStateCard({
  responseTier = 0,
  isRecovering = false,
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
  secondaryLabel,
  onSecondary,
  className = "",
}) {
  const key = stateKey(responseTier, isRecovering);
  const config = STATE_CONFIGS[key];

  return (
    <motion.div
      key={key}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-[28px] border-2 ${config.border} ${config.cardBg} ${config.shadow} p-6 sm:p-8 space-y-5 ${className}`}
    >
      {/* Decorative sparkle */}
      <Sparkles size={18} className={`absolute right-5 top-5 ${config.accent} opacity-40`} />

      <div className="flex items-start gap-4">
        <CompanionSticker variant={config.sticker} mood={config.mood} size={56} />
        <div className="flex-1 space-y-1">
          <h3 className="text-[20px] font-black tracking-[-0.03em] text-[#1E2A5E]">{title}</h3>
          {description && (
            <p className="text-[14px] font-medium text-[#6B7BA8] leading-relaxed">{description}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        {onAction && (
          <Button
            onClick={onAction}
            className={`flex-1 h-12 rounded-2xl text-white font-black text-[15px] ${config.buttonBg} transition-all hover:-translate-y-0.5`}
          >
            {actionLabel}
          </Button>
        )}
        {onSecondary && (
          <Button
            variant="outline"
            onClick={onSecondary}
            className="flex-1 h-12 rounded-2xl border-2 border-[#e2e8f0] text-[#6B7BA8] hover:text-[#4F6BF6] hover:border-[#4F6BF6] font-bold text-[15px]"
          >
            {secondaryLabel}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export { stateKey, STATE_CONFIGS };
