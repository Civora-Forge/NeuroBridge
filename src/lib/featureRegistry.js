/**
 * featureRegistry.js  —  Central authority for feature availability.
 *
 * Rules:
 *  • Every feature MUST appear here.
 *  • "disorders" lists which conditions unlock the feature.
 *  • "modeConfig" (optional) records per-disorder behaviour differences so the
 *    same component can adapt without duplicating features.
 *  • resolveEnabledFeatures() is the ONLY place access decisions are made.
 *    Nothing else may gate features manually.
 */

import { DISORDERS } from "./disorders";

// ─────────────────────────────────────────────
//  Feature keys  (union of all valid strings)
// ─────────────────────────────────────────────
export const FEATURES = /** @type {const} */ ({
  // ── Top-level module landing pages ──────────
  OCD:          "ocd",
  ADHD:         "adhd",
  DYSLEXIA:     "dyslexia",
  DYSCALCULIA:  "dyscalculia",
  DYSPRAXIA:    "dyspraxia",
  ASD:          "asd",
  ANXIETY:      "anxiety",
  DEPRESSION:    "depression",
  APD:          "apd",

  // ── Depression sub-features ───────────────
  DEPRESSION_MVH:               "depression.mvh",
  DEPRESSION_ANXIETY_DISSOLVER: "depression.anxiety-dissolver",
  DEPRESSION_SOCIAL:            "depression.social-broadcaster",
  DEPRESSION_PROOF:             "depression.evidence-folder",
  DEPRESSION_REALITY:           "depression.cognitive-reframer",
  DEPRESSION_VOID:              "depression.void-whisper",

  // ── OCD sub-features (ERP Toolkit) ────────────
  OCD_ERP_TRACKER:      "ocd.erp-tracker",
  OCD_HIERARCHY:        "ocd.exposure-hierarchy",
  OCD_SUDS:             "ocd.suds-monitor",
  OCD_SESSION_TIMER:    "ocd.exposure-session",
  OCD_PROGRESS:         "ocd.progress",

  // ── ADHD sub-features ───────────────────────
  ADHD_FOCUS:     "adhd.focus-sessions",
  ADHD_EMOTION:   "adhd.emotion-coach",
  ADHD_TIMELINE:  "adhd.visual-timeline",
  ADHD_BREAKDOWN: "adhd.task-breakdown",
  ADHD_SOUNDS:    "adhd.soundscapes",
  ADHD_DOUBLING:  "adhd.body-doubling",

  // ── Dyslexia sub-features ───────────────────
  DYSLEXIA_READER:   "dyslexia.reader-mode",
  DYSLEXIA_WORDBANK: "dyslexia.word-bank",

  // ── Dyspraxia sub-features ──────────────────
  DYSPRAXIA_DECOMPOSE: "dyspraxia.task-decompose",
  DYSPRAXIA_MOTOR:     "dyspraxia.motor-exercises",
  DYSPRAXIA_BREAKDOWN: "dyspraxia.task-breakdown",
  DYSPRAXIA_ROUTINE:   "dyspraxia.routine-scheduler",
  DYSPRAXIA_SPATIAL:   "dyspraxia.spatial-trainer",
  DYSPRAXIA_MOOD:      "dyspraxia.mood-tracker",

  // ── ASD sub-features ────────────────────────
  ASD_ROUTINE:  "asd.routine",
  ASD_SENSORY:  "asd.sensory",
  ASD_STORIES:  "asd.stories",
  ASD_MELTDOWN: "asd.meltdown",
  ASD_EMOTION:  "asd.emotion",
});

