/**
 * profileModel.test.js — Task 5 personalization profile model
 */

import { describe, expect, it } from "vitest";
import {
  PROFILE_CONFIG,
  createProfile,
  describeProfile,
  forgetLearnedPreference,
  isPreferenceKnown,
  mergeProfiles,
  promoteLearnedPreferences,
  resetLearnedPersonalization,
  resetProfile,
  resolveProfileView,
  sanitizeProfile,
  setExplicitPreference,
  summarizeFeedbackForProfile,
  undoLastChange,
} from "../profileModel.js";

const USER = "profile-user";
const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const LOW_STIM = "UI:low_stimulation";

const summary = (score, extra = {}) => ({
  key: LOW_STIM,
  scope: "global",
  score,
  confidence: 0.8,
  evidenceCount: 6,
  sufficient: true,
  ...extra,
});
const globalSummaries = (entries) => ({ global: entries, contexts: {} });

/** Two promotion checks across the stability window. */
function promoteTwice(profile, summaries, at = NOW) {
  const first = promoteLearnedPreferences(profile, summaries, { now: at }).profile;
  return promoteLearnedPreferences(first, summaries, { now: at + PROFILE_CONFIG.promote.minStableMs });
}

let eventId = 0;
const event = (outcome, { key = LOW_STIM, moduleId = "generic", at = NOW } = {}) => ({
  id: `${key}|e${(eventId += 1)}`,
  key,
  outcome,
  moduleId,
  decisionId: null,
  at,
});

describe("profile creation and structure", () => {
  it("creates an empty, separated profile", () => {
    const profile = createProfile(USER, NOW);
    expect(profile).toMatchObject({ userId: USER, revision: 0, resets: { explicitAt: 0, learnedAt: 0 } });
    expect(profile.explicit).toEqual({ global: {}, contexts: {} });
    expect(profile.learned).toEqual({ global: {}, contexts: {} });
    expect(Object.keys(profile).sort()).toEqual(
      ["candidates", "explicit", "history", "learned", "resets", "revision", "schemaVersion", "updatedAt", "userId"].sort(),
    );
  });

  it("sanitization drops unknown fields, foreign users and anything outside the vocabulary", () => {
    const raw = {
      ...createProfile(USER, NOW),
      diagnosis: "adhd",
      temporary: { global: { motion: { value: "reduced" } } },
      explicit: {
        global: {
          informationDensity: { value: "minimal", setAt: NOW },
          diagnosis: { value: "adhd", setAt: NOW },
          guidancePace: { value: "lightning", setAt: NOW },
        },
        contexts: { "bad module id!": { motion: { value: "reduced", setAt: NOW } } },
      },
      learned: { global: { "not a key": { stance: "favoured", updatedAt: NOW } }, contexts: {} },
    };
    const clean = sanitizeProfile(raw, USER, NOW);
    expect(clean.explicit.global).toEqual({ informationDensity: { value: "minimal", setAt: NOW } });
    expect(clean.explicit.contexts).toEqual({});
    expect(clean.learned.global).toEqual({});
    expect(clean).not.toHaveProperty("diagnosis");
    expect(clean).not.toHaveProperty("temporary");
    expect(sanitizeProfile(raw, "someone-else", NOW).explicit.global).toEqual({});
  });

  it("rejects explicit fields or values outside the vocabulary", () => {
    const profile = createProfile(USER, NOW);
    expect(() => setExplicitPreference(profile, "diagnosis", "adhd")).toThrow(TypeError);
    expect(() => setExplicitPreference(profile, "guidancePace", "lightning")).toThrow(TypeError);
    expect(() => setExplicitPreference(profile, "mode:overwhelm_support", "avoided")).toThrow(TypeError);
  });
});

