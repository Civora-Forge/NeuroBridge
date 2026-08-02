import { beforeEach, describe, expect, it } from "vitest";
import {
  abandonSupportModule,
  completeSupportModule,
  executeSupportModule,
  rateSupportModule,
} from "@/support/execution";
import { reflectIntervention } from "@/support/reflection";
import { listReflections } from "@/support/persistence/role4Store";
import { getInterventionHistory } from "@/support/lifecycle/interventionLifecycle";

const USER_ID = "reflection-user";

async function start() {
  return executeSupportModule({
    userId: USER_ID,
    moduleId: "support.task_breakdown",
    contextSnapshotId: null,
    triggerSource: "manual",
    selectionMode: "explicit_request",
    configuration: { selectedStyle: "Standard", priority: "Important" },
    metadata: {},
  });
}

function command(interventionId, overrides = {}) {
  return { userId: USER_ID, interventionId, moduleId: "support.task_breakdown", ...overrides };
}

describe("Role 4 reflection engine", () => {
  beforeEach(() => localStorage.clear());

  it("creates a deterministic, versioned reflection for a completed intervention", async () => {
    const started = await start();
    const completed = await completeSupportModule(command(started.interventionId, {
      outcome: {
        durationMs: 600000,
        metrics: { completionRate: 1, stepsCreated: 5, stepsCompleted: 5, timerUsed: true, stepEdits: 3 },
      },
    }));

    const first = reflectIntervention(completed.intervention);
    const second = reflectIntervention(completed.intervention);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      interventionId: started.interventionId,
      moduleId: "support.task_breakdown",
      userId: USER_ID,
      version: 1,
      reflectionVersion: 1,
      outcomeSummary: { completionStatus: "completed", completionRate: 1, durationMs: 600000 },
      confidence: 0.85,
    });
    expect(first.insights).toEqual(expect.arrayContaining([
      { type: "completed_successfully", value: true, confidence: 1 },
      { type: "task_breakdown_completion", value: "high_completion", confidence: 1 },
      { type: "task_breakdown_timer", value: true, confidence: 1 },
      { type: "task_breakdown_edits", value: "many_edits", confidence: 1 },
    ]));
    expect(listReflections(USER_ID)).toHaveLength(1);
  });

  it("reflects partial completion and ratings without inspecting feedback", async () => {
    const started = await start();
    const completed = await completeSupportModule(command(started.interventionId, {
      outcome: {
        completionStatus: "partially_completed",
        durationMs: 120000,
        metrics: { completionRate: 0.4, stepsCreated: 5, stepsCompleted: 2 },
      },
    }));
    const rated = await rateSupportModule(command(started.interventionId, {
      metadata: { storeFeedback: true },
      outcome: { userRating: 2, userFeedback: "Private feedback" },
    }));

    const reflection = reflectIntervention(rated.intervention);

    expect(completed.ok).toBe(true);
    expect(reflection.outcomeSummary).toMatchObject({
      completionStatus: "partially_completed",
      completionRate: 0.4,
      rating: 2,
    });
    expect(reflection.insights).toEqual(expect.arrayContaining([
      { type: "task_breakdown_completion", value: "partial_completion", confidence: 1 },
      { type: "user_satisfaction", value: "low", confidence: 1 },
    ]));
    expect(JSON.stringify(reflection)).not.toContain("Private feedback");
  });

  it("creates a serializable abandonment reflection from aggregate progress only", async () => {
    const started = await start();
    const abandoned = await abandonSupportModule(command(started.interventionId, {
      metadata: { completedUnits: 1, totalUnits: 4, progressRatio: 0.25, rawTask: "Do not retain" },
    }));

    const reflection = reflectIntervention(abandoned.intervention);

    expect(reflection.outcomeSummary).toMatchObject({ completionStatus: "abandoned", completionRate: 0.25 });
    expect(reflection.confidence).toBe(0.6);
    expect(JSON.parse(JSON.stringify(reflection))).toEqual(reflection);
    expect(JSON.stringify(reflection)).not.toContain("Do not retain");
  });

  it("rejects non-terminal interventions and keeps reflections user scoped", async () => {
    const started = await start();

    const intervention = getInterventionHistory(USER_ID)[0].intervention;
    expect(() => reflectIntervention(intervention)).toThrow("Reflection requires a completed");
    expect(listReflections("another-user")).toEqual([]);
  });
});
