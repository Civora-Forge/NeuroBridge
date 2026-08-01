import { buildTaskBreakdownHints } from "./personalizationRules";

const MODULE_HINT_RULES = {
  "support.task_breakdown": buildTaskBreakdownHints,
};

export function getModuleHintRule(moduleId) {
  return MODULE_HINT_RULES[moduleId] ?? null;
}
