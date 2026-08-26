import { describe, it, expect } from "vitest";
import { buildAdaptationPlan } from "../planner.js";
import { evaluatePolicies, ADAPTATION_POLICIES } from "../adaptationPolicy.js";
import {
  validateAdaptationPlan,
  validateAdaptationAction,
  AdaptationActionType,
  AdaptationDimension,
  PolicyScope,
  PriorityTier,
  TriggerCondition,
  TriggerGroupOperator,
} from "@/support/schemas/supportSchemas";

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────

function makeReasoning(overrides = {}) {
  return {
    situation: "cognitive_overload",
    description: "Cognitive load is overwhelming",
    primaryNeed: "task_simplification",
    secondaryNeeds: ["attention_support"],
    strategy: "simplify",
    reasoning: [{ factor: "cognitiveLoad", value: "overwhelming", contribution: "strong" }],
    summary: ["High cognitive load"],
    confidence: 0.72,
    timestamp: "2026-08-02T00:00:00.000Z",
    sources: ["context_snapshot", "user_state"],
    ...overrides,
  };
}

function makeState(overrides = {}) {
  return {
    emotionalState: "unknown",
    cognitiveLoad: "unknown",
    attention: "unknown",
    urgency: "unknown",
    mood: "unknown",
    ...overrides,
  };
}

function rule(id, tier, priority, options = {}) {
  return {
    id,
    scope: PolicyScope.GENERIC,
    tier,
    priority,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [{ dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" }],
      },
    ],
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: { mode: id },
    },
    ...options,
  };
}

/** Evaluate custom rules through the Phase 1 evaluator to get real entries. */
function triggerRules(rules, state) {
  return evaluatePolicies(rules, state).triggered;
}

/**
 * A triggered-policy entry at the planner boundary (the TriggeredRule
 * contract). Phase 1's evaluatePolicies currently emits only the core
 * subset; policy-declared timing/reversal are read by the planner when an
 * entry carries them.
 */
function triggeredEntry(overrides = {}) {
  return {
    ruleId: "timed_rule",
    version: 1,
    tier: PriorityTier.CURRENT_STATE,
    priority: 50,
    scope: PolicyScope.GENERIC,
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: { mode: "timed" },
    },
    matchedTriggers: [
      { dimension: "urgency", condition: TriggerCondition.EQ, value: "critical" },
    ],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────
//  1. Single rule → one action
// ─────────────────────────────────────────────────────────────────

describe("action assembly", () => {
  it("converts a single triggered policy into one valid action", () => {
    const state = makeState({ cognitiveLoad: "overwhelming" });
    const triggeredRules = triggerRules(ADAPTATION_POLICIES, state);
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules,
      userState: state,
    });

    expect(triggeredRules).toHaveLength(1);
    expect(plan.actions).toHaveLength(1);
    const action = plan.actions[0];
    expect(action.actionId).toMatch(/^action_/);
    expect(action.type).toBe("MODIFY");
    expect(action.tier).toBe(PriorityTier.CURRENT_STATE);
    expect(action.numericPriority).toBe(100);
    expect(() => validateAdaptationAction(action)).not.toThrow();
  });

  it("maps policy action vocabulary without a second vocabulary", () => {
    const state = makeState({ cognitiveLoad: "overwhelming" });
    const triggeredRules = triggerRules(ADAPTATION_POLICIES, state);
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules,
      userState: state,
    });
    const action = plan.actions[0];
    expect(action.type).toBe(triggeredRules[0].action.type);
    expect(action.target).toBe(triggeredRules[0].action.target);
    expect(action.parameters).toEqual(triggeredRules[0].action.parameters);
  });
});

// ─────────────────────────────────────────────────────────────────
//  2–4. Precedence ordering is preserved
// ─────────────────────────────────────────────────────────────────