describe("explicit preferences", () => {
  it("context-specific values win, with global fallback elsewhere", () => {
    let profile = createProfile(USER, NOW);
    profile = setExplicitPreference(profile, "explanationLength", "short", { now: NOW });
    profile = setExplicitPreference(profile, "explanationLength", "thorough", { moduleId: "dyslexia.reader", now: NOW + 1 });
    expect(resolveProfileView(profile, { moduleId: "dyslexia.reader" }).preferences.explanationLength).toEqual({
      value: "thorough",
      source: "explicit",
      scope: "context",
    });
    expect(resolveProfileView(profile, { moduleId: "support.focus_session" }).preferences.explanationLength).toMatchObject({
      value: "short",
      scope: "global",
    });
    // Clearing the context value falls back to the global one.
    profile = setExplicitPreference(profile, "explanationLength", null, { moduleId: "dyslexia.reader", now: NOW + 2 });
    expect(resolveProfileView(profile, { moduleId: "dyslexia.reader" }).preferences.explanationLength.value).toBe("short");
  });

  it("knows which preferences are already set (no need to ask again)", () => {
    const profile = setExplicitPreference(createProfile(USER, NOW), "notificationLevel", "essential", { now: NOW });
    const view = resolveProfileView(profile);
    expect(isPreferenceKnown(view, "notificationLevel")).toBe(true);
    expect(isPreferenceKnown(view, "guidancePace")).toBe(false);
  });

  it("changes are reversible with undo", () => {
    let profile = setExplicitPreference(createProfile(USER, NOW), "guidancePace", "slow", { now: NOW });
    profile = setExplicitPreference(profile, "guidancePace", "brisk", { now: NOW + 1 });
    profile = undoLastChange(profile, { now: NOW + 2 });
    expect(resolveProfileView(profile).preferences.guidancePace.value).toBe("slow");
    profile = undoLastChange(profile, { now: NOW + 3 });
    expect(resolveProfileView(profile).preferences.guidancePace).toBeUndefined();
    expect(describeProfile(profile).undo).toBeNull();
  });

  it("presentation derives from explicit preferences and avoided patterns", () => {
    let profile = createProfile(USER, NOW);
    profile = setExplicitPreference(profile, "avoid:animations", true, { now: NOW });
    profile = setExplicitPreference(profile, "avoid:unrequested_offers", true, { now: NOW });
    profile = setExplicitPreference(profile, "mode:calm_visuals", "avoided", { now: NOW });
    const view = resolveProfileView(profile);
    expect(view.presentation).toMatchObject({ reduceMotion: true, allowUnrequestedOffers: false });
    expect(view.supportModes.avoided).toEqual([{ mode: "calm_visuals", scope: "global" }]);
  });
});

describe("temporary contextual state", () => {
  it("outranks stable preferences while active but is never part of the profile", () => {
    const profile = setExplicitPreference(createProfile(USER, NOW), "motion", "standard", { now: NOW });
    const temporary = { global: { motion: { value: "reduced", expiresAt: NOW + HOUR } }, contexts: {} };
    const view = resolveProfileView(profile, { now: NOW, temporary });
    expect(view.preferences.motion).toEqual({ value: "reduced", source: "temporary", scope: "global" });
    expect(JSON.stringify(profile)).not.toMatch(/reduced/);
    // Expired temporary state no longer applies.
    expect(resolveProfileView(profile, { now: NOW + 2 * HOUR, temporary }).preferences.motion.value).toBe("standard");
  });

  it("cannot be smuggled in through sanitization or merge", () => {
    const withTemp = { ...createProfile(USER, NOW), temporary: { global: { motion: { value: "reduced" } } } };
    const clean = sanitizeProfile(withTemp, USER, NOW);
    expect(mergeProfiles(clean, clean)).not.toHaveProperty("temporary");
  });
});

