/**
 * InterventionView.jsx — Standardized intervention wrapper for ASD + Anxiety.
 *
 * Provides a predictable structure for all intervention screens:
 *   1. Small visual / illustration
 *   2. One short instruction
 *   3. Optional supporting explanation
 *   4. Primary action
 *   5. Skip / stop option
 *
 * Keeps cognitive load low during acute anxiety by enforcing
 * one-concept-per-screen layout.
 */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import CompanionSticker from "./CompanionSticker";

export default function InterventionView({
  sticker = "calm-cloud",
  stickerMood = "calm",
  title,
  instruction,
  explanation,
  children,
  primaryAction,
  primaryLabel = "Continue",
  onSkip,
  skipLabel = "Skip",
  className = "",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`rounded-2xl border border-[#C7D2FE] bg-white shadow-[4px_4px_0_#DDE8FC] p-6 sm:p-8 space-y-5 ${className}`}
    >
      {/* 1. Small visual */}
      <div className="flex justify-center">
        <CompanionSticker variant={sticker} mood={stickerMood} size={56} />
      </div>

      {/* 2. Short instruction */}
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-bold tracking-tight text-[#1E2A5E] sm:text-2xl">
          {title}
        </h2>
        {instruction && (
          <p className="text-sm text-[#6B7BA8] leading-relaxed max-w-md mx-auto">
            {instruction}
          </p>
        )}
      </div>

      {/* 3. Optional explanation */}
      {explanation && (
        <div className="mx-auto max-w-md rounded-xl bg-[#F0F4FF] border border-[#C7D2FE] px-4 py-3 text-xs text-[#6B7BA8] leading-relaxed">
          {explanation}
        </div>
      )}

      {/* Activity content */}
      {children && <div>{children}</div>}

      {/* 4. Primary action + 5. Skip */}
      <div className="flex flex-col items-center gap-2 pt-1">
        {primaryAction && (
          <Button
            onClick={primaryAction}
            className="w-full max-w-xs h-11 rounded-xl bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE] font-bold text-sm"
          >
            {primaryLabel}
          </Button>
        )}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-[#6B7BA8] hover:text-[#4F6BF6] underline underline-offset-4 transition-colors"
          >
            {skipLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
}
