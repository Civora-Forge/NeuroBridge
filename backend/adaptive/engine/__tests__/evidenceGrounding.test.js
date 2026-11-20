/**
 * evidenceGrounding.test.js — Task 1 regression tests
 *
 * The engine must adapt on reliable user-state evidence, not on the mere
 * presence of context values:
 *   - low-confidence dimensions never trigger an adaptation on their own
 *   - missing evidence is never read as a positive signal
 *   - stale evidence never drives a new adaptation
 *   - explicit user requests keep their priority
 *   - insufficient evidence yields a neutral (no-change) decision
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decide } from "../adaptiveEngine.js";
import { resetAdaptiveHysteresis } from "../hysteresis.js";
import {
  evaluatePolicies,
  EVIDENCE_THRESHOLDS,
  EvidenceSuppressionReason,
} from "../../reasoning/adaptationPolicy.js";
import { buildUserState } from "../../state/userStateModel.js";
import {
  AdaptationActionType,
  AdaptationDimension,
  PolicyScope,
  PriorityTier,
  TriggerCondition,
  TriggerGroupOperator,
  validatePolicyRule,
} from "@/support/schemas/supportSchemas";
import { contextStore } from "@/adaptive/context/contextStore.js";
import { fuseContext } from "@/adaptive/context/contextFusion.js";
import { toContextSnapshot } from "@/adaptive/context/contextSnapshotAdapter.js";
import { deriveUIModeFromPlan } from "@/components/adaptive/AdaptiveUIRuntime.jsx";

const T0 = Date.parse("2026-11-20T10:00:00.000Z");
const USER = "evidence-user";

function rule({ id, tier = PriorityTier.CURRENT_STATE, triggers, target = AdaptationDimension.UI, parameters = { mode: "minimal" } }) {
  return validatePolicyRule({
    id,
    scope: PolicyScope.GENERIC,
    tier,
    priority: 50,
    triggerGroups: [{ operator: TriggerGroupOperator.AND, triggers }],
    action: { type: AdaptationActionType.MODIFY, target, parameters },
  });
}

/** Policy-facing aliases a real UserState exposes (see createUserStateProxy). */
const STATE_ALIASES = { emotionalState: "mood", attentionState: "attention", energyLevel: "energy", engagementLevel: "engagement" };

/** Minimal UserState-shaped object carrying per-dimension evidence. */
function stateWith(dimensions) {
  const state = { _dimensions: {} };
  for (const [name, { value, confidence, stale }] of Object.entries(dimensions)) {
    state[name] = value;
    if (STATE_ALIASES[name]) state[STATE_ALIASES[name]] = value;
    state._dimensions[name] = { value, confidence, reasons: [], sources: [], ...(stale ? { stale } : {}) };
  }
  return state;
}

const LOAD_HIGH = { dimension: "cognitiveLoad", condition: TriggerCondition.EQ, value: "high" };
const ATTENTION_SCATTERED = { dimension: "attention", condition: TriggerCondition.EQ, value: "scattered" };

function ruleIds(outcome) {
  return outcome.plan.actions.map((action) => action.reason.match(/Policy "([^"]+)"/)?.[1]);
}

beforeEach(() => {
  resetAdaptiveHysteresis();
});

// ─────────────────────────────────────────────────────────────────
//  1. Confidence-aware policy evaluation
// ─────────────────────────────────────────────────────────────────

