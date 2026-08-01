import { buildTaskBreakdownMemoryObservations } from "./memoryRules";

const MODULE_MEMORY_RULES = {
  "support.task_breakdown": buildTaskBreakdownMemoryObservations,
};

export function getModuleMemoryRule(moduleId) {
  return MODULE_MEMORY_RULES[moduleId] ?? null;
}
