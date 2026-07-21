'use client';

import React, { useState } from "react";
import { Share2, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SocialBroadcaster() {
  const [status, setStatus] = useState("Yellow");
  const [copied, setCopied] = useState(false);

  const codes = {
    Red: {
      label: "Red â€¢ No social energy",
      message:
        "Status: RED\n\nIâ€™m in low-power mode and donâ€™t have energy to talk or respond right now. Itâ€™s not about you. Iâ€™ll reply when Iâ€™m able.",
      explain: "Severe low energy. Youâ€™re allowed to fully power down without explanations.",
      suggestion: "Set an auto-response, silence notifications, choose one person you might update later."
    },
    Yellow: {
      label: "Yellow â€¢ Limited energy",
      message:
        "Status: YELLOW\n\nMy replies might be slow and short today. I still care, my brain is just buffering. No need to worry or fix anything.",
      explain: "Medium energy. You can talk a little, but need people to lower expectations.",
      suggestion: "Reply with short check-ins, avoid big emotional conversations, schedule longer chats for another day."
    },
    Green: {
      label: "Green â€¢ Available",
      message:
        "Status: GREEN\n\nIâ€™m okay to chat and respond today. Feel free to message or call. If I get tired, Iâ€™ll let you know.",
      explain: "Relatively steady energy. You can engage more, with permission to still set limits.",
      suggestion: "Use this time for light connection, planning, or asking for support youâ€™ve been postponing."
    }
  };

  const palette = {
    Red: {
      bg: "from-rose-500/90 to-red-500/90",
      chip: "bg-rose-100 text-rose-800 border border-rose-200"
    },
    Yellow: {
      bg: "from-amber-400/90 to-orange-400/90",
      chip: "bg-amber-100 text-amber-800 border border-amber-200"
    },
    Green: {
      bg: "from-[hsl(142_72%_36%)]/90 to-[hsl(142_66%_42%)]/90",
      chip: "bg-emerald-100 text-emerald-800 border border-emerald-200"
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codes[status].message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shortBubble = {
    Red: "Low power: resting. Responses may be very slow.",
    Yellow: "Slow replies, brain buffering. Please donâ€™t take it personally.",
    Green: "Available to chat, with breaks if I get tired."
  };

  return (
    <div className="max-w-xl mx-auto p-6 md:p-8 space-y-6 bg-white/80 rounded-3xl shadow-2xl border border-[hsl(142_72%_36%)]/15 backdrop-blur-sm">
      {/* Header */}
      <motion.div
        className="space-y-2 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white px-4 py-2 rounded-2xl text-xs font-semibold shadow-lg">
          Social Broadcaster
        </div>
        <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          Share your energy status
        </h1>
        <p className="text-xs md:text-sm text-gray-600 max-w-md mx-auto">
          Pick a mode and copy a guiltâ€‘free message you can paste to friends, family, or work chats.
        </p>
      </motion.div>

      {/* Mode chips */}
      <div className="grid grid-cols-3 gap-2">
        {["Red", "Yellow", "Green"].map((m) => (
          <button
            key={m}
            className={`chip text-xs md:text-sm px-3 py-2 rounded-2xl font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
              status === m
                ? `chipActive bg-gradient-to-r ${palette[m].bg} text-white shadow-lg border-none`
                : `${palette[m].chip} hover:shadow-md`
            }`}
            onClick={() => setStatus(m)}
          >
            <span>{m === "Red" ? "ðŸ”´" : m === "Yellow" ? "ðŸŸ¡" : "ðŸŸ¢"}</span>
            <span>{m}</span>
          </button>
        ))}
      </div>

      {/* Status card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="logCard rounded-3xl bg-white/95 border border-[hsl(142_72%_36%)]/10 shadow-xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{status === "Red" ? "ðŸ”´" : status === "Yellow" ? "ðŸŸ¡" : "ðŸŸ¢"}</span>
            <span>{codes[status].label}</span>
          </div>

          <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-2xl p-3">
            {shortBubble[status]}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Info className="w-3 h-3" />
            <span>{codes[status].explain}</span>
          </div>

          <div className="text-[11px] text-gray-600 bg-[hsl(142_72%_36%)]/5 border border-[hsl(142_72%_36%)]/20 rounded-2xl p-3">
            <span className="font-semibold text-[hsl(142_72%_36%)] mr-1">Suggestion:</span>
            {codes[status].suggestion}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Preview of copied text */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-[11px] text-gray-700 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
        {codes[status].message}
      </div>

      {/* Copy button */}
      <motion.button
        className="secondaryButton w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[hsl(142_72%_36%)]/5 to-[hsl(142_66%_42%)]/5 border border-[hsl(142_72%_36%)]/40 rounded-2xl py-3 text-xs md:text-sm font-semibold text-[hsl(142_72%_36%)] hover:bg-white hover:shadow-xl"
        onClick={handleCopy}
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.97 }}
      >
        <Share2 size={16} />
        {copied ? "Copied!" : "Copy status message"}
      </motion.button>

      <p className="text-[11px] text-gray-500 text-center">
        You are allowed to send these without overâ€‘explaining or apologizing.
      </p>
    </div>
  );
}
