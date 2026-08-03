import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  reflect,
  generateEffectivenessSignals,
  reflectUserHistory,
  toStrategyEffectiveness,
  recordOutcome,
  analyzePatterns,
  reflectOnSession,
} from "../reflectionEngine.js";
import {
  InterventionStatus,
  ModuleCategory,
  validateEffectivenessSignal,
} from "@/support/schemas/supportSchemas";
import {
  configureAdaptiveFlags,
  resetAdaptiveFlags,
} from "@backend/adaptive/engine/featureFlags";
import {
  clearUserRole4Data,
  listInterventionOutcomes,
  saveInterventionOutcome,
} from "@/support/persistence/role4Store";

const USER = "phase5-user-a";
const OTHER_USER = "phase5-user-b";
const NOW = 1780000000000;

function outcome(overrides = {}) {
  return {
    id: "outcome-1",
    userId: USER,
    interventionId: "int-1",
    moduleId: "focus",
    interventionType: "focus_session",
    status: InterventionStatus.COMPLETED,
    completed: true,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function persistedOutcome(overrides = {}) {
  return outcome({
    id: "outcome-persist-1",
    category: ModuleCategory.EXECUTIVE,
    ...overrides,
  });
}

describe("generateEffectivenessSignals — contract and determinism", () => {
  it("every signal carries the observational/correlational provenance", () => {
    const signals = generateEffectivenessSignals({
      outcomes: [
        outcome({ rating: 5 }),
        outcome({ id: "o2", rating: 4 }),
        outcome({ id: "o3", rating: 3 }),
        outcome({ id: "o4", rating: 2 }),
        outcome({ id: "o5", rating: 1 }),
      ],
    });
    expect(signals).toHaveLength(1);
    for (const signal of signals) {
      expect(signal.source).toBe("observational_outcomes");
      expect(signal.correlational).toBe(true);
      expect(() => validateEffectivenessSignal(signal)).not.toThrow();
    }
  });

  it("identical evidence produces identical grouping, counts, scores and confidence when now is pinned", () => {
    const evidence = [
      outcome({ rating: 5 }),
      outcome({ id: "o2", rating: 5 }),
      outcome({ id: "o3", rating: 4 }),
      outcome({ id: "o4", rating: 2 }),
      outcome({ id: "o5", rating: 2 }),
    ];
    const first = generateEffectivenessSignals({ outcomes: evidence }, { now: NOW });
    const second = generateEffectivenessSignals({ outcomes: evidence }, { now: NOW });
    expect(second).toEqual(first);
  });

  it("only generatedAt varies between runs with identical evidence", () => {
    const evidence = [outcome({ rating: 5 }), outcome({ id: "o2", rating: 5 })];
    const first = generateEffectivenessSignals({ outcomes: evidence }, { now: NOW });
    const second = generateEffectivenessSignals({ outcomes: evidence }, { now: NOW + 1 });
    const { generatedAt: _a, ...restA } = first[0];
    const { generatedAt: _b, ...restB } = second[0];
    expect(restB).toEqual(restA);
    expect(second[0].generatedAt).toBe(NOW + 1);
  });

  it("never fabricates an effectiveness score with insufficient evidence", () => {
    const signals = generateEffectivenessSignals({
      outcomes: [outcome({ rating: 5 }), outcome({ id: "o2", rating: 1 })],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].sampleSize).toBe(2);
    expect(signals[0].effectivenessScore).toBeUndefined();
  });

  it("scores only when evidence is sufficient and reports positive/total", () => {
    const signals = generateEffectivenessSignals({
      outcomes: [
        outcome({ rating: 5 }),
        outcome({ id: "o2", rating: 5 }),
        outcome({ id: "o3", rating: 4 }),
        outcome({ id: "o4", rating: 2 }),
        outcome({ id: "o5", rating: 2 }),
      ],
    });
    expect(signals[0].sampleSize).toBe(5);
    expect(signals[0].positiveOutcomes).toBe(3);
    expect(signals[0].negativeOutcomes).toBe(2);
    expect(signals[0].effectivenessScore).toBe(0.6);
  });

  it("never reports 0% or 100% certainty: confidence is capped", () => {
    const many = Array.from({ length: 12 }, (_, i) => outcome({ id: `o${i}`, rating: 5 }));
    const signals = generateEffectivenessSignals({ outcomes: many });
    expect(signals[0].effectivenessScore).toBe(1);
    expect(signals[0].confidence).toBeLessThanOrEqual(0.95);
  });

  it("computes the documented confidence formula (n=5, all positive → 0.5)", () => {
    const signals = generateEffectivenessSignals({
      outcomes: Array.from({ length: 5 }, (_, i) => outcome({ id: `o${i}`, rating: 5 })),
    });
    expect(signals[0].confidence).toBe(0.5);
  });

  it("neutral evidence contributes evidence but zero confidence and no score", () => {
    const signals = generateEffectivenessSignals({
      outcomes: [
        outcome({ status: InterventionStatus.PARTIALLY_COMPLETED, rating: 3, completed: undefined }),
        outcome({ id: "o2", status: InterventionStatus.PARTIALLY_COMPLETED, completed: undefined }),
      ],
    });
    expect(signals[0].evidenceCount).toBe(2);
    expect(signals[0].sampleSize).toBe(0);
    expect(signals[0].confidence).toBe(0);
    expect(signals[0].effectivenessScore).toBeUndefined();
  });

  it("groups by moduleId + interventionType deterministically", () => {
    const signals = generateEffectivenessSignals({
      outcomes: [
        outcome({ rating: 5 }),
        outcome({ id: "o2", interventionType: "body_scan", rating: 5 }),
        outcome({ id: "o3", rating: 4 }),
        outcome({ id: "o4", moduleId: "support", rating: 4 }),
      ],
    });
    expect(signals.map((s) => s.strategyId).sort()).toEqual([
      "focus:body_scan",
      "focus:focus_session",
      "support:focus_session",
    ]);
  });
});

describe("generateEffectivenessSignals — scoping filters", () => {
  it("excludes other users' outcomes when a userId is provided", () => {
    const signals = generateEffectivenessSignals({
      userId: USER,
      outcomes: [
        outcome({ rating: 5 }),
        outcome({ id: "o2", userId: OTHER_USER, rating: 5 }),
        outcome({ id: "o3", rating: 5 }),
      ],
    });
    expect(signals[0].evidenceCount).toBe(2);
    expect(signals[0].userId).toBe(USER);
  });

  it("filters by moduleId", () => {
    const signals = generateEffectivenessSignals({
      moduleId: "focus",
      outcomes: [
        outcome({ rating: 5 }),
        outcome({ id: "o2", moduleId: "support", rating: 5 }),
      ],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].moduleId).toBe("focus");
  });

  it("filters by timeWindow (start/end) over createdAt", () => {
    const signals = generateEffectivenessSignals({
      timeWindow: {
        start: "2026-07-10T00:00:00.000Z",
        end: "2026-07-20T00:00:00.000Z",
      },
      outcomes: [
        outcome({ id: "o1", createdAt: "2026-07-01T00:00:00.000Z", rating: 5 }),
        outcome({ id: "o2", createdAt: "2026-07-15T00:00:00.000Z", rating: 5 }),
        outcome({ id: "o3", createdAt: "2026-07-25T00:00:00.000Z", rating: 5 }),
      ],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].evidenceCount).toBe(1);
  });

  it("skips outcomes missing strategy identity fields", () => {
    const signals = generateEffectivenessSignals({
      outcomes: [
        outcome({ rating: 5 }),
        outcome({ id: "o2", moduleId: "   ", rating: 5 }),
        outcome({ id: "o3", interventionType: "", rating: 5 }),
        "not-an-outcome",
        null,
      ],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].evidenceCount).toBe(1);
  });
});

describe("generateEffectivenessSignals — no evidence fabrication", () => {
  it("does not blend a passed strategyEffectiveness map into outcome-derived scores", () => {
    const signals = generateEffectivenessSignals({
      outcomes: [
        outcome({ rating: 5 }),
        outcome({ id: "o2", rating: 5 }),
        outcome({ id: "o3", rating: 5 }),
        outcome({ id: "o4", rating: 2 }),
        outcome({ id: "o5", rating: 2 }),
      ],
      strategyEffectiveness: { "focus:focus_session": 0.99 },
    });
    expect(signals[0].effectivenessScore).toBe(0.6);
    expect(signals[0].positiveOutcomes).toBe(3);
    expect(signals[0].negativeOutcomes).toBe(2);
  });

  it("does not infer effectiveness from interventions alone (outcomes are the only scored evidence)", () => {
    const signals = generateEffectivenessSignals({
      interventions: [{ moduleId: "focus", interventionType: "focus_session", status: InterventionStatus.COMPLETED }],
    });
    expect(signals).toEqual([]);
  });
});

describe("classification precedence", () => {
  it("rating wins over completed flag and status", () => {
    const signals = generateEffectivenessSignals({
      outcomes: [outcome({ rating: 5, completed: false, status: InterventionStatus.FAILED })],
    });
    expect(signals[0].positiveOutcomes).toBe(1);
    expect(signals[0].negativeOutcomes).toBe(0);
  });

  it("completed flag wins over status", () => {
    const signals = generateEffectivenessSignals({
      outcomes: [outcome({ completed: false, status: InterventionStatus.COMPLETED })],
    });
    expect(signals[0].negativeOutcomes).toBe(1);
  });

  it("negative lifecycle statuses are explicit negative signals", () => {
    for (const status of [
      InterventionStatus.ABANDONED,
      InterventionStatus.FAILED,
      InterventionStatus.CANCELLED,
      InterventionStatus.BLOCKED,
      InterventionStatus.DISMISSED,
    ]) {
      const signals = generateEffectivenessSignals({
        outcomes: [outcome({ status, completed: undefined })],
      });
      expect(signals[0].negativeOutcomes).toBe(1);
      expect(signals[0].positiveOutcomes).toBe(0);
    }
  });
});

describe("reflect and toStrategyEffectiveness", () => {
  it("reflect returns signals plus a descriptive, correlational summary", () => {
    const result = reflect(
      {
        outcomes: [outcome({ rating: 5 }), outcome({ id: "o2", rating: 5 })],
      },
      { now: NOW },
    );
    expect(result.signals).toHaveLength(1);
    expect(result.summary).toEqual({
      strategyCount: 1,
      evidenceCount: 2,
      correlational: true,
      generatedAt: NOW,
    });
  });

  it("toStrategyEffectiveness keeps only strategies with a computed score", () => {
    const result = reflect(
      {
        outcomes: [
          outcome({ rating: 5 }),
          outcome({ id: "o2", rating: 5 }),
          outcome({ id: "o3", rating: 5 }),
          outcome({ id: "o4", rating: 5 }),
          outcome({ id: "o5", rating: 1 }),
        ],
      },
      { now: NOW },
    );
    const map = toStrategyEffectiveness(result.signals);
    expect(map).toEqual({ "focus:focus_session": 0.8 });
  });
});

describe("reflectUserHistory — explicit, flag-gated Role 4 reader", () => {
  beforeEach(() => {
    localStorage.clear();
    clearUserRole4Data(USER);
    clearUserRole4Data(OTHER_USER);
  });

  afterEach(() => {
    resetAdaptiveFlags();
  });

  it("returns no signals and a disabled summary while the reflection flag is OFF", () => {
    const result = reflectUserHistory(USER, { now: NOW });
    expect(result.signals).toEqual([]);
    expect(result.summary.disabled).toBe(true);
  });

  it("reads Role 4 history and reflects only when the flag is ON", () => {
    configureAdaptiveFlags({ reflection: true });
    for (let i = 0; i < 5; i += 1) {
      seedOutcome(i);
    }
    const result = reflectUserHistory(USER, { now: NOW });
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].strategyId).toBe("focus:focus_session");
    expect(result.signals[0].effectivenessScore).toBe(1);
    expect(result.signals[0].source).toBe("observational_outcomes");
  });

  it("returns empty signals for a missing userId", () => {
    configureAdaptiveFlags({ reflection: true });
    expect(reflectUserHistory("", { now: NOW }).signals).toEqual([]);
    expect(reflectUserHistory().signals).toEqual([]);
  });
});

