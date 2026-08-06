import { describe, expect, it } from "vitest";
import { decide } from "../adaptiveEngine.js";
import {
  entriesConflict,
  compareConflictPrecedence,
  resolveConflicts,
} from "../conflictResolution.js";
import {
  validateDecisionTrace,
  AdaptationActionType,
  AdaptationDimension,
  PolicyScope,
  PriorityTier,
  TriggerCondition,
  TriggerGroupOperator,
} from "@/support/schemas/supportSchemas";

function entry(overrides = {}) {
  return {
    ruleId: "rule.default",
    version: 1,
    tier: PriorityTier.CURRENT_STATE,
    priority: 10,
    scope: PolicyScope.GENERIC,
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: { mode: "overwhelm", maxVisibleModules: 1 },
    },
    matchedTriggers: [],
    ...overrides,
  };
}

describe("entriesConflict (D4)", () => {
  it("detects incompatible parameters on the same target", () => {
    expect(
      entriesConflict(
        entry({ action: { type: "MODIFY", target: "UI", parameters: { mode: "overwhelm" } } }),
        entry({ action: { type: "MODIFY", target: "UI", parameters: { mode: "minimal" } } }),
      ),
    ).toBe(true);
  });

  it("treats identical parameters on the same target as compatible", () => {
    const a = entry({ action: { type: "MODIFY", target: "UI", parameters: { mode: "focus" } } });
    const b = entry({ action: { type: "MODIFY", target: "UI", parameters: { mode: "focus" } } });
    expect(entriesConflict(a, b)).toBe(false);
  });

  it("treats non-overlapping parameter keys as compatible", () => {
    const a = entry({ action: { type: "MODIFY", target: "UI", parameters: { reduceAnimations: true } } });
    const b = entry({ action: { type: "MODIFY", target: "UI", parameters: { showPrimaryAction: true } } });
    expect(entriesConflict(a, b)).toBe(false);
  });

  it("detects opposing action directions", () => {
    expect(
      entriesConflict(
        entry({ action: { type: "INCREASE", target: "PACING", parameters: {} } }),
        entry({ action: { type: "DECREASE", target: "PACING", parameters: {} } }),
      ),
    ).toBe(true);
  });

  it("does not conflict across different targets", () => {
    expect(
      entriesConflict(
        entry({ action: { type: "MODIFY", target: "UI", parameters: { mode: "overwhelm" } } }),
        entry({ action: { type: "MODIFY", target: "ASSISTANCE", parameters: { mode: "overwhelm" } } }),
      ),
    ).toBe(false);
  });
});

describe("compareConflictPrecedence (D4 tie-break)", () => {
  it("orders by tier first (lower wins)", () => {
    const lower = entry({ ruleId: "tier2", tier: PriorityTier.EXPLICIT_USER_REQUEST });
    const higher = entry({ ruleId: "tier8", tier: PriorityTier.CURRENT_STATE });
    expect(compareConflictPrecedence(lower, higher)).toBeLessThan(0);
  });

  it("uses numeric priority within a tier (higher wins)", () => {
    const high = entry({ ruleId: "a", priority: 50 });
    const low = entry({ ruleId: "b", priority: 10 });
    expect(compareConflictPrecedence(high, low)).toBeLessThan(0);
  });

  it("uses confidence after priority", () => {
    const confident = entry({ ruleId: "a", priority: 10, confidence: 0.9 });
    const uncertain = entry({ ruleId: "b", priority: 10, confidence: 0.4 });
    expect(compareConflictPrecedence(confident, uncertain)).toBeLessThan(0);
  });

  it("falls back to the stable rule id (ascending) for a full tie", () => {
    const a = entry({ ruleId: "aaa", priority: 10, confidence: 0.5 });
    const b = entry({ ruleId: "bbb", priority: 10, confidence: 0.5 });
    expect(compareConflictPrecedence(a, b)).toBeLessThan(0);
  });
});

