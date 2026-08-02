import { beforeEach, describe, expect, it } from "vitest";
import { saveIntervention, saveInterventionLifecycleEvent, saveReflection, saveUserMemory } from "@/support/persistence/role4Store";
import { getSupportEvidence } from "@/support/evidence";
import { setLearningEnabled } from "@/support/memory";
import { validateSupportEvidenceResponse } from "@/support/schemas/supportSchemas";

const USER_ID = "evidence-user";
const MODULE_ID = "support.task_breakdown";

function record(index, status = "completed", rating = 5) {
  const date = `2026-02-${String(index).padStart(2, "0")}T00:00:00.000Z`;
  const interventionId = `intervention-${index}`;
  saveIntervention(USER_ID, { id: interventionId, userId: USER_ID, moduleId: MODULE_ID, interventionType: "task_breakdown", category: "executive", status: "started", title: "Task Breakdown", tags: [], createdAt: date, updatedAt: date });
  saveInterventionLifecycleEvent(USER_ID, { id: `event-${index}`, userId: USER_ID, interventionId, moduleId: MODULE_ID, interventionType: "task_breakdown", fromStatus: "shown", toStatus: "started", createdAt: date, updatedAt: date });
  saveReflection(USER_ID, { id: `reflection-${index}`, userId: USER_ID, interventionId, moduleId: MODULE_ID, reflectionId: `reflection-${index}`, timestamp: date, version: 1, reflectionVersion: 1, outcomeSummary: { completionStatus: status, completionRate: status === "completed" ? 1 : status === "partially_completed" ? 0.5 : 0.1, ...(rating ? { rating } : {}) }, insights: [{ type: "intervention_quality", value: status === "completed" && rating >= 4 ? "strong" : "limited", confidence: 1 }], confidence: 0.8, metadata: {}, summary: "safe", createdAt: date, updatedAt: date });
}

describe("support evidence API", () => {
  beforeEach(() => localStorage.clear());
  it("returns neutral ordered evidence and structured invalid entries", () => {
    const response = getSupportEvidence(USER_ID, ["support.grounding", MODULE_ID, MODULE_ID, "adhd.task-breakdown", "unknown"]);
    expect(response.modules.map((entry) => entry.moduleId)).toEqual(["support.grounding", MODULE_ID, "adhd.task-breakdown", "unknown"]);
    expect(response.modules[0]).toMatchObject({ evidenceCount: 0, completionRate: null, effectivenessRate: null });
    expect(response.modules[2].reasonCodes).toContain("invalid_module_id");
  });
  it("computes completion, effectiveness, rating, evidence count, and trend from reflections", () => {
    record(1, "completed", 5); record(2, "partially_completed", 3); record(3, "abandoned", null);
    const entry = getSupportEvidence(USER_ID, [MODULE_ID]).modules[0];
    expect(entry).toMatchObject({ evidenceCount: 3, startedCount: 3, completedCount: 1, partiallyCompletedCount: 1, abandonedCount: 1, completionRate: 0.5, effectivenessRate: 0.5, averageUserRating: 4, recentOutcomeTrend: "declining" });
  });
  it("uses only usable hints and active sanitized negative memories", () => {
    record(1); record(2);
    saveUserMemory(USER_ID, { id: "negative", userId: USER_ID, moduleId: MODULE_ID, type: "ineffective_strategy", category: "unsuccessful_configuration", key: "high_step_count_outcome", value: { observedAssociation: "abandoned", rawTask: "private" }, evidenceCount: 2, supportingReflectionIds: ["reflection-1", "reflection-2"], confidence: 0.65, status: "active", createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" });
    const entry = getSupportEvidence(USER_ID, [MODULE_ID]).modules[0];
    expect(entry.unsuccessfulConfigurations[0]).toMatchObject({ key: "high_step_count_outcome", value: "abandoned" });
    expect(JSON.stringify(entry)).not.toContain("private");
    setLearningEnabled(USER_ID, false);
    const disabled = getSupportEvidence(USER_ID, [MODULE_ID]).modules[0];
    expect(disabled.personalizationHints).toEqual([]);
    expect(disabled.unsuccessfulConfigurations).toEqual([]);
    expect(disabled.evidenceCount).toBe(2);
  });
  it("is user-scoped, serializable, deterministic, and schema-valid", () => {
    record(1);
    const first = getSupportEvidence(USER_ID, [MODULE_ID]);
    expect(getSupportEvidence("other-user", [MODULE_ID]).modules[0].evidenceCount).toBe(0);
    expect(first).toEqual(getSupportEvidence(USER_ID, [MODULE_ID]));
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(validateSupportEvidenceResponse(first)).toEqual(first);
    expect(getSupportEvidence(null, [MODULE_ID]).reasonCodes).toContain("missing_authenticated_user");
  });
});