// ─────────────────────────────────────────────
//  Feature registry
//
//  Each entry:
//    label:      Human-readable name (never shown as diagnosis)
//    disorders:  Which conditions unlock this feature
//    modeConfig: (optional) per-disorder behaviour overrides
// ─────────────────────────────────────────────
export const FEATURE_REGISTRY = {
  // ── Module roots ────────────────────────────
  [FEATURES.OCD]: {
    label: "OCD Support",
    disorders: [DISORDERS.OCD],
  },
  [FEATURES.ADHD]: {
    label: "Focus & Attention",
    disorders: [DISORDERS.ADHD],
  },
  [FEATURES.DYSLEXIA]: {
    label: "Reading Support",
    disorders: [DISORDERS.DYSLEXIA],
  },
  [FEATURES.DYSCALCULIA]: {
    label: "Number Support",
    disorders: [DISORDERS.DYSCALCULIA],
  },
  [FEATURES.DYSPRAXIA]: {
    label: "Motor Skills",
    disorders: [DISORDERS.DYSPRAXIA],
  },
  [FEATURES.ASD]: {
    label: "Sensory & Social",
    disorders: [DISORDERS.ASD],
  },
  [FEATURES.ANXIETY]: {
    label: "Anxiety Tools",
    disorders: [DISORDERS.ANXIETY],
    // Also unlocked for OCD users — anxiety management is clinically relevant
    // for ERP prep and generalised anxiety comorbidity.
  },
  [FEATURES.DEPRESSION]: {
    label: "Depression Support",
    disorders: [DISORDERS.DEPRESSION],
  },
  [FEATURES.APD]: {
    label: "Audio Support",
    disorders: [DISORDERS.APD],
  },

  // ── Depression sub-features ───────────────
  [FEATURES.DEPRESSION_MVH]: {
    label: "MVH Protocol",
    disorders: [DISORDERS.DEPRESSION],
  },
  [FEATURES.DEPRESSION_ANXIETY_DISSOLVER]: {
    label: "Anxiety Dissolver",
    disorders: [DISORDERS.DEPRESSION],
  },
  [FEATURES.DEPRESSION_SOCIAL]: {
    label: "Social Broadcaster",
    disorders: [DISORDERS.DEPRESSION],
  },
  [FEATURES.DEPRESSION_PROOF]: {
    label: "Evidence Folder",
    disorders: [DISORDERS.DEPRESSION],
  },
  [FEATURES.DEPRESSION_REALITY]: {
    label: "Cognitive Reframer",
    disorders: [DISORDERS.DEPRESSION],
  },
  [FEATURES.DEPRESSION_VOID]: {
    label: "Void Whisper",
    disorders: [DISORDERS.DEPRESSION],
  },

  // ── OCD sub-features (ERP Toolkit) ────────────
  [FEATURES.OCD_ERP_TRACKER]: {
    label: "ERP Exposure Tracker",
    disorders: [DISORDERS.OCD],
  },
  [FEATURES.OCD_HIERARCHY]: {
    label: "Exposure Hierarchy Builder",
    disorders: [DISORDERS.OCD],
  },
  [FEATURES.OCD_SUDS]: {
    label: "SUDS Anxiety Monitor",
    disorders: [DISORDERS.OCD],
  },
  [FEATURES.OCD_SESSION_TIMER]: {
    label: "Exposure Session Timer",
    disorders: [DISORDERS.OCD],
  },
  [FEATURES.OCD_PROGRESS]: {
    label: "ERP Progress Tracker",
    disorders: [DISORDERS.OCD],
  },

  // ── ADHD sub-features ───────────────────────
  [FEATURES.ADHD_FOCUS]: {
    label: "Focus Sessions",
    disorders: [DISORDERS.ADHD],
  },
  [FEATURES.ADHD_EMOTION]: {
    label: "Emotion Coach",
    disorders: [DISORDERS.ADHD],
    modeConfig: {
      [DISORDERS.ADHD]: { showImpulsivityTips: true },
      [DISORDERS.ASD]:  { showImpulsivityTips: false, showSensoryCheck: true },
    },
  },
  [FEATURES.ADHD_TIMELINE]: {
    label: "Visual Timeline",
    disorders: [DISORDERS.ADHD],
  },
  [FEATURES.ADHD_BREAKDOWN]: {
    label: "Task Breakdown",
    disorders: [DISORDERS.ADHD],
  },
  [FEATURES.ADHD_SOUNDS]: {
    label: "Focus Soundscapes",
    disorders: [DISORDERS.ADHD],
  },
  [FEATURES.ADHD_DOUBLING]: {
    label: "Body Doubling",
    disorders: [DISORDERS.ADHD],
  },

  // ── Dyslexia sub-features ───────────────────
  [FEATURES.DYSLEXIA_READER]: {
    label: "Reader Mode",
    disorders: [DISORDERS.DYSLEXIA],
  },
  [FEATURES.DYSLEXIA_WORDBANK]: {
    label: "Word Bank",
    disorders: [DISORDERS.DYSLEXIA],
  },

  // ── Dyspraxia sub-features ──────────────────
  [FEATURES.DYSPRAXIA_DECOMPOSE]: {
    label: "Task Decompose",
    disorders: [DISORDERS.DYSPRAXIA],
  },
  [FEATURES.DYSPRAXIA_MOTOR]: {
    label: "Motor Exercises",
    disorders: [DISORDERS.DYSPRAXIA],
  },
  [FEATURES.DYSPRAXIA_BREAKDOWN]: {
    label: "Task Breakdown",
    disorders: [DISORDERS.DYSPRAXIA],
  },
  [FEATURES.DYSPRAXIA_ROUTINE]: {
    label: "Routine Scheduler",
    disorders: [DISORDERS.DYSPRAXIA],
  },
  [FEATURES.DYSPRAXIA_SPATIAL]: {
    label: "Spatial Trainer",
    disorders: [DISORDERS.DYSPRAXIA],
  },
  [FEATURES.DYSPRAXIA_MOOD]: {
    label: "Mood Tracker",
    disorders: [DISORDERS.DYSPRAXIA],
  },

  // ── ASD sub-features ────────────────────────
  [FEATURES.ASD_ROUTINE]: {
    label: "Routine Visualizer",
    disorders: [DISORDERS.ASD],
  },
  [FEATURES.ASD_SENSORY]: {
    label: "Sensory Regulation",
    disorders: [DISORDERS.ASD],
  },
  [FEATURES.ASD_STORIES]: {
    label: "Social Story Builder",
    disorders: [DISORDERS.ASD],
  },
  [FEATURES.ASD_MELTDOWN]: {
    label: "Meltdown Prevention",
    disorders: [DISORDERS.ASD],
  },
  [FEATURES.ASD_EMOTION]: {
    label: "Emotional Check-in",
    disorders: [DISORDERS.ASD],
  },
};

