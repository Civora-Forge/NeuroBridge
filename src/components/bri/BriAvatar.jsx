import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import usePrefersReducedMotion from "./usePrefersReducedMotion";

/**
 * Bri — the NeuroBridge mascot. A pure, state-driven SVG character: this
 * component owns no agent logic and no business state. It renders whatever
 * `state` it is given (one of the values `useBriState` produces from the
 * REAL agent execution state) and animates accordingly. The glowing
 * two-node "bridge" across the forehead is Bri's signature, state-reactive
 * element — it pulses, travels, connects, or dims depending on what the
 * real agent is actually doing.
 *
 * Every animation is transform/opacity-only (GPU-friendly) and collapses to
 * a static, still-distinguishable pose when the user has reduced motion on,
 * at either the OS or NeuroBridge's own sensory-preference level.
 */

const BODY_PATH =
  "M60 16C42 16 27 27 24 44C11 49 6 66 16 78C13 92 26 103 41 103C49 111 71 111 79 103C95 104 109 92 105 77C118 69 116 51 101 43C99 27 80 14 60 16Z";

const BLINK_INTERVAL_MIN = 2800;
const BLINK_INTERVAL_MAX = 5600;
const BLINK_DURATION = 130;

function useBlink(active) {
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    let blinkTimeout;
    let cycleTimeout;
    const schedule = () => {
      const delay = BLINK_INTERVAL_MIN + Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN);
      cycleTimeout = setTimeout(() => {
        setBlinking(true);
        blinkTimeout = setTimeout(() => {
          setBlinking(false);
          schedule();
        }, BLINK_DURATION);
      }, delay);
    };
    schedule();
    return () => {
      clearTimeout(cycleTimeout);
      clearTimeout(blinkTimeout);
    };
  }, [active]);
  return blinking;
}

