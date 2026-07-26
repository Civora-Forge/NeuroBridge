import {
  InterventionSchema,
  InterventionLifecycleEventSchema,
  InterventionOutcomeSchema,
  PersonalizationProfileSchema,
  ReflectionSchema,
  UserMemorySchema,
} from "@/support/schemas/supportSchemas";
import { getRole4StorageKey, ROLE4_COLLECTIONS, normalizeUserId } from "@/support/schemas/storageKeys";

const COLLECTION_SCHEMAS = {
  [ROLE4_COLLECTIONS.INTERVENTIONS]: InterventionSchema,
  [ROLE4_COLLECTIONS.LIFECYCLE_EVENTS]: InterventionLifecycleEventSchema,
  [ROLE4_COLLECTIONS.OUTCOMES]: InterventionOutcomeSchema,
  [ROLE4_COLLECTIONS.REFLECTIONS]: ReflectionSchema,
  [ROLE4_COLLECTIONS.MEMORIES]: UserMemorySchema,
  [ROLE4_COLLECTIONS.PERSONALIZATION_PROFILES]: PersonalizationProfileSchema,
};

function getStorage() {
  if (typeof localStorage === "undefined") {
    throw new Error("Role 4 persistence requires localStorage in the current environment");
  }
  return localStorage;
}

function readCollection(userId, collection) {
  const storage = getStorage();
  const key = getRole4StorageKey(userId, collection);
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCollection(userId, collection, records) {
  const storage = getStorage();
  const key = getRole4StorageKey(userId, collection);
  storage.setItem(key, JSON.stringify(records));
}

function validateCollectionRecord(collection, record) {
  const schema = COLLECTION_SCHEMAS[collection];
  if (!schema) {
    throw new Error(`Unknown Role 4 collection: ${collection}`);
  }
  return schema.parse(record);
}

function ensureRecordBelongsToUser(userId, record) {
  const normalizedUserId = normalizeUserId(userId);
  if (record.userId !== normalizedUserId) {
    throw new Error(`Record userId '${record.userId}' does not match storage userId '${normalizedUserId}'`);
  }
}

export function listRole4Records(userId, collection) {
  const records = readCollection(userId, collection);
  const schema = COLLECTION_SCHEMAS[collection];
  if (!schema) {
    throw new Error(`Unknown Role 4 collection: ${collection}`);
  }
  return records
    .map((record) => schema.safeParse(record))
    .filter((result) => result.success)
    .map((result) => result.data)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

export function getRole4Record(userId, collection, id) {
  const recordId = String(id ?? "").trim();
  if (!recordId) {
    throw new Error("Record id is required");
  }
  return listRole4Records(userId, collection).find((record) => record.id === recordId) ?? null;
}

export function saveRole4Record(userId, collection, record) {
  const normalizedUserId = normalizeUserId(userId);
  const parsed = validateCollectionRecord(collection, {
    ...record,
    userId: record.userId ?? normalizedUserId,
  });
  ensureRecordBelongsToUser(normalizedUserId, parsed);

  const records = readCollection(normalizedUserId, collection);
  const existingIndex = records.findIndex((item) => item?.id === parsed.id);
  const next =
    existingIndex >= 0
      ? records.map((item, index) => (index === existingIndex ? parsed : item))
      : [parsed, ...records];

  writeCollection(normalizedUserId, collection, next);
  return parsed;
}

export function deleteRole4Record(userId, collection, id) {
  const recordId = String(id ?? "").trim();
  if (!recordId) {
    throw new Error("Record id is required");
  }
  const records = readCollection(userId, collection);
  const next = records.filter((record) => record?.id !== recordId);
  writeCollection(userId, collection, next);
  return records.length !== next.length;
}

export function clearRole4Collection(userId, collection) {
  writeCollection(userId, collection, []);
}

export function clearUserRole4Data(userId) {
  Object.values(ROLE4_COLLECTIONS)
    .filter((collection) => collection !== ROLE4_COLLECTIONS.MIGRATIONS)
    .forEach((collection) => clearRole4Collection(userId, collection));
}

export const saveIntervention = (userId, record) =>
  saveRole4Record(userId, ROLE4_COLLECTIONS.INTERVENTIONS, record);

export const listInterventions = (userId) =>
  listRole4Records(userId, ROLE4_COLLECTIONS.INTERVENTIONS);

export const saveInterventionLifecycleEvent = (userId, record) =>
  saveRole4Record(userId, ROLE4_COLLECTIONS.LIFECYCLE_EVENTS, record);

export const listInterventionLifecycleEvents = (userId) =>
  listRole4Records(userId, ROLE4_COLLECTIONS.LIFECYCLE_EVENTS);

export const saveInterventionOutcome = (userId, record) =>
  saveRole4Record(userId, ROLE4_COLLECTIONS.OUTCOMES, record);

export const listInterventionOutcomes = (userId) =>
  listRole4Records(userId, ROLE4_COLLECTIONS.OUTCOMES);

export const saveReflection = (userId, record) =>
  saveRole4Record(userId, ROLE4_COLLECTIONS.REFLECTIONS, record);

export const listReflections = (userId) =>
  listRole4Records(userId, ROLE4_COLLECTIONS.REFLECTIONS);

export const saveUserMemory = (userId, record) =>
  saveRole4Record(userId, ROLE4_COLLECTIONS.MEMORIES, record);

export const listUserMemories = (userId) =>
  listRole4Records(userId, ROLE4_COLLECTIONS.MEMORIES);

export const savePersonalizationProfile = (userId, record) =>
  saveRole4Record(userId, ROLE4_COLLECTIONS.PERSONALIZATION_PROFILES, record);

export const listPersonalizationProfiles = (userId) =>
  listRole4Records(userId, ROLE4_COLLECTIONS.PERSONALIZATION_PROFILES);
