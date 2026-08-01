import { MemoryCategory } from "./memoryTypes";

function insightValue(reflection, type) {
  return reflection.insights?.find((insight) => insight.type === type)?.value;
}

function configuration(reflection) {
  const candidate = reflection.metadata?.configuration;
  return candidate && typeof candidate === "object" ? candidate : {};
}

function add(observations, category, key, value, reflection) {
  observations.push({
    category,
    key,
    value,
    reflectionId: reflection.id,
    timestamp: reflection.timestamp ?? reflection.updatedAt ?? reflection.createdAt,
  });
}

export function buildTaskBreakdownMemoryObservations(reflections) {
  const observations = [];
  reflections.forEach((reflection) => {
    const summary = reflection.outcomeSummary ?? {};
    const config = configuration(reflection);
    const completionRate = summary.completionRate;
    const rating = summary.rating;
    const completionBand = completionRate >= 0.8 ? "high" : completionRate >= 0.3 ? "partial" : "low";
    if (Number.isFinite(completionRate)) {
      add(observations, MemoryCategory.COMPLETION_PATTERN, "completion_rate_band", completionBand, reflection);
    }
    if (Number.isFinite(rating)) {
      add(observations, MemoryCategory.FEEDBACK_PATTERN, "satisfaction_band", rating >= 4 ? "high" : rating <= 2 ? "low" : "neutral", reflection);
    }
    if (["Bare Minimum", "Standard", "Hero Mode"].includes(config.selectedStyle)) {
      add(observations, MemoryCategory.PREFERRED_CONFIGURATION, "selected_style", config.selectedStyle, reflection);
      if (Number.isFinite(rating) && rating <= 2) {
        add(observations, MemoryCategory.UNSUCCESSFUL_CONFIGURATION, "low_satisfaction_style", config.selectedStyle, reflection);
      }
    }
    if (typeof config.requestedStepCount === "number" && config.requestedStepCount >= 6) {
      add(observations, MemoryCategory.UNSUCCESSFUL_CONFIGURATION, "high_step_count_outcome", summary.completionStatus === "abandoned" ? "abandoned" : "not_abandoned", reflection);
    }
    const timerUsed = insightValue(reflection, "task_breakdown_timer");
    if (timerUsed === true && Number.isFinite(completionRate)) {
      add(observations, MemoryCategory.SUCCESSFUL_STRATEGY, "timer_associated_completion", completionRate >= 0.8 ? "high_completion" : "not_high_completion", reflection);
    }
    if (summary.durationMs < 5 * 60 * 1000 && Number.isFinite(completionRate)) {
      add(observations, MemoryCategory.SUCCESSFUL_STRATEGY, "short_breakdown_completion", completionRate >= 0.8 ? "high_completion" : "not_high_completion", reflection);
    }
  });
  return observations;
}

export function buildFocusSessionMemoryObservations(reflections) {
  const observations = [];
  reflections.forEach((reflection) => {
    const summary = reflection.outcomeSummary ?? {};
    const ratio = insightValue(reflection, 'focus_session_completion');
    const duration = insightValue(reflection, 'focus_session_duration');
    const pauses = insightValue(reflection, 'focus_session_pause_pattern');
    const natural = insightValue(reflection, 'focus_session_natural_completion');
    if (Number.isFinite(ratio)) add(observations, MemoryCategory.COMPLETION_PATTERN, 'focus_completion_ratio_band', ratio >= 0.8 ? 'high' : ratio >= 0.3 ? 'partial' : 'low', reflection);
    if (summary.completionStatus === 'abandoned' && Number.isFinite(duration) && duration >= 45) add(observations, MemoryCategory.UNSUCCESSFUL_CONFIGURATION, 'long_session_abandonment', 'abandoned', reflection);
    if (natural === true && Number.isFinite(duration)) add(observations, MemoryCategory.SUCCESSFUL_STRATEGY, 'naturally_completed_duration', String(duration), reflection);
    if (pauses === 0 && summary.completionStatus === 'completed') add(observations, MemoryCategory.SUCCESSFUL_STRATEGY, 'low_pause_completion', 'observed', reflection);
  });
  return observations;
}
