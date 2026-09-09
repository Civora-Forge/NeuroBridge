import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * TreeVisualization Component
 *
 * Designed to mirror the reference aesthetic:
 * - Clean, organic SVG tree with warm brown curved trunk and branching canopy.
 * - Soft, subtle green foliage leaves attached directly to branches with smooth sways.
 * - Soft pink 5-petal blossoms blooming on branch endpoints.
 * - Gentle falling leaves & petals drifting ambiently.
 * - Responsive 600x600 SVG coordinate system.
 *
 * @param {{ leaves: number, flowers: number, dayInSeason: number, season: number }} props
 */
export default function TreeVisualization({ leaves = 1, flowers = 0, dayInSeason = 1, season = 1 }) {
  const shouldReduceMotion = useReducedMotion();

  // Ensure safe positive numbers
  const safeLeaves = Math.max(1, Number(leaves) || 1);
  const safeFlowers = Math.max(0, Number(flowers) || 0);
  const safeDay = Math.max(1, Number(dayInSeason) || 1);

  // Stage classifications
  const isSapling = safeDay <= 3;
  const isEarlyTree = safeDay > 3 && safeDay <= 10;
  const isGrowingTree = safeDay > 10 && safeDay <= 20;

  // ── PREDEFINED LEAF ATTACHMENT ANCHORS (Fixed 600x600 SVG Coordinate System)
  const saplingLeafAnchors = [
    { x: 300, y: 340, rotate: 0, scale: 1.1, shade: "#4d8b67", highlight: "#78b890", delay: 0.05, sway: 1 },
    { x: 280, y: 375, rotate: -42, scale: 0.95, shade: "#589872", highlight: "#8bc8a2", delay: 0.1, sway: -1 },
    { x: 320, y: 370, rotate: 40, scale: 0.95, shade: "#4d8b67", highlight: "#78b890", delay: 0.15, sway: 1 },
    { x: 270, y: 410, rotate: -55, scale: 0.85, shade: "#437e5c", highlight: "#6cb085", delay: 0.2, sway: -1 },
    { x: 330, y: 405, rotate: 50, scale: 0.85, shade: "#437e5c", highlight: "#6cb085", delay: 0.25, sway: 1 },
  ];

  const matureLeafAnchors = [
    // Top Central Crown Cluster
    { x: 300, y: 120, rotate: -5, scale: 1.15, shade: "#437e5c", highlight: "#70b489", delay: 0.04, sway: 1 },
    { x: 275, y: 132, rotate: -32, scale: 1.05, shade: "#54946e", highlight: "#82c39c", delay: 0.08, sway: -1 },
    { x: 325, y: 130, rotate: 28, scale: 1.05, shade: "#4d8b67", highlight: "#7ab892", delay: 0.1, sway: 1.2 },
    { x: 298, y: 155, rotate: 10, scale: 0.95, shade: "#3d7554", highlight: "#66a77e", delay: 0.12, sway: -0.8 },

    // Upper Left Branch Cluster
    { x: 232, y: 188, rotate: -52, scale: 1.1, shade: "#54946e", highlight: "#82c39c", delay: 0.14, sway: -1.2 },
    { x: 208, y: 168, rotate: -72, scale: 0.98, shade: "#3d7554", highlight: "#66a77e", delay: 0.16, sway: 1 },
    { x: 254, y: 180, rotate: -32, scale: 0.95, shade: "#4d8b67", highlight: "#7ab892", delay: 0.18, sway: -0.9 },

    // Upper Right Branch Cluster
    { x: 368, y: 185, rotate: 52, scale: 1.1, shade: "#4d8b67", highlight: "#7ab892", delay: 0.15, sway: 1.1 },
    { x: 392, y: 164, rotate: 70, scale: 0.98, shade: "#54946e", highlight: "#82c39c", delay: 0.17, sway: -1.1 },
    { x: 346, y: 178, rotate: 32, scale: 0.95, shade: "#3d7554", highlight: "#66a77e", delay: 0.19, sway: 0.8 },

    // Mid Left Branch Outer Sprays
    { x: 180, y: 250, rotate: -82, scale: 1.08, shade: "#3d7554", highlight: "#66a77e", delay: 0.22, sway: -1.3 },
    { x: 158, y: 272, rotate: -95, scale: 0.92, shade: "#54946e", highlight: "#82c39c", delay: 0.25, sway: 1 },
    { x: 202, y: 235, rotate: -42, scale: 0.95, shade: "#4d8b67", highlight: "#7ab892", delay: 0.28, sway: -0.7 },

    // Mid Right Branch Outer Sprays
    { x: 420, y: 245, rotate: 82, scale: 1.08, shade: "#54946e", highlight: "#82c39c", delay: 0.24, sway: 1.3 },
    { x: 442, y: 265, rotate: 95, scale: 0.92, shade: "#3d7554", highlight: "#66a77e", delay: 0.27, sway: -1 },
    { x: 398, y: 232, rotate: 42, scale: 0.95, shade: "#4d8b67", highlight: "#7ab892", delay: 0.3, sway: 0.9 },

    // Lower Canopy Fillers
    { x: 185, y: 320, rotate: -85, scale: 0.9, shade: "#336346", highlight: "#57966f", delay: 0.32, sway: -1.1 },
    { x: 415, y: 315, rotate: 85, scale: 0.9, shade: "#336346", highlight: "#57966f", delay: 0.35, sway: 1.1 },
    { x: 265, y: 225, rotate: -22, scale: 1.0, shade: "#4d8b67", highlight: "#7ab892", delay: 0.38, sway: 0.7 },
    { x: 335, y: 220, rotate: 22, scale: 1.0, shade: "#54946e", highlight: "#82c39c", delay: 0.4, sway: -0.7 },
  ];

  // Active leaves calculation
  let activeLeaves = [];
  if (isSapling) {
    const count = Math.max(2, Math.min(saplingLeafAnchors.length, safeLeaves + 1));
    activeLeaves = saplingLeafAnchors.slice(0, count);
  } else if (isEarlyTree) {
    const count = Math.min(11, Math.max(7, safeLeaves + 4));
    activeLeaves = matureLeafAnchors.slice(0, count);
  } else if (isGrowingTree) {
    const count = Math.min(16, Math.max(12, safeLeaves + 7));
    activeLeaves = matureLeafAnchors.slice(0, count);
  } else {
    activeLeaves = matureLeafAnchors;
  }

  // ── PREDEFINED FLOWER ATTACHMENT ANCHORS
  const flowerAnchors = [
    { x: 230, y: 230, scale: 1.1, rotate: -10, delay: 0.2 },
    { x: 370, y: 220, scale: 1.1, rotate: 15, delay: 0.3 },
    { x: 300, y: 145, scale: 1.15, rotate: 0, delay: 0.4 },
    { x: 415, y: 275, scale: 1.0, rotate: 25, delay: 0.5 },
    { x: 180, y: 285, scale: 0.95, rotate: -20, delay: 0.6 },
    { x: 285, y: 200, scale: 1.0, rotate: -5, delay: 0.7 },
  ];

  const activeFlowers = isSapling ? [] : flowerAnchors.slice(0, Math.min(flowerAnchors.length, safeFlowers));

  // Ambient falling leaves and petals
  const fallingElements = [
    { x: 145, y: 220, rotate: 35, scale: 0.7, type: "leaf", duration: 7, delay: 0 },
    { x: 455, y: 190, rotate: -45, scale: 0.75, type: "leaf", duration: 8, delay: 1.5 },
    { x: 250, y: 340, rotate: 20, scale: 0.65, type: "petal", duration: 9, delay: 0.8 },
    { x: 390, y: 360, rotate: -30, scale: 0.65, type: "petal", duration: 7.5, delay: 2.2 },
    { x: 270, y: 270, rotate: -15, scale: 0.6, type: "leaf", duration: 8.5, delay: 3.1 },
  ];

  const ariaDescription = `Your wellbeing garden tree, currently on day ${safeDay} of season ${season}, with ${activeLeaves.length} leaves and ${activeFlowers.length} blossom${activeFlowers.length === 1 ? "" : "s"}.`;

  return (
    <div
      className="relative flex flex-col items-center justify-center w-full select-none"
      role="img"
      aria-label={ariaDescription}
    >
      <svg
        viewBox="0 0 600 600"
        className="w-full max-w-[540px] h-auto overflow-visible"
      >
        <defs>
          {/* Soft Sunlight Glow */}
          <radialGradient id="gardenSunlightSoft" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#fef3c7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#fef9c3" stopOpacity="0" />
          </radialGradient>

          {/* Warm Bark Gradient */}
          <linearGradient id="warmBarkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7a5438" />
            <stop offset="40%" stopColor="#966a49" />
            <stop offset="75%" stopColor="#825a3d" />
            <stop offset="100%" stopColor="#63432b" />
          </linearGradient>

          {/* Sapling Stem Gradient */}
          <linearGradient id="saplingStemSoft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#437e5c" />
            <stop offset="50%" stopColor="#6cb085" />
            <stop offset="100%" stopColor="#336346" />
          </linearGradient>

          {/* Soft Leaf Gradient */}
          <linearGradient id="softLeafGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8bc8a2" />
            <stop offset="50%" stopColor="#54946e" />
            <stop offset="100%" stopColor="#396e4f" />
          </linearGradient>

          {/* Ground Soil Gradient */}
          <linearGradient id="earthSoilSoft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#73543f" />
            <stop offset="60%" stopColor="#8c6850" />
            <stop offset="100%" stopColor="#543b2a" />
          </linearGradient>

          {/* Soft Landscape Hills */}
          <linearGradient id="softLandscapeHill" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#edf7f0" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#d5ebd9" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#edf7f0" stopOpacity="0.5" />
          </linearGradient>

          {/* Soft Pink Blossom Petal Gradient */}
          <linearGradient id="softPetalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde8f3" />
            <stop offset="50%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#e85d9e" />
          </linearGradient>

          {/* Falling Petal Light Gradient */}
          <linearGradient id="fallingPetalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbcfe8" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>

        {/* ── Background Sun & Hill ── */}
        <circle cx="440" cy="130" r="95" fill="url(#gardenSunlightSoft)" />
        <path
          d="M10 475 Q160 445 300 460 T590 460 L590 550 L10 550 Z"
          fill="url(#softLandscapeHill)"
        />

        {/* ── Ground Soil Mound & Grass ── */}
        <ellipse cx="300" cy="495" rx="140" ry="22" fill="url(#earthSoilSoft)" />
        <ellipse cx="300" cy="493" rx="120" ry="15" fill="#589872" opacity="0.3" />

        {/* Base Pebbles */}
        <path d="M190 490 Q204 476 218 483 Q228 496 210 500 Z" fill="#9ca3af" opacity="0.7" />
        <path d="M385 492 Q402 478 416 486 Q424 498 406 502 Z" fill="#9ca3af" opacity="0.7" />

        {/* Base Grass Tufts */}
        <path d="M220 492 Q212 462 200 452 Q214 470 224 488 Z" fill="#4d8b67" />
        <path d="M242 495 Q238 460 230 445 Q244 466 248 492 Z" fill="#6cb085" />
        <path d="M352 495 Q344 466 334 452 Q346 472 356 492 Z" fill="#6cb085" />
        <path d="M374 492 Q384 462 394 450 Q386 472 380 492 Z" fill="#4d8b67" />

        {/* ── Main Swaying Tree Group (Rooted at 300, 495) ── */}
        <motion.g
          animate={shouldReduceMotion ? {} : { rotate: [-0.4, 0.4, -0.4] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "300px 495px" }}
        >
          {/* ── 1. Sapling Stem (Days 1–3) ── */}
          {isSapling && (
            <g className="sapling-structure">
              <path
                d="M294 495 C295 440 293 390 300 340 C306 390 305 440 306 495 Z"
                fill="url(#saplingStemSoft)"
              />
              <path
                d="M297 410 Q284 395 276 387 M303 402 Q316 388 324 380"
                stroke="url(#saplingStemSoft)"
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          )}

          {/* ── 2. Curved Tree Trunk & Branches (Days 4–30) ── */}
          {!isSapling && (
            <g className="tree-branches-structure">
              <path
                d="M272 495 C282 430 274 365 284 300 C290 255 296 215 300 155 C304 215 310 255 316 300 C326 365 318 430 328 495 Z"
                fill="url(#warmBarkGradient)"
              />
              <path
                d="M284 338 C256 315 225 295 198 275 C215 285 248 306 282 324 Z"
                fill="url(#warmBarkGradient)"
              />
              <path
                d="M228 300 C210 280 195 262 182 250 M228 300 Q210 316 194 324"
                stroke="url(#warmBarkGradient)"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M316 332 C344 312 375 290 402 270 L386 280 C352 302 320 320 318 320 Z"
                fill="url(#warmBarkGradient)"
              />
              <path
                d="M365 295 C382 276 398 258 410 246 M365 295 Q382 310 398 320"
                stroke="url(#warmBarkGradient)"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M290 265 C268 235 244 208 226 192 C242 205 268 228 288 248 Z"
                fill="url(#warmBarkGradient)"
              />
              <path
                d="M252 222 C238 202 225 184 215 174"
                stroke="url(#warmBarkGradient)"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M310 258 C332 228 356 200 374 186 C358 200 332 222 312 242 Z"
                fill="url(#warmBarkGradient)"
              />
              <path
                d="M348 215 C362 195 375 176 385 166"
                stroke="url(#warmBarkGradient)"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M296 205 C288 180 274 155 262 140 M304 200 C312 175 326 150 338 135"
                stroke="url(#warmBarkGradient)"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          )}

          {/* ── 3. ELEGANT SUBTLE LEAVES LAYER ── */}
          <g className="tree-leaves-layer">
            {activeLeaves.map((leaf, index) => (
              <g
                key={`subtle-leaf-${index}`}
                transform={`translate(${leaf.x}, ${leaf.y}) rotate(${leaf.rotate}) scale(${leaf.scale})`}
              >
                {/* Organic Soft Curved Leaf Path matching reference image */}
                <path
                  d="M0 0 C-14 -12 -16 -28 0 -42 C16 -28 14 -12 0 0 Z"
                  fill={leaf.shade || "#54946e"}
                />
                <path
                  d="M0 0 C-6 -10 -7 -25 0 -42 C7 -25 6 -10 0 0 Z"
                  fill={leaf.highlight || "#82c39c"}
                  opacity="0.6"
                />
                <path
                  d="M0 -1 L0 -38"
                  stroke="#265239"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity="0.4"
                />
              </g>
            ))}
          </g>

          {/* ── 4. SOFT PINK CHERRY BLOSSOMS ── */}
          <g className="tree-flowers-layer">
            {activeFlowers.map((flower, idx) => (
              <g
                key={`subtle-flower-${idx}`}
                transform={`translate(${flower.x}, ${flower.y}) rotate(${flower.rotate}) scale(${flower.scale})`}
              >
                {[0, 72, 144, 216, 288].map((angle, pIdx) => (
                  <path
                    key={`petal-${pIdx}`}
                    d="M0 0 C-7 -12 -3 -20 4 -20 C11 -20 15 -12 0 0"
                    fill="url(#softPetalGradient)"
                    transform={`rotate(${angle})`}
                    opacity="0.95"
                  />
                ))}
                <circle cx="0" cy="0" r="4.5" fill="#fef08a" />
                <circle cx="0" cy="0" r="2.2" fill="#f59e0b" />
              </g>
            ))}
          </g>
        </motion.g>

        {/* ── 5. DRIFTING FALLING LEAVES & PETALS ── */}
        {!shouldReduceMotion && (
          <g className="ambient-falling-elements">
            {fallingElements.map((el, fIdx) => (
              <motion.g
                key={`falling-${fIdx}`}
                initial={{ opacity: 0, x: el.x, y: el.y, rotate: el.rotate }}
                animate={{
                  opacity: [0, 0.85, 0.85, 0],
                  y: [el.y, el.y + 45, el.y + 90],
                  x: [el.x, el.x + (fIdx % 2 === 0 ? 18 : -18), el.x + (fIdx % 2 === 0 ? 30 : -30)],
                  rotate: [el.rotate, el.rotate + 40, el.rotate + 80],
                }}
                transition={{
                  duration: el.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: el.delay,
                }}
              >
                {el.type === "leaf" ? (
                  <path
                    d="M0 0 C-8 -7 -9 -18 0 -25 C9 -18 8 -7 0 0 Z"
                    fill="#54946e"
                    opacity="0.8"
                    transform={`scale(${el.scale})`}
                  />
                ) : (
                  <path
                    d="M0 0 C-5 -8 -2 -14 3 -14 C8 -14 10 -8 0 0 Z"
                    fill="url(#fallingPetalGradient)"
                    opacity="0.85"
                    transform={`scale(${el.scale})`}
                  />
                )}
              </motion.g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
