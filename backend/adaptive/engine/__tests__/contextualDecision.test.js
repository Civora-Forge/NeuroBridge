/**
 * contextualDecision.test.js — contextual states through the real decision
 * pipeline: evidence gate → module-scoped hysteresis → safety → planner →
 * execution guard → support offer. Stage C (UI execution) stays OFF.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decide } from "../adaptiveEngine.js";
import { adaptationStateKey, readAdaptationState, resetAdaptiveHysteresis } from "../hysteresis.js";
import { isUIExecutionEnabled, resetAdaptiveFlags, resolveDefaultFlags } from "../featureFlags.js";
import { CONTEXTUAL_POLICY_IDS } from "../../reasoning/adaptationPolicy.js";
import { buildModuleContext } from "@/support/framework/moduleContextAdapter";
import { resolvePlanExecution, resetExecutionStore } from "@/adaptive/execution/uiExecution";
import { deriveInterventionRecommendation, hasStateDrivenAction } from "@/components/adaptive/AdaptiveUIRuntime.jsx";

const T0 = Date.parse("2026-11-21T12:00:00.000Z");
const SEC = 1000;
const USER = "ctx-user";

/** Evidence fixture anchored at `now`; `ago` relative to that decision. */
function snapshotAt(now, { buckets = [], tasks = [], latency = [], selfReports = [], lastKeystrokeAgo = null, extra = {} } = {}) {
  return {
    timestamp: new Date(now).toISOString(),
    interactionEvidence: {
      observedAt: now,
      bucketMs: 30 * SEC,
      buckets: buckets.map(({ ago, ...c }) => ({
        start: now - ago - 15 * SEC, keystroke: 0, correction: 0, undo: 0, focusInterrupt: 0,
        navigationSwitch: 0, scrollBacktrack: 0, typingGapSumMs: 0, typingGapCount: 0, ...c,
      })),
      taskEvents: tasks.map(({ ago, ...rest }) => ({ moduleId: "support.task_breakdown", ...rest, at: now - ago })),
      latencySamples: latency.map(({ ago, seconds }) => ({ at: now - ago, seconds })),
      selfReports: selfReports.map(({ ago, ...rest }) => ({ source: "mood_checkin", ...rest, at: now - ago })),
      lastKeystrokeAt: lastKeystrokeAgo === null ? null : now - lastKeystrokeAgo,
    },
    ...extra,
  };
}

const frustrated = (now) => snapshotAt(now, {
  buckets: [{ ago: 30 * SEC, keystroke: 60, correction: 20 }],
  tasks: [{ ago: 30 * SEC, type: "failed" }, { ago: 25 * SEC, type: "started", retry: true }, { ago: 20 * SEC, type: "failed" }],
});
const overloaded = (now) => snapshotAt(now, {
  tasks: [{ ago: 40 * SEC, type: "abandoned" }, { ago: 70 * SEC, type: "abandoned" }],
  latency: [{ ago: 30 * SEC, seconds: 24 }, { ago: 60 * SEC, seconds: 26 }],
});
const fragmented = (now) => snapshotAt(now, {
  buckets: [{ ago: 30 * SEC, navigationSwitch: 3, focusInterrupt: 3 }, { ago: 60 * SEC, navigationSwitch: 2, focusInterrupt: 2 }],
});
const fatigueBaseline = { version: 1, activities: { general: { metrics: { typingGapMs: { n: 20, mean: 200, m2: 19 * 900 } } } } };
const fatigued = (now) => snapshotAt(now, {
  buckets: [{ ago: 30 * SEC, keystroke: 20, typingGapSumMs: 9000, typingGapCount: 20 }],
  lastKeystrokeAgo: 60 * SEC,
  extra: { deviceInteraction: { timeSinceLastInteraction: 300, currentSessionDuration: 1800 } },
});
const selfReported = (now) => snapshotAt(now, { selfReports: [{ ago: 30 * SEC, state: "overwhelmed" }] });

const TASK = () => buildModuleContext("support.task_breakdown");

function run(snapshotFn, times, { moduleContext, baseline, userId = USER } = {}) {
  let outcome;
  for (const t of times) {
    outcome = decide({ contextSnapshot: snapshotFn(T0 + t), moduleContext }, { now: T0 + t, userId, baseline });
  }
  return outcome;
}
const ruleIds = (plan) => plan.actions.map((a) => (a.evidence.find((e) => e.startsWith("policy:")) ?? "").replace(/^policy:|@v\d+$/g, ""));

beforeEach(() => {
  resetAdaptiveHysteresis();
  resetExecutionStore();
  resetAdaptiveFlags();
});
afterEach(() => resetAdaptiveFlags());

