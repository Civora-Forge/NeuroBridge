/**
 * contextualInference.test.js — shared, module-aware context-to-state
 * inference. Deterministic fixtures: time is the evidence block's
 * `observedAt`; no wall clock.
 */

import { describe, expect, it } from "vitest";
import { inferContextualStates, INFERENCE_CONFIG, StateValue } from "../contextualInference.js";
import { ActivityType, ACTIVITY_PROFILES, resolveActivityProfile } from "../activityProfiles.js";
import { buildUserState } from "../userStateModel.js";

const NOW = Date.parse("2026-11-21T12:00:00.000Z");
const SEC = 1000;
const MIN = 60 * SEC;

/** Build an interactionEvidence block; `ago` is the bucket centre's age. */
function evidence({ buckets = [], tasks = [], latency = [], selfReports = [], lastKeystrokeAgo = null } = {}) {
  return {
    observedAt: NOW,
    bucketMs: 30 * SEC,
    windowMs: 15 * MIN,
    buckets: buckets.map(({ ago, ...counts }) => ({
      start: NOW - ago - 15 * SEC,
      keystroke: 0, correction: 0, undo: 0, focusInterrupt: 0, navigationSwitch: 0, scrollBacktrack: 0,
      typingGapSumMs: 0, typingGapCount: 0,
      ...counts,
    })),
    taskEvents: tasks.map(({ ago, ...rest }) => ({ moduleId: "support.task_breakdown", ...rest, at: NOW - ago })),
    latencySamples: latency.map(({ ago, seconds }) => ({ at: NOW - ago, seconds })),
    selfReports: selfReports.map(({ ago, ...rest }) => ({ source: "mood_checkin", moduleId: null, ...rest, at: NOW - ago })),
    lastKeystrokeAt: lastKeystrokeAgo === null ? null : NOW - lastKeystrokeAgo,
  };
}

function snapshot(ev, extra = {}) {
  return { timestamp: new Date(NOW).toISOString(), interactionEvidence: ev, ...extra };
}

const infer = (snap, activity = ActivityType.GENERAL, baseline) =>
  inferContextualStates(snap, { profile: ACTIVITY_PROFILES[activity], baseline, moduleId: `test.${activity}` });

const heavyEditing = (ago = 30 * SEC) => ({ ago, keystroke: 60, correction: 20 });
const failedAttempts = (ago = 30 * SEC) => [
  { ago, type: "failed" },
  { ago: ago - 5 * SEC, type: "started", retry: true },
  { ago: ago - 10 * SEC, type: "failed" },
];

describe("inferred-state record shape", () => {
  it("every state carries id, confidence, evidence, provenance, scope, timestamp, window, stability and expiry", () => {
    const out = infer(snapshot(evidence({ buckets: [heavyEditing()], tasks: failedAttempts() })), ActivityType.STRUCTURED_TASK);
    const state = out.states.frustration;
    expect(state).toMatchObject({
      id: "frustration",
      kind: "inferred",
      scope: { moduleId: "test.structured_task", activityType: "structured_task" },
      observedAt: NOW,
      window: { startedAt: NOW - INFERENCE_CONFIG.windowMs, endedAt: NOW },
    });
    expect(state.confidence).toBeGreaterThan(0);
    expect(state.evidence.length).toBeGreaterThan(0);
    expect(state.provenance).toContain("interactionEvidence.taskEvents");
    expect(["persistent", "emerging", "recovering", "absent"]).toContain(state.stability);
    expect(state.expiresAt).toBeGreaterThan(NOW);
  });
});

