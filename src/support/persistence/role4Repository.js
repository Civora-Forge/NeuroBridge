import {
  InterventionLifecycleEventSchema,
  InterventionOutcomeSchema,
  InterventionSchema,
  ReflectionSchema,
  UserMemorySchema,
} from "@/support/schemas/supportSchemas";
import {
  deleteRole4Record,
  getRole4Record,
  listInterventionLifecycleEvents,
  listInterventionOutcomes,
  listInterventions,
  listReflections,
  listUserMemories,
  saveIntervention,
  saveInterventionLifecycleEvent,
  saveInterventionOutcome,
  saveReflection,
  saveUserMemory,
  clearUnsyncedRole4Record,
  listUnsyncedRole4Records,
  markRole4RecordUnsynced,
} from "./role4Store";
import { ROLE4_COLLECTIONS } from "@/support/schemas/storageKeys";
import { supabase } from "@/lib/supabaseClient";

const TABLES = {
  interventions: "support_interventions",
  lifecycleEvents: "support_lifecycle_events",
  outcomes: "support_outcomes",
  reflections: "support_reflections",
  memories: "support_memories",
};
const degradedSupabaseUsers = new Set();
const activeSynchronizations = new Map();
const onlineListeners = new Set();
const nextScheduledSyncAt = new Map();
const SYNC_DELAYS_MS = [0, 250, 1000];
const FAILED_SYNC_COOLDOWN_MS = 5000;

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

export function reflectionToRow(record) {
  return omitUndefined({ id: record.id, schema_version: record.schemaVersion, user_id: record.userId, intervention_id: record.interventionId, module_id: record.moduleId, reflection_id: record.reflectionId, timestamp: record.timestamp, version: record.version, reflection_version: record.reflectionVersion, outcome_summary: record.outcomeSummary, insights: record.insights, summary: record.summary, key_insights: record.keyInsights, follow_up_suggestions: record.followUpSuggestions, confidence: record.confidence, metadata: record.metadata, evidence_outcome_ids: record.evidenceOutcomeIds, privacy: record.privacy, source: record.source, created_at: record.createdAt, updated_at: record.updatedAt });
}

export function reflectionFromRow(row) {
  return ReflectionSchema.parse({ id: row.id, schemaVersion: row.schema_version, userId: row.user_id, interventionId: optional(row.intervention_id), moduleId: optional(row.module_id), reflectionId: optional(row.reflection_id), timestamp: optional(row.timestamp), version: row.version, reflectionVersion: row.reflection_version, outcomeSummary: optional(row.outcome_summary), insights: row.insights, summary: row.summary, keyInsights: row.key_insights, followUpSuggestions: row.follow_up_suggestions, confidence: row.confidence, metadata: row.metadata, evidenceOutcomeIds: row.evidence_outcome_ids, privacy: row.privacy, source: row.source, createdAt: row.created_at, updatedAt: row.updated_at });
}

export function memoryToRow(record) {
  return omitUndefined({ id: record.id, schema_version: record.schemaVersion, user_id: record.userId, memory_id: record.memoryId, module_id: record.moduleId, category: record.category, type: record.type, key: record.key, value: record.value, evidence_count: record.evidenceCount, supporting_reflection_ids: record.supportingReflectionIds, confidence: record.confidence, confidence_level: record.confidenceLevel, first_observed_at: record.firstObservedAt, last_updated_at: record.lastUpdatedAt, version: record.version, status: record.status, contradiction_count: record.contradictionCount, metadata: record.metadata, deleted_at: record.deletedAt, privacy: record.privacy, source: record.source, evidence_ids: record.evidenceIds, expires_at: record.expiresAt, archived_at: record.archivedAt, created_at: record.createdAt, updated_at: record.updatedAt });
}