describe("learned preference promotion", () => {
  it("requires sufficient, confident, stable evidence across checks", () => {
    const profile = createProfile(USER, NOW);
    // Insufficient evidence: nothing happens.
    const weak = promoteLearnedPreferences(profile, globalSummaries({ [LOW_STIM]: summary(0.9, { sufficient: false }) }), { now: NOW });
    expect(weak.changed).toBe(false);
    // First qualifying observation only creates a candidate.
    const first = promoteLearnedPreferences(profile, globalSummaries({ [LOW_STIM]: summary(0.9) }), { now: NOW });
    expect(first.promoted).toEqual([]);
    expect(resolveProfileView(first.profile, { now: NOW }).learned).toEqual({});
    // Too soon: still not promoted.
    const soon = promoteLearnedPreferences(first.profile, globalSummaries({ [LOW_STIM]: summary(0.9) }), { now: NOW + HOUR });
    expect(soon.promoted).toEqual([]);
    // After the stability window: promoted.
    const later = promoteLearnedPreferences(soon.profile, globalSummaries({ [LOW_STIM]: summary(0.9) }), {
      now: NOW + PROFILE_CONFIG.promote.minStableMs,
    });
    expect(later.promoted).toEqual([LOW_STIM]);
    expect(resolveProfileView(later.profile).learned[LOW_STIM]).toMatchObject({ stance: "favoured", scope: "global" });
  });

  it("never touches explicit preferences", () => {
    const profile = setExplicitPreference(createProfile(USER, NOW), "mode:calm_visuals", "avoided", { now: NOW });
    const { profile: promoted } = promoteTwice(profile, globalSummaries({ [LOW_STIM]: summary(0.95) }));
    expect(promoted.explicit).toEqual(profile.explicit);
    const view = resolveProfileView(promoted);
    expect(view.supportModes.avoided).toEqual([{ mode: "calm_visuals", scope: "global" }]);
  });

  it("does not oscillate: hysteresis band, no direct flip, cooldown after demotion", () => {
    let { profile } = promoteTwice(createProfile(USER, NOW), globalSummaries({ [LOW_STIM]: summary(0.9) }));
    let t = NOW + DAY;
    // Inside the hysteresis band (0.6..0.75): kept.
    profile = promoteLearnedPreferences(profile, globalSummaries({ [LOW_STIM]: summary(0.65) }), { now: t }).profile;
    expect(resolveProfileView(profile, { now: t }).learned[LOW_STIM].stance).toBe("favoured");
    // Opposite evidence: demoted, not flipped.
    t += HOUR;
    const demotion = promoteLearnedPreferences(profile, globalSummaries({ [LOW_STIM]: summary(0.1) }), { now: t });
    expect(demotion.demoted).toEqual([LOW_STIM]);
    profile = demotion.profile;
    expect(resolveProfileView(profile, { now: t }).learned).toEqual({});
    // Cooldown: strong opposite evidence cannot be promoted yet.
    const blocked = promoteTwice(profile, globalSummaries({ [LOW_STIM]: summary(0.1) }), t + HOUR);
    expect(resolveProfileView(blocked.profile, { now: t + DAY }).learned).toEqual({});
    // After the cooldown it can re-qualify through the stability window.
    const after = promoteTwice(profile, globalSummaries({ [LOW_STIM]: summary(0.1) }), t + PROFILE_CONFIG.demotionCooldownMs);
    expect(resolveProfileView(after.profile, { now: t + PROFILE_CONFIG.demotionCooldownMs + DAY }).learned[LOW_STIM].stance).toBe("avoided");
  });

  it("never learns to avoid protected (distress) support", () => {
    const key = "UI:overwhelm_simplification";
    const { profile } = promoteTwice(createProfile(USER, NOW), globalSummaries({ [key]: summary(0.05, { key }) }));
    expect(resolveProfileView(profile).learned).toEqual({});
  });

  it("learned stances expire unless re-confirmed (recency)", () => {
    const { profile } = promoteTwice(createProfile(USER, NOW), globalSummaries({ [LOW_STIM]: summary(0.9) }));
    expect(resolveProfileView(profile, { now: NOW + 30 * DAY }).learned[LOW_STIM]).toBeDefined();
    expect(resolveProfileView(profile, { now: NOW + PROFILE_CONFIG.learnedTtlMs + DAY }).learned).toEqual({});
  });

  it("promotes context-specific stances with global fallback", () => {
    const summaries = {
      global: {},
      contexts: { "dyslexia.reader": { [LOW_STIM]: summary(0.1, { scope: "context" }) } },
    };
    const { profile } = promoteTwice(createProfile(USER, NOW), summaries);
    expect(resolveProfileView(profile, { moduleId: "dyslexia.reader" }).learned[LOW_STIM]).toMatchObject({ stance: "avoided", scope: "context" });
    expect(resolveProfileView(profile, { moduleId: "support.focus_session" }).learned).toEqual({});
  });

  it("summarizes real Task 4 feedback and ignores evidence before a reset or forget", () => {
    const events = Array.from({ length: 6 }, () => event("accepted", { at: NOW - HOUR }));
    let profile = createProfile(USER, NOW);
    expect(summarizeFeedbackForProfile(profile, events, { now: NOW }).global[LOW_STIM]).toMatchObject({ sufficient: true });
    profile = resetLearnedPersonalization(profile, { now: NOW - 1 });
    expect(summarizeFeedbackForProfile(profile, events, { now: NOW }).global).toEqual({});

    const promoted = promoteTwice(createProfile(USER, NOW), globalSummaries({ [LOW_STIM]: summary(0.9) })).profile;
    const forgotten = forgetLearnedPreference(promoted, LOW_STIM, { now: NOW + DAY });
    expect(resolveProfileView(forgotten, { now: NOW + DAY }).learned).toEqual({});
    expect(summarizeFeedbackForProfile(forgotten, events, { now: NOW + DAY }).global).toEqual({});
    // Forgetting is reversible.
    expect(resolveProfileView(undoLastChange(forgotten, { now: NOW + DAY + 1 }), { now: NOW + DAY }).learned[LOW_STIM].stance).toBe("favoured");
  });
});

