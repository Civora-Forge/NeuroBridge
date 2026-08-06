import { afterEach, describe, expect, it, vi } from "vitest";
import { decide } from "../adaptiveEngine.js";
import { safetyGate, engineSafety } from "../safetyGate.js";
import * as interventionSelection from "@/support/framework/interventionSelection";
import {
  AdaptationDimension,
  SafetyLevel,
} from "@/support/schemas/supportSchemas";

function entry(overrides = {}) {
  return {
    ruleId: "test.rule",
    version: 1,
    tier: 8,
    priority: 10,
    scope: "generic",
    action: {
      type: "MODIFY",
      target: AdaptationDimension.UI,
      parameters: { mode: "focus" },
    },
    reason: 'Policy "test.rule" (v1) matched: attention == "focused".',
    ...overrides,
  };
}

function overloadSnapshot() {
  return {
    timestamp: "2026-08-01T00:00:00.000Z",
    mood: { primaryMood: "overwhelmed", confidence: 0.9 },
    behavior: { taskSwitchFrequency: 1.0 },
    conversation: { urgency: "high" },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("safetyGate (production default, D5)", () => {
  it("maps a standard assessment to ALLOW with no guardrails", () => {
    const result = safetyGate(entry(), { moduleId: "focus" });
    expect(result.level).toBe(SafetyLevel.STANDARD);
    expect(result.disposition).toBe("ALLOW");
    expect(result.guardrails).toEqual({});
  });

  it("maps diagnosis-claim language to CAUTION / MODIFY with generic guardrails", () => {
    const result = safetyGate(
      entry({ reason: 'Policy "x" (v1) matched: a diagnosis was requested.' }),
      { moduleId: "focus" },
    );
    expect(result.level).toBe(SafetyLevel.CAUTION);
    expect(result.disposition).toBe("MODIFY");
    expect(result.guardrails.reducedIntensity).toBe(true);
    expect(result.guardrails.requireConfirmation).toBe(true);
    expect(result.reasons).toContain("clinical_claim_guardrail");
  });

  it("maps crisis-class language to ESCALATE", () => {
    const result = safetyGate(
      entry({ reason: "matched: user referred to self-harm in the request." }),
      { moduleId: "focus" },
    );
    expect(result.level).toBe(SafetyLevel.ESCALATE);
    expect(result.disposition).toBe("ESCALATE");
    expect(result.reasons).toContain("crisis_language_detected");
  });

  it("raises ALLOW results to MODIFY when the module declares safetyLevel CAUTION", () => {
    const result = safetyGate(entry(), {
      moduleId: "focus",
      safetyLevel: SafetyLevel.CAUTION,
    });
    expect(result.level).toBe(SafetyLevel.CAUTION);
    expect(result.disposition).toBe("MODIFY");
    expect(result.reasons).toContain("module_safety_level:caution");
  });

  it("blocks all candidates when the module declares safetyLevel ESCALATE", () => {
    const result = safetyGate(entry(), {
      moduleId: "focus",
      safetyLevel: SafetyLevel.ESCALATE,
    });
    expect(result.level).toBe(SafetyLevel.ESCALATE);
    expect(result.disposition).toBe("ESCALATE");
  });

  it("passes only module-declared metadata to the safety primitive (no PHI)", () => {
    const spy = vi.spyOn(interventionSelection, "assessSupportSafety");
    safetyGate(entry(), {
      moduleId: "focus",
      safetyLevel: SafetyLevel.STANDARD,
      interventionTypes: ["focus_session"],
      title: "Focus",
      route: "/focus",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const context = spy.mock.calls[0][0].context;
    expect(context).toEqual({
      moduleId: "focus",
      safetyLevel: SafetyLevel.STANDARD,
      interventionTypes: ["focus_session"],
    });
    expect(context).not.toHaveProperty("title");
    expect(context).not.toHaveProperty("route");
  });

  it("fails closed (BLOCK) when the safety primitive is unavailable", () => {
    vi.spyOn(interventionSelection, "assessSupportSafety").mockImplementation(() => {
      throw new Error("store unavailable");
    });
    const result = safetyGate(entry(), { moduleId: "focus" });
    expect(result.level).toBe(SafetyLevel.ESCALATE);
    expect(result.disposition).toBe("BLOCK");
    expect(result.reasons).toContain("safety_check_unavailable");
  });

  it("exposes an object-form surface", () => {
    expect(typeof engineSafety.evaluate).toBe("function");
    const result = engineSafety.evaluate(entry(), { moduleId: "focus" });
    expect(result.disposition).toBe("ALLOW");
  });
});

describe("safety gate in the engine pipeline", () => {
  it("uses the production gate by default and reports ALLOW for benign input", () => {
    const outcome = decide({ contextSnapshot: overloadSnapshot() });
    expect(outcome.plan.actions.length).toBeGreaterThan(0);
    for (const action of outcome.plan.actions) {
      expect(action.safety.disposition).toBe("ALLOW");
      expect(action.safety.level).toBe(SafetyLevel.STANDARD);
    }
    expect(outcome.trace.safetyResult.disposition).toBe("ALLOW");
    expect(outcome.trace.overrides).toEqual([]);
  });

  it("removes every candidate when the module declares safetyLevel ESCALATE", () => {
    const outcome = decide({
      contextSnapshot: overloadSnapshot(),
      moduleContext: {
        moduleId: "focus",
        safetyLevel: SafetyLevel.ESCALATE,
      },
    });
    expect(outcome.plan.actions).toEqual([]);
    expect(outcome.trace.safetyResult.disposition).toBe("ESCALATE");
    expect(outcome.trace.overrides.some((o) => o.kind === "safety" && o.applied === false)).toBe(true);
    expect(outcome.trace.rejectedConditions.length).toBeGreaterThan(0);
  });

  it("attaches MODIFY guardrails and an override when the module declares CAUTION", () => {
    const outcome = decide({
      contextSnapshot: overloadSnapshot(),
      moduleContext: { moduleId: "focus", safetyLevel: SafetyLevel.CAUTION },
    });
    expect(outcome.plan.actions.length).toBeGreaterThan(0);
    for (const action of outcome.plan.actions) {
      expect(action.safety.disposition).toBe("MODIFY");
      expect(action.parameters.reducedIntensity).toBe(true);
    }
    expect(outcome.trace.safetyResult.disposition).toBe("MODIFY");
    expect(outcome.trace.overrides.some((o) => o.kind === "safety" && o.applied === true)).toBe(true);
    expect(outcome.plan.actions[0].parameters).toBeDefined();
  });
});
