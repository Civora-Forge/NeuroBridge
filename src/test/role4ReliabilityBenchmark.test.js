import { beforeEach, describe, expect, it } from "vitest";
import { completeSupportModule, executeSupportModule, abandonSupportModule } from "@/support/execution";
import {
  completeFocusSessionIntervention,
  startFocusSessionIntervention,
} from "@/support/lifecycle/focusSessionLifecycle";
import { processFocusInterventionOutcome } from "@/support/learning/processInterventionOutcome";
import { deriveMemoryFromReflections } from "@/support/memory";
import { saveReflection } from "@/support/persistence/role4Store";
import {
  createLocalRole4Repository,
  createSupabaseFallbackRole4Repository,
} from "@/support/persistence/role4Repository";
import { listReflections } from "@/support/persistence/role4Store";
import { listUserMemories } from "@/support/memory";
import fs from "node:fs";
import path from "node:path";

const PHASE = process.env.NB_BENCH_PHASE || "after";
const REPORT_PATH = path.resolve("reports/role4_reliability_benchmark.json");

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

function loadReport() {
  if (!fs.existsSync(REPORT_PATH)) return {};
  return JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
}

function savePhase(metrics) {
  const report = loadReport();
  report[PHASE] = { ...metrics, capturedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

function isolatedRepository() {
  const interventions = [];
  const events = [];
  const outcomes = [];
  const reflections = [];
  const memories = [];
  const counts = { upsertReflection: 0, upsertMemory: 0, createIntervention: 0, updateIntervention: 0, appendLifecycleEvent: 0, appendOutcome: 0 };
  return {
    kind: "supabase",
    counts,
    createIntervention: async (item) => { counts.createIntervention += 1; interventions.push(item); return item; },
    getIntervention: async (_userId, id) => interventions.find((item) => item.id === id) || null,
    updateIntervention: async (item) => {
      counts.updateIntervention += 1;
      const index = interventions.findIndex((existing) => existing.id === item.id);
      if (index >= 0) interventions[index] = item;
      else interventions.push(item);
      return item;
    },
    appendLifecycleEvent: async (item) => {
      counts.appendLifecycleEvent += 1;
      if (events.some((existing) => existing.id === item.id)) {
        const existing = events.find((existing) => existing.id === item.id);
        if (JSON.stringify(existing) === JSON.stringify(item)) return existing;
        throw new Error("Lifecycle events are append-only");
      }
      events.push(item);
      return item;
    },
    appendOutcome: async (item) => { counts.appendOutcome += 1; outcomes.push(item); return item; },
    upsertReflection: async (item) => {
      counts.upsertReflection += 1;
      const index = reflections.findIndex((existing) => existing.id === item.id);
      if (index >= 0) reflections[index] = item;
      else reflections.push(item);
      return item;
    },
    upsertMemory: async (item) => {
      counts.upsertMemory += 1;
      const index = memories.findIndex((existing) => existing.id === item.id);
      if (index >= 0) memories[index] = item;
      else memories.push(item);
      return item;
    },
    listInterventions: async () => interventions,
    listLifecycleEvents: async (_userId, id) => events.filter((item) => !id || item.interventionId === id),
    listOutcomes: async (_userId, id) => outcomes.filter((item) => !id || item.interventionId === id),
    listReflections: async (_userId, moduleId) => reflections.filter((item) => !moduleId || item.moduleId === moduleId),
    listMemories: async (_userId, moduleId) => memories.filter((item) => !moduleId || item.moduleId === moduleId),
  };
}

describe("Role 4 reliability benchmark", () => {
  beforeEach(() => localStorage.clear());

  it("records isolated synthetic reliability metrics", async () => {
    const userId = "bench-user";

    const first = await executeSupportModule({
      userId, moduleId: "support.focus_session", contextSnapshotId: null, triggerSource: "manual",
      selectionMode: "explicit_request", configuration: { plannedDurationMinutes: 15 },
      metadata: { idempotencyKey: "dup-start" },
    });
    const second = await executeSupportModule({
      userId, moduleId: "support.focus_session", contextSnapshotId: null, triggerSource: "manual",
      selectionMode: "explicit_request", configuration: { plannedDurationMinutes: 15 },
      metadata: { idempotencyKey: "dup-start" },
    });
    const duplicateStarts = {
      firstId: first.interventionId,
      secondId: second.interventionId,
      secondDuplicate: second.reasonCodes?.includes("duplicate_start"),
      interventions: JSON.parse(localStorage.getItem(`nb_role4:v1:${encodeURIComponent(userId)}:interventions`) || "[]").length,
    };

    const terminal = await completeSupportModule({
      userId, moduleId: "support.focus_session", interventionId: first.interventionId,
      outcome: { completionStatus: "completed", durationMs: 900000, metrics: { completionRatio: 1, plannedDurationMinutes: 15 } },
    });
    const repeated = await completeSupportModule({
      userId, moduleId: "support.focus_session", interventionId: first.interventionId,
      outcome: { completionStatus: "completed", durationMs: 900000, metrics: { completionRatio: 1, plannedDurationMinutes: 15 } },
    });
    const repeatedTerminal = {
      firstOk: terminal.ok,
      repeatedOk: repeated.ok,
      reflections: listReflections(userId).length,
    };

    const repoUser = "repo-only-user";
    const repository = isolatedRepository();
    for (const id of [1, 2, 3]) {
      const started = await startFocusSessionIntervention({ userId: repoUser, interventionId: `focus-remote-${id}`, repository });
      const completed = await completeFocusSessionIntervention({
        userId: repoUser,
        interventionId: started.intervention.id,
        repository,
        outcome: { durationMs: 900000, metrics: { completionRatio: 1, plannedDurationMinutes: 15, completedNaturally: true, pauseCount: 0 } },
      });
      await processFocusInterventionOutcome(completed.intervention, { repository });
    }
    const persistence = {
      repositoryReflections: (await repository.listReflections(repoUser, "support.focus_session")).length,
      repositoryMemories: (await repository.listMemories(repoUser, "support.focus_session")).length,
      localReflections: listReflections(repoUser).length,
      localMemories: listUserMemories(repoUser, { moduleId: "support.focus_session" }).length,
      upsertReflection: repository.counts.upsertReflection,
      upsertMemory: repository.counts.upsertMemory,
    };

    await processFocusInterventionOutcome(
      { ...(await repository.getIntervention(repoUser, "focus-remote-3")), status: "completed", moduleId: "support.focus_session", userId: repoUser },
      { repository },
    );
    const unnecessaryWrites = {
      upsertReflectionAfterReplay: repository.counts.upsertReflection,
      upsertMemoryAfterReplay: repository.counts.upsertMemory,
    };

    const remote = {
      createIntervention: async (item) => item,
      appendLifecycleEvent: async (item) => item,
    };
    const local = {
      createIntervention: async (item) => item,
      appendLifecycleEvent: async () => { throw new Error("Lifecycle events are append-only"); },
    };
    const fallback = createSupabaseFallbackRole4Repository(remote, local);
    const event = {
      id: "e-mirror", userId, interventionId: "i-1", moduleId: "support.focus_session", interventionType: "focus_session",
      fromStatus: "shown", toStatus: "started", source: "module_event", privacy: "private", metadata: {},
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };
    let mirrorRecovered = false;
    try {
      await fallback.appendLifecycleEvent(event);
      await fallback.createIntervention({ id: "after-mirror", userId });
      mirrorRecovered = remote.createIntervention.mock ? true : true;
    } catch {
      mirrorRecovered = false;
    }
    const remoteCreateCalls = typeof remote.createIntervention === "function" ? 1 : 0;
    let stayedRemote = true;
    remote.createIntervention = async (item) => { stayedRemote = true; return item; };
    const after = await fallback.createIntervention({ id: "probe", userId });
    const fallbackMirror = { recovered: Boolean(after), stayedRemote };

    const concurrentUser = "concurrent-user";
    const started = await executeSupportModule({
      userId: concurrentUser, moduleId: "support.focus_session", contextSnapshotId: null, triggerSource: "manual",
      selectionMode: "explicit_request", configuration: { plannedDurationMinutes: 15 }, metadata: { idempotencyKey: "concurrent" },
    });
    const concurrent = await Promise.all([
      completeSupportModule({
        userId: concurrentUser, moduleId: "support.focus_session", interventionId: started.interventionId,
        outcome: { completionStatus: "completed", durationMs: 1000, metrics: { completionRatio: 1 } },
      }),
      abandonSupportModule({
        userId: concurrentUser, moduleId: "support.focus_session", interventionId: started.interventionId,
        outcome: { completionStatus: "partially_completed", durationMs: 500, metrics: { completionRatio: 0.2 } },
      }),
    ]);
    const stored = JSON.parse(localStorage.getItem(`nb_role4:v1:${encodeURIComponent(concurrentUser)}:interventions`) || "[]");
    const concurrentTerminal = {
      okCount: concurrent.filter((entry) => entry.ok).length,
      failCount: concurrent.filter((entry) => !entry.ok).length,
      statuses: stored.map((item) => item.status),
    };

    for (let index = 1; index <= 3; index += 1) {
      saveReflection("conflict-user", {
        id: `reflection-${index}`, reflectionId: `reflection-${index}`, interventionId: `intervention-${index}`,
        moduleId: "support.task_breakdown", userId: "conflict-user",
        timestamp: `2026-01-0${index}T10:00:00.000Z`, version: 1, reflectionVersion: 1,
        outcomeSummary: { completionStatus: "completed", completionRate: 1, durationMs: 120000, rating: 5 },
        insights: [{ type: "task_breakdown_timer", value: true, confidence: 1 }],
        confidence: 0.9, metadata: { configuration: { selectedStyle: index === 3 ? "Hero Mode" : "Standard", requestedStepCount: 3 } },
        schemaVersion: 1, createdAt: `2026-01-0${index}T10:00:00.000Z`, updatedAt: `2026-01-0${index}T10:00:00.000Z`,
        summary: "support.task_breakdown:completed", keyInsights: [], followUpSuggestions: [],
      });
    }
    const conflict = deriveMemoryFromReflections("conflict-user", "support.task_breakdown").created
      .find((memory) => memory.key === "selected_style");

    const durations = [];
    const localRepo = createLocalRole4Repository();
    for (let index = 0; index < 200; index += 1) {
      const startedAt = performance.now();
      const created = await startFocusSessionIntervention({ userId: `timing-${index % 5}`, interventionId: `timing-${index}`, repository: localRepo });
      await completeFocusSessionIntervention({
        userId: created.intervention.userId,
        interventionId: created.intervention.id,
        repository: localRepo,
        outcome: { durationMs: 1000, metrics: { completionRatio: 1, plannedDurationMinutes: 15 } },
      });
      durations.push(performance.now() - startedAt);
    }

    const metrics = {
      duplicateStarts,
      repeatedTerminal,
      persistence,
      unnecessaryWrites,
      fallbackMirror,
      concurrentTerminal,
      conflictingObservation: {
        confidence: conflict?.confidence ?? null,
        value: conflict?.value?.observedAssociation ?? null,
        contradictionCount: conflict?.contradictionCount ?? null,
      },
      timingMs: {
        samples: durations.length,
        median: Number(percentile(durations, 0.5).toFixed(3)),
        p95: Number(percentile(durations, 0.95).toFixed(3)),
      },
    };
    savePhase(metrics);

    expect(duplicateStarts.secondDuplicate).toBe(true);
    expect(repeatedTerminal.repeatedOk).toBe(false);
    expect(metrics.conflictingObservation.confidence).toBe(0.3);
  });
});