describe("precedence preservation", () => {
  it("orders actions by the precedence established by policy evaluation", () => {
    const state = makeState({ urgency: "critical", cognitiveLoad: "overwhelming" });
    const triggeredRules = triggerRules(ADAPTATION_POLICIES, state);
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules,
      userState: state,
    });

    expect(triggeredRules.map((t) => t.ruleId)).toEqual([
      "critical_urgency",
      "overwhelm_simplification",
    ]);
    expect(plan.actions.map((a) => a.actionId)).toEqual(plan.priorityOrder);
    expect(plan.actions[0].evidence).toContain("policy:critical_urgency@v1");
    expect(plan.actions[1].evidence).toContain("policy:overwhelm_simplification@v1");
  });

  it("keeps a lower tier ahead of a higher tier regardless of numeric priority", () => {
    const safety = rule("safety_rule", PriorityTier.SAFETY, 1);
    const current = rule("current_rule", PriorityTier.CURRENT_STATE, 110);
    const triggeredRules = triggerRules([current, safety], makeState({ urgency: "critical" }));

    expect(triggeredRules.map((t) => t.ruleId)).toEqual(["safety_rule", "current_rule"]);

    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules,
      userState: makeState({ urgency: "critical" }),
    });
    expect(plan.actions[0].evidence).toContain("policy:safety_rule@v1");
    expect(plan.actions[0].numericPriority).toBe(1);
  });

  it("within the same tier, higher numeric priority comes first", () => {
    const low = rule("low_rule", PriorityTier.CURRENT_STATE, 60);
    const high = rule("high_rule", PriorityTier.CURRENT_STATE, 100);
    const triggeredRules = triggerRules([low, high], makeState({ urgency: "critical" }));

    expect(triggeredRules.map((t) => t.ruleId)).toEqual(["high_rule", "low_rule"]);

    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules,
      userState: makeState({ urgency: "critical" }),
    });
    expect(plan.actions[0].evidence).toContain("policy:high_rule@v1");
  });

  it("does not reverse the input order", () => {
    const triggeredRules = triggerRules(
      ADAPTATION_POLICIES,
      makeState({ urgency: "critical", cognitiveLoad: "overwhelming" }),
    );
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules,
      userState: makeState({ urgency: "critical", cognitiveLoad: "overwhelming" }),
    });
    expect(plan.actions.map((a) => a.numericPriority)).toEqual([110, 100]);
  });
});

// ─────────────────────────────────────────────────────────────────
//  5. priorityOrder integrity
// ─────────────────────────────────────────────────────────────────

describe("priorityOrder", () => {
  it("contains only real action IDs, in order, without duplicates", () => {
    const state = makeState({ urgency: "critical", cognitiveLoad: "overwhelming" });
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: triggerRules(ADAPTATION_POLICIES, state),
      userState: state,
    });

    const actionIds = new Set(plan.actions.map((a) => a.actionId));
    expect(plan.priorityOrder.length).toBeGreaterThan(0);
    for (const id of plan.priorityOrder) {
      expect(actionIds.has(id)).toBe(true);
    }
    expect(new Set(plan.priorityOrder).size).toBe(plan.priorityOrder.length);
    expect(plan.priorityOrder).toEqual(plan.actions.map((a) => a.actionId));
  });
});

// ─────────────────────────────────────────────────────────────────
//  6–7. UI is expressed only as actions; no top-level uiMode
// ─────────────────────────────────────────────────────────────────

describe("UI as actions (D9)", () => {
  it("never emits a top-level uiMode", () => {
    const state = makeState({ cognitiveLoad: "overwhelming", urgency: "critical" });
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: triggerRules(ADAPTATION_POLICIES, state),
      userState: state,
    });
    expect(plan).not.toHaveProperty("uiMode");
    expect("uiMode" in plan).toBe(false);
  });

  it("represents a UI adaptation as a target UI action with parameters.mode", () => {
    const state = makeState({ attention: "focused" });
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning({ situation: "stable" }),
      triggeredRules: triggerRules(ADAPTATION_POLICIES, state),
      userState: state,
    });

    const uiAction = plan.actions.find((a) => a.target === AdaptationDimension.UI);
    expect(uiAction).toBeDefined();
    expect(uiAction.type).toBe(AdaptationActionType.MODIFY);
    expect(uiAction.parameters.mode).toBe("focus");
  });
});

// ─────────────────────────────────────────────────────────────────
//  8–9. Reason and evidence
// ─────────────────────────────────────────────────────────────────

describe("reason and evidence", () => {
  it("reason identifies the policy and matched triggers", () => {
    const state = makeState({ cognitiveLoad: "overwhelming" });
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: triggerRules(ADAPTATION_POLICIES, state),
      userState: state,
    });
    const reason = plan.actions[0].reason;
    expect(reason).toContain("overwhelm_simplification");
    expect(reason).toContain("cognitiveLoad");
  });

  it("evidence propagates reasoning sources and policy identity", () => {
    const state = makeState({ cognitiveLoad: "overwhelming" });
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: triggerRules(ADAPTATION_POLICIES, state),
      userState: state,
    });
    const evidence = plan.actions[0].evidence;
    expect(evidence).toContain("context_snapshot");
    expect(evidence).toContain("user_state");
    expect(evidence).toContain("policy:overwhelm_simplification@v1");
  });

  it("includes module provenance for module-scoped rules when moduleContext is provided", () => {
    const moduleScoped = rule(
      "module_rule",
      PriorityTier.MODULE_CONSTRAINT,
      5,
      { scope: PolicyScope.MODULE, moduleId: "focus" },
    );
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: triggerRules([moduleScoped], makeState({ urgency: "critical" })),
      userState: makeState({ urgency: "critical" }),
      moduleContext: { moduleId: "focus" },
    });
    expect(plan.actions[0].evidence).toContain("module:focus");
  });
});

