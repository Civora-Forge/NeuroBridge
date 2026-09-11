import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import usePrefersReducedMotion from "./usePrefersReducedMotion";

/**
 * Bri — the NeuroBridge mascot, redrawn as vector art from the reference
 * character board: a soft, fluffy cloud-brain body, a teal-to-violet
 * "bridge" headband with two node lights as the signature element, and the
 * exact per-state iconography from that board (ellipsis for thinking, a
 * checklist for planning, sound waves for listening, a question mark for
 * confirmation, a rain cloud for error, a sparkle burst for success, and
 * motion lines for acting).
 *
 * This component owns no agent logic and no business state — it only renders
 * whatever `state` it is given (one of the values `useBriState` produces
 * from the REAL agent execution state).
 */

const BODY_PATH =
  "M70 22C54 22 43 30 39 42C25 41 14 52 16 64C6 67 2 80 10 90C7 101 15 111 27 110C30 122 47 128 60 121C65 130 84 130 89 122C102 128 121 121 122 109C134 109 141 95 132 85C140 75 135 61 123 56C124 42 112 30 97 30C93 22 80 18 70 22Z";

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
  acting: { y: [0, -2, 0], transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" } },
  confirming: { scale: [1, 1.012, 1], transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } },
  success: { scale: [1, 1.1, 1], y: [0, -6, 0], transition: { duration: 0.55, ease: "easeOut" } },
  error: { rotate: [0, -3, 3, -2, 0], transition: { duration: 0.5, ease: "easeInOut" } },
};

// Reduced motion: every state resets to the identity pose explicitly (not an
// empty variant) so switching into this mode mid-animation can't leave the
// SVG stuck at whatever scale/rotation/position it happened to be animating
// through.
const IDENTITY_POSE = { scale: 1, rotate: 0, y: 0 };
const bodyVariantsStill = Object.fromEntries(Object.keys(bodyVariants).map((k) => [k, IDENTITY_POSE]));

// Arm/leg poses — a small, named set (not one-off per state) so Bri reads as
// one coherent character rather than eight unrelated drawings.
const LIMBS = {
  relaxed: {
    arms: "M39 88Q26 96 24 110M101 88Q114 96 116 110",
    legs: "M58 120L56 138M82 120L84 138",
    hands: [[24, 110], [116, 110]],
    feet: [[56, 138], [84, 138]],
  },
  raised: {
    arms: "M39 86Q22 66 16 48M101 86Q118 66 124 48",
    legs: "M58 120L54 138M82 120L86 138",
    hands: [[16, 48], [124, 48]],
    feet: [[54, 138], [86, 138]],
  },
  running: {
    arms: "M39 88Q20 80 14 62M101 88Q116 100 122 116",
    legs: "M58 120L44 140M82 120L94 134",
    hands: [[14, 62], [122, 116]],
    feet: [[44, 140], [94, 134]],
  },
  slumped: {
    arms: "M39 90Q28 104 30 118M101 90Q112 104 110 118",
    legs: "M58 120L58 136M82 120L82 136",
    hands: [[30, 118], [110, 118]],
    feet: [[58, 136], [82, 136]],
  },
};

const LIMBS_BY_STATE = {
  idle: "relaxed",
  listening: "relaxed",
  thinking: "relaxed",
  planning: "relaxed",
  acting: "running",
  confirming: "relaxed",
  success: "raised",
  error: "slumped",
};

const LIMB_COLOR = "#332A3D";

