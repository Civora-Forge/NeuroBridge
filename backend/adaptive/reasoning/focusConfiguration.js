export function recommendFocusConfiguration(evidence) {
  const entry = Array.isArray(evidence?.modules) ? evidence.modules.find((item) => item.moduleId === "support.focus_session") : null;
  const values = entry?.preferredConfiguration?.values;
  if (!entry?.preferredConfiguration?.advisory || entry.confidence < 0.65 || !Number.isInteger(values?.plannedDurationMinutes)) return null;
  return {
    plannedDurationMinutes: values.plannedDurationMinutes,
    ...(Number.isInteger(values.breakDurationMinutes) ? { breakDurationMinutes: values.breakDurationMinutes } : {}),
    evidenceCount: entry.evidenceCount,
    confidence: entry.confidence,
    reasonCode: "repeated_focus_session_outcomes",
  };
}
