/**
 * personalization.test.js — Task 5 engine integration (profile → decide)
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decide } from "../adaptiveEngine.js";
import { resetAdaptiveHysteresis } from "../hysteresis.js";
import { applyProfileConstraints } from "../personalization.js";
import {
  createMemoryStorage,
  FeedbackOutcome,
  getLearnedPreferences,
  recordAdaptationFeedback,
  setLearningStorage,
} from "@/adaptive/learning/adaptationLearning";
import {
  PROFILE_CONFIG,
  createProfile,
  promoteLearnedPreferences,
  resolveProfileView,
  setExplicitPreference,
} from "@/adaptive/personalization/profileModel";
import { AdaptationActionType, AdaptationDimension, PolicyScope, PriorityTier, TriggerCondition, TriggerGroupOperator } from "@/support/schemas/supportSchemas";

const USER = "personalization-user";
const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const LOW_STIM = "UI:low_stimulation";

const anxious = (confidence) => ({ mood: { primaryMood: "anxious", confidence } });
const overload = () => ({
  timestamp: "2026-08-01T00:00:00.000Z",
  mood: { primaryMood: "overwhelmed", confidence: 0.9 },
  behavior: { taskSwitchFrequency: 1.0 },
  conversation: { urgency: "high" },
});
const ruleIds = (o) => o.plan.actions.map((a) => a.reason.match(/Policy "([^"]+)"/)?.[1]).filter(Boolean);

function profileWith(...changes) {
  let profile = createProfile(USER, NOW);
  for (const [field, value, moduleId] of changes) {
    profile = setExplicitPreference(profile, field, value, { moduleId, now: NOW });
  }
  return profile;
}
const viewOf = (profile, options = {}) => resolveProfileView(profile, { now: NOW, ...options });
function run(snapshot, { at = NOW, personalization, learnedPreferences, extra = {} } = {}) {
  return decide({ contextSnapshot: snapshot, ...extra }, { now: at, userId: USER, personalization, learnedPreferences });
}
/** Decide twice across the confirmation window (Task 2 temporal stability). */
function confirmed(snapshot, options = {}) {
  run(snapshot, options);
  return run(snapshot, { ...options, at: NOW + 4000 });
}
function promotedProfile(score, key = LOW_STIM) {
  const summaries = { global: { [key]: { key, scope: "global", score, confidence: 0.8, evidenceCount: 6, sufficient: true } }, contexts: {} };
  const first = promoteLearnedPreferences(createProfile(USER, NOW - PROFILE_CONFIG.promote.minStableMs), summaries, {
    now: NOW - PROFILE_CONFIG.promote.minStableMs,
  }).profile;
  return promoteLearnedPreferences(first, summaries, { now: NOW }).profile;
}

beforeEach(() => {
  setLearningStorage(createMemoryStorage());
  resetAdaptiveHysteresis();
});
afterEach(() => {
  setLearningStorage(null);
  localStorage.clear();
});

describe("pass-through", () => {
  it("without a profile, decisions are unchanged and no personalization is traced", () => {
    const base = confirmed(anxious(0.95));
    resetAdaptiveHysteresis();
    const withUndefined = confirmed(anxious(0.95), { personalization: undefined });
    const content = (o) => o.plan.actions.map(({ type, target, tier, parameters, reason }) => ({ type, target, tier, parameters, reason }));
    expect(content(withUndefined)).toEqual(content(base));
    expect(withUndefined.trace.learning).toEqual(base.trace.learning);
    expect(withUndefined.trace).not.toHaveProperty("personalization");
    expect(withUndefined.trace.sources).not.toContain("personalization_profile");
  });

  it("an empty profile changes nothing but is recorded as read", () => {
    const base = confirmed(anxious(0.95));
    resetAdaptiveHysteresis();
    const outcome = confirmed(anxious(0.95), { personalization: viewOf(createProfile(USER, NOW)) });
    expect(outcome.plan.actions.map((a) => a.parameters)).toEqual(base.plan.actions.map((a) => a.parameters));
    expect(outcome.trace.personalization).toEqual({ profileRevision: 0, applied: [] });
    expect(outcome.trace.sources).toContain("personalization_profile");
  });
});