describe("each state with sufficient converging evidence", () => {
  it("frustration: heavy corrections + failed attempts (two families)", () => {
    const s = infer(snapshot(evidence({ buckets: [heavyEditing()], tasks: failedAttempts() })), ActivityType.STRUCTURED_TASK).states.frustration;
    expect(s.value).toBe(StateValue.PRESENT);
    expect(s.convergence).toBe("multi_family");
    expect(s.families).toEqual(expect.arrayContaining(["editing", "taskOutcome"]));
  });

  it("cognitive overload: repeated abandonment + rising response latency", () => {
    const ev = evidence({
      tasks: [{ ago: 40 * SEC, type: "abandoned" }, { ago: 70 * SEC, type: "abandoned" }],
      latency: [{ ago: 30 * SEC, seconds: 24 }, { ago: 60 * SEC, seconds: 26 }],
    });
    const s = infer(snapshot(ev), ActivityType.STRUCTURED_TASK).states.cognitiveOverload;
    expect(s.value).toBe(StateValue.PRESENT);
    expect(s.families).toEqual(expect.arrayContaining(["taskOutcome", "timing"]));
  });

  it("attention fragmentation: page switching + window interruptions", () => {
    const ev = evidence({ buckets: [{ ago: 30 * SEC, navigationSwitch: 3, focusInterrupt: 3 }, { ago: 60 * SEC, navigationSwitch: 2, focusInterrupt: 2 }] });
    const s = infer(snapshot(ev), ActivityType.STRUCTURED_TASK).states.attentionFragmentation;
    expect(s.value).toBe(StateValue.PRESENT);
    expect(s.families).toEqual(expect.arrayContaining(["navigation", "focus"]));
  });

  it("cognitive fatigue: typing slower than the personal baseline + inactivity during an active task", () => {
    const baseline = { activities: { general: { metrics: { typingGapMs: { n: 20, mean: 200, m2: 19 * 900 } } } } };
    const ev = evidence({ buckets: [{ ago: 30 * SEC, keystroke: 20, typingGapSumMs: 9000, typingGapCount: 20 }], lastKeystrokeAgo: 60 * SEC });
    const snap = snapshot(ev, { deviceInteraction: { timeSinceLastInteraction: 300, currentSessionDuration: 1800 } });
    const s = infer(snap, ActivityType.GENERAL, baseline).states.cognitiveFatigue;
    expect(s.value).toBe(StateValue.PRESENT);
    expect(s.families).toEqual(expect.arrayContaining(["typingRhythm", "taskActivity"]));
    expect(s.evidence.find((e) => e.feature === "typingSlowdown").baselineRelative).toBe(true);
  });
});

describe("isolated signals do not establish a state", () => {
  it("heavy corrections alone stay below the trigger floor", () => {
    const s = infer(snapshot(evidence({ buckets: [heavyEditing()] })), ActivityType.STRUCTURED_TASK).states.frustration;
    expect(s.confidence).toBeLessThan(INFERENCE_CONFIG.presentAt);
    expect(s.value).not.toBe(StateValue.PRESENT);
    expect(s.convergence).toBe("single_family");
  });

  it("one burst of failed attempts (not persistent) is capped below the floor", () => {
    const s = infer(snapshot(evidence({ tasks: failedAttempts() })), ActivityType.STRUCTURED_TASK).states.frustration;
    expect(s.confidence).toBeLessThanOrEqual(INFERENCE_CONFIG.singleFamilyCap);
    expect(s.value).not.toBe(StateValue.PRESENT);
  });

  it("a pointer-movement burst never establishes frustration or distress on its own", () => {
    const snap = snapshot(evidence({ buckets: [{ ago: 10 * SEC }] }), {
      behavior: { movementBurst: { active: true } },
      mood: { primaryMood: "stressed", confidence: 0.55, basis: "interaction" },
    });
    const out = infer(snap);
    expect(out.states.frustration.value).not.toBe(StateValue.PRESENT);
    const userState = buildUserState(snap);
    expect(userState.emotionalState).toBe("unknown");
    expect(userState.mood).toBe("unknown");
    expect(userState.selfReportedDistress).toBe("unknown");
  });

  it("slow typing alone (no baseline) is never anxiety or fatigue", () => {
    const ev = evidence({ buckets: [{ ago: 30 * SEC, keystroke: 30, typingGapSumMs: 30 * 900, typingGapCount: 30 }] });
    const out = infer(snapshot(ev));
    expect(out.states.cognitiveFatigue.value).not.toBe(StateValue.PRESENT);
    expect(out.states.cognitiveFatigue.evidence.find((e) => e.feature === "typingSlowdown")).toBeUndefined();
    expect(buildUserState(snapshot(ev)).emotionalState).toBe("unknown");
  });

  it("inactivity without an active task is not evidence", () => {
    const snap = snapshot(evidence({ buckets: [{ ago: 30 * SEC }] }), { deviceInteraction: { timeSinceLastInteraction: 900 } });
    const s = infer(snap).states.cognitiveFatigue;
    expect(s.evidence.find((e) => e.feature === "inactivityDuringTask")).toBeUndefined();
  });
});