export function memoryFromRow(row) {
  return UserMemorySchema.parse({ id: row.id, schemaVersion: row.schema_version, userId: row.user_id, memoryId: optional(row.memory_id), moduleId: optional(row.module_id), category: optional(row.category), type: row.type, key: row.key, value: row.value, evidenceCount: optional(row.evidence_count), supportingReflectionIds: row.supporting_reflection_ids, confidence: row.confidence, confidenceLevel: optional(row.confidence_level), firstObservedAt: optional(row.first_observed_at), lastUpdatedAt: optional(row.last_updated_at), version: row.version, status: row.status, contradictionCount: row.contradiction_count, metadata: row.metadata, deletedAt: optional(row.deleted_at), privacy: row.privacy, source: row.source, evidenceIds: row.evidence_ids, expiresAt: optional(row.expires_at), archivedAt: optional(row.archived_at), createdAt: row.created_at, updatedAt: row.updated_at });
}

function throwIfError(error) {
  if (error) throw new Error(`Role 4 Supabase persistence failed: ${error.message}`);
}

export function createLocalRole4Repository() {
  return {
    kind: "local",
    getPersistenceState: (userId) => ({ state: "local_only", unsyncedRecords: listUnsyncedRole4Records(userId) }),
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
    upsertReflection: async (record) => saveReflection(record.userId, record),
    upsertMemory: async (record) => saveUserMemory(record.userId, record),
    listInterventions: async (userId) => listInterventions(userId),
    listInterventionsByModule: async (userId, moduleId) => listInterventions(userId).filter((record) => record.moduleId === moduleId),
    listLifecycleEvents: async (userId, interventionId) => listInterventionLifecycleEvents(userId).filter((record) => !interventionId || record.interventionId === interventionId),
    listOutcomes: async (userId, interventionId) => listInterventionOutcomes(userId).filter((record) => !interventionId || record.interventionId === interventionId),
    listReflections: async (userId, moduleId) => listReflections(userId).filter((record) => !moduleId || record.moduleId === moduleId),
    listMemories: async (userId, moduleId) => listUserMemories(userId).filter((record) => !moduleId || record.moduleId === moduleId),
  };
}