describe("confidence-aware policy evaluation", () => {
  const single = rule({ id: "t.load_high", triggers: [LOAD_HIGH] });

  it("does not let a low-confidence dimension trigger an adaptation on its own", () => {
    const weak = stateWith({ cognitiveLoad: { value: "high", confidence: 0.3 } });
    const { triggered, suppressed } = evaluatePolicies([single], weak);
    expect(triggered).toEqual([]);
    expect(suppressed.map((s) => s.ruleId)).toEqual(["t.load_high"]);
    expect(suppressed[0].evidenceReason).toBe(EvidenceSuppressionReason.LOW_CONFIDENCE);
    expect(suppressed[0].confidence).toBe(0.3);
  });

  it("triggers the same rule when the evidence meets the threshold", () => {
    const strong = stateWith({
      cognitiveLoad: { value: "high", confidence: EVIDENCE_THRESHOLDS.minTriggerConfidence },
    });
    const { triggered, suppressed } = evaluatePolicies([single], strong);
    expect(triggered.map((t) => t.ruleId)).toEqual(["t.load_high"]);
    expect(suppressed).toEqual([]);
  });

  it("allows a weak dimension to corroborate, but not replace, strong evidence", () => {
    const combined = rule({ id: "t.combined", triggers: [LOAD_HIGH, ATTENTION_SCATTERED] });

    const strongPlusWeak = stateWith({
      cognitiveLoad: { value: "high", confidence: 0.8 },
      attentionState: { value: "scattered", confidence: 0.3 },
    });
    expect(evaluatePolicies([combined], strongPlusWeak).triggered).toHaveLength(1);

    const bothWeak = stateWith({
      cognitiveLoad: { value: "high", confidence: 0.4 },
      attentionState: { value: "scattered", confidence: 0.3 },
    });
    expect(evaluatePolicies([combined], bothWeak).triggered).toEqual([]);

    // Below the supporting floor the weak dimension counts as absent.
    const strongPlusNegligible = stateWith({
      cognitiveLoad: { value: "high", confidence: 0.9 },
      attentionState: { value: "scattered", confidence: 0.1 },
    });
    expect(evaluatePolicies([combined], strongPlusNegligible).triggered).toEqual([]);
  });

  it("honours threshold overrides passed to evaluatePolicies", () => {
    const state = stateWith({ cognitiveLoad: { value: "high", confidence: 0.3 } });
    const { triggered } = evaluatePolicies([single], state, { evidence: { minTriggerConfidence: 0.25 } });
    expect(triggered).toHaveLength(1);
  });

  it("exempts Tier 1 SAFETY rules from the confidence floor", () => {
    const safety = rule({ id: "t.safety", tier: PriorityTier.SAFETY, triggers: [LOAD_HIGH] });
    const weak = stateWith({ cognitiveLoad: { value: "high", confidence: 0.1 } });
    expect(evaluatePolicies([safety], weak).triggered.map((t) => t.ruleId)).toEqual(["t.safety"]);
  });

  it("keeps the shipped policies intact for strong, fresh UserState evidence", () => {
    const state = buildUserState({
      mood: { primaryMood: "overwhelmed", confidence: 0.9 },
    });
    const outcome = decide({ contextSnapshot: { mood: { primaryMood: "overwhelmed", confidence: 0.9 } } }, { now: T0, userId: USER });
    expect(state._dimensions.cognitiveLoad.confidence).toBe(0.9);
    expect(ruleIds(outcome)).toContain("overwhelm_simplification");
  });
});

// ─────────────────────────────────────────────────────────────────
//  2. Missing evidence is never a positive signal
// ─────────────────────────────────────────────────────────────────

describe("missing evidence", () => {
  const notCalm = rule({
    id: "t.not_calm",
    triggers: [{ dimension: "mood", condition: TriggerCondition.NOT_IN, value: ["calm", "content"] }],
  });

  it("does not satisfy a not_in trigger with an unknown value", () => {
    expect(evaluatePolicies([notCalm], buildUserState({})).triggered).toEqual([]);
  });

  it("does not satisfy a not_in trigger when the dimension is absent from a plain state", () => {
    expect(evaluatePolicies([notCalm], {}).triggered).toEqual([]);
    expect(evaluatePolicies([notCalm], { mood: null }).triggered).toEqual([]);
  });

  it("still satisfies not_in for a known value with adequate evidence", () => {
    const state = buildUserState({ mood: { primaryMood: "anxious", confidence: 0.8 } });
    expect(evaluatePolicies([notCalm], state).triggered.map((t) => t.ruleId)).toEqual(["t.not_calm"]);
  });

  it("treats the tracker's zero-confidence behavior counters as absence, not 'focused'", () => {
    // The live tracker reports taskSwitchFrequency: 0 with confidence 0 before
    // it has observed any typing, scrolling or movement.
    const idle = {
      activity: { activity: "reader", currentModule: "reader" },
      behavior: { taskSwitchFrequency: 0, idleDuration: 3, confidence: 0 },
    };
    const state = buildUserState(idle);
    expect(state.attentionState).toBe("unknown");
    expect(state.taskComplexity).toBe("unknown");
    expect(ruleIds(decide({ contextSnapshot: idle }, { now: T0, userId: USER }))).not.toContain("focus_mode");

    // With real behavioral evidence the same counters are meaningful.
    // Focus mode must persist past its confirmation window before entering
    // (Task 2), so evaluate twice across that window.
    const observed = { ...idle, behavior: { ...idle.behavior, confidence: 0.7 } };
    expect(buildUserState(observed).attentionState).toBe("focused");
    expect(ruleIds(decide({ contextSnapshot: observed }, { now: T0, userId: USER }))).not.toContain("focus_mode");
    expect(ruleIds(decide({ contextSnapshot: observed }, { now: T0 + 10000, userId: USER }))).toContain("focus_mode");
  });

  it("grounds urgency confidence in the conversation analysis confidence", () => {
    const weakKeyword = {
      conversation: { urgency: "critical", analysis: { confidence: 0.3 } },
    };
    expect(buildUserState(weakKeyword)._dimensions.urgency.confidence).toBe(0.3);
    expect(ruleIds(decide({ contextSnapshot: weakKeyword }, { now: T0, userId: USER }))).not.toContain(
      "critical_urgency",
    );

    const confident = { conversation: { urgency: "critical", analysis: { confidence: 0.9 } } };
    expect(ruleIds(decide({ contextSnapshot: confident }, { now: T0, userId: USER }))).toContain("critical_urgency");
  });
});

