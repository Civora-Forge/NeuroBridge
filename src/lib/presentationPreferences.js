/**
 * The actual apply-a-preset side effect (localStorage + <html> data
 * attributes), factored out of SensorySettings.jsx so the agent can apply a
 * preset from ANY page — not just while SensorySettings happens to be
 * mounted. Same storage key, same effect, so a change made one way is
 * immediately visible the other way (SensorySettings listens for
 * PREFERENCES_CHANGED_EVENT and resyncs its own display).
 */
import { PRESETS } from "./presentationPresets";

const STORAGE_KEY = "neurobridge-sensory-preferences";
export const PREFERENCES_CHANGED_EVENT = "neurobridge:presentation-preferences-changed";

const DEFAULTS = {
  visualIntensity: "comfortable",
  animation: "normal",
  density: "standard",
  textScale: "normal",
};

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function savePreferences(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* best-effort only */
  }
}

function applyToDocument(prefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.sensoryVisual = prefs.visualIntensity;
  root.dataset.sensoryAnimation = prefs.animation;
  root.dataset.sensoryDensity = prefs.density;
  root.dataset.sensoryTextScale = prefs.textScale ?? "normal";
  root.classList.toggle("sensory-no-animation", prefs.animation === "off");
}

/** Applies a known preset id globally. Returns the resulting preference
 * object, or null if presetId isn't recognized (never throws/crashes on a
 * bad id — the backend tool already validates it, this is a second, cheap
 * safety net). */
export function applyPresetGlobally(presetId) {
  const preset = PRESETS[presetId];
  if (!preset) return null;
  const next = { ...preset.values };
  savePreferences(next);
  applyToDocument(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED_EVENT, { detail: next }));
  }
  return next;
}

export { DEFAULTS as PRESENTATION_DEFAULTS };