describe("multiple independent signals converge", () => {
  it("adding an independent family raises confidence above either alone", () => {
    const editing = infer(snapshot(evidence({ buckets: [heavyEditing()] })), ActivityType.STRUCTURED_TASK).states.frustration.confidence;
    const tasks = infer(snapshot(evidence({ tasks: failedAttempts() })), ActivityType.STRUCTURED_TASK).states.frustration.confidence;
    const both = infer(snapshot(evidence({ buckets: [heavyEditing()], tasks: failedAttempts() })), ActivityType.STRUCTURED_TASK).states.frustration.confidence;
    expect(both).toBeGreaterThan(Math.max(editing, tasks));
  });

  it("two features from the SAME family do not count as convergence", () => {
    const ev = evidence({ buckets: [{ ago: 30 * SEC, keystroke: 60, correction: 20, undo: 6 }] });
    const s = infer(snapshot(ev), ActivityType.STRUCTURED_TASK).states.frustration;
    expect(s.families).toEqual(["editing"]);
    expect(s.confidence).toBeLessThanOrEqual(INFERENCE_CONFIG.singleFamilyCap);
  });
});

describe("transient signals decay; persistent patterns need repetition", () => {
  it("the same evidence 9 minutes old no longer establishes the state", () => {
    const fresh = infer(snapshot(evidence({ buckets: [heavyEditing(30 * SEC)], tasks: failedAttempts(30 * SEC) })), ActivityType.STRUCTURED_TASK);
    const old = infer(snapshot(evidence({ buckets: [heavyEditing(9 * MIN)], tasks: failedAttempts(9 * MIN) })), ActivityType.STRUCTURED_TASK);
    expect(fresh.states.frustration.value).toBe(StateValue.PRESENT);
    expect(old.states.frustration.value).not.toBe(StateValue.PRESENT);
    expect(old.states.frustration.confidence).toBeLessThan(fresh.states.frustration.confidence);
  });

  it("evidence outside the window is ignored entirely", () => {
    const s = infer(snapshot(evidence({ tasks: failedAttempts(11 * MIN) })), ActivityType.STRUCTURED_TASK).states.frustration;
    expect(s.evidence.find((e) => e.feature === "failedAttempts")).toBeUndefined();
  });

  it("failed attempts persisting across sub-windows can establish frustration in a structured task", () => {
    const ev = evidence({ tasks: [...failedAttempts(30 * SEC), ...failedAttempts(4 * MIN)] });
    const s = infer(snapshot(ev), ActivityType.STRUCTURED_TASK).states.frustration;
    expect(s.convergence).toBe("persistent_primary");
    expect(s.stability).toBe("persistent");
    expect(s.value).toBe(StateValue.PRESENT);
  });

  it("states expire: expiresAt is bounded by the last evidence plus the window", () => {
    const s = infer(snapshot(evidence({ buckets: [heavyEditing(2 * MIN)], tasks: failedAttempts(2 * MIN) })), ActivityType.STRUCTURED_TASK).states.frustration;
    expect(s.expiresAt).toBeLessThanOrEqual(NOW + INFERENCE_CONFIG.windowMs);
  });
});

