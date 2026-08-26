/**
 * CompanionSticker.jsx — Reusable SVG illustration system for NeuroBridge ASD + Anxiety modules.
 *
 * Stickers function as emotional visual cues, not random decoration.
 * Each variant reinforces the meaning of the screen it appears on.
 *
 * Aesthetic: modern wellness app + gentle illustration — not a children's game.
 * Works for ages 6–18 without feeling babyish or clinical.
 */

import { motion } from "framer-motion";

const STICKER_PATHS = {
  /* ── Calm ─────────────────────────────────────── */
  "calm-cloud": (color) => (
    <g>
      <circle cx="26" cy="30" r="11" fill={color} opacity="0.7" />
      <circle cx="38" cy="27" r="13" fill={color} opacity="0.85" />
      <circle cx="48" cy="31" r="9" fill={color} opacity="0.7" />
      <ellipse cx="37" cy="37" rx="19" ry="7" fill={color} opacity="0.55" />
    </g>
  ),

  "calm-moon": (color) => (
    <g>
      <circle cx="32" cy="32" r="14" fill={color} opacity="0.85" />
      <circle cx="39" cy="26" r="12" fill="#F0F4FF" />
      <circle cx="22" cy="20" r="1.5" fill={color} opacity="0.3" />
      <circle cx="48" cy="18" r="1" fill={color} opacity="0.25" />
    </g>
  ),

  "calm-leaf": (color) => (
    <g>
      <path
        d="M32 10 C20 22, 18 38, 32 52 C46 38, 44 22, 32 10Z"
        fill={color}
        opacity="0.75"
      />
      <path
        d="M32 18 L32 44"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.5"
        fill="none"
      />
      <path
        d="M32 28 L26 24 M32 34 L24 30 M32 40 L26 36"
        stroke={color}
        strokeWidth="1"
        opacity="0.35"
        fill="none"
      />
    </g>
  ),

  "calm-star": (color) => (
    <g>
      <path
        d="M32 8 L35 22 L48 22 L37 30 L41 44 L32 36 L23 44 L27 30 L16 22 L29 22Z"
        fill={color}
        opacity="0.7"
      />
    </g>
  ),

  /* ── Grounding ────────────────────────────────── */
  "grounding-tree": (color) => (
    <g>
      <rect x="30" y="38" width="4" height="14" rx="2" fill="#A0846B" opacity="0.6" />
      <circle cx="32" cy="30" r="13" fill={color} opacity="0.7" />
      <circle cx="26" cy="26" r="6" fill={color} opacity="0.4" />
      <circle cx="38" cy="28" r="5" fill={color} opacity="0.35" />
    </g>
  ),

  "grounding-flower": (color) => (
    <g>
      <circle cx="32" cy="28" r="3.5" fill="#FCD34D" opacity="0.8" />
      <circle cx="32" cy="20" r="5" fill={color} opacity="0.6" />
      <circle cx="39" cy="24" r="5" fill={color} opacity="0.55" />
      <circle cx="37" cy="32" r="5" fill={color} opacity="0.5" />
      <circle cx="27" cy="32" r="5" fill={color} opacity="0.55" />
      <circle cx="25" cy="24" r="5" fill={color} opacity="0.6" />
      <line x1="32" y1="34" x2="32" y2="50" stroke="#7BA882" strokeWidth="1.5" opacity="0.5" />
    </g>
  ),

  "grounding-stone": (color) => (
    <g>
      <ellipse cx="32" cy="40" rx="17" ry="9" fill={color} opacity="0.5" />
      <ellipse cx="32" cy="38" rx="15" ry="7" fill={color} opacity="0.7" />
      <ellipse cx="30" cy="36" rx="8" ry="3" fill="white" opacity="0.15" />
    </g>
  ),

  /* ── Breathing ────────────────────────────────── */
  "breathing": (color) => (
    <g>
      <circle cx="32" cy="32" r="18" fill="none" stroke={color} strokeWidth="2" opacity="0.4" />
      <circle cx="32" cy="32" r="12" fill="none" stroke={color} strokeWidth="1.5" opacity="0.55" />
      <circle cx="32" cy="32" r="6" fill={color} opacity="0.3" />
    </g>
  ),

  /* ── Focus ────────────────────────────────────── */
  "focus-star": (color) => (
    <g>
      <path
        d="M32 8 L35 22 L48 22 L37 30 L41 44 L32 36 L23 44 L27 30 L16 22 L29 22Z"
        fill={color}
        opacity="0.65"
      />
      <circle cx="32" cy="26" r="3" fill="white" opacity="0.3" />
    </g>
  ),

  "focus-lamp": (color) => (
    <g>
      <path d="M26 14 L38 14 L42 30 L22 30Z" fill={color} opacity="0.5" />
      <rect x="30" y="30" width="4" height="6" rx="1" fill={color} opacity="0.6" />
      <rect x="26" y="36" width="12" height="3" rx="1.5" fill={color} opacity="0.45" />
      <circle cx="32" cy="22" r="4" fill="#FCD34D" opacity="0.4" />
    </g>
  ),

  /* ── Recovery ─────────────────────────────────── */
  "recovery-sunrise": (color) => (
    <g>
      <rect x="14" y="40" width="36" height="3" rx="1.5" fill={color} opacity="0.35" />
      <path d="M20 40 A12 12 0 0 1 44 40" fill={color} opacity="0.6" />
      <line x1="32" y1="18" x2="32" y2="26" stroke={color} strokeWidth="1.5" opacity="0.4" />
      <line x1="20" y1="26" x2="26" y2="30" stroke={color} strokeWidth="1.5" opacity="0.35" />
      <line x1="44" y1="26" x2="38" y2="30" stroke={color} strokeWidth="1.5" opacity="0.35" />
    </g>
  ),

  "recovery-sprout": (color) => (
    <g>
      <line x1="32" y1="50" x2="32" y2="26" stroke={color} strokeWidth="1.5" opacity="0.5" />
      <path d="M32 26 C24 18, 22 10, 32 6 C42 10, 40 18, 32 26Z" fill={color} opacity="0.65" />
      <path
        d="M32 34 C26 28, 18 28, 16 34"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.4"
      />
    </g>
  ),

  /* ── Concern (non-threatening) ────────────────── */
  concern: (color) => (
    <g>
      <circle cx="32" cy="34" r="15" fill={color} opacity="0.5" />
      <circle cx="26" cy="30" r="2.5" fill="#4A5568" opacity="0.6" />
      <circle cx="38" cy="30" r="2.5" fill="#4A5568" opacity="0.6" />
      <path
        d="M27 40 Q32 37 37 40"
        fill="none"
        stroke="#4A5568"
        strokeWidth="1.5"
        opacity="0.5"
      />
    </g>
  ),

  /* ── Relaxed ──────────────────────────────────── */
  relaxed: (color) => (
    <g>
      <circle cx="32" cy="34" r="15" fill={color} opacity="0.5" />
      <path d="M24 30 L28 30" stroke="#4A5568" strokeWidth="2" opacity="0.5" strokeLinecap="round" />
      <path d="M36 30 L40 30" stroke="#4A5568" strokeWidth="2" opacity="0.5" strokeLinecap="round" />
      <path
        d="M27 39 Q32 43 37 39"
        fill="none"
        stroke="#4A5568"
        strokeWidth="1.5"
        opacity="0.5"
        strokeLinecap="round"
      />
    </g>
  ),
};

const STICKER_COLORS = {
  calm: "#93B8F5",
  grounding: "#7BC5A0",
  breathing: "#93C5FD",
  focus: "#FFD580",
  recovery: "#FFB88C",
  concern: "#F5A5A5",
  relaxed: "#7BC5A0",
};

const DEFAULT_SIZE = 48;

export default function CompanionSticker({
  variant = "calm-cloud",
  size = DEFAULT_SIZE,
  mood = "calm",
  animate = true,
  className = "",
}) {
  const color = STICKER_COLORS[mood] || STICKER_COLORS.calm;
  const renderFn = STICKER_PATHS[variant];

  if (!renderFn) return null;

  const stickerContent = (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={variant.replace(/-/g, " ")}
      className={className}
      style={{ display: "block" }}
    >
      {renderFn(color)}
    </svg>
  );

  if (!animate) return stickerContent;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{ display: "inline-flex", lineHeight: 0 }}
    >
      {stickerContent}
    </motion.div>
  );
}

export { STICKER_COLORS };