const bodyVariants = {
  idle: { scale: [1, 1.018, 1], transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" } },
  listening: { scale: [1, 1.03, 1], transition: { duration: 1.1, repeat: Infinity, ease: "easeInOut" } },
  thinking: { scale: [1, 1.015, 1], transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" } },
  planning: { scale: [1, 1.015, 1], transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" } },
  acting: { scale: [1, 1.025, 1], transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" } },
  confirming: { scale: [1, 1.012, 1], transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } },
  success: { scale: [1, 1.09, 1], transition: { duration: 0.55, ease: "easeOut" } },
  error: { rotate: [0, -3, 3, -2, 0], transition: { duration: 0.5, ease: "easeInOut" } },
};

// Reduced motion: every state resets to the identity pose explicitly (not an
// empty variant) so switching into this mode mid-animation can't leave the
// SVG stuck at whatever scale/rotation it happened to be animating through.
const bodyVariantsStill = {
  idle: { scale: 1, rotate: 0 },
  listening: { scale: 1, rotate: 0 },
  thinking: { scale: 1, rotate: 0 },
  planning: { scale: 1, rotate: 0 },
  acting: { scale: 1, rotate: 0 },
  confirming: { scale: 1, rotate: 0 },
  success: { scale: 1, rotate: 0 },
  error: { scale: 1, rotate: 0 },
};

export default function BriAvatar({ state = "idle", speaking = false, size = 56, className = "" }) {
  const reducedMotion = usePrefersReducedMotion();
  const blinking = useBlink(!reducedMotion && (state === "idle" || state === "confirming"));

  const isHappy = state === "success";
  const isWorried = state === "error";
  const isAttentive = state === "listening";
  const isPondering = state === "thinking" || state === "planning";
  const isFocused = state === "acting";
  const isWaiting = state === "confirming";

  // Bridge palette: rooted in the app's own primary green, traveling to the
  // violet already used for a mode accent (--mode-dyscalculia) — ties Bri to
  // the existing brand instead of an unrelated neon gradient.
  const gradientId = "bri-bridge-gradient";
  const glowId = "bri-bridge-glow";

  const bridgeOpacityByState = {
    idle: 0.55,
    listening: 0.85,
    thinking: 0.75,
    planning: 0.75,
    acting: 0.9,
    confirming: 0.8,
    success: 1,
    error: 0.22,
  };

  const nodeScaleAnim = (() => {
    if (reducedMotion) return {};
    if (isAttentive) return { scale: [1, 1.4, 1], transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" } };
    if (isWaiting) return { scale: [1, 1.15, 1], transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } };
    if (state === "success") return { scale: [1, 1.5, 1], transition: { duration: 0.6, ease: "easeOut" } };
    return {};
  })();

  const bridgeAnim = reducedMotion
    ? {}
    : {
        opacity:
          state === "error"
            ? [0.22, 0.5, 0.22]
            : isAttentive
            ? [0.7, 1, 0.7]
            : isWaiting
            ? [0.7, 0.95, 0.7]
            : undefined,
        transition: { duration: state === "error" ? 0.5 : isWaiting ? 2.2 : 0.9, repeat: state === "error" ? 1 : Infinity, ease: "easeInOut" },
      };

  // Traveling "thought" node — a small pulse of light gliding along the
  // bridge, used for thinking/planning/acting so the signature bridge
  // element visibly does something different for each real agent phase
  // instead of eight unrelated effects bolted onto one shape.
  const travelAnim = !reducedMotion && (isPondering || isFocused)
    ? {
        cx: [34, 86, 34],
        transition: { duration: isFocused ? 0.9 : 1.8, repeat: Infinity, ease: "easeInOut" },
      }
    : {};

  const eyeRy = isWorried ? 3.2 : isAttentive ? 5.6 : blinking ? 0.6 : 5;
  const mouthPath = isHappy
    ? "M46 76 Q60 90 74 76"
    : isWorried
    ? "M46 82 Q60 72 74 82"
    : isPondering || isWaiting
    ? "M50 79 Q60 82 70 79"
    : isAttentive
    ? "M52 76 Q60 84 68 76"
    : "M48 77 Q60 84 72 77"; // idle / acting: calm small smile

  return (
    <motion.svg
      viewBox="0 0 120 118"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-hidden="true"
      animate={state}
      variants={reducedMotion ? bodyVariantsStill : bodyVariants}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(142 72% 40%)" />
          <stop offset="100%" stopColor="hsl(258 60% 62%)" />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Arms */}
      <path d="M23 72 Q10 82 12 96" stroke="#B98CA8" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M97 72 Q110 82 108 96" stroke="#B98CA8" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Legs */}
      <path d="M46 101 L44 116" stroke="#B98CA8" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M74 101 L76 116" stroke="#B98CA8" strokeWidth="7" strokeLinecap="round" fill="none" />

      {/* Body */}
      <path d={BODY_PATH} fill="#F7DCE6" stroke="#C98CA8" strokeWidth="2.5" />
      {/* Soft lobe shading for a bit of dimensionality without extra motion */}
      <path d="M30 48C34 36 46 27 60 27" stroke="#F2C3D6" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />

      {/* Bridge — the signature element */}
      <motion.path
        d="M34 40 Q60 26 86 40"
        stroke={`url(#${gradientId})`}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        filter={`url(#${glowId})`}
        style={{ opacity: bridgeOpacityByState[state] }}
        animate={bridgeAnim}
      />
      <motion.circle cx="34" cy="40" r="4.5" fill="hsl(142 72% 40%)" filter={`url(#${glowId})`} animate={nodeScaleAnim} />
      <motion.circle cx="86" cy="40" r="4.5" fill="hsl(258 60% 62%)" filter={`url(#${glowId})`} animate={nodeScaleAnim} />
      {(isPondering || isFocused) && (
        <motion.circle
          cy="33"
          r="3"
          fill="#fff"
          filter={`url(#${glowId})`}
          animate={travelAnim}
          initial={{ cx: 34 }}
        />
      )}

      {/* Face */}
      <motion.ellipse cx="46" cy="60" rx="5" animate={{ ry: eyeRy }} fill="#2B2530" />
      <motion.ellipse cx="74" cy="60" rx="5" animate={{ ry: eyeRy }} fill="#2B2530" />

      {/* Brows: only shown for pondering/waiting/worried expressions */}
      {isPondering && (
        <path d="M40 50 Q46 46 53 49" stroke="#2B2530" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      )}
      {isWaiting && (
        <>
          <path d="M39 49 Q46 44 53 48" stroke="#2B2530" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M67 48 Q74 44 81 49" stroke="#2B2530" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      )}
      {isWorried && (
        <>
          <path d="M40 51 Q47 55 54 52" stroke="#2B2530" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M66 52 Q73 55 80 51" stroke="#2B2530" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      )}

      <path d={mouthPath} stroke="#2B2530" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Cheeks — always present, a gentle constant warmth */}
      <circle cx="36" cy="70" r="4.5" fill="#F0A4BC" opacity="0.55" />
      <circle cx="84" cy="70" r="4.5" fill="#F0A4BC" opacity="0.55" />

      {speaking && !reducedMotion && (
        <motion.circle
          cx="60" cy="90" r="2"
          fill="hsl(142 72% 40%)"
          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.svg>
  );
}
