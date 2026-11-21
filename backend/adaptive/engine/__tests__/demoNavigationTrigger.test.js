/**
 * demoNavigationTrigger.test.js — DEMO-ONLY repeated-navigation trigger
 * through the real decision pipeline. Production evidence rules (navigation
 * alone never triggers) must hold whenever the demo option is absent.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { decide } from "../adaptiveEngine.js";
import { resetAdaptiveHysteresis } from "../hysteresis.js";
import { DEMO_NAVIGATION_COOLDOWN_MS, DEMO_NAVIGATION_POLICY, EVIDENCE_THRESHOLDS } from "../../reasoning/adaptationPolicy.js";
import { NAVIGATION_ONLY_CAP } from "../../state/userStateModel.js";
import { buildModuleContext } from "@/support/framework/moduleContextAdapter";
import { resolvePlanExecution, resetExecutionStore } from "@/adaptive/execution/uiExecution";
import { deriveInterventionRecommendation, hasStateDrivenAction } from "@/components/adaptive/AdaptiveUIRuntime.jsx";

const T0 = Date.parse("2026-11-21T12:00:00.000Z");
const USER = "demo-user";

/** App-level snapshot with `count` real page switches in the last 60 s. */
const snap = (now, count, extra = {}) => ({
  timestamp: new Date(now).toISOString(),
  behavior: { taskSwitchFrequency: Math.min(1, count / 5), confidence: 0.7 },
  interactionEvidence: { observedAt: now, bucketMs: 30000, buckets: [], taskEvents: [], latencySamples: [], selfReports: [], recentNavigationSwitches: { windowMs: 60000, count } },
  ...extra,
});
const ruleIds = (plan) => plan.actions.map((a) => (a.evidence.find((e) => e.startsWith("policy:")) ?? "").replace(/^policy:|@v\d+$/g, ""));
const run = (now, count, { demo = true, ...rest } = {}) =>
  decide({ contextSnapshot: snap(now, count), ...rest }, { now, userId: USER, ...(demo ? { demoNavigationTrigger: true } : {}) });

beforeEach(() => {
  resetAdaptiveHysteresis();
  resetExecutionStore();
});

describe("demo repeated-navigation trigger", () => {
  it("3 switches in 60 s: no popup", () => {
    const outcome = run(T0, 3);
    expect(ruleIds(outcome.plan)).not.toContain("demo_navigation_continuity");
    expect(hasStateDrivenAction(outcome.plan)).toBe(false);
  });

  it("4 switches in 60 s: contextual continuity offer in demo mode", () => {
    const outcome = run(T0, 4);
    expect(ruleIds(outcome.plan)).toContain("demo_navigation_continuity");
    expect(deriveInterventionRecommendation(outcome.plan).id).toBe("task_continuity_help");
    expect(outcome.trace.sources).toContain("demo_navigation_trigger");
  });

  it("4 switches in 60 s with demo OFF: navigation alone triggers nothing", () => {
    for (const count of [4, 6, 10]) {
      resetAdaptiveHysteresis();
      run(T0, count, { demo: false });
      const later = run(T0 + 11000, count, { demo: false });
      expect(later.plan.actions).toEqual([]);
      expect(later.trace.sources).not.toContain("demo_navigation_trigger");
      expect(later.plan.userStateReference.demoNavigationBurst).toBeUndefined();
    }
  });

  it("the production gates are unchanged (floor 0.5, navigation cap 0.45)", () => {
    expect(EVIDENCE_THRESHOLDS.minTriggerConfidence).toBe(0.5);
    expect(NAVIGATION_ONLY_CAP).toBe(0.45);
    const outcome = run(T0, 10, { demo: false });
    expect(outcome.plan.userStateReference._dimensions.attentionState.confidence).toBeLessThanOrEqual(NAVIGATION_ONLY_CAP);
  });

  it("cooldown: after the offer is withdrawn it does not return on the next burst", () => {
    expect(ruleIds(run(T0, 4).plan)).toContain("demo_navigation_continuity");
    // The burst ages out of the 60 s window; the adaptation is withdrawn
    // after its minimum duration.
    const withdrawn = run(T0 + 70000, 0);
    expect(ruleIds(withdrawn.plan)).not.toContain("demo_navigation_continuity");
    expect(withdrawn.trace.overrides.some((o) => /withdrawn "demo_navigation_continuity"/.test(o.detail))).toBe(true);
    // A new burst within the cooldown: no offer.
    const again = run(T0 + 120000, 5);
    expect(ruleIds(again.plan)).not.toContain("demo_navigation_continuity");
    expect(again.trace.overrides.some((o) => /cooldown active/.test(o.detail))).toBe(true);
    // After the cooldown: it may appear again.
    const afterCooldown = run(T0 + 70000 + DEMO_NAVIGATION_COOLDOWN_MS + 1000, 4);
    expect(ruleIds(afterCooldown.plan)).toContain("demo_navigation_continuity");
  });

  it("a missing navigation count stays missing (no fabricated trigger)", () => {
    const outcome = decide(
      { contextSnapshot: { timestamp: new Date(T0).toISOString(), interactionEvidence: { observedAt: T0, buckets: [] } } },
      { now: T0, userId: USER, demoNavigationTrigger: true },
    );
    expect(ruleIds(outcome.plan)).not.toContain("demo_navigation_continuity");
  });

  it("safety and consent still apply (CAUTION module → consent required)", () => {
    const outcome = run(T0, 4, { moduleContext: buildModuleContext("support.grounding") });
    const resolution = resolvePlanExecution(outcome.plan, { trace: outcome.trace });
    const pending = resolution.pendingConsent.find((p) => p.ruleId === "demo_navigation_continuity");
    expect(pending).toBeDefined();
    expect(pending.action.parameters.taskContinuityHelp).toBe(true);
  });

  it("is a non-UI action: Stage C stays off and no UI mode is applied", () => {
    expect(DEMO_NAVIGATION_POLICY.action.target).not.toBe("UI");
    const outcome = run(T0, 4);
    const resolution = resolvePlanExecution(outcome.plan, { trace: outcome.trace });
    expect((resolution.effectivePlan?.actions ?? []).every((a) => a.target !== "UI")).toBe(true);
  });
});
