import { describe, it, expect } from "vitest";
import {
  buildUserState,
  detectStateTransition,
  EMOTIONAL_STATES,
  COGNITIVE_LOADS,
  ENERGY_LEVELS,
  ATTENTION_STATES,
  STRESS_LEVELS,
  MOTIVATION_LEVELS,
  URGENCY_LEVELS,
  TASK_COMPLEXITIES,
  ENGAGEMENT_LEVELS,
} from "../userStateModel.js";

// ─────────────────────────────────────────────────────────────────
//  Helper: assert a dimension has the expected structure
// ─────────────────────────────────────────────────────────────────

function expectValidDimension(dim, expectedValue) {
  expect(dim).toBeDefined();
  expect(typeof dim).toBe("string");
  expect(dim).toBe(expectedValue);
}

function expectValidMetadata(state) {
  expect(typeof state.overallConfidence).toBe("number");
  expect(state.overallConfidence).toBeGreaterThanOrEqual(0);
  expect(state.overallConfidence).toBeLessThanOrEqual(1);
  expect(typeof state.timestamp).toBe("string");
  expect(Array.isArray(state.sources)).toBe(true);
  expect(state._dimensions).toBeDefined();
  expect(typeof state._dimensions).toBe("object");
}

// ─────────────────────────────────────────────────────────────────
//  Test 1: Normal context — low load, normal attention, low urgency
// ─────────────────────────────────────────────────────────────────

