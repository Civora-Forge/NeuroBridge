import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalRole4Repository,
  createSupabaseFallbackRole4Repository,
  createSupabaseRole4Repository,
  getRole4Repository,
  interventionFromRow,
  interventionToRow,
  lifecycleEventFromRow,
  lifecycleEventToRow,
  memoryFromRow,
  memoryToRow,
  outcomeFromRow,
  outcomeToRow,
  reflectionFromRow,
  reflectionToRow,
  reconcileRole4Records,
} from "@/support/persistence/role4Repository";
import { completeFocusSessionIntervention, startFocusSessionIntervention } from "@/support/lifecycle/focusSessionLifecycle";
import { getSupportEvidenceAsync } from "@/support/evidence/supportEvidence";
import { processFocusInterventionOutcome } from "@/support/learning/processInterventionOutcome";
import { reflectFocusIntervention } from "@/support/reflection";
import { deliverInterventionAsync, recordInterventionOutcomeAsync, transitionInterventionAsync } from "@/support/lifecycle/interventionLifecycle";
import { listUnsyncedRole4Records, markRole4RecordUnsynced, saveIntervention, saveInterventionLifecycleEvent } from "@/support/persistence/role4Store";

const userId = "repository-user";
const intervention = { id: "i-1", userId, moduleId: "support.focus_session", interventionType: "focus_session", category: "executive", status: "started", title: "Focus", source: "module_event", privacy: "private", tags: [], parameters: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const event = { id: "e-1", userId, interventionId: "i-1", moduleId: "support.focus_session", interventionType: "focus_session", fromStatus: "shown", toStatus: "started", source: "module_event", privacy: "private", metadata: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const outcome = { id: "o-1", userId, interventionId: "i-1", moduleId: "support.focus_session", interventionType: "focus_session", category: "executive", status: "completed", source: "module_event", privacy: "private", completed: true, durationMs: 1000, userFeedback: "helpful", metrics: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

function inMemoryRepository() {
  const interventions = []; const events = []; const outcomes = [];
  return {
    kind: "supabase",
    createIntervention: async (item) => { interventions.push(item); return item; },
    getIntervention: async (_userId, id) => interventions.find((item) => item.id === id) || null,
    updateIntervention: async (item) => { const index = interventions.findIndex((existing) => existing.id === item.id); interventions[index] = item; return item; },
    appendLifecycleEvent: async (item) => { if (events.some((existing) => existing.id === item.id)) throw new Error("Lifecycle events are append-only"); events.push(item); return item; },
    appendOutcome: async (item) => { if (outcomes.some((existing) => existing.id === item.id)) throw new Error("Outcomes are append-only"); outcomes.push(item); return item; },
    listInterventions: async () => interventions,
    listLifecycleEvents: async (_userId, id) => events.filter((item) => item.interventionId === id),
    listOutcomes: async (_userId, id) => outcomes.filter((item) => item.interventionId === id),
  };
}

describe("Role 4 repository", () => {
  beforeEach(() => localStorage.clear());
  it("uses Supabase only when the current authenticated session belongs to the user", async () => {
    const client = { auth: { getSession: async () => ({ data: { session: { user: { id: userId } } }, error: null }) } };
    expect((await getRole4Repository(userId, { client })).kind).toBe("supabase");
    expect((await getRole4Repository("demo-user", { client })).kind).toBe("local");
  });

  it("round-trips explicit camelCase and snake_case mappings", () => {
    expect(interventionFromRow(interventionToRow(intervention))).toMatchObject(intervention);
    expect(lifecycleEventFromRow(lifecycleEventToRow(event))).toMatchObject(event);
    expect(outcomeFromRow(outcomeToRow(outcome))).toMatchObject(outcome);
    expect(outcomeToRow(outcome)).toHaveProperty("duration_ms", 1000);
    expect(outcomeToRow(outcome)).toHaveProperty("user_feedback", "helpful");
  });

  it("round-trips reflection and memory records used by Supabase upserts", () => {
    const reflection = {
      id: "reflection-1", reflectionId: "reflection-1", userId, interventionId: "i-1", moduleId: "support.focus_session",
      timestamp: "2026-01-01T00:00:00.000Z", version: 1, reflectionVersion: 1, outcomeSummary: { completionStatus: "completed" },
      insights: [], summary: "support.focus_session:completed", keyInsights: [], followUpSuggestions: [], confidence: 0.3,
      metadata: {}, evidenceOutcomeIds: [], privacy: "private", source: "system_inference", schemaVersion: 1,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const memory = {
      id: "memory-1", memoryId: "memory-1", userId, moduleId: "support.focus_session", category: "completion_pattern",
      type: "learning_pattern", key: "focus_completion_ratio_band", value: { observedAssociation: "high" }, evidenceCount: 3,
      supportingReflectionIds: ["reflection-1"], confidence: 0.65, confidenceLevel: "moderate", version: 1, status: "active",
      contradictionCount: 0, metadata: {}, privacy: "private", source: "system_inference", evidenceIds: ["reflection-1"], schemaVersion: 1,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(reflectionFromRow(reflectionToRow(reflection))).toMatchObject(reflection);
    expect(memoryFromRow(memoryToRow(memory))).toMatchObject(memory);
  });

  it("converts nullable SQL optional fields back to absent JS fields", () => {
    expect(interventionFromRow({ ...interventionToRow(intervention), context_snapshot: null, description: null, route: null, rationale: null }).contextSnapshot).toBeUndefined();
    expect(lifecycleEventFromRow({ ...lifecycleEventToRow(event), context_snapshot: null, reason: null }).contextSnapshot).toBeUndefined();
    expect(outcomeFromRow({ ...outcomeToRow(outcome), context_snapshot: null, user_feedback: null, duration_ms: null }).contextSnapshot).toBeUndefined();
  });

  it("keeps local demo events and outcomes append-only through the repository", async () => {
    const repository = createLocalRole4Repository();
    await repository.appendLifecycleEvent(event);
    await expect(repository.appendLifecycleEvent(event)).rejects.toThrow("append-only");
    await repository.appendOutcome(outcome);
    await expect(repository.appendOutcome(outcome)).rejects.toThrow("append-only");
  });

  it("surfaces failed Supabase writes", async () => {
    const client = { from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: "RLS denied" } }) }) }) }) };
    await expect(createSupabaseRole4Repository(client).createIntervention(intervention)).rejects.toThrow("RLS denied");
  });

  it("falls back to and stays with local persistence after a Supabase write fails", async () => {
    const remote = { createIntervention: vi.fn().mockRejectedValue(new Error("offline")) };
    const local = { createIntervention: vi.fn().mockResolvedValue(intervention) };
    const repository = createSupabaseFallbackRole4Repository(remote, local);
    await expect(repository.createIntervention(intervention)).resolves.toEqual(intervention);
    await repository.createIntervention(intervention);
    expect(remote.createIntervention).toHaveBeenCalledTimes(1);
    expect(local.createIntervention).toHaveBeenCalledTimes(2);
    expect(repository.getPersistenceState(userId)).toMatchObject({
      state: "unsynced_local",
      unsyncedRecords: [{ collection: "interventions", id: "i-1" }],
    });
  });

  it("persists a non-Focus lifecycle through the supplied repository", async () => {
    const records = { interventions: [], events: [], outcomes: [] };
    const repository = {
      createIntervention: async (record) => { records.interventions.push(record); return record; },
      getIntervention: async (_userId, id) => records.interventions.find((record) => record.id === id) ?? null,
      updateIntervention: async (record) => { records.interventions.splice(records.interventions.findIndex((item) => item.id === record.id), 1, record); return record; },
      appendLifecycleEvent: async (record) => { records.events.push(record); return record; },
      appendOutcome: async (record) => { records.outcomes.push(record); return record; },
    };
    const module = { id: "support.task_breakdown", interventionTypes: ["task_breakdown"], category: "executive", title: "Task", description: "", route: "/adhd/tasks", tags: [], privacyDefault: "private" };
    const delivered = await deliverInterventionAsync({ userId, module, interventionId: "remote-task", repository });
    const transitioned = await transitionInterventionAsync({ userId, interventionId: delivered.intervention.id, toStatus: "started", reason: "execution_started", repository });
    await recordInterventionOutcomeAsync({ userId, interventionId: transitioned.intervention.id, status: "completed", completed: true, repository });

    expect(records.interventions).toHaveLength(1);
    expect(records.events.map((event) => event.toStatus)).toEqual(["shown", "started"]);
    expect(records.outcomes).toHaveLength(1);
    expect(records.outcomes[0].userId).toBe(userId);
  });

  it("persists Focus start, completion, and reconstructed history through an injected remote boundary", async () => {
    const repository = inMemoryRepository();
    const started = await startFocusSessionIntervention({ userId, interventionId: "focus-1", repository });
    const completed = await completeFocusSessionIntervention({ userId, interventionId: started.intervention.id, repository, outcome: { durationMs: 1500, metrics: { plannedDurationMinutes: 25, completedNaturally: true } } });
    expect(completed.outcome.metrics.completedNaturally).toBe(true);
    expect(await repository.listLifecycleEvents(userId, "focus-1")).toHaveLength(3);
    expect(await repository.listOutcomes(userId, "focus-1")).toHaveLength(1);
    expect((await repository.getIntervention(userId, "focus-1")).status).toBe("completed");
  });

  it("writes Focus reflections through the selected repository", async () => {
    const local = createLocalRole4Repository();
    const repository = { ...local, upsertReflection: vi.fn(local.upsertReflection) };
    const started = await startFocusSessionIntervention({ userId, interventionId: "focus-reflection", repository });
    const completed = await completeFocusSessionIntervention({
      userId,
      interventionId: started.intervention.id,
      repository,
      outcome: { durationMs: 1500, metrics: { completionRatio: 1, plannedDurationMinutes: 15 } },
    });

    const saved = await reflectFocusIntervention(completed.intervention, { repository });
    expect(repository.upsertReflection).toHaveBeenCalledWith(expect.objectContaining({ interventionId: "focus-reflection" }));
    expect(await repository.listReflections(userId, "support.focus_session")).toEqual([saved]);
  });

  it("persists derived Focus memories through the selected repository after sufficient evidence", async () => {
    const local = createLocalRole4Repository();
    const repository = {
      ...local,
      upsertReflection: vi.fn(local.upsertReflection),
      upsertMemory: vi.fn(local.upsertMemory),
    };

    for (const id of [1, 2, 3]) {
      const started = await startFocusSessionIntervention({ userId, interventionId: `focus-memory-${id}`, repository });
      const completed = await completeFocusSessionIntervention({
        userId,
        interventionId: started.intervention.id,
        repository,
        outcome: { durationMs: 900000, metrics: { completionRatio: 1, plannedDurationMinutes: 15, completedNaturally: true, pauseCount: 0 } },
      });
      await processFocusInterventionOutcome(completed.intervention, { repository });
    }

    expect(repository.upsertReflection).toHaveBeenCalledTimes(3);
    expect(repository.upsertMemory).toHaveBeenCalled();
    expect(await repository.listMemories(userId, "support.focus_session")).not.toEqual([]);
  });

  it("derives an advisory shorter Focus configuration from repository outcomes only", async () => {
    const outcomes = [1, 2, 3].map((id) => ({ ...outcome, id: `short-${id}`, interventionId: `focus-${id}`, createdAt: `2026-01-0${id}T00:00:00.000Z`, metrics: { plannedDurationMinutes: 15, completionRatio: 1, finalConfiguration: { plannedDurationMinutes: 15, breakDurationMinutes: 5 } } }));
    const repository = { listInterventions: async () => [], listLifecycleEvents: async () => outcomes.map((item) => ({ interventionId: item.interventionId, moduleId: item.moduleId, toStatus: "started" })), listOutcomes: async () => outcomes };
    const evidence = await getSupportEvidenceAsync(userId, ["support.focus_session"], { repository });
    expect(evidence.modules[0].preferredConfiguration).toMatchObject({ values: { plannedDurationMinutes: 15, breakDurationMinutes: 5 }, advisory: true });
  });

  it("reconciles pending records after authenticated remote access returns", async () => {
    saveIntervention(userId, intervention);
    markRole4RecordUnsynced(userId, "interventions", intervention.id);
    const remote = { getIntervention: vi.fn().mockResolvedValue(null), createIntervention: vi.fn().mockResolvedValue(intervention) };
    const client = { auth: { getSession: async () => ({ data: { session: { user: { id: userId } } }, error: null }) } };

    await expect(reconcileRole4Records(userId, { client, repository: remote, delays: [0] })).resolves.toBe(true);
    expect(remote.createIntervention).toHaveBeenCalledWith(expect.objectContaining(intervention));
    expect(listUnsyncedRole4Records(userId)).toEqual([]);
  });

  it("retries partial failures without duplicating already confirmed records", async () => {
    saveIntervention(userId, intervention);
    saveInterventionLifecycleEvent(userId, event);
    markRole4RecordUnsynced(userId, "interventions", intervention.id);
    markRole4RecordUnsynced(userId, "lifecycle_events", event.id);
    const remote = {
      getIntervention: vi.fn().mockResolvedValue(null),
      createIntervention: vi.fn().mockResolvedValue(intervention),
      appendLifecycleEvent: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(event),
    };
    const client = { auth: { getSession: async () => ({ data: { session: { user: { id: userId } } }, error: null }) } };

    await expect(reconcileRole4Records(userId, { client, repository: remote, delays: [0, 0] })).resolves.toBe(true);
    expect(remote.createIntervention).toHaveBeenCalledTimes(1);
    expect(remote.appendLifecycleEvent).toHaveBeenCalledTimes(2);
    expect(listUnsyncedRole4Records(userId)).toEqual([]);
  });

  it("deduplicates concurrent sync requests and never synchronizes another user", async () => {
    const otherUser = "other-user";
    saveIntervention(userId, intervention);
    saveIntervention(otherUser, { ...intervention, id: "other-i", userId: otherUser });
    markRole4RecordUnsynced(userId, "interventions", intervention.id);
    markRole4RecordUnsynced(otherUser, "interventions", "other-i");
    const remote = { getIntervention: vi.fn().mockResolvedValue(null), createIntervention: vi.fn().mockResolvedValue(intervention) };
    const client = { auth: { getSession: async () => ({ data: { session: { user: { id: userId } } }, error: null }) } };

    await Promise.all([
      reconcileRole4Records(userId, { client, repository: remote, delays: [0] }),
      reconcileRole4Records(userId, { client, repository: remote, delays: [0] }),
    ]);
    expect(remote.createIntervention).toHaveBeenCalledTimes(1);
    expect(remote.createIntervention).not.toHaveBeenCalledWith(expect.objectContaining({ userId: otherUser }));
    expect(listUnsyncedRole4Records(otherUser)).toEqual([{ collection: "interventions", id: "other-i" }]);
  });
});