export default function BriAvatar({ state = "idle", speaking = false, size = 56, className = "" }) {
  const reducedMotion = usePrefersReducedMotion();
  const blinking = useBlink(!reducedMotion && (state === "idle" || state === "confirming"));

  const isHappy = state === "success";
  const isWorried = state === "error";
  const isAttentive = state === "listening";
  const isPondering = state === "thinking" || state === "planning";
  const isFocused = state === "acting";
  const isWaiting = state === "confirming";

  const gradientId = "bri-bridge-gradient";
  const glowId = "bri-bridge-glow";

  const bridgeOpacityByState = {
    idle: 0.6,
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
    if (state === "success") return { scale: [1, 1.6, 1], transition: { duration: 0.6, ease: "easeOut" } };
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

  // Traveling "thought" node along the headband — thinking/planning/acting
  // each move it at a different pace so the signature bridge visibly does
  // something different for each real agent phase.
  const travelAnim = !reducedMotion && (isPondering || isFocused)
    ? { cx: [32, 108, 32], transition: { duration: isFocused ? 0.9 : 1.8, repeat: Infinity, ease: "easeInOut" } }
    : {};

  const eyeRy = isWorried ? 3.5 : isAttentive ? 9.5 : isHappy ? 1.5 : blinking ? 0.6 : 8;
  const mouthPath = isHappy
    ? "M54 96Q70 116 86 96Q70 106 54 96Z"
    : isWorried
    ? "M54 104Q70 92 86 104"
    : isPondering || isWaiting
    ? "M58 98Q70 101 82 98"
    : isAttentive
    ? "M58 94Q70 106 82 94Q70 100 58 94Z"
    : "M56 95Q70 105 84 95"; // idle / acting: calm open smile

  const limbs = LIMBS[LIMBS_BY_STATE[state]] ?? LIMBS.relaxed;

  return (
    <motion.svg
      viewBox="0 0 140 148"
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
          <stop offset="0%" stopColor="#4FD1E0" />
          <stop offset="100%" stopColor="#9B7FE8" />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Limbs — black stick arms/legs with round hand/foot caps, reference-style */}
      <path d={limbs.arms} stroke={LIMB_COLOR} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d={limbs.legs} stroke={LIMB_COLOR} strokeWidth="6" strokeLinecap="round" fill="none" />
      {[...limbs.hands, ...limbs.feet].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i < 2 ? 4.5 : 5.5} fill={LIMB_COLOR} />
      ))}

      {/* Body — fluffy cloud-brain silhouette */}
      <path d={BODY_PATH} fill="#FBDCE7" stroke="#D79BB4" strokeWidth="2.5" />
      <path d="M34 58C40 44 54 33 70 33" stroke="#F6C9DC" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.75" />

      {/* Bridge headband — the signature element */}
      <motion.path
        d="M30 52Q70 12 110 52"
        stroke={`url(#${gradientId})`}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        filter={`url(#${glowId})`}
        style={{ opacity: bridgeOpacityByState[state] }}
        animate={bridgeAnim}
      />
      <motion.circle cx="30" cy="52" r="5.5" fill="#4FD1E0" filter={`url(#${glowId})`} animate={nodeScaleAnim} />
      <motion.circle cx="110" cy="52" r="5.5" fill="#9B7FE8" filter={`url(#${glowId})`} animate={nodeScaleAnim} />
      {(isPondering || isFocused) && (
        <motion.circle cy="20" r="3.5" fill="#fff" filter={`url(#${glowId})`} animate={travelAnim} initial={{ cx: 32 }} />
      )}

      {/* Face */}
      <motion.ellipse cx="52" cy="76" rx="6.5" animate={{ ry: eyeRy }} fill="#2B2530" />
      <motion.ellipse cx="88" cy="76" rx="6.5" animate={{ ry: eyeRy }} fill="#2B2530" />

      {isPondering && <path d="M43 62Q52 56 62 60" stroke="#2B2530" strokeWidth="2.8" strokeLinecap="round" fill="none" />}
      {isWaiting && (
        <>
          <path d="M42 60Q52 53 62 58" stroke="#2B2530" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          <path d="M78 58Q88 53 98 60" stroke="#2B2530" strokeWidth="2.8" strokeLinecap="round" fill="none" />
        </>
      )}
      {isWorried && (
        <>
          <path d="M42 63Q52 68 62 64" stroke="#2B2530" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          <path d="M78 64Q88 68 98 63" stroke="#2B2530" strokeWidth="2.8" strokeLinecap="round" fill="none" />
        </>
      )}

      <path d={mouthPath} stroke="#2B2530" strokeWidth={isHappy || isAttentive ? 0 : 3.4} strokeLinecap="round" fill={isHappy || isAttentive ? "#2B2530" : "none"} />

      {/* Cheeks */}
      <circle cx="40" cy="90" r="5.5" fill="#F0A4BC" opacity="0.55" />
      <circle cx="100" cy="90" r="5.5" fill="#F0A4BC" opacity="0.55" />

      {/* Per-state badge — the exact iconography from the reference board */}
      {isAttentive && (
        <motion.g
          animate={reducedMotion ? {} : { opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M112 66Q120 70 112 74" stroke="#4FD1E0" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <path d="M118 60Q131 70 118 80" stroke="#4FD1E0" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </motion.g>
      )}

      {state === "thinking" && (
        <motion.g animate={reducedMotion ? {} : { y: [0, -2, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
          <circle cx="104" cy="18" r="3" fill="#9B7FE8" />
          <circle cx="114" cy="12" r="3" fill="#9B7FE8" />
          <circle cx="124" cy="6" r="3" fill="#9B7FE8" />
        </motion.g>
      )}

      {state === "planning" && (
        <g>
          <rect x="104" y="4" width="20" height="24" rx="4" fill="#fff" stroke="#9B7FE8" strokeWidth="2.5" />
          <path d="M109 12h10M109 17h10M109 22h6" stroke="#9B7FE8" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {isFocused && !reducedMotion && (
        <motion.g
          animate={{ x: [0, -3, 0], opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M4 56h14M2 68h12M4 80h10" stroke="#9B7FE8" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
      )}

      {isWaiting && (
        <text x="112" y="20" fontSize="22" fontWeight="800" fill="#9B7FE8" fontFamily="inherit">?</text>
      )}

      {isWorried && (
        <g>
          <path
            d="M96 8c-4-6-13-6-16 0-6 0-9 8-3 11h20c7-2 5-10-1-11Z"
            fill="#C9D6EC"
            stroke="#9CB0D6"
            strokeWidth="1.5"
          />
          <motion.g
            animate={reducedMotion ? {} : { y: [0, 4, 0], opacity: [1, 0.4, 1] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
          >
            <path d="M88 22L86 28M98 22L96 28" stroke="#7FA0D6" strokeWidth="2.4" strokeLinecap="round" />
          </motion.g>
        </g>
      )}

      {isHappy && (
        <motion.g
          animate={reducedMotion ? {} : { scale: [0.6, 1.15, 1], opacity: [0, 1, 1] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <path d="M112 8l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill="#FFC857" />
          <circle cx="94" cy="18" r="2.5" fill="#FFC857" />
          <circle cx="126" cy="24" r="2" fill="#FFC857" />
        </motion.g>
      )}

      {speaking && !reducedMotion && (
        <motion.circle
          cx="70" cy="112" r="2.5"
          fill="#4FD1E0"
          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.svg>
  );
}
