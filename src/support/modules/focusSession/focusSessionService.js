import { FOCUS_SESSION_DEFAULTS } from "./focusSessionTypes";

export function validateFocusSessionConfiguration(configuration = {}) {
  const plannedDurationMinutes = Number.isInteger(configuration.plannedDurationMinutes) && configuration.plannedDurationMinutes > 0 ? configuration.plannedDurationMinutes : FOCUS_SESSION_DEFAULTS.plannedDurationMinutes;
  const breakDurationMinutes = Number.isInteger(configuration.breakDurationMinutes) && configuration.breakDurationMinutes >= 0 ? configuration.breakDurationMinutes : FOCUS_SESSION_DEFAULTS.breakDurationMinutes;
  return { plannedDurationMinutes, breakDurationMinutes, breakEnabled: configuration.breakEnabled ?? FOCUS_SESSION_DEFAULTS.breakEnabled, soundEnabled: configuration.soundEnabled ?? FOCUS_SESSION_DEFAULTS.soundEnabled };
}
export const durationToSeconds = (minutes) => Math.max(0, Math.floor(minutes * 60));
export const elapsedSeconds = (total, remaining) => Math.max(0, total - Math.max(0, remaining));
export const completionRatio = (total, remaining) => total > 0 ? Math.min(1, elapsedSeconds(total, remaining) / total) : 0;
export function buildFocusSessionOutcome({ configuration, secondsRemaining, pauseCount = 0, resumeCount = 0, interruptions = 0, completedNaturally = false, breakStarted = false, breakCompleted = false } = {}) {
  const finalConfiguration = validateFocusSessionConfiguration(configuration);
  const totalSeconds = durationToSeconds(finalConfiguration.plannedDurationMinutes);
  const actualDurationMs = elapsedSeconds(totalSeconds, secondsRemaining) * 1000;
  const ratio = completionRatio(totalSeconds, secondsRemaining);
  return { completionStatus: completedNaturally ? "completed" : "partially_completed", durationMs: actualDurationMs, metrics: { plannedDurationMinutes: finalConfiguration.plannedDurationMinutes, actualDurationMs, pauseCount, resumeCount, completionRatio: ratio, interruptions, completedNaturally, breakStarted, breakCompleted }, finalConfiguration };
}
