/**
 * AsdFeedback.jsx — shared, encouraging feedback panel for the ASD surface.
 *
 * Three kinds:
 *   - success → warm "that's it!" moment with a soft check pop
 *   - gentle  → kind redirect ("not quite yet") without criticism
 *   - neutral → informational note
 *
 * Always `aria-live="polite"`, respects reduced motion, and uses icons + text
 * (never colour-only). Feedback text is always supplied as children so nothing
 * depends on emojis to be understood.
 */

import { CheckCircle2, HeartHandshake, Info, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

const KINDS = Object.freeze({
  success: {
    icon: CheckCircle2,
    box: "border-[#34D399] bg-gradient-to-r from-[#F0FDF4] to-[#ECFDF5]",
    text: "text-[#047857]",
    label: "Well done",
  },
  gentle: {
    icon: HeartHandshake,
    box: "border-[#FBBF24] bg-gradient-to-r from-[#FFFBEB] to-[#FEF3C7]",
    text: "text-[#B45309]",
    label: "Keep going",
  },
  neutral: {
    icon: Info,
    box: "border-[#A5B4FC] bg-gradient-to-r from-[#EEF2FF] to-[#E0E7FF]",
    text: "text-[#3730A3]",
    label: "Note",
  },
});

export function AsdFeedback({ kind = "neutral", title, children, action, className = "", tone }) {
  const config = KINDS[kind] ?? KINDS.neutral;
  const Icon = config.icon;
  const { reduced, gentle } = useSensoryReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        role="status"
        aria-live="polite"
        initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: gentle ? 0.25 : reduced ? 0 : 0.3, ease: "easeOut" }}
        className={`rounded-2xl border-2 p-4 space-y-3 ${config.box} ${className}`}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-sm ${config.text}`}>
            <Icon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`font-black ${config.text}`}>{title ?? config.label}</p>
            {children && <div className={`text-sm leading-relaxed ${config.text}/90 mt-1`}>{children}</div>}
          </div>
        </div>
        {action && <div className="pl-12">{action}</div>}
      </motion.div>
    </AnimatePresence>
  );
}

export function AsdCelebration({ label = "Nice work!", sub = "One small step done.", compact = false }) {
  const { reduced, gentle } = useSensoryReducedMotion();
  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "flex-col sm:flex-row sm:items-center"}`}>
      <motion.span
        aria-hidden="true"
        initial={reduced ? false : { scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0D9488] text-white shadow-[2px_2px_0_#B2DFDB]"
      >
        <Sparkles size={20} />
      </motion.span>
      <div>
        <p className="font-black text-[#134E4A]">{label}</p>
        <p className="text-sm text-[#5F8A87]">{sub}</p>
      </div>
    </div>
  );
}