describe("explicit preferences as constraints", () => {
  it("an explicitly avoided support mode is not applied, and the trace says why", () => {
    const personalization = viewOf(profileWith(["mode:calm_visuals", "avoided"]));
    const outcome = run(anxious(0.95), { personalization });
    expect(ruleIds(outcome)).not.toContain("low_stimulation");
    expect(outcome.trace.personalization.applied).toEqual([
      { field: "mode:calm_visuals", layer: "explicit", scope: "global", ruleId: "low_stimulation", effect: "suppressed" },
    ]);
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain("low_stimulation");
  });

  it("context-specific avoidance applies only in that module, with global fallback elsewhere", () => {
    const profile = profileWith(["mode:calm_visuals", "avoided", "dyslexia.reader"]);
    const inReader = run(anxious(0.95), {
      personalization: viewOf(profile, { moduleId: "dyslexia.reader" }),
      extra: { moduleContext: { moduleId: "dyslexia.reader" } },
    });
    expect(ruleIds(inReader)).not.toContain("low_stimulation");
    resetAdaptiveHysteresis();
    const elsewhere = run(anxious(0.95), { personalization: viewOf(profile, { moduleId: "support.focus_session" }) });
    expect(ruleIds(elsewhere)).toContain("low_stimulation");
  });

  it("explicit preferences outrank learned acceptance", () => {
    for (let i = 0; i < 6; i += 1) {
      recordAdaptationFeedback({ userId: USER, key: LOW_STIM, outcome: FeedbackOutcome.ACCEPTED, exposureId: `e${i}`, at: NOW });
    }
    const outcome = run(anxious(0.95), {
      learnedPreferences: getLearnedPreferences(USER, { now: NOW }),
      // Learned (live + promoted) says "favoured"; the user explicitly said no.
      personalization: viewOf(setExplicitPreference(promotedProfile(0.9), "mode:calm_visuals", "avoided", { now: NOW })),
    });
    expect(ruleIds(outcome)).not.toContain("low_stimulation");
  });
});

describe("explicit preferences as supporting evidence", () => {
  it("a preferred mode tips borderline evidence (still confirmed over time)", () => {
    const personalization = viewOf(profileWith(["mode:calm_visuals", "preferred"]));
    const first = run(anxious(0.46), { personalization });
    expect(first.trace.personalization.applied).toEqual([
      expect.objectContaining({ field: "mode:calm_visuals", layer: "explicit", effect: "changed", ruleId: "low_stimulation" }),
    ]);
    expect(first.trace.learning).toEqual([]); // explicit, not learned
    expect(ruleIds(run(anxious(0.46), { personalization, at: NOW + 4000 }))).toContain("low_stimulation");
    resetAdaptiveHysteresis();
    expect(ruleIds(confirmed(anxious(0.46)))).not.toContain("low_stimulation");
  });

  it("a preference never creates an adaptation from absent or stale evidence", () => {
    const personalization = viewOf(profileWith(["mode:calm_visuals", "preferred"]));
    expect(ruleIds(confirmed({}, { personalization }))).toEqual([]);
    resetAdaptiveHysteresis();
    const stale = confirmed({ ...anxious(0.9), metadata: { stalenessFlags: { mood: true } } }, { personalization });
    expect(ruleIds(stale)).toEqual([]);
  });
});

describe("presentation shaping", () => {
  it("reduced motion and minimal density make UI adaptations calmer, never busier", () => {
    const personalization = viewOf(profileWith(["motion", "reduced"], ["informationDensity", "minimal"]));
    const outcome = confirmed(anxious(0.95), { personalization });
    const action = outcome.plan.actions.find((a) => a.target === AdaptationDimension.UI);
    expect(action.parameters).toMatchObject({ reduceAnimations: true, maxVisibleModules: 2 });
    expect(outcome.trace.personalization.applied.map((a) => a.effect)).toContain("shaped");
  });

  it("temporary state shapes presentation and is labelled temporary", () => {
    const temporary = { global: { motion: { value: "reduced", expiresAt: NOW + 1000 } }, contexts: {} };
    const entries = [
      { ruleId: "scattered_guidance", tier: PriorityTier.CURRENT_STATE, action: { type: "MODIFY", target: "UI", parameters: {} } },
    ];
    const { kept, applied } = applyProfileConstraints(entries, viewOf(createProfile(USER, NOW), { temporary }));
    expect(kept[0].action.parameters.reduceAnimations).toBe(true);
    expect(applied[0]).toMatchObject({ field: "motion", layer: "temporary" });
  });
});

