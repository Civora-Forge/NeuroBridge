/**
 * learningLoop.test.js — Task 4 regression tests (learning layer + engine)
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decide } from "../adaptiveEngine.js";
import { resetAdaptiveHysteresis } from "../hysteresis.js";
import { applyLearnedPreferences } from "../learning.js";
import {
  clearAdaptationLearning,
  createMemoryStorage,
  FeedbackOutcome,
  getAdaptationFeedback,
  getLearnedPreferences,
  LEARNING_CONFIG,
  recordAdaptationFeedback,
  setLearningStorage,
} from "@/adaptive/learning/adaptationLearning";
import { getRole4StorageKey, ROLE4_COLLECTIONS } from "@/support/schemas/storageKeys";
import { clearUserRole4Data } from "@/support/persistence/role4Store";
import {
  AdaptationActionType,
  AdaptationDimension,
  PolicyScope,
  PriorityTier,
  SafetyLevel,
  TriggerCondition,
  TriggerGroupOperator,
} from "@/support/schemas/supportSchemas";

const USER = "learning-user";
const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const LOW_STIM = "UI:low_stimulation";

let exposure = 0;
function feedback(outcome, { key = LOW_STIM, moduleId = "generic", at = NOW, user = USER } = {}) {
  exposure += 1;
  return recordAdaptationFeedback({ userId: user, key, outcome, exposureId: `exp-${exposure}`, moduleId, at });
}
function times(n, fn) {
  for (let i = 0; i < n; i += 1) fn(i);
}
const learned = (opts = {}) => getLearnedPreferences(USER, { now: NOW, ...opts });
const anxious = (confidence) => ({ mood: { primaryMood: "anxious", confidence } });
function run(snapshot, { at = NOW, prefs = learned(), extra = {} } = {}) {
  return decide({ contextSnapshot: snapshot, ...extra }, { now: at, userId: USER, learnedPreferences: prefs });
}
const ruleIds = (o) => o.plan.actions.map((a) => a.reason.match(/Policy "([^"]+)"/)?.[1]).filter(Boolean);

beforeEach(() => {
  setLearningStorage(createMemoryStorage());
  resetAdaptiveHysteresis();
});
afterEach(() => {
  setLearningStorage(null);
  localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────

describe("acceptance and rejection learning", () => {
  it("learns that a user tends to accept an adaptation", () => {
    times(3, () => feedback(FeedbackOutcome.ACCEPTED));
    const pref = learned()[LOW_STIM];
    expect(pref.sufficient).toBe(true);
    expect(pref.score).toBeCloseTo(0.8, 2);
    expect(pref.confidence).toBeCloseTo(0.6, 2);
    expect(pref.evidenceCount).toBe(3);
  });

  it("learns that a user tends to reject an adaptation; overrides and dismissals count", () => {
    feedback(FeedbackOutcome.REJECTED);
    feedback(FeedbackOutcome.OVERRIDDEN);
    feedback(FeedbackOutcome.DISMISSED);
    const pref = learned()[LOW_STIM];
    expect(pref.sufficient).toBe(true);
    expect(pref.score).toBeLessThan(0.3);
  });
});

describe("recency weighting", () => {
  it("recent behaviour outweighs older behaviour", () => {
    times(5, () => feedback(FeedbackOutcome.REJECTED, { at: NOW - 60 * DAY }));
    times(3, () => feedback(FeedbackOutcome.ACCEPTED, { at: NOW - DAY }));
    expect(learned()[LOW_STIM].score).toBeGreaterThan(0.6);
  });

  it("old evidence alone decays below the sufficiency threshold", () => {
    times(4, () => feedback(FeedbackOutcome.REJECTED, { at: NOW - 90 * DAY }));
    const pref = learned()[LOW_STIM];
    expect(pref.evidenceCount).toBe(4);
    expect(pref.evidenceWeight).toBeLessThan(LEARNING_CONFIG.minEvidenceWeight);
    expect(pref.sufficient).toBe(false);
  });
});

describe("context-specific versus global preferences", () => {
  beforeEach(() => {
    times(3, () => feedback(FeedbackOutcome.REJECTED, { moduleId: "reader" }));
    times(3, () => feedback(FeedbackOutcome.ACCEPTED, { moduleId: "planner" }));
  });

  it("uses the context preference where it has sufficient evidence", () => {
    expect(learned({ moduleId: "reader" })[LOW_STIM]).toMatchObject({ scope: "context", sufficient: true });
    expect(learned({ moduleId: "reader" })[LOW_STIM].score).toBeLessThan(0.3);
    expect(learned({ moduleId: "planner" })[LOW_STIM].score).toBeGreaterThan(0.7);
  });

  it("falls back to the general preference elsewhere (mixed → neutral)", () => {
    const pref = learned({ moduleId: "dashboard" })[LOW_STIM];
    expect(pref.scope).toBe("global");
    expect(pref.score).toBeCloseTo(0.5, 2);
  });
});

describe("insufficient evidence", () => {
  it("one or two interactions never change a decision", () => {
    times(2, () => feedback(FeedbackOutcome.REJECTED));
    expect(learned()[LOW_STIM].sufficient).toBe(false);
    expect(run(anxious(0.55)).trace.learning).toEqual([]);
    const outcome = run(anxious(0.55), { at: NOW + 4000 }); // past confirmation
    expect(ruleIds(outcome)).toContain("low_stimulation");
    expect(outcome.trace.learning).toEqual([]);
  });

  it("repeated ignoring is weak evidence that needs many repetitions", () => {
    times(3, () => feedback(FeedbackOutcome.IGNORED));
    expect(learned()[LOW_STIM].sufficient).toBe(false);
    times(9, () => feedback(FeedbackOutcome.IGNORED));
    const pref = learned()[LOW_STIM];
    expect(pref.sufficient).toBe(true);
    expect(pref.ignoredCount).toBe(12);
  });
});

describe("integration with the adaptive engine", () => {
  it("a learned rejection suppresses a borderline adaptation and explains it", () => {
    times(4, () => feedback(FeedbackOutcome.REJECTED));
    run(anxious(0.55));
    // Past the confirmation window it would have entered without the history.
    const outcome = run(anxious(0.55), { at: NOW + 4000 });
    expect(ruleIds(outcome)).not.toContain("low_stimulation");
    expect(outcome.trace.learning).toEqual([
      expect.objectContaining({ key: LOW_STIM, ruleId: "low_stimulation", scope: "global", effect: "suppressed", evidenceCount: 4 }),
    ]);
    expect(outcome.trace.sources).toContain("learned_preferences");
    expect(outcome.trace.overrides.some((o) => o.kind === "evidence" && /learned_preference/.test(o.detail))).toBe(true);
  });

  it("strong current evidence still adapts despite a learned rejection (supporting evidence, not a command)", () => {
    times(4, () => feedback(FeedbackOutcome.REJECTED));
    const outcome = run(anxious(0.95));
    expect(ruleIds(outcome)).toContain("low_stimulation");
    const [influence] = outcome.trace.learning;
    expect(influence.effect).toBe("changed");
    expect(influence.evidenceAfter).toBeLessThan(influence.evidenceBefore);
    expect(influence.evidenceBefore - influence.evidenceAfter).toBeLessThanOrEqual(0.15);
  });

  it("a learned acceptance can tip borderline evidence, still subject to confirmation", () => {
    times(6, () => feedback(FeedbackOutcome.ACCEPTED));
    const first = run(anxious(0.46));
    expect(first.trace.learning[0]).toMatchObject({ effect: "changed", evidenceBefore: 0.46 });
    expect(first.trace.learning[0].evidenceAfter).toBeGreaterThanOrEqual(0.5);
    expect(ruleIds(first)).toEqual([]); // promoted, but must persist (Task 2)
    expect(ruleIds(run(anxious(0.46), { at: NOW + 4000 }))).toContain("low_stimulation");
  });

  it("cannot create an adaptation from absent or stale evidence", () => {
    times(6, () => feedback(FeedbackOutcome.ACCEPTED));
    expect(ruleIds(run({}))).toEqual([]);
    const stale = run({ ...anxious(0.9), metadata: { stalenessFlags: { mood: true } } });
    expect(ruleIds(stale)).toEqual([]);
    expect(stale.trace.learning).toEqual([]);
  });

  it("records no sensitive information in the trace", () => {
    times(4, () => feedback(FeedbackOutcome.REJECTED, { moduleId: "reader" }));
    const outcome = run(anxious(0.55), { prefs: learned({ moduleId: "reader" }) });
    const serialized = JSON.stringify(outcome.trace.learning);
    expect(serialized).not.toMatch(/learning-user|exp-|reader/);
    expect(Object.keys(outcome.trace.learning[0]).sort()).toEqual(
      ["confidence", "effect", "evidenceAfter", "evidenceBefore", "evidenceCount", "key", "ruleId", "scope", "score"].sort(),
    );
  });
});

describe("explicit preference precedence", () => {
  it("an explicit request is applied even when the user's history argues against it", () => {
    times(5, () => feedback(FeedbackOutcome.REJECTED, { key: "UI:pref.ui_quiet" }));
    const outcome = run({}, {
      extra: {
        userPreferences: { requested: [{ id: "pref.ui_quiet", target: AdaptationDimension.UI, parameters: { mode: "quiet" } }] },
      },
    });
    expect(outcome.plan.actions[0]).toMatchObject({ tier: PriorityTier.EXPLICIT_USER_REQUEST });
    expect(outcome.trace.learning).toEqual([]);
  });

  it("an explicit restriction wins over a learned acceptance", () => {
    times(6, () => feedback(FeedbackOutcome.ACCEPTED));
    const outcome = run(anxious(0.95), {
      extra: { userPreferences: { restricted: [{ id: "no-ui", target: AdaptationDimension.UI }] } },
    });
    expect(outcome.plan.actions.filter((a) => a.target === AdaptationDimension.UI)).toEqual([]);
  });

  it("learning never writes to explicit preferences", () => {
    const prefs = { requested: [], restricted: [], accessibility: { reduceMotion: true } };
    const frozen = JSON.stringify(prefs);
    times(6, () => feedback(FeedbackOutcome.REJECTED));
    run(anxious(0.9), { extra: { userPreferences: prefs } });
    expect(JSON.stringify(prefs)).toBe(frozen);
  });
});

describe("safety constraints", () => {
  const safetyRule = {
    id: "module.safety_calm",
    version: 1,
    scope: PolicyScope.MODULE,
    tier: PriorityTier.SAFETY,
    priority: 1,
    triggerGroups: [
      { operator: TriggerGroupOperator.AND, triggers: [{ dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" }] },
    ],
    action: { type: AdaptationActionType.MODIFY, target: AdaptationDimension.UI, parameters: { mode: "crisis" } },
  };

  it("never weakens a Tier 1 safety adaptation", () => {
    times(6, () => feedback(FeedbackOutcome.REJECTED, { key: "UI:module.safety_calm" }));
    const outcome = run(
      { conversation: { urgency: "critical", analysis: { confidence: 0.3 } } },
      { extra: { moduleContext: { moduleId: "m", modulePolicies: [safetyRule] } } },
    );
    expect(outcome.plan.actions.some((a) => a.tier === PriorityTier.SAFETY)).toBe(true);
    expect(outcome.trace.learning).toEqual([]);
  });

  it("never revives a candidate the safety stage removes", () => {
    times(6, () => feedback(FeedbackOutcome.ACCEPTED));
    const outcome = run(anxious(0.95), {
      extra: { moduleContext: { moduleId: "escalate-module", safetyLevel: SafetyLevel.ESCALATE } },
    });
    expect(outcome.plan.actions).toEqual([]);
  });

  it("the pure stage leaves non-current-state tiers untouched", () => {
    const entry = { ruleId: "x", tier: PriorityTier.EXPLICIT_PREFERENCE, priority: 0, action: { target: "UI" }, evidenceConfidence: 0.6 };
    const prefs = { "UI:x": { sufficient: true, score: 0.0, confidence: 1, evidenceCount: 10, scope: "global" } };
    const result = applyLearnedPreferences({ triggered: [entry], suppressed: [] }, prefs);
    expect(result.triggered).toEqual([entry]);
    expect(result.influences).toEqual([]);
  });
});

describe("duplicate feedback prevention", () => {
  it("records one outcome per exposure", () => {
    const first = recordAdaptationFeedback({ userId: USER, key: LOW_STIM, outcome: "accepted", exposureId: "e1", at: NOW });
    const again = recordAdaptationFeedback({ userId: USER, key: LOW_STIM, outcome: "accepted", exposureId: "e1", at: NOW });
    const flip = recordAdaptationFeedback({ userId: USER, key: LOW_STIM, outcome: "rejected", exposureId: "e1", at: NOW });
    expect(first.recorded).toBe(true);
    expect(again).toMatchObject({ recorded: false, duplicate: true });
    expect(flip).toMatchObject({ recorded: false, duplicate: true });
    expect(getAdaptationFeedback(USER)).toHaveLength(1);
  });

  it("rejects malformed feedback and requires a user", () => {
    expect(recordAdaptationFeedback({ key: LOW_STIM, outcome: "accepted", exposureId: "e" }).reason).toBe("no_user");
    expect(recordAdaptationFeedback({ userId: USER, key: LOW_STIM, outcome: "maybe", exposureId: "e" }).reason).toBe("unknown_outcome");
    expect(recordAdaptationFeedback({ userId: USER, key: LOW_STIM, outcome: "accepted" }).reason).toBe("no_exposure");
  });

  it("keeps history bounded", () => {
    times(LEARNING_CONFIG.maxEventsPerUser + 20, () => feedback(FeedbackOutcome.ACCEPTED));
    expect(getAdaptationFeedback(USER)).toHaveLength(LEARNING_CONFIG.maxEventsPerUser);
  });
});

describe("persistence and fallback", () => {
  it("persists in the Role 4 localStorage namespace", () => {
    setLearningStorage(null); // default → localStorage
    feedback(FeedbackOutcome.ACCEPTED);
    const raw = localStorage.getItem(getRole4StorageKey(USER, ROLE4_COLLECTIONS.ADAPTATION_FEEDBACK));
    expect(JSON.parse(raw)).toHaveLength(1);
    expect(JSON.parse(raw)[0]).not.toHaveProperty("userId");
  });

  it("falls back to memory when storage throws", () => {
    setLearningStorage({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    });
    const result = feedback(FeedbackOutcome.REJECTED);
    expect(result).toMatchObject({ recorded: true, storage: "memory" });
    expect(getAdaptationFeedback(USER)).toHaveLength(1);
    clearAdaptationLearning(USER);
    expect(getAdaptationFeedback(USER)).toHaveLength(0);
  });

  it("treats corrupt stored data as empty", () => {
    setLearningStorage(null);
    localStorage.setItem(getRole4StorageKey(USER, ROLE4_COLLECTIONS.ADAPTATION_FEEDBACK), "{not json");
    expect(getAdaptationFeedback(USER)).toEqual([]);
  });

  it("is cleared by the Role 4 privacy reset", () => {
    setLearningStorage(null);
    feedback(FeedbackOutcome.ACCEPTED);
    clearUserRole4Data(USER);
    expect(getAdaptationFeedback(USER)).toEqual([]);
  });
});
