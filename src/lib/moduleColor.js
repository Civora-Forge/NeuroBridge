/**
 * moduleColor.js — maps a module/route to one of the `mode-*` Tailwind colors
 * (tailwind.config.js, backed by --mode-* in index.css), so navigation and
 * module cards use a consistent, meaningful color per support area instead
 * of one hardcoded brand gradient everywhere. Color here is decorative/
 * recognition support only — every screen that uses it also carries a text
 * label and icon, never color alone.
 *
 * Use the returned class names directly (`bg-mode-adhd/10`, `text-mode-ocd`,
 * `border-mode-anxiety/40`, ...) rather than hand-writing
 * `bg-[hsl(var(--mode-x)/0.1)]` — Tailwind's JIT parses that trailing
 * "/0.1)]" as an opacity-modifier suffix and silently drops the whole class.
 */

const ROUTE_TO_MODE = [
  ["/adhd", "adhd"],
  ["/dyslexia", "dyslexia"],
  ["/dyscalculia", "dyscalculia"],
  ["/ocd", "ocd"],
  ["/dyspraxia", "dyspraxia"],
  ["/apd", "apd"],
  ["/anxiety", "anxiety"],
  ["/depression", "depression"],
  ["/asd", "asd"],
  ["/communication", "asd"],
];

export function getModeKeyForRoute(route = "") {
  const match = ROUTE_TO_MODE.find(([prefix]) => route.startsWith(prefix));
  return match ? match[1] : "adhd"; // fall back to the primary accent, never leave a card colorless
}

/** Tailwind class names for a mode key, ready to drop into className strings. */
export function modeClasses(modeKey) {
  return {
    text: `text-mode-${modeKey}`,
    bg: `bg-mode-${modeKey}`,
    bgSoft: `bg-mode-${modeKey}/10`,
    bgSofter: `bg-mode-${modeKey}/5`,
    border: `border-mode-${modeKey}`,
    borderSoft: `border-mode-${modeKey}/35`,
    ring: `ring-mode-${modeKey}`,
  };
}

/** Legacy inline-style variant — prefer modeClasses() above for new code. */
export function modeStyles(modeKey) {
  const v = `hsl(var(--mode-${modeKey}))`;
  return {
    text: { color: v },
    bg: { backgroundColor: v },
    bgSoft: { backgroundColor: `hsl(var(--mode-${modeKey}) / 0.12)` },
    border: { borderColor: v },
    borderSoft: { borderColor: `hsl(var(--mode-${modeKey}) / 0.35)` },
    borderLeft: { borderLeftColor: v },
  };
}
