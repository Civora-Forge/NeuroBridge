import { describe, it, expect } from "vitest";
import { decide } from "../adaptiveEngine.js";
import {
  AdaptationActionType,
  AdaptationDimension,
  PolicyScope,
  PriorityTier,
  TriggerCondition,
  TriggerGroupOperator,
  validateAdaptationPlan,
} from "@/support/schemas/supportSchemas";

// ─────────────────────────────────────────────────────────────────
//  Fixtures
// ─────────────────────────────────────────────────────────────────

const LEARNED_STRATEGY = "support.focus_session:focus_session";
const LEARNED_DIMENSION = `strategyEffectiveness:${LEARNED_STRATEGY}`;

function calmUserState() {
  return {
    emotionalState: "calm",
    cognitiveLoad: "low",
    energyLevel: "rested",
    attentionState: "unknown",
    stressLevel: "none",
    motivationLevel: "high",
    urgency: "low",
    taskComplexity: "simple",
    engagementLevel: "high",
  };
}

function decisionInput(overrides = {}) {
  return {
    contextSnapshot: { timestamp: "2026-08-01T00:00:00.000Z" },
    userState: calmUserState(),
    ...overrides,
  };
}

function uiFocusPolicy() {
  return {
    id: "module.ui_focus",
    version: 1,
    scope: PolicyScope.MODULE,
    moduleId: "focus",
    tier: PriorityTier.CURRENT_STATE,
    priority: 5,
    active: true,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [
          { dimension: "engagementLevel", condition: TriggerCondition.EQ, value: "high" },
        ],
      },
    ],
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: { mode: "focus" },
    },
  };
}

function safetyUiPolicy() {
  return {
    id: "module.safety_ui",
    version: 1,
    scope: PolicyScope.MODULE,
    moduleId: "focus",
    tier: PriorityTier.SAFETY,
    priority: 1,
    active: true,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [
          { dimension: "stressLevel", condition: TriggerCondition.EQ, value: "critical" },
        ],
      },
    ],
    action: {
      type: AdaptationActionType.MODIFY,
      target: AdaptationDimension.UI,
      parameters: { mode: "emergency" },
    },
  };
}

function learnedPolicy() {
  return {
    id: "learned.recommend_focus",
    version: 1,
    scope: PolicyScope.MODULE,
    moduleId: "focus",
    tier: PriorityTier.LEARNED_PERSONALIZATION,
    priority: 10,
    active: true,
    triggerGroups: [
      {
        operator: TriggerGroupOperator.AND,
        triggers: [{ dimension: LEARNED_DIMENSION, condition: TriggerCondition.GTE, value: 0.6 }],
      },
    ],
    action: {
      type: AdaptationActionType.RECOMMEND,
      target: AdaptationDimension.ASSISTANCE,
      parameters: { mode: "focus_session" },
    },
  };
}

const UI = AdaptationDimension.UI;
const ASSISTANCE = AdaptationDimension.ASSISTANCE;

// ─────────────────────────────────────────────────────────────────
//  Pass-through guarantees
// ─────────────────────────────────────────────────────────────────

