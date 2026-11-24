/**
 * releaseHardening.test.js — Task 6 engine edge cases (malformed / missing /
 * stale / contradictory input, evidence floor vs hysteresis, precedence).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { decide } from "../adaptiveEngine.js";
import { resetAdaptiveHysteresis } from "../hysteresis.js";
import { applyProfileConstraints, buildPreferenceEvidence } from "../personalization.js";
import { createProfile, resolveProfileView, setExplicitPreference } from "@/adaptive/personalization/profileModel";
import { PriorityTier } from "@/support/schemas/supportSchemas";

const T0 = Date.parse("2026-11-20T12:00:00.000Z");
const USER = "hardening-user";
const ruleIds = (o) => o.plan.actions.map((a) => a.reason?.match(/Policy "([^"]+)"/)?.[1]).filter(Boolean);
const run = (snapshot, at = T0, options = {}) => decide({ contextSnapshot: snapshot }, { now: at, userId: USER, ...options });
const anxious = (confidence) => ({ mood: { primaryMood: "anxious", confidence } });

beforeEach(() => resetAdaptiveHysteresis());

describe("missing, malformed and contradictory context", () => {
  const malformed = {
    "null mood": { mood: null },
    "string mood": { mood: "anxious" },
    "NaN confidence": anxious(NaN),
    "negative confidence": anxious(-1),
    "array snapshot": [1, 2],
    "wrong types everywhere": { mood: { primaryMood: { x: 1 } }, behavior: { taskSwitchFrequency: "lots" }, conversation: { urgency: 42 } },
    "all evidence stale": { ...anxious(0.95), metadata: { stalenessFlags: { mood: true, conversation: true, behavior: true } } },
    "empty": {},
  };

  for (const [name, snapshot] of Object.entries(malformed)) {
    it(`${name}: never throws and never adapts`, () => {
      const outcome = run(snapshot);
      expect(ruleIds(outcome)).toEqual([]);
      resetAdaptiveHysteresis();
      expect(ruleIds(run(snapshot, T0 + 4000))).toEqual([]);
    });
  }

  it("prototype-polluting input does not pollute objects", () => {
    run(JSON.parse('{"__proto__": {"polluted": true}, "mood": {"primaryMood": "anxious", "confidence": 0.9}}'));
    expect({}.polluted).toBeUndefined();
  });

  it("contradictory context: safety-critical urgency takes precedence over calmer modes", () => {
    const outcome = run({
      mood: { primaryMood: "anxious", confidence: 0.95 },
      conversation: { urgency: "critical", analysis: { confidence: 0.95 } },
      behavior: { taskSwitchFrequency: 0.05 },
    });
    expect(ruleIds(outcome)).toContain("critical_urgency");
  });
});

describe("evidence floor vs hysteresis", () => {
  it("an active adaptation is withdrawn, not held, once its evidence becomes unreliable", () => {
    expect(ruleIds(run(anxious(0.95), T0))).toContain("low_stimulation"); // immediate entry
    // Still inside the minimum duration: valid contradicting evidence is held …
    expect(ruleIds(run({ mood: { primaryMood: "calm", confidence: 0.9 } }, T0 + 2000))).toContain("low_stimulation");
    // … but evidence below the supporting floor (treated as absent) is not.
    const unreliable = run(anxious(0.1), T0 + 3000);
    expect(ruleIds(unreliable)).not.toContain("low_stimulation");
    expect(unreliable.trace.overrides.map((o) => o.detail).join(" ")).toMatch(/withdrawn "low_stimulation".*unreliable/);
  });

  it("garbage confidence after an adaptation is active also withdraws it", () => {
    run(anxious(0.95), T0);
    expect(ruleIds(run(anxious(-1), T0 + 1000))).not.toContain("low_stimulation");
  });

  it("weak-but-valid evidence above the floor still maintains (Task 2 behaviour kept)", () => {
    run(anxious(0.95), T0);
    expect(ruleIds(run(anxious(0.4), T0 + 1000))).toContain("low_stimulation");
  });
});

describe("malformed personalization input fails safe", () => {
  const bad = [
    { presentation: null },
    { presentation: [] },
    { presentation: {}, supportModes: { avoided: "calm_visuals", preferred: 7 } },
    { presentation: {}, learned: { "UI:low_stimulation": null, "UI:focus_mode": "x" } },
    { presentation: { reduceMotion: "yes" }, preferences: { motion: "reduced" } },
  ];
  for (const view of bad) {
    it(`ignores ${JSON.stringify(view)}`, () => {
      expect(() => run(anxious(0.95), T0, { personalization: view })).not.toThrow();
      const entries = [{ ruleId: "low_stimulation", tier: PriorityTier.CURRENT_STATE, action: { type: "MODIFY", target: "UI", parameters: {} } }];
      const result = applyProfileConstraints(entries, view);
      expect(result.dropped).toEqual([]);
      expect(result.kept[0].action.parameters.reduceAnimations).toBeUndefined();
      expect(() => buildPreferenceEvidence(undefined, view)).not.toThrow();
    });
  }
});

describe("conflicting preferences", () => {
  it("explicit avoid beats a learned favour and an explicit prefer in another scope", () => {
    let profile = createProfile(USER, T0);
    profile = setExplicitPreference(profile, "mode:calm_visuals", "preferred", { now: T0 });
    profile = setExplicitPreference(profile, "mode:calm_visuals", "avoided", { moduleId: "dyslexia.reader", now: T0 });
    const view = resolveProfileView(profile, { moduleId: "dyslexia.reader", now: T0 });
    const learned = { "UI:low_stimulation": { key: "UI:low_stimulation", scope: "global", score: 0.95, confidence: 1, evidenceCount: 20, sufficient: true } };
    const outcome = decide(
      { contextSnapshot: anxious(0.95), moduleContext: { moduleId: "dyslexia.reader" } },
      { now: T0, userId: USER, personalization: view, learnedPreferences: learned },
    );
    expect(ruleIds(outcome)).not.toContain("low_stimulation");
  });

  it("an explicit D14 restriction still wins when the profile prefers the mode", () => {
    const view = resolveProfileView(setExplicitPreference(createProfile(USER, T0), "mode:calm_visuals", "preferred", { now: T0 }), { now: T0 });
    const outcome = decide(
      { contextSnapshot: anxious(0.95), userPreferences: { restricted: [{ id: "no-ui", target: "UI" }] } },
      { now: T0, userId: USER, personalization: view },
    );
    expect(outcome.plan.actions.filter((a) => a.target === "UI")).toEqual([]);
  });
});

describe("per-user isolation in the engine", () => {
  it("one user's active adaptation never carries over to another user", () => {
    expect(ruleIds(run(anxious(0.95), T0))).toContain("low_stimulation");
    const other = decide({ contextSnapshot: anxious(0.6) }, { now: T0 + 1000, userId: "someone-else" });
    expect(ruleIds(other)).not.toContain("low_stimulation"); // must confirm on its own evidence
  });
});