describe("resolveConflicts (D4)", () => {
  it("suppresses the lower-precedence loser and records the conflict", () => {
    const winner = entry({
      ruleId: "winner",
      priority: 100,
      action: { type: "MODIFY", target: "UI", parameters: { mode: "overwhelm" } },
    });
    const loser = entry({
      ruleId: "loser",
      priority: 10,
      action: { type: "MODIFY", target: "UI", parameters: { mode: "minimal" } },
    });
    const { kept, rejected, conflicts } = resolveConflicts([loser, winner]);

    expect(kept.map((e) => e.ruleId)).toEqual(["winner"]);
    expect(rejected.map((e) => e.ruleId)).toEqual(["loser"]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      target: AdaptationDimension.UI,
      winnerActionId: "winner",
      loserActionIds: ["loser"],
    });
    expect(conflicts[0].reason).toMatch(/incompatible parameters/);
  });

  it("keeps compatible candidates on the same target", () => {
    const a = entry({ ruleId: "a", priority: 100, parameters: { mode: "overwhelm" } });
    const b = entry({ ruleId: "b", priority: 10, parameters: { mode: "overwhelm" } });
    const { kept, rejected, conflicts } = resolveConflicts([a, b]);

    expect(kept.map((e) => e.ruleId)).toEqual(["a", "b"]);
    expect(rejected).toEqual([]);
    expect(conflicts).toEqual([]);
  });

  it("lets a lower tier win regardless of numeric priority", () => {
    const tier8 = entry({
      ruleId: "t8",
      tier: PriorityTier.CURRENT_STATE,
      priority: 500,
      action: { type: "MODIFY", target: "UI", parameters: { mode: "overwhelm" } },
    });
    const tier2 = entry({
      ruleId: "t2",
      tier: PriorityTier.EXPLICIT_USER_REQUEST,
      priority: 1,
      action: { type: "MODIFY", target: "UI", parameters: { mode: "minimal" } },
    });
    const { kept } = resolveConflicts([tier8, tier2]);
    expect(kept.map((e) => e.ruleId)).toEqual(["t2"]);
  });

  it("is deterministic for a full tie via the stable identifier", () => {
    const a = entry({
      ruleId: "zz",
      priority: 10,
      confidence: 0.5,
      action: { type: "MODIFY", target: "UI", parameters: { mode: "x" } },
    });
    const b = entry({
      ruleId: "aa",
      priority: 10,
      confidence: 0.5,
      action: { type: "MODIFY", target: "UI", parameters: { mode: "y" } },
    });
    const first = resolveConflicts([a, b]);
    const second = resolveConflicts([b, a]);
    expect(first.kept.map((e) => e.ruleId)).toEqual(second.kept.map((e) => e.ruleId));
    expect(first.kept).toHaveLength(1);
  });
});

describe("conflict stage in the engine pipeline (D4)", () => {
  function conflictingModulePolicies() {
    const base = {
      version: 1,
      scope: PolicyScope.MODULE,
      moduleId: "focus",
      active: true,
      triggerGroups: [
        {
          operator: TriggerGroupOperator.AND,
          triggers: [{ dimension: "attentionState", condition: TriggerCondition.EQ, value: "focused" }],
        },
      ],
    };
    return [
      {
        ...base,
        id: "conflict.low",
        tier: PriorityTier.CURRENT_STATE,
        priority: 5,
        action: {
          type: AdaptationActionType.MODIFY,
          target: AdaptationDimension.UI,
          parameters: { mode: "minimal" },
        },
      },
      {
        ...base,
        id: "conflict.high",
        tier: PriorityTier.CURRENT_STATE,
        priority: 50,
        action: {
          type: AdaptationActionType.MODIFY,
          target: AdaptationDimension.UI,
          parameters: { mode: "overwhelm" },
        },
      },
    ];
  }

  function focusedUserState() {
    return {
      emotionalState: "calm",
      cognitiveLoad: "low",
      energyLevel: "rested",
      attentionState: "focused",
      stressLevel: "none",
      motivationLevel: "high",
      urgency: "low",
      taskComplexity: "simple",
      engagementLevel: "high",
    };
  }

  it("keeps only the highest-precedence action per target and records the loser", () => {
    const outcome = decide({
      contextSnapshot: { timestamp: "2026-08-01T00:00:00.000Z" },
      userState: focusedUserState(),
      moduleContext: { moduleId: "focus", modulePolicies: conflictingModulePolicies() },
    });

    const actionRules = outcome.plan.actions
      .flatMap((action) => action.evidence.filter((e) => e.startsWith("policy:")))
      .map((e) => e.replace(/^policy:/, "").replace(/@v\d+$/, ""));
    expect(actionRules).toContain("conflict.high");
    expect(actionRules).not.toContain("conflict.low");

    expect(outcome.trace.conflicts).toHaveLength(1);
    expect(outcome.trace.conflicts[0]).toMatchObject({
      target: AdaptationDimension.UI,
      winnerActionId: "conflict.high",
      loserActionIds: ["conflict.low"],
    });
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain("conflict.low");
    expect(() => validateDecisionTrace(outcome.trace)).not.toThrow();
  });

  it("does not suppress compatible same-target actions", () => {
    const base = {
      version: 1,
      scope: PolicyScope.MODULE,
      moduleId: "focus",
      active: true,
      triggerGroups: [
        {
          operator: TriggerGroupOperator.AND,
          triggers: [{ dimension: "attentionState", condition: TriggerCondition.EQ, value: "focused" }],
        },
      ],
      action: {
        type: AdaptationActionType.MODIFY,
        target: AdaptationDimension.UI,
        parameters: { mode: "overwhelm" },
      },
    };
    const outcome = decide({
      contextSnapshot: { timestamp: "2026-08-01T00:00:00.000Z" },
      userState: focusedUserState(),
      moduleContext: {
        moduleId: "focus",
        modulePolicies: [
          { ...base, id: "same.one", tier: PriorityTier.CURRENT_STATE, priority: 5 },
          { ...base, id: "same.two", tier: PriorityTier.CURRENT_STATE, priority: 50 },
        ],
      },
    });

    const actionRules = outcome.plan.actions
      .flatMap((action) => action.evidence.filter((e) => e.startsWith("policy:")))
      .map((e) => e.replace(/^policy:/, "").replace(/@v\d+$/, ""));
    expect(actionRules).toContain("same.one");
    expect(actionRules).toContain("same.two");
    expect(outcome.trace.conflicts).toEqual([]);
  });
});
