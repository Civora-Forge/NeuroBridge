import { buildFocusSessionMemoryObservations, buildGentleActivityMemoryObservations, buildTaskBreakdownMemoryObservations } from "./memoryRules";

const MODULE_MEMORY_RULES = {
  "support.task_breakdown": buildTaskBreakdownMemoryObservations,
  "support.focus_session": buildFocusSessionMemoryObservations,
  "support.gentle_activity": buildGentleActivityMemoryObservations,
};

export function getModuleMemoryRule(moduleId) {
  return MODULE_MEMORY_RULES[moduleId] ?? null;
}
