import { beforeEach, describe, expect, it } from "vitest";
import {
  ConfidenceLevel,
  InterventionStatus,
  MemoryType,
  ModuleCategory,
  OutcomeSource,
  PrivacyLevel,
  validateIntervention,
  validateInterventionOutcome,
  validatePersonalizationProfile,
  validateReflection,
  validateUserMemory,
} from "@/support/schemas/supportSchemas";
import {
  ROLE4_COLLECTIONS,
  getRole4StorageKey,
  LEGACY_MEMORY_KEYS,
} from "@/support/schemas/storageKeys";
import {
  clearUserRole4Data,
  listInterventionOutcomes,
  listRole4Records,
  listUserMemories,
  saveIntervention,
  saveInterventionOutcome,
  savePersonalizationProfile,
  saveReflection,
  saveUserMemory,
} from "@/support/persistence/role4Store";
import {
  getUserStrategyEffectiveness,
  migrateLegacyMemory,
  recordUserStrategyOutcome,
} from "@/adaptive/memory/memorySystem";

const USER_A = "role4-user-a";
const USER_B = "role4-user-b";

function baseIntervention(overrides = {}) {
  return {
    id: "int-1",
    userId: USER_A,
    moduleId: "ocd.erp-tracker",
    interventionType: "erp_exposure",
    category: ModuleCategory.SPECIALIZED,
    title: "ERP exposure practice",
    ...overrides,
  };
}

function baseOutcome(overrides = {}) {
  return {
    id: "outcome-1",
    userId: USER_A,
    interventionId: "int-1",
    moduleId: "ocd.erp-tracker",
    interventionType: "erp_exposure",
    category: ModuleCategory.SPECIALIZED,
    status: InterventionStatus.COMPLETED,
    completed: true,
    durationMs: 600000,
    metrics: { preSuds: 72, postSuds: 34 },
    ...overrides,
  };
}

describe("Role 4 shared schemas", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("validates canonical intervention, outcome, reflection, memory, and personalization records", () => {
    const intervention = validateIntervention(baseIntervention());
    expect(intervention.schemaVersion).toBe(1);
    expect(intervention.privacy).toBe(PrivacyLevel.PRIVATE);
    expect(intervention.status).toBe(InterventionStatus.RECOMMENDED);

    const outcome = validateInterventionOutcome(baseOutcome());
    expect(outcome.source).toBe(OutcomeSource.MODULE_EVENT);
    expect(outcome.metrics.preSuds).toBe(72);

    const reflection = validateReflection({
      id: "reflection-1",
      userId: USER_A,
      interventionId: "int-1",
      summary: "ERP completion improved across this session.",
      keyInsights: ["SUDS dropped after staying with the exposure."],
      evidenceOutcomeIds: ["outcome-1"],
    });
    expect(reflection.confidence).toBe(ConfidenceLevel.LOW);

    const memory = validateUserMemory({
      id: "memory-1",
      userId: USER_A,
      type: MemoryType.SUCCESSFUL_STRATEGY,
      key: "erp_exposure",
      value: { durationMinutes: 10 },
      evidenceIds: ["outcome-1"],
    });
    expect(memory.privacy).toBe(PrivacyLevel.PRIVATE);

    const profile = validatePersonalizationProfile({
      id: "profile-1",
      userId: USER_A,
      effectiveStrategies: { erp_exposure: 0.8 },
      preferredInterventions: ["erp_exposure"],
    });
    expect(profile.profileVersion).toBe(1);
    expect(profile.effectiveStrategies.erp_exposure).toBe(0.8);
  });

  it("rejects missing user IDs, invalid statuses, invalid privacy levels, and bad timestamps", () => {
    expect(() => validateIntervention(baseIntervention({ userId: "" }))).toThrow();
    expect(() => validateInterventionOutcome(baseOutcome({ status: "finished" }))).toThrow();
    expect(() => validateUserMemory({
      id: "memory-1",
      userId: USER_A,
      type: MemoryType.PREFERENCE,
      key: "pace",
      value: "slow",
      privacy: "friends",
    })).toThrow();
    expect(() => validateReflection({
      id: "reflection-1",
      userId: USER_A,
      summary: "A valid summary",
      createdAt: "not-a-date",
    })).toThrow();
  });
});

