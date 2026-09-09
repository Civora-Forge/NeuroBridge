/**
 * AsdSpeechBubble.jsx + AsdDecor + AsdRewardStars — small shared decoration
 * primitives for the ASD surface.
 *
 * AsdSpeechBubble   — a speech/thought bubble with a tail for dialogue lines.
 * AsdDecor          — a sticker layer; renders only for styles that allow
 *                     stickers and is always hidden from assistive tech.
 * AsdRewardStars    — lightweight, non-competitive reward markers whose
 *                     intensity follows the visual style (younger → 3,
 *                     balanced → 2, clear → none).
 */

import { useASDVisualStyle } from "./useASDVisualStyle";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

const SPEECH_TONES = Object.freeze({
  teal: { border: "#B2DFDB", bubble: "rgba(255,255,255,0.96)", text: "#134E4A", tail: "#FFFFFF" },
  amber: { border: "#FDE68A", bubble: "rgba(255,253,245,0.98)", text: "#7C5E10", tail: "#FFFBF0" },
  violet: { border: "#DDD6FE", bubble: "rgba(255,255,255,0.97)", text: "#3730A3", tail: "#FFFFFF" },
  rose: { border: "#FECDD3", bubble: "rgba(255,255,255,0.97)", text: "#9F1239", tail: "#FFFFFF" },
  cyan: { border: "#A5F3FC", bubble: "rgba(255,255,255,0.97)", text: "#155E75", tail: "#FFFFFF" },
});

export function AsdSpeechBubble({
  children,
  tone = "teal",
  align = "left",
  className = "",
  muted = false,
  label = null,
}) {
  const palette = SPEECH_TONES[tone] ?? SPEECH_TONES.teal;
  const isLeft = align === "left";
  return (
    <div
      className={`relative max-w-[92%] rounded-2xl border-2 px-4 py-2.5 text-sm shadow-sm sm:max-w-[85%] ${className}`}
      style={{
        borderColor: palette.border,
        background: palette.bubble,
        color: muted ? "#5F8A87" : palette.text,
        borderRadius: isLeft ? "1rem 1rem 1rem 0.25rem" : "1rem 1rem 0.25rem 1rem",
      }}
      aria-label={label ?? undefined}
    >
      {children}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: -1,
          [isLeft ? "left" : "right"]: 14,
          width: 14,
          height: 14,
          background: palette.tail,
          borderRight: `2px solid ${palette.border}`,
          borderBottom: `2px solid ${palette.border}`,
          transform: isLeft ? "rotate(-45deg)" : "rotate(135deg)",
          transformOrigin: "center",
          zIndex: 0,
        }}
      />
    </div>
  );
}

export function AsdDecor({ children, className = "", label }) {
  const { presentation } = useASDVisualStyle();
  if (!presentation.stickers) return null;
  return (
    <span
      aria-hidden="true"
      className={`asd-decor pointer-events-none inline-block select-none align-middle ${className}`}
      title={label}
    >
      {children}
    </span>
  );
}

export function AsdRewardStars({ earned = 2, label = "Practice reward", className = "" }) {
  const { style } = useASDVisualStyle();
  const { reduced } = useSensoryReducedMotion();

  const countByStyle = { younger: 3, balanced: 2, clear: 0 };
  const shown = Math.max(0, Math.min(3, countByStyle[style] ?? 0, earned));
  if (shown === 0) return null;

  return (
    <span
      role="img"
      aria-label={`${label}: ${shown} point${shown === 1 ? "" : "s"}`}
      className={`inline-flex items-center gap-1 ${className}`}
    >
      {Array.from({ length: shown }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={reduced ? undefined : "asd-pop-once inline-block"}
          style={{
            color: "#F59E0B",
            fontSize: index === 0 ? "1.05rem" : "0.9rem",
            animationDelay: `${index * 0.12}s`,
            textShadow: "0 1px 2px rgba(217,119,6,0.3)",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default AsdSpeechBubble;