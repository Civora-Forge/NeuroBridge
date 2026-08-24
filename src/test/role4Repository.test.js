import { describe, expect, it, vi } from "vitest";
import {
  createLocalRole4Repository,
  createSupabaseFallbackRole4Repository,
  createSupabaseRole4Repository,
  getRole4Repository,
  interventionFromRow,
  interventionToRow,
  lifecycleEventFromRow,
  lifecycleEventToRow,
  outcomeFromRow,
  outcomeToRow,
} from "@/support/persistence/role4Repository";
import { completeFocusSessionIntervention, startFocusSessionIntervention } from "@/support/lifecycle/focusSessionLifecycle";
import { getSupportEvidenceAsync } from "@/support/evidence/supportEvidence";

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

  it("derives an advisory shorter Focus configuration from repository outcomes only", async () => {
    const outcomes = [1, 2, 3].map((id) => ({ ...outcome, id: `short-${id}`, interventionId: `focus-${id}`, createdAt: `2026-01-0${id}T00:00:00.000Z`, metrics: { plannedDurationMinutes: 15, completionRatio: 1, finalConfiguration: { plannedDurationMinutes: 15, breakDurationMinutes: 5 } } }));
    const repository = { listInterventions: async () => [], listLifecycleEvents: async () => outcomes.map((item) => ({ interventionId: item.interventionId, moduleId: item.moduleId, toStatus: "started" })), listOutcomes: async () => outcomes };
    const evidence = await getSupportEvidenceAsync(userId, ["support.focus_session"], { repository });
    expect(evidence.modules[0].preferredConfiguration).toMatchObject({ values: { plannedDurationMinutes: 15, breakDurationMinutes: 5 }, advisory: true });
  });
});