describe("recordOutcome — Role 4 persistence via the existing API", () => {
  beforeEach(() => {
    localStorage.clear();
    clearUserRole4Data(USER);
  });

  it("persists a user-scoped outcome through saveInterventionOutcome", () => {
    const saved = recordOutcome(persistedOutcome());
    expect(saved).not.toBeNull();
    expect(saved.id).toBe("outcome-persist-1");
    expect(listInterventionOutcomes(USER).map((r) => r.id)).toContain("outcome-persist-1");
  });

  it("refuses outcomes without a user scope and persists nothing", () => {
    expect(recordOutcome({ id: "no-user", moduleId: "focus" })).toBeNull();
    expect(listInterventionOutcomes(USER)).toEqual([]);
    expect(recordOutcome(null)).toBeNull();
  });
});

describe("analyzePatterns and reflectOnSession — descriptive only", () => {
  it("analyzePatterns reports effective and ineffective patterns with correlational caveats", () => {
    const fivePositive = Array.from({ length: 5 }, (_, i) => outcome({ id: `p${i}`, rating: 5 }));
    const fiveNegative = Array.from({ length: 5 }, (_, i) =>
      outcome({ id: `n${i}`, rating: 1, interventionType: "body_scan" }),
    );
    const result = analyzePatterns([...fivePositive, ...fiveNegative]);
    expect(result.effectivePatterns).toHaveLength(1);
    expect(result.effectivePatterns[0].correlational).toBe(true);
    expect(result.ineffectivePatterns).toHaveLength(1);
    expect(result.ineffectivePatterns[0].correlational).toBe(true);
    expect(result.recommendations).toHaveLength(2);
    for (const recommendation of result.recommendations) {
      expect(recommendation).toMatch(/Observational:/);
    }
  });

  it("reflectOnSession returns a no-op summary when nothing is evaluable", () => {
    const result = reflectOnSession([outcome({ rating: 3 })]);
    expect(result.keyInsights).toEqual([]);
    expect(result.followUpSuggestions).toEqual([]);
    expect(result.summary).toMatch(/observational/i);
  });
});

// Local helper kept at the bottom so the fixtures above read as data.
function seedOutcome(index) {
  saveInterventionOutcome(
    USER,
    persistedOutcome({
      id: `seeded-${index}`,
      rating: 5,
      createdAt: new Date(NOW - 1000 * 60 * (10 - index)).toISOString(),
    }),
  );
}
