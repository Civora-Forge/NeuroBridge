/**
 * AsdVisualStyleSelector.jsx — a subtle, non-intrusive "Look & tone" control
 * for the ASD hub. Lets a user (or guardian) pick how illustrated and playful
 * the ASD surface feels without per-age implementations. Sit-to-the-side UI,
 * not a prominent feature.
 */

import { Paintbrush, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useASDVisualStyle } from "./useASDVisualStyle";
import { VISUAL_STYLE_PRESENTATION } from "./asdVisualStyle";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

export function AsdVisualStyleSelector({ className = "" }) {
  const { style, setStyle, styles } = useASDVisualStyle();
  const [open, setOpen] = useState(false);
  const { reduced } = useSensoryReducedMotion();

  return (
    <div className={`rounded-2xl border border-[#B2DFDB] bg-white/80 backdrop-blur ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 rounded-2xl"
      >
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#E0F5EE] text-[#0D9488]">
            <Paintbrush size={14} />
          </span>
          <span className="text-sm font-semibold text-[#134E4A]">Look &amp; tone</span>
          <span className="rounded-full bg-[#F0FAF7] px-2 py-0.5 text-[11px] font-bold text-[#0D9488] border border-[#B2DFDB]">
            {VISUAL_STYLE_PRESENTATION[style]?.label ?? "Balanced look"}
          </span>
        </span>
        {open ? <ChevronUp size={16} className="text-[#5F8A87]" /> : <ChevronDown size={16} className="text-[#5F8A87]" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-[#D5E6E0] px-4 py-4" role="radiogroup" aria-label="Look and tone">
              {styles.map((id) => {
                const item = VISUAL_STYLE_PRESENTATION[id];
                const selectedStyle = style === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selectedStyle}
                    onClick={() => setStyle(id)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 ${
                      selectedStyle ? "border-[#0D9488] bg-[#F0FAF7]" : "border-[#D5E6E0] bg-white hover:border-[#B2DFDB]"
                    }`}
                  >
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selectedStyle ? "border-[#0D9488] bg-[#0D9488]" : "border-[#B2DFDB] bg-white"}`} aria-hidden="true">
                      {selectedStyle && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-bold text-[#134E4A]">
                        {item.label}
                        {item.playful && <Sparkles size={12} className="text-[#0D9488]" aria-hidden="true" />}
                      </span>
                      <span className="block text-xs leading-relaxed text-[#5F8A87] mt-0.5">{item.description}</span>
                    </span>
                  </button>
                );
              })}
              <p className="text-[11px] text-[#5F8A87] leading-relaxed">
                Saved on this device. If a profile age is available it is used automatically — this is a manual override.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}