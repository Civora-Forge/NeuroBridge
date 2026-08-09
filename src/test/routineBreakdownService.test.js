import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/socialCommunication/services/aiService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateRoutineBreakdown: vi.fn(),
  };
});

import { generateRoutineBreakdown } from "@/features/socialCommunication/services/aiService";
import { RoutineBreakdownSchema } from "@/support/modules/routineBreakdown/routineBreakdownTypes";
import {
  buildBreakdownConfig,
  buildBreakdownProgress,
  buildRoutineBreakdownPerformance,
  generateRoutineBreakdown as generateRoutineBreakdownService,
  getFallbackRoutineBreakdown,
  normalizeBreakdown,
} from "@/support/modules/routineBreakdown/routineBreakdownService";

describe("routine breakdown service", () => {
  it("clamps requested step counts to the supported range", () => {
    expect(buildBreakdownConfig({ task: "x", stepCount: 99 })).toMatchObject({ stepCount: 8 });
    expect(buildBreakdownConfig({ task: "x", stepCount: 1 })).toMatchObject({ stepCount: 2 });
    expect(buildBreakdownConfig({ task: "x", stepCount: 5 })).toMatchObject({ stepCount: 5 });
  });

  it("produces a deterministic fallback from the shared task templates", () => {
    const first = getFallbackRoutineBreakdown("Tidy room", {
      selectedStyle: "Bare Minimum",
      stepCount: 4,
    });
    const second = getFallbackRoutineBreakdown("Tidy room", {
      selectedStyle: "Bare Minimum",
      stepCount: 4,
    });
    expect(first).toEqual(second);
    expect(first.steps).toHaveLength(4);
    expect(first.steps[0]).toMatchObject({ order: 0 });
    expect(RoutineBreakdownSchema.safeParse(first).success).toBe(true);
  });

  it("trims fallback steps to the requested count", () => {
    const breakdown = getFallbackRoutineBreakdown("Study", { selectedStyle: "Standard", stepCount: 3 });
    expect(breakdown.steps).toHaveLength(3);
  });

  it("normalizes AI output into ordered, unique steps", () => {
    const normalized = normalizeBreakdown({
      taskId: "cook-dinner",
      title: "Cook dinner",
      steps: [
        { id: "b", order: 1, title: "B" },
        { id: "a", order: 0, title: "A" },
        { id: "a", order: 2, title: "A again" },
      ],
    });
    expect(normalized.steps.map((step) => step.title)).toEqual(["A", "B", "A again"]);
    expect(new Set(normalized.steps.map((step) => step.id)).size).toBe(3);
  });

  it("uses AI output when it validates against the schema", async () => {
    generateRoutineBreakdown.mockResolvedValue({
      taskId: "cook-dinner",
      title: "Cook dinner",
      steps: [
        { id: "one", order: 0, title: "Wash the vegetables", estimatedEffort: 5, completed: false },
        { id: "two", order: 1, title: "Chop the vegetables", estimatedEffort: 5, completed: false },
      ],
    });
    const outcome = await generateRoutineBreakdownService("Cook dinner", {}, { apiKey: "test-key" });
    expect(outcome.source).toBe("ai");
    expect(outcome.aiAvailable).toBe(true);
    expect(outcome.breakdown.steps).toHaveLength(2);
    expect(RoutineBreakdownSchema.safeParse(outcome.breakdown).success).toBe(true);
  });

  it("degrades to the deterministic fallback on malformed or rejected AI", async () => {
    generateRoutineBreakdown.mockResolvedValue({ steps: "not-an-array" });
    expect((await generateRoutineBreakdownService("Tidy", {}, { apiKey: "k" })).source).toBe("fallback");

    generateRoutineBreakdown.mockRejectedValue(new Error("breakdown down"));
    const outcome = await generateRoutineBreakdownService("Tidy", {}, { apiKey: "k" });
    expect(outcome.source).toBe("fallback");
    expect(outcome.aiError).toContain("breakdown down");
  });

  it("tracks progress only for known steps", () => {
    const breakdown = getFallbackRoutineBreakdown("Pack bag", { stepCount: 4 });
    const progress = buildBreakdownProgress(breakdown.steps, [breakdown.steps[0].id, "bogus-id"]);
    expect(progress).toMatchObject({
      total: 4,
      completed: 1,
      completionRate: 0.25,
      status: "partially_completed",
    });
  });

  it("builds a canonical performance signal without leaking the task title", () => {
    const breakdown = getFallbackRoutineBreakdown("Pack bag", { stepCount: 4 });
    const performance = buildRoutineBreakdownPerformance({
      steps: breakdown.steps,
      completedStepIds: breakdown.steps.map((step) => step.id),
      selectedStyle: "Bare Minimum",
      requestedStepCount: 4,
      stepEdits: 1,
      stepReorders: 2,
      durationMs: 999.5,
    });
    expect(performance).toMatchObject({
      completionStatus: "completed",
      durationMs: 999,
      metrics: {
        stepsCreated: 4,
        stepsCompleted: 4,
        completionRate: 1,
        stepEdits: 1,
        stepReorders: 2,
      },
    });
    expect(JSON.stringify(performance)).not.toContain("Pack bag");
  });
});
