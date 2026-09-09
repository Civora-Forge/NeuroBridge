import { useReducedMotion } from "framer-motion";
import { useSensoryPreferences } from "@/stores/sensoryPreferencesStore";

/**
 * useSensoryReducedMotion — report whether motion should be disabled or softened.
 *
 * Combines the OS "prefers-reduced-motion" preference with the in-app sensory
 * setting (animation) so JS-driven animations degrade exactly like the
 * CSS-based ones in supportToolThemes.css. Reads from the shared reactive
 * store, so switching animation mode updates running components immediately.
 *
 * @returns {{ reduced: boolean, gentle: boolean }}
 *   reduced — disable movement entirely (fade-only, no travel).
 *   gentle  — allow motion but keep it short and subtle.
 */
export function useSensoryReducedMotion() {
  const osReduced = Boolean(useReducedMotion());
  const { animation } = useSensoryPreferences();

  const reduced = osReduced || animation === "off";
  const gentle = !reduced && animation === "reduced";

  return { reduced, gentle };
}