/**
 * usePersonalizationProfile.js — React binding for the personalization
 * profile store (Task 5).
 *
 * Loads the signed-in user's profile once (local copy first, then the account
 * copy), re-syncs when the device comes back online, and exposes the explicit
 * user controls. All components share one store, so the settings panel and
 * the adaptive runtime always see the same profile.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  clearExplicitPreference,
  clearTemporaryPreferences,
  forgetLearnedPreference,
  getProfileSnapshot,
  loadProfile,
  resetLearnedPersonalization,
  resetPersonalizationProfile,
  setExplicitPreference,
  setTemporaryPreference,
  subscribeProfile,
  syncProfile,
  undoLastProfileChange,
} from "./profileStore.js";

export function usePersonalizationProfile(userId) {
  const subscribe = useCallback((listener) => subscribeProfile(userId, listener), [userId]);
  const getSnapshot = useCallback(() => getProfileSnapshot(userId), [userId]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!userId) return undefined;
    if (!getProfileSnapshot(userId).profile) loadProfile(userId);
    const onOnline = () => syncProfile(userId);
    if (typeof window !== "undefined") window.addEventListener("online", onOnline);
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
    };
  }, [userId]);

  const actions = useMemo(
    () => ({
      setPreference: (field, value, options) => setExplicitPreference(userId, field, value, options),
      clearPreference: (field, options) => clearExplicitPreference(userId, field, options),
      forgetLearned: (key, options) => forgetLearnedPreference(userId, key, options),
      undo: () => undoLastProfileChange(userId),
      resetLearned: () => resetLearnedPersonalization(userId),
      resetAll: () => resetPersonalizationProfile(userId),
      setTemporary: (field, value, options) => setTemporaryPreference(userId, field, value, options),
      clearTemporary: () => clearTemporaryPreferences(userId),
      sync: () => syncProfile(userId),
    }),
    [userId],
  );

  return { ...snapshot, ...actions };
}
