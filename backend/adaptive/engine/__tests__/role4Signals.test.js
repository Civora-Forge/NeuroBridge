import { beforeEach, describe, expect, it } from "vitest";
import { buildRole4Signals } from "../role4Signals.js";
import { decide } from "../adaptiveEngine.js";
import {
  clearUserRole4Data,
  saveIntervention,
  saveInterventionOutcome,
  savePersonalizationProfile,
  saveUserMemory,
} from "@/support/persistence/role4Store";
import {
  InterventionStatus,
  MemoryType,
  ModuleCategory,
} from "@/support/schemas/supportSchemas";

const USER = "phase4-user-a";
const OTHER_USER = "phase4-user-b";

function baseIntervention(overrides = {}) {
  return {
    id: "int-1",
    userId: USER,
    moduleId: "focus",
    interventionType: "focus_session",
    category: ModuleCategory.EXECUTIVE,
    title: "Focus session",
    status: InterventionStatus.IN_PROGRESS,
    ...overrides,
  };
}

function baseOutcome(overrides = {}) {
  return {
    id: "outcome-1",
    userId: USER,
    interventionId: "int-1",
    moduleId: "focus",
    interventionType: "focus_session",
    category: ModuleCategory.EXECUTIVE,
    status: InterventionStatus.COMPLETED,
    completed: true,
    durationMs: 600000,
    ...overrides,
  };
}

function baseMemory(overrides = {}) {
  return {
    id: "mem-1",
    userId: USER,
    type: MemoryType.SUPPORT_BOUNDARY,
    key: "ui.mode",
    value: "no_auto_theme",
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

describe("buildRole4Signals (Role 4 read path)", () => {
  beforeEach(() => {
    localStorage.clear();
    clearUserRole4Data(USER);
    clearUserRole4Data(OTHER_USER);
  });

  it("returns empty signals for a missing / empty / whitespace userId without throwing", () => {
    expect(buildRole4Signals()).toEqual({ interventions: [], outcomes: [], memories: [] });
    expect(buildRole4Signals("")).toEqual({ interventions: [], outcomes: [], memories: [] });
    expect(buildRole4Signals("   ")).toEqual({ interventions: [], outcomes: [], memories: [] });
    expect(buildRole4Signals(123)).toEqual({ interventions: [], outcomes: [], memories: [] });
  });

  it("returns empty arrays when the user has no Role 4 records", () => {
    const signals = buildRole4Signals(USER);
    expect(signals.interventions).toEqual([]);
    expect(signals.outcomes).toEqual([]);
    expect(signals.memories).toEqual([]);
    expect(signals.personalization).toBeUndefined();
  });

  it("reads the user's interventions, outcomes and memories", () => {
    saveIntervention(USER, baseIntervention());
    saveInterventionOutcome(USER, baseOutcome());
    saveUserMemory(USER, baseMemory());

    const signals = buildRole4Signals(USER);
    expect(signals.interventions.map((r) => r.id)).toEqual(["int-1"]);
    expect(signals.outcomes.map((r) => r.id)).toEqual(["outcome-1"]);
    expect(signals.memories.map((r) => r.id)).toEqual(["mem-1"]);
  });

  it("does not leak other users' Role 4 records", () => {
    saveIntervention(OTHER_USER, baseIntervention({ id: "int-other", userId: OTHER_USER }));
    saveUserMemory(OTHER_USER, baseMemory({ id: "mem-other", userId: OTHER_USER }));

    const signals = buildRole4Signals(USER);
    expect(signals.interventions).toEqual([]);
    expect(signals.memories).toEqual([]);
  });

  it("exposes the most recently created personalization profile", () => {
    savePersonalizationProfile(USER, {
      id: "profile-old",
      userId: USER,
      createdAt: "2026-07-01T00:00:00.000Z",
      effectiveStrategies: { pacing: 0.4 },
    });
    savePersonalizationProfile(USER, {
      id: "profile-new",
      userId: USER,
      createdAt: "2026-07-02T00:00:00.000Z",
      effectiveStrategies: { pacing: 0.8 },
    });

    const signals = buildRole4Signals(USER);
    expect(signals.personalization?.id).toBe("profile-new");
    expect(signals.personalization?.effectiveStrategies).toEqual({ pacing: 0.8 });
  });

  it("omits personalization when the user has no profile", () => {
    const signals = buildRole4Signals(USER);
    expect(signals.personalization).toBeUndefined();
  });
});

describe("Role 4 read path → engine integration", () => {
  beforeEach(() => {
    localStorage.clear();
    clearUserRole4Data(USER);
  });

  it("feeds a valid role4Signals fragment into decide() and records it in the trace", () => {
    saveUserMemory(USER, baseMemory());

    const outcome = decide({
      contextSnapshot: overloadSnapshot(),
      role4Signals: buildRole4Signals(USER),
    });

    expect(outcome.plan).toBeDefined();
    expect(outcome.plan.actions.length).toBeGreaterThan(0);
    expect(outcome.trace.sources).toContain("role4_signals");
    expect(outcome.trace.sources).not.toContain("user_preferences");
  });

  it("does not record role4_signals when the fragment is absent", () => {
    const outcome = decide({ contextSnapshot: overloadSnapshot() });
    expect(outcome.trace.sources).not.toContain("role4_signals");
  });
});
