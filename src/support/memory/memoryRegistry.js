import { buildFocusSessionMemoryObservations, buildTaskBreakdownMemoryObservations } from "./memoryRules";

const MODULE_MEMORY_RULES = {
  "support.task_breakdown": buildTaskBreakdownMemoryObservations,
  "support.focus_session": buildFocusSessionMemoryObservations,
};

export function getModuleMemoryRule(moduleId) {
  return MODULE_MEMORY_RULES[moduleId] ?? null;
}
