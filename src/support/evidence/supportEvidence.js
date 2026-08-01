import { getSupportModuleById } from "@/support/framework/supportModuleRegistry";
import { getInterventionHistory } from "@/support/lifecycle/interventionLifecycle";
import { isLearningEnabled, listUserMemories } from "@/support/memory";
import { getPersonalizationHints } from "@/support/personalization";
import { listReflections } from "@/support/persistence/role4Store";
import { normalizeUserId } from "@/support/schemas/storageKeys";
import { validateSupportEvidenceResponse } from "@/support/schemas/supportSchemas";
import { confidenceForEvidence, SUPPORT_EVIDENCE_VERSION } from "./supportEvidenceTypes";
import { completionRate, qualityIsPositive, trendForReflections } from "./supportEvidenceRules";

function neutral(moduleId, reasonCodes = []) {
  return { moduleId, evidenceCount: 0, startedCount: 0, completedCount: 0, partiallyCompletedCount: 0, abandonedCount: 0, completionRate: null, effectivenessRate: null, averageUserRating: null, recentOutcomeTrend: "insufficient_evidence", preferredConfiguration: null, unsuccessfulConfigurations: [], personalizationHints: [], lastUsedAt: null, confidence: 0, reasonCodes, version: SUPPORT_EVIDENCE_VERSION };
}

function canonicalCandidates(ids = []) {
  const seen = new Set();
  return ids.filter((id) => typeof id === "string" && id.trim()).filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function moduleEvidence(userId, moduleId) {
  const module = getSupportModuleById(moduleId);
  if (!module || module.id !== moduleId) return neutral(moduleId, ["invalid_module_id"]);
  const history = getInterventionHistory(userId, { moduleId });
  const startedCount = history.filter((entry) => entry.lifecycleEvents.some((event) => event.toStatus === "started" || event.toStatus === "in_progress" || event.toStatus === "paused" || ["completed", "partially_completed", "abandoned"].includes(event.toStatus))).length;
  const reflections = listReflections(userId).filter((reflection) => reflection.moduleId === moduleId && reflection.version === 1 && reflection.reflectionVersion === 1 && ["completed", "partially_completed", "abandoned"].includes(reflection.outcomeSummary?.completionStatus)).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const completedCount = reflections.filter((reflection) => reflection.outcomeSummary.completionStatus === "completed").length;
  const partiallyCompletedCount = reflections.filter((reflection) => reflection.outcomeSummary.completionStatus === "partially_completed").length;
  const abandonedCount = reflections.filter((reflection) => reflection.outcomeSummary.completionStatus === "abandoned").length;
  const ratings = reflections.map((reflection) => reflection.outcomeSummary?.rating).filter(Number.isFinite);
  const sufficient = reflections.filter((reflection) => Number.isFinite(reflection.outcomeSummary?.rating) || reflection.insights?.some((insight) => insight.type === "intervention_quality" && insight.value === "strong"));
  const effective = sufficient.filter(qualityIsPositive).length;
  const learningEnabled = isLearningEnabled(userId);
  const hints = learningEnabled ? getPersonalizationHints(userId, moduleId).hints : [];
  const preferred = hints.filter((hint) => ["usable", "strong"].includes(hint.advisory) && hint.reasonCode !== "conflicting_evidence" && ["selectedStyle", "timerEnabled"].includes(hint.key));
  const memories = learningEnabled ? listUserMemories(userId, { moduleId }) : [];
  const unsuccessfulConfigurations = memories.filter((memory) => memory.category === "unsuccessful_configuration" && memory.confidence >= 0.4).map((memory) => ({ key: memory.key, value: memory.value?.observedAssociation, evidenceCount: memory.evidenceCount, confidence: memory.confidence, reasonCode: "observed_unsuccessful_association" }));
  const contradictions = memories.reduce((sum, memory) => sum + (memory.contradictionCount || 0), 0);
  const trend = trendForReflections(reflections);
  return {
    moduleId, evidenceCount: reflections.length, startedCount, completedCount, partiallyCompletedCount, abandonedCount,
    completionRate: completionRate(startedCount, completedCount, partiallyCompletedCount),
    effectivenessRate: sufficient.length ? Number((effective / sufficient.length).toFixed(2)) : null,
    averageUserRating: ratings.length ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(2)) : null,
    recentOutcomeTrend: trend,
    preferredConfiguration: preferred.length ? { values: Object.fromEntries(preferred.map((hint) => [hint.key, hint.value])), sourceHintIds: preferred.map((hint) => hint.id), confidence: Math.min(...preferred.map((hint) => hint.confidence)), advisory: true } : null,
    unsuccessfulConfigurations, personalizationHints: hints, lastUsedAt: reflections.at(-1)?.timestamp ?? null,
    confidence: confidenceForEvidence(reflections.length, ratings.length, contradictions, trend === "mixed"),
    reasonCodes: reflections.length ? [] : ["no_reflectable_history"], version: SUPPORT_EVIDENCE_VERSION,
  };
}

export function getSupportEvidence(userId, candidateModuleIds = []) {
  const normalizedUserId = String(userId ?? "").trim();
  if (!normalizedUserId) return validateSupportEvidenceResponse({ userId: null, generatedAt: null, modules: [], version: SUPPORT_EVIDENCE_VERSION, reasonCodes: ["missing_authenticated_user"] });
  const ids = canonicalCandidates(candidateModuleIds);
  const response = { userId: normalizeUserId(normalizedUserId), generatedAt: null, modules: ids.map((moduleId) => moduleEvidence(normalizedUserId, moduleId)), version: SUPPORT_EVIDENCE_VERSION, reasonCodes: [] };
  response.generatedAt = response.modules.map((entry) => entry.lastUsedAt).filter(Boolean).sort().at(-1) ?? null;
  return validateSupportEvidenceResponse(response);
}

export function getModuleSupportEvidence(userId, moduleId) {
  return getSupportEvidence(userId, [moduleId]).modules[0] ?? neutral(moduleId, ["invalid_module_id"]);
}
