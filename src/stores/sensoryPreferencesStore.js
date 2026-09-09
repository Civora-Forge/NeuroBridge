/**
 * sensoryPreferencesStore.js — the single reactive source for the in-app
 * sensory preferences (Visual intensity / Animation / Interface density).
 *
 * It is not a second settings system: the same localStorage key
 * (`neurobridge-sensory-preferences`) remains the durable source of truth and
 * the same DOM attributes keep driving CSS. This store adds a live in-memory
 * layer so every subscriber (SensorySettings and any JS consumer) re-renders
 * the moment a preference changes — no page refresh, no remount.
 *
 * NOTE (root cause fix): the attributes written here match exactly what the
 * CSS expects (`data-sensory-visual-intensity`). SensorySettings previously
 * wrote `data-sensory-visual`, so Visual intensity rules never applied.
 *
 * Ownership: ASD Experience Engineer
 */

import { create } from "zustand";

export const SENSORY_PREFERENCES_STORAGE_KEY = "neurobridge-sensory-preferences";

export const SENSORY_PREFERENCES_DEFAULTS = {
  visualIntensity: "comfortable",
  animation: "normal",
  density: "standard",
};

export function loadSensoryPreferences() {
  try {
    const raw = localStorage.getItem(SENSORY_PREFERENCES_STORAGE_KEY);
    return raw ? { ...SENSORY_PREFERENCES_DEFAULTS, ...JSON.parse(raw) } : { ...SENSORY_PREFERENCES_DEFAULTS };
  } catch {
    return { ...SENSORY_PREFERENCES_DEFAULTS };
  }
}

function saveSensoryPreferences(prefs) {
  try {
    localStorage.setItem(SENSORY_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* silent */
  }
}

/** Mirror preferences onto <html> data attributes so CSS responds instantly. */
export function applySensoryAttributes(prefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.sensoryVisualIntensity = prefs.visualIntensity;
  root.dataset.sensoryVisual = prefs.visualIntensity; // legacy alias
  root.dataset.sensoryAnimation = prefs.animation;
  root.dataset.sensoryDensity = prefs.density;
  root.classList.toggle("sensory-no-animation", prefs.animation === "off");
}

export const useSensoryPreferencesStore = create((set) => ({
  prefs: loadSensoryPreferences(),
  setPreference: (key, value) =>
    set((state) => {
      const next = { ...state.prefs, [key]: value };
      saveSensoryPreferences(next);
      applySensoryAttributes(next);
      return { prefs: next };
    }),
  reload: () => {
    const prefs = loadSensoryPreferences();
    applySensoryAttributes(prefs);
    return set({ prefs });
  },
  _clear: () => set({ prefs: { ...SENSORY_PREFERENCES_DEFAULTS } }),
}));

/** Apply persisted preferences on first load so features start correctly. */
if (typeof document !== "undefined") {
  applySensoryAttributes(loadSensoryPreferences());
}

/** Keep in-memory state in sync when another tab updates the same settings. */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SENSORY_PREFERENCES_STORAGE_KEY) {
      useSensoryPreferencesStore.getState().reload();
    }
  });
}

/** React hook exposing the current preferences and a single setter. */
export function useSensoryPreferences() {
  const prefs = useSensoryPreferencesStore((state) => state.prefs);
  const setPreference = useSensoryPreferencesStore((state) => state.setPreference);
  return { ...prefs, setPreference };
}