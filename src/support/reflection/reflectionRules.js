import {
  DurationCategory,
  EngagementLevel,
  ReflectionInsightType,
} from "./reflectionTypes";

const SHORT_DURATION_MS = 5 * 60 * 1000;
const LONG_DURATION_MS = 30 * 60 * 1000;

function insight(type, value, confidence) {
  return { type, value, confidence };
}

export function durationCategory(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return DurationCategory.UNKNOWN;
  if (durationMs < SHORT_DURATION_MS) return DurationCategory.SHORT;
  if (durationMs > LONG_DURATION_MS) return DurationCategory.LONG;
  return DurationCategory.STANDARD;
}

export function engagementLevel(completionRate) {
  if (!Number.isFinite(completionRate)) return EngagementLevel.UNKNOWN;
  if (completionRate >= 0.8) return EngagementLevel.HIGH;
  if (completionRate >= 0.3) return EngagementLevel.MODERATE;
  return EngagementLevel.LOW;
}

export function buildGenericInsights(outcomeSummary) {
  const insights = [];
  const completionRate = outcomeSummary.completionRate;
  const completedSuccessfully = outcomeSummary.completionStatus === "completed";

  insights.push(insight(
    ReflectionInsightType.COMPLETED_SUCCESSFULLY,
    completedSuccessfully,
    outcomeSummary.completionStatus ? 1 : 0,
  ));

  if (Number.isFinite(completionRate)) {
    insights.push(insight(ReflectionInsightType.COMPLETION_RATE, completionRate, 1));
    insights.push(insight(ReflectionInsightType.ENGAGEMENT_LEVEL, engagementLevel(completionRate), 1));
  }

  if (Number.isFinite(outcomeSummary.durationMs)) {
    insights.push(insight(
      ReflectionInsightType.DURATION_CATEGORY,
      durationCategory(outcomeSummary.durationMs),
      1,
    ));
  }

  if (Number.isFinite(outcomeSummary.rating)) {
    const satisfaction = outcomeSummary.rating >= 4 ? "high" : outcomeSummary.rating <= 2 ? "low" : "neutral";
    insights.push(insight(ReflectionInsightType.USER_SATISFACTION, satisfaction, 1));
  }

  const quality = completedSuccessfully && outcomeSummary.rating >= 4
    ? "strong"
    : completedSuccessfully || outcomeSummary.rating >= 3
    ? "adequate"
    : outcomeSummary.completionStatus
    ? "limited"
    : "unknown";
  insights.push(insight(
    ReflectionInsightType.INTERVENTION_QUALITY,
    quality,
    Number.isFinite(completionRate) || Number.isFinite(outcomeSummary.rating) ? 0.8 : 0.4,
  ));

  return insights;
}

export function buildTaskBreakdownInsights({ outcomeSummary, metrics }) {
  const insights = [];
  if (Number.isFinite(outcomeSummary.completionRate)) {
    insights.push(insight(
      ReflectionInsightType.TASK_BREAKDOWN_COMPLETION,
      outcomeSummary.completionRate === 1 ? "high_completion" : "partial_completion",
      1,
    ));
  }
  if (typeof metrics.timerUsed === "boolean") {
    insights.push(insight(ReflectionInsightType.TASK_BREAKDOWN_TIMER, metrics.timerUsed, 1));
  }
  if (Number.isInteger(metrics.stepEdits)) {
    insights.push(insight(
      ReflectionInsightType.TASK_BREAKDOWN_EDITS,
      metrics.stepEdits >= 2 ? "many_edits" : "few_edits",
      1,
    ));
  }
  return insights;
}

export function calculateReflectionConfidence({
  hasStatus,
  hasCompletionRate,
  hasDuration,
  hasRating,
  hasModuleMetrics,
}) {
  return Number((
    (hasStatus ? 0.3 : 0)
    + (hasCompletionRate ? 0.3 : 0)
    + (hasDuration ? 0.15 : 0)
    + (hasRating ? 0.15 : 0)
    + (hasModuleMetrics ? 0.1 : 0)
  ).toFixed(2));
}