export function createSupabaseRole4Repository(client = supabase) {
  return {
    kind: "supabase",
    getPersistenceState: () => ({ state: "remote", unsyncedRecords: [] }),
    async createIntervention(record) { const { data, error } = await client.from(TABLES.interventions).insert(interventionToRow(record)).select().single(); throwIfError(error); return interventionFromRow(data); },
    async getIntervention(userId, id) { const { data, error } = await client.from(TABLES.interventions).select("*").eq("user_id", userId).eq("id", id).maybeSingle(); throwIfError(error); return data ? interventionFromRow(data) : null; },
    async updateIntervention(record) { const { data, error } = await client.from(TABLES.interventions).update(interventionToRow(record)).eq("user_id", record.userId).eq("id", record.id).select().single(); throwIfError(error); return interventionFromRow(data); },
    async deleteIntervention(userId, id) { const { error, count } = await client.from(TABLES.interventions).delete({ count: "exact" }).eq("user_id", userId).eq("id", id); throwIfError(error); return count > 0; },
    async appendLifecycleEvent(record) { const { data: existing, error: readError } = await client.from(TABLES.lifecycleEvents).select("*").eq("user_id", record.userId).eq("id", record.id).maybeSingle(); throwIfError(readError); if (existing) return lifecycleEventFromRow(existing); const { data, error } = await client.from(TABLES.lifecycleEvents).insert(lifecycleEventToRow(record)).select().single(); throwIfError(error); return lifecycleEventFromRow(data); },
    async appendOutcome(record) { const { data: existing, error: readError } = await client.from(TABLES.outcomes).select("*").eq("user_id", record.userId).eq("id", record.id).maybeSingle(); throwIfError(readError); if (existing) return outcomeFromRow(existing); const { data, error } = await client.from(TABLES.outcomes).insert(outcomeToRow(record)).select().single(); throwIfError(error); return outcomeFromRow(data); },
    async updateOutcome(record) { const { data, error } = await client.from(TABLES.outcomes).update(outcomeToRow(record)).eq("user_id", record.userId).eq("id", record.id).select().single(); throwIfError(error); return outcomeFromRow(data); },
    async upsertReflection(record) { const { data, error } = await client.from(TABLES.reflections).upsert(reflectionToRow(record), { onConflict: "id,user_id" }).select().single(); throwIfError(error); return reflectionFromRow(data); },
    async upsertMemory(record) { const { data, error } = await client.from(TABLES.memories).upsert(memoryToRow(record), { onConflict: "id,user_id" }).select().single(); throwIfError(error); return memoryFromRow(data); },
    async listInterventions(userId) { const { data, error } = await client.from(TABLES.interventions).select("*").eq("user_id", userId).order("created_at", { ascending: false }); throwIfError(error); return data.map(interventionFromRow); },
    async listInterventionsByModule(userId, moduleId) { const { data, error } = await client.from(TABLES.interventions).select("*").eq("user_id", userId).eq("module_id", moduleId).order("created_at", { ascending: false }); throwIfError(error); return data.map(interventionFromRow); },
    async listLifecycleEvents(userId, interventionId) { let query = client.from(TABLES.lifecycleEvents).select("*").eq("user_id", userId).order("created_at", { ascending: false }); if (interventionId) query = query.eq("intervention_id", interventionId); const { data, error } = await query; throwIfError(error); return data.map(lifecycleEventFromRow); },
    async listOutcomes(userId, interventionId) { let query = client.from(TABLES.outcomes).select("*").eq("user_id", userId).order("created_at", { ascending: false }); if (interventionId) query = query.eq("intervention_id", interventionId); const { data, error } = await query; throwIfError(error); return data.map(outcomeFromRow); },
    async listReflections(userId, moduleId) { let query = client.from(TABLES.reflections).select("*").eq("user_id", userId).order("created_at", { ascending: false }); if (moduleId) query = query.eq("module_id", moduleId); const { data, error } = await query; throwIfError(error); return data.map(reflectionFromRow); },
    async listMemories(userId, moduleId) { let query = client.from(TABLES.memories).select("*").eq("user_id", userId).order("created_at", { ascending: false }); if (moduleId) query = query.eq("module_id", moduleId); const { data, error } = await query; throwIfError(error); return data.map(memoryFromRow); },
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
    "upsertReflection",
    "upsertMemory",
  ]);
  const collectionForMethod = {
    createIntervention: ROLE4_COLLECTIONS.INTERVENTIONS,
    updateIntervention: ROLE4_COLLECTIONS.INTERVENTIONS,
    deleteIntervention: ROLE4_COLLECTIONS.INTERVENTIONS,
    appendLifecycleEvent: ROLE4_COLLECTIONS.LIFECYCLE_EVENTS,
    appendOutcome: ROLE4_COLLECTIONS.OUTCOMES,
    updateOutcome: ROLE4_COLLECTIONS.OUTCOMES,
    upsertReflection: ROLE4_COLLECTIONS.REFLECTIONS,
    upsertMemory: ROLE4_COLLECTIONS.MEMORIES,
  };
  const markUnsynced = (method, args) => {
    if (!mutations.has(method)) return;
    const [first, second] = args;
    const userId = typeof first === "string" ? first : first?.userId;
    const id = method === "deleteIntervention" ? second : first?.id;
    if (userId && id) markRole4RecordUnsynced(userId, collectionForMethod[method], id);
  };
  const call = (method) => async (...args) => {
    if (useLocal) {
      markUnsynced(method, args);
      return local[method](...args);
    }
    try {
      const result = await remote[method](...args);
      // Mirror successful writes so a later fallback retains this session's history.
      if (mutations.has(method)) {
        try {
          await local[method](...args);
        } catch {
          // Remote already committed; a local cache failure must not degrade the live repository.
        }
      }
      return result;
    } catch {
      // Keep a single session coherent once its remote connection has failed.
      useLocal = true;
      onFallback();
      markUnsynced(method, args);
      return local[method](...args);
    }
  };

  return {
    kind: "supabase",
    getPersistenceState: (userId) => ({ state: useLocal ? "unsynced_local" : "remote", unsyncedRecords: useLocal ? listUnsyncedRole4Records(userId) : [] }),
    createIntervention: call("createIntervention"),
    getIntervention: call("getIntervention"),
    updateIntervention: call("updateIntervention"),
    deleteIntervention: call("deleteIntervention"),
    appendLifecycleEvent: call("appendLifecycleEvent"),
    appendOutcome: call("appendOutcome"),
    updateOutcome: call("updateOutcome"),
    upsertReflection: call("upsertReflection"),
    upsertMemory: call("upsertMemory"),
    listInterventions: call("listInterventions"),
    listInterventionsByModule: call("listInterventionsByModule"),
    listLifecycleEvents: call("listLifecycleEvents"),
    listOutcomes: call("listOutcomes"),
    listReflections: call("listReflections"),
    listMemories: call("listMemories"),
  };
}

