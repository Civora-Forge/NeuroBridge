import { PARTIAL_COMPLETION_WEIGHT } from "./supportEvidenceTypes";

export function qualityIsPositive(reflection) {
  const quality = reflection.insights?.find((insight) => insight.type === "intervention_quality")?.value;
  return quality === "strong" || (reflection.outcomeSummary?.completionStatus === "completed" && reflection.outcomeSummary?.rating >= 4);
}

export function trendForReflections(reflections) {
  if (reflections.length < 3) return "insufficient_evidence";
  const values = reflections.slice(-5).map((reflection) => qualityIsPositive(reflection) ? 1 : 0);
  const midpoint = Math.ceil(values.length / 2);
  const first = values.slice(0, midpoint);
  const last = values.slice(midpoint);
  const delta = last.reduce((sum, value) => sum + value, 0) / last.length
    - first.reduce((sum, value) => sum + value, 0) / first.length;
  if (delta >= 0.25) return "improving";
  if (delta <= -0.25) return "declining";
  if (new Set(values).size === 1) return "stable";
  return "mixed";
}

export function completionRate(startedCount, completedCount, partiallyCompletedCount) {
  if (!startedCount) return null;
  return Number(((completedCount + PARTIAL_COMPLETION_WEIGHT * partiallyCompletedCount) / startedCount).toFixed(2));
}
