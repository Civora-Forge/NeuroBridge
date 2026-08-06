/**
 * useAccessibilitySettings.js — Accessibility controls for the Social Scenario
 * Simulator: large text, reduced motion, focus indicators and screen-reader
 * awareness. Settings merge the user's saved preferences with the user's
 * accessibility profile and persist per user in localStorage.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_A11Y_SETTINGS,
  SCENARIO_A11Y_STORAGE_KEY_PREFIX,
} from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";

function storageKeyFor(userId) {
  return `${SCENARIO_A11Y_STORAGE_KEY_PREFIX}${userId ?? "guest"}`;
}

function loadSettings(user) {
  const merged = { ...DEFAULT_A11Y_SETTINGS };
  const profile = user?.accessibility;
  if (profile) {
    if (profile.reduceMotion === true) merged.reduceMotion = true;
    if (profile.screenReader === true) merged.screenReader = true;
  }
  try {
    const raw = localStorage.getItem(storageKeyFor(user?.id));
    if (raw) {
      Object.assign(merged, JSON.parse(raw));
    }
  } catch {
    // ignore storage errors
  }
  return merged;
}

export function useAccessibilitySettings(user) {
  const [settings, setSettings] = useState(() => loadSettings(user));

  useEffect(() => {
    setSettings(loadSettings(user));
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKeyFor(user?.id),
        JSON.stringify({
          largeText: settings.largeText,
          reduceMotion: settings.reduceMotion,
          focusIndicators: settings.focusIndicators,
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [settings, user]);

  const setPreference = useCallback((key, value) => {
    setSettings((current) => ({ ...current, [key]: Boolean(value) }));
  }, []);

  const toggle = useCallback(
    (key) => setPreference(key, !settings[key]),
    [settings, setPreference],
  );

  return useMemo(
    () => ({
      settings,
      largeText: settings.largeText,
      reduceMotion: settings.reduceMotion,
      focusIndicators: settings.focusIndicators,
      screenReader: settings.screenReader,
      setPreference,
      toggleLargeText: () => toggle("largeText"),
      toggleReduceMotion: () => toggle("reduceMotion"),
      toggleFocusIndicators: () => toggle("focusIndicators"),
    }),
    [settings, setPreference, toggle],
  );
}
