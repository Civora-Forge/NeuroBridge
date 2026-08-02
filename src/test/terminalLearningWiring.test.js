import { beforeEach, describe, expect, it } from "vitest";
import { completeSupportModule, executeSupportModule } from "@/support/execution";
import { listReflections } from "@/support/persistence/role4Store";
import { listUserMemories, setLearningEnabled } from "@/support/memory";
import { getPersonalizationHints } from "@/support/personalization";
import { getSupportEvidence } from "@/support/evidence";

const userId = "terminal-learning-user";
const moduleId = "support.focus_session";

async function complete(index, extraMetrics = {}) {
  const started = await executeSupportModule({ userId, moduleId, contextSnapshotId: null, triggerSource: "manual", selectionMode: "explicit_request", configuration: { plannedDurationMinutes: 15, breakDurationMinutes: 5 }, metadata: { idempotencyKey: `terminal-${index}` } });
  return completeSupportModule({ userId, moduleId, interventionId: started.interventionId, outcome: { completionStatus: "completed", durationMs: 900000, metrics: { completionRatio: 1, plannedDurationMinutes: 15, actualDurationMs: 900000, completedNaturally: true, pauseCount: 0, ...extraMetrics }, finalConfiguration: { plannedDurationMinutes: 15 } } });
}

describe("terminal learning wiring", () => {
  beforeEach(() => localStorage.clear());

  it("automatically reflects terminal outcomes and derives memory only after the evidence threshold", async () => {
    const first = await complete(1, { privateNote: "do not retain" });
    expect(first.ok).toBe(true);
    expect(first.learning.reflection).toBeTruthy();
    expect(listReflections(userId)).toHaveLength(1);
    expect(listUserMemories(userId, { moduleId })).toEqual([]);
    await complete(2);
    expect(listUserMemories(userId, { moduleId })).not.toEqual([]);
    expect(getPersonalizationHints(userId, moduleId).hints).not.toEqual([]);
    expect(getSupportEvidence(userId, [moduleId]).modules[0].evidenceCount).toBe(2);
    expect(JSON.stringify(listReflections(userId))).not.toContain("do not retain");
  });

  it("skips learning when disabled without affecting terminal persistence", async () => {
    setLearningEnabled(userId, false);
    const terminal = await complete(1);
    expect(terminal.ok).toBe(true);
    expect(terminal.learning).toMatchObject({ skipped: "learning_disabled" });
    expect(listReflections(userId)).toEqual([]);
    expect(listUserMemories(userId, { moduleId })).toEqual([]);
  });

  it("does not duplicate reflections when a terminal command is repeated", async () => {
    const terminal = await complete(1);
    const repeated = await completeSupportModule({ userId, moduleId, interventionId: terminal.interventionId, outcome: { completionStatus: "completed" } });
    expect(repeated.ok).toBe(false);
    expect(listReflections(userId)).toHaveLength(1);
  });
});