describe("each inferred state reaches a distinct adaptive response after confirmation", () => {
  const cases = [
    ["frustration", frustrated, { moduleContext: TASK() }, "frustration_assistance", "ASSISTANCE", "contextual_help", [0, 11 * SEC]],
    ["cognitive overload", overloaded, { moduleContext: TASK() }, "contextual_overload_support", "TASK", "transition_support", [0, 11 * SEC]],
    ["attention fragmentation", fragmented, { moduleContext: TASK() }, "fragmentation_focus_support", "INTERACTION", "grounding_exercise", [0, 11 * SEC]],
    ["cognitive fatigue", fatigued, { baseline: fatigueBaseline }, "fatigue_pause_support", "PACING", "calm_space", [0, 31 * SEC]],
    ["self-reported distress", selfReported, {}, "self_reported_distress_support", "ASSISTANCE", "grounding_activity", [0]],
  ];

  for (const [name, fn, options, rule, target, card, times] of cases) {
    it(`${name} → ${rule} (${target}) → ${card} offer`, () => {
      const first = run(fn, [0], options);
      if (times.length > 1) {
        // Inferred states wait out their confirmation window first.
        expect(ruleIds(first.plan)).not.toContain(rule);
      }
      const outcome = run(fn, times, options);
      expect(ruleIds(outcome.plan)).toContain(rule);
      const action = outcome.plan.actions.find((a) => ruleIds({ actions: [a] })[0] === rule);
      expect(action.target).toBe(target);
      expect(hasStateDrivenAction(outcome.plan)).toBe(true);
      expect(deriveInterventionRecommendation(outcome.plan).id).toBe(card);
    });
  }

  it("a self-report needs no confirmation window but an inferred state does", () => {
    expect(ruleIds(run(selfReported, [0]).plan)).toContain("self_reported_distress_support");
    expect(ruleIds(run(frustrated, [0], { moduleContext: TASK() }).plan)).not.toContain("frustration_assistance");
  });
});

describe("isolated or transient signals do not reach the plan", () => {
  it("a pointer burst alone produces no contextual or low-stimulation adaptation", () => {
    const snap = (now) => snapshotAt(now, {
      buckets: [{ ago: 5 * SEC }],
      extra: { behavior: { movementBurst: { active: true } }, mood: { primaryMood: "stressed", confidence: 0.55, basis: "interaction" } },
    });
    const outcome = run(snap, [0, 4 * SEC, 30 * SEC]);
    expect(outcome.plan.actions).toHaveLength(0);
    expect(hasStateDrivenAction(outcome.plan)).toBe(false);
  });

  it("a transient spike that disappears before confirmation never activates", () => {
    decide({ contextSnapshot: frustrated(T0), moduleContext: TASK() }, { now: T0, userId: USER });
    const quiet = decide({ contextSnapshot: snapshotAt(T0 + 11 * SEC, { buckets: [{ ago: 5 * SEC, keystroke: 40 }] }), moduleContext: TASK() }, { now: T0 + 11 * SEC, userId: USER });
    expect(ruleIds(quiet.plan)).not.toContain("frustration_assistance");
  });

  it("explicit preferences are never evidence of distress", () => {
    const outcome = decide(
      { contextSnapshot: snapshotAt(T0), userPreferences: { accessibility: { reduceMotion: true } } },
      { now: T0, userId: USER },
    );
    expect(ruleIds(outcome.plan).filter((id) => CONTEXTUAL_POLICY_IDS.includes(id))).toEqual([]);
    expect(hasStateDrivenAction(outcome.plan)).toBe(false);
  });
});

describe("recovery and withdrawal", () => {
  it("an active contextual adaptation is withdrawn after recovery and the minimum duration", () => {
    const active = run(frustrated, [0, 11 * SEC], { moduleContext: TASK() });
    expect(ruleIds(active.plan)).toContain("frustration_assistance");
    const calm = (now) => snapshotAt(now, { buckets: [{ ago: 10 * SEC, keystroke: 40 }] });
    const later = decide({ contextSnapshot: calm(T0 + 60 * SEC), moduleContext: TASK() }, { now: T0 + 60 * SEC, userId: USER });
    expect(ruleIds(later.plan)).not.toContain("frustration_assistance");
    expect(later.trace.overrides.some((o) => o.kind === "hysteresis" && /withdrawn "frustration_assistance"/.test(o.detail))).toBe(true);
  });
});

