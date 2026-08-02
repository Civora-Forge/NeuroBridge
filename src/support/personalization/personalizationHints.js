import { isLearningEnabled, listUserMemories } from "@/support/memory";
import { normalizeUserId } from "@/support/schemas/storageKeys";
import { getModuleHintRule } from "./personalizationRegistry";
import { canApplyHint, PERSONALIZATION_HINT_VERSION } from "./personalizationTypes";

function emptyHints(userId, moduleId) {
  return {
    userId,
    moduleId,
    hints: [],
    generatedAt: null,
    evidenceCount: 0,
    confidence: 0,
    version: PERSONALIZATION_HINT_VERSION,
  };
}

function mergeConflicts(hints) {
  const byKey = new Map();
  hints.forEach((hint) => {
    const group = byKey.get(hint.key) ?? [];
    group.push(hint);
    byKey.set(hint.key, group);
  });
  return [...byKey.values()].map((group) => {
    const values = [...new Set(group.map((hint) => JSON.stringify(hint.value)))];
    if (values.length === 1) return group[0];
    return {
      id: `hint-conflict-${group.map((hint) => hint.id).sort().join("-")}`,
      key: group[0].key,
      value: null,
      sourceMemoryIds: group.flatMap((hint) => hint.sourceMemoryIds).sort(),
      evidenceCount: group.reduce((sum, hint) => sum + hint.evidenceCount, 0),
      confidence: Number(Math.max(0, Math.min(...group.map((hint) => hint.confidence)) - 0.1).toFixed(2)),
      advisory: "observational",
      reasonCode: "conflicting_evidence",
    };
  }).sort((left, right) => left.key.localeCompare(right.key));
}

export function getPersonalizationHints(userId, moduleId) {
  const normalizedUserId = normalizeUserId(userId);
  const response = emptyHints(normalizedUserId, moduleId);
  if (!isLearningEnabled(normalizedUserId)) return response;
  const rule = getModuleHintRule(moduleId);
  if (!rule) return response;
  const memories = listUserMemories(normalizedUserId, { moduleId });
  const hints = mergeConflicts(rule(memories));
  if (!hints.length) return response;
  const generatedAt = memories.map((memory) => memory.lastUpdatedAt ?? memory.updatedAt).filter(Boolean).sort().at(-1) ?? null;
  return {
    ...response,
    hints,
    generatedAt,
    evidenceCount: hints.reduce((sum, hint) => sum + hint.evidenceCount, 0),
    confidence: Number((hints.reduce((sum, hint) => sum + hint.confidence, 0) / hints.length).toFixed(2)),
  };
}

export function getPersonalizationHintsForModules(userId, moduleIds = []) {
  return [...new Set(moduleIds)].sort().map((moduleId) => getPersonalizationHints(userId, moduleId));
}

export function resolveAdvisoryConfiguration({ moduleDefaults = {}, personalizationHints = [], explicitConfiguration = {} } = {}) {
  const suggestedConfiguration = { ...moduleDefaults };
  const appliedHintIds = [];
  const ignoredHintIds = [];
  personalizationHints.forEach((hint) => {
    if (!canApplyHint(hint) || hint.reasonCode === "conflicting_evidence" || !(hint.key in moduleDefaults)) {
      ignoredHintIds.push(hint.id);
      return;
    }
    suggestedConfiguration[hint.key] = hint.value;
    appliedHintIds.push(hint.id);
  });
  Object.entries(explicitConfiguration).forEach(([key, value]) => {
    suggestedConfiguration[key] = value;
  });
  return { suggestedConfiguration, appliedHintIds, ignoredHintIds };
}
