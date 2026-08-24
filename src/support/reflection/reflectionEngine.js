import { getInterventionHistory } from "@/support/lifecycle/interventionLifecycle";
import { getRole4Repository } from "@/support/persistence/role4Repository";
import { saveReflection } from "@/support/persistence/role4Store";
import { getModuleReflectionRule } from "./reflectionRegistry";
import { buildGenericInsights, calculateReflectionConfidence } from "./reflectionRules";
import { REFLECTION_VERSION } from "./reflectionTypes";

const REFLECTABLE_STATUSES = new Set(["completed", "partially_completed", "abandoned"]);

function finiteNumber(value) {
  return Number.isFinite(value) ? value : undefined;
}

function aggregateOutcome(history, intervention) {
  const outcomes = history?.outcomes ?? [];
  const completionOutcome = outcomes.find((outcome) =>
    outcome.status === "completed" || outcome.status === "partially_completed",
  );
  const metrics = outcomes.reduce((aggregate, outcome) => ({ ...aggregate, ...outcome.metrics }), {});
  const progressEvent = [...(history?.lifecycleEvents ?? [])]
    .reverse()
    .find((event) => Number.isFinite(event.metadata?.progress?.progressRatio) || Number.isFinite(event.metadata?.progressRatio));
  const progress = progressEvent?.metadata?.progress ?? progressEvent?.metadata ?? {};
  const completionRate = finiteNumber(metrics.completionRate)
    ?? finiteNumber(progress.progressRatio)
    ?? (intervention.status === "completed" ? 1 : undefined);
  const durationMs = finiteNumber(completionOutcome?.durationMs)
    ?? finiteNumber(outcomes.find((outcome) => Number.isFinite(outcome.durationMs))?.durationMs);
  const rating = finiteNumber(outcomes.find((outcome) => Number.isFinite(outcome.rating))?.rating);
  const completionStatus = completionOutcome?.status
    ?? (REFLECTABLE_STATUSES.has(intervention.status) ? intervention.status : null);

  return {
    outcomeSummary: {
      completionStatus,
      ...(completionRate === undefined ? {} : { completionRate }),
      ...(durationMs === undefined ? {} : { durationMs }),
      ...(rating === undefined ? {} : { rating }),
    },
    metrics,
    timestamp: completionOutcome?.updatedAt ?? progressEvent?.updatedAt ?? intervention.updatedAt ?? intervention.createdAt,
  };
}

function hasAggregateModuleMetrics(moduleId, metrics) {
  return moduleId === "support.task_breakdown" && ["timerUsed", "stepEdits", "stepReorders", "stepsCreated", "stepsCompleted"]
    .some((key) => Object.hasOwn(metrics, key));
}

/**
 * Converts one persisted terminal intervention into a versioned, user-scoped reflection.
 * It performs no adaptation, memory writes, ranking, or recommendation.
 */
function buildReflection(intervention, history) {
  if (!intervention?.id || !intervention?.moduleId || !intervention?.userId) {
    throw new Error("Reflection requires an intervention id, moduleId, and userId");
  }
  const persistedIntervention = history?.intervention ?? intervention;
  const { outcomeSummary, metrics, timestamp } = aggregateOutcome(history, persistedIntervention);
  if (!REFLECTABLE_STATUSES.has(outcomeSummary.completionStatus)) {
    throw new Error("Reflection requires a completed, partially completed, or abandoned intervention");
  }

  const rule = getModuleReflectionRule(persistedIntervention.moduleId);
  const moduleInsights = rule ? rule({ outcomeSummary, metrics }) : [];
  const confidence = calculateReflectionConfidence({
    hasStatus: Boolean(outcomeSummary.completionStatus),
    hasCompletionRate: Number.isFinite(outcomeSummary.completionRate),
    hasDuration: Number.isFinite(outcomeSummary.durationMs),
    hasRating: Number.isFinite(outcomeSummary.rating),
    hasModuleMetrics: hasAggregateModuleMetrics(persistedIntervention.moduleId, metrics),
  });
  const reflection = {
    id: `reflection-${persistedIntervention.id}-v${REFLECTION_VERSION}`,
    reflectionId: `reflection-${persistedIntervention.id}-v${REFLECTION_VERSION}`,
    interventionId: persistedIntervention.id,
    moduleId: persistedIntervention.moduleId,
    userId: persistedIntervention.userId,
    timestamp,
    outcomeSummary,
    insights: [...buildGenericInsights(outcomeSummary), ...moduleInsights],
    confidence,
    metadata: {
      version: REFLECTION_VERSION,
      evidence: {
        hasStatus: Boolean(outcomeSummary.completionStatus),
        hasCompletionRate: Number.isFinite(outcomeSummary.completionRate),
        hasDuration: Number.isFinite(outcomeSummary.durationMs),
        hasRating: Number.isFinite(outcomeSummary.rating),
        hasModuleMetrics: hasAggregateModuleMetrics(persistedIntervention.moduleId, metrics),
      },
    },
    version: REFLECTION_VERSION,
    reflectionVersion: REFLECTION_VERSION,
    schemaVersion: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    summary: `${persistedIntervention.moduleId}:${outcomeSummary.completionStatus}`,
    keyInsights: [],
    followUpSuggestions: [],
  };
  return saveReflection(persistedIntervention.userId, reflection);
}

export function reflectIntervention(intervention) {
  const history = getInterventionHistory(intervention.userId).find(
    (entry) => entry.intervention.id === intervention.id,
  );
  return buildReflection(intervention, history);
}

/** Uses the Focus repository's normalized records while keeping reflection storage domain-local. */
export async function reflectFocusIntervention(intervention, { repository: suppliedRepository } = {}) {
  if (intervention?.moduleId !== "support.focus_session") {
    throw new Error("Repository reflection is only available for Focus Sessions");
  }
  const repository = suppliedRepository || await getRole4Repository(intervention.userId);
  const [persistedIntervention, lifecycleEvents, outcomes] = await Promise.all([
    repository.getIntervention(intervention.userId, intervention.id),
    repository.listLifecycleEvents(intervention.userId, intervention.id),
    repository.listOutcomes(intervention.userId, intervention.id),
  ]);
  return buildReflection(intervention, persistedIntervention ? {
    intervention: persistedIntervention,
    lifecycleEvents,
    outcomes,
  } : null);
}
