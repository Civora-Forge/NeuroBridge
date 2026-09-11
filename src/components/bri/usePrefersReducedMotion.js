import { useEffect, useState } from "react";

function computeReducedMotion() {
  const media =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  const sensoryOff =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("sensory-no-animation");
  return media || sensoryOff;
}

/**
 * Combines the OS-level prefers-reduced-motion media query with NeuroBridge's
 * own in-app "Low-stimulation/Focus" Animation preference (the
 * `sensory-no-animation` class toggled on <html> by SensorySettings) — a user
 * who already turned off motion at either level shouldn't see Bri animate.
 */
export default function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(computeReducedMotion);

  useEffect(() => {
    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(computeReducedMotion());
    mql?.addEventListener?.("change", update);

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      mql?.removeEventListener?.("change", update);
      observer.disconnect();
    };
  }, []);

  return reduced;
}
