'use client';

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function VoidWhisper() {
  const [text, setText] = useState("");
  const [burn, setBurn] = useState(false);
  const [released, setReleased] = useState(null);

  const release = () => {
    if (!text.trim()) return;
    setBurn(true);
    setTimeout(() => {
      setReleased(text.trim());
      setText("");
      setBurn(false);
    }, 1200);
  };

  return (
    <div className="grid gap-5 max-w-xl mx-auto text-center p-6 md:p-8 bg-white/80 rounded-3xl shadow-2xl border border-[hsl(142_72%_36%)]/15 backdrop-blur-sm">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white px-4 py-2 rounded-2xl text-xs font-semibold shadow-lg">
          Void Whisper
        </div>
        <h1 className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          Safe thought disposal
        </h1>
        <p className="text-xs md:text-sm text-gray-600 max-w-md mx-auto">
          Dump the heavy thought here, watch it dissolve, then get a gentle closing line instead.
        </p>
      </motion.div>

      {/* Textarea */}
      <motion.textarea
        className="fieldTextarea w-full min-h-[120px] rounded-2xl border-2 border-gray-200 bg-white/90 p-4 text-sm md:text-base focus:border-[hsl(142_72%_36%)] focus:ring-4 focus:ring-[hsl(142_72%_36%)]/15 transition-all"
        value={text}
        onChange={e => {
          setText(e.target.value);
          setReleased(null);
        }}
        placeholder="Write the exact intrusive or heavy thought here. No censoring, no judgment."
        animate={
          burn
            ? { opacity: 0, scale: 0.9, filter: "blur(10px)" }
            : { opacity: 1, scale: 1, filter: "blur(0px)" }
        }
        transition={{ duration: 0.5 }}
      />

      {/* Release button */}
      <motion.button
        className="secondaryButton w-full bg-gradient-to-r from-[hsl(142_72%_36%)]/5 to-[hsl(142_66%_42%)]/5 border border-[hsl(142_72%_36%)]/40 rounded-2xl py-3 text-xs md:text-sm font-semibold text-[hsl(142_72%_36%)] hover:bg-white hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={release}
        disabled={!text.trim() || burn}
        whileHover={text.trim() && !burn ? { y: -2, scale: 1.01 } : {}}
        whileTap={text.trim() && !burn ? { scale: 0.97 } : {}}
      >
        {burn ? "Releasingâ€¦" : "Release to the void"}
      </motion.button>

      {/* Fire / dissolve animation + closing message */}
      <div className="min-h-[120px]">
        <AnimatePresence mode="wait">
          {burn && (
            <motion.div
              key="burning"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center gap-3 py-6"
            >
              <motion.div
                className="w-14 h-14 rounded-3xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-xl"
                animate={{ y: [-2, 2, -2] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                <span className="text-3xl">ðŸ”¥</span>
              </motion.div>
              <p className="text-xs text-gray-600">
                The thought is being released. You donâ€™t have to hold it in your body right now.
              </p>
            </motion.div>
          )}

          {!burn && released && (
            <motion.div
              key="released"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-[hsl(142_72%_36%)]/5 border border-[hsl(142_72%_36%)]/25 rounded-2xl p-4 text-left text-xs md:text-sm space-y-2"
            >
              <p className="text-[11px] font-semibold text-[hsl(142_72%_36%)] uppercase tracking-wide">
                Thought released
              </p>
              <p className="text-gray-800 italic line-clamp-3">â€œ{released}â€</p>
              <p className="text-[11px] text-gray-600">
                This thought has been acknowledged and let go for now. You can choose if and when to ever revisit it.
              </p>
            </motion.div>
          )}

          {!burn && !released && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-2xl p-3"
            >
              Tip: This is not about solving the thought. Itâ€™s about giving your brain one safe place to put it down.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