// ─────────────────────────────────────────────────────────────────
//  10–12. Situation / needs / reasoning from ReasoningResult
// ─────────────────────────────────────────────────────────────────

describe("reasoning result propagation", () => {
  it("reuses the situation from the reasoning result", () => {
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning({ situation: "emotional_distress" }),
      triggeredRules: [],
      userState: makeState(),
    });
    expect(plan.situation).toBe("emotional_distress");
  });

  it("propagates primary and secondary needs", () => {
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning({ primaryNeed: "emotional_regulation", secondaryNeeds: ["task_simplification", "low_effort_support"] }),
      triggeredRules: [],
      userState: makeState(),
    });
    expect(plan.primaryNeed).toBe("emotional_regulation");
    expect(plan.secondaryNeeds).toEqual(["task_simplification", "low_effort_support"]);
  });

  it("propagates reasoning factors", () => {
    const factors = [{ factor: "cognitiveLoad", value: "overwhelming", contribution: "strong" }];
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning({ reasoning: factors }),
      triggeredRules: [],
      userState: makeState(),
    });
    expect(plan.reasoning).toEqual(factors);
  });
});

// ─────────────────────────────────────────────────────────────────
//  13. UserState reference
// ─────────────────────────────────────────────────────────────────

describe("userState reference", () => {
  it("preserves the user state without mutating it", () => {
    const state = makeState({ cognitiveLoad: "overwhelming", mood: "anxious" });
    const snapshot = { ...state };
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: triggerRules(ADAPTATION_POLICIES, state),
      userState: state,
    });

    expect(plan.userStateReference.cognitiveLoad).toBe("overwhelming");
    expect(plan.userStateReference).not.toBe(state);
    expect(state).toEqual(snapshot);
  });

  it("is a copy that cannot affect the original", () => {
    const state = makeState({ cognitiveLoad: "overwhelming" });
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: [],
      userState: state,
    });
    plan.userStateReference.cognitiveLoad = "mutated";
    expect(state.cognitiveLoad).toBe("overwhelming");
  });
});

// ─────────────────────────────────────────────────────────────────
//  14. Confidence determinism
// ─────────────────────────────────────────────────────────────────

describe("confidence", () => {
  it("falls back to the reasoning-level confidence deterministically", () => {
    const state = makeState({ cognitiveLoad: "overwhelming" });
    const input = {
      reasoning: makeReasoning({ confidence: 0.72 }),
      triggeredRules: triggerRules(ADAPTATION_POLICIES, state),
      userState: state,
    };
    const first = buildAdaptationPlan(input);
    const second = buildAdaptationPlan(input);
    expect(first.actions[0].confidence).toBe(0.72);
    expect(second.actions[0].confidence).toBe(0.72);
    expect(first.overallConfidence).toBe(0.72);
  });

  it("prefers rule-level confidence when available", () => {
    const state = makeState({ urgency: "critical" });
    const customRule = rule("confident_rule", PriorityTier.CURRENT_STATE, 90);
    const triggeredRules = triggerRules([customRule], state);
    triggeredRules[0].confidence = 0.9;
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning({ confidence: 0.3 }),
      triggeredRules,
      userState: state,
    });
    expect(plan.actions[0].confidence).toBe(0.9);
  });

  it("produces 0 confidence when neither rule nor reasoning provides one", () => {
    const state = makeState({ urgency: "critical" });
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning({ confidence: undefined }),
      triggeredRules: triggerRules([rule("bare_rule", PriorityTier.CURRENT_STATE, 1)], state),
      userState: state,
    });
    expect(plan.actions[0].confidence).toBe(0);
  });

  it("overallConfidence is the deterministic mean of action confidences", () => {
    const state = makeState({ urgency: "critical", cognitiveLoad: "overwhelming" });
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning({ confidence: 0.8 }),
      triggeredRules: triggerRules(ADAPTATION_POLICIES, state),
      userState: state,
    });
    expect(plan.overallConfidence).toBeCloseTo(0.8, 10);
  });
});

// ─────────────────────────────────────────────────────────────────
//  15–16. Re-evaluation timing
// ─────────────────────────────────────────────────────────────────