describe("recovery", () => {
  it("strong earlier evidence with a quiet recent window is reported as recovering", () => {
    const ev = evidence({
      buckets: [heavyEditing(3 * MIN), { ago: 30 * SEC, keystroke: 30 }],
      tasks: [...failedAttempts(3 * MIN), { ago: 3 * MIN + 20 * SEC, type: "failed" }],
    });
    const s = infer(snapshot(ev), ActivityType.STRUCTURED_TASK).states.frustration;
    expect(s.value).toBe(StateValue.RECOVERING);
    expect(s.stability).toBe("recovering");
  });
});

describe("personal baseline versus population thresholds", () => {
  const rate30 = evidence({ buckets: [{ ago: 30 * SEC, keystroke: 100, correction: 30 }] });
  const correctionsOf = (baseline) =>
    infer(snapshot(rate30), ActivityType.GENERAL, baseline).states.frustration.evidence.find((e) => e.feature === "corrections");

  it("without a baseline, a population threshold applies with reduced reliability", () => {
    const c = correctionsOf(undefined);
    expect(c.baselineRelative).toBe(false);
    expect(c.reliability).toBe(INFERENCE_CONFIG.populationReliability);
  });

  it("a user who always corrects this much shows no evidence", () => {
    const habitual = { activities: { general: { metrics: { correctionRate: { n: 30, mean: 0.28, m2: 29 * 0.0025 } } } } };
    expect(correctionsOf(habitual)).toBeUndefined(); // contribution 0 → not evidence
  });

  it("a user who rarely corrects shows strong, fully reliable evidence", () => {
    const careful = { activities: { general: { metrics: { correctionRate: { n: 30, mean: 0.05, m2: 29 * 0.0004 } } } } };
    const c = correctionsOf(careful);
    expect(c.baselineRelative).toBe(true);
    expect(c.reliability).toBe(1);
    expect(c.strength).toBe(1);
  });

  it("a baseline with too few samples is not used", () => {
    const thin = { activities: { general: { metrics: { correctionRate: { n: 3, mean: 0.05, m2: 0 } } } } };
    expect(correctionsOf(thin).baselineRelative).toBe(false);
  });
});

describe("module-aware interpretation", () => {
  const idleInTask = (activity) => infer(
    snapshot(evidence({ buckets: [{ ago: 30 * SEC, keystroke: 5 }], lastKeystrokeAgo: 60 * SEC }), { deviceInteraction: { timeSinceLastInteraction: 200 } }),
    activity,
  ).states.cognitiveFatigue.evidence.find((e) => e.feature === "inactivityDuringTask");

  it("a 200 s pause is fatigue evidence in a general task but not while reading or in a regulation activity", () => {
    expect(idleInTask(ActivityType.GENERAL)?.contribution).toBeGreaterThan(0);
    expect(idleInTask(ActivityType.READING)).toBeUndefined(); // below the reading threshold
    expect(idleInTask(ActivityType.REGULATION)).toBeUndefined(); // stillness is the activity
  });

  it("persistent failed attempts establish frustration in a structured task but not on a general page", () => {
    const ev = evidence({ tasks: [...failedAttempts(30 * SEC), ...failedAttempts(4 * MIN)] });
    expect(infer(snapshot(ev), ActivityType.STRUCTURED_TASK).states.frustration.value).toBe(StateValue.PRESENT);
    expect(infer(snapshot(ev), ActivityType.GENERAL).states.frustration.value).not.toBe(StateValue.PRESENT);
  });

  it("losing one's place while reading is fragmentation evidence weighted for reading", () => {
    const ev = evidence({ buckets: [{ ago: 30 * SEC, scrollBacktrack: 4, focusInterrupt: 3 }, { ago: 60 * SEC, scrollBacktrack: 2, focusInterrupt: 2 }] });
    const reading = infer(snapshot(ev), ActivityType.READING).states.attentionFragmentation;
    const general = infer(snapshot(ev), ActivityType.GENERAL).states.attentionFragmentation;
    expect(reading.confidence).toBeGreaterThan(general.confidence);
    expect(reading.value).toBe(StateValue.PRESENT);
  });

  it("resolves activity types from the module registry ids", () => {
    expect(resolveActivityProfile({ moduleId: "dyslexia.adaptive-reading" }).id).toBe(ActivityType.READING);
    expect(resolveActivityProfile({ moduleId: "support.task_breakdown" }).id).toBe(ActivityType.STRUCTURED_TASK);
    expect(resolveActivityProfile({ moduleId: "support.grounding" }).id).toBe(ActivityType.REGULATION);
    expect(resolveActivityProfile(null).id).toBe(ActivityType.GENERAL);
  });
});

