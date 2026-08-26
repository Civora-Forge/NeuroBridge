import { describe, expect, it } from "vitest";
import {
  buildTaskBreakdownOutcome,
  generateTaskBreakdown,
  getTaskBreakdownProgress,
  validateTaskBreakdownConfiguration,
} from "@/support/modules/taskBreakdown/taskBreakdownService";

describe("task breakdown service", () => {
  it("generates deterministic normalized steps for each supported style", () => {
    const first = generateTaskBreakdown("Prepare report", { selectedStyle: "Bare Minimum" });
    const second = generateTaskBreakdown("Prepare report", { selectedStyle: "Bare Minimum" });

    expect(first).toEqual(second);
    expect(first).toHaveLength(4);
    expect(first[0]).toMatchObject({ id: "step-1", time: 2 });
    expect(generateTaskBreakdown(" ", { selectedStyle: "Standard" })).toEqual([]);
  });

  it("falls back to safe configuration values", () => {
    expect(validateTaskBreakdownConfiguration({ selectedStyle: "Unknown", priority: "Later" })).toEqual({
      selectedStyle: "Standard",
      priority: "Important",
    });
  });

  it("counts only generated steps as progress", () => {
    const steps = generateTaskBreakdown("Study", { selectedStyle: "Bare Minimum" });
    const progress = getTaskBreakdownProgress(steps, new Set([steps[0].id, "not-a-step"]));

    expect(progress).toMatchObject({ totalUnits: 4, completedUnits: 1, completionRate: 0.25 });
    expect([...progress.completedStepIds]).toEqual(["step-1"]);
  });

  it("builds a canonical outcome without source task or step text", () => {
    const steps = generateTaskBreakdown("Private task details", { selectedStyle: "Bare Minimum" });
    const outcome = buildTaskBreakdownOutcome({
      steps,
      completedStepIds: new Set(steps.map((step) => step.id)),
      selectedStyle: "Bare Minimum",
      priority: "Urgent",
      requestedStepCount: steps.length,
      timerUsed: true,
      stepEdits: 1,
      stepReorders: 2,
      durationMs: 1234.9,
    });

    expect(outcome).toMatchObject({
      completionStatus: "completed",
      durationMs: 1234,
      metrics: { stepsCreated: 4, stepsCompleted: 4, completionRate: 1, timerUsed: true },
    });
    expect(JSON.stringify(outcome)).not.toContain("Private task details");
  });
});
