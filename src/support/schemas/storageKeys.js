export const ROLE4_SCHEMA_VERSION = 1;

export const ROLE4_STORAGE_PREFIX = "nb_role4";

export const ROLE4_COLLECTIONS = {
  INTERVENTIONS: "interventions",
  LIFECYCLE_EVENTS: "lifecycle_events",
  OUTCOMES: "outcomes",
  REFLECTIONS: "reflections",
  MEMORIES: "memories",
  PERSONALIZATION_PROFILES: "personalization_profiles",
  MIGRATIONS: "migrations",
};

export const LEGACY_MEMORY_KEYS = {
  PREFERENCES: "nb_memory_preferences",
  STRATEGIES: "nb_memory_strategies",
  PATTERNS: "nb_memory_patterns",
  INTERACTION_HISTORY: "nb_memory_interactions",
};

const KNOWN_COLLECTIONS = new Set(Object.values(ROLE4_COLLECTIONS));

export function normalizeUserId(userId) {
  const normalized = String(userId ?? "").trim();
  if (!normalized) {
    throw new Error("Role 4 records require a non-empty userId");
  }
  return normalized;
}

export function encodeStorageId(value) {
  return encodeURIComponent(normalizeUserId(value));
}

export function getRole4StorageKey(userId, collection) {
  if (!KNOWN_COLLECTIONS.has(collection)) {
    throw new Error(`Unknown Role 4 collection: ${collection}`);
  }
  return `${ROLE4_STORAGE_PREFIX}:v${ROLE4_SCHEMA_VERSION}:${encodeStorageId(userId)}:${collection}`;
}

export function getRole4MigrationKey(userId, migrationId) {
  const normalizedMigrationId = String(migrationId ?? "").trim();
  if (!normalizedMigrationId) {
    throw new Error("Migration id is required");
  }
  return `${getRole4StorageKey(userId, ROLE4_COLLECTIONS.MIGRATIONS)}:${normalizedMigrationId}`;
}