// ─────────────────────────────────────────────────────────────────
//  3. Stale evidence
// ─────────────────────────────────────────────────────────────────

describe("stale evidence", () => {
  const overwhelmed = { mood: { primaryMood: "overwhelmed", confidence: 0.9 } };

  it("withdraws stale mood evidence so it cannot drive a new adaptation", () => {
    const stale = { ...overwhelmed, metadata: { stalenessFlags: { mood: true } } };
    const state = buildUserState(stale);
    expect(state.emotionalState).toBe("unknown");
    expect(state.cognitiveLoad).toBe("unknown");
    expect(state.staleSignals).toEqual(expect.arrayContaining(["emotion"]));
    expect(state._dimensions.emotionalState.reasons.join(" ")).toMatch(/stale/);

    const outcome = decide({ contextSnapshot: stale }, { now: T0, userId: USER });
    expect(outcome.plan.actions).toEqual([]);
  });

  it("marks a rule whose matched dimension carries stale evidence as suppressed", () => {
    const single = rule({ id: "t.load_high", triggers: [LOAD_HIGH] });
    const stale = stateWith({ cognitiveLoad: { value: "high", confidence: 0.9, stale: true } });
    const { triggered, suppressed } = evaluatePolicies([single], stale);
    expect(triggered).toEqual([]);
    expect(suppressed[0].evidenceReason).toBe(EvidenceSuppressionReason.STALE);
  });

  it("ignores stale conversation urgency", () => {
    const snapshot = {
      conversation: { urgency: "critical", analysis: { confidence: 0.9 } },
      metadata: { stalenessFlags: { conversation: true } },
    };
    const state = buildUserState(snapshot);
    expect(state.urgency).toBe("unknown");
    expect(state._dimensions.urgency.reasons.join(" ")).toMatch(/stale/);
    expect(ruleIds(decide({ contextSnapshot: snapshot }, { now: T0, userId: USER }))).not.toContain(
      "critical_urgency",
    );
  });

  it("ignores an explicit request older than the conversation freshness window", () => {
    const fresh = {
      timestamp: "2026-11-20T10:01:00.000Z",
      explicitRequests: { requestType: "explicit_help_request", timestamp: "2026-11-20T10:00:30.000Z", confidence: 0.9 },
    };
    expect(buildUserState(fresh).urgency).toBe("high");

    const old = { ...fresh, timestamp: "2026-11-20T10:10:00.000Z" };
    const state = buildUserState(old);
    expect(state.urgency).toBe("unknown");
    expect(state.staleSignals).toContain("explicitRequest");
  });

  describe("live Role 1 fusion → engine", () => {
    afterEach(() => {
      vi.useRealTimers();
      contextStore.reset();
    });

    function liveSnapshot() {
      return toContextSnapshot(fuseContext({}));
    }

    it("adapts on fresh fused mood evidence and stops once it goes stale", () => {
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      contextStore.reset();
      contextStore.updateContext(
        "mood",
        { primaryMood: "overwhelmed", confidence: 0.9, timestamp: new Date(T0).toISOString() },
        "moodAgent",
        0.9,
      );

      const fresh = decide({ contextSnapshot: liveSnapshot() }, { now: T0, userId: USER });
      expect(ruleIds(fresh)).toContain("overwhelm_simplification");

      // Mood TTL is 90 s; three minutes later the same reading is stale.
      vi.setSystemTime(T0 + 180000);
      resetAdaptiveHysteresis();
      const later = liveSnapshot();
      expect(later.metadata.stalenessFlags.mood).toBe(true);
      const stale = decide({ contextSnapshot: later }, { now: T0 + 180000, userId: USER });
      expect(ruleIds(stale)).not.toContain("overwhelm_simplification");
    });
  });
});

