/**
 * AsdProgress.jsx — shared progress indicators for the ASD surface.
 * Dots (stories / steps), a bar (conversation turns), and a ring (hub cards).
 * All respect `useSensoryReducedMotion` for animated transitions.
 */

import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

const toneColors = {
  teal: { active: "#0D9488", done: "#34D399", idle: "#B2DFDB" },
  amber: { active: "#D97706", done: "#F59E0B", idle: "#FDE68A" },
  violet: { active: "#7C3AED", done: "#A78BFA", idle: "#DDD6FE" },
  rose: { active: "#E11D48", done: "#FDA4AF", idle: "#FECDD3" },
  cyan: { active: "#0891B2", done: "#22D3EE", idle: "#A5F3FC" },
};

export function AsdProgressDots({ total, current, onSelect, tone = "teal", labelPrefix = "Step" }) {
  const palette = toneColors[tone] ?? toneColors.teal;
  const { reduced } = useSensoryReducedMotion();
  if (total <= 0) return null;
  return (
    <div className="flex gap-2" aria-label={`${labelPrefix} ${Math.min(current + 1, total)} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const state = i === current ? "active" : i < current ? "done" : "idle";
        const isButton = typeof onSelect === "function";
        const content = (
          <span
            className={`block h-3 rounded-full transition-all ${state === "active" ? "w-7" : "w-3"} ${isButton ? "cursor-pointer" : ""}`}
            style={{ backgroundColor: palette[state] }}
          />
        );
        return isButton ? (
          <button type="button" key={i} onClick={() => onSelect(i)} aria-label={`${labelPrefix} ${i + 1}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400">
            {content}
          </button>
        ) : (
          <span key={i}>{content}</span>
        );
      })}
    </div>
  );
}

export function AsdProgressBar({ value, max = 1, tone = "teal", label, className = "" }) {
  const palette = toneColors[tone] ?? toneColors.teal;
  const { reduced } = useSensoryReducedMotion();
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#5F8A87]">{label}</span>
          <span className="text-xs font-black text-[#0D9488]">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E4F3EE]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: palette.active }}
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduced ? 0 : 0.45, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function AsdProgressRing({ value, max = 1, size = 44, stroke = 5, tone = "teal", label, center, className = "" }) {
  const palette = toneColors[tone] ?? toneColors.teal;
  const { reduced, gentle } = useSensoryReducedMotion();
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;
  return (
    <div
      className={`relative grid place-items-center ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E4F3EE" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette.active}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduced ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - dash }}
          transition={{ duration: reduced ? 0 : gentle ? 0.5 : 0.9, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute text-sm font-black text-[#134E4A]">{center ?? Math.round(pct * 100)}</span>
    </div>
  );
}

/**
 * AsdProgressTrack — a path-style progress indicator for step-based features
 * (social stories, simulations). Renders numbered/checkable stops connected
 * by a track line so the user feels they are moving through a scene sequence.
 * Keyboard interactivity is preserved when `onSelect` is provided.
 */
export function AsdProgressTrack({ total, current, onSelect, tone = "teal", labelPrefix = "Scene", labels = null }) {
  const palette = toneColors[tone] ?? toneColors.teal;
  const { reduced } = useSensoryReducedMotion();
  if (total <= 0) return null;

  return (
    <div
      className="flex w-full items-center"
      role="group"
      aria-label={`${labelPrefix} ${Math.min(current + 1, total)} of ${total}`}
    >
      {Array.from({ length: total }, (_, index) => {
        const state = index === current ? "active" : index < current ? "done" : "idle";
        const showLabel = labels && labels[index];
        return (
          <div key={index} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-label={`${labelPrefix} ${index + 1}`}
                  aria-current={state === "active" ? "step" : undefined}
                  className="group relative grid place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                >
                  {state === "done" ? (
                    <span
                      className="grid h-7 w-7 place-items-center rounded-full text-white"
                      style={{ backgroundColor: palette.done }}
                    >
                      <Check size={15} strokeWidth={3} />
                    </span>
                  ) : (
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-black transition-all ${
                        state === "active"
                          ? `scale-110 text-white ${reduced ? "" : "asd-pop-once"}`
                          : "bg-white"
                      }`}
                      style={{
                        borderColor: state === "active" ? palette.active : palette.idle,
                        backgroundColor: state === "active" ? palette.active : "#fff",
                        color: state === "idle" ? "#8B9C98" : "#fff",
                      }}
                    >
                      {index + 1}
                    </span>
                  )}
                  {showLabel && (
                    <span
                      className={`absolute top-full mt-1 hidden max-w-16 truncate text-[10px] font-semibold sm:block ${
                        state === "idle" ? "text-[#8B9C98]" : "text-[#0D9488]"
                      }`}
                    >
                      {showLabel}
                    </span>
                  )}
                </button>
              ) : (
                <span className="relative grid place-items-center" aria-hidden="true">
                  {state === "done" ? (
                    <span className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ backgroundColor: palette.done }}>
                      <Check size={15} strokeWidth={3} />
                    </span>
                  ) : (
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-black ${state === "active" ? "scale-110 text-white asd-pop-once" : "bg-white"}`}
                      style={{
                        borderColor: state === "active" ? palette.active : palette.idle,
                        backgroundColor: state === "active" ? palette.active : "#fff",
                        color: state === "idle" ? "#8B9C98" : "#fff",
                      }}
                    >
                      {index + 1}
                    </span>
                  )}
                </span>
              )}
            </div>
            {index < total - 1 && (
              <span
                aria-hidden="true"
                className="mx-1 h-1 flex-1 overflow-hidden rounded-full"
                style={{ backgroundColor: palette.idle, opacity: 0.7 }}
              >
                <motion.span
                  className="block h-full rounded-full"
                  style={{ backgroundColor: index < current ? palette.done : "#fff" }}
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: index < current ? "100%" : "0%" }}
                  transition={{ duration: reduced ? 0 : 0.4, ease: "easeOut" }}
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}