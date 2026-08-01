import { buildTaskBreakdownInsights } from "./reflectionRules";
const buildFocusSessionInsights = ({ outcomeSummary, metrics }) => [
  ...(Number.isFinite(metrics.completionRatio) ? [{ type: "focus_session_completion", value: metrics.completionRatio, confidence: 1 }] : []),
  ...(Number.isFinite(metrics.plannedDurationMinutes) ? [{ type: "focus_session_duration", value: metrics.plannedDurationMinutes, confidence: 1 }] : []),
  ...(Number.isInteger(metrics.pauseCount) ? [{ type: "focus_session_pause_pattern", value: metrics.pauseCount, confidence: 1 }] : []),
  ...(typeof metrics.completedNaturally === "boolean" ? [{ type: "focus_session_natural_completion", value: metrics.completedNaturally, confidence: 1 }] : []),
];

const MODULE_REFLECTION_RULES = {
  "support.task_breakdown": buildTaskBreakdownInsights,
  "support.focus_session": buildFocusSessionInsights,
};

export function getModuleReflectionRule(moduleId) {
  return MODULE_REFLECTION_RULES[moduleId] ?? null;
}
