import { describe, expect, it } from "vitest";
import {
  buildTaskBreakdownOutcome,
  calculateTaskBreakdownEvidence,
  generateTaskBreakdown,
  getTaskBreakdownProgress,
  validateTaskBreakdownConfiguration,
} from "@/support/modules/taskBreakdown/taskBreakdownService";

function historySession({ id, steps, status, ratio = status === "completed" ? 1 : 0, style, rating }) {
  return {
    intervention: { id, moduleId: "support.task_breakdown", parameters: { actualGeneratedStyle: style, actualGeneratedStepCount: steps } },
    outcomes: [{ id: `${id}-outcome`, status, rating, metrics: { completionRate: ratio, stepsCreated: steps, finalConfiguration: { actualGeneratedStyle: style, actualGeneratedStepCount: steps } } }],
  };
}

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
      actualGeneratedConfiguration: { actualGeneratedStyle: "Bare Minimum", priority: "Urgent", actualGeneratedStepCount: 4 },
      timerUsed: true,
      stepEdits: 1,
      stepReorders: 2,
      durationMs: 1234.9,
    });

    expect(outcome).toMatchObject({
      completionStatus: "completed",
      durationMs: 1234,
      metrics: { stepsCreated: 4, stepsCompleted: 4, completionRate: 1, timerUsed: true },
      finalConfiguration: { actualGeneratedStyle: "Bare Minimum", actualGeneratedStepCount: 4, priority: "Urgent", timerUsed: true },
    });
    expect(JSON.stringify(outcome)).not.toContain("Private task details");
  });

  it("recommends smaller plans only when the same user's smaller plans have a meaningful completion advantage", () => {
    const evidence = calculateTaskBreakdownEvidence([
      historySession({ id: "small-1", steps: 4, style: "Bare Minimum", status: "completed" }),
      historySession({ id: "small-2", steps: 4, style: "Bare Minimum", status: "completed" }),
      historySession({ id: "large-1", steps: 7, style: "Hero Mode", status: "abandoned", ratio: 0.2 }),
      historySession({ id: "large-2", steps: 7, style: "Hero Mode", status: "abandoned", ratio: 0.3 }),
    ]);

    expect(evidence.smaller).toMatchObject({ sessions: 2, completed: 2, fullCompletionRate: 1 });
    expect(evidence.detailed).toMatchObject({ sessions: 2, completed: 0, abandoned: 2, fullCompletionRate: 0 });
    expect(evidence.recommendation).toMatchObject({ direction: "smaller", recommendedStyle: "Bare Minimum", recommendedStepCount: 4 });
  });

  it("recommends detailed plans when that user's detailed plans outperform smaller plans", () => {
    const evidence = calculateTaskBreakdownEvidence([
      historySession({ id: "small-1", steps: 4, style: "Bare Minimum", status: "abandoned", ratio: 0.25 }),
      historySession({ id: "small-2", steps: 4, style: "Bare Minimum", status: "abandoned", ratio: 0 }),
      historySession({ id: "large-1", steps: 7, style: "Hero Mode", status: "completed" }),
      historySession({ id: "large-2", steps: 7, style: "Hero Mode", status: "completed" }),
    ]);

    expect(evidence.recommendation).toMatchObject({ direction: "detailed", recommendedStyle: "Hero Mode", recommendedStepCount: 7 });
  });

  it("stays neutral without two terminal sessions in both plan-size ranges", () => {
    const evidence = calculateTaskBreakdownEvidence([
      historySession({ id: "only-session", steps: 4, style: "Bare Minimum", status: "completed" }),
    ]);

    expect(evidence.hasComparableEvidence).toBe(false);
    expect(evidence.recommendation).toBeNull();
  });
});
