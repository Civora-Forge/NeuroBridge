import { describe, it, expect } from "vitest";
import { buildUserState } from "../../state/userStateModel.js";
import {
  reasonAboutUserState,
  SITUATIONS,
  SITUATION_REGISTRY,
} from "../cognitiveReasoning.js";

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Build a UserState-shaped object with the actual schema produced by
 * buildUserState (top-level string dimension values + metadata), but with
 * full control over individual values. Useful for testing reasoning rules
 * in isolation (e.g. confidence propagation, conflicting signals).
 */
function makeState(overrides = {}, { overallConfidence = 0 } = {}) {
  return {
    emotionalState: "unknown",
    cognitiveLoad: "unknown",
    energyLevel: "unknown",
    attentionState: "unknown",
    stressLevel: "unknown",
    motivationLevel: "unknown",
    urgency: "unknown",
    taskComplexity: "unknown",
    engagementLevel: "unknown",
    overallConfidence,
    timestamp: "2026-01-01T00:00:00.000Z",
    sources: [],
    ...overrides,
  };
}

function expectWellFormedResult(result) {
  expect(result).toBeDefined();
  expect(typeof result.situation).toBe("string");
  expect(typeof result.primaryNeed).toBe("string");
  expect(Array.isArray(result.secondaryNeeds)).toBe(true);
  expect(typeof result.strategy).toBe("string");
  expect(Array.isArray(result.reasoning)).toBe(true);
  expect(Array.isArray(result.summary)).toBe(true);
  expect(typeof result.confidence).toBe("number");
  expect(result.confidence).toBeGreaterThanOrEqual(0);
  expect(result.confidence).toBeLessThanOrEqual(1);
  expect(typeof result.timestamp).toBe("string");
  expect(Array.isArray(result.sources)).toBe(true);
}

// ─────────────────────────────────────────────────────────────────
//  Test 1: Cognitive overload
// ─────────────────────────────────────────────────────────────────