describe("Role 4 local persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists records by user and collection", () => {
    const intervention = saveIntervention(USER_A, baseIntervention());
    const outcome = saveInterventionOutcome(USER_A, baseOutcome());
    const reflection = saveReflection(USER_A, {
      id: "reflection-1",
      userId: USER_A,
      summary: "The user completed the exposure and reported less distress.",
      evidenceOutcomeIds: [outcome.id],
    });
    const memory = saveUserMemory(USER_A, {
      id: "memory-1",
      userId: USER_A,
      type: MemoryType.SUCCESSFUL_STRATEGY,
      key: "erp_exposure",
      value: { source: outcome.id },
    });
    const profile = savePersonalizationProfile(USER_A, {
      id: "profile-1",
      userId: USER_A,
      updatedFromMemoryIds: [memory.id],
      preferredInterventions: ["erp_exposure"],
    });

    expect(intervention.id).toBe("int-1");
    expect(listInterventionOutcomes(USER_A)).toHaveLength(1);
    expect(listRole4Records(USER_A, ROLE4_COLLECTIONS.REFLECTIONS)[0].id).toBe(reflection.id);
    expect(listUserMemories(USER_A)[0].id).toBe(memory.id);
    expect(listRole4Records(USER_A, ROLE4_COLLECTIONS.PERSONALIZATION_PROFILES)[0].id).toBe(profile.id);
  });

  it("isolates records between users", () => {
    saveInterventionOutcome(USER_A, baseOutcome({ id: "a-outcome", userId: USER_A }));
    saveInterventionOutcome(USER_B, baseOutcome({ id: "b-outcome", userId: USER_B }));

    expect(listInterventionOutcomes(USER_A).map((item) => item.id)).toEqual(["a-outcome"]);
    expect(listInterventionOutcomes(USER_B).map((item) => item.id)).toEqual(["b-outcome"]);
  });

  it("rejects attempts to save a record under the wrong user", () => {
    expect(() => saveInterventionOutcome(USER_A, baseOutcome({ userId: USER_B }))).toThrow(
      /does not match storage userId/,
    );
  });

  it("filters invalid persisted records instead of returning corrupted data", () => {
    const key = getRole4StorageKey(USER_A, ROLE4_COLLECTIONS.OUTCOMES);
    localStorage.setItem(
      key,
      JSON.stringify([
        baseOutcome({ id: "valid-outcome" }),
        { id: "invalid-outcome", status: "finished" },
      ]),
    );

    expect(listInterventionOutcomes(USER_A).map((item) => item.id)).toEqual(["valid-outcome"]);
  });

  it("clears only the requested user's Role 4 data", () => {
    saveInterventionOutcome(USER_A, baseOutcome({ id: "a-outcome", userId: USER_A }));
    saveInterventionOutcome(USER_B, baseOutcome({ id: "b-outcome", userId: USER_B }));

    clearUserRole4Data(USER_A);

    expect(listInterventionOutcomes(USER_A)).toEqual([]);
    expect(listInterventionOutcomes(USER_B).map((item) => item.id)).toEqual(["b-outcome"]);
  });
});

describe("Role 4 memory compatibility and migration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("records user-scoped strategy effectiveness without leaking across users", () => {
    recordUserStrategyOutcome(USER_A, "grounding", true, { moduleId: "anxiety" });
    recordUserStrategyOutcome(USER_A, "grounding", false, { moduleId: "anxiety" });
    recordUserStrategyOutcome(USER_B, "grounding", true, { moduleId: "anxiety" });

    expect(getUserStrategyEffectiveness(USER_A, "grounding")).toEqual({
      effective: 1,
      total: 2,
      rate: 0.5,
    });
    expect(getUserStrategyEffectiveness(USER_B, "grounding")).toEqual({
      effective: 1,
      total: 1,
      rate: 1,
    });
  });

  it("migrates legacy global memory into user-scoped canonical records once", () => {
    localStorage.setItem(
      LEGACY_MEMORY_KEYS.PREFERENCES,
      JSON.stringify({ readingPace: { value: "slow", updatedAt: "2026-07-26T10:00:00.000Z" } }),
    );
    localStorage.setItem(
      LEGACY_MEMORY_KEYS.STRATEGIES,
      JSON.stringify([
        {
          interventionType: "erp_exposure",
          successful: true,
          context: { durationMinutes: 10 },
          timestamp: "2026-07-26T11:00:00.000Z",
        },
      ]),
    );

    const first = migrateLegacyMemory(USER_A);
    const second = migrateLegacyMemory(USER_A);
    const memories = listUserMemories(USER_A);

    expect(first.legacyMemory).toEqual({ migrated: true, recordsCreated: 2 });
    expect(second.legacyMemory).toEqual({ migrated: false, recordsCreated: 0 });
    expect(memories).toHaveLength(2);
    expect(memories.map((memory) => memory.userId)).toEqual([USER_A, USER_A]);
    expect(memories.every((memory) => memory.source === OutcomeSource.IMPORTED_LEGACY)).toBe(true);
  });
});