describe("missing or low-quality evidence", () => {
  it("no evidence block → every state unknown with confidence 0", () => {
    const out = infer({ timestamp: new Date(NOW).toISOString() });
    expect(out.available).toBe(false);
    for (const state of Object.values(out.states)) {
      expect(state.value).toBe(StateValue.UNKNOWN);
      expect(state.confidence).toBe(0);
    }
  });

  it("too little typing → no correction-rate evidence (no fabricated rate)", () => {
    const ev = evidence({ buckets: [{ ago: 30 * SEC, keystroke: 5, correction: 4 }] });
    const s = infer(snapshot(ev)).states.frustration;
    expect(s.evidence.find((e) => e.feature === "corrections")).toBeUndefined();
  });

  it("'none' carries confidence 0 (absence of evidence is not evidence of absence)", () => {
    const s = infer(snapshot(evidence({ buckets: [{ ago: 30 * SEC, keystroke: 40 }] }))).states.frustration;
    expect(s.value).toBe(StateValue.NONE);
    expect(s.confidence).toBe(0);
  });

  it("malformed evidence entries are ignored", () => {
    const ev = { observedAt: NOW, buckets: [null, { start: "x" }, 7], taskEvents: [{ at: "soon" }], latencySamples: [{}], selfReports: [{ state: 1 }] };
    expect(() => infer(snapshot(ev))).not.toThrow();
    expect(infer(snapshot(ev)).selfReport).toBeNull();
  });
});

describe("explicit self-report versus indirect inference", () => {
  it("a self-report is a separate, explicit record — never an inferred state", () => {
    const snap = snapshot(evidence({ selfReports: [{ ago: 60 * SEC, state: "overwhelmed" }] }));
    const out = infer(snap);
    expect(out.selfReport).toMatchObject({ kind: "self_reported", state: "overwhelmed", distress: true, confidence: 1 });
    expect(out.states.cognitiveOverload.value).not.toBe(StateValue.PRESENT);
    const userState = buildUserState(snap);
    expect(userState.selfReportedDistress).toBe("present");
    expect(userState.selfReportedState).toBe("overwhelmed");
    expect(userState.cognitiveOverloadState).not.toBe("present");
  });

  it("a self-report decays and expires", () => {
    const at = (ago) => buildUserState(snapshot(evidence({ selfReports: [{ ago, state: "anxious" }] })));
    expect(at(5 * MIN)._dimensions.selfReportedDistress.confidence).toBe(1);
    expect(at(25 * MIN).selfReportedDistress).toBe("none"); // confidence 0.25 < 0.5
    expect(at(31 * MIN).selfReportedDistress).toBe("unknown");
  });

  it("the latest report wins, and a positive report dampens behavioural distress-like states", () => {
    const base = { buckets: [heavyEditing()], tasks: failedAttempts() };
    const without = infer(snapshot(evidence(base)), ActivityType.STRUCTURED_TASK).states.frustration;
    const withCalm = infer(snapshot(evidence({ ...base, selfReports: [{ ago: 5 * MIN, state: "anxious" }, { ago: 20 * SEC, state: "calm" }] })), ActivityType.STRUCTURED_TASK);
    expect(withCalm.selfReport.state).toBe("calm");
    expect(withCalm.selfReport.distress).toBe(false);
    expect(withCalm.states.frustration.confidence).toBeLessThan(without.confidence);
  });

  it("labels outside the closed self-report vocabulary are ignored", () => {
    expect(infer(snapshot(evidence({ selfReports: [{ ago: SEC, state: "diagnosed" }] }))).selfReport).toBeNull();
  });
});

