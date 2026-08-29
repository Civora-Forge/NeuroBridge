/**
 * asdVisualStyle.js — shared presentation-personalization for the ASD surface.
 *
 * Target audience is roughly 10–20, so we avoid coding to a single treatment.
 * The presentation adapts subtly (shared components + small adjustments only)
 * based on:
 *
 *   1. An explicit user age / age-group when the profile exposes one
 *      (future-proof: `user.age`, `user.dateOfBirth`, `user.tagProfile.ageGroup`).
 *   2. A device-level "Look & tone" preference set via the ASD hub
 *      (`nb_asd_visual_style`). This is how it works today when no age is
 *      available and lets a guardian choose a treatment for the learner.
 *
 * It never forks into separate implementations — it only adjusts density,
 * sticker use, language playfulness and illustration strength.
 *
 * Ownership: ASD Experience Engineer
 */

export const VISUAL_STYLES = Object.freeze({
  YOUNGER: "younger",
  BALANCED: "balanced",
  OLDER: "older",
});

export const VISUAL_STYLE_DEFAULT = VISUAL_STYLES.BALANCED;

export const VISUAL_STYLE_STORAGE_KEY = "nb_asd_visual_style";

/** Small, shared presentation adjustments per style. Everything here is a
 *  boolean/percent so components can drop or soften decoration without
 *  duplicating code. */
export const VISUAL_STYLE_PRESENTATION = Object.freeze({
  younger: {
    id: "younger",
    label: "Younger look",
    description: "More illustrations and stickers, playful wording, stronger feedback.",
    playful: true,
    stickers: true,
    illustration: 1,
    gamified: true,
    bigControls: true,
  },
  balanced: {
    id: "balanced",
    label: "Balanced look",
    description: "A friendly but calm mix — recommended for ages 10–20.",
    playful: false,
    stickers: true,
    illustration: 0.5,
    gamified: true,
    bigControls: false,
  },
  older: {
    id: "older",
    label: "Clear look",
    description: "Cleaner layouts, fewer stickers, more mature wording.",
    playful: false,
    stickers: false,
    illustration: 0.2,
    gamified: false,
    bigControls: false,
  },
});

export function getVisualStylePresentation(style) {
  return VISUAL_STYLE_PRESENTATION[style] ?? VISUAL_STYLE_PRESENTATION[VISUAL_STYLE_DEFAULT];
}

function computeStyleFromUser(user) {
  if (!user) return null;

  const tagAgeGroup = user?.tagProfile?.ageGroup;
  if (tagAgeGroup === "child" || tagAgeGroup === "younger") return VISUAL_STYLES.YOUNGER;
  if (tagAgeGroup === "adult" || tagAgeGroup === "older") return VISUAL_STYLES.OLDER;

  if (Number.isFinite(user?.age)) {
    if (user.age <= 12) return VISUAL_STYLES.YOUNGER;
    if (user.age >= 18) return VISUAL_STYLES.OLDER;
    return VISUAL_STYLES.BALANCED;
  }

  if (user?.dateOfBirth) {
    const birth = new Date(user.dateOfBirth);
    if (!Number.isNaN(birth.getTime())) {
      const age = new Date().getFullYear() - birth.getFullYear();
      if (age <= 12) return VISUAL_STYLES.YOUNGER;
      if (age >= 18) return VISUAL_STYLES.OLDER;
      return VISUAL_STYLES.BALANCED;
    }
  }

  return null;
}

function readStoredStyle() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VISUAL_STYLE_STORAGE_KEY);
    return VISUAL_STYLE_PRESENTATION[raw] ? raw : null;
  } catch {
    return null;
  }
}

/** Resolve the effective visual style for a user + stored preference. */
export function resolveVisualStyle(user, stored = null) {
  const fromUser = computeStyleFromUser(user);
  if (VISUAL_STYLE_PRESENTATION[stored]) {
    return stored;
  }
  return fromUser ?? VISUAL_STYLE_DEFAULT;
}

/** Persist a "Look & tone" override on this device. Returns true on success. */
export function persistVisualStyle(style) {
  if (typeof window === "undefined" || !VISUAL_STYLE_PRESENTATION[style]) return false;
  try {
    window.localStorage.setItem(VISUAL_STYLE_STORAGE_KEY, style);
    return true;
  } catch {
    return false;
  }
}

export function readStoredVisualStyle() {
  return readStoredStyle();
}