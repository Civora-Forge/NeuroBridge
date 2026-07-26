import { saveUserMemory } from "@/support/persistence/role4Store";
import {
  LEGACY_MEMORY_KEYS,
  getRole4MigrationKey,
  normalizeUserId,
  ROLE4_SCHEMA_VERSION,
} from "@/support/schemas/storageKeys";
import { MemoryType, OutcomeSource, PrivacyLevel } from "@/support/schemas/supportSchemas";

function getStorage() {
  if (typeof localStorage === "undefined") {
    throw new Error("Role 4 migrations require localStorage in the current environment");
  }
  return localStorage;
}

function readJson(key, fallback) {
  try {
    const raw = getStorage().getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function hasRun(userId, migrationId) {
  return getStorage().getItem(getRole4MigrationKey(userId, migrationId)) === "complete";
}

function markRun(userId, migrationId) {
  getStorage().setItem(getRole4MigrationKey(userId, migrationId), "complete");
}

function saveMigratedMemory(userId, record) {
  return saveUserMemory(userId, {
    schemaVersion: ROLE4_SCHEMA_VERSION,
    privacy: PrivacyLevel.PRIVATE,
    source: OutcomeSource.IMPORTED_LEGACY,
    confidence: "moderate",
    ...record,
  });
}

export function migrateLegacyMemoryForUser(userId) {
  const normalizedUserId = normalizeUserId(userId);
  const migrationId = "legacy-memory-v1";
  if (hasRun(normalizedUserId, migrationId)) {
    return { migrated: false, recordsCreated: 0 };
  }

  let recordsCreated = 0;

  const preferences = readJson(LEGACY_MEMORY_KEYS.PREFERENCES, {});
  Object.entries(preferences).forEach(([key, entry]) => {
    saveMigratedMemory(normalizedUserId, {
      id: `legacy-pref-${key}`,
      userId: normalizedUserId,
      type: MemoryType.PREFERENCE,
      key,
      value: entry?.value ?? entry,
      createdAt: entry?.updatedAt || new Date().toISOString(),
      updatedAt: entry?.updatedAt || new Date().toISOString(),
    });
    recordsCreated += 1;
  });

  const strategies = readJson(LEGACY_MEMORY_KEYS.STRATEGIES, []);
  strategies.forEach((strategy, index) => {
    const interventionType = String(strategy?.interventionType || "unknown");
    saveMigratedMemory(normalizedUserId, {
      id: `legacy-strategy-${index}-${interventionType}`,
      userId: normalizedUserId,
      type: strategy?.successful ? MemoryType.SUCCESSFUL_STRATEGY : MemoryType.INEFFECTIVE_STRATEGY,
      key: interventionType,
      value: {
        interventionType,
        successful: Boolean(strategy?.successful),
        context: strategy?.context || {},
      },
      createdAt: strategy?.timestamp || new Date().toISOString(),
      updatedAt: strategy?.timestamp || new Date().toISOString(),
    });
    recordsCreated += 1;
  });

  const patterns = readJson(LEGACY_MEMORY_KEYS.PATTERNS, {});
  Object.entries(patterns).forEach(([patternType, entries]) => {
    (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
      saveMigratedMemory(normalizedUserId, {
        id: `legacy-pattern-${patternType}-${index}`,
        userId: normalizedUserId,
        type: MemoryType.INTERACTION_PATTERN,
        key: patternType,
        value: entry,
        createdAt: entry?.timestamp || new Date().toISOString(),
        updatedAt: entry?.timestamp || new Date().toISOString(),
      });
      recordsCreated += 1;
    });
  });

  markRun(normalizedUserId, migrationId);
  return { migrated: true, recordsCreated };
}

export function runRole4LocalMigrations({ userId }) {
  return {
    legacyMemory: migrateLegacyMemoryForUser(userId),
  };
}