describe("no permanent labelling", () => {
  it("states are recomputed from evidence and vanish when it ages out", () => {
    const fresh = buildUserState(snapshot(evidence({ buckets: [heavyEditing()], tasks: failedAttempts() })), { moduleContext: { moduleId: "support.task_breakdown" } });
    expect(fresh.frustrationState).toBe("present");
    const later = buildUserState(snapshot(evidence({})), { moduleContext: { moduleId: "support.task_breakdown" } });
    expect(later.frustrationState).not.toBe("present");
  });

  it("the core nine dimensions and overallConfidence are unchanged by the contextual layer", () => {
    const withEvidence = buildUserState(snapshot(evidence({ buckets: [heavyEditing()], tasks: failedAttempts() })));
    const without = buildUserState({ timestamp: new Date(NOW).toISOString() });
    expect(withEvidence.overallConfidence).toBe(without.overallConfidence);
    expect(withEvidence.emotionalState).toBe(without.emotionalState);
  });

  it("baseline metrics are numbers only — never states or labels", () => {
    const out = infer(snapshot(evidence({ buckets: [heavyEditing(), { ago: 2 * MIN }, { ago: 3 * MIN }, { ago: 4 * MIN }], latency: [{ ago: SEC, seconds: 3 }, { ago: 2 * SEC, seconds: 4 }] })));
    for (const value of Object.values(out.metrics)) expect(typeof value).toBe("number");
    expect(JSON.stringify(out.metrics)).not.toMatch(/present|frustrat|overload|fatigue/);
  });
});

describe("mood provenance (pointer bursts are behaviour, not emotion)", () => {
  it("conversation- or check-in-based mood still drives emotional state", () => {
    expect(buildUserState({ mood: { primaryMood: "anxious", confidence: 0.8, basis: "conversation" } }).emotionalState).toBe("anxious");
    expect(buildUserState({ mood: { primaryMood: "anxious", confidence: 0.8, basis: "explicit_checkin" } }).emotionalState).toBe("anxious");
  });

  it("legacy snapshots without a basis keep the previous behaviour", () => {
    expect(buildUserState({ mood: { primaryMood: "anxious", confidence: 0.8 } }).emotionalState).toBe("anxious");
  });

  it("interaction- or activity-based mood is withheld from emotional state", () => {
    for (const basis of ["interaction", "activity", "previous_mood", "interaction_burst_recovery"]) {
      const state = buildUserState({ mood: { primaryMood: "stressed", confidence: 0.55, basis } });
      expect(state.emotionalState).toBe("unknown");
      expect(state._dimensions.emotionalState.reasons[0]).toMatch(/behavioural evidence/);
    }
  });
});

describe("in-progress evidence", () => {
  it("the bucket being filled right now (centre in the future) is counted", () => {
    // Bucket started 5 s ago: its centre is 10 s in the future.
    const ev = evidence({ tasks: failedAttempts(5 * SEC) });
    ev.buckets = [{ start: NOW - 5 * SEC, keystroke: 60, correction: 20, undo: 0, focusInterrupt: 0, navigationSwitch: 0, scrollBacktrack: 0, clarification: 0, typingGapSumMs: 0, typingGapCount: 0 }];
    const s = infer(snapshot(ev), ActivityType.STRUCTURED_TASK).states.frustration;
    expect(s.evidence.map((e) => e.feature)).toContain("corrections");
    expect(s.value).toBe(StateValue.PRESENT);
  });
});

