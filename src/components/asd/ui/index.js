/**
 * ASD UI kit — shared visual primitives for the ASD surface.
 *
 * Every ASD feature consumes these so the module reads as one coherent,
 * friendly language while each tool keeps its own identity via tone + layout.
 */

export { AsdCharacter, getCharacterToneForScenarios } from "./AsdCharacter";
export { AsdCard, asdToneText } from "./AsdCard";
export { AsdProgressDots, AsdProgressBar, AsdProgressRing } from "./AsdProgress";
export { AsdFeedback, AsdCelebration } from "./AsdFeedback";
export { AsdChip, AsdSticker } from "./AsdChip";
export { AsdVisualStyleSelector } from "./AsdVisualStyleSelector";
export { useASDVisualStyle, useASDPracticeCounts } from "./useASDVisualStyle";
export {
  VISUAL_STYLES,
  VISUAL_STYLE_DEFAULT,
  VISUAL_STYLE_PRESENTATION,
  resolveVisualStyle,
  persistVisualStyle,
} from "./asdVisualStyle";
export {
  PROGRESS_EVENTS,
  STORAGE_KEYS,
  readPracticeCounts,
  recordPracticeEvent,
  resetPracticeCounts,
} from "./asdProgressStore";