describe("D14 preference stage — pass-through", () => {
  it("is a pure pass-through when userPreferences is absent", () => {
    const outcome = decide(decisionInput());
    expect(outcome.plan.actions).toEqual([]);
    expect(outcome.trace.preferenceResult).toEqual({
      appliedRequests: [],
      honoredRestrictions: [],
      learnedSignalsUsed: [],
    });
    expect(outcome.trace.overrides).toEqual([]);
    expect(outcome.trace.sources).not.toContain("user_preferences");
  });

  it("is a pure pass-through when the fragments are empty (no fabricated prefs)", () => {
    const without = decide(decisionInput());
    const withEmpty = decide(
      decisionInput({ userPreferences: { accessibility: {}, requested: [], restricted: [] } }),
    );
    const stripIds = (actions) => actions.map(({ actionId, ...rest }) => rest);
    expect(stripIds(withEmpty.plan.actions)).toEqual(stripIds(without.plan.actions));
    expect(withEmpty.trace.preferenceResult.appliedRequests).toEqual([]);
    // The fragment was present, so availability is still traced.
    expect(withEmpty.trace.sources).toContain("user_preferences");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Requestable preferences (Tier 2 requests, Tier 4 accessibility)
// ─────────────────────────────────────────────────────────────────

describe("D14 requestable preference application", () => {
  it("applies a single explicit request and traces it", () => {
    const outcome = decide(
      decisionInput({
        userPreferences: {
          accessibility: {},
          requested: [{ id: "pref.ui_minimal", target: UI, parameters: { mode: "minimal" } }],
          restricted: [],
        },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(1);
    const action = outcome.plan.actions[0];
    expect(action.tier).toBe(PriorityTier.EXPLICIT_USER_REQUEST);
    expect(action.type).toBe(AdaptationActionType.MODIFY);
    expect(action.parameters).toEqual({ mode: "minimal" });
    expect(action.evidence).toContain("policy:pref.ui_minimal@v1");
    expect(outcome.trace.preferenceResult.appliedRequests).toEqual(["pref.ui_minimal"]);
    expect(outcome.trace.sources).toContain("user_preferences");
    expect(() => validateAdaptationPlan(outcome.plan)).not.toThrow();
  });

  it("applies multiple requests on different targets", () => {
    const outcome = decide(
      decisionInput({
        userPreferences: {
          accessibility: {},
          requested: [
            { id: "pref.ui", target: UI, parameters: { mode: "focus" } },
            { id: "pref.assist", target: ASSISTANCE, parameters: { mode: "guided" } },
          ],
          restricted: [],
        },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(2);
    expect(outcome.trace.preferenceResult.appliedRequests).toEqual(
      expect.arrayContaining(["pref.ui", "pref.assist"]),
    );
  });

  it("overrides a lower-tier policy candidate on the same target", () => {
    const outcome = decide(
      decisionInput({
        moduleContext: { moduleId: "focus", modulePolicies: [uiFocusPolicy()] },
        userPreferences: {
          accessibility: {},
          requested: [{ id: "pref.ui_minimal", target: UI, parameters: { mode: "minimal" } }],
          restricted: [],
        },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(1);
    expect(outcome.plan.actions[0].tier).toBe(PriorityTier.EXPLICIT_USER_REQUEST);
    expect(outcome.plan.actions[0].parameters).toEqual({ mode: "minimal" });
    expect(outcome.trace.preferenceResult.appliedRequests).toEqual(["pref.ui_minimal"]);
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain("module.ui_focus");
    // Preference-vs-policy suppression is an override, not a D4 conflict.
    expect(outcome.trace.conflicts).toEqual([]);
    expect(
      outcome.trace.overrides.some(
        (o) => o.kind === "preference" && o.actionId === "pref.ui_minimal" && o.applied === true,
      ),
    ).toBe(true);
  });

  it("lets a soft accessibility preference outrank a Tier 8 state rule on a conflicting key", () => {
    const policy = {
      ...uiFocusPolicy(),
      action: { type: AdaptationActionType.MODIFY, target: UI, parameters: { reduceMotion: false } },
    };
    const outcome = decide(
      decisionInput({
        moduleContext: { moduleId: "focus", modulePolicies: [policy] },
        userPreferences: {
          accessibility: { reduceMotion: true },
          requested: [],
          restricted: [],
        },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(1);
    const action = outcome.plan.actions[0];
    expect(action.tier).toBe(PriorityTier.EXPLICIT_PREFERENCE);
    expect(action.parameters).toEqual({ reduceMotion: true });
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain("module.ui_focus");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Tier precedence: request > soft preference; safety > everything
// ─────────────────────────────────────────────────────────────────

describe("D14 tier precedence", () => {
  it("lets an explicit request beat a conflicting soft accessibility preference", () => {
    const outcome = decide(
      decisionInput({
        userPreferences: {
          accessibility: { screenReader: true },
          requested: [
            {
              id: "pref.sr_off",
              target: ASSISTANCE,
              type: AdaptationActionType.DISABLE,
              parameters: { screenReader: true },
            },
          ],
          restricted: [],
        },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(1);
    expect(outcome.plan.actions[0].evidence).toContain("policy:pref.sr_off@v1");
    expect(outcome.trace.preferenceResult.appliedRequests).toEqual(["pref.sr_off"]);
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain(
      "accessibility.screenReader",
    );
    const loserOverride = outcome.trace.overrides.find(
      (o) => o.kind === "preference" && o.actionId === "accessibility.screenReader",
    );
    expect(loserOverride.applied).toBe(false);
  });

  it("never lets a preference override a Tier 1 safety candidate", () => {
    const outcome = decide(
      decisionInput({
        userState: { ...calmUserState(), stressLevel: "critical" },
        moduleContext: { moduleId: "focus", modulePolicies: [safetyUiPolicy()] },
        userPreferences: {
          accessibility: {},
          requested: [{ id: "pref.ui_quiet", target: UI, parameters: { mode: "quiet" } }],
          restricted: [],
        },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(1);
    expect(outcome.plan.actions[0].tier).toBe(PriorityTier.SAFETY);
    expect(outcome.plan.actions[0].parameters).toEqual({ mode: "emergency" });
    expect(outcome.trace.preferenceResult.appliedRequests).toEqual([]);
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain("pref.ui_quiet");
    const loserOverride = outcome.trace.overrides.find(
      (o) => o.kind === "preference" && o.actionId === "pref.ui_quiet",
    );
    expect(loserOverride.applied).toBe(false);
  });

  it("lets a requestable preference override a Tier 9 learned candidate", () => {
    const outcome = decide(
      decisionInput({
        moduleContext: { moduleId: "focus", modulePolicies: [learnedPolicy()] },
        role4Signals: { strategyEffectiveness: { [LEARNED_STRATEGY]: 0.8 } },
        userPreferences: {
          accessibility: {},
          requested: [
            { id: "pref.no_assistance", target: ASSISTANCE, parameters: { mode: "manual" } },
          ],
          restricted: [],
        },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(1);
    expect(outcome.plan.actions[0].tier).toBe(PriorityTier.EXPLICIT_USER_REQUEST);
    expect(outcome.trace.preferenceResult.appliedRequests).toEqual(["pref.no_assistance"]);
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain(
      "learned.recommend_focus",
    );
    // The learned signal was rejected, so no learned signal influenced the plan.
    expect(outcome.trace.preferenceResult.learnedSignalsUsed).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Hard restrictions (Tier 3 boundaries)
// ─────────────────────────────────────────────────────────────────

describe("D14 hard restrictions", () => {
  it("blocks a conflicting candidate and records the honored restriction", () => {
    const outcome = decide(
      decisionInput({
        moduleContext: { moduleId: "focus", modulePolicies: [uiFocusPolicy()] },
        userPreferences: {
          accessibility: {},
          requested: [],
          restricted: [
            { id: "restrict.ui_boundary", target: UI, parameters: { mode: "minimal" } },
          ],
        },
      }),
    );

    expect(outcome.plan.actions).toEqual([]);
    expect(outcome.trace.preferenceResult.honoredRestrictions).toEqual([
      "restrict.ui_boundary",
    ]);
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain("module.ui_focus");
    expect(
      outcome.trace.overrides.some(
        (o) => o.kind === "preference" && o.actionId === "restrict.ui_boundary" && o.applied === true,
      ),
    ).toBe(true);
  });

  it("treats a boundary with no type/parameters as a blanket ban", () => {
    const outcome = decide(
      decisionInput({
        moduleContext: { moduleId: "focus", modulePolicies: [uiFocusPolicy()] },
        userPreferences: {
          accessibility: {},
          requested: [],
          restricted: [{ id: "restrict.no_ui", target: UI }],
        },
      }),
    );

    expect(outcome.plan.actions).toEqual([]);
    expect(outcome.trace.preferenceResult.honoredRestrictions).toEqual(["restrict.no_ui"]);
  });

  it("never creates an action of its own and ignores vacuous boundaries", () => {
    const outcome = decide(
      decisionInput({
        userPreferences: {
          accessibility: {},
          requested: [],
          restricted: [{ id: "restrict.timing", target: AdaptationDimension.TIMING }],
        },
      }),
    );

    expect(outcome.plan.actions).toEqual([]);
    expect(outcome.trace.preferenceResult.honoredRestrictions).toEqual([]);
  });

  it("does not suppress a Tier 1 safety candidate", () => {
    const outcome = decide(
      decisionInput({
        userState: { ...calmUserState(), stressLevel: "critical" },
        moduleContext: { moduleId: "focus", modulePolicies: [safetyUiPolicy()] },
        userPreferences: {
          accessibility: {},
          requested: [],
          restricted: [{ id: "restrict.no_ui", target: UI }],
        },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(1);
    expect(outcome.plan.actions[0].tier).toBe(PriorityTier.SAFETY);
    expect(outcome.trace.preferenceResult.honoredRestrictions).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Accessibility allowlist + malformed input
// ─────────────────────────────────────────────────────────────────

describe("D14 accessibility mapping and input hygiene", () => {
  it("maps only allowlisted true flags; unknown/false flags are ignored", () => {
    const outcome = decide(
      decisionInput({
        userPreferences: {
          accessibility: {
            reduceMotion: true,
            screenReader: false,
            unknownFlag: true,
          },
          requested: [],
          restricted: [],
        },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(1);
    const action = outcome.plan.actions[0];
    expect(action.tier).toBe(PriorityTier.EXPLICIT_PREFERENCE);
    expect(action.type).toBe(AdaptationActionType.MODIFY);
    expect(action.target).toBe(UI);
    expect(action.parameters).toEqual({ reduceMotion: true });
    expect(outcome.trace.preferenceResult.appliedRequests).toEqual(["accessibility.reduceMotion"]);
  });

  it("maps screenReader to an ASSISTANCE ENABLE candidate", () => {
    const outcome = decide(
      decisionInput({
        userPreferences: {
          accessibility: { screenReader: true },
          requested: [],
          restricted: [],
        },
      }),
    );

    const action = outcome.plan.actions[0];
    expect(action.type).toBe(AdaptationActionType.ENABLE);
    expect(action.target).toBe(ASSISTANCE);
    expect(action.parameters).toEqual({ screenReader: true });
  });

  it("skips malformed requests without crashing or fabricating", () => {
    const outcome = decide(
      decisionInput({
        userPreferences: {
          accessibility: {},
          requested: [
            { id: "", target: UI },
            { target: UI, parameters: { mode: "missing_id" } },
            { id: "ok_request", target: "BOGUS_TARGET", parameters: { mode: "bad_target" } },
            { id: "ok_request", target: UI, parameters: { mode: "focus" } },
          ],
          restricted: [],
        },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(1);
    expect(outcome.plan.actions[0].parameters).toEqual({ mode: "focus" });
    expect(outcome.trace.preferenceResult.appliedRequests).toEqual(["ok_request"]);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Learned-signal provenance + determinism
// ─────────────────────────────────────────────────────────────────

describe("D14 provenance and determinism", () => {
  it("records learnedSignalsUsed when a Tier 9 learned rule survives", () => {
    const outcome = decide(
      decisionInput({
        moduleContext: { moduleId: "focus", modulePolicies: [learnedPolicy()] },
        role4Signals: { strategyEffectiveness: { [LEARNED_STRATEGY]: 0.8 } },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(1);
    expect(outcome.trace.preferenceResult.learnedSignalsUsed).toEqual([LEARNED_STRATEGY]);
  });

  it("is deterministic across identical inputs with preferences", () => {
    const input = decisionInput({
      userPreferences: {
        accessibility: { reduceMotion: true },
        requested: [{ id: "pref.ui", target: UI, parameters: { mode: "focus" } }],
        restricted: [],
      },
    });
    const first = decide(input, { now: () => 1000 });
    const second = decide(input, { now: () => 1000 });

    expect(first.plan.actions).toHaveLength(second.plan.actions.length);
    expect(first.plan.actions.map((a) => a.tier)).toEqual(second.plan.actions.map((a) => a.tier));
    expect(first.plan.actions.map((a) => a.parameters)).toEqual(
      second.plan.actions.map((a) => a.parameters),
    );
    expect(first.plan.actions.map((a) => a.confidence)).toEqual(
      second.plan.actions.map((a) => a.confidence),
    );
    expect(first.plan.actions.map((a) => a.actionId)).not.toEqual(
      second.plan.actions.map((a) => a.actionId),
    );
    expect(first.trace.preferenceResult).toEqual(second.trace.preferenceResult);
  });

  it("resolves conflicting preferences deterministically and records the loser", () => {
    const outcome = decide(
      decisionInput({
        userPreferences: {
          accessibility: {},
          requested: [
            { id: "pref.a", target: UI, priority: 10, parameters: { mode: "focus" } },
            { id: "pref.b", target: UI, priority: 5, parameters: { mode: "minimal" } },
          ],
          restricted: [],
        },
      }),
    );

    expect(outcome.plan.actions).toHaveLength(1);
    expect(outcome.plan.actions[0].parameters).toEqual({ mode: "focus" });
    expect(outcome.trace.preferenceResult.appliedRequests).toEqual(["pref.a"]);
    expect(outcome.trace.rejectedConditions.map((r) => r.ruleId)).toContain("pref.b");
    const loserOverride = outcome.trace.overrides.find(
      (o) => o.kind === "preference" && o.actionId === "pref.b",
    );
    expect(loserOverride.applied).toBe(false);
  });

  it("still honors an injected preference extension point", () => {
    const outcome = decide(
      decisionInput({ userPreferences: { accessibility: {}, requested: [], restricted: [] } }),
      {
        preference: (entries) => ({
          actions: entries,
          result: { appliedRequests: ["custom.pref"], honoredRestrictions: [], learnedSignalsUsed: [] },
          overrides: [{ kind: "preference", actionId: "custom.pref", applied: true, detail: "custom" }],
        }),
      },
    );

    expect(outcome.trace.preferenceResult.appliedRequests).toEqual(["custom.pref"]);
    expect(outcome.trace.overrides.some((o) => o.kind === "preference")).toBe(true);
  });
});
