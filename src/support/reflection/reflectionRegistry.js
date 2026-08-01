import { buildTaskBreakdownInsights } from "./reflectionRules";

const MODULE_REFLECTION_RULES = {
  "support.task_breakdown": buildTaskBreakdownInsights,
};

export function getModuleReflectionRule(moduleId) {
  return MODULE_REFLECTION_RULES[moduleId] ?? null;
}