describe("clarification requests (conversation family)", () => {
  it("repeated clarification requests + abandonment converge on cognitive overload", () => {
    const ev = evidence({ buckets: [{ ago: 30 * SEC, clarification: 3 }], tasks: [{ ago: 40 * SEC, type: "abandoned" }, { ago: 70 * SEC, type: "abandoned" }] });
    const s = infer(snapshot(ev), ActivityType.STRUCTURED_TASK).states.cognitiveOverload;
    expect(s.families).toEqual(expect.arrayContaining(["conversation", "taskOutcome"]));
    expect(s.value).toBe(StateValue.PRESENT);
  });

  it("clarification requests alone never establish overload", () => {
    const s = infer(snapshot(evidence({ buckets: [{ ago: 30 * SEC, clarification: 6 }] }))).states.cognitiveOverload;
    expect(s.value).not.toBe(StateValue.PRESENT);
  });
});

describe("legacy navigation-only evidence (tightened)", () => {
  const navigation = (rate) => ({ timestamp: new Date(NOW).toISOString(), behavior: { taskSwitchFrequency: rate, confidence: 0.7 } });

  it("one page switch describes scattered attention but stays below the trigger floor", () => {
    const state = buildUserState(navigation(0.2));
    expect(state.attentionState).toBe("scattered");
    expect(state._dimensions.attentionState.confidence).toBeLessThan(0.5);
    expect(state._dimensions.attentionState.reasons.join(" ")).toMatch(/only evidence/);
  });

  it("heavy switching does not double-count its derived complexity into high load", () => {
    const state = buildUserState(navigation(0.8));
    expect(state.cognitiveLoad).toBe("high");
    expect(state._dimensions.cognitiveLoad.confidence).toBeLessThan(0.5);
  });

  it("converging contextual fragmentation lifts the cap for an agreeing value", () => {
    const snap = { ...navigation(0.8), interactionEvidence: evidence({ buckets: [{ ago: 30 * SEC, navigationSwitch: 3, focusInterrupt: 3 }, { ago: 60 * SEC, navigationSwitch: 2, focusInterrupt: 2 }] }) };
    const state = buildUserState(snap, { moduleContext: { moduleId: "support.task_breakdown" } });
    expect(state.attentionFragmentationState).toBe("present");
    expect(state.attentionState).toBe("fragmented");
    expect(state._dimensions.attentionState.confidence).toBeGreaterThanOrEqual(0.5);
    expect(state._dimensions.attentionState.sources).toContain("contextual:attentionFragmentation");
  });

  it("contextual fragmentation never corroborates a 'focused' reading", () => {
    const snap = { timestamp: new Date(NOW).toISOString(), behavior: { taskSwitchFrequency: 0, confidence: 0.7 }, activity: { activity: "reader" },
      interactionEvidence: evidence({ buckets: [{ ago: 30 * SEC, navigationSwitch: 3, focusInterrupt: 3 }, { ago: 60 * SEC, navigationSwitch: 2, focusInterrupt: 2 }] }) };
    const state = buildUserState(snap, { moduleContext: { moduleId: "support.task_breakdown" } });
    expect(state.attentionState).toBe("focused");
    expect(state._dimensions.attentionState.confidence).toBeLessThan(0.5);
  });
});

describe("navigation-only cap holds in the live snapshot shape", () => {
  it("a neutral mood listed next to heavy switching does not lift the cap (live runtime regression)", () => {
    const live = { timestamp: new Date(NOW).toISOString(), behavior: { taskSwitchFrequency: 1, confidence: 0.7 }, mood: { primaryMood: "neutral", confidence: 0.5 } };
    const state = buildUserState(live);
    expect(state.cognitiveLoad).toBe("high");
    expect(state._dimensions.cognitiveLoad.confidence).toBeLessThan(0.5);
    expect(state._dimensions.attentionState.confidence).toBeLessThan(0.5);
  });

  it("an emotion that DECIDES overwhelming load is still honoured", () => {
    const state = buildUserState({ timestamp: new Date(NOW).toISOString(), behavior: { taskSwitchFrequency: 1, confidence: 0.7 }, mood: { primaryMood: "overwhelmed", confidence: 0.8, basis: "conversation" } });
    expect(state.cognitiveLoad).toBe("overwhelming");
    expect(state._dimensions.cognitiveLoad.confidence).toBe(0.8);
  });
});