describe("resets", () => {
  it("reset learned keeps explicit; reset all clears everything", () => {
    let profile = setExplicitPreference(createProfile(USER, NOW), "guidancePace", "slow", { now: NOW });
    profile = promoteTwice(profile, globalSummaries({ [LOW_STIM]: summary(0.9) })).profile;
    const learnedReset = resetLearnedPersonalization(profile, { now: NOW + DAY });
    expect(resolveProfileView(learnedReset).learned).toEqual({});
    expect(resolveProfileView(learnedReset).preferences.guidancePace.value).toBe("slow");
    const full = resetProfile(profile, { now: NOW + DAY });
    expect(resolveProfileView(full).preferences).toEqual({});
    expect(resolveProfileView(full).learned).toEqual({});
    expect(full.history).toEqual([]);
  });
});

describe("conflicting updates (merge)", () => {
  it("field-level last-writer-wins, commutative and idempotent", () => {
    const base = createProfile(USER, NOW);
    const deviceA = setExplicitPreference(base, "guidancePace", "slow", { now: NOW + 10 });
    let deviceB = setExplicitPreference(base, "guidancePace", "brisk", { now: NOW + 20 });
    deviceB = setExplicitPreference(deviceB, "motion", "reduced", { now: NOW + 5 });
    const ab = mergeProfiles(deviceA, deviceB);
    const ba = mergeProfiles(deviceB, deviceA);
    expect(ab.explicit).toEqual(ba.explicit);
    expect(resolveProfileView(ab).preferences).toMatchObject({ guidancePace: { value: "brisk" }, motion: { value: "reduced" } });
    expect(mergeProfiles(ab, ab).explicit).toEqual(ab.explicit);
  });

  it("a stale device cannot resurrect data the user reset", () => {
    const stale = setExplicitPreference(createProfile(USER, NOW), "guidancePace", "slow", { now: NOW });
    const reset = resetProfile(stale, { now: NOW + DAY });
    const merged = mergeProfiles(stale, reset);
    expect(resolveProfileView(merged).preferences).toEqual({});
    // A change made after the reset survives.
    const fresh = setExplicitPreference(reset, "motion", "reduced", { now: NOW + 2 * DAY });
    expect(resolveProfileView(mergeProfiles(stale, fresh)).preferences.motion.value).toBe("reduced");
  });

  it("a clear (tombstone) wins over an older set from another device", () => {
    const set = setExplicitPreference(createProfile(USER, NOW), "guidancePace", "slow", { now: NOW });
    const cleared = setExplicitPreference(set, "guidancePace", null, { now: NOW + 1 });
    expect(resolveProfileView(mergeProfiles(set, cleared)).preferences.guidancePace).toBeUndefined();
  });
});

describe("privacy of the user-facing description", () => {
  it("explains explicit vs learned without exposing histories or candidates", () => {
    let profile = setExplicitPreference(createProfile(USER, NOW), "guidancePace", "slow", { now: NOW });
    profile = promoteTwice(profile, globalSummaries({ [LOW_STIM]: summary(0.9) })).profile;
    const description = describeProfile(profile, { now: NOW + DAY });
    expect(description.explicit).toEqual([expect.objectContaining({ field: "guidancePace", value: "slow", moduleId: null })]);
    expect(description.learned).toEqual([
      expect.objectContaining({ key: LOW_STIM, stance: "favoured", label: "Calmer, low-stimulation visuals" }),
    ]);
    const serialized = JSON.stringify(description);
    expect(serialized).not.toMatch(/evidenceCount|candidates|firstSeenAt|history/);
  });
});
