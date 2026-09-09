/**
 * useASDVisualStyle.js + useASDPracticeCounts.js
 *
 * React adapters over the shared ASD presentation-personalization and
 * lightweight progress tracking. Both are stable, side-effect-light and safe
 * to call from any ASD feature.
 *
 * Both hooks now read from shared reactive zustand stores so every subscriber
 * (hub, AsdVisualRoot, feature cards) sees changes immediately — a Look & tone
 * change or a completed activity never requires a page refresh.
 */

import { useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getVisualStylePresentation,
  resolveVisualStyle,
  VISUAL_STYLE_PRESENTATION,
} from "./asdVisualStyle";
import useAsdVisualStyleStore from "@/stores/asdVisualStyleStore";
import useAsdPracticeStore from "@/stores/asdPracticeStore";
import { readPracticeCounts } from "./asdProgressStore";

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
  const storedStyle = useAsdVisualStyleStore((state) => state.style);
  const setStyle = useAsdVisualStyleStore((state) => state.setStyle);

  const style = useMemo(() => resolveVisualStyle(user, storedStyle || null), [user, storedStyle]);

  const presentation = useMemo(() => getVisualStylePresentation(style), [style]);

  const styles = useMemo(() => Object.keys(VISUAL_STYLE_PRESENTATION), []);

  return { style, presentation, styles, setStyle };
}

/**
 * Read the learner's real ASD practice counts for hub progress indicators.
 *
 * Backed by a shared reactive store: `recordEvent` updates every subscriber
 * reading the same learner immediately (optimistic update + persist +
 * reconcile), so hub progress reflects completions from any feature without a
 * refresh or remount.
 *
 * @returns {{ counts, recordEvent, reset }}
 */
export function useASDPracticeCounts(learnerId) {
  const ensure = useAsdPracticeStore((state) => state.ensure);

  useEffect(() => {
    ensure(learnerId);
  }, [ensure, learnerId]);

  const ensuredCounts = useAsdPracticeStore((state) => state.countsByLearner[learnerId]);
  const counts = ensuredCounts ?? readPracticeCounts(learnerId);

  const recordEvent = useCallback(
    (event) => useAsdPracticeStore.getState().recordEvent(learnerId, event),
    [learnerId],
  );

  const reset = useCallback(
    () => useAsdPracticeStore.getState().reset(learnerId),
    [learnerId],
  );

  return { counts, recordEvent, reset };
}