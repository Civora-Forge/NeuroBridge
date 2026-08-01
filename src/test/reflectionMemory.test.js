import { beforeEach, describe, expect, it } from "vitest";
import { saveReflection } from "@/support/persistence/role4Store";
import { getRole4StorageKey, ROLE4_COLLECTIONS } from "@/support/schemas/storageKeys";
import {
  clearModuleMemories,
  deleteMemory,
  deriveMemoryFromReflections,
  getMemoryById,
  isLearningEnabled,
  listUserMemories,
  setLearningEnabled,
} from "@/support/memory";

const USER_ID = "memory-user";
const MODULE_ID = "support.task_breakdown";

function reflection(index, overrides = {}) {
  const timestamp = `2026-01-${String(index).padStart(2, "0")}T10:00:00.000Z`;
  return saveReflection(USER_ID, {
    id: `reflection-${index}`,
    reflectionId: `reflection-${index}`,
    interventionId: `intervention-${index}`,
    moduleId: MODULE_ID,
    userId: USER_ID,
    timestamp,
    version: 1,
    reflectionVersion: 1,
    outcomeSummary: { completionStatus: "completed", completionRate: 1, durationMs: 120000, rating: 5 },
    insights: [{ type: "task_breakdown_timer", value: true, confidence: 1 }],
    confidence: 0.9,
    metadata: { configuration: { selectedStyle: "Standard", requestedStepCount: 3 } },
    schemaVersion: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    summary: "support.task_breakdown:completed",
    keyInsights: [],
    followUpSuggestions: [],
    ...overrides,
  });
}

describe("reflection-derived Role 4 memory", () => {
  beforeEach(() => localStorage.clear());

  it("requires two consistent reflections before creating durable memory", () => {
    reflection(1);
    expect(deriveMemoryFromReflections(USER_ID, MODULE_ID).created).toEqual([]);

    reflection(2);
    const result = deriveMemoryFromReflections(USER_ID, MODULE_ID);
    const style = result.created.find((memory) => memory.key === "selected_style");

    expect(style).toMatchObject({ evidenceCount: 2, confidence: 0.4, category: "preferred_configuration" });
    expect(style.value).toEqual({ observedAssociation: "Standard" });
  });

  it("updates the same memory with stronger repeated evidence and remains idempotent", () => {
    reflection(1);
    reflection(2);
    deriveMemoryFromReflections(USER_ID, MODULE_ID);
    reflection(3);
    const updated = deriveMemoryFromReflections(USER_ID, MODULE_ID);
    const style = updated.updated.find((memory) => memory.key === "selected_style");

    expect(style).toMatchObject({ evidenceCount: 3, confidence: 0.65, confidenceLevel: "moderate" });
    expect(deriveMemoryFromReflections(USER_ID, MODULE_ID).unchanged).toHaveLength(5);
    expect(listUserMemories(USER_ID, { moduleId: MODULE_ID })).toHaveLength(5);
  });

  it("reaches high confidence after five consistent reflections", () => {
    [1, 2, 3, 4, 5].forEach(reflection);

    const style = deriveMemoryFromReflections(USER_ID, MODULE_ID).created.find(
      (memory) => memory.key === "selected_style",
    );

    expect(style).toMatchObject({ evidenceCount: 5, confidence: 0.85, confidenceLevel: "high" });
  });

  it("reduces confidence when observations conflict rather than silently choosing the latest", () => {
    reflection(1);
    reflection(2);
    reflection(3, { metadata: { configuration: { selectedStyle: "Hero Mode", requestedStepCount: 3 } } });

    const result = deriveMemoryFromReflections(USER_ID, MODULE_ID);
    const style = result.created.find((memory) => memory.key === "selected_style");

    expect(style).toMatchObject({ evidenceCount: 2, contradictionCount: 1, confidence: 0.3 });
    expect(style.value).toEqual({ observedAssociation: "Standard" });
  });

  it("derives aggregate-only Task Breakdown completion, timer, and high-step abandonment patterns", () => {
    reflection(1, {
      outcomeSummary: { completionStatus: "abandoned", completionRate: 0.2, durationMs: 60000 },
      insights: [{ type: "task_breakdown_timer", value: true, confidence: 1 }],
      metadata: { configuration: { requestedStepCount: 7 }, rawTask: "Never copy this" },
    });
    reflection(2, {
      outcomeSummary: { completionStatus: "abandoned", completionRate: 0.2, durationMs: 60000 },
      insights: [{ type: "task_breakdown_timer", value: true, confidence: 1 }],
      metadata: { configuration: { requestedStepCount: 7 }, rawTask: "Never copy this" },
    });

    const result = deriveMemoryFromReflections(USER_ID, MODULE_ID);
    expect(result.created).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "completion_rate_band", value: { observedAssociation: "low" } }),
      expect.objectContaining({ key: "high_step_count_outcome", value: { observedAssociation: "abandoned" } }),
    ]));
    expect(JSON.stringify(result)).not.toContain("Never copy this");
  });

  it("ignores unsupported reflection versions", () => {
    const key = getRole4StorageKey(USER_ID, ROLE4_COLLECTIONS.REFLECTIONS);
    localStorage.setItem(key, JSON.stringify([{
      id: "unsupported", userId: USER_ID, moduleId: MODULE_ID, interventionId: "x", summary: "unsupported",
      version: 2, reflectionVersion: 2, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    }]));

    expect(deriveMemoryFromReflections(USER_ID, MODULE_ID).created).toEqual([]);
  });

  it("enforces user-scoped reads, tombstone deletion, and module clearing", () => {
    reflection(1);
    reflection(2);
    const created = deriveMemoryFromReflections(USER_ID, MODULE_ID).created;
    const memory = created[0];

    expect(getMemoryById("another-user", memory.id)).toBeNull();
    expect(deleteMemory("another-user", memory.id)).toBe(false);
    expect(deleteMemory(USER_ID, memory.id)).toBe(true);
    expect(getMemoryById(USER_ID, memory.id).status).toBe("deleted");
    expect(deriveMemoryFromReflections(USER_ID, MODULE_ID).created).toEqual([]);
    expect(getMemoryById(USER_ID, memory.id).status).toBe("deleted");
    expect(clearModuleMemories(USER_ID, MODULE_ID)).toBeGreaterThan(0);
    expect(listUserMemories(USER_ID, { moduleId: MODULE_ID })).toEqual([]);
  });

  it("pauses derivation while learning is disabled and resumes when enabled", () => {
    reflection(1);
    reflection(2);
    expect(isLearningEnabled(USER_ID)).toBe(true);
    setLearningEnabled(USER_ID, false);
    expect(deriveMemoryFromReflections(USER_ID, MODULE_ID).skipped).toBe("learning_disabled");
    expect(listUserMemories(USER_ID)).toEqual([]);

    setLearningEnabled(USER_ID, true);
    expect(deriveMemoryFromReflections(USER_ID, MODULE_ID).created.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(listUserMemories(USER_ID)))).toEqual(listUserMemories(USER_ID));
  });
});
