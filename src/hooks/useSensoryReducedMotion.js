import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * useSensoryReducedMotion — report whether motion should be disabled or softened.
 *
 * Combines the OS "prefers-reduced-motion" preference with the in-app sensory
 * setting (`document.documentElement.dataset.sensoryAnimation`, written by
 * SensorySettings) so JS-driven animations degrade exactly like the CSS-based
 * ones in supportToolThemes.css.
 *
 * @returns {{ reduced: boolean, gentle: boolean }}
 *   reduced — disable movement entirely (fade-only, no travel).
 *   gentle  — allow motion but keep it short and subtle.
 */
export function useSensoryReducedMotion() {
  const osReduced = Boolean(useReducedMotion());
  const [sensoryAnimation, setSensoryAnimation] = useState(
    () =>
      typeof document !== "undefined"
        ? document.documentElement.dataset.sensoryAnimation || "default"
        : "default",
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const el = document.documentElement;
    const update = () =>
      setSensoryAnimation(el.dataset.sensoryAnimation || "default");
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, {
      attributes: true,
      attributeFilter: ["data-sensory-animation"],
    });
    return () => observer.disconnect();
  }, []);

  const reduced = osReduced || sensoryAnimation === "off";
  const gentle = !reduced && sensoryAnimation === "reduced";

  return { reduced, gentle };
}