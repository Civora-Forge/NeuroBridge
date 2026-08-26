import {
  InterventionLifecycleEventSchema,
  InterventionOutcomeSchema,
  InterventionSchema,
} from "@/support/schemas/supportSchemas";
import {
  deleteRole4Record,
  getRole4Record,
  listInterventionLifecycleEvents,
  listInterventionOutcomes,
  listInterventions,
  saveIntervention,
  saveInterventionLifecycleEvent,
  saveInterventionOutcome,
} from "./role4Store";
import { supabase } from "@/lib/supabaseClient";

const TABLES = {
  interventions: "support_interventions",
  lifecycleEvents: "support_lifecycle_events",
  outcomes: "support_outcomes",
};
const degradedSupabaseUsers = new Set();

function omitUndefined(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function optional(value) {
  return value === null ? undefined : value;
}

export function interventionToRow(record) {
  return omitUndefined({ id: record.id, schema_version: record.schemaVersion, user_id: record.userId, module_id: record.moduleId, intervention_type: record.interventionType, category: record.category, status: record.status, title: record.title, description: record.description, route: record.route, source: record.source, privacy: record.privacy, tags: record.tags, parameters: record.parameters, rationale: record.rationale, context_snapshot: record.contextSnapshot, created_at: record.createdAt, updated_at: record.updatedAt });
}

export function interventionFromRow(row) {
  return InterventionSchema.parse({ id: row.id, schemaVersion: row.schema_version, userId: row.user_id, moduleId: row.module_id, interventionType: row.intervention_type, category: row.category, status: row.status, title: row.title, description: optional(row.description), route: optional(row.route), source: row.source, privacy: row.privacy, tags: row.tags, parameters: row.parameters, rationale: optional(row.rationale), contextSnapshot: optional(row.context_snapshot), createdAt: row.created_at, updatedAt: row.updated_at });
}

export function lifecycleEventToRow(record) {
  return omitUndefined({ id: record.id, schema_version: record.schemaVersion, user_id: record.userId, intervention_id: record.interventionId, module_id: record.moduleId, intervention_type: record.interventionType, from_status: record.fromStatus, to_status: record.toStatus, source: record.source, privacy: record.privacy, reason: record.reason, metadata: record.metadata, context_snapshot: record.contextSnapshot, created_at: record.createdAt, updated_at: record.updatedAt });
}

export function lifecycleEventFromRow(row) {
  return InterventionLifecycleEventSchema.parse({ id: row.id, schemaVersion: row.schema_version, userId: row.user_id, interventionId: row.intervention_id, moduleId: row.module_id, interventionType: row.intervention_type, fromStatus: row.from_status, toStatus: row.to_status, source: row.source, privacy: row.privacy, reason: optional(row.reason), metadata: row.metadata, contextSnapshot: optional(row.context_snapshot), createdAt: row.created_at, updatedAt: row.updated_at });
}

export function outcomeToRow(record) {
  return omitUndefined({ id: record.id, schema_version: record.schemaVersion, user_id: record.userId, intervention_id: record.interventionId, module_id: record.moduleId, intervention_type: record.interventionType, category: record.category, status: record.status, source: record.source, privacy: record.privacy, accepted: record.accepted, completed: record.completed, duration_ms: record.durationMs, rating: record.rating, user_feedback: record.userFeedback, metrics: record.metrics, context_snapshot: record.contextSnapshot, created_at: record.createdAt, updated_at: record.updatedAt });
}

export function outcomeFromRow(row) {
  return InterventionOutcomeSchema.parse({ id: row.id, schemaVersion: row.schema_version, userId: row.user_id, interventionId: row.intervention_id, moduleId: row.module_id, interventionType: row.intervention_type, category: row.category, status: row.status, source: row.source, privacy: row.privacy, accepted: optional(row.accepted), completed: optional(row.completed), durationMs: optional(row.duration_ms), rating: optional(row.rating), userFeedback: optional(row.user_feedback), metrics: row.metrics, contextSnapshot: optional(row.context_snapshot), createdAt: row.created_at, updatedAt: row.updated_at });
}

function throwIfError(error) {
  if (error) throw new Error(`Role 4 Supabase persistence failed: ${error.message}`);
}

export function createLocalRole4Repository() {
  return {
    kind: "local",
    createIntervention: async (record) => saveIntervention(record.userId, record),
    getIntervention: async (userId, id) => getRole4Record(userId, "interventions", id),
    updateIntervention: async (record) => saveIntervention(record.userId, record),
    deleteIntervention: async (userId, id) => deleteRole4Record(userId, "interventions", id),
    appendLifecycleEvent: async (record) => {
      if (listInterventionLifecycleEvents(record.userId).some((item) => item.id === record.id)) throw new Error("Lifecycle events are append-only");
      return saveInterventionLifecycleEvent(record.userId, record);
    },
    appendOutcome: async (record) => {
      if (listInterventionOutcomes(record.userId).some((item) => item.id === record.id)) throw new Error("Outcomes are append-only");
      return saveInterventionOutcome(record.userId, record);
    },
    updateOutcome: async (record) => saveInterventionOutcome(record.userId, record),
    listInterventions: async (userId) => listInterventions(userId),
    listLifecycleEvents: async (userId, interventionId) => listInterventionLifecycleEvents(userId).filter((record) => !interventionId || record.interventionId === interventionId),
    listOutcomes: async (userId, interventionId) => listInterventionOutcomes(userId).filter((record) => !interventionId || record.interventionId === interventionId),
  };
}

export function createSupabaseRole4Repository(client = supabase) {
  return {
    kind: "supabase",
    async createIntervention(record) { const { data, error } = await client.from(TABLES.interventions).insert(interventionToRow(record)).select().single(); throwIfError(error); return interventionFromRow(data); },
    async getIntervention(userId, id) { const { data, error } = await client.from(TABLES.interventions).select("*").eq("user_id", userId).eq("id", id).maybeSingle(); throwIfError(error); return data ? interventionFromRow(data) : null; },
    async updateIntervention(record) { const { data, error } = await client.from(TABLES.interventions).update(interventionToRow(record)).eq("user_id", record.userId).eq("id", record.id).select().single(); throwIfError(error); return interventionFromRow(data); },
    async deleteIntervention(userId, id) { const { error, count } = await client.from(TABLES.interventions).delete({ count: "exact" }).eq("user_id", userId).eq("id", id); throwIfError(error); return count > 0; },
    async appendLifecycleEvent(record) { const { data, error } = await client.from(TABLES.lifecycleEvents).insert(lifecycleEventToRow(record)).select().single(); throwIfError(error); return lifecycleEventFromRow(data); },
    async appendOutcome(record) { const { data, error } = await client.from(TABLES.outcomes).insert(outcomeToRow(record)).select().single(); throwIfError(error); return outcomeFromRow(data); },
    async updateOutcome(record) { const { data, error } = await client.from(TABLES.outcomes).update(outcomeToRow(record)).eq("user_id", record.userId).eq("id", record.id).select().single(); throwIfError(error); return outcomeFromRow(data); },
    async listInterventions(userId) { const { data, error } = await client.from(TABLES.interventions).select("*").eq("user_id", userId).order("created_at", { ascending: false }); throwIfError(error); return data.map(interventionFromRow); },
    async listLifecycleEvents(userId, interventionId) { let query = client.from(TABLES.lifecycleEvents).select("*").eq("user_id", userId).order("created_at", { ascending: false }); if (interventionId) query = query.eq("intervention_id", interventionId); const { data, error } = await query; throwIfError(error); return data.map(lifecycleEventFromRow); },
    async listOutcomes(userId, interventionId) { let query = client.from(TABLES.outcomes).select("*").eq("user_id", userId).order("created_at", { ascending: false }); if (interventionId) query = query.eq("intervention_id", interventionId); const { data, error } = await query; throwIfError(error); return data.map(outcomeFromRow); },
  };
}

export function createSupabaseFallbackRole4Repository(remote, local = createLocalRole4Repository(), onFallback = () => {}) {
  let useLocal = false;
  const mutations = new Set([
    "createIntervention",
    "updateIntervention",
    "deleteIntervention",
    "appendLifecycleEvent",
    "appendOutcome",
    "updateOutcome",
  ]);
  const call = (method) => async (...args) => {
    if (useLocal) return local[method](...args);
    try {
      const result = await remote[method](...args);
      // Mirror successful writes so a later fallback retains this session's history.
      if (mutations.has(method)) await local[method](...args);
      return result;
    } catch {
      // Keep a single session coherent once its remote connection has failed.
      useLocal = true;
      onFallback();
      return local[method](...args);
    }
  };

  return {
    kind: "supabase",
    createIntervention: call("createIntervention"),
    getIntervention: call("getIntervention"),
    updateIntervention: call("updateIntervention"),
    deleteIntervention: call("deleteIntervention"),
    appendLifecycleEvent: call("appendLifecycleEvent"),
    appendOutcome: call("appendOutcome"),
    updateOutcome: call("updateOutcome"),
    listInterventions: call("listInterventions"),
    listLifecycleEvents: call("listLifecycleEvents"),
    listOutcomes: call("listOutcomes"),
  };
}

export async function getRole4Repository(userId, { client = supabase } = {}) {
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.user?.id || data.session.user.id !== userId) return createLocalRole4Repository();
  if (degradedSupabaseUsers.has(userId)) return createLocalRole4Repository();
  return createSupabaseFallbackRole4Repository(
    createSupabaseRole4Repository(client),
    createLocalRole4Repository(),
    () => degradedSupabaseUsers.add(userId),
  );
}

export async function getRole4InterventionHistory(userId, filters = {}, options) {
  const repository = await getRole4Repository(userId, options);
  const interventions = await repository.listInterventions(userId);
  const filtered = interventions.filter((item) => (!filters.moduleId || item.moduleId === filters.moduleId) && (!filters.interventionType || item.interventionType === filters.interventionType) && (!filters.status || item.status === filters.status));
  const entries = await Promise.all(filtered.map(async (intervention) => ({ intervention, lifecycleEvents: await repository.listLifecycleEvents(userId, intervention.id), outcomes: await repository.listOutcomes(userId, intervention.id) })));
  return entries;
}

// Async repository history is used for reloading durable Focus Session data.
export const getInterventionHistory = getRole4InterventionHistory;
