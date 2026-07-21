/**
 * disorders.js  —  Single source of truth for supported neurodivergent conditions.
 *
 * Rules:
 *  • Never hardcode disorder strings outside this file.
 *  • Extend DISORDERS to add new conditions; nothing else should change.
 *  • DISORDER_META drives ALL UI labels, colours, and icons (sidebar, cards,
 *    onboarding selector, etc.).
 */

import {
  Brain, Zap, BookOpen, Calculator, Shield, Hand, Wind, Sparkles, Ear,
} from "lucide-react";

// ─────────────────────────────────────────────
//  Disorder enum (plain strings — JS-safe)
// ─────────────────────────────────────────────
export const DISORDERS = /** @type {const} */ ({
  OCD:         "ocd",
  ADHD:        "adhd",
  DYSLEXIA:    "dyslexia",
  DYSCALCULIA: "dyscalculia",
  DYSPRAXIA:   "dyspraxia",
  ASD:         "asd",
  ANXIETY:     "anxiety",
  DEPRESSION:   "depression",
  APD:         "apd",
});

// ─────────────────────────────────────────────
//  Rich metadata per disorder  (ordered by prevalence-rough estimate)
// ─────────────────────────────────────────────
export const DISORDER_META = {
  [DISORDERS.ADHD]: {
    label:       "ADHD",
    subtitle:    "Attention & Focus",
    description: "Tools for focus, emotional regulation, and executive function.",
    icon:        Zap,
    color:       "bg-mode-adhd",
    accent:      "text-amber-600",
    path:        "/adhd",
  },
  [DISORDERS.DYSLEXIA]: {
    label:       "Dyslexia",
    subtitle:    "Reading & Language",
    description: "Adaptive reading, phonics support, and word-bank training.",
    icon:        BookOpen,
    color:       "bg-mode-dyslexia",
    accent:      "text-blue-600",
    path:        "/dyslexia",
  },
  [DISORDERS.OCD]: {
    label:       "OCD",
    subtitle:    "Obsessive-Compulsive",
    description: "ERP hierarchy, ritual delay, thought journaling, and mindfulness.",
    icon:        Shield,
    color:       "bg-mode-ocd",
    accent:      "text-teal-600",
    path:        "/ocd",
  },
  [DISORDERS.DYSPRAXIA]: {
    label:       "Dyspraxia",
    subtitle:    "Motor Coordination",
    description: "Motor exercises, AR instructions, haptic pacing, and routine scheduling.",
    icon:        Hand,
    color:       "bg-mode-dyspraxia",
    accent:      "text-purple-600",
    path:        "/dyspraxia",
  },
  [DISORDERS.ASD]: {
    label:       "ASD",
    subtitle:    "Autism Spectrum",
    description: "Sensory tools, social scripts, and calming environments.",
    icon:        Brain,
    color:       "bg-mode-asd",
    accent:      "text-green-600",
    path:        "/asd",
  },
  [DISORDERS.ANXIETY]: {
    label:       "Anxiety",
    subtitle:    "Generalised Anxiety",
    description: "Breathing exercises, worry journaling, and grounding techniques.",
    icon:        Wind,
    color:       "bg-mode-anxiety",
    accent:      "text-sky-600",
    path:        "/anxiety",
  },
  [DISORDERS.DYSCALCULIA]: {
    label:       "Dyscalculia",
    subtitle:    "Numbers & Maths",
    description: "Visual number aids, step-by-step maths, and progress tracking.",
    icon:        Calculator,
    color:       "bg-mode-dyscalculia",
    accent:      "text-rose-600",
    path:        "/dyscalculia",
  },
  [DISORDERS.DEPRESSION]: {
    label:       "Depression",
    subtitle:    "Mental Health",
    description: "Mood tracking, thought journaling, and coping strategies.",
    icon:        Sparkles,
    color:       "bg-mode-depression",
    accent:      "text-fuchsia-600",
    path:        "/depression",
  },
  [DISORDERS.APD]: {
    label:       "APD",
    subtitle:    "Auditory Processing",
    description: "Audio clarity tools, speech-to-text, and listening exercises.",
    icon:        Ear,
    color:       "bg-mode-apd",
    accent:      "text-indigo-600",
    path:        "/apd",
  },
};

/** All disorder keys in display order. */
export const ALL_DISORDERS = Object.values(DISORDERS);

// ─────────────────────────────────────────────
//  Pure utility helpers
// ─────────────────────────────────────────────

/** @param {string[]} disorders @param {string} d */
export const hasDisorder = (disorders, d) =>
  Array.isArray(disorders) && disorders.includes(d);

/** @param {string[]} disorders @param {string} d */
export const addDisorder = (disorders, d) =>
  [...new Set([...(disorders ?? []), d])];

/** @param {string[]} disorders @param {string} d */
export const removeDisorder = (disorders, d) =>
  (disorders ?? []).filter((x) => x !== d);

/** Toggle a disorder in the array (add if absent, remove if present). */
export const toggleDisorder = (disorders, d) =>
  hasDisorder(disorders, d) ? removeDisorder(disorders, d) : addDisorder(disorders, d);
