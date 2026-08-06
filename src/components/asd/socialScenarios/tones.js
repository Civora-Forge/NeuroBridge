/**
 * tones.js — Per-category color system for the Social Scenario Simulator,
 * mirroring the Routine Visualizer's colored task-card style.
 */

export const CATEGORY_TONES = {
  college: {
    bg: "bg-blue-100 dark:bg-blue-950/50",
    border: "border-blue-300 dark:border-blue-700",
    accent: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-300",
    soft: "bg-blue-50 dark:bg-blue-950/30",
    ring: "ring-blue-400/50",
    button: "bg-blue-600 hover:bg-blue-700",
    gradient: "from-blue-500 to-cyan-400",
  },
  workplace: {
    bg: "bg-violet-100 dark:bg-violet-950/50",
    border: "border-violet-300 dark:border-violet-700",
    accent: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    soft: "bg-violet-50 dark:bg-violet-950/30",
    ring: "ring-violet-400/50",
    button: "bg-violet-600 hover:bg-violet-700",
    gradient: "from-violet-500 to-purple-400",
  },
  daily_life: {
    bg: "bg-amber-100 dark:bg-amber-950/50",
    border: "border-amber-300 dark:border-amber-700",
    accent: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    soft: "bg-amber-50 dark:bg-amber-950/30",
    ring: "ring-amber-400/50",
    button: "bg-amber-500 hover:bg-amber-600",
    gradient: "from-amber-500 to-orange-400",
  },
  relationships: {
    bg: "bg-pink-100 dark:bg-pink-950/50",
    border: "border-pink-300 dark:border-pink-700",
    accent: "bg-pink-500",
    text: "text-pink-700 dark:text-pink-300",
    soft: "bg-pink-50 dark:bg-pink-950/30",
    ring: "ring-pink-400/50",
    button: "bg-pink-600 hover:bg-pink-700",
    gradient: "from-pink-500 to-rose-400",
  },
};

export const CATEGORY_EMOJI = {
  college: "🎓",
  workplace: "💼",
  daily_life: "🛒",
  relationships: "💬",
};

export const DIFFICULTY_TONE = {
  easy: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", button: "bg-emerald-600 hover:bg-emerald-700", label: "Easy" },
  medium: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", button: "bg-amber-500 hover:bg-amber-600", label: "Medium" },
  hard: { badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300", button: "bg-rose-600 hover:bg-rose-700", label: "Hard" },
};

export function toneFor(scenario) {
  return CATEGORY_TONES[scenario?.category] ?? CATEGORY_TONES.college;
}