// ─────────────────────────────────────────────────────────────────
//  4. Explicit user requests keep their priority
// ─────────────────────────────────────────────────────────────────

describe("explicit user requests", () => {
  const request = {
    requested: [{ id: "pref.ui_quiet", target: AdaptationDimension.UI, parameters: { mode: "quiet" } }],
  };

  it("are honoured even when state evidence is insufficient", () => {
    const outcome = decide({ contextSnapshot: {}, userPreferences: request }, { now: T0, userId: USER });
    expect(outcome.plan.actions).toHaveLength(1);
    expect(outcome.plan.actions[0].tier).toBe(PriorityTier.EXPLICIT_USER_REQUEST);
    expect(outcome.plan.actions[0].parameters.mode).toBe("quiet");
    expect(outcome.trace.preferenceResult.appliedRequests).toEqual(["pref.ui_quiet"]);
  });

  it("still outrank strong state-driven candidates on the same target", () => {
    const outcome = decide(
      {
        contextSnapshot: { mood: { primaryMood: "overwhelmed", confidence: 0.95 } },
        userPreferences: request,
      },
      { now: T0, userId: USER },
    );
    const ui = outcome.plan.actions.filter((a) => a.target === AdaptationDimension.UI);
    expect(ui[0].tier).toBe(PriorityTier.EXPLICIT_USER_REQUEST);
    expect(ui[0].parameters.mode).toBe("quiet");
  });

  it("keep an explicit mood check-in (confidence 1.0) above the evidence threshold", () => {
    const outcome = decide(
      { contextSnapshot: { mood: { primaryMood: "anxious", confidence: 1.0 } } },
      { now: T0, userId: USER },
    );
    expect(ruleIds(outcome)).toContain("low_stimulation");
  });
});

// ─────────────────────────────────────────────────────────────────
//  5. Insufficient evidence → neutral decision
// ─────────────────────────────────────────────────────────────────

describe("insufficient evidence", () => {
  afterEach(() => {
    contextStore.reset();
  });

  it("produces a neutral, no-change plan for an empty snapshot", () => {
    const outcome = decide({ contextSnapshot: {} }, { now: T0, userId: USER });
    expect(outcome.plan.actions).toEqual([]);
    expect(outcome.plan.situation).toBe("insufficient_information");
    const ui = deriveUIModeFromPlan(outcome.plan);
    expect(ui.mode).toBe("normal");
    expect(ui.active).toBe(false);
  });

  it("produces a neutral plan for a default live snapshot (no observations yet)", () => {
    contextStore.reset();
    const snapshot = toContextSnapshot(fuseContext({}));
    const outcome = decide({ contextSnapshot: snapshot }, { now: T0, userId: USER });
    expect(outcome.plan.actions).toEqual([]);
    expect(deriveUIModeFromPlan(outcome.plan).mode).toBe("normal");
  });

  it("explains a weak-evidence neutral decision in the trace", () => {
    const weak = { mood: { primaryMood: "anxious", confidence: 0.3 } };
    const outcome = decide({ contextSnapshot: weak }, { now: T0, userId: USER });
    expect(outcome.plan.actions).toEqual([]);
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain("low_stimulation");
    const evidence = outcome.trace.overrides.filter((o) => o.kind === "evidence");
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0].applied).toBe(false);
    expect(evidence[0].detail).toMatch(/low_confidence_evidence/);
  });
});
