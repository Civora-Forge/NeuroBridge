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
  "support.gentle_activity": ({ outcomeSummary, metrics }) => [
    ...(Number.isFinite(metrics.completionRate) ? [{ type: 'gentle_activity_completion', value: metrics.completionRate, confidence: 1 }] : []),
    ...(Number.isFinite(metrics.energyDelta) ? [{ type: 'gentle_activity_energy_change', value: metrics.energyDelta > 0 ? 'improved' : metrics.energyDelta < 0 ? 'decreased' : 'unchanged', confidence: 1 }] : []),
    ...(Number.isInteger(metrics.stepsCompleted) ? [{ type: 'gentle_activity_step_pattern', value: metrics.stepsCompleted, confidence: 1 }] : []),
  ],
};

export function getModuleReflectionRule(moduleId) {
  return MODULE_REFLECTION_RULES[moduleId] ?? null;
}
