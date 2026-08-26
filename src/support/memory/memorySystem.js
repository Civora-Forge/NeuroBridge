import {
  deleteRole4Record,
  getRole4Record,
  listReflections,
  listUserMemories as listStoredMemories,
  saveUserMemory,
} from "@/support/persistence/role4Store";
import { getRole4StorageKey, normalizeUserId, ROLE4_COLLECTIONS } from "@/support/schemas/storageKeys";
import { MemoryType, OutcomeSource, PrivacyLevel } from "@/support/schemas/supportSchemas";
import { getModuleMemoryRule } from "./memoryRegistry";
import {
  confidenceForEvidence,
  confidenceLevel,
  MEMORY_VERSION,
  MemoryStatus,
  SUPPORTED_REFLECTION_VERSION,
} from "./memoryTypes";

function learningKey(userId) {
  return `${getRole4StorageKey(userId, ROLE4_COLLECTIONS.MEMORIES)}:learning_enabled`;
}

function memoryId(moduleId, category, key) {
  return `memory-${moduleId}-${category}-${key}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function memoryType(category) {
  if (category === "preferred_configuration") return MemoryType.PREFERENCE;
  if (category === "successful_strategy") return MemoryType.SUCCESSFUL_STRATEGY;
  if (category === "unsuccessful_configuration") return MemoryType.INEFFECTIVE_STRATEGY;
  return MemoryType.LEARNING_PATTERN;
}

function supportedReflection(reflection, moduleId) {
  return reflection.moduleId === moduleId
    && reflection.version === SUPPORTED_REFLECTION_VERSION
    && reflection.reflectionVersion === SUPPORTED_REFLECTION_VERSION;
}

function candidatesFromObservations(observations) {
  const groups = new Map();
  observations.forEach((observation) => {
    const groupKey = `${observation.category}:${observation.key}`;
    const group = groups.get(groupKey) ?? [];
    group.push(observation);
    groups.set(groupKey, group);
  });
  return [...groups.values()].flatMap((group) => {
    const byValue = new Map();
    group.forEach((observation) => {
      const bucket = byValue.get(observation.value) ?? [];
      bucket.push(observation);
      byValue.set(observation.value, bucket);
    });
    const [value, supporting] = [...byValue.entries()].sort((left, right) =>
      right[1].length - left[1].length || String(left[0]).localeCompare(String(right[0])),
    )[0];
    if (supporting.length < 2) return [];
    const allReflectionIds = [...new Set(group.map((item) => item.reflectionId))].sort();
    const supportingReflectionIds = [...new Set(supporting.map((item) => item.reflectionId))].sort();
    return [{
      category: supporting[0].category,
      key: supporting[0].key,
      value,
      evidenceCount: supportingReflectionIds.length,
      contradictionCount: allReflectionIds.length - supportingReflectionIds.length,
      supportingReflectionIds,
      observedReflectionIds: allReflectionIds,
      firstObservedAt: supporting.map((item) => item.timestamp).sort()[0],
      lastUpdatedAt: supporting.map((item) => item.timestamp).sort().at(-1),
    }];
  });
}

export function isLearningEnabled(userId) {
  const normalizedUserId = normalizeUserId(userId);
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(learningKey(normalizedUserId)) !== "false";
}

export function setLearningEnabled(userId, enabled) {
  const normalizedUserId = normalizeUserId(userId);
  if (typeof localStorage === "undefined") throw new Error("Learning preferences require localStorage");
  localStorage.setItem(learningKey(normalizedUserId), String(Boolean(enabled)));
  return Boolean(enabled);
}

export function listUserMemories(userId, filters = {}) {
  const records = listStoredMemories(normalizeUserId(userId));
  return records.filter((record) => {
    if (!filters.includeDeleted && record.status === MemoryStatus.DELETED) return false;
    if (!filters.includeSuperseded && record.status === MemoryStatus.SUPERSEDED) return false;
    if (filters.moduleId && record.moduleId !== filters.moduleId) return false;
    if (filters.category && record.category !== filters.category) return false;
    return true;
  });
}

export function getMemoryById(userId, memoryId) {
  return getRole4Record(normalizeUserId(userId), ROLE4_COLLECTIONS.MEMORIES, memoryId);
}

export function deleteMemory(userId, memoryId) {
  const existing = getMemoryById(userId, memoryId);
  if (!existing) return false;
  saveUserMemory(userId, {
    ...existing,
    status: MemoryStatus.DELETED,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export function clearModuleMemories(userId, moduleId) {
  return listUserMemories(userId, { moduleId, includeDeleted: false, includeSuperseded: true })
    .map((memory) => deleteMemory(userId, memory.id))
    .filter(Boolean).length;
}

export function deriveMemoryFromReflections(userId, moduleId) {
  const normalizedUserId = normalizeUserId(userId);
  if (!isLearningEnabled(normalizedUserId)) {
    return { created: [], updated: [], superseded: [], unchanged: [], skipped: "learning_disabled" };
  }
  const rule = getModuleMemoryRule(moduleId);
  if (!rule) return { created: [], updated: [], superseded: [], unchanged: [], skipped: "unsupported_module" };
  const reflections = listReflections(normalizedUserId).filter((reflection) => supportedReflection(reflection, moduleId));
  const candidates = candidatesFromObservations(rule(reflections));
  const result = { created: [], updated: [], superseded: [], unchanged: [] };
  candidates.forEach((candidate) => {
    const id = memoryId(moduleId, candidate.category, candidate.key);
    const existing = getMemoryById(normalizedUserId, id);
    const hasNewEvidence = existing?.metadata?.observedReflectionIds?.some((reflectionId) => !candidate.observedReflectionIds.includes(reflectionId))
      || candidate.observedReflectionIds.some((reflectionId) => !existing?.metadata?.observedReflectionIds?.includes(reflectionId));
    const confidence = confidenceForEvidence(candidate.evidenceCount, candidate.contradictionCount);
    const next = {
      id,
      memoryId: id,
      userId: normalizedUserId,
      moduleId,
      category: candidate.category,
      type: memoryType(candidate.category),
      key: candidate.key,
      value: { observedAssociation: candidate.value },
      evidenceCount: candidate.evidenceCount,
      supportingReflectionIds: candidate.supportingReflectionIds,
      confidence,
      confidenceLevel: confidenceLevel(confidence),
      firstObservedAt: existing?.firstObservedAt ?? candidate.firstObservedAt,
      lastUpdatedAt: candidate.lastUpdatedAt,
      version: MEMORY_VERSION,
      status: existing?.status === MemoryStatus.DELETED && !hasNewEvidence ? MemoryStatus.DELETED : MemoryStatus.ACTIVE,
      contradictionCount: candidate.contradictionCount,
      metadata: { observedReflectionIds: candidate.observedReflectionIds },
      schemaVersion: 1,
      createdAt: existing?.createdAt ?? candidate.firstObservedAt,
      updatedAt: candidate.lastUpdatedAt,
      privacy: PrivacyLevel.PRIVATE,
      source: OutcomeSource.SYSTEM_INFERENCE,
      evidenceIds: candidate.supportingReflectionIds,
    };
    const comparable = existing
      && JSON.stringify({
        status: existing.status,
        value: existing.value,
        evidenceCount: existing.evidenceCount,
        supportingReflectionIds: existing.supportingReflectionIds,
        confidence: existing.confidence,
        confidenceLevel: existing.confidenceLevel,
        firstObservedAt: existing.firstObservedAt,
        lastUpdatedAt: existing.lastUpdatedAt,
        version: existing.version,
        contradictionCount: existing.contradictionCount,
        metadata: existing.metadata,
      }) === JSON.stringify({
        status: next.status,
        value: next.value,
        evidenceCount: next.evidenceCount,
        supportingReflectionIds: next.supportingReflectionIds,
        confidence: next.confidence,
        confidenceLevel: next.confidenceLevel,
        firstObservedAt: next.firstObservedAt,
        lastUpdatedAt: next.lastUpdatedAt,
        version: next.version,
        contradictionCount: next.contradictionCount,
        metadata: next.metadata,
      });
    if (comparable) {
      result.unchanged.push(existing);
    } else if (next.status === MemoryStatus.DELETED) {
      result.unchanged.push(existing);
    } else {
      const saved = saveUserMemory(normalizedUserId, next);
      result[existing ? "updated" : "created"].push(saved);
    }
  });
  return result;
}
