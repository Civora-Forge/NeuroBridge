import { describe, it, expect } from "vitest";
import {
  ADAPTATION_RULES,
  ADAPTATION_POLICIES,
  determineAdaptation,
  getAvailableFeatures,
  checkAdaptationRecommendation,
  selectRules,
  evaluatePolicies,
  adaptationPolicy,
} from "../adaptationPolicy.js";
import {
  PolicyScope,
  PriorityTier,
  TriggerCondition,
} from "@/support/schemas/supportSchemas";

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Build a UserState-shaped object with top-level string dimension values,
 * matching the shape produced by buildUserState.
 */
function makeState(overrides = {}) {
  return {
    emotionalState: "unknown",
    cognitiveLoad: "unknown",
    energyLevel: "unknown",
    attention: "unknown",
    stressLevel: "unknown",
    motivationLevel: "unknown",
    urgency: "unknown",
    taskComplexity: "unknown",
    engagementLevel: "unknown",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────
//  Policy contracts
// ─────────────────────────────────────────────────────────────────

describe("ADAPTATION_POLICIES (PolicyRule contract)", () => {
  it("migrates the six legacy rule IDs with preserved numeric priorities", () => {
    const ids = ADAPTATION_POLICIES.map((p) => p.id);
    expect(ids).toEqual([
      "critical_urgency",
      "overwhelm_simplification",
      "low_stimulation",
      "high_load_minimal",
      "scattered_guidance",
      "focus_mode",
    ]);
  });

  it("places every policy at Tier 8 (CURRENT_STATE)", () => {
    for (const policy of ADAPTATION_POLICIES) {
      expect(policy.tier).toBe(PriorityTier.CURRENT_STATE);
    }
  });

  it("keeps the tier priorities in the legacy numeric order (110..60)", () => {
    const priorities = ADAPTATION_POLICIES.map((p) => p.priority);
    expect(priorities).toEqual([110, 100, 90, 80, 70, 60]);
  });

  it("declares only generic scope", () => {
    for (const policy of ADAPTATION_POLICIES) {
      expect(policy.scope).toBe(PolicyScope.GENERIC);
    }
  });

  it("exposes action parameters containing mode and adaptationType", () => {
    for (const policy of ADAPTATION_POLICIES) {
      expect(policy.action).toBeDefined();
      expect(typeof policy.action.parameters?.mode).toBe("string");
      expect(typeof policy.action.parameters?.adaptationType).toBe("string");
    }
  });
});

describe("legacy ADAPTATION_RULES", () => {
  it("remains unchanged with the six original entries", () => {
    expect(Array.isArray(ADAPTATION_RULES)).toBe(true);
    expect(ADAPTATION_RULES).toHaveLength(6);
    expect(ADAPTATION_RULES.map((r) => r.id)).toEqual([
      "overwhelm_simplification",
      "high_load_minimal",
      "low_stimulation",
      "focus_mode",
      "scattered_guidance",
      "critical_urgency",
    ]);
  });

  it("retains the legacy shape (triggers/uiMode/parameters/priority)", () => {
    for (const rule of ADAPTATION_RULES) {
      expect(Array.isArray(rule.triggers)).toBe(true);
      expect(typeof rule.uiMode).toBe("string");
      expect(typeof rule.parameters).toBe("object");
      expect(typeof rule.priority).toBe("number");
    }
  });
});

// ─────────────────────────────────────────────────────────────────
//  Trigger semantics
// ─────────────────────────────────────────────────────────────────

describe("trigger group semantics", () => {
  it("does NOT fire a rule when only one of two AND-group triggers matches", () => {
    const rule = {
      id: "two_conditions",
      scope: PolicyScope.GENERIC,
      tier: PriorityTier.CURRENT_STATE,
      priority: 1,
      triggerGroups: [
        {
          operator: "and",
          triggers: [
            { dimension: "cognitiveLoad", condition: TriggerCondition.EQ, value: "overwhelming" },
            { dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" },
          ],
        },
      ],
      action: { type: "modify", target: "ui", parameters: { mode: "test" } },
    };

    const partial = evaluatePolicies([rule], makeState({ cognitiveLoad: "overwhelming" }));
    expect(partial.triggered).toHaveLength(0);

    const full = evaluatePolicies(
      [rule],
      makeState({ cognitiveLoad: "overwhelming", urgency: "critical" }),
    );
    expect(full.triggered).toHaveLength(1);
  });

  it("fires when ANY trigger group is fully satisfied (OR across groups)", () => {
    const rule = {
      id: "low_stim",
      scope: PolicyScope.GENERIC,
      tier: PriorityTier.CURRENT_STATE,
      priority: 90,
      triggerGroups: [
        {
          operator: "and",
          triggers: [{ dimension: "mood", condition: TriggerCondition.EQ, value: "anxious" }],
        },
        {
          operator: "and",
          triggers: [{ dimension: "mood", condition: TriggerCondition.EQ, value: "panicked" }],
        },
      ],
      action: { type: "modify", target: "ui", parameters: { mode: "low_stimulation" } },
    };

    expect(evaluatePolicies([rule], makeState({ mood: "anxious" })).triggered).toHaveLength(1);
    expect(evaluatePolicies([rule], makeState({ mood: "panicked" })).triggered).toHaveLength(1);
    expect(evaluatePolicies([rule], makeState({ mood: "calm" })).triggered).toHaveLength(0);
  });

  it("reports matchedGroups and matchedTriggers in the result", () => {
    const { triggered } = evaluatePolicies(
      ADAPTATION_POLICIES,
      makeState({ cognitiveLoad: "overwhelming" }),
    );
    const entry = triggered.find((t) => t.ruleId === "overwhelm_simplification");
    expect(entry).toBeDefined();
    expect(entry.matchedGroups).toHaveLength(1);
    expect(entry.matchedGroups[0].groupIndex).toBe(0);
    expect(entry.matchedGroups[0].matchedTriggers).toHaveLength(1);
    expect(entry.matchedTriggers[0].dimension).toBe("cognitiveLoad");
  });

  it("skips inactive rules", () => {
    const rule = {
      id: "inactive_rule",
      scope: PolicyScope.GENERIC,
      tier: PriorityTier.CURRENT_STATE,
      priority: 1,
      active: false,
      triggerGroups: [
        {
          operator: "and",
          triggers: [{ dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" }],
        },
      ],
      action: { type: "modify", target: "ui", parameters: { mode: "test" } },
    };
    expect(evaluatePolicies([rule], makeState({ urgency: "critical" })).triggered).toHaveLength(0);
  });

  it("returns empty results for an empty state (no dimension matches)", () => {
    expect(evaluatePolicies(ADAPTATION_POLICIES, makeState()).triggered).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Precedence
// ─────────────────────────────────────────────────────────────────

describe("precedence", () => {
  const tier = (id, tierNumber, priority) => ({
    id,
    scope: PolicyScope.GENERIC,
    tier: tierNumber,
    priority,
    triggerGroups: [
      {
        operator: "and",
        triggers: [{ dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" }],
      },
    ],
    action: { type: "modify", target: "ui", parameters: { mode: id } },
  });

  it("a lower tier number wins regardless of numeric priority", () => {
    const safety = tier("safety_rule", PriorityTier.SAFETY, 1);
    const current = tier("current_rule", PriorityTier.CURRENT_STATE, 110);
    const { triggered } = evaluatePolicies([current, safety], makeState({ urgency: "critical" }));
    expect(triggered.map((t) => t.ruleId)).toEqual(["safety_rule", "current_rule"]);
  });

  it("within the same tier, higher numeric priority wins", () => {
    const low = tier("low_rule", PriorityTier.CURRENT_STATE, 60);
    const high = tier("high_rule", PriorityTier.CURRENT_STATE, 100);
    const { triggered } = evaluatePolicies([low, high], makeState({ urgency: "critical" }));
    expect(triggered.map((t) => t.ruleId)).toEqual(["high_rule", "low_rule"]);
  });

  it("determineAdaptation uses the highest-precedence rule for uiMode", () => {
    const { uiMode, activeRules } = determineAdaptation(
      makeState({ cognitiveLoad: "overwhelming", urgency: "critical" }),
    );
    expect(uiMode).toBe("overwhelm");
    expect(activeRules[0]).toBe("critical_urgency");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Parameter merging
// ─────────────────────────────────────────────────────────────────

describe("parameter merging (fixed precedence)", () => {
  it("lower-precedence rules cannot overwrite higher-precedence parameters", () => {
    // overwhelm_simplification (100) and low_stimulation (90) both set
    // maxVisibleModules (1 vs 3); the higher-precedence value must win.
    const { parameters } = determineAdaptation(
      makeState({ mood: "anxious", cognitiveLoad: "overwhelming" }),
    );
    expect(parameters.maxVisibleModules).toBe(1);

    // low_stimulation (90) vs high_load_minimal (80): higher wins (3, not 2).
    const second = determineAdaptation(makeState({ mood: "anxious", cognitiveLoad: "high" }));
    expect(second.parameters.maxVisibleModules).toBe(3);
    expect(second.parameters.simplifyNavigation).toBe(false);
  });

  it("excludes engine-facing mode and adaptationType metadata from merged parameters", () => {
    const { parameters } = determineAdaptation(makeState({ urgency: "critical" }));
    expect(parameters.mode).toBeUndefined();
    expect(parameters.adaptationType).toBeUndefined();
  });

  it("merges distinct keys from multiple triggered rules", () => {
    const { parameters } = determineAdaptation(
      makeState({ cognitiveLoad: "overwhelming", attention: "focused" }),
    );
    expect(parameters).toHaveProperty("maxVisibleModules");
    expect(parameters).toHaveProperty("reduceDistractions");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Compat wrappers
// ─────────────────────────────────────────────────────────────────

describe("compatibility wrappers", () => {
  it("selectRules returns triggered policies ordered by precedence", () => {
    const state = makeState({ cognitiveLoad: "overwhelming", urgency: "critical" });
    const selected = selectRules(state);
    expect(selected[0].ruleId).toBe("critical_urgency");
    expect(selected.map((s) => s.ruleId)).toContain("overwhelm_simplification");
  });

  it("selectRules respects the options.rules override", () => {
    const state = makeState({ urgency: "critical" });
    const selected = selectRules(state, { rules: [ADAPTATION_POLICIES[0]] });
    expect(selected).toHaveLength(1);
    expect(selected[0].ruleId).toBe("critical_urgency");
  });

  it("adaptationPolicy wrapper exposes rules and evaluate", () => {
    expect(adaptationPolicy.rules).toBe(ADAPTATION_POLICIES);
    expect(typeof adaptationPolicy.evaluate).toBe("function");
    const { triggered } = adaptationPolicy.evaluate(
      ADAPTATION_POLICIES,
      makeState({ urgency: "critical" }),
    );
    expect(triggered.map((t) => t.ruleId)).toContain("critical_urgency");
  });

  it("determineAdaptation returns normal uiMode for a non-matching state", () => {
    const result = determineAdaptation(makeState());
    expect(result).toEqual({
      uiMode: "normal",
      parameters: {},
      activeRules: [],
      rationale: expect.stringContaining("No adaptation rules matched"),
    });
  });

  it("checkAdaptationRecommendation maps priority thresholds to labels", () => {
    expect(checkAdaptationRecommendation(makeState({ urgency: "critical" }), "immediate_support")).toEqual({
      recommended: true,
      priority: "critical",
    });
    expect(checkAdaptationRecommendation(makeState({ attention: "scattered" }), "guidance")).toEqual({
      recommended: true,
      priority: "high",
    });
    expect(checkAdaptationRecommendation(makeState({ attention: "focused" }), "focus_enhancement")).toEqual({
      recommended: true,
      priority: "normal",
    });
  });

  it("checkAdaptationRecommendation returns not recommended for a mismatched adaptationType", () => {
    expect(checkAdaptationRecommendation(makeState({ urgency: "critical" }), "sensory_reduction")).toEqual({
      recommended: false,
      priority: "none",
    });
  });

  it("checkAdaptationRecommendation returns not recommended when nothing triggers", () => {
    expect(checkAdaptationRecommendation(makeState(), "guidance")).toEqual({
      recommended: false,
      priority: "none",
    });
  });

  it("getAvailableFeatures delegates to resolveEnabledFeatures", () => {
    const features = getAvailableFeatures({ disorders: [], enabledModules: [] });
    expect(features).toBeInstanceOf(Set);
    const legacy = getAvailableFeatures({ disorders: ["adhd"] });
    expect(legacy).toBeInstanceOf(Set);
  });
});

// ─────────────────────────────────────────────────────────────────
//  End-to-end state strings (values produced by buildUserState)
// ─────────────────────────────────────────────────────────────────

describe("end-to-end state value mapping", () => {
  it("critical_urgency fires on urgency critical", () => {
    const { triggered } = evaluatePolicies(ADAPTATION_POLICIES, makeState({ urgency: "critical" }));
    expect(triggered.map((t) => t.ruleId)).toContain("critical_urgency");
  });

  it("overwhelm_simplification fires on cognitiveLoad overwhelming", () => {
    const { triggered } = evaluatePolicies(
      ADAPTATION_POLICIES,
      makeState({ cognitiveLoad: "overwhelming" }),
    );
    expect(triggered.map((t) => t.ruleId)).toContain("overwhelm_simplification");
  });

  it("low_stimulation fires on anxious or panicked mood", () => {
    for (const mood of ["anxious", "panicked"]) {
      const { triggered } = evaluatePolicies(ADAPTATION_POLICIES, makeState({ mood }));
      expect(triggered.map((t) => t.ruleId)).toContain("low_stimulation");
    }
  });

  it("high_load_minimal fires on cognitiveLoad high", () => {
    const { triggered } = evaluatePolicies(ADAPTATION_POLICIES, makeState({ cognitiveLoad: "high" }));
    expect(triggered.map((t) => t.ruleId)).toContain("high_load_minimal");
  });

  it("scattered_guidance fires on attention scattered", () => {
    const { triggered } = evaluatePolicies(
      ADAPTATION_POLICIES,
      makeState({ attention: "scattered" }),
    );
    expect(triggered.map((t) => t.ruleId)).toContain("scattered_guidance");
  });

  it("focus_mode fires on attention focused", () => {
    const { triggered } = evaluatePolicies(ADAPTATION_POLICIES, makeState({ attention: "focused" }));
    expect(triggered.map((t) => t.ruleId)).toContain("focus_mode");
  });

  it("handles a raw DimensionResult-shaped object value", () => {
    const { triggered } = evaluatePolicies(
      ADAPTATION_POLICIES,
      makeState({ cognitiveLoad: { value: "overwhelming", confidence: 0.9 } }),
    );
    expect(triggered.map((t) => t.ruleId)).toContain("overwhelm_simplification");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Tier 9 learned personalization boundary
// ─────────────────────────────────────────────────────────────────
//  Reflection output belongs ONLY to Tier 9 (LEARNED_PERSONALIZATION).
//  The existing categorical precedence — lower tier number always wins —
//  is the mechanism that keeps every higher-priority tier protected.
//  Learned signals surface as `strategyEffectiveness:<strategyId>`
//  resolved-state dimensions; only Tier 9 rules reference them.

describe("Tier 9 learned personalization precedence", () => {
  const learned = (tierNumber, priority = 10) => ({
    id: `learned_rule_t${tierNumber}`,
    scope: PolicyScope.GENERIC,
    tier: PriorityTier.LEARNED_PERSONALIZATION,
    priority,
    triggerGroups: [
      {
        operator: "and",
        triggers: [
          {
            dimension: "strategyEffectiveness:support.focus_session:focus_session",
            condition: TriggerCondition.GTE,
            value: 0.6,
          },
        ],
      },
    ],
    action: { type: "recommend", target: "assistance", parameters: { mode: "learned" } },
  });

  const higher = (id, tierNumber) => ({
    id,
    scope: PolicyScope.GENERIC,
    tier: tierNumber,
    priority: 1,
    triggerGroups: [
      {
        operator: "and",
        triggers: [{ dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" }],
      },
    ],
    action: { type: "modify", target: "ui", parameters: { mode: id } },
  });

  const learnedState = {
    ...makeState({ urgency: "critical" }),
    "strategyEffectiveness:support.focus_session:focus_session": 0.8,
  };

  it("higher tiers (1–8) always win the precedence order over Tier 9 learned signals", () => {
    for (const tierNumber of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const higherRule = higher(`tier_${tierNumber}_rule`, tierNumber);
      const { triggered } = evaluatePolicies([learned(tierNumber), higherRule], learnedState);
      expect(triggered[0].ruleId).toBe(`tier_${tierNumber}_rule`);
      expect(triggered[1].ruleId).toBe(`learned_rule_t${tierNumber}`);
    }
  });

  it("a Tier 9 learned rule triggers on the learned dimension when no higher tier competes", () => {
    const { triggered } = evaluatePolicies([learned(9)], learnedState);
    expect(triggered).toHaveLength(1);
    expect(triggered[0].ruleId).toBe("learned_rule_t9");
    expect(triggered[0].matchedTriggers[0].dimension).toBe(
      "strategyEffectiveness:support.focus_session:focus_session",
    );
  });

  it("a Tier 9 learned rule does not fire when the learned dimension is absent", () => {
    const { triggered } = evaluatePolicies(
      [learned(9)],
      makeState({ urgency: "critical" }),
    );
    expect(triggered).toHaveLength(0);
  });
});