describe("module state scopes are isolated", () => {
  it("confirmation in one module does not confirm the same state in another module", () => {
    const grounding = buildModuleContext("support.focus_session");
    decide({ contextSnapshot: frustrated(T0), moduleContext: TASK() }, { now: T0, userId: USER });
    // Same user, different module, 11 s later: its own confirmation clock starts now.
    const other = decide({ contextSnapshot: frustrated(T0 + 11 * SEC), moduleContext: grounding }, { now: T0 + 11 * SEC, userId: USER });
    expect(ruleIds(other.plan)).not.toContain("frustration_assistance");
    expect(readAdaptationState(adaptationStateKey(USER, "support.task_breakdown", "ASSISTANCE"))?.pendingRuleId).toBe("frustration_assistance");
    expect(readAdaptationState(adaptationStateKey(USER, "support.focus_session", "ASSISTANCE"))?.pendingSince).toBe(T0 + 11 * SEC);
  });

  it("module-level decision paths keep their own scope (H4 isolation preserved)", () => {
    decide({ contextSnapshot: frustrated(T0), moduleContext: TASK() }, { now: T0, userId: USER, stateScope: "module:support.task_breakdown" });
    const app = decide({ contextSnapshot: frustrated(T0 + 11 * SEC), moduleContext: TASK() }, { now: T0 + 11 * SEC, userId: USER });
    expect(ruleIds(app.plan)).not.toContain("frustration_assistance");
  });
});

describe("existing gates stay authoritative", () => {
  it("Stage C is off by default and production env does not enable it", () => {
    expect(isUIExecutionEnabled()).toBe(false);
    const env = readFileSync(resolve(process.cwd(), ".env.production"), "utf8");
    expect(env).not.toMatch(/^\s*VITE_NEUROBRIDGE_ADAPTIVE_UI_EXECUTION\s*=\s*(true|1)\s*$/m);
    expect(resolveDefaultFlags({ VITE_NEUROBRIDGE_ADAPTIVE_RUNTIME: "true", VITE_NEUROBRIDGE_ADAPTIVE_REFLECTION: "true" }).uiExecution).toBe(false);
  });

  it("contextual adaptations are non-UI: no UI mode is applied with Stage C off", () => {
    const outcome = run(frustrated, [0, 11 * SEC], { moduleContext: TASK() });
    const resolution = resolvePlanExecution(outcome.plan, { trace: outcome.trace });
    expect(resolution.records.filter((r) => r.target === "UI").every((r) => r.status === "rejected")).toBe(true);
    expect(resolution.effectivePlan.actions.every((a) => a.target !== "UI")).toBe(true);
  });

  it("CAUTION modules still require consent for contextual adaptations, with parameters intact (H2/H3)", () => {
    const grounding = buildModuleContext("support.grounding");
    const outcome = run(selfReported, [0], { moduleContext: grounding });
    const resolution = resolvePlanExecution(outcome.plan, { trace: outcome.trace });
    const pending = resolution.pendingConsent.find((p) => p.ruleId === "self_reported_distress_support");
    expect(pending).toBeDefined();
    expect(pending.action.parameters.offerGrounding).toBe(true);
    expect(pending.action.parameters.requireConfirmation).toBe(true);
  });

  it("a safety-blocked decision suppresses contextual offers too", () => {
    const outcome = run(selfReported, [0]);
    const resolution = resolvePlanExecution(outcome.plan, {
      trace: { ...outcome.trace, safetyResult: { ...outcome.trace.safetyResult, disposition: "BLOCK" } },
    });
    expect(resolution.suppressRecommendations).toBe(true);
    expect(resolution.effectivePlan).toBeNull();
  });

  it("decision traces explain contextual states through matched triggers and evidence", () => {
    const outcome = run(frustrated, [0, 11 * SEC], { moduleContext: TASK() });
    const action = outcome.plan.actions.find((a) => ruleIds({ actions: [a] })[0] === "frustration_assistance");
    expect(action.evidence).toContain('trigger:frustrationState == "present"');
    expect(outcome.plan.userStateReference._dimensions.frustrationState.state.evidence.length).toBeGreaterThan(0);
    expect(outcome.plan.situation).toBe("frustration");
  });
});

describe("contextual help keeps consent and safety", () => {
  it("in a CAUTION module the frustration response waits for consent, parameters intact", () => {
    // CAUTION module with a general activity profile (in reflective-writing
    // modules editing is normal and frustration correctly stays below threshold).
    const caution = buildModuleContext("support.gentle_activity");
    const outcome = run(frustrated, [0, 11 * SEC], { moduleContext: caution });
    const resolution = resolvePlanExecution(outcome.plan, { trace: outcome.trace });
    const pending = resolution.pendingConsent.find((p) => p.ruleId === "frustration_assistance");
    expect(pending).toBeDefined();
    expect(pending.action.parameters.contextualAssistance).toBe(true);
    expect(resolution.records.find((r) => r.ruleId === "frustration_assistance").status).toBe("deferred");
  });
});
