/**
 * presentationPresets.js — plain-language presets over the existing
 * sensory-preference axes (visualIntensity / animation / density) plus a
 * text-scale axis, so users choose "Make this simpler" instead of tuning
 * three separate jargon-labeled controls. The granular axes still exist
 * (SensorySettings exposes them under "Advanced") — presets just set all of
 * them at once to a known-good combination.
 */

export const PRESETS = {
  standard: {
    id: "standard",
    label: "Standard",
    description: "The regular NeuroBridge look.",
    values: { visualIntensity: "comfortable", animation: "normal", density: "standard", textScale: "normal" },
  },
  focus: {
    id: "focus",
    label: "Focus",
    description: "Fewer distractions while you work.",
    values: { visualIntensity: "simple", animation: "reduced", density: "simple", textScale: "normal" },
  },
  low_stimulation: {
    id: "low_stimulation",
    label: "Low-stimulation",
    description: "Minimal motion and muted visuals.",
    values: { visualIntensity: "simple", animation: "off", density: "simple", textScale: "normal" },
  },
  text_first: {
    id: "text_first",
    label: "Text-first",
    description: "Bigger text, simpler layout.",
    values: { visualIntensity: "simple", animation: "reduced", density: "simple", textScale: "large" },
  },
};

export const DEFAULT_PRESET_ID = "standard";

/** Given the current axis values, find the matching preset id, or null if custom. */
export function matchPresetId(values) {
  const entry = Object.values(PRESETS).find(
    (preset) =>
      preset.values.visualIntensity === values.visualIntensity &&
      preset.values.animation === values.animation &&
      preset.values.density === values.density &&
      preset.values.textScale === (values.textScale ?? "normal")
  );
  return entry?.id ?? null;
}
