/**
 * temporalStability.test.js — Task 2 regression tests
 *
 * Temporal stability, hysteresis and adaptation persistence on the shipped
 * policies, driven through decide() with real snapshots (snapshot →
 * normalizer → UserState → evidence-gated policies → temporal stages).
 *
 * Shipped profiles (adaptationPolicy.js):
 *   low_stimulation / overwhelm_simplification — enter ≥0.5 persisting 3s, or
 *     ≥0.75 immediately; maintain >0.3; min 20s; cooldown 15s; max 600s.
 *   critical_urgency — no confirmation window (never delayed).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { decide } from "../adaptiveEngine.js";
import { resetAdaptiveHysteresis } from "../hysteresis.js";
import {
  AdaptationActionType,
  AdaptationDimension,
  PolicyScope,
  PriorityTier,
  TriggerCondition,
  TriggerGroupOperator,
} from "@/support/schemas/supportSchemas";
import { deriveUIModeFromPlan } from "@/components/adaptive/AdaptiveUIRuntime.jsx";

const T0 = Date.parse("2026-11-20T10:00:00.000Z");
const USER = "temporal-user";

const anxious = (confidence = 0.7) => ({ mood: { primaryMood: "anxious", confidence } });
const overwhelmed = (confidence = 0.7) => ({ mood: { primaryMood: "overwhelmed", confidence } });
const calm = () => ({ mood: { primaryMood: "calm", confidence: 0.8 } });
const staleMood = (confidence = 0.8) => ({
  mood: { primaryMood: "anxious", confidence },
  metadata: { stalenessFlags: { mood: true } },
});

function run(snapshot, atMs, extra = {}) {
  return decide({ contextSnapshot: snapshot, ...extra }, { now: T0 + atMs, userId: USER });
}

function ruleIds(outcome) {
  return outcome.plan.actions.map((action) => action.reason.match(/Policy "([^"]+)"/)?.[1]).filter(Boolean);
}

function notes(outcome) {
  return outcome.trace.overrides.filter((o) => o.kind === "hysteresis").map((o) => o.detail);
}

function modeSwitches(outcomes) {
  const modes = outcomes.map((o) => deriveUIModeFromPlan(o.plan).mode);
  return modes.slice(1).filter((mode, i) => mode !== modes[i]).length;
}

beforeEach(() => {
  resetAdaptiveHysteresis();
});

// ─────────────────────────────────────────────────────────────────

describe("alternating anxious / calm signals", () => {
  it("never enters low stimulation while the signal keeps flipping", () => {
    const outcomes = [];
    for (let i = 0; i < 10; i += 1) {
      outcomes.push(run(i % 2 === 0 ? anxious() : calm(), i * 1000));
    }
    for (const outcome of outcomes) {
      expect(ruleIds(outcome)).not.toContain("low_stimulation");
    }
    expect(modeSwitches(outcomes)).toBe(0);
    expect(notes(outcomes[0]).join(" ")).toMatch(/awaiting confirmation/);
    expect(notes(outcomes[1]).join(" ")).toMatch(/discarded transient "low_stimulation"/);
  });

  it("holds an established adaptation steady through flickering evidence", () => {
    run(anxious(), 0);
    expect(ruleIds(run(anxious(), 3000))).toContain("low_stimulation"); // confirmed

    const outcomes = [];
    for (let i = 0; i < 8; i += 1) {
      outcomes.push(run(i % 2 === 0 ? calm() : anxious(), 4000 + i * 2000));
    }
    expect(outcomes.every((o) => ruleIds(o).includes("low_stimulation"))).toBe(true);
    expect(modeSwitches(outcomes)).toBe(0);
    expect(notes(outcomes[0]).join(" ")).toMatch(/held through brief contradiction/);
  });
});

describe("brief transient signals", () => {
  it("a single moderate anxious reading never changes the UI", () => {
    const first = run(anxious(0.7), 0);
    expect(first.plan.actions).toEqual([]);
    expect(first.plan.reEvaluateAt).toBe(T0 + 3000); // confirmation check scheduled

    const after = run(calm(), 1500);
    expect(after.plan.actions).toEqual([]);
    expect(ruleIds(run(calm(), 5000))).toEqual([]);
  });
});

describe("sustained stress or overwhelm", () => {
  it("enters low stimulation once moderate anxiety persists past the confirmation window", () => {
    expect(ruleIds(run(anxious(0.7), 0))).toEqual([]);
    const entered = run(anxious(0.7), 3000);
    expect(ruleIds(entered)).toContain("low_stimulation");
    expect(notes(entered).join(" ")).toMatch(/activated "low_stimulation".*persisted 3000ms/);
    expect(ruleIds(run(anxious(0.7), 60000))).toContain("low_stimulation");
  });

  it("does not delay strong overwhelm evidence", () => {
    const outcome = run(overwhelmed(0.9), 0);
    expect(ruleIds(outcome)).toContain("overwhelm_simplification");
    expect(notes(outcome).join(" ")).toMatch(/immediate threshold/);
  });

  it("does not delay critical urgency", () => {
    const outcome = run({ conversation: { urgency: "critical", analysis: { confidence: 0.6 } } }, 0);
    expect(ruleIds(outcome)).toContain("critical_urgency");
  });
});

describe("recovery to baseline", () => {
  it("withdraws after the minimum duration once the state recovers, then cools down", () => {
    run(anxious(0.9), 0); // immediate entry
    expect(ruleIds(run(calm(), 5000))).toContain("low_stimulation"); // held (min 20s)

    const recovered = run(calm(), 25000);
    expect(ruleIds(recovered)).toEqual([]);
    expect(notes(recovered).join(" ")).toMatch(/withdrawn "low_stimulation".*recovered after minimum duration/);
    expect(deriveUIModeFromPlan(recovered.plan).mode).toBe("normal");

    // A relapse inside the 15s cooldown does not flip the UI straight back.
    const relapse = run(anxious(0.9), 30000);
    expect(ruleIds(relapse)).toEqual([]);
    expect(notes(relapse).join(" ")).toMatch(/cooldown active/);
    expect(ruleIds(run(anxious(0.9), 41000))).toContain("low_stimulation");
  });
});

describe("maintenance asymmetry (enter strong, maintain weaker)", () => {
  it("maintains on evidence that could not start a new adaptation", () => {
    expect(ruleIds(run(anxious(0.4), 0))).toEqual([]); // 0.4 < entry floor 0.5

    run(anxious(0.9), 1000); // entered
    const maintained = run(anxious(0.4), 30000);
    expect(ruleIds(maintained)).toContain("low_stimulation");
    expect(notes(maintained).join(" ")).toMatch(/maintained on weaker evidence/);

    // Evidence at/below the maintenance floor withdraws it.
    const dropped = run(anxious(0.28), 32000);
    expect(ruleIds(dropped)).toEqual([]);
    expect(notes(dropped).join(" ")).toMatch(/withdrawn "low_stimulation"/);
  });

  it("caps weak maintenance at maxDurationMs without fresh entry-level evidence", () => {
    run(anxious(0.9), 0);
    expect(ruleIds(run(anxious(0.4), 300000))).toContain("low_stimulation");
    const capped = run(anxious(0.4), 600001);
    expect(ruleIds(capped)).toEqual([]);
    expect(notes(capped).join(" ")).toMatch(/maintenance limit \(600000ms\)/);
  });

  it("renews the maintenance window whenever entry-level evidence returns", () => {
    run(anxious(0.9), 0);
    run(anxious(0.8), 500000); // fresh entry-level evidence
    expect(ruleIds(run(anxious(0.4), 900000))).toContain("low_stimulation");
  });
});

describe("explicit user override", () => {
  const preferFocus = {
    userPreferences: {
      requested: [{ id: "pref.ui_focus", target: AdaptationDimension.UI, parameters: { mode: "focus" } }],
    },
  };

  it("an explicit preference replaces an active adaptation immediately and records why", () => {
    run(anxious(0.9), 0);
    const overridden = run(anxious(0.9), 2000, preferFocus); // inside min duration
    const ui = overridden.plan.actions.filter((a) => a.target === AdaptationDimension.UI);
    expect(ui).toHaveLength(1);
    expect(ui[0].tier).toBe(PriorityTier.EXPLICIT_USER_REQUEST);
    expect(ui[0].parameters.mode).toBe("focus");
    expect(notes(overridden).join(" ")).toMatch(/withdrawn "low_stimulation".*explicit user preference/);
  });

  it("an explicit restriction withdraws an active adaptation", () => {
    run(anxious(0.9), 0);
    const restricted = run(anxious(0.9), 2000, {
      userPreferences: { restricted: [{ id: "no-ui-changes", target: AdaptationDimension.UI }] },
    });
    expect(restricted.plan.actions).toEqual([]);
    expect(notes(restricted).join(" ")).toMatch(/withdrawn "low_stimulation".*explicit user preference/);
  });
});

describe("stale evidence expiration", () => {
  it("withdraws immediately (even inside the minimum duration) when evidence goes stale", () => {
    run(anxious(0.9), 0);
    const stale = run(staleMood(), 5000);
    expect(ruleIds(stale)).toEqual([]);
    expect(notes(stale).join(" ")).toMatch(/withdrawn "low_stimulation".*no longer available \(stale or missing\)/);
  });

  it("schedules a periodic review so an idle adaptation is re-checked", () => {
    const entered = run(anxious(0.9), 0);
    expect(entered.plan.reEvaluateAt).toBeDefined();
    const sustained = run(anxious(0.9), 25000);
    expect(sustained.plan.reEvaluateAt).toBeLessThanOrEqual(T0 + 25000 + 30000);
  });
});

describe("conflicting adaptation policies", () => {
  it("a stronger mode must be confirmed before replacing a supported incumbent", () => {
    run(anxious(0.9), 0); // low_stimulation (priority 90)
    const challenged = run(overwhelmed(0.7), 1000); // overwhelm (priority 100), moderate
    // Incumbent's dimension (mood) is now "overwhelmed": contradicted but held;
    // the challenger is deferred until it persists.
    expect(ruleIds(challenged)).toEqual(["low_stimulation"]);
    expect(notes(challenged).join(" ")).toMatch(/deferred "overwhelm_simplification"/);

    const changed = run(overwhelmed(0.7), 4000);
    expect(ruleIds(changed)).toEqual(["overwhelm_simplification"]);
    expect(notes(changed).join(" ")).toMatch(/changed UI: "low_stimulation" → "overwhelm_simplification"/);
  });

  it("does not alternate between incompatible modes on flickering evidence", () => {
    run(anxious(0.9), 0);
    const outcomes = [];
    for (let i = 0; i < 8; i += 1) {
      outcomes.push(run(i % 2 === 0 ? overwhelmed(0.7) : anxious(0.7), 1000 + i * 1000));
    }
    expect(outcomes.every((o) => ruleIds(o).join() === "low_stimulation")).toBe(true);
    expect(modeSwitches(outcomes)).toBe(0);
  });

  it("safety precedence replaces an active adaptation without hysteresis", () => {
    const safetyRule = {
      id: "module.safety_calm",
      version: 1,
      scope: PolicyScope.MODULE,
      tier: PriorityTier.SAFETY,
      priority: 1,
      triggerGroups: [
        {
          operator: TriggerGroupOperator.AND,
          triggers: [{ dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" }],
        },
      ],
      action: { type: AdaptationActionType.MODIFY, target: AdaptationDimension.UI, parameters: { mode: "crisis" } },
    };
    const moduleContext = { moduleId: "safety-module", modulePolicies: [safetyRule] };
    run(anxious(0.9), 0, { moduleContext });
    const escalated = run(
      { ...anxious(0.9), conversation: { urgency: "critical", analysis: { confidence: 0.2 } } },
      1000,
      { moduleContext },
    );
    const ui = escalated.plan.actions.filter((a) => a.target === AdaptationDimension.UI);
    expect(ui).toHaveLength(1);
    expect(ui[0].tier).toBe(PriorityTier.SAFETY);
    expect(notes(escalated).join(" ")).toMatch(/withdrawn "low_stimulation".*conflict resolution/);
  });
});