function createUnsyncedLocalRole4Repository() {
  const local = createLocalRole4Repository();
  const mutationCollections = {
    createIntervention: ROLE4_COLLECTIONS.INTERVENTIONS, updateIntervention: ROLE4_COLLECTIONS.INTERVENTIONS,
    deleteIntervention: ROLE4_COLLECTIONS.INTERVENTIONS, appendLifecycleEvent: ROLE4_COLLECTIONS.LIFECYCLE_EVENTS,
    appendOutcome: ROLE4_COLLECTIONS.OUTCOMES, updateOutcome: ROLE4_COLLECTIONS.OUTCOMES,
    upsertReflection: ROLE4_COLLECTIONS.REFLECTIONS, upsertMemory: ROLE4_COLLECTIONS.MEMORIES,
  };
  const tracked = { ...local, getPersistenceState: (userId) => ({ state: "unsynced_local", unsyncedRecords: listUnsyncedRole4Records(userId) }) };
  Object.entries(mutationCollections).forEach(([method, collection]) => {
    tracked[method] = async (...args) => {
      const [first, second] = args;
      const userId = typeof first === "string" ? first : first?.userId;
      const id = method === "deleteIntervention" ? second : first?.id;
      if (userId && id) markRole4RecordUnsynced(userId, collection, id);
      return local[method](...args);
    };
  });
  return tracked;
}

export async function getRole4Repository(userId, { client = supabase } = {}) {
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.user?.id || data.session.user.id !== userId) return createLocalRole4Repository();
  if (degradedSupabaseUsers.has(userId)) {
    scheduleRole4Reconciliation(userId, { client });
    return createUnsyncedLocalRole4Repository();
  }
  scheduleRole4Reconciliation(userId, { client });
  return createSupabaseFallbackRole4Repository(
    createSupabaseRole4Repository(client),
    createLocalRole4Repository(),
    () => degradedSupabaseUsers.add(userId),
  );
}

function wait(delayMs) {
  return delayMs ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve();
}

function localRecord(userId, collection, id) {
  return getRole4Record(userId, collection, id);
}

async function syncPendingRecord(repository, userId, pending) {
  const record = localRecord(userId, pending.collection, pending.id);
  if (pending.collection === ROLE4_COLLECTIONS.INTERVENTIONS) {
    if (!record) return repository.deleteIntervention(userId, pending.id);
    const existing = await repository.getIntervention(userId, pending.id);
    return existing ? repository.updateIntervention(record) : repository.createIntervention(record);
  }
  if (!record) return true;
  if (pending.collection === ROLE4_COLLECTIONS.LIFECYCLE_EVENTS) return repository.appendLifecycleEvent(record);
  if (pending.collection === ROLE4_COLLECTIONS.OUTCOMES) return repository.appendOutcome(record);
  if (pending.collection === ROLE4_COLLECTIONS.REFLECTIONS) return repository.upsertReflection(record);
  if (pending.collection === ROLE4_COLLECTIONS.MEMORIES) return repository.upsertMemory(record);
  return true;
}

function orderedPendingRecords(userId) {
  const order = [
    ROLE4_COLLECTIONS.INTERVENTIONS,
    ROLE4_COLLECTIONS.LIFECYCLE_EVENTS,
    ROLE4_COLLECTIONS.OUTCOMES,
    ROLE4_COLLECTIONS.REFLECTIONS,
    ROLE4_COLLECTIONS.MEMORIES,
  ];
  return listUnsyncedRole4Records(userId).sort((left, right) => order.indexOf(left.collection) - order.indexOf(right.collection));
}