describe("Cognitive Reasoning Core — cognitive overload", () => {
  it("should detect cognitive_overload from high load + fragmented attention", () => {
    const userState = buildUserState({
      activity: { taskSwitching: "high" },
      task: { complexity: "complex" },
    });

    const result = reasonAboutUserState(userState);
    expectWellFormedResult(result);

    expect(result.situation).toBe("cognitive_overload");
    expect(result.primaryNeed).toBe("task_simplification");
    expect(result.strategy).toBe("reduce_cognitive_complexity");
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it("should classify overwhelming load as cognitive_overload", () => {
    const userState = makeState({ cognitiveLoad: "overwhelming" }, { overallConfidence: 0.7 });

    const result = reasonAboutUserState(userState);
    expect(result.situation).toBe("cognitive_overload");
    expect(result.primaryNeed).toBe("task_simplification");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 2: Emotional distress
// ─────────────────────────────────────────────────────────────────

describe("Cognitive Reasoning Core — emotional distress", () => {
  it("should detect emotional_distress from high stress + overwhelmed emotion", () => {
    const userState = buildUserState({
      emotion: { label: "overwhelmed", confidence: 0.9 },
      biometrics: { heartRateVariabilityMs: 25 },
    });

    const result = reasonAboutUserState(userState);
    expectWellFormedResult(result);

    expect(result.situation).toBe("emotional_distress");
    expect(result.primaryNeed).toBe("emotional_regulation");
    expect(result.strategy).toBe("reduce_stress_and_stabilize");
  });

  it("should detect emotional_distress from acute stress + anxious emotion", () => {
    const userState = makeState(
      { stressLevel: "acute", emotionalState: "anxious" },
      { overallConfidence: 0.8 },
    );

    const result = reasonAboutUserState(userState);
    expect(result.situation).toBe("emotional_distress");
    expect(result.primaryNeed).toBe("emotional_regulation");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 3: Low energy
// ─────────────────────────────────────────────────────────────────

describe("Cognitive Reasoning Core — low energy", () => {
  it("should detect low_energy from tired energy + low motivation", () => {
    const userState = buildUserState({
      emotion: { label: "sad", confidence: 0.8 },
      activity: { taskCompletionCount: 1, taskAbandonCount: 7 },
    });

    const result = reasonAboutUserState(userState);
    expectWellFormedResult(result);

    expect(result.situation).toBe("low_energy");
    expect(result.primaryNeed).toBe("low_effort_support");
    expect(result.strategy).toBe("reduce_task_demand");
  });

  it("should detect low_energy from exhausted energy + low motivation", () => {
    const userState = makeState(
      { energyLevel: "exhausted", motivationLevel: "low" },
      { overallConfidence: 0.8 },
    );

    const result = reasonAboutUserState(userState);
    expect(result.situation).toBe("low_energy");
  });

  it("should NOT detect low_energy when energy is low but motivation is fine", () => {
    const userState = makeState(
      { energyLevel: "tired", motivationLevel: "high" },
      { overallConfidence: 0.8 },
    );

    const result = reasonAboutUserState(userState);
    expect(result.situation).not.toBe("low_energy");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 4: Urgent overload
// ─────────────────────────────────────────────────────────────────

describe("Cognitive Reasoning Core — urgent overload", () => {
  it("should detect urgent_overload from high urgency + high cognitive load", () => {
    const userState = buildUserState({
      task: { urgency: "high", complexity: "complex" },
      activity: { taskSwitching: "high" },
    });

    const result = reasonAboutUserState(userState);
    expectWellFormedResult(result);

    expect(result.situation).toBe("urgent_overload");
    expect(result.primaryNeed).toBe("immediate_task_simplification");
    expect(result.strategy).toBe("prioritize_and_reduce_complexity");
  });

  it("should be distinct from ordinary cognitive_overload", () => {
    const urgent = reasonAboutUserState(
      makeState(
        { urgency: "high", cognitiveLoad: "high" },
        { overallConfidence: 0.7 },
      ),
    );
    const notUrgent = reasonAboutUserState(
      makeState(
        { urgency: "low", cognitiveLoad: "high" },
        { overallConfidence: 0.7 },
      ),
    );

    expect(urgent.situation).toBe("urgent_overload");
    expect(notUrgent.situation).toBe("cognitive_overload");
    expect(urgent.primaryNeed).toBe("immediate_task_simplification");
    expect(notUrgent.primaryNeed).toBe("task_simplification");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 5: Attention fragmentation
// ─────────────────────────────────────────────────────────────────

describe("Cognitive Reasoning Core — attention fragmentation", () => {
  it("should detect attention_fragmentation from scattered attention", () => {
    const userState = buildUserState({ activity: { taskSwitching: "medium" } });

    const result = reasonAboutUserState(userState);
    expectWellFormedResult(result);

    expect(result.situation).toBe("attention_fragmentation");
    expect(result.primaryNeed).toBe("attention_support");
    expect(result.strategy).toBe("reduce_distractions_and_focus");
  });

  it("should detect attention_fragmentation from absent attention", () => {
    const userState = buildUserState({ activity: { engagement: "disengaged" } });

    const result = reasonAboutUserState(userState);
    expect(result.situation).toBe("attention_fragmentation");
    expect(result.primaryNeed).toBe("attention_support");
  });

  it("should detect attention_fragmentation from fragmented attention when load is unknown", () => {
    const userState = makeState({ attentionState: "fragmented" }, { overallConfidence: 0.4 });

    const result = reasonAboutUserState(userState);
    expect(result.situation).toBe("attention_fragmentation");
    expect(result.primaryNeed).toBe("attention_support");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 6: Stable state
// ─────────────────────────────────────────────────────────────────

describe("Cognitive Reasoning Core — stable state", () => {
  it("should detect a stable state when no difficulty is present", () => {
    const userState = buildUserState({
      emotion: { label: "calm", confidence: 0.9 },
      activity: {
        taskSwitching: "low",
        engagement: "normal",
        currentTask: "reading a report",
      },
      task: { urgency: "low", complexity: "simple" },
      environment: { timeOfDay: "morning" },
    });

    const result = reasonAboutUserState(userState);
    expectWellFormedResult(result);

    expect(result.situation).toBe("stable");
    expect(result.primaryNeed).toBe("maintain_current_state");
    expect(result.strategy).toBe("normal_support");
    expect(result.secondaryNeeds).toEqual([]);
  });

  it("should not invent a problem when the state is stable", () => {
    const result = reasonAboutUserState(
      makeState(
        {
          emotionalState: "content",
          cognitiveLoad: "low",
          energyLevel: "rested",
          attentionState: "focused",
          stressLevel: "none",
          motivationLevel: "high",
          urgency: "low",
          taskComplexity: "simple",
          engagementLevel: "high",
        },
        { overallConfidence: 0.8 },
      ),
    );

    expect(result.situation).toBe("stable");
    expect(result.situation).not.toMatch(/overload|distress|fragment/);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 7: Multiple simultaneous difficulties
// ─────────────────────────────────────────────────────────────────

describe("Cognitive Reasoning Core — multiple simultaneous difficulties", () => {
  it("should resolve to urgent_overload with correct secondary needs", () => {
    const userState = buildUserState({
      emotion: { label: "overwhelmed", confidence: 0.9 },
      activity: {
        taskSwitching: "high",
        taskCompletionCount: 1,
        taskAbandonCount: 7,
      },
      task: { urgency: "high", complexity: "complex" },
    });

    const result = reasonAboutUserState(userState);
    expectWellFormedResult(result);

    // Primary: urgent_overload (highest priority)
    expect(result.situation).toBe("urgent_overload");
    expect(result.primaryNeed).toBe("immediate_task_simplification");
    expect(result.strategy).toBe("prioritize_and_reduce_complexity");

    // Secondary needs from emotional_distress, attention_fragmentation, low_energy
    expect(result.secondaryNeeds).toContain("emotional_regulation");
    expect(result.secondaryNeeds).toContain("attention_support");
    expect(result.secondaryNeeds).toContain("low_effort_support");

    // Subsumed cognitive_overload need must not be duplicated
    expect(result.secondaryNeeds).not.toContain("task_simplification");

    // Confidence should be high with strong multi-signal support
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("should resolve emotional distress over plain cognitive overload", () => {
    const userState = makeState(
      {
        cognitiveLoad: "high",
        stressLevel: "high",
        emotionalState: "anxious",
        urgency: "low",
      },
      { overallConfidence: 0.8 },
    );

    const result = reasonAboutUserState(userState);
    expect(result.situation).toBe("emotional_distress");
    expect(result.secondaryNeeds).toContain("task_simplification");
  });

  it("should prioritize cognitive overload over attention fragmentation", () => {
    const userState = makeState(
      {
        cognitiveLoad: "high",
        attentionState: "fragmented",
        energyLevel: "normal",
        motivationLevel: "moderate",
      },
      { overallConfidence: 0.7 },
    );

    const result = reasonAboutUserState(userState);
    expect(result.situation).toBe("cognitive_overload");
    expect(result.secondaryNeeds).toContain("attention_support");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 8: Confidence propagation
// ─────────────────────────────────────────────────────────────────

describe("Cognitive Reasoning Core — confidence", () => {
  it("should reduce confidence when the underlying UserState is low-confidence", () => {
    const high = reasonAboutUserState(
      makeState({ cognitiveLoad: "high", attentionState: "fragmented" }, { overallConfidence: 0.9 }),
    );
    const low = reasonAboutUserState(
      makeState({ cognitiveLoad: "high", attentionState: "fragmented" }, { overallConfidence: 0.1 }),
    );

    expect(high.situation).toBe("cognitive_overload");
    expect(low.situation).toBe("cognitive_overload");
    expect(low.confidence).toBeLessThan(high.confidence);
  });

  it("should reduce confidence when signals conflict", () => {
    const noConflict = reasonAboutUserState(
      makeState({ cognitiveLoad: "high" }, { overallConfidence: 0.7 }),
    );
    const withConflict = reasonAboutUserState(
      makeState(
        { cognitiveLoad: "high", emotionalState: "calm", stressLevel: "none" },
        { overallConfidence: 0.7 },
      ),
    );

    expect(noConflict.situation).toBe("cognitive_overload");
    expect(withConflict.situation).toBe("cognitive_overload");
    expect(withConflict.confidence).toBeLessThan(noConflict.confidence);
  });

  it("should report a low confidence for insufficient information", () => {
    const result = reasonAboutUserState(buildUserState({}));
    expect(result.situation).toBe("insufficient_information");
    expect(result.confidence).toBeLessThan(0.4);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 9: Unknown / empty state handling
// ─────────────────────────────────────────────────────────────────

describe("Cognitive Reasoning Core — unknown state handling", () => {
  it("should return insufficient_information for an empty UserState", () => {
    const result = reasonAboutUserState(buildUserState({}));
    expectWellFormedResult(result);

    expect(result.situation).toBe("insufficient_information");
    expect(result.primaryNeed).toBe("gather_information");
    expect(result.strategy).toBe("wait_and_observe");
    expect(result.confidence).toBeLessThan(0.4);
  });

  it("should return insufficient_information for a mostly-unknown UserState", () => {
    const userState = makeState(
      { cognitiveLoad: "low", urgency: "low" },
      { overallConfidence: 0.2 },
    );

    const result = reasonAboutUserState(userState);
    expect(result.situation).toBe("insufficient_information");
    expect(result.confidence).toBeLessThan(0.4);
  });

  it("should handle null / undefined gracefully", () => {
    for (const input of [null, undefined]) {
      const result = reasonAboutUserState(input);
      expect(result.situation).toBe("insufficient_information");
      expect(result.confidence).toBeLessThan(0.4);
    }
  });

  it("should not fabricate a situation when only unknown dimensions exist", () => {
    const result = reasonAboutUserState(
      makeState({}, { overallConfidence: 0 }),
    );
    expect(result.situation).toBe("insufficient_information");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 10: Explainability
// ─────────────────────────────────────────────────────────────────

describe("Cognitive Reasoning Core — explainability", () => {
  it("should explain cognitive_overload with strong factors", () => {
    const result = reasonAboutUserState(
      makeState({ cognitiveLoad: "high" }, { overallConfidence: 0.8 }),
    );

    const loadFactor = result.reasoning.find((f) => f.factor === "cognitiveLoad");
    expect(loadFactor).toBeDefined();
    expect(loadFactor.value).toBe("high");
    expect(loadFactor.contribution).toBe("strong");

    expect(result.summary.length).toBeGreaterThan(0);
    expect(typeof result.summary[0]).toBe("string");
  });

  it("should explain urgent_overload with urgency and load factors", () => {
    const result = reasonAboutUserState(
      makeState(
        { urgency: "high", cognitiveLoad: "overwhelming" },
        { overallConfidence: 0.8 },
      ),
    );

    const factors = result.reasoning.map((f) => f.factor);
    expect(factors).toContain("urgency");
    expect(factors).toContain("cognitiveLoad");

    const urgencyFactor = result.reasoning.find((f) => f.factor === "urgency");
    expect(urgencyFactor.contribution).toBe("strong");
  });

  it("should surface conflicting signals in reasoning", () => {
    const result = reasonAboutUserState(
      makeState(
        { cognitiveLoad: "high", emotionalState: "calm", stressLevel: "none" },
        { overallConfidence: 0.7 },
      ),
    );

    const conflicting = result.reasoning.filter((f) => f.contribution === "conflicting");
    expect(conflicting.length).toBeGreaterThan(0);
    expect(conflicting.map((f) => f.factor)).toEqual(
      expect.arrayContaining(["emotionalState", "stressLevel"]),
    );
  });

  it("should include supporting factors for a stable state", () => {
    const result = reasonAboutUserState(
      makeState(
        {
          cognitiveLoad: "low",
          stressLevel: "none",
          energyLevel: "rested",
          attentionState: "focused",
          emotionalState: "content",
          motivationLevel: "high",
          urgency: "low",
          taskComplexity: "simple",
          engagementLevel: "high",
        },
        { overallConfidence: 0.9 },
      ),
    );

    expect(result.situation).toBe("stable");
    expect(result.reasoning.some((f) => f.contribution === "supporting")).toBe(true);
  });

  it("should produce a serializable result", () => {
    const result = reasonAboutUserState(
      buildUserState({
        activity: { taskSwitching: "high" },
        task: { urgency: "high" },
      }),
    );

    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed.situation).toBe(result.situation);
    expect(parsed.reasoning).toEqual(result.reasoning);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Determinism & contract
// ─────────────────────────────────────────────────────────────────

describe("Cognitive Reasoning Core — contract", () => {
  it("should be deterministic for the same input", () => {
    const state = makeState(
      { cognitiveLoad: "high", attentionState: "fragmented", urgency: "high" },
      { overallConfidence: 0.7 },
    );

    const first = reasonAboutUserState(state);
    const second = reasonAboutUserState(state);

    expect(first).toEqual(second);
  });

  it("should expose a stable vocabulary via SITUATIONS", () => {
    expect(SITUATIONS.cognitive_overload).toBe("cognitive_overload");
    expect(SITUATIONS.insufficient_information).toBe("insufficient_information");
  });

  it("should document priorities in the registry", () => {
    const ids = Object.values(SITUATION_REGISTRY);
    const nonFallback = ids.filter(
      (s) => s.id !== "stable" && s.id !== "insufficient_information",
    );
    for (const s of nonFallback) {
      expect(s.priority).toBeGreaterThan(0);
    }
    expect(SITUATION_REGISTRY.stable.priority).toBeLessThan(
      SITUATION_REGISTRY.low_energy.priority,
    );
  });
});
