import { beforeEach, describe, expect, it } from "vitest";
import { completeFocusSessionIntervention, startFocusSessionIntervention, transitionFocusSessionIntervention } from "@/support/lifecycle/focusSessionLifecycle";
import { createLocalRole4Repository } from "@/support/persistence/role4Repository";
import { getSupportEvidenceAsync } from "@/support/evidence";
import { recommendFocusConfiguration } from "@backend/adaptive/reasoning/focusConfiguration";
import { buildFocusSessionOutcome, deriveFocusDurationTrends, deriveFocusSessionStats, getFocusSessionHistory } from "@/support/modules/focusSession/focusSessionService";

const MODULE_ID = "support.focus_session";

async function completeSession(repository, userId, minutes = 25) {
  const started = await startFocusSessionIntervention({
    userId,
    parameters: { plannedDurationMinutes: minutes, breakDurationMinutes: 5, mode: "focus" },
    repository,
  });
  await transitionFocusSessionIntervention({ userId, interventionId: started.intervention.id, toStatus: "paused", reason: "timer_paused", repository });
  await transitionFocusSessionIntervention({ userId, interventionId: started.intervention.id, toStatus: "in_progress", reason: "timer_resumed", repository });
  const outcome = buildFocusSessionOutcome({
    configuration: { plannedDurationMinutes: minutes, breakDurationMinutes: 5, mode: "focus" },
    secondsRemaining: 0,
    pauseCount: 1,
    resumeCount: 1,
    completedNaturally: true,
  });
  await completeFocusSessionIntervention({ userId, interventionId: started.intervention.id, outcome, repository });
}

function record({ timestamp, minutes, ratio, status = "completed" }) {
  return {
    timestamp,
    plannedDurationMinutes: minutes,
    actualDurationMs: Math.round(minutes * 60000 * ratio),
    completionRatio: ratio,
    status,
    mode: "focus",
  };
}

function outcome(id, minutes, ratio, status = "completed") {
  return {
    id,
    moduleId: MODULE_ID,
    status,
    createdAt: "2026-09-11T10:00:00.000Z",
    metrics: {
      plannedDurationMinutes: minutes,
      completionRatio: ratio,
      finalConfiguration: { plannedDurationMinutes: minutes, breakDurationMinutes: 5, mode: "focus" },
    },
  };
}

describe("Focus Session persistence and history", () => {
  beforeEach(() => localStorage.clear());

  it("stores terminal Focus outcome metrics and reloads them through the Role 4 repository", async () => {
    const repository = createLocalRole4Repository();
    await completeSession(repository, "focus-history-user");

    const history = await getFocusSessionHistory("focus-history-user", { repository });

    expect(history).toEqual([expect.objectContaining({
      userId: "focus-history-user",
      plannedDurationMinutes: 25,
      breakDurationMinutes: 5,
      mode: "focus",
      actualDurationMs: 25 * 60000,
      secondsRemaining: 0,
      completionRatio: 1,
      pauseCount: 1,
      resumeCount: 1,
      completedNaturally: true,
      status: "completed",
    })]);
  });

  it("keeps history user-scoped and returns newly persisted sessions after a re-read", async () => {
    const repository = createLocalRole4Repository();
    await completeSession(repository, "focus-history-user-a", 15);
    expect(await getFocusSessionHistory("focus-history-user-b", { repository })).toEqual([]);

    const initial = await getFocusSessionHistory("focus-history-user-a", { repository });
    await completeSession(repository, "focus-history-user-a", 25);
    const reloaded = await getFocusSessionHistory("focus-history-user-a", { repository });

    expect(initial).toHaveLength(1);
    expect(reloaded).toHaveLength(2);
    expect(reloaded.map((entry) => entry.plannedDurationMinutes).sort()).toEqual([15, 25]);
  });

  it("derives today, week, streak, and trends from persisted record values", () => {
    const now = new Date("2026-09-11T18:00:00.000Z");
    const history = [
      record({ timestamp: "2026-09-11T09:00:00.000Z", minutes: 15, ratio: 1 }),
      record({ timestamp: "2026-09-10T09:00:00.000Z", minutes: 25, ratio: 1 }),
      record({ timestamp: "2026-09-09T09:00:00.000Z", minutes: 25, ratio: 1 }),
      record({ timestamp: "2026-09-08T09:00:00.000Z", minutes: 15, ratio: 0.4, status: "abandoned" }),
      record({ timestamp: "2026-09-04T09:00:00.000Z", minutes: 25, ratio: 1 }),
      record({ timestamp: "2026-09-03T09:00:00.000Z", minutes: 15, ratio: 0.2, status: "abandoned" }),
    ];

    expect(deriveFocusSessionStats(history, now)).toMatchObject({ todaySessions: 1, todayFocusedMinutes: 15, weeklyFocusedMinutes: 65, streak: 3 });
    expect(deriveFocusDurationTrends(history).best).toMatchObject({ minutes: 25, sessions: 3, completionRate: 1 });
  });

  it("only recommends a duration when repository outcomes contain a clear evidence-backed winner", async () => {
    const repository = {
      listInterventions: async () => [],
      listLifecycleEvents: async () => [],
      listOutcomes: async () => [
        outcome("a", 15, 1), outcome("b", 15, 0.2, "abandoned"),
        outcome("c", 25, 1), outcome("d", 25, 1), outcome("e", 25, 1), outcome("f", 25, 0.4, "abandoned"),
      ],
    };

    const evidence = await getSupportEvidenceAsync("focus-evidence-user", [MODULE_ID], { repository });
    expect(recommendFocusConfiguration(evidence)).toMatchObject({ plannedDurationMinutes: 25, evidenceCount: 6 });

    const insufficient = await getSupportEvidenceAsync("focus-evidence-user", [MODULE_ID], {
      repository: { ...repository, listOutcomes: async () => [outcome("only", 25, 1)] },
    });
    expect(recommendFocusConfiguration(insufficient)).toBeNull();
  });
});