// ─────────────────────────────────────────────
//  Core algorithm — O(F × D)
//
//  Pure function: no side effects, no imports from
//  React, no context reads.  Safe to call anywhere.
// ─────────────────────────────────────────────

/**
 * Resolve feature access from either explicit module IDs (preferred)
 * or disorder fallback (legacy support).
 *
 * @param {{ disorders?: string[], enabledModules?: string[] } | string[]} input
 * @returns {Set<string>}
 */
export function resolveEnabledFeatures(input) {
  const explicitModules = Array.isArray(input)
    ? []
    : Array.isArray(input?.enabledModules)
    ? input.enabledModules
    : [];

  if (explicitModules.length > 0) {
    const enabled = new Set();
    for (const moduleId of explicitModules) {
      if (FEATURE_REGISTRY[moduleId]) {
        enabled.add(moduleId);
      }
    }
    return enabled;
  }

  const disorders = Array.isArray(input) ? input : input?.disorders ?? [];
  const active = new Set(disorders ?? []);
  const enabled = new Set();

  for (const [key, config] of Object.entries(FEATURE_REGISTRY)) {
    if (config.disorders.some((d) => active.has(d))) {
      enabled.add(key);
    }
  }

  return enabled;
}

/**
 * Return the per-disorder mode config for a given feature + active disorder.
 * Useful inside a component to adapt behaviour without duplicating features.
 *
 * @param {string} featureKey
 * @param {string} disorder
 * @returns {Record<string, unknown> | null}
 */
export function getFeatureModeConfig(featureKey, disorder) {
  return FEATURE_REGISTRY[featureKey]?.modeConfig?.[disorder] ?? null;
}