describe("reEvaluateAt", () => {
  it("is absent when no policy declares timing", () => {
    const state = makeState({ cognitiveLoad: "overwhelming" });
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: triggerRules(ADAPTATION_POLICIES, state),
      userState: state,
    });
    expect(plan).not.toHaveProperty("reEvaluateAt");
  });

  it("is derived from policy-declared durationMs", () => {
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: [triggeredEntry({ durationMs: 60000 })],
      userState: makeState(),
    });
    expect(plan.reEvaluateAt).toBe(plan.timestamp + 60000);
    expect(plan.actions[0].durationMs).toBe(60000);
    expect(plan.actions[0].expiry).toBe(plan.timestamp + 60000);
  });

  it("is derived from hysteresis timing when durationMs is absent", () => {
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: [
        triggeredEntry({
          hysteresis: {
            activationThreshold: 0.7,
            deactivationThreshold: 0.3,
            cooldownMs: 200000,
            minDurationMs: 120000,
          },
        }),
      ],
      userState: makeState(),
    });
    expect(plan.reEvaluateAt).toBe(plan.timestamp + 120000);
  });

  it("uses the earliest candidate across multiple timing sources", () => {
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: [
        triggeredEntry({ ruleId: "rule_a", priority: 50, durationMs: 60000 }),
        triggeredEntry({
          ruleId: "rule_b",
          priority: 40,
          hysteresis: {
            activationThreshold: 0.7,
            deactivationThreshold: 0.3,
            cooldownMs: 10000,
            minDurationMs: 20000,
          },
        }),
      ],
      userState: makeState(),
    });
    expect(plan.reEvaluateAt).toBe(plan.timestamp + 10000);
  });
});

// ─────────────────────────────────────────────────────────────────
//  17. Empty plan
// ─────────────────────────────────────────────────────────────────

describe("empty plan behavior", () => {
  it("produces a valid empty plan when no policies trigger", () => {
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning({ situation: "insufficient_information", primaryNeed: "gather_information", secondaryNeeds: [] }),
      triggeredRules: [],
      userState: makeState(),
    });

    expect(plan.actions).toEqual([]);
    expect(plan.priorityOrder).toEqual([]);
    expect(plan.overallConfidence).toBe(0.72);
    expect(() => validateAdaptationPlan(plan)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────
//  18–19. Schema compliance
// ─────────────────────────────────────────────────────────────────

describe("schema compliance", () => {
  it("every generated plan passes AdaptationPlanSchema", () => {
    const cases = [
      { reasoning: makeReasoning(), triggeredRules: [], userState: makeState() },
      {
        reasoning: makeReasoning(),
        triggeredRules: triggerRules(ADAPTATION_POLICIES, makeState({ cognitiveLoad: "overwhelming" })),
        userState: makeState({ cognitiveLoad: "overwhelming" }),
      },
      {
        reasoning: makeReasoning({ confidence: 0.5 }),
        triggeredRules: triggerRules(
          ADAPTATION_POLICIES,
          makeState({ urgency: "critical", attention: "scattered", mood: "panicked" }),
        ),
        userState: makeState({ urgency: "critical", attention: "scattered", mood: "panicked" }),
      },
    ];
    for (const input of cases) {
      const plan = buildAdaptationPlan(input);
      expect(() => validateAdaptationPlan(plan)).not.toThrow();
    }
  });

  it("every generated action passes AdaptationActionSchema", () => {
    const state = makeState({ urgency: "critical", cognitiveLoad: "overwhelming", attention: "scattered" });
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: triggerRules(ADAPTATION_POLICIES, state),
      userState: state,
    });
    expect(plan.actions.length).toBeGreaterThan(0);
    for (const action of plan.actions) {
      expect(() => validateAdaptationAction(action)).not.toThrow();
    }
  });
});

// ─────────────────────────────────────────────────────────────────
//  20. Decision trace linkage
// ─────────────────────────────────────────────────────────────────

describe("decision trace linkage", () => {
  it("uses a provided decisionTraceId", () => {
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: [],
      userState: makeState(),
      decisionTraceId: "trace_abc123",
    });
    expect(plan.decisionTraceId).toBe("trace_abc123");
  });

  it("generates a decisionTraceId when none is provided", () => {
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: [],
      userState: makeState(),
    });
    expect(typeof plan.decisionTraceId).toBe("string");
    expect(plan.decisionTraceId.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Reversibility
// ─────────────────────────────────────────────────────────────────

describe("reversibility", () => {
  it("defaults to reversible", () => {
    const state = makeState({ cognitiveLoad: "overwhelming" });
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: triggerRules(ADAPTATION_POLICIES, state),
      userState: state,
    });
    expect(plan.actions[0].reversible).toBe(true);
  });

  it("marks an action non-reversible when the policy declares reversal none", () => {
    const plan = buildAdaptationPlan({
      reasoning: makeReasoning(),
      triggeredRules: [triggeredEntry({ reversal: "none" })],
      userState: makeState(),
    });
    expect(plan.actions[0].reversible).toBe(false);
  });
});
