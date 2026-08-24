import { beforeEach, describe, expect, it } from "vitest";
import { getInterventionHistory } from "@/support/lifecycle/interventionLifecycle";
import { executeSupportModule } from "@/support/execution";
import { getFocusSessionHistory } from "@/support/lifecycle/focusSessionLifecycle";

const USER_ID = "execution-user";

function validRequest(overrides = {}) {
  return {
    moduleId: "support.task_breakdown",
    userId: USER_ID,
    contextSnapshotId: "context-123",
    triggerSource: "manual",
    selectionMode: "explicit_request",
    configuration: { style: "gentle" },
    metadata: {},
    ...overrides,
  };
}

describe("shared support execution", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("rejects malformed execution requests", async () => {
    const result = await executeSupportModule({ moduleId: "support.task_breakdown" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.reasonCodes).toContain("invalid_request");
  });

  it("rejects unknown and legacy module IDs", async () => {
    const unknown = await executeSupportModule(validRequest({ moduleId: "support.unknown" }));
    const legacy = await executeSupportModule(validRequest({ moduleId: "adhd.task-breakdown" }));

    expect(unknown.reasonCodes).toContain("invalid_module_id");
    expect(legacy.reasonCodes).toContain("invalid_module_id");
  });

  it("blocks canonical modules deferred from availability", async () => {
    const results = await Promise.all(["support.visual_timeline", "support.mood_checkin", "support.accountability_session", "support.soundscape"].map((moduleId) => executeSupportModule(validRequest({ moduleId }))));
    expect(results.every((result) => !result.ok && result.status === "blocked" && result.reasonCodes.includes("module_unavailable"))).toBe(true);
  });

  it("generates an intervention ID and records the start lifecycle", async () => {
    const result = await executeSupportModule(validRequest());
    const history = getInterventionHistory(USER_ID);

    expect(result.ok).toBe(true);
    expect(result.interventionId).toMatch(/^intervention-/);
    expect(result.lifecycle.map((event) => event.status)).toEqual([
      "created",
      "validated",
      "starting",
      "running",
    ]);
    expect(history).toHaveLength(1);
    expect(history[0].intervention.parameters.execution).toMatchObject({
      contextSnapshotId: "context-123",
      triggerSource: "manual",
      selectionMode: "explicit_request",
    });
    expect(history[0].lifecycleEvents.map((event) => event.toStatus)).toEqual(["started", "shown"]);
  });

  it("returns a Focus launch handoff with provenance and configuration", async () => {
    const result = await executeSupportModule(validRequest({
      moduleId: "support.focus_session",
      contextSnapshotId: "context-focus",
      configuration: { plannedDurationMinutes: 15, breakDurationMinutes: 7 },
      metadata: { planId: "plan-focus" },
    }));

    expect(result).toMatchObject({
      ok: true,
      moduleId: "support.focus_session",
      launch: {
        route: "/adhd/focus",
        state: {
          interventionId: result.interventionId,
          moduleId: "support.focus_session",
          planId: "plan-focus",
          contextSnapshotId: "context-focus",
          configuration: { plannedDurationMinutes: 15, breakDurationMinutes: 7 },
        },
      },
    });
    expect(await getFocusSessionHistory(USER_ID)).toHaveLength(1);
  });

  it("starts every currently available canonical executor without disorder input", async () => {
    const moduleIds = [
      "support.task_breakdown",
      "support.focus_session",
      "support.gentle_activity",
      "support.grounding",
      "support.social_connection",
      "support.cognitive_reframing",
      "support.evidence_journal",
    ];

    const results = await Promise.all(moduleIds.map((moduleId) =>
      executeSupportModule(validRequest({ moduleId })),
    ));

    expect(results.every((result) => result.ok && result.status === "running")).toBe(true);
    expect(results.every((result) => result.interventionId)).toBe(true);
  });

  it("blocks unsafe explicit requests before creating an intervention", async () => {
    const result = await executeSupportModule(validRequest({
      metadata: { explicitRequest: "I want to self harm" },
    }));

    expect(result.status).toBe("blocked");
    expect(result.reasonCodes).toContain("crisis_language_detected");
    expect(getInterventionHistory(USER_ID)).toEqual([]);
  });
});
