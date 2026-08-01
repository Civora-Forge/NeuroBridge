import { beforeEach, describe, expect, it } from "vitest";
import {
  abandonSupportModule,
  cancelSupportModule,
  completeSupportModule,
  failSupportModule,
  pauseSupportModule,
  progressSupportModule,
  rateSupportModule,
  resumeSupportModule,
  executeSupportModule,
} from "@/support/execution";
import { getInterventionHistory } from "@/support/lifecycle/interventionLifecycle";

const USER_ID = "command-user";

function startRequest(overrides = {}) {
  return {
    moduleId: "support.task_breakdown",
    userId: USER_ID,
    contextSnapshotId: "context-command",
    triggerSource: "manual",
    selectionMode: "explicit_request",
    configuration: { style: "gentle" },
    metadata: {},
    ...overrides,
  };
}

async function startIntervention(overrides = {}) {
  return executeSupportModule(startRequest(overrides));
}

function command(interventionId, overrides = {}) {
  return {
    userId: USER_ID,
    interventionId,
    moduleId: "support.task_breakdown",
    ...overrides,
  };
}

describe("public support lifecycle commands", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates one intervention and returns the same intervention for a duplicate start key", async () => {
    const first = await startIntervention({ metadata: { idempotencyKey: "double-click" } });
    const second = await startIntervention({ metadata: { idempotencyKey: "double-click" } });

    expect(first.interventionId).toBeTruthy();
    expect(second.interventionId).toBe(first.interventionId);
    expect(second.reasonCodes).toContain("duplicate_start");
    expect(getInterventionHistory(USER_ID)).toHaveLength(1);
  });

  it("persists progress, pause, and resume transitions", async () => {
    const started = await startIntervention();
    const progressed = await progressSupportModule(command(started.interventionId, {
      progress: { progressType: "steps", completedUnits: 1, totalUnits: 3, progressRatio: 1 / 3 },
    }));
    const paused = await pauseSupportModule(command(started.interventionId));
    const resumed = await resumeSupportModule(command(started.interventionId));

    expect(progressed.ok).toBe(true);
    expect(paused.intervention.status).toBe("paused");
    expect(resumed.intervention.status).toBe("in_progress");
    const progressEvent = getInterventionHistory(USER_ID)[0].lifecycleEvents.find(
      (event) => event.metadata.progress,
    );
    expect(progressEvent.metadata.progress.completedUnits).toBe(1);
  });

  it("persists completion and its canonical outcome payload", async () => {
    const started = await startIntervention();
    const completed = await completeSupportModule(command(started.interventionId, {
      outcome: {
        durationMs: 120000,
        metrics: { steps_completed: 3 },
        finalConfiguration: { style: "gentle" },
      },
    }));

    expect(completed.ok).toBe(true);
    expect(completed.intervention.status).toBe("completed");
    expect(completed.outcome.metrics).toMatchObject({
      steps_completed: 3,
      finalConfiguration: { style: "gentle" },
    });
  });

  it("persists abandonment, cancellation, and failure as terminal states", async () => {
    const abandoned = await startIntervention();
    const cancelled = await startIntervention();
    const failed = await startIntervention();

    expect((await abandonSupportModule(command(abandoned.interventionId))).intervention.status).toBe("abandoned");
    expect((await cancelSupportModule(command(cancelled.interventionId))).intervention.status).toBe("cancelled");
    expect((await failSupportModule(command(failed.interventionId))).intervention.status).toBe("failed");
  });

  it("validates ratings and rejects duplicate rating submissions", async () => {
    const started = await startIntervention();
    await completeSupportModule(command(started.interventionId));

    const invalid = await rateSupportModule(command(started.interventionId, { outcome: { userRating: 6 } }));
    const rated = await rateSupportModule(command(started.interventionId, { outcome: { userRating: 4, userFeedback: "Helpful" } }));
    const duplicate = await rateSupportModule(command(started.interventionId, { outcome: { userRating: 5 } }));

    expect(invalid.reasonCodes).toContain("invalid_command");
    expect(rated.outcome.rating).toBe(4);
    expect(rated.outcome.userFeedback).toBeUndefined();
    expect(duplicate.reasonCodes).toContain("rating_already_submitted");
  });

  it("allows a rating after meaningful partial completion", async () => {
    const started = await startIntervention();
    const partial = await completeSupportModule(command(started.interventionId, {
      outcome: { completionStatus: "partially_completed", metrics: { steps_completed: 1 } },
    }));
    const rated = await rateSupportModule(command(started.interventionId, { outcome: { userRating: 3 } }));

    expect(partial.intervention.status).toBe("partially_completed");
    expect(rated.ok).toBe(true);
  });

  it("rejects duplicate and cross-terminal updates", async () => {
    const completed = await startIntervention();
    const abandoned = await startIntervention();
    await completeSupportModule(command(completed.interventionId));
    await abandonSupportModule(command(abandoned.interventionId));

    expect((await completeSupportModule(command(completed.interventionId))).reasonCodes).toContain("invalid_transition");
    expect((await progressSupportModule(command(completed.interventionId))).reasonCodes).toContain("invalid_transition");
    expect((await completeSupportModule(command(abandoned.interventionId))).reasonCodes).toContain("invalid_transition");
  });

  it("allows only one of two near-simultaneous terminal commands", async () => {
    const started = await startIntervention();
    const results = await Promise.all([
      completeSupportModule(command(started.interventionId)),
      abandonSupportModule(command(started.interventionId)),
    ]);

    expect(results.filter((entry) => entry.ok)).toHaveLength(1);
    expect(results.filter((entry) => !entry.ok)[0].reasonCodes).toContain("invalid_transition");
  });

  it("rejects wrong users, mismatched modules, and unknown interventions", async () => {
    const started = await startIntervention();

    const wrongUser = await progressSupportModule(command(started.interventionId, { userId: "another-user" }));
    const mismatchedModule = await progressSupportModule(command(started.interventionId, { moduleId: "support.focus_session" }));
    const unknown = await progressSupportModule(command("missing-intervention"));

    expect(wrongUser.reasonCodes).toContain("intervention_not_found");
    expect(mismatchedModule.reasonCodes).toContain("module_mismatch");
    expect(unknown.reasonCodes).toContain("intervention_not_found");
  });

  it("preserves original execution metadata after lifecycle updates", async () => {
    const started = await startIntervention({
      contextSnapshotId: "snapshot-preserved",
      triggerSource: "chat",
      selectionMode: "fallback",
      configuration: { style: "visual" },
    });
    await progressSupportModule(command(started.interventionId));
    const intervention = getInterventionHistory(USER_ID)[0].intervention;

    expect(intervention.parameters.execution).toMatchObject({
      contextSnapshotId: "snapshot-preserved",
      triggerSource: "chat",
      selectionMode: "fallback",
    });
    expect(intervention.parameters.style).toBe("visual");
  });
});
