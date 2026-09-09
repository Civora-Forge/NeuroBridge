/**
 * useASDVisualStyle.js + useASDPracticeCounts.js
 *
 * React adapters over the shared ASD presentation-personalization and
 * lightweight progress tracking. Both are stable, side-effect-light and safe
 * to call from any ASD feature.
 */

import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getVisualStylePresentation,
  readStoredVisualStyle,
  resolveVisualStyle,
  persistVisualStyle,
  VISUAL_STYLE_DEFAULT,
  VISUAL_STYLE_PRESENTATION,
} from "./asdVisualStyle";
import { readPracticeCounts, recordPracticeEvent, resetPracticeCounts } from "./asdProgressStore";

/**
 * Resolve the effective ASD visual style (from the profile when available,
 * otherwise the device-level preference, defaulting to "balanced").
 *
 * `setStyle` persists an override on the device, so a guardian can choose a
 * treatment for a learner without per-age implementations.
 *
 * @returns {{ style, presentation, styles, setStyle }}
 */
export function useASDVisualStyle() {
  const { user } = useAuth();
  const [storedStyle, setStoredStyle] = useState(() => readStoredVisualStyle() ?? "");

  const style = useMemo(
    () => resolveVisualStyle(user, storedStyle || null),
    [user, storedStyle],
  );

  const presentation = useMemo(() => getVisualStylePresentation(style), [style]);

  const styles = useMemo(() => Object.keys(VISUAL_STYLE_PRESENTATION), []);

  const setStyle = useCallback((next) => {
    const resolved = VISUAL_STYLE_PRESENTATION[next] ? next : VISUAL_STYLE_DEFAULT;
    if (persistVisualStyle(resolved)) {
      setStoredStyle(resolved);
    }
  }, []);

  return { style, presentation, styles, setStyle };
}

/**
 * Read the learner's real ASD practice counts for hub progress indicators.
 *
 * @returns {{ counts, recordEvent, reset }}
 */
export function useASDPracticeCounts(learnerId) {
  const [counts, setCounts] = useState(() => readPracticeCounts(learnerId));

  const recordEvent = useCallback(
    (event) => {
      recordPracticeEvent(learnerId, event);
      setCounts(readPracticeCounts(learnerId));
    },
    [learnerId],
  );

  const reset = useCallback(() => {
    resetPracticeCounts(learnerId);
    setCounts(readPracticeCounts(learnerId));
  }, [learnerId]);

  return { counts, recordEvent, reset };
}