export function reconcileRole4Records(userId, { client = supabase, delays = SYNC_DELAYS_MS, repository: suppliedRepository } = {}) {
  if (activeSynchronizations.has(userId)) return activeSynchronizations.get(userId);
  const synchronization = (async () => {
    const { data, error } = await client.auth.getSession();
    if (error || data?.session?.user?.id !== userId) return false;
    const repository = suppliedRepository || createSupabaseRole4Repository(client);
    for (const delay of delays) {
      await wait(delay);
      let failed = false;
      for (const pending of orderedPendingRecords(userId)) {
        try {
          await syncPendingRecord(repository, userId, pending);
          clearUnsyncedRole4Record(userId, pending.collection, pending.id);
        } catch {
          failed = true;
          break;
        }
      }
      if (!failed && listUnsyncedRole4Records(userId).length === 0) {
        degradedSupabaseUsers.delete(userId);
        return true;
      }
    }
    return false;
  })().finally(() => activeSynchronizations.delete(userId));
  activeSynchronizations.set(userId, synchronization);
  return synchronization;
}

function scheduleRole4Reconciliation(userId, options) {
  const schedule = (force = false) => {
    if (!listUnsyncedRole4Records(userId).length || (!force && Date.now() < (nextScheduledSyncAt.get(userId) ?? 0))) return;
    void reconcileRole4Records(userId, options).then((synced) => {
      if (synced) nextScheduledSyncAt.delete(userId);
      else nextScheduledSyncAt.set(userId, Date.now() + FAILED_SYNC_COOLDOWN_MS);
    });
  };
  schedule();
  if (typeof window !== "undefined" && !onlineListeners.has(userId)) {
    onlineListeners.add(userId);
    window.addEventListener("online", () => schedule(true));
  }
}

export async function mirrorRole4Records(userId, records = {}, { client = supabase } = {}) {
  try {
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.user?.id || data.session.user.id !== userId) return false;
    const repository = createSupabaseRole4Repository(client);
    for (const record of records.interventions ?? []) await repository.updateIntervention(record);
    for (const record of records.newInterventions ?? []) await repository.createIntervention(record);
    for (const record of records.lifecycleEvents ?? []) await repository.appendLifecycleEvent(record);
    for (const record of records.outcomes ?? []) await repository.appendOutcome(record);
    for (const record of records.reflections ?? []) await repository.upsertReflection(record);
    for (const record of records.memories ?? []) await repository.upsertMemory(record);
    [
      [ROLE4_COLLECTIONS.INTERVENTIONS, [...(records.interventions ?? []), ...(records.newInterventions ?? [])]],
      [ROLE4_COLLECTIONS.LIFECYCLE_EVENTS, records.lifecycleEvents ?? []],
      [ROLE4_COLLECTIONS.OUTCOMES, records.outcomes ?? []],
      [ROLE4_COLLECTIONS.REFLECTIONS, records.reflections ?? []],
      [ROLE4_COLLECTIONS.MEMORIES, records.memories ?? []],
    ].forEach(([collection, entries]) => entries.forEach((record) => clearUnsyncedRole4Record(userId, collection, record.id)));
    return true;
  } catch {
    return false;
  }
}

export async function getRole4InterventionHistory(userId, filters = {}, options = {}) {
  const repository = options.repository || await getRole4Repository(userId, options);
  const interventions = filters.moduleId
    ? await repository.listInterventionsByModule(userId, filters.moduleId)
    : await repository.listInterventions(userId);
  const filtered = interventions.filter((item) => (!filters.interventionType || item.interventionType === filters.interventionType) && (!filters.status || item.status === filters.status));
  const entries = await Promise.all(filtered.map(async (intervention) => ({ intervention, lifecycleEvents: await repository.listLifecycleEvents(userId, intervention.id), outcomes: await repository.listOutcomes(userId, intervention.id) })));
  return entries;
}

export const getInterventionHistory = getRole4InterventionHistory;
