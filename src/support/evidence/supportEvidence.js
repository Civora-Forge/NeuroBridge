import { getSupportModuleById } from "@/support/framework/supportModuleRegistry";
import { getInterventionHistory } from "@/support/lifecycle/interventionLifecycle";
import { getRole4Repository } from "@/support/persistence/role4Repository";
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

function focusEvidenceFromHistory(moduleId, interventions, events, outcomes) {
  const terminal = outcomes.filter((outcome) => outcome?.moduleId === moduleId && ["completed", "partially_completed", "abandoned"].includes(outcome.status));
  const startedCount = new Set(events.filter((event) => event?.moduleId === moduleId && ["started", "in_progress", "paused", "completed", "partially_completed", "abandoned"].includes(event.toStatus)).map((event) => event.interventionId)).size;
  const completedCount = terminal.filter((outcome) => outcome.status === "completed").length;
  const partiallyCompletedCount = terminal.filter((outcome) => outcome.status === "partially_completed").length;
  const abandonedCount = terminal.filter((outcome) => outcome.status === "abandoned").length;
  const ratings = terminal.map((outcome) => outcome.rating).filter(Number.isFinite);
  const byDuration = new Map();
  for (const outcome of terminal) {
    const duration = outcome.metrics?.plannedDurationMinutes ?? outcome.metrics?.finalConfiguration?.plannedDurationMinutes;
    if (!Number.isInteger(duration) || duration <= 0) continue;
    const entry = byDuration.get(duration) ?? { successful: [], unsuccessful: [] };
    const ratio = Number(outcome.metrics?.completionRatio);
    if (outcome.status === "completed" || (Number.isFinite(ratio) && ratio >= 0.8)) entry.successful.push(outcome);
    if (outcome.status === "abandoned" || (Number.isFinite(ratio) && ratio < 0.5)) entry.unsuccessful.push(outcome);
    byDuration.set(duration, entry);
  }
  const candidates = [...byDuration.entries()].filter(([, value]) => value.successful.length >= 2).sort((left, right) => right[1].successful.length - left[1].successful.length || left[0] - right[0]);
  const selected = terminal.length >= 3 ? candidates[0] : null;
  const preferredConfiguration = selected ? {
    values: {
      plannedDurationMinutes: selected[0],
      ...(Number.isInteger(selected[1].successful[0].metrics?.finalConfiguration?.breakDurationMinutes) ? { breakDurationMinutes: selected[1].successful[0].metrics.finalConfiguration.breakDurationMinutes } : {}),
    },
    sourceHintIds: selected[1].successful.map((outcome) => outcome.id),
    confidence: terminal.length >= 5 ? 0.85 : 0.65,
    advisory: true,
  } : null;
  const unsuccessfulConfigurations = [...byDuration.entries()].filter(([, value]) => value.unsuccessful.length >= 2).map(([duration, value]) => ({ key: "plannedDurationMinutes", value: duration, evidenceCount: value.unsuccessful.length, confidence: terminal.length >= 5 ? 0.85 : 0.65, reasonCode: "repeated_low_focus_completion" }));
  return {
    moduleId, evidenceCount: terminal.length, startedCount, completedCount, partiallyCompletedCount, abandonedCount,
    completionRate: completionRate(startedCount, completedCount, partiallyCompletedCount), effectivenessRate: null,
    averageUserRating: ratings.length ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2)) : null,
    recentOutcomeTrend: terminal.length < 2 ? "insufficient_evidence" : completedCount > abandonedCount ? "improving" : abandonedCount > completedCount ? "declining" : "mixed",
    preferredConfiguration, unsuccessfulConfigurations, personalizationHints: [], lastUsedAt: terminal.map((outcome) => outcome.createdAt).filter(Boolean).sort().at(-1) ?? null,
    confidence: preferredConfiguration?.confidence ?? confidenceForEvidence(terminal.length, ratings.length, 0, !preferredConfiguration), reasonCodes: terminal.length < 3 ? ["insufficient_focus_evidence"] : [], version: SUPPORT_EVIDENCE_VERSION,
  };
}

/** @deprecated Local/demo compatibility helper. Production callers use getSupportEvidenceAsync. */
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

/** Repository-backed Role 4 evidence read for asynchronous production consumers. */
export async function getSupportEvidenceAsync(userId, candidateModuleIds = [], { repository: suppliedRepository } = {}) {
  const normalizedUserId = String(userId ?? "").trim();
  if (!normalizedUserId) return getSupportEvidence(null, candidateModuleIds);
  const ids = canonicalCandidates(candidateModuleIds);
  let repository;
  try {
    repository = suppliedRepository || await getRole4Repository(normalizedUserId);
    const [interventions, events, outcomes] = await Promise.all([
      repository.listInterventions(normalizedUserId),
      repository.listLifecycleEvents(normalizedUserId),
      repository.listOutcomes(normalizedUserId),
    ]);
    const modules = ids.map((moduleId) => moduleId === "support.focus_session"
      ? focusEvidenceFromHistory(moduleId, interventions, events, outcomes)
      : moduleEvidence(normalizedUserId, moduleId));
    const response = { userId: normalizeUserId(normalizedUserId), generatedAt: modules.map((entry) => entry.lastUsedAt).filter(Boolean).sort().at(-1) ?? null, modules, version: SUPPORT_EVIDENCE_VERSION, reasonCodes: [] };
    return validateSupportEvidenceResponse(response);
  } catch {
    if (repository?.kind === "supabase") {
      const response = { userId: normalizeUserId(normalizedUserId), generatedAt: null, modules: ids.map((moduleId) => neutral(moduleId, ["repository_unavailable"])), version: SUPPORT_EVIDENCE_VERSION, reasonCodes: ["repository_unavailable"] };
      return validateSupportEvidenceResponse(response);
    }
    return getSupportEvidence(normalizedUserId, ids);
  }
}