describe("UserStateModel — Normal context", () => {
  it("should produce a low-load state from calm, simple signals", () => {
    const snapshot = {
      emotion: { label: "calm", confidence: 0.9 },
      activity: { taskSwitching: "low", engagement: "normal", currentTask: "reading" },
      task: { urgency: "low", complexity: "simple" },
      environment: { timeOfDay: "morning" },
    };

    const state = buildUserState(snapshot);

    expectValidMetadata(state);
    expectValidDimension(state.emotionalState, "calm");
    expectValidDimension(state.cognitiveLoad, "low");
    expectValidDimension(state.stressLevel, "none");
    expectValidDimension(state.urgency, "low");
    expectValidDimension(state.taskComplexity, "simple");
    expectValidDimension(state.attentionState, "focused");
    expectValidDimension(state.engagementLevel, "normal");

    // Backward-compatible aliases
    expect(state.mood).toBe("calm");
    expect(state.attention).toBe("focused");
  });

  it("should have high confidence when signals are strong", () => {
    const snapshot = {
      emotion: { label: "content", confidence: 0.95 },
      activity: { taskSwitching: "low", engagement: "high" },
      task: { urgency: "low", complexity: "simple" },
    };

    const state = buildUserState(snapshot);
    expect(state.overallConfidence).toBeGreaterThan(0.5);
    expect(state.sources.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 2: Overwhelmed user — high load, fragmented attention
// ─────────────────────────────────────────────────────────────────

describe("UserStateModel — Overwhelmed user", () => {
  it("should detect overwhelming cognitive load from overwhelmed emotion + high task switching", () => {
    const snapshot = {
      emotion: { label: "overwhelmed", confidence: 0.86 },
      activity: { taskSwitching: "high", engagement: "low" },
      task: { urgency: "high", complexity: "complex" },
    };

    const state = buildUserState(snapshot);

    expectValidDimension(state.emotionalState, "overwhelmed");
    expectValidDimension(state.cognitiveLoad, "overwhelming");
    expectValidDimension(state.stressLevel, "high");
    expectValidDimension(state.urgency, "high");
    expectValidDimension(state.taskComplexity, "complex");
    expectValidDimension(state.attentionState, "fragmented");
    expectValidDimension(state.engagementLevel, "low");
  });

  it("should detect fragmented attention from high task switching", () => {
    const snapshot = {
      activity: { taskSwitching: "high" },
    };

    const state = buildUserState(snapshot);
    expectValidDimension(state.attentionState, "fragmented");
    expectValidDimension(state.cognitiveLoad, "high");
  });

  it("should detect high stress from panicked emotion", () => {
    const snapshot = {
      emotion: { label: "panicked", confidence: 0.92 },
    };

    const state = buildUserState(snapshot);
    expectValidDimension(state.stressLevel, "acute");
    expectValidDimension(state.cognitiveLoad, "overwhelming");
    expectValidDimension(state.energyLevel, "exhausted");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 3: Missing data — should produce "unknown" not fabricated values
// ─────────────────────────────────────────────────────────────────

describe("UserStateModel — Missing data", () => {
  it("should return 'unknown' for all dimensions when no emotion signal is provided", () => {
    const snapshot = {
      activity: { taskSwitching: "low" },
    };

    const state = buildUserState(snapshot);

    // emotionalState should be unknown (no emotion signal)
    expectValidDimension(state.emotionalState, "unknown");
    // cognitiveLoad should still be inferable from task switching
    expectValidDimension(state.cognitiveLoad, "low");
    // stressLevel should be unknown (no emotion or biometrics)
    expectValidDimension(state.stressLevel, "unknown");
  });

  it("should return 'unknown' when activity signals are missing", () => {
    const snapshot = {
      emotion: { label: "calm", confidence: 0.8 },
    };

    const state = buildUserState(snapshot);

    expectValidDimension(state.emotionalState, "calm");
    // attentionState should be unknown (no activity signals)
    expectValidDimension(state.attentionState, "unknown");
    // engagementLevel should be unknown (no engagement signal)
    expectValidDimension(state.engagementLevel, "unknown");
  });

  it("should return 'unknown' for urgency when no task or intent signals exist", () => {
    const snapshot = {
      emotion: { label: "neutral", confidence: 0.5 },
    };

    const state = buildUserState(snapshot);
    expectValidDimension(state.urgency, "unknown");
    expectValidDimension(state.taskComplexity, "unknown");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 4: Low-confidence signals
// ─────────────────────────────────────────────────────────────────

describe("UserStateModel — Low-confidence signals", () => {
  it("should propagate low confidence from emotion signal", () => {
    const highConf = {
      emotion: { label: "anxious", confidence: 0.9 },
      activity: { taskSwitching: "low" },
    };
    const lowConf = {
      emotion: { label: "anxious", confidence: 0.15 },
      activity: { taskSwitching: "low" },
    };

    const stateHigh = buildUserState(highConf);
    const stateLow = buildUserState(lowConf);

    // Both should infer the same emotional state
    expect(stateHigh.emotionalState).toBe("anxious");
    expect(stateLow.emotionalState).toBe("anxious");

    // But the low-confidence version should have lower overall confidence
    expect(stateLow._dimensions.emotionalState.confidence).toBeLessThan(
      stateHigh._dimensions.emotionalState.confidence,
    );
  });

  it("should include low-confidence warning in reasons", () => {
    const snapshot = {
      emotion: { label: "sad", confidence: 0.1 },
    };

    const state = buildUserState(snapshot);
    const reasons = state._dimensions.emotionalState.reasons;
    expect(reasons.some((r) => r.includes("Low confidence"))).toBe(true);
  });

  it("should still provide a value even with low confidence", () => {
    const snapshot = {
      emotion: { label: "frustrated", confidence: 0.05 },
    };

    const state = buildUserState(snapshot);
    // Should still report the emotion, just with low confidence
    expect(state.emotionalState).toBe("frustrated");
    expect(state._dimensions.emotionalState.confidence).toBeLessThan(0.2);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 5: Conflicting signals
// ─────────────────────────────────────────────────────────────────

describe("UserStateModel — Conflicting signals", () => {
  it("should handle high urgency with low complexity (no conflict, different dimensions)", () => {
    const snapshot = {
      task: { urgency: "high", complexity: "simple" },
    };

    const state = buildUserState(snapshot);
    expectValidDimension(state.urgency, "high");
    expectValidDimension(state.taskComplexity, "simple");
  });

  it("should handle calm emotion with high task switching", () => {
    const snapshot = {
      emotion: { label: "calm", confidence: 0.9 },
      activity: { taskSwitching: "high" },
    };

    const state = buildUserState(snapshot);

    // Emotion says calm (low stress), but task switching says high cognitive load
    expectValidDimension(state.emotionalState, "calm");
    expectValidDimension(state.cognitiveLoad, "high");
    // Stress should be low because emotion is calm (emotion is the primary stress signal)
    expectValidDimension(state.stressLevel, "none");
  });

  it("should use confidence-weighted resolution when biometrics conflict with emotion", () => {
    const snapshot = {
      emotion: { label: "calm", confidence: 0.9 },
      biometrics: { heartRateVariabilityMs: 25, electrodermalActivityMuS: 7 },
    };

    const state = buildUserState(snapshot);

    // Emotion says calm, but biometrics say acute stress
    expectValidDimension(state.emotionalState, "calm");
    // Biometrics should override stress level
    expectValidDimension(state.stressLevel, "acute");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 6: Empty ContextSnapshot
// ─────────────────────────────────────────────────────────────────

describe("UserStateModel — Empty ContextSnapshot", () => {
  it("should return a valid default UserState from null", () => {
    const state = buildUserState(null);

    expectValidMetadata(state);
    expect(state.overallConfidence).toBe(0);
    expect(state.sources).toEqual([]);

    // All dimensions should be "unknown"
    expectValidDimension(state.emotionalState, "unknown");
    expectValidDimension(state.cognitiveLoad, "unknown");
    expectValidDimension(state.energyLevel, "unknown");
    expectValidDimension(state.attentionState, "unknown");
    expectValidDimension(state.stressLevel, "unknown");
    expectValidDimension(state.motivationLevel, "unknown");
    expectValidDimension(state.urgency, "unknown");
    expectValidDimension(state.taskComplexity, "unknown");
    expectValidDimension(state.engagementLevel, "unknown");
  });

  it("should return a valid default from empty object", () => {
    const state = buildUserState({});

    expectValidMetadata(state);
    expect(state.overallConfidence).toBe(0);
    expectValidDimension(state.emotionalState, "unknown");
  });

  it("should return a valid default from undefined", () => {
    const state = buildUserState(undefined);

    expectValidMetadata(state);
    expectValidDimension(state.emotionalState, "unknown");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 7: Explainability
// ─────────────────────────────────────────────────────────────────

describe("UserStateModel — Explainability", () => {
  it("should include reasons for emotionalState", () => {
    const snapshot = {
      emotion: { label: "anxious", confidence: 0.85, source: "conversation" },
    };

    const state = buildUserState(snapshot);
    const dim = state._dimensions.emotionalState;

    expect(dim.reasons).toBeDefined();
    expect(dim.reasons.length).toBeGreaterThan(0);
    expect(dim.reasons[0]).toContain("anxious");
    expect(dim.sources).toContain("emotion");
  });

  it("should include reasons for cognitiveLoad when inferred from multiple signals", () => {
    const snapshot = {
      emotion: { label: "neutral", confidence: 0.7 },
      activity: { taskSwitching: "high" },
      task: { complexity: "complex" },
    };

    const state = buildUserState(snapshot);
    const dim = state._dimensions.cognitiveLoad;

    expect(dim.reasons.length).toBeGreaterThan(0);
    expect(dim.sources.length).toBeGreaterThan(0);
    expect(dim.sources).toContain("activity.taskSwitching");
    expect(dim.sources).toContain("task.complexity");
  });

  it("should include reasons for stress level from biometrics", () => {
    const snapshot = {
      biometrics: { heartRateVariabilityMs: 28, electrodermalActivityMuS: 6 },
    };

    const state = buildUserState(snapshot);
    const dim = state._dimensions.stressLevel;

    expect(dim.reasons.length).toBeGreaterThan(0);
    expect(dim.reasons.some((r) => r.includes("HRV"))).toBe(true);
    expect(dim.reasons.some((r) => r.includes("EDA"))).toBe(true);
    expect(dim.sources).toContain("biometrics.hrv");
    expect(dim.sources).toContain("biometrics.eda");
  });

  it("should explain unknown dimensions", () => {
    const state = buildUserState({});

    const dim = state._dimensions.emotionalState;
    expect(dim.reasons.length).toBeGreaterThan(0);
    expect(dim.reasons[0]).toContain("No");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 8: Biometrics influence
// ─────────────────────────────────────────────────────────────────

describe("UserStateModel — Biometrics", () => {
  it("should detect high stress from low HRV", () => {
    const snapshot = {
      biometrics: { heartRateVariabilityMs: 25 },
    };

    const state = buildUserState(snapshot);
    expectValidDimension(state.stressLevel, "acute");
  });

  it("should detect high stress from high EDA", () => {
    const snapshot = {
      biometrics: { electrodermalActivityMuS: 8 },
    };

    const state = buildUserState(snapshot);
    expectValidDimension(state.stressLevel, "high");
  });

  it("should detect low stress from healthy HRV", () => {
    const snapshot = {
      biometrics: { heartRateVariabilityMs: 75 },
    };

    const state = buildUserState(snapshot);
    expectValidDimension(state.stressLevel, "mild");
  });

  it("should combine HRV and EDA for stress inference", () => {
    const snapshot = {
      biometrics: { heartRateVariabilityMs: 30, electrodermalActivityMuS: 6 },
    };

    const state = buildUserState(snapshot);
    // Both indicate high stress; the highest should win
    const stress = state._dimensions.stressLevel;
    expect(["high", "acute"]).toContain(stress.value);
    expect(stress.confidence).toBeGreaterThanOrEqual(0.7);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 9: Motivation inference
// ─────────────────────────────────────────────────────────────────

describe("UserStateModel — Motivation", () => {
  it("should infer high motivation from high completion rate", () => {
    const snapshot = {
      activity: { taskCompletionCount: 8, taskAbandonCount: 1 },
    };

    const state = buildUserState(snapshot);
    expectValidDimension(state.motivationLevel, "high");
  });

  it("should infer low motivation from high abandonment rate", () => {
    const snapshot = {
      activity: { taskCompletionCount: 1, taskAbandonCount: 7 },
    };

    const state = buildUserState(snapshot);
    expectValidDimension(state.motivationLevel, "low");
  });

  it("should infer moderate motivation from engagement when no task data", () => {
    const snapshot = {
      activity: { engagement: "normal" },
    };

    const state = buildUserState(snapshot);
    expectValidDimension(state.motivationLevel, "moderate");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 10: Backward-compatible aliases
// ─────────────────────────────────────────────────────────────────

describe("UserStateModel — Backward compatibility", () => {
  it("should expose mood as alias for emotionalState", () => {
    const snapshot = {
      emotion: { label: "anxious", confidence: 0.8 },
    };

    const state = buildUserState(snapshot);
    expect(state.mood).toBe(state.emotionalState);
    expect(state.mood).toBe("anxious");
  });

  it("should expose attention as alias for attentionState", () => {
    const snapshot = {
      activity: { taskSwitching: "high" },
    };

    const state = buildUserState(snapshot);
    expect(state.attention).toBe(state.attentionState);
    expect(state.attention).toBe("fragmented");
  });

  it("should expose energy as alias for energyLevel", () => {
    const snapshot = {
      emotion: { label: "overwhelmed", confidence: 0.9 },
    };

    const state = buildUserState(snapshot);
    expect(state.energy).toBe(state.energyLevel);
  });

  it("should expose engagement as alias for engagementLevel", () => {
    const snapshot = {
      activity: { engagement: "high" },
    };

    const state = buildUserState(snapshot);
    expect(state.engagement).toBe(state.engagementLevel);
    expect(state.engagement).toBe("high");
  });

  it("should work with adaptationPolicy-style string comparisons", () => {
    const snapshot = {
      emotion: { label: "panicked", confidence: 0.9 },
      activity: { taskSwitching: "high" },
      task: { urgency: "critical" },
    };

    const state = buildUserState(snapshot);

    // These are the patterns used in adaptationPolicy.js
    expect(state.cognitiveLoad === "overwhelming" || state.cognitiveLoad === "high").toBe(true);
    expect(state.mood === "anxious" || state.mood === "panicked").toBe(true);
    expect(state.urgency === "high" || state.urgency === "critical").toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 11: State transition detection
// ─────────────────────────────────────────────────────────────────

describe("detectStateTransition", () => {
  it("should detect no transition for identical states", () => {
    const state = buildUserState({
      emotion: { label: "calm", confidence: 0.8 },
      activity: { taskSwitching: "low" },
    });

    const result = detectStateTransition(state, state);
    expect(result.transitioned).toBe(false);
    expect(result.changes).toEqual([]);
  });

  it("should detect significant cognitive load transition", () => {
    const prev = buildUserState({
      emotion: { label: "calm", confidence: 0.8 },
      activity: { taskSwitching: "low" },
    });
    const curr = buildUserState({
      emotion: { label: "overwhelmed", confidence: 0.9 },
      activity: { taskSwitching: "high" },
      task: { complexity: "complex" },
    });

    const result = detectStateTransition(prev, curr);
    expect(result.transitioned).toBe(true);

    const loadChange = result.changes.find((c) => c.dimension === "cognitiveLoad");
    expect(loadChange).toBeDefined();
    expect(loadChange.significant).toBe(true);
  });

  it("should detect emotion change as significant", () => {
    const prev = buildUserState({
      emotion: { label: "calm", confidence: 0.8 },
    });
    const curr = buildUserState({
      emotion: { label: "panicked", confidence: 0.9 },
    });

    const result = detectStateTransition(prev, curr);
    const emotionChange = result.changes.find((c) => c.dimension === "emotionalState");
    expect(emotionChange).toBeDefined();
    expect(emotionChange.from).toBe("calm");
    expect(emotionChange.to).toBe("panicked");
  });

  it("should treat unknown → known transitions as significant", () => {
    const prev = buildUserState({});
    const curr = buildUserState({
      emotion: { label: "anxious", confidence: 0.7 },
    });

    const result = detectStateTransition(prev, curr);
    expect(result.transitioned).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 12: Edge cases and robustness
// ─────────────────────────────────────────────────────────────────

describe("UserStateModel — Edge cases", () => {
  it("should handle emotion with unexpected label gracefully", () => {
    const snapshot = {
      emotion: { label: "ecstatic_beyond_belief", confidence: 0.99 },
    };

    const state = buildUserState(snapshot);
    expect(state.emotionalState).toBe("ecstatic_beyond_belief");
    expect(state._dimensions.emotionalState.confidence).toBe(0.99);
  });

  it("should handle negative confidence values", () => {
    const snapshot = {
      emotion: { label: "calm", confidence: -0.5 },
    };

    const state = buildUserState(snapshot);
    expect(state._dimensions.emotionalState.confidence).toBe(0);
  });

  it("should handle confidence > 1", () => {
    const snapshot = {
      emotion: { label: "calm", confidence: 1.5 },
    };

    const state = buildUserState(snapshot);
    expect(state._dimensions.emotionalState.confidence).toBe(1);
  });

  it("should handle non-numeric confidence", () => {
    const snapshot = {
      emotion: { label: "calm", confidence: "high" },
    };

    const state = buildUserState(snapshot);
    expect(state._dimensions.emotionalState.confidence).toBe(0);
  });

  it("should handle emotion as a non-object", () => {
    const snapshot = {
      emotion: "anxious",
    };

    const state = buildUserState(snapshot);
    // emotion is a string, not an object with .label — should be unknown
    expectValidDimension(state.emotionalState, "unknown");
  });

  it("should handle very long session durations", () => {
    const snapshot = {
      activity: { sessionDurationMs: 7800000 }, // 130 minutes (> 2 hours)
    };

    const state = buildUserState(snapshot);
    expectValidDimension(state.energyLevel, "exhausted");
  });

  it("should produce serializable output", () => {
    const snapshot = {
      emotion: { label: "anxious", confidence: 0.8 },
      activity: { taskSwitching: "high" },
    };

    const state = buildUserState(snapshot);
    const json = JSON.stringify(state);
    const parsed = JSON.parse(json);

    expect(parsed.emotionalState).toBe("anxious");
    expect(parsed.cognitiveLoad).toBe("high");
    expect(parsed._dimensions).toBeDefined();
  });

  it("should set timestamp to ISO format", () => {
    const state = buildUserState({});
    expect(state.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should collect unique sources across all dimensions", () => {
    const snapshot = {
      emotion: { label: "anxious", confidence: 0.8 },
      activity: { taskSwitching: "high", engagement: "low" },
      task: { urgency: "high", complexity: "complex" },
      biometrics: { heartRateVariabilityMs: 30 },
    };

    const state = buildUserState(snapshot);
    expect(state.sources.length).toBeGreaterThan(0);
    // Sources should be unique
    expect(new Set(state.sources).size).toBe(state.sources.length);
  });
});