describe("safety and protected support", () => {
  it("overwhelm support is never suppressed or reduced by preferences", () => {
    let profile = createProfile(USER, NOW);
    for (const mode of ["calm_visuals", "simplified_layout", "step_by_step_guidance", "focus_mode"]) {
      profile = setExplicitPreference(profile, `mode:${mode}`, "avoided", { now: NOW });
    }
    profile = setExplicitPreference(profile, "informationDensity", "minimal", { now: NOW });
    const outcome = run(overload(), { personalization: viewOf(profile) });
    const ids = ruleIds(outcome);
    expect(ids.some((id) => id === "overwhelm_simplification" || id === "critical_urgency")).toBe(true);
  });

  it("never touches safety or explicit tiers", () => {
    const entries = [
      { ruleId: "low_stimulation", tier: PriorityTier.SAFETY, action: { type: "MODIFY", target: "UI", parameters: { maxVisibleModules: 5 } } },
      { ruleId: "low_stimulation", tier: PriorityTier.EXPLICIT_PREFERENCE, action: { type: "MODIFY", target: "UI", parameters: {} } },
    ];
    const view = viewOf(profileWith(["mode:calm_visuals", "avoided"], ["motion", "reduced"], ["informationDensity", "minimal"]));
    const result = applyProfileConstraints(entries, view);
    expect(result.kept).toEqual(entries);
    expect(result.applied).toEqual([]);
  });

  it("a Tier 1 safety rule still applies when the profile avoids that mode", () => {
    const safetyRule = {
      id: "module.safety_calm",
      version: 1,
      scope: PolicyScope.MODULE,
      tier: PriorityTier.SAFETY,
      priority: 1,
      triggerGroups: [{ operator: TriggerGroupOperator.AND, triggers: [{ dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" }] }],
      action: { type: AdaptationActionType.MODIFY, target: AdaptationDimension.UI, parameters: { mode: "crisis" } },
    };
    const outcome = run(
      { conversation: { urgency: "critical", analysis: { confidence: 0.3 } } },
      {
        personalization: viewOf(profileWith(["mode:calm_visuals", "avoided"], ["mode:focus_mode", "avoided"])),
        extra: { moduleContext: { moduleId: "m", modulePolicies: [safetyRule] } },
      },
    );
    expect(outcome.plan.actions.some((a) => a.tier === PriorityTier.SAFETY)).toBe(true);
  });

  it("the safety stage still blocks after personalization", () => {
    const outcome = decide(
      { contextSnapshot: anxious(0.95) },
      {
        now: NOW,
        userId: USER,
        personalization: viewOf(profileWith(["mode:calm_visuals", "preferred"])),
        safety: () => ({ disposition: "BLOCK", reasons: ["test"] }),
      },
    );
    expect(outcome.plan.actions).toEqual([]);
  });
});

describe("learned stances from the profile", () => {
  it("back-fill missing live feedback (e.g. on a new device) and are tagged as profile-sourced", () => {
    run(anxious(0.55), { personalization: viewOf(promotedProfile(0.1)) });
    const outcome = run(anxious(0.55), { personalization: viewOf(promotedProfile(0.1)), at: NOW + 4000 });
    expect(ruleIds(outcome)).not.toContain("low_stimulation");
    expect(outcome.trace.learning[0]).toMatchObject({ key: LOW_STIM, effect: "suppressed", source: "profile" });
  });

  it("are ignored when learned influence is disabled (includeLearned: false)", () => {
    const outcome = confirmed(anxious(0.55), { personalization: viewOf(promotedProfile(0.1), { includeLearned: false }) });
    expect(ruleIds(outcome)).toContain("low_stimulation");
  });

  it("sufficient live feedback outranks a promoted stance", () => {
    for (let i = 0; i < 6; i += 1) {
      recordAdaptationFeedback({ userId: USER, key: LOW_STIM, outcome: FeedbackOutcome.ACCEPTED, exposureId: `e${i}`, at: NOW });
    }
    const options = { personalization: viewOf(promotedProfile(0.1)), learnedPreferences: getLearnedPreferences(USER, { now: NOW }) };
    const outcome = confirmed(anxious(0.55), options);
    expect(ruleIds(outcome)).toContain("low_stimulation");
    expect(outcome.trace.learning[0]).not.toHaveProperty("source");
  });

  it("records no user-identifying content in the personalization trace", () => {
    const outcome = run(anxious(0.95), { personalization: viewOf(profileWith(["mode:calm_visuals", "avoided", "dyslexia.reader"]), { moduleId: "dyslexia.reader" }) });
    expect(JSON.stringify(outcome.trace.personalization)).not.toMatch(/personalization-user/);
  });